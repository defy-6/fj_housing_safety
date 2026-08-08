import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = path.resolve(appDir, "..", "..");
const logDir = path.join(projectDir, "runtime");
const urlFile = path.join(logDir, "platform.url");
const startPort = Number.parseInt(process.env.PLATFORM_START_PORT || "3100", 10);

function portAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({host: "127.0.0.1", port}, () => server.close(() => resolve(true)));
  });
}

async function choosePort() {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (port === 3000) continue;
    if (await portAvailable(port)) return port;
  }
  throw new Error(`端口 ${startPort}-${startPort + 99} 均被占用`);
}

await mkdir(logDir, {recursive: true});
const port = await choosePort();
const url = `http://localhost:${port}/`;
await writeFile(urlFile, `${url}\n`, "utf8");
console.log(`房屋安全平台地址：${url}`);

const isWindows = process.platform === "win32";
const executable = path.join(appDir, "node_modules", ".bin", isWindows ? "vinext.cmd" : "vinext");
const child = spawn(executable, ["dev", "--port", String(port), "--hostname", "localhost"], {
  cwd: appDir,
  shell: isWindows,
  env: {...process.env, WRANGLER_LOG_PATH: path.join(appDir, ".wrangler", "wrangler.log")},
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", error => {
  console.error(`无法启动网站：${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) console.log(`平台已停止（${signal}）`);
  process.exit(code ?? 0);
});
