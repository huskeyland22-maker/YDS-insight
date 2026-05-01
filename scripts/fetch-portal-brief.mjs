import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outJson = path.join(root, "data", "portal-brief.json");
const outJs = path.join(root, "data", "portal-brief.js");

const UA = "yds-investment-insights-bot/1.0";

const TOPICS = [
  { id: "market", q: "미국 증시 연준 금리" },
  { id: "flow", q: "나스닥 반도체 자금 유입" },
  { id: "smart", q: "골드만삭스 모건스탠리 미국 증시 전망" },
  { id: "core", q: "미국 국채금리 기술주 밸류에이션" },
  { id: "risk", q: "VIX 하이일드 스프레드 달러" },
  { id: "korea", q: "코스피 코스닥 미국 증시 영향" }
];

const SOURCE_WHITELIST = [
  "Reuters",
  "CNBC",
  "Bloomberg",
  "Financial Times",
  "WSJ",
  "Barron's",
  "MarketWatch",
  "Investing.com",
  "연합뉴스",
  "한국경제",
  "매일경제",
  "서울경제",
  "머니투데이"
];

const TOPIC_KEYWORDS = {
  market: ["미국", "증시", "연준", "금리", "나스닥", "S&P", "다우"],
  flow: ["자금", "유입", "유출", "반도체", "기술주", "테크", "섹터"],
  smart: ["골드만", "모건스탠리", "블랙록", "뱅가드", "헤지펀드", "월가"],
  core: ["국채", "금리", "밸류", "멀티플", "할인율", "실적"],
  risk: ["VIX", "변동성", "하이일드", "스프레드", "달러", "리스크"],
  korea: ["코스피", "코스닥", "한국", "외국인", "환율", "반도체"]
};

const CLICKBAIT_PATTERNS = [
  /충격/i,
  /폭등/i,
  /폭락/i,
  /대박/i,
  /반전/i,
  /긴급/i,
  /지금\s*당장/i
];

function nowKstString() {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
  return fmt.replace(",", "");
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function firstMatch(text, rx) {
  const m = String(text || "").match(rx);
  return m ? m[1] : "";
}

function parseRssItems(xmlText) {
  const items = [];
  const raw = String(xmlText || "");
  const blocks = raw.match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = stripHtml(firstMatch(block, /<title>([\s\S]*?)<\/title>/i));
    const link = stripHtml(firstMatch(block, /<link>([\s\S]*?)<\/link>/i));
    const pubDate = stripHtml(firstMatch(block, /<pubDate>([\s\S]*?)<\/pubDate>/i));
    const source = stripHtml(firstMatch(block, /<source[^>]*>([\s\S]*?)<\/source>/i));
    if (!title || !link) continue;
    items.push({
      title,
      link,
      source: source || "Google News",
      pubDate
    });
  }
  return items;
}

function includesAny(text, words) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(String(w).toLowerCase()));
}

function sourceScore(source) {
  const s = String(source || "");
  return SOURCE_WHITELIST.some((w) => s.toLowerCase().includes(w.toLowerCase())) ? 4 : -1;
}

function clickbaitPenalty(title) {
  const t = String(title || "");
  return CLICKBAIT_PATTERNS.some((rx) => rx.test(t)) ? -2 : 0;
}

function relevanceScore(topicId, title) {
  const kws = TOPIC_KEYWORDS[topicId] || [];
  const t = String(title || "").toLowerCase();
  let score = 0;
  for (const kw of kws) {
    if (t.includes(String(kw).toLowerCase())) score += 1;
  }
  return score;
}

function pickBestItem(topicId, items) {
  if (!Array.isArray(items) || !items.length) return null;
  const scored = items.map((it) => {
    const score =
      relevanceScore(topicId, it.title) +
      sourceScore(it.source) +
      clickbaitPenalty(it.title);
    return { ...it, __score: score };
  });
  scored.sort((a, b) => b.__score - a.__score);
  return scored[0];
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.text();
}

function headlineToBrief(topicId, title) {
  if (!title) return "-";
  if (topicId === "market") return `포털 시그널: ${title}`;
  if (topicId === "flow") return `자금흐름 단서: ${title}`;
  if (topicId === "smart") return `월가 관점 단서: ${title}`;
  if (topicId === "core") return `본질 신호: ${title}`;
  if (topicId === "risk") return `리스크 단서: ${title}`;
  if (topicId === "korea") return `한국장 연계 단서: ${title}`;
  return title;
}

async function main() {
  const sections = {};
  const allHeadlines = [];

  for (const topic of TOPICS) {
    const url =
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(`${topic.q} when:1d`) +
      "&hl=ko&gl=KR&ceid=KR:ko";
    try {
      const xml = await fetchText(url);
      const items = parseRssItems(xml);
      const top = pickBestItem(topic.id, items);
      sections[topic.id] = {
        brief: headlineToBrief(topic.id, top ? top.title : "관련 헤드라인 없음"),
        title: top ? top.title : "",
        link: top ? top.link : "",
        source: top ? top.source : "Google News",
        score: top ? Number(top.__score || 0) : 0
      };
      if (top) {
        allHeadlines.push({
          topic: topic.id,
          title: top.title,
          link: top.link,
          source: top.source,
          pubDate: top.pubDate
        });
      }
      console.log(`[OK] portal topic ${topic.id} (${items.length} rows)`);
    } catch (err) {
      sections[topic.id] = {
        brief: "포털 데이터 로드 대기",
        title: "",
        link: "",
        source: "Google News"
      };
      console.log(`[SKIP] portal topic ${topic.id} ${err.message}`);
    }
  }

  const payload = {
    updatedAt: `${nowKstString()} KST (포털 RSS 자동 수집)`,
    source: "google-news-rss",
    sections,
    headlines: allHeadlines.slice(0, 8)
  };

  await writeFile(outJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(outJs, `window.PORTAL_BRIEF_DATA = ${JSON.stringify(payload, null, 2)};\n`, "utf8");
  console.log("portal-brief.json / portal-brief.js 업데이트 완료");
}

main().catch((err) => {
  console.error("실패:", err.message);
  process.exit(1);
});

