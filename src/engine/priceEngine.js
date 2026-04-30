const API_URL = "https://www.alphavantage.co/query";

function getApiKey() {
  return (
    window.ALPHA_VANTAGE_API_KEY ||
    localStorage.getItem("alpha_vantage_api_key") ||
    ""
  );
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

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data && data["Global Quote"] ? data["Global Quote"]["05. price"] : null;
  const price = Number(raw);
  return Number.isFinite(price) ? price : null;
}
