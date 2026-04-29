/**
 * Python urllib이 CNN에 418을 받는 환경에서, Node fetch로 Fear & Greed만 보정합니다.
 * 성공 시 panic-data.json / panic-data.js만 덮어씁니다.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "panic-data.json");
const dataJsPath = path.join(root, "panic-data.js");

const CNN = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

function formatValue(value, digits) {
  return `${value.toFixed(digits)}`;
}

function formatDelta(now, prev, digits) {
  if (!Number.isFinite(now) || !Number.isFinite(prev)) return "-";
  const diff = now - prev;
  if (diff === 0) return "➡️ 0";
  const icon = diff > 0 ? "📈" : "📉";
  const sign = diff > 0 ? "+" : "-";
  const rounded = Math.abs(diff).toFixed(digits);
  if (Number.parseFloat(rounded) === 0) return "➡️ 0";
  return `${icon} ${sign}${rounded}`;
}

function toneFng(value) {
  if (!Number.isFinite(value)) return { tone: "watch", status: "🟡 점검 필요" };
  if (value >= 75) return { tone: "watch", status: "🟡 탐욕" };
  if (value <= 25) return { tone: "alert", status: "🔴 공포" };
  return { tone: "stable", status: "🟢 중립" };
}

function actionGuideByTone(tone) {
  if (tone === "alert") return "헤지점검";
  if (tone === "watch") return "분할매수";
  return "관망";
}

async function main() {
  const res = await fetch(CNN, {
    headers: { "user-agent": "yds-investment-insights-bot/1.0", accept: "application/json" }
  });
  if (!res.ok) {
    console.log(`[SKIP] CNN F&G HTTP ${res.status}`);
    process.exit(0);
  }
  const json = await res.json();
  const now = json?.fear_and_greed?.score;
  const previous = json?.fear_and_greed?.previous_close;
  const weekAgo = json?.fear_and_greed?.previous_1_week;
  if (!Number.isFinite(now) || !Number.isFinite(previous)) {
    console.log("[SKIP] CNN F&G invalid payload");
    process.exit(0);
  }
  let weekTrend = "보합";
  if (Number.isFinite(weekAgo)) {
    const wdiff = now - weekAgo;
    if (wdiff > 2.5) weekTrend = "상승";
    else if (wdiff < -2.5) weekTrend = "하락";
  }

  const raw = await readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data.items) ? data.items : [];
  const item = items.find((x) => x.id === "fng");
  if (!item) {
    console.log("[SKIP] fng row missing");
    process.exit(0);
  }

  item.value = formatValue(now, 0);
  item.delta = formatDelta(now, previous, 0);
  item.weekTrend = weekTrend;
  const next = toneFng(now);
  item.tone = next.tone;
  item.status = next.status;
  item.actionGuide = actionGuideByTone(next.tone);
  item.source = "cnn";

  const jsonText = `${JSON.stringify(data, null, 2)}\n`;
  const jsText = `window.PANIC_DATA = ${JSON.stringify(data, null, 2)};\n`;
  await writeFile(dataPath, jsonText, "utf8");
  await writeFile(dataJsPath, jsText, "utf8");
  console.log("[OK] CNN F&G patched via Node fetch");
}

main().catch((err) => {
  console.error("[SKIP] CNN patch:", err.message);
  process.exit(0);
});
