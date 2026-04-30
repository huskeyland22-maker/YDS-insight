function parseNumber(text) {
  var n = Number(String(text === undefined || text === null ? "" : text).replace(/,/g, "").replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function getMarketData(raw) {
  var source = raw || {};
  return {
    vix: Number(source.vix) || 0,
    us10y: Number(source.us10y) || 0,
    hy: Number(source.hy) || 0,
    ndx: Number(source.ndx) || 0,
    sentiment: Number(source.sentiment) || 50,
  };
}

export function getMarketDataFromGlobals(tickerData, panicData) {
  var tickerItems = (tickerData && tickerData.items) || [];
  var panicItems = (panicData && panicData.items) || [];

  var byLabel = {};
  for (var i = 0; i < tickerItems.length; i += 1) {
    var t = tickerItems[i];
    if (t && t.label) byLabel[String(t.label)] = t;
  }

  var byId = {};
  for (var j = 0; j < panicItems.length; j += 1) {
    var p = panicItems[j];
    if (p && p.id) byId[String(p.id)] = p;
  }

  return getMarketData({
    vix: parseNumber(byId.vix && byId.vix.value),
    us10y: parseNumber(byLabel["US 10Y"] && byLabel["US 10Y"].delta),
    hy: parseNumber(byId.hy && byId.hy.value),
    ndx: parseNumber(byLabel["NASDAQ 100"] && byLabel["NASDAQ 100"].delta),
    sentiment: parseNumber(byId.fng && byId.fng.value),
  });
}
