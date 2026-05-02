/**
 * Signal Desk page (signal-room.html): panic feed, score engine, trading strip,
 * ticker, US linkage line, signal history, and legacy summary cards.
 */
(function () {
  function appendFetchCacheBust(url) {
    var u = String(url || "");
    if (!u) return u;
    var sep = u.indexOf("?") >= 0 ? "&" : "?";
    return u + sep + "_ts=" + Date.now();
  }

  /** 로컬 서버(npm start 등)에서는 실시간 /api/ticker를 정적 data/ticker.json보다 우선 */
  function preferLiveTickerApi() {
    var h = String(window.location.hostname || "").toLowerCase();
    var p = String(window.location.protocol || "").toLowerCase();
    return (p === "http:" || p === "https:") && (h === "localhost" || h === "127.0.0.1" || h === "[::1]");
  }

  function fetchJsonNoStore(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function siteDataFileUrl(filename) {
    var f = String(filename || "").replace(/^\//, "");
    if (!f) return "";
    var protocol = String(window.location.protocol || "").toLowerCase();
    var origin = window.location.origin;
    if (origin === "null" || (protocol !== "http:" && protocol !== "https:")) {
      try {
        return new URL(f, document.baseURI).href;
      } catch (e) {
        return f;
      }
    }
    var pathname = window.location.pathname || "/";
    var dir;
    if (pathname.endsWith("/")) {
      dir = pathname;
    } else {
      var last = pathname.split("/").pop() || "";
      if (/\.html?$/i.test(last)) {
        dir = pathname.replace(/\/[^/]+$/, "/");
      } else {
        dir = pathname + "/";
      }
    }
    return origin + dir + f;
  }

  function fetchJsonWithXhrFallback(url) {
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .catch(function (fetchErr) {
        return new Promise(function (resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.timeout = 30000;
          xhr.responseType = "text";
          xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                reject(fetchErr);
              }
            } else {
              reject(fetchErr || new Error("HTTP " + xhr.status));
            }
          };
          xhr.onerror = function () {
            reject(fetchErr);
          };
          xhr.ontimeout = function () {
            reject(fetchErr);
          };
          xhr.send();
        });
      });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function tickerDeltaClass(direction) {
    if (direction === "up") return "up";
    if (direction === "down") return "down";
    return "";
  }

  function parseTickerNumber(text) {
    var cleaned = String(text || "").replace(/[^0-9.\-]/g, "");
    var num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  var latestTickerData = null;
  var latestPanicData = null;
  var latestOverseasData = null;
  var latestPortalBriefData =
    window.PORTAL_BRIEF_DATA && typeof window.PORTAL_BRIEF_DATA === "object" ? window.PORTAL_BRIEF_DATA : null;
  var latestTradingShortSignal = null;

  var tickerTrackEl = document.getElementById("market-ticker-track");
  var panicUpdatedAtEl = document.getElementById("panic-updated-at");
  var panicUsLinkEl = document.getElementById("panic-us-link");
  var panicSignalDashboardEl = document.getElementById("panic-signal-dashboard");
  var panicSignalUpdatedAtEl = document.getElementById("panic-signal-data-updated-at");
  var panicTradingDashboardEl = document.getElementById("panic-trading-dashboard");
  var marketTickerSignalLineEl = document.getElementById("market-ticker-signal-line");
  var terminalDashboardEl = document.getElementById("terminal-dashboard");

  function getTickerByLabel(label) {
    var items = (latestTickerData && latestTickerData.items) || [];
    for (var i = 0; i < items.length; i += 1) {
      if (items[i] && items[i].label === label) return items[i];
    }
    return null;
  }

  function getPanicById(id) {
    var items = (latestPanicData && latestPanicData.items) || [];
    for (var i = 0; i < items.length; i += 1) {
      if (items[i] && items[i].id === id) return items[i];
    }
    return null;
  }

  var TS = {
    wVix: 0.35,
    wFng: 0.35,
    wPc: 0.3,
    vixLow: 10,
    vixSpan: 25,
    pcLow: 0.38,
    pcSpan: 0.67,
    fearFrom: 58,
    greedTo: 42
  };

  function todayParseNum(it) {
    if (!it || it.value == null) return null;
    var n = parseFloat(String(it.value).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function todayMetrics(data) {
    var by = {};
    var rows = (data && data.items) || [];
    for (var i = 0; i < rows.length; i++) {
      var id = rows[i] && rows[i].id;
      if (id) by[id] = rows[i];
    }
    var c = function (x, a, b) {
      return Math.min(b, Math.max(a, x));
    };
    var vix = todayParseNum(by.vix);
    var fng = todayParseNum(by.fng);
    var pc = todayParseNum(by.putcall);
    var parts = [];
    if (Number.isFinite(vix))
      parts.push({ w: TS.wVix, v: c((vix - TS.vixLow) / TS.vixSpan, 0, 1) * 100 });
    if (Number.isFinite(fng)) parts.push({ w: TS.wFng, v: 100 - fng });
    if (Number.isFinite(pc))
      parts.push({ w: TS.wPc, v: c((pc - TS.pcLow) / TS.pcSpan, 0, 1) * 100 });
    if (!parts.length) return { ok: false };
    var tw = 0,
      acc = 0;
    for (var j = 0; j < parts.length; j++) {
      tw += parts[j].w;
      acc += parts[j].w * parts[j].v;
    }
    var score = c(Math.round(acc / tw), 0, 100);
    var regime = score >= TS.fearFrom ? "fear" : score <= TS.greedTo ? "greed" : "neutral";
    var act = regime === "fear" ? "buy" : regime === "greed" ? "takeProfit" : "wait";
    return {
      ok: true,
      score: score,
      regime: regime,
      action: act,
      detail:
        "VIX " +
        (Number.isFinite(vix) ? vix.toFixed(2) : "—") +
        " · F&G " +
        (Number.isFinite(fng) ? String(Math.round(fng)) : "—") +
        " · P/C " +
        (Number.isFinite(pc) ? pc.toFixed(2) : "—")
    };
  }

  function renderTodayStrategyBox() {
    var card = document.getElementById("today-strategy-card");
    var marketEl = document.getElementById("today-strategy-market");
    var scoreEl = document.getElementById("today-strategy-score");
    var actionEl = document.getElementById("today-strategy-action");
    var hintEl = document.getElementById("today-strategy-hint");
    if (!card || !marketEl || !scoreEl || !actionEl) return;
    var m = todayMetrics(latestPanicData);
    card.classList.remove(
      "today-strategy-card--loading",
      "today-strategy-card--fear",
      "today-strategy-card--neutral",
      "today-strategy-card--greed",
      "today-strategy-card--error"
    );
    if (!m.ok) {
      card.classList.add("today-strategy-card--error");
      marketEl.textContent = "—";
      scoreEl.textContent = "—";
      actionEl.textContent = "—";
      if (hintEl) hintEl.textContent = "패닉 입력이 부족해 전략 요약을 계산하지 못했습니다.";
      return;
    }
    card.classList.add("today-strategy-card--" + m.regime);
    marketEl.textContent = { fear: "공포", neutral: "중립", greed: "탐욕" }[m.regime];
    scoreEl.textContent = String(m.score);
    actionEl.textContent = { buy: "매수", wait: "관망", takeProfit: "익절" }[m.action];
    if (hintEl)
      hintEl.textContent =
        "VIX · CNN Fear and Greed · 풋/콜 기반 자동 요약 · " + m.detail + " (참고용, 투자 권유 아님)";
  }

  var SIGNAL_HISTORY_KEY = "signalHistory";
  var SIGNAL_HISTORY_MAX = 30;
  var SIGNAL_HISTORY_DISPLAY = 7;

  function signalHistoryTodayYmd() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function signalStorageAvailable() {
    try {
      var k = "__signal_hist_probe__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadSignalHistory() {
    if (!signalStorageAvailable()) return [];
    try {
      var raw = localStorage.getItem(SIGNAL_HISTORY_KEY);
      if (!raw || typeof raw !== "string") return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (x) {
        return x && typeof x.date === "string" && x.short && x.mid && x.long;
      });
    } catch (e) {
      return [];
    }
  }

  function normalizeHorizonForHistory(sig) {
    var s = sig && typeof sig === "object" ? sig : {};
    var out = {
      label: s.label != null ? String(s.label) : "—",
      strength: s.strength != null ? String(s.strength) : ""
    };
    if (s.reason != null && String(s.reason)) {
      out.reason = String(s.reason).slice(0, 400);
    }
    return out;
  }

  function saveSignalHistory(signals) {
    if (!signals || typeof signals !== "object") return;
    if (!signalStorageAvailable()) return;
    var today = signalHistoryTodayYmd();
    var row = {
      date: today,
      short: normalizeHorizonForHistory(signals.short),
      mid: normalizeHorizonForHistory(signals.mid),
      long: normalizeHorizonForHistory(signals.long)
    };
    try {
      var history = loadSignalHistory();
      history = history.filter(function (item) {
        return item && item.date !== today;
      });
      history.unshift(row);
      if (history.length > SIGNAL_HISTORY_MAX) {
        history = history.slice(0, SIGNAL_HISTORY_MAX);
      }
      localStorage.setItem(SIGNAL_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn("[signalHistory] save failed", e);
    }
  }

  function signalHistoryFingerprint(entry) {
    if (!entry || !entry.date) return "";
    return (
      entry.date +
      "|" +
      (entry.short && entry.short.label) +
      "|" +
      (entry.mid && entry.mid.label) +
      "|" +
      (entry.long && entry.long.label)
    );
  }

  function signalHistoryDeltaSummary(prev, cur) {
    if (!prev || !cur) return "—";
    var parts = [];
    if (prev.short && cur.short && prev.short.label !== cur.short.label) {
      parts.push("단기 " + prev.short.label + " → " + cur.short.label);
    }
    if (prev.mid && cur.mid && prev.mid.label !== cur.mid.label) {
      parts.push("중기 " + prev.mid.label + " → " + cur.mid.label);
    }
    if (prev.long && cur.long && prev.long.label !== cur.long.label) {
      parts.push("장기 " + prev.long.label + " → " + cur.long.label);
    }
    return parts.length ? parts.join(" · ") : "—";
  }

  function renderSignalHistory() {
    var el = document.getElementById("historyList");
    if (!el) return;
    var history = loadSignalHistory();
    var slice = history.slice(0, SIGNAL_HISTORY_DISPLAY);
    if (!slice.length) {
      el.innerHTML =
        '<p class="history-empty">저장된 히스토리가 없습니다. 시그널이 계산되면 오늘 날짜부터 쌓입니다.</p>';
      return;
    }
    var prevFp = window.__signalHistoryTopFp || "";
    var html = "";
    for (var i = 0; i < slice.length; i += 1) {
      var item = slice[i];
      var prev = slice[i + 1] || null;
      var delta = signalHistoryDeltaSummary(prev, item);
      html +=
        '<div class="history-row-wrap" data-date="' +
        escapeHtml(item.date) +
        '" role="button" tabindex="0">' +
        '<div class="history-row">' +
        '<span class="history-date">' +
        escapeHtml(item.date || "") +
        "</span>" +
        '<span class="history-cell">' +
        escapeHtml((item.short && item.short.label) || "—") +
        "</span>" +
        '<span class="history-cell">' +
        escapeHtml((item.mid && item.mid.label) || "—") +
        "</span>" +
        '<span class="history-cell">' +
        escapeHtml((item.long && item.long.label) || "—") +
        "</span>" +
        '<span class="history-delta">' +
        escapeHtml(delta) +
        "</span>" +
        "</div>" +
        "</div>";
    }
    el.innerHTML = html;
    var topFp = signalHistoryFingerprint(slice[0]);
    if (prevFp && topFp && prevFp !== topFp) {
      var firstWrap = el.querySelector(".history-row-wrap");
      if (firstWrap) {
        firstWrap.classList.add("is-flash");
        window.setTimeout(function () {
          firstWrap.classList.remove("is-flash");
        }, 900);
      }
    }
    window.__signalHistoryTopFp = topFp;
  }

  function findSignalHistoryByDate(dateStr) {
    var h = loadSignalHistory();
    for (var i = 0; i < h.length; i += 1) {
      if (h[i] && h[i].date === dateStr) return h[i];
    }
    return null;
  }

  function openSignalHistoryDetail(dateStr) {
    var modal = document.getElementById("signalHistoryDetail");
    var body = document.getElementById("signalHistoryDetailBody");
    var title = document.getElementById("signalHistoryDetailTitle");
    if (!modal || !body) return;
    var row = findSignalHistoryByDate(dateStr);
    if (!row) return;
    if (title) {
      title.textContent = "시그널 상세 · " + row.date;
    }
    function block(horizon, label) {
      var h = row[horizon] || {};
      var r = h.reason ? '<p class="signal-history-detail__reason">' + escapeHtml(h.reason) + "</p>" : "";
      return (
        '<section class="signal-history-detail__block">' +
        "<h4>" +
        escapeHtml(label) +
        "</h4>" +
        '<p class="signal-history-detail__label">' +
        escapeHtml(h.label || "—") +
        "</p>" +
        '<p class="signal-history-detail__meta">강도 · ' +
        escapeHtml(h.strength || "—") +
        "</p>" +
        r +
        "</section>"
      );
    }
    body.innerHTML = block("short", "단기") + block("mid", "중기") + block("long", "장기");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var closeBtn = document.getElementById("signalHistoryDetailClose");
    if (closeBtn) closeBtn.focus();
  }

  function closeSignalHistoryDetail() {
    var modal = document.getElementById("signalHistoryDetail");
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  (function initSignalHistoryUi() {
    var card = document.getElementById("signal-history-card");
    var modal = document.getElementById("signalHistoryDetail");
    var backdrop = document.getElementById("signalHistoryDetailBackdrop");
    var closeBtn = document.getElementById("signalHistoryDetailClose");
    if (!modal) return;
    if (card && !card.dataset.signalHistUi) {
      card.dataset.signalHistUi = "1";
      card.addEventListener("click", function (ev) {
        var wrap = ev.target.closest(".history-row-wrap");
        if (!wrap) return;
        var d = wrap.getAttribute("data-date");
        if (d) openSignalHistoryDetail(d);
      });
      card.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        var wrap = ev.target.closest(".history-row-wrap");
        if (!wrap) return;
        ev.preventDefault();
        var d = wrap.getAttribute("data-date");
        if (d) openSignalHistoryDetail(d);
      });
    }
    if (backdrop && !backdrop.dataset.signalHistUi) {
      backdrop.dataset.signalHistUi = "1";
      backdrop.addEventListener("click", closeSignalHistoryDetail);
    }
    if (closeBtn && !closeBtn.dataset.signalHistUi) {
      closeBtn.dataset.signalHistUi = "1";
      closeBtn.addEventListener("click", closeSignalHistoryDetail);
    }
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && modal && !modal.hidden) {
        closeSignalHistoryDetail();
      }
    });
  })();

  renderSignalHistory();

  function updateMarketTickerTradingPulse(shortSig) {
    if (!marketTickerSignalLineEl) return;
    var lab = shortSig && shortSig.label ? String(shortSig.label) : "—";
    marketTickerSignalLineEl.textContent = "현재 시장 상태: " + lab;
  }

  function applyPanicSignals(rawPayload, sourceTag) {
    if (!window.PanicSignalEngine) return;
    var merged = window.PanicSignalEngine.mergeMomentumPayload(
      rawPayload && typeof rawPayload === "object" ? rawPayload : null,
      latestPanicData,
      latestTickerData,
      latestOverseasData
    );
    var signals = window.PanicSignalEngine.getMomentumSignals(merged);
    if (panicSignalDashboardEl) {
      window.PanicSignalEngine.renderMomentumDashboard(panicSignalDashboardEl, signals, merged);
    }
    if (panicSignalUpdatedAtEl) {
      panicSignalUpdatedAtEl.textContent = merged.updatedAt
        ? "마지막 업데이트(시그널): " + merged.updatedAt
        : "마지막 업데이트(시그널): —";
    }

    var tSignals = null;
    if (window.PanicSignalEngine.getTradingSignals && window.PanicSignalEngine.renderTradingSignals) {
      tSignals = window.PanicSignalEngine.getTradingSignals(merged);
      latestTradingShortSignal = tSignals.short || null;
      if (panicTradingDashboardEl) {
        window.PanicSignalEngine.renderTradingSignals(panicTradingDashboardEl, tSignals, merged);
      }
      updateMarketTickerTradingPulse(latestTradingShortSignal);
    }

    if (terminalDashboardEl) {
      var shortBuy =
        tSignals &&
        tSignals.short &&
        tSignals.short.label &&
        /매수/.test(String(tSignals.short.label));
      terminalDashboardEl.classList.toggle("terminal-dashboard--short-buy", !!shortBuy);
    }

    try {
      saveSignalHistory(signals);
      renderSignalHistory();
    } catch (e) {
      console.warn("[signalHistory] persist/render", e);
    }
    renderLegacySummary();
  }

  function refreshPanicSignalDashboard() {
    if (!window.PanicSignalEngine) return;
    var url = appendFetchCacheBust(
      window.withSiteVersion ? window.withSiteVersion(siteDataFileUrl("data/panic.json")) : siteDataFileUrl("data/panic.json")
    );
    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("panic.json HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        applyPanicSignals(json, "fetch:data/panic.json");
      })
      .catch(function (err) {
        console.warn("[panic-signal] fetch failed", err && err.message ? err.message : err);
        if (latestPanicData && Array.isArray(latestPanicData.items)) {
          var row = window.PanicSignalEngine.buildMacroRow(
            latestPanicData,
            latestTickerData,
            latestOverseasData
          );
          row.updatedAt = (latestPanicData.updatedAt || "") + " · fallback";
          applyPanicSignals(row, "fallback:buildMacroRow");
        } else {
          if (panicSignalDashboardEl) {
            window.PanicSignalEngine.renderLoading(panicSignalDashboardEl);
          }
          if (window.PanicSignalEngine.renderTradingLoading && panicTradingDashboardEl) {
            window.PanicSignalEngine.renderTradingLoading(panicTradingDashboardEl);
          }
          if (panicSignalUpdatedAtEl) {
            panicSignalUpdatedAtEl.textContent = "마지막 업데이트(시그널): 로드 실패";
          }
          updateMarketTickerTradingPulse({ label: "데이터 로드 실패" });
          if (terminalDashboardEl) {
            terminalDashboardEl.classList.remove("terminal-dashboard--short-buy");
          }
        }
      });
  }

  function updateUsLinkageComment() {
    if (!panicUsLinkEl) return;
    if (!latestTickerData || !latestPanicData) {
      panicUsLinkEl.textContent = "미국장 연동 코멘트 계산 중...";
      return;
    }

    var tickerByLabel = {};
    (latestTickerData.items || []).forEach(function (it) {
      tickerByLabel[it.label] = it;
    });
    var panicById = {};
    (latestPanicData.items || []).forEach(function (it) {
      panicById[it.id] = it;
    });

    var dow = tickerByLabel.DOW || null;
    var sp = tickerByLabel["S&P 500"] || null;
    var ndx = tickerByLabel["NASDAQ 100"] || null;
    var dxyTicker =
      tickerByLabel["Dollar Index"] || tickerByLabel["달러인덱스"] || tickerByLabel["DXY"] || null;
    var us10y = tickerByLabel["US 10Y"] || null;
    var vix = panicById.vix || null;

    var riskOnVotes = 0;
    var riskOffVotes = 0;
    if (dow && dow.direction === "up") riskOnVotes += 1;
    if (dow && dow.direction === "down") riskOffVotes += 1;
    if (sp && sp.direction === "up") riskOnVotes += 1;
    if (sp && sp.direction === "down") riskOffVotes += 1;
    if (ndx && ndx.direction === "up") riskOnVotes += 1;
    if (ndx && ndx.direction === "down") riskOffVotes += 1;

    var us10yDelta = parseTickerNumber(us10y && us10y.delta);
    if (us10yDelta !== null) {
      if (us10yDelta < 0) riskOnVotes += 1;
      if (us10yDelta > 0) riskOffVotes += 1;
    }

    var vixValue = parseTickerNumber(vix && vix.value);
    if (vixValue !== null) {
      if (vixValue < 20) riskOnVotes += 1;
      if (vixValue >= 25) riskOffVotes += 1;
    }

    var tone =
      riskOnVotes >= riskOffVotes + 2
        ? "리스크온 우위"
        : riskOffVotes >= riskOnVotes + 2
          ? "리스크오프 우위"
          : "혼조 구간";
    var action =
      tone === "리스크온 우위"
        ? "추격매수보다 눌림 분할 접근이 유리"
        : tone === "리스크오프 우위"
          ? "현금·헤지 비중 점검 우선"
          : "비중 중립 유지하며 종목별 대응";

    panicUsLinkEl.textContent =
      "미국장 연동 코멘트 · " +
      tone +
      " · DOW " +
      (dow ? dow.delta : "-") +
      " · S&P " +
      (sp ? sp.delta : "-") +
      " · NDX " +
      (ndx ? ndx.delta : "-") +
      " · 달러 " +
      (dxyTicker ? dxyTicker.delta : "-") +
      " / VIX " +
      (vix ? vix.value : "-") +
      " / US10Y " +
      (us10y ? us10y.delta : "-") +
      " · " +
      action;
  }

  function renderTicker(data) {
    var items = (data && data.items) || [];
    latestTickerData = data || { items: [] };
    if (!tickerTrackEl) {
      updateUsLinkageComment();
      refreshPanicSignalDashboard();
      updateMarketTickerTradingPulse(latestTradingShortSignal || { label: "계산 중…" });
      return;
    }
    if (!items.length) {
      tickerTrackEl.innerHTML =
        '<div class="market-ticker__group"><span class="market-ticker__item">데이터 준비 중...</span></div>';
      updateUsLinkageComment();
      refreshPanicSignalDashboard();
      updateMarketTickerTradingPulse(latestTradingShortSignal || { label: "계산 중…" });
      return;
    }

    var itemHtml = items
      .map(function (item) {
        var label = escapeHtml(item.label || "-");
        var value = escapeHtml(item.value || "-");
        var delta = escapeHtml(item.delta || "-");
        var cls = tickerDeltaClass(item.direction);
        return (
          '<span class="market-ticker__item"><strong>' +
          label +
          "</strong> " +
          value +
          ' <em class="' +
          cls +
          '">' +
          delta +
          "</em></span>"
        );
      })
      .join("");

    tickerTrackEl.innerHTML =
      '<div class="market-ticker__group">' +
      itemHtml +
      "</div>" +
      '<div class="market-ticker__group" aria-hidden="true">' +
      itemHtml +
      "</div>";
    updateUsLinkageComment();
    refreshPanicSignalDashboard();
    updateMarketTickerTradingPulse(latestTradingShortSignal || { label: "계산 중…" });
  }

  function normalizeDataTickerJson(raw) {
    if (!raw) return null;
    if (raw && Array.isArray(raw.items) && raw.items[0] && raw.items[0].label) {
      return raw;
    }
    var rows = Array.isArray(raw) ? raw : raw && Array.isArray(raw.items) ? raw.items : [];
    if (!rows.length || !rows[0] || !rows[0].symbol) {
      return null;
    }
    var SYM_TO_LABEL = {
      DOW: "DOW",
      SP500: "S&P 500",
      NASDAQ: "NASDAQ 100",
      NASDAQ100: "NASDAQ 100",
      US10Y: "US 10Y",
      VIX: "VIX"
    };
    function fmtDelta(changeNum, isUs10y) {
      if (!Number.isFinite(changeNum)) return "-";
      var abs = Math.abs(changeNum).toFixed(2);
      var suffix = isUs10y ? "%p" : "%";
      if (changeNum > 0) return "+" + abs + suffix;
      if (changeNum < 0) return "-" + abs + suffix;
      return "0.00" + suffix;
    }
    var mappedItems = rows.map(function (r) {
      var label = SYM_TO_LABEL[r.symbol] || String(r.symbol);
      var changeNum = Number(r.change);
      var direction = !Number.isFinite(changeNum) ? "flat" : changeNum > 0 ? "up" : changeNum < 0 ? "down" : "flat";
      var deltaStr = fmtDelta(changeNum, r.symbol === "US10Y");
      var priceNum = typeof r.price === "number" ? r.price : parseFloat(String(r.price).replace(/[^0-9.\-]/g, ""));
      var valueStr;
      if (r.symbol === "US10Y" && Number.isFinite(priceNum)) {
        valueStr = priceNum.toFixed(2) + "%";
      } else if (Number.isFinite(priceNum)) {
        valueStr = priceNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        valueStr = String(r.price ?? "-");
      }
      return { label: label, value: valueStr, delta: deltaStr, direction: direction };
    });
    return { items: mappedItems };
  }

  function loadTickerTrackFromJson() {
    var dataTickerUrl = appendFetchCacheBust(
      window.withSiteVersion ? window.withSiteVersion(siteDataFileUrl("data/ticker.json")) : siteDataFileUrl("data/ticker.json")
    );
    var tickerApiUrl = appendFetchCacheBust("/api/ticker");

    function fromDataTickerJson() {
      return fetchJsonNoStore(dataTickerUrl).then(function (raw) {
        var mapped = normalizeDataTickerJson(raw);
        if (mapped && mapped.items && mapped.items.length) {
          renderTicker(mapped);
          return;
        }
        throw new Error("data/ticker.json invalid");
      });
    }

    function fromApiTicker() {
      return fetchJsonNoStore(tickerApiUrl).then(function (data) {
        if (data && Array.isArray(data.items) && data.items.length) {
          renderTicker(data);
          return;
        }
        throw new Error("api ticker invalid");
      });
    }

    function fromEmbeddedTicker() {
      if (window.TICKER_DATA && Array.isArray(window.TICKER_DATA.items)) {
        renderTicker(window.TICKER_DATA);
        return Promise.resolve();
      }
      var tickerJsonUrl = appendFetchCacheBust(window.withSiteVersion("ticker-data.json"));
      return fetchJsonNoStore(tickerJsonUrl).then(renderTicker).catch(function () {
        renderTicker({ items: [] });
      });
    }

    var chain = preferLiveTickerApi()
      ? fromApiTicker().catch(function () {
          return fromDataTickerJson().catch(function () {
            return fromEmbeddedTicker();
          });
        })
      : fromDataTickerJson().catch(function () {
          return fromApiTicker().catch(function () {
            return fromEmbeddedTicker();
          });
        });

    chain.catch(function () {
      renderTicker({ items: [] });
    });
  }

  function renderPanicTable(data) {
    latestPanicData = data || { items: [] };
    if (panicUpdatedAtEl) {
      panicUpdatedAtEl.textContent = "업데이트 기준: " + (data.updatedAt || "—");
    }
    updateUsLinkageComment();
    refreshPanicSignalDashboard();
    renderTodayStrategyBox();
  }

  function loadPanicTableFromJson() {
    var panicDataUrl = appendFetchCacheBust(window.withSiteVersion("panic-data.json"));
    fetch(panicDataUrl, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("panic-data fetch failed");
        return res.json();
      })
      .then(function (d) {
        if (d && Array.isArray(d.items)) {
          renderPanicTable(d);
        } else {
          throw new Error("panic-data invalid shape");
        }
      })
      .catch(function () {
        if (window.PANIC_DATA && Array.isArray(window.PANIC_DATA.items)) {
          renderPanicTable(window.PANIC_DATA);
        } else {
          if (panicUpdatedAtEl) panicUpdatedAtEl.textContent = "업데이트 기준: 데이터 로딩 실패";
          latestPanicData = null;
          renderTodayStrategyBox();
        }
      });
  }

  function itemById(items, id) {
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].id === id) return items[i];
    }
    return null;
  }

  function parseNum(it) {
    if (!it || it.value == null) return null;
    var n = parseFloat(String(it.value).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function vixDirection(it) {
    if (!it) return 0;
    if (typeof it.change === "number") {
      if (it.change > 0.01) return 1;
      if (it.change < -0.01) return -1;
      return 0;
    }
    var d = String(it.delta || "");
    if (d.indexOf("📈") !== -1) return 1;
    if (d.indexOf("📉") !== -1) return -1;
    return 0;
  }

  var CFG = {
    wVix: 0.35,
    wFng: 0.35,
    wPc: 0.3,
    vixLow: 10,
    vixSpan: 25,
    pcLow: 0.38,
    pcSpan: 0.67,
    fearFrom: 58,
    greedTo: 42
  };

  function panicScore(items) {
    var by = {};
    for (var i = 0; i < items.length; i++) {
      var id = items[i] && items[i].id;
      if (id) by[id] = items[i];
    }
    var c = function (x, a, b) {
      return Math.min(b, Math.max(a, x));
    };
    var vix = parseNum(by.vix);
    var fng = parseNum(by.fng);
    var pc = parseNum(by.putcall);
    var parts = [];
    if (Number.isFinite(vix))
      parts.push({ w: CFG.wVix, v: c((vix - CFG.vixLow) / CFG.vixSpan, 0, 1) * 100 });
    if (Number.isFinite(fng)) parts.push({ w: CFG.wFng, v: 100 - fng });
    if (Number.isFinite(pc))
      parts.push({ w: CFG.wPc, v: c((pc - CFG.pcLow) / CFG.pcSpan, 0, 1) * 100 });
    if (!parts.length) return null;
    var tw = 0,
      acc = 0;
    for (var j = 0; j < parts.length; j++) {
      tw += parts[j].w;
      acc += parts[j].w * parts[j].v;
    }
    return c(Math.round(acc / tw), 0, 100);
  }

  function signalGrade(score, vixDir) {
    if (score == null) return { code: "", label: "—", note: "" };
    if (score >= 62 && vixDir === 1)
      return {
        code: "STRONG_BUY",
        label: "STRONG BUY",
        note: "공포 점수가 높고 VIX가 오르는 국면 → 역발상·분할 매수 관점에 가깝게 분류했습니다."
      };
    if (score >= 52)
      return {
        code: "BUY",
        label: "BUY",
        note: "공포 점수가 어느 정도 높아 매수 후보 구간으로 분류했습니다."
      };
    if (score <= 36)
      return {
        code: "SELL",
        label: "SELL",
        note: "탐욕·안도 쪽 점수가 낮아 익절·비중 축소 관점에 가깝게 분류했습니다."
      };
    if (score <= 44 && vixDir <= 0)
      return {
        code: "SELL",
        label: "SELL",
        note: "낮은 공포 점수에 VIX 하락(안도)이 겹쳐 과열·정리 쪽으로 분류했습니다."
      };
    return {
      code: "HOLD",
      label: "HOLD",
      note: "지표가 중간대에 있어 추세보다 선별·관망에 가깝게 분류했습니다."
    };
  }

  function actionGuide(score) {
    if (score == null) return "—";
    if (score >= CFG.fearFrom) return "매수";
    if (score <= CFG.greedTo) return "익절";
    return "관망";
  }

  function marketState(score, vix, vixDir, fng) {
    var f = Number.isFinite(fng) ? fng : 50;
    var vx = Number.isFinite(vix) ? vix : 18;
    if (vx >= 26 || (score != null && score >= 64))
      return {
        label: "위험",
        text:
          "VIX·공포 점수가 높아 급변·갭 리스크가 커질 수 있습니다. 레버리지·풀비중은 특히 주의가 필요합니다."
      };
    if (score != null && score >= 55)
      return {
        label: "하락",
        text: "공포·방어 심리가 우세한 국면으로, 지수·섹터 하방 압력을 염두에 둡니다."
      };
    if (score != null && score >= 44 && vixDir < 0)
      return {
        label: "반등",
        text: "불안은 남았으나 VIX 하락으로 숨 고르기·기술적 반등을 노리는 구간으로 해석할 수 있습니다."
      };
    if (score != null && score < 48 && f >= 58)
      return {
        label: "상승",
        text: "CNN 탐욕 쪽과 낮은 공포 점수가 맞물린 상승·리스크온 국면 신호입니다."
      };
    if (score != null && score < 45)
      return {
        label: "상승",
        text: "공포 점수가 낮아 안도·추세 상승에 유리한 쪽으로 분류됩니다."
      };
    return {
      label: "반등",
      text: "지표가 혼조라 박스권·종목별 차별 대응에 가깝습니다."
    };
  }

  function positionByGrade(code) {
    if (code === "STRONG_BUY")
      return { cash: "약 15–25%", stock: "약 75–85%", lev: "가능 — 소액·단기·손절 원칙 필수" };
    if (code === "BUY") return { cash: "약 25–40%", stock: "약 60–75%", lev: "제한적 — 추세 확인 후" };
    if (code === "SELL") return { cash: "약 55–70%", stock: "약 30–45%", lev: "비권장" };
    return { cash: "약 40–55%", stock: "약 45–60%", lev: "비권장" };
  }

  function scenarioTexts(score, fng, hyNum, vix) {
    var bull =
      "리스크온이 이어지면 금리·실적 모멘텀이 맞물려 지수 방어 후 고점 재시도 시나리오를 염두에 둡니다. (현재 F&G·공포점수 기준 자동 문구)";
    var bear =
      "변동성 확대·신용 우려가 붙으면 하이일드·VIX가 함께 악화되는 하방 시나리오를 점검합니다. (현재 지표 기준 자동 문구)";
    if (score != null && score < 45)
      bull =
        "낮은 공포 점수 구간에서는 매수세 유입·섹터 로테이션이 이어지는 상승 시나리오를 기본으로 둡니다.";
    if (score != null && score >= 55)
      bear =
        "높은 공포 점수에서는 이익 실현·현금 비중 확대와 변동성 장세에 대비하는 하락·횡보 시나리오를 우선합니다.";
    if (Number.isFinite(hyNum) && hyNum > 3.2)
      bear += " HY 스프레드가 넓어 신용 리스크 시나리오 비중을 높게 봅니다.";
    if (Number.isFinite(vix) && vix > 22) bear += " VIX가 높은 편이라 갭·급변 시나리오를 함께 둡니다.";
    if (Number.isFinite(fng) && fng < 30)
      bear = "극단적 공포(F&G 낮음) 구간에서는 추가 하락 후 반등까지 시간이 걸리는 시나리오를 염두에 둡니다.";
    return { bull: bull, bear: bear };
  }

  function deltaClass(it) {
    if (!it) return "";
    var ch = typeof it.change === "number" ? it.change : null;
    if (ch != null) {
      if (ch > 0) return "sr-kpi__delta--up";
      if (ch < 0) return "sr-kpi__delta--down";
    }
    var d = String(it.delta || "");
    if (d.indexOf("📈") !== -1) return "sr-kpi__delta--up";
    if (d.indexOf("📉") !== -1) return "sr-kpi__delta--down";
    return "sr-kpi__delta--flat";
  }

  function renderKpis(items) {
    var grid = document.getElementById("sr-kpi-grid");
    if (!grid) return;
    var specs = [
      { id: "vix", title: "VIX" },
      { id: "fng", title: "공포·탐욕 (CNN)" },
      { id: "putcall", title: "Put / Call" },
      { id: "hy", title: "하이일드 스프레드" }
    ];
    var html = "";
    for (var s = 0; s < specs.length; s++) {
      var it = itemById(items, specs[s].id);
      var val = it && it.value != null ? it.value : "—";
      var del = it && it.delta != null ? it.delta : "—";
      var cls = deltaClass(it);
      html +=
        '<article class="sr-kpi">' +
        '<h3 class="sr-kpi__title">' +
        specs[s].title +
        "</h3>" +
        '<p class="sr-kpi__value">' +
        val +
        '</p><p class="sr-kpi__delta ' +
        cls +
        '">' +
        del +
        "</p></article>";
    }
    grid.innerHTML = html;
  }

  function buildReason(vix, fng, pc, score, vixDir) {
    var parts = [];
    if (Number.isFinite(vix)) parts.push("VIX " + vix.toFixed(2));
    if (Number.isFinite(fng)) parts.push("F&G " + Math.round(fng));
    if (Number.isFinite(pc)) parts.push("P/C " + pc.toFixed(2));
    parts.push("Panic Score " + (score != null ? score : "—"));
    parts.push(
      "VIX 전일대비 " + (vixDir === 1 ? "상승" : vixDir === -1 ? "하락" : "보합")
    );
    return parts.join(" · ") + " 기준으로 요약했습니다.";
  }

  function renderLegacySummary() {
    if (!latestPanicData || !Array.isArray(latestPanicData.items)) return;
    var items = latestPanicData.items;
    var vixIt = itemById(items, "vix");
    var vix = parseNum(vixIt);
    var fng = parseNum(itemById(items, "fng"));
    var pc = parseNum(itemById(items, "putcall"));
    var hyN = parseNum(itemById(items, "hy"));
    var score = panicScore(items);
    var vDir = vixDirection(vixIt);
    var grade = signalGrade(score, vDir);
    var mkt = marketState(score, vix, vDir, fng);
    var act = actionGuide(score);
    var pos = positionByGrade(grade.code);
    var scen = scenarioTexts(score, fng, hyN, vix);

    var el = function (id) {
      return document.getElementById(id);
    };
    if (el("sr-updated")) el("sr-updated").textContent = "업데이트: " + (latestPanicData.updatedAt || "—");
    if (el("sr-grade")) {
      el("sr-grade").textContent = grade.label;
      el("sr-grade").setAttribute("data-grade", grade.code);
    }
    if (el("sr-grade-note")) el("sr-grade-note").textContent = grade.note;
    if (el("sr-market")) el("sr-market").textContent = mkt.label;
    if (el("sr-action")) el("sr-action").textContent = act;
    if (el("sr-reason")) el("sr-reason").textContent = mkt.text + " " + buildReason(vix, fng, pc, score, vDir);
    if (el("sr-scen-bull")) el("sr-scen-bull").textContent = scen.bull;
    if (el("sr-scen-bear")) el("sr-scen-bear").textContent = scen.bear;
    if (el("sr-cash")) el("sr-cash").textContent = pos.cash;
    if (el("sr-stock")) el("sr-stock").textContent = pos.stock;
    if (el("sr-lev")) el("sr-lev").textContent = pos.lev;
    renderKpis(items);
  }

  function loadOverseasFromJson() {
    var overseasUrl = appendFetchCacheBust(window.withSiteVersion("overseas-data.json"));
    return fetch(overseasUrl, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("overseas-data fetch failed");
        return res.json();
      })
      .then(function (data) {
        if (data && Array.isArray(data.items)) {
          latestOverseasData = data;
        } else {
          throw new Error("overseas-data invalid shape");
        }
      })
      .catch(function () {
        if (window.OVERSEAS_DATA && Array.isArray(window.OVERSEAS_DATA.items)) {
          latestOverseasData = window.OVERSEAS_DATA;
          return;
        }
        latestOverseasData = { items: [] };
      })
      .finally(function () {
        refreshPanicSignalDashboard();
      });
  }

  loadPanicTableFromJson();
  loadTickerTrackFromJson();
  loadOverseasFromJson();

  window.setInterval(function () {
    loadPanicTableFromJson();
    loadTickerTrackFromJson();
    loadOverseasFromJson();
    refreshPanicSignalDashboard();
  }, 8 * 60 * 1000);

  window.addEventListener("load", function () {
    loadPanicTableFromJson();
    loadTickerTrackFromJson();
    loadOverseasFromJson();
  });
})();
