/**
 * panic-trading-signals.js — 트레이딩 전용 시그널(단·중·장기) 확장 모듈
 * panic-signal-engine.js 로드 이후 실행. 기존 PanicSignalEngine 객체에 메서드만 추가합니다.
 */
(function (global) {
  "use strict";
  var PE = global.PanicSignalEngine;
  if (!PE) return;

  function round2(x) {
    var n = Number(x);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
  }

  /** @returns {number|null} */
  function getDelta(now, prev) {
    if (!Number.isFinite(Number(now)) || !Number.isFinite(Number(prev))) return null;
    if (typeof PE.computeDelta === "function") return PE.computeDelta(now, prev);
    return round2(Number(now) - Number(prev));
  }

  /** @returns {"up"|"down"|"flat"|null} */
  function getDirection(delta) {
    if (delta === null || delta === undefined || !Number.isFinite(Number(delta))) return null;
    if (Number(delta) > 1e-9) return "up";
    if (Number(delta) < -1e-9) return "down";
    return "flat";
  }

  /** @returns {"weak"|"normal"|"strong"} */
  function getStrength(count) {
    var c = Number(count);
    if (!Number.isFinite(c) || c < 0) return "weak";
    if (c >= 2) return "strong";
    if (c >= 1) return "normal";
    return "weak";
  }

  function np(x) {
    var n = Number(x);
    return Number.isFinite(n) ? round2(n) : null;
  }

  /** 스칼라 또는 {now,prev} → { now, prev } (prev 없으면 now) */
  function seriesPair(val) {
    if (val && typeof val === "object" && ("now" in val || "prev" in val)) {
      var now = np(val.now);
      var prev = np(val.prev);
      if (!Number.isFinite(now)) return { now: null, prev: null };
      if (!Number.isFinite(prev)) prev = now;
      return { now: now, prev: prev };
    }
    var n = np(val);
    if (!Number.isFinite(n)) return { now: null, prev: null };
    return { now: n, prev: n };
  }

  /**
   * mergeMomentumPayload 결과 → 트레이딩 입력(스칼라 필드는 prev=now 폴백)
   */
  function normalizeTradingSeries(merged) {
    var m = merged && typeof merged === "object" ? merged : {};
    var vx = seriesPair(m.vix);
    var pc = seriesPair(m.putCall);
    var fg = seriesPair(m.fearGreed);
    var bo = seriesPair(m.bofa != null && typeof m.bofa === "object" ? m.bofa : { now: m.bofa, prev: m.bofa });
    var hy = seriesPair(m.highYield != null && typeof m.highYield === "object" ? m.highYield : { now: m.highYield, prev: m.highYield });
    var liq = seriesPair(m.liquidity != null && typeof m.liquidity === "object" ? m.liquidity : { now: m.liquidity, prev: m.liquidity });
    var rt = seriesPair(m.rate != null && typeof m.rate === "object" ? m.rate : { now: m.rate, prev: m.rate });
    var prev2 = null;
    if (m.vix && typeof m.vix === "object" && m.vix.prev2 != null) prev2 = np(m.vix.prev2);
    if (!Number.isFinite(prev2) && m.vixPrev2 != null) prev2 = np(m.vixPrev2);
    return {
      vix: { now: vx.now, prev: vx.prev, prev2: prev2 },
      putCall: pc,
      fearGreed: fg,
      bofa: bo,
      highYield: hy,
      liquidity: liq,
      rate: rt,
      dollar: np(m.dollar),
      yieldCurve: np(m.yieldCurve),
      _meta: m._meta || {}
    };
  }

  function getTradingShortSignal(d) {
    var vx = d.vix || {};
    var pc = d.putCall || {};
    var fg = d.fearGreed || {};
    var vNow = vx.now;
    var vPrev = vx.prev;
    var vPrev2 = vx.prev2;
    var dVix = getDelta(vNow, vPrev);
    var dPc = getDelta(pc.now, pc.prev);
    var dFg = getDelta(fg.now, fg.prev);

    if (!Number.isFinite(vNow) || !Number.isFinite(vPrev)) {
      return {
        label: "🟡 중립",
        strength: "weak",
        reason: "VIX 데이터 부족 — now/prev 확인 필요."
      };
    }

    var twoDown =
      Number.isFinite(vPrev2) &&
      vNow < vPrev &&
      vPrev < vPrev2 &&
      vNow >= 25;
    if (twoDown) {
      return {
        label: "💥 강력 매수",
        strength: "strong",
        reason:
          "VIX가 25 이상 구간에서 이틀 연속 하락(now=" +
          vNow +
          ", prev=" +
          vPrev +
          ", prev2=" +
          vPrev2 +
          ") — 공포 고점에서의 둔화 패턴."
      };
    }

    var label = "🟡 중립";
    var strength = "normal";
    var reason = "VIX=" + vNow + ", Δ=" + (dVix != null ? dVix : "n/a") + " — 극단 규칙 미충족.";

    if (vNow > 30 && dVix !== null && dVix > 0) {
      label = "🚨 패닉 진행중 (관망)";
      strength = "strong";
      reason = "VIX>30 & Δ>0 (" + dVix + ") — 패닉 확장.";
    } else if (vNow > 25 && dVix !== null && dVix < 0) {
      label = "🔥 단기 매수 타이밍 (공포 꺾임)";
      strength = "normal";
      reason = "VIX>25 & Δ<0 (" + dVix + ") — 공포 완화 전환.";
    } else if (vNow < 20) {
      label = "⚠️ 과열 구간 (추격 금지)";
      strength = "normal";
      reason = "VIX<20 — 저변동성·탐욕 구간 주의.";
    }

    if (dPc !== null && dPc > 0 && dFg !== null && dFg < 0) {
      strength = getStrength(2);
      reason += " Put/Call 상승 + F&G 하락 동시 충족 → 신뢰도 strong.";
    } else {
      var alignCount = 0;
      if (dPc !== null && dPc > 0) alignCount += 1;
      if (dFg !== null && dFg < 0) alignCount += 1;
      if (dVix !== null && dVix > 0 && vNow > 25) alignCount += 1;
      if (alignCount >= 2) {
        strength = "strong";
        reason += " 동일 방향 지표 " + alignCount + "개 일치.";
      }
    }

    return { label: label, strength: strength, reason: reason };
  }

  function getTradingMidSignal(d) {
    var b = d.bofa || {};
    var hy = d.highYield || {};
    var dB = getDelta(b.now, b.prev);
    var dH = getDelta(hy.now, hy.prev);
    if (!Number.isFinite(b.now) || !Number.isFinite(hy.now)) {
      return { label: "🟢 정상", strength: "weak", reason: "BofA 또는 HY 수치 부족." };
    }
    var risk = dB !== null && dB < -0.03 && dH !== null && dH > 0.03;
    if (risk) {
      return {
        label: "🟠 위험 증가",
        strength: "strong",
        reason: "BofA 하락(Δ=" + (dB != null ? dB : "n/a") + ") + HY 상승(Δ=" + (dH != null ? dH : "n/a") + ")."
      };
    }
    if (dB !== null && dB > 0.05 && Number.isFinite(b.prev) && b.prev <= 4.2) {
      return {
        label: "🟡 회복 초기",
        strength: "normal",
        reason: "BofA 저점(" + b.prev + ")에서 반등(Δ=" + dB + ") 시작."
      };
    }
    var stable = (dB === null || Math.abs(dB) < 0.08) && (dH === null || Math.abs(dH) < 0.04);
    if (stable) {
      return {
        label: "🟢 정상",
        strength: "normal",
        reason: "BofA·HY 모멘텀 완만 (Δ " + (dB != null ? dB : "n/a") + " / " + (dH != null ? dH : "n/a") + ")."
      };
    }
    return {
      label: "🟡 중립",
      strength: "weak",
      reason: "혼재: BofA=" + b.now + ", HY=" + hy.now + "."
    };
  }

  function getTradingLongSignal(d) {
    if (typeof PE.getLongSignal === "function") {
      return PE.getLongSignal(d);
    }
    return { label: "🟡 중립", strength: "weak", reason: "엔진 미로드." };
  }

  function getTradingSignals(merged) {
    var d = normalizeTradingSeries(merged);
    return {
      short: getTradingShortSignal(d),
      mid: getTradingMidSignal(d),
      long: getTradingLongSignal(d)
    };
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var TRADING_CARD_COPY = {
    short: { title: "단기 (트레이딩)", sub: "VIX · Put/Call · F&G" },
    mid: { title: "중기 (트레이딩)", sub: "BofA · HY" },
    long: { title: "장기 (트레이딩)", sub: "금리 · 유동성 · DXY · 곡선" }
  };

  function strengthToKey(st) {
    if (st === "strong") return "fire";
    if (st === "weak") return "watch";
    return "neutral";
  }

  function renderTradingSignals(rootEl, signals, data) {
    if (!rootEl || !signals) return;
    var types = ["short", "mid", "long"];
    for (var i = 0; i < types.length; i += 1) {
      var type = types[i];
      var el = rootEl.querySelector('[data-trading-card="' + type + '"]');
      if (!el) continue;
      var s = signals[type] || { label: "—", strength: "weak", reason: "" };
      var copy = TRADING_CARD_COPY[type];
      var key = strengthToKey(s.strength);
      var foot = "";
      if (type === "long" && data && data._meta && data._meta.yieldMissing) {
        foot =
          '<p class="panic-trading-dashboard__foot">장단기 금리차는 <code>signalExtras.t10y2y</code> 또는 <code>data/panic.json</code>의 <code>yieldCurve</code>로 보강할 수 있습니다.</p>';
      }
      el.className = "panic-trading-dashboard__card panic-trading-dashboard__card--" + esc(key);
      el.innerHTML =
        '<p class="panic-trading-dashboard__eyebrow">' +
        esc(copy.title) +
        "</p>" +
        '<p class="panic-trading-dashboard__sub">' +
        esc(copy.sub) +
        "</p>" +
        '<p class="panic-trading-dashboard__badge">강도 · <strong>' +
        esc(s.strength || "normal") +
        "</strong></p>" +
        '<p class="panic-trading-dashboard__value">' +
        esc(s.label || "") +
        "</p>" +
        '<p class="panic-trading-dashboard__reason">' +
        esc(s.reason || "") +
        "</p>" +
        foot;
    }
  }

  function renderTradingLoading(rootEl) {
    if (!rootEl) return;
    var types = ["short", "mid", "long"];
    for (var i = 0; i < types.length; i += 1) {
      var el = rootEl.querySelector('[data-trading-card="' + types[i] + '"]');
      if (!el) continue;
      el.className = "panic-trading-dashboard__card panic-trading-dashboard__card--na";
      el.innerHTML =
        '<p class="panic-trading-dashboard__eyebrow">' +
        esc(TRADING_CARD_COPY[types[i]].title) +
        '</p><p class="panic-trading-dashboard__value" style="color:#8b93a7">계산 중…</p>';
    }
  }

  PE.getDelta = getDelta;
  PE.getDirection = getDirection;
  PE.getStrength = getStrength;
  PE.normalizeTradingSeries = normalizeTradingSeries;
  PE.getTradingShortSignal = getTradingShortSignal;
  PE.getTradingMidSignal = getTradingMidSignal;
  PE.getTradingLongSignal = getTradingLongSignal;
  PE.getTradingSignals = getTradingSignals;
  PE.renderTradingSignals = renderTradingSignals;
  PE.renderTradingLoading = renderTradingLoading;
})(typeof window !== "undefined" ? window : this);
