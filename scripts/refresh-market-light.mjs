/**
 * 티커·해외·data/* 재생성 (패닉 행은 기존 panic-data.json 유지).
 * 로컬에서 정적 배포 전 미리보기용 — 저장소 자동 갱신은 GitHub Actions 가 담당.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env, SKIP_PANIC: "1", SKIP_YOUTUBE: "1" };

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("node", ["auto-update-panic-data.mjs"]);
run("node", [path.join("scripts", "fetch.js")]);
console.log("[refresh-market-light] Done. Run `npm run version:site` and commit if you deploy static files.");
