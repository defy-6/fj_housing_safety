// Cross-platform wrapper for `vinext` CLI commands.
// The original package.json scripts used POSIX env syntax
// (WRANGLER_LOG_PATH=... vinext build), which fails on Windows cmd.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2];

if (!command) {
  console.error("用法: node scripts/run_vinext.mjs <dev|build|start> [args...]");
  process.exit(1);
}

const isWindows = process.platform === "win32";
const executable = path.join(appDir, "node_modules", ".bin", isWindows ? "vinext.cmd" : "vinext");
const child = spawn(executable, [command, ...process.argv.slice(3)], {
  cwd: appDir,
  shell: isWindows,
  env: {...process.env, WRANGLER_LOG_PATH: path.join(appDir, ".wrangler", "wrangler.log")},
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", error => {
  console.error(`无法启动 vinext：${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) console.log(`vinext 已停止（${signal}）`);
  process.exit(code ?? 0);
});
