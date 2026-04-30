export async function getKoreaPrice(code) {
  const naverUrl =
    "https://finance.naver.com/item/main.naver?code=" + encodeURIComponent(code);
  const url =
    "https://api.allorigins.win/raw?url=" + encodeURIComponent(naverUrl);

  const res = await fetch(url);
  if (!res.ok) return null;

  const html = await res.text();
  const match = html.match(/<span class="blind">([\d,]+)<\/span>/);
  if (!match || !match[1]) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
