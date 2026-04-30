const API_URL = "https://www.alphavantage.co/query";
const FETCH_TIMEOUT_MS = 7000;
const MAX_RETRIES = 2;

function getApiKey() {
  return (
    window.ALPHA_VANTAGE_API_KEY ||
    localStorage.getItem("alpha_vantage_api_key") ||
    ""
  );
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(options || {}), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getStockPrice(symbol) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url =
    API_URL +
    "?function=GLOBAL_QUOTE&symbol=" +
    encodeURIComponent(symbol) +
    "&apikey=" +
    encodeURIComponent(apiKey);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.Note) continue; // Alpha Vantage rate limit hint
      const raw = data && data["Global Quote"] ? data["Global Quote"]["05. price"] : null;
      const price = Number(raw);
      if (Number.isFinite(price) && price > 0) return price;
    } catch (e) {
      // retry on transient network/timeout errors
    }
  }
  return null;
}
