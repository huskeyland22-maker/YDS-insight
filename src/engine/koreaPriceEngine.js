const FETCH_TIMEOUT_MS = 7000;
const MAX_RETRIES = 2;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(options || {}), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getKoreaPrice(code) {
  const naverUrl =
    "https://finance.naver.com/item/main.naver?code=" + encodeURIComponent(code);
  const url =
    "https://api.allorigins.win/raw?url=" + encodeURIComponent(naverUrl);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const html = await res.text();
      const match = html.match(/<span class="blind">([\d,]+)<\/span>/);
      if (!match || !match[1]) continue;
      const parsed = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } catch (e) {
      // retry on transient network/timeout errors
    }
  }

  return null;
}
