import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const py = spawnSync("python", ["update_data.py"], { cwd: root, stdio: "inherit", shell: true });
if (py.status !== 0) process.exit(py.status ?? 1);

spawnSync("node", [path.join(root, "scripts", "patch-fng-from-cnn.mjs")], {
  cwd: root,
  stdio: "inherit"
});

const node = spawnSync("node", ["auto-update-panic-data.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, SKIP_PANIC: "1" }
});
if (node.status !== 0) process.exit(node.status ?? 1);

const fetchData = spawnSync("node", [path.join(root, "scripts", "fetch.js")], {
  cwd: root,
  stdio: "inherit"
});
process.exit(fetchData.status ?? 0);
