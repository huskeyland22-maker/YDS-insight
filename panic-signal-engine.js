/**
 * panic-signal-engine.js — 레벨 + 모멘텀(Δ) 기반 단·중·장기 시그널
 * panic-data / data/panic.json / 티커·해외 데이터와 결합해 사용합니다.
 */
(function (global) {
  "use strict";

  function parseNum(text) {
    var cleaned = String(text || "").replace(/[^0-9.\-]/g, "");
    var n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function round2(x) {
    return Math.round(Number(x) * 100) / 100;
  }

  /** 절대 증감 (now − prev). */
  function computeDelta(now, prev) {
    if (!Number.isFinite(now) || !Number.isFinite(prev)) return null;
    return round2(now - prev);
  }

  /** 변화율 % ((now−prev)/|prev|)×100, prev≈0 이면 null */
  function computeDeltaPct(now, prev) {
    if (!Number.isFinite(now) || !Number.isFinite(prev) || Math.abs(prev) < 1e-9) return null;
    return round2(((now - prev) / Math.abs(prev)) * 100);
  }

  function findItem(items, id) {
    for (var i = 0; i < (items || []).length; i += 1) {
      if (items[i] && items[i].id === id) return items[i];
    }
    return null;
  }

  /**
   * panic row → { now, prev, prev2? }
   * previousClose·change(JSON) 우선. prev2는 옵션(vixPrev2 또는 item.prev2).
   */
  function pairFromPanicItem(it, id) {
    if (!it) return { now: null, prev: null, prev2: null };
    var now = parseNum(it.value);
    var prev = null;
    if (it.previousClose !== undefined && it.previousClose !== null && it.previousClose !== "") {
      var pc = Number(it.previousClose);
      if (Number.isFinite(pc)) prev = round2(pc);
    }
    if (!Number.isFinite(prev) && Number.isFinite(now) && it.change !== undefined && it.change !== null) {
      var ch = Number(it.change);
      if (Number.isFinite(ch)) prev = round2(now - ch);
    }
    if (!Number.isFinite(prev)) prev = Number.isFinite(now) ? now : null;
    var prev2 = null;
    if (it.prev2 !== undefined && it.prev2 !== null && it.prev2 !== "") {
      var p2 = Number(it.prev2);
      if (Number.isFinite(p2)) prev2 = round2(p2);
    }
    return { now: now, prev: prev, prev2: prev2 };
  }

  function liquidityFromMovePair(movePair) {
    if (!movePair || !Number.isFinite(movePair.now)) return { now: null, prev: null };
    var now = round2(-(movePair.now / 45));
    var prev = Number.isFinite(movePair.prev) ? round2(-(movePair.prev / 45)) : now;
    return { now: now, prev: prev };
  }

  /**
   * panic-data.json + ticker + overseas → 모멘텀 입력 스키마
   */
  function buildMomentumInputFromPanic(panicData, tickerData, overseasData) {
    var items = (panicData && panicData.items) || [];
    var vixP = pairFromPanicItem(findItem(items, "vix"), "vix");
    var pcP = pairFromPanicItem(findItem(items, "putcall"), "putcall");
    var fgP = pairFromPanicItem(findItem(items, "fng"), "fng");
    var bofaP = pairFromPanicItem(findItem(items, "bofa"), "bofa");
    var hyP = pairFromPanicItem(findItem(items, "hy"), "hy");
    var moveP = pairFromPanicItem(findItem(items, "move"), "move");
    var liq = liquidityFromMovePair(moveP);

    var rateNow = null;
    var ratePrev = null;
    if (tickerData && tickerData.items) {
      for (var t = 0; t < tickerData.items.length; t += 1) {
        var tr = tickerData.items[t];
        if (tr && tr.label === "US 10Y") {
          rateNow = parseNum(tr.value);
          if (tr.previousClose !== undefined && tr.previousClose !== null && tr.previousClose !== "") {
            var rp = Number(tr.previousClose);
            if (Number.isFinite(rp)) ratePrev = round2(rp);
          }
          if (!Number.isFinite(ratePrev) && Number.isFinite(rateNow) && Number.isFinite(tr.change)) {
            ratePrev = round2(rateNow - Number(tr.change));
          }
          if (!Number.isFinite(ratePrev)) ratePrev = rateNow;
          break;
        }
      }
    }

    var dollar = null;
    if (overseasData && overseasData.flow && Array.isArray(overseasData.flow.items)) {
      for (var f = 0; f < overseasData.flow.items.length; f += 1) {
        var fi = overseasData.flow.items[f];
        if (fi && fi.id === "dxy") {
          var m = String(fi.value || "").match(/([\d.]+)/);
          if (m) dollar = parseFloat(m[1]);
          break;
        }
      }
    }

    var yieldCurve = null;
    var extras = panicData && panicData.signalExtras ? panicData.signalExtras : {};
    if (extras && extras.t10y2y !== null && extras.t10y2y !== undefined && extras.t10y2y !== "") {
      var yn = Number(extras.t10y2y);
      if (Number.isFinite(yn)) yieldCurve = round2(yn);
    }

    return {
      vix: vixP,
      putCall: pcP,
      fearGreed: fgP,
      bofa: { now: bofaP.now, prev: bofaP.prev },
      highYield: { now: hyP.now, prev: hyP.prev },
      liquidity: liq,
      rate: { now: rateNow, prev: ratePrev },
      dollar: dollar,
      yieldCurve: yieldCurve,
      updatedAt: panicData && panicData.updatedAt ? String(panicData.updatedAt) : null,
      _meta: { yieldMissing: yieldCurve === null }
    };
  }

  function panicValueById(items, id) {
    for (var i = 0; i < items.length; i += 1) {
      if (items[i] && items[i].id === id) return items[i].value;
    }
    return null;
  }

  function rowFromFlatJson(j) {
    var src = j && typeof j === "object" ? j : {};
    function num(k) {
      var v = src[k];
      if (v === null || v === undefined || v === "") return null;
      var n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    var yc = src.yieldCurve;
    var yieldCurve = null;
    if (yc !== null && yc !== undefined && yc !== "") {
      var yn = Number(yc);
      if (Number.isFinite(yn)) yieldCurve = yn;
    }
    return {
      vix: num("vix"),
      putCall: num("putCall"),
      fearGreed: num("fearGreed"),
      bofa: num("bofa"),
      highYield: num("highYield"),
      liquidity: num("liquidity"),
      dollar: num("dollar"),
      yieldCurve: yieldCurve,
      rate: num("rate"),
      updatedAt: src.updatedAt != null ? String(src.updatedAt) : null,
      _meta: { yieldMissing: yieldCurve === null }
    };
  }

  function buildMacroRow(panicData, tickerData, overseasData) {
    var items = (panicData && panicData.items) || [];
    var move = parseNum(panicValueById(items, "move"));
    var liquidity = Number.isFinite(move) ? -(move / 45) : null;
    var rate = null;
    if (tickerData && tickerData.items) {
      for (var t = 0; t < tickerData.items.length; t += 1) {
        var row = tickerData.items[t];
        if (row && row.label === "US 10Y") {
          rate = parseNum(row.value);
          break;
        }
      }
    }
    var dollar = null;
    if (overseasData && overseasData.flow && Array.isArray(overseasData.flow.items)) {
      for (var f = 0; f < overseasData.flow.items.length; f += 1) {
        var fi = overseasData.flow.items[f];
        if (fi && fi.id === "dxy") {
          var m = String(fi.value || "").match(/([\d.]+)/);
          if (m) dollar = parseFloat(m[1]);
          break;
        }
      }
    }
    var extras = panicData && panicData.signalExtras ? panicData.signalExtras : {};
    var yieldCurve = null;
    if (extras && extras.t10y2y !== null && extras.t10y2y !== undefined && extras.t10y2y !== "") {
      var yn = Number(extras.t10y2y);
      if (Number.isFinite(yn)) yieldCurve = yn;
    }
    return {
      vix: parseNum(panicValueById(items, "vix")),
      putCall: parseNum(panicValueById(items, "putcall")),
      fearGreed: parseNum(panicValueById(items, "fng")),
      bofa: parseNum(panicValueById(items, "bofa")),
      highYield: parseNum(panicValueById(items, "hy")),
      liquidity: liquidity,
      dollar: dollar,
      yieldCurve: yieldCurve,
      rate: rate,
      _meta: { yieldMissing: yieldCurve === null }
    };
  }

  function readPair(key, raw, fallback) {
    var v = raw[key];
    if (v && typeof v === "object" && ("now" in v || "prev" in v)) {
      var now = Number(v.now);
      var prev = Number(v.prev);
      var prev2 = v.prev2 !== undefined && v.prev2 !== null && v.prev2 !== "" ? Number(v.prev2) : null;
      var out = {
        now: Number.isFinite(now) ? round2(now) : null,
        prev: Number.isFinite(prev) ? round2(prev) : null,
        prev2: Number.isFinite(prev2) ? round2(prev2) : null
      };
      return out;
    }
    var n = Number(v);
    var fb = fallback && fallback[key] ? fallback[key] : {};
    return {
      now: Number.isFinite(n) ? round2(n) : fb.now != null ? fb.now : null,
      prev: Number.isFinite(fb.prev) ? fb.prev : Number.isFinite(n) ? round2(n) : null,
      prev2: Number.isFinite(fb.prev2) ? fb.prev2 : null
    };
  }

  /**
   * /data/panic.json 등 flat·nested 혼합을 panic 기반 모멘텀에 병합
   */
  function mergeMomentumPayload(raw, panicData, tickerData, overseasData) {
    var base =
      panicData && Array.isArray(panicData.items)
        ? buildMomentumInputFromPanic(panicData, tickerData, overseasData)
        : {
            vix: { now: null, prev: null, prev2: null },
            putCall: { now: null, prev: null, prev2: null },
            fearGreed: { now: null, prev: null, prev2: null },
            bofa: { now: null, prev: null },
            highYield: { now: null, prev: null },
            liquidity: { now: null, prev: null },
            rate: { now: null, prev: null },
            dollar: null,
            yieldCurve: null,
            updatedAt: null,
            _meta: { yieldMissing: true }
          };
    if (!raw || typeof raw !== "object") return base;

    base.vix = readPair("vix", raw, base);
    base.putCall = readPair("putCall", raw, base);
    base.fearGreed = readPair("fearGreed", raw, base);
    base.bofa = readPair("bofa", raw, base);
    base.highYield = readPair("highYield", raw, base);
    base.liquidity = readPair("liquidity", raw, base);
    base.rate = readPair("rate", raw, base);

    if (raw.dollar !== undefined && raw.dollar !== null && raw.dollar !== "") {
      var d = Number(raw.dollar);
      if (Number.isFinite(d)) base.dollar = round2(d);
    }
    if (raw.yieldCurve !== undefined && raw.yieldCurve !== null && raw.yieldCurve !== "") {
      var y = Number(raw.yieldCurve);
      if (Number.isFinite(y)) {
        base.yieldCurve = round2(y);
        base._meta = base._meta || {};
        base._meta.yieldMissing = false;
      }
    }
    if (raw.updatedAt != null) base.updatedAt = String(raw.updatedAt);
    if (Number.isFinite(Number(raw.vixPrev2))) {
      base.vix.prev2 = round2(Number(raw.vixPrev2));
    }
    return base;
  }

  /**
   * 단기: VIX 레벨·Δ, Put/Call Δ, F&G Δ + (옵션) VIX prev2 기반 강력 매수
   */
  function getShortSignal(data) {
    var vx = data.vix || {};
    var pc = data.putCall || {};
    var fg = data.fearGreed || {};
    var vNow = vx.now;
    var vPrev = vx.prev;
    var vPrev2 = vx.prev2;
    var dVix = computeDelta(vNow, vPrev);
    var dPc = computeDelta(pc.now, pc.prev);
    var dFg = computeDelta(fg.now, fg.prev);

    if (!Number.isFinite(vNow) || !Number.isFinite(vPrev)) {
      return {
        label: "🟡 중립",
        strength: "weak",
        reason: "VIX now/prev 데이터 부족으로 단기 판단 보류."
      };
    }

    if (
      Number.isFinite(vPrev2) &&
      vPrev2 >= 28 &&
      Number.isFinite(vNow) &&
      Number.isFinite(vPrev) &&
      vNow < vPrev &&
      vPrev < vPrev2
    ) {
      return {
        label: "💪 강력 매수 (VIX 급등 후 2일 연속 하락)",
        strength: "strong",
        reason:
          "VIX가 고레벨(" +
          vPrev2 +
          ")에서 이틀 연속 내려와 공포 에너지가 빠르게 소진되는 패턴. Put/Call Δ=" +
          (dPc != null ? dPc : "n/a") +
          ", F&G Δ=" +
          (dFg != null ? dFg : "n/a") +
          "."
      };
    }

    var label = "🟡 중립";
    var strRank = 1;
    var reason = "VIX=" + vNow + " (Δ=" + (dVix != null ? dVix : "n/a") + ") 구간에서 뚜렷한 극단 패턴 없음.";

    if (vNow > 30 && dVix !== null && dVix > 0) {
      label = "🚨 패닉 진행중 (관망)";
      strRank = 2;
      reason = "VIX>30 이고 전일 대비 상승(Δ=" + dVix + ") — 공포 확산 국면.";
    } else if (vNow > 25 && dVix !== null && dVix < 0) {
      label = "🔥 단기 매수 타이밍 (공포 꺾임)";
      strRank = 1;
      reason = "VIX>25 구간에서 하락 전환(Δ=" + dVix + ") — 단기 공포 완화 신호.";
    } else if (vNow < 20) {
      label = "⚠️ 과열 구간 (추격 금지)";
      strRank = 1;
      reason = "VIX<20 — 변동성 과소·탐욕 국면 가능, 추격매수 리스크.";
    }

    var pcFgBoost = dPc !== null && dPc > 0 && dFg !== null && dFg < -8;
    if (pcFgBoost) {
      reason += " Put/Call 상승 + F&G 급락으로 방어 심리 신뢰도 강화.";
      if (label.indexOf("패닉") !== -1) strRank = Math.min(2, strRank + 1);
    }

    var bearAlign =
      (dVix !== null && dVix > 0 ? 1 : 0) + (dPc !== null && dPc > 0 ? 1 : 0) + (dFg !== null && dFg < 0 ? 1 : 0);
    var bullAlign =
      (dVix !== null && dVix < 0 ? 1 : 0) + (dPc !== null && dPc < 0 ? 1 : 0) + (dFg !== null && dFg > 0 ? 1 : 0);
    if (label.indexOf("패닉") !== -1 && bearAlign >= 2) {
      strRank = Math.min(2, strRank + 1);
      reason += " 공포 방향 지표 " + bearAlign + "개 이상 동조 → 강도 상향.";
    }
    if (label.indexOf("매수") !== -1 && bullAlign >= 2) {
      strRank = Math.min(2, strRank + 1);
      reason += " 완화 방향 지표 " + bullAlign + "개 이상 동조 → 강도 상향.";
    }

    var strength = strRank >= 2 ? "strong" : strRank <= 0 ? "weak" : "normal";
    return { label: label, strength: strength, reason: reason };
  }

  /** 중기: BofA 레벨·모멘텀 + HY */
  function getMidSignal(data) {
    var b = data.bofa || {};
    var hy = data.highYield || {};
    var bNow = b.now;
    var bPrev = b.prev;
    var hNow = hy.now;
    var hPrev = hy.prev;
    var dB = computeDelta(bNow, bPrev);
    var dH = computeDelta(hNow, hPrev);

    if (!Number.isFinite(bNow) || !Number.isFinite(hNow)) {
      return { label: "🟢 정상", strength: "weak", reason: "BofA 또는 HY 데이터 부족." };
    }

    var bofaLow = bNow <= 4.2;
    var hyRise = dH !== null && dH > 0.03;
    var bofaBounce = dB !== null && dB > 0.05 && Number.isFinite(bPrev) && bPrev <= 4.0;

    if (bofaLow && hyRise) {
      return {
        label: "🟠 위험 증가",
        strength: "strong",
        reason: "BofA 약세(" + bNow + ") + HY 스프레드 상승(Δ=" + (dH != null ? dH : "n/a") + ") — 신용·심리 부담 확대."
      };
    }
    if (bofaBounce) {
      return {
        label: "🟡 회복 초기",
        strength: "normal",
        reason: "BofA 저점(" + bPrev + ") 이후 반등(Δ=" + (dB != null ? dB : "n/a") + ") — 심리 회복 초기 구간."
      };
    }
    var stable =
      (dB === null || Math.abs(dB) < 0.08) && (dH === null || Math.abs(dH) < 0.04);
    if (stable) {
      return {
        label: "🟢 정상",
        strength: "normal",
        reason: "BofA·HY 모멘텀이 완만(BofA Δ=" + (dB != null ? dB : "n/a") + ", HY Δ=" + (dH != null ? dH : "n/a") + ")."
      };
    }
    return {
      label: "🟡 중립",
      strength: "weak",
      reason: "혼재: BofA=" + bNow + ", HY=" + hNow + " (각 Δ=" + (dB != null ? dB : "n/a") + " / " + (dH != null ? dH : "n/a") + ")."
    };
  }

  /** 장기: 금리·유동성(모멘텀) + 레벨 보조 */
  function getLongSignal(data) {
    var r = data.rate || {};
    var l = data.liquidity || {};
    var dR = computeDelta(r.now, r.prev);
    var dL = computeDelta(l.now, l.prev);
    var yc = data.yieldCurve;
    var dxy = data.dollar;

    if (!Number.isFinite(r.now) || !Number.isFinite(l.now)) {
      return {
        label: "🟡 중립",
        strength: "weak",
        reason: "금리 또는 유동성 프록시 데이터 부족."
      };
    }

    var rateUp = dR !== null && dR > 0.01;
    var rateDown = dR !== null && dR < -0.01;
    var liqTighten = dL !== null && dL < 0;
    var liqEase = dL !== null && dL > 0;

    if (rateUp && liqTighten) {
      return {
        label: "🔴 긴축 (리스크)",
        strength: "strong",
        reason:
          "금리 상승(Δ=" +
          (dR != null ? dR : "n/a") +
          ") + 유동성 지표 악화(Δ=" +
          (dL != null ? dL : "n/a") +
          ", MOVE 프록시). DXY=" +
          (Number.isFinite(dxy) ? dxy : "n/a") +
          ", 10Y−2Y=" +
          (Number.isFinite(yc) ? yc : "n/a") +
          "."
      };
    }
    if (rateDown && liqEase) {
      return {
        label: "🟢 완화 (호재)",
        strength: "strong",
        reason:
          "금리 하락(Δ=" +
          (dR != null ? dR : "n/a") +
          ") + 유동성 지표 개선(Δ=" +
          (dL != null ? dL : "n/a") +
          "). DXY=" +
          (Number.isFinite(dxy) ? dxy : "n/a") +
          "."
      };
    }
    return {
      label: "🟡 중립",
      strength: "normal",
      reason:
        "금리·유동성 신호 혼재 (금리 Δ=" +
        (dR != null ? dR : "n/a") +
        ", 유동성 Δ=" +
        (dL != null ? dL : "n/a") +
        "). 곡선=" +
        (Number.isFinite(yc) ? yc : "n/a") +
        "."
    };
  }

  function getMomentumSignals(data) {
    return {
      short: getShortSignal(data),
      mid: getMidSignal(data),
      long: getLongSignal(data)
    };
  }

  /* --- 레거시 평균 점수(호환) --- */
  function scorePanic(value, thresholds) {
    if (!Number.isFinite(value)) return NaN;
    if (value >= thresholds.extreme) return 100;
    if (value >= thresholds.high) return 75;
    if (value >= thresholds.mid) return 50;
    if (value >= thresholds.low) return 25;
    return 0;
  }

  function getSignal(score) {
    if (!Number.isFinite(score)) {
      return { key: "na", label: "데이터 부족", color: "#8b93a7", avg: null };
    }
    if (score >= 80) return { key: "fire", label: "🔥 강력 매수", color: "#ff3b30", avg: score };
    if (score >= 60) return { key: "buy", label: "🟠 매수", color: "#ff9500", avg: score };
    if (score >= 40) return { key: "neutral", label: "🟡 중립", color: "#ffd60a", avg: score };
    if (score >= 20) return { key: "watch", label: "🔵 관망", color: "#0a84ff", avg: score };
    return { key: "sell", label: "🟢 과열 (매도)", color: "#34c759", avg: score };
  }

  var indicators = {
    vix: function (v) {
      return scorePanic(v, { low: 15, mid: 20, high: 30, extreme: 40 });
    },
    putCall: function (v) {
      return scorePanic(v, { low: 0.7, mid: 1.0, high: 1.2, extreme: 1.4 });
    },
    fearGreed: function (v) {
      if (!Number.isFinite(v)) return NaN;
      var x = 100 - v;
      return Math.max(0, Math.min(100, x));
    },
    bofa: function (v) {
      return scorePanic(10 - v, { low: 4, mid: 5, high: 6, extreme: 7 });
    },
    highYield: function (v) {
      return scorePanic(v, { low: 3, mid: 4, high: 5, extreme: 6 });
    },
    liquidity: function (v) {
      return scorePanic(-v, { low: 0, mid: 1, high: 2, extreme: 3 });
    },
    dollar: function (v) {
      return scorePanic(v, { low: 100, mid: 105, high: 110, extreme: 115 });
    },
    yieldCurve: function (v) {
      return scorePanic(-v, { low: 0, mid: 0.5, high: 1, extreme: 1.5 });
    },
    rate: function (v) {
      return scorePanic(v, { low: 2, mid: 3, high: 4, extreme: 5 });
    }
  };

  function calculateGroupSignal(data, keys) {
    var parts = [];
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var fn = indicators[key];
      if (!fn) continue;
      var v = data[key];
      if (!Number.isFinite(v)) continue;
      var s = fn(v);
      if (Number.isFinite(s)) parts.push(s);
    }
    if (!parts.length) {
      var emptySig = getSignal(NaN);
      emptySig.sample = 0;
      return emptySig;
    }
    var sum = 0;
    for (var p = 0; p < parts.length; p += 1) sum += parts[p];
    var avg = sum / parts.length;
    var sig = getSignal(avg);
    if (Number.isFinite(avg)) sig.avg = Math.round(avg * 10) / 10;
    sig.sample = parts.length;
    return sig;
  }

  function getAllSignals(data) {
    var longKeys = ["liquidity", "dollar"];
    if (Number.isFinite(data.yieldCurve)) longKeys.push("yieldCurve");
    longKeys.push("rate");
    return {
      short: calculateGroupSignal(data, ["vix", "putCall", "fearGreed"]),
      mid: calculateGroupSignal(data, ["bofa", "highYield"]),
      long: calculateGroupSignal(data, longKeys)
    };
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var CARD_COPY = {
    short: { title: "단기", sub: "VIX · Put/Call · CNN F&G (레벨+Δ)" },
    mid: { title: "중기", sub: "BofA B&B · HY (레벨+Δ)" },
    long: { title: "장기", sub: "금리 · 유동성(MOVE) · DXY · 곡선" }
  };

  function strengthToKey(st) {
    if (st === "strong") return "fire";
    if (st === "weak") return "watch";
    return "neutral";
  }

  function renderMomentumDashboard(rootEl, signals, data) {
    if (!rootEl) return;
    var types = ["short", "mid", "long"];
    for (var i = 0; i < types.length; i += 1) {
      var type = types[i];
      var el = rootEl.querySelector('[data-signal-card="' + type + '"]');
      if (!el) continue;
      var s = signals[type];
      var copy = CARD_COPY[type];
      var key = strengthToKey(s.strength);
      var foot = "";
      if (type === "long" && data && data._meta && data._meta.yieldMissing) {
        foot =
          '<p class="panic-signal-dashboard__foot">10Y−2Y는 <code>data/panic.json</code>의 <code>yieldCurve</code> 또는 <code>panic-data.json</code>의 <code>signalExtras.t10y2y</code>로 반영됩니다.</p>';
      }
      el.className = "panic-signal-dashboard__card panic-signal-dashboard__card--" + esc(key);
      el.innerHTML =
        '<p class="panic-signal-dashboard__eyebrow">' +
        esc(copy.title) +
        " SIGNAL</p>" +
        '<p class="panic-signal-dashboard__sub">' +
        esc(copy.sub) +
        "</p>" +
        '<p class="panic-signal-dashboard__badge">강도 · <strong>' +
        esc(s.strength || "normal") +
        "</strong></p>" +
        '<p class="panic-signal-dashboard__value">' +
        esc(s.label || "") +
        "</p>" +
        '<p class="panic-signal-dashboard__reason">' +
        esc(s.reason || "") +
        "</p>" +
        foot;
    }
  }

  function renderLoading(rootEl) {
    if (!rootEl) return;
    var types = ["short", "mid", "long"];
    for (var i = 0; i < types.length; i += 1) {
      var el = rootEl.querySelector('[data-signal-card="' + types[i] + '"]');
      if (!el) continue;
      el.className = "panic-signal-dashboard__card panic-signal-dashboard__card--na";
      el.innerHTML =
        '<p class="panic-signal-dashboard__eyebrow">' +
        esc(CARD_COPY[types[i]].title) +
        '</p><p class="panic-signal-dashboard__value" style="color:#8b93a7">계산 중…</p>';
    }
  }

  /** 레거시 카드 렌더(평균 점수형) */
  function renderPanicSignalDashboard(rootEl, signals, data) {
    if (!rootEl) return;
    var types = ["short", "mid", "long"];
    for (var i = 0; i < types.length; i += 1) {
      var type = types[i];
      var el = rootEl.querySelector('[data-signal-card="' + type + '"]');
      if (!el) continue;
      var s = signals[type];
      var copy = CARD_COPY[type];
      var avgText = Number.isFinite(s.avg) ? "평균 점수 " + s.avg + "/100" : "지표 일부 누락 · 평균 산출 제한";
      var foot = "";
      if (type === "long" && data && data._meta && data._meta.yieldMissing) {
        foot =
          '<p class="panic-signal-dashboard__foot">10Y−2Y는 <code>data/panic.json</code>의 <code>yieldCurve</code> 또는 <code>panic-data.json</code>의 <code>signalExtras.t10y2y</code>로 반영됩니다.</p>';
      }
      el.className = "panic-signal-dashboard__card panic-signal-dashboard__card--" + esc(s.key || "na");
      el.innerHTML =
        '<p class="panic-signal-dashboard__eyebrow">' +
        esc(copy.title) +
        " SIGNAL</p>" +
        '<p class="panic-signal-dashboard__sub">' +
        esc(copy.sub) +
        "</p>" +
        '<p class="panic-signal-dashboard__value" style="color:' +
        esc(s.color) +
        '">' +
        esc(s.label) +
        "</p>" +
        '<p class="panic-signal-dashboard__avg">' +
        esc(avgText) +
        "</p>" +
        foot;
    }
  }

  function renderSignals(rootEl, signals, data) {
    renderMomentumDashboard(rootEl, signals, data);
  }

  global.PanicSignalEngine = {
    computeDelta: computeDelta,
    computeDeltaPct: computeDeltaPct,
    buildMomentumInputFromPanic: buildMomentumInputFromPanic,
    mergeMomentumPayload: mergeMomentumPayload,
    getShortSignal: getShortSignal,
    getMidSignal: getMidSignal,
    getLongSignal: getLongSignal,
    getMomentumSignals: getMomentumSignals,
    renderMomentumDashboard: renderMomentumDashboard,
    rowFromFlatJson: rowFromFlatJson,
    buildMacroRow: buildMacroRow,
    scorePanic: scorePanic,
    getSignal: getSignal,
    indicators: indicators,
    calculateGroupSignal: calculateGroupSignal,
    getAllSignals: getAllSignals,
    renderPanicSignalDashboard: renderPanicSignalDashboard,
    renderSignals: renderSignals,
    renderLoading: renderLoading
  };
})(typeof window !== "undefined" ? window : this);
