"""FastAPI 入口：智能分析 + 报告输出后端。

启动：
    cd backend
    py -3 -m venv .venv
    .venv\\Scripts\\activate（Windows）或 source .venv/bin/activate（macOS）
    pip install -r requirements.txt
    uvicorn app.main:app --host 127.0.0.1 --port 8010

设计要点（参考《城乡融合评估系统》）：
- LLM 调用与 Web 服务解耦：管线是独立 CLI 子进程，Web 层只做编排与超时回收。
- 密钥不进代码库：模型 -> 密钥环境变量映射集中在 LLM_MODEL_REGISTRY（app/config.py）。
- 产物全部落盘 JSON：analysis/outputs 下每步有可审计中间文件。
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import analysis, reports

app = FastAPI(
    title="福建省房屋安全智能分析平台 API",
    version="0.1.0",
    description="智能分析生成、人工审核、Word 报告输出（骨架版，未接真实 LLM）",
)

# 本地开发前端（vinext dev 端口从 3100 起）跨域访问后端
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3100", "http://127.0.0.1:3100"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router)
app.include_router(reports.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "fujian-housing-safety-analysis"}
