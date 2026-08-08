/**
 * 后端 API 基址统一出口。
 *
 * 参考项目踩坑：前端 8 处硬编码 http://127.0.0.1:8000，后端换端口需同步改。
 * 本项目默认指向本地 FastAPI 服务 8010 端口（避开参考项目的 8000）；部署时可用环境变量覆盖。
 * 覆盖方式：apps/web/.env.local 中写 NEXT_PUBLIC_API_BASE=http://host:port
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8010";

/** 带超时的 fetch 封装，供工作台调用智能分析后端。 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 30_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
