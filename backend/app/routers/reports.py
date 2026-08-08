"""报告输出路由（骨架）。

对应参考项目 backend/app/routers/reports.py。当前为最小可运行样板：
- history / {job_id}/status / {job_id}/download 扫描产物目录
- generate / generate-full 为占位（未接 Word 装配器与图包）
"""

from __future__ import annotations

import json
import re
import shutil
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..config import REPORT_OUTPUT_DIR, registry_with_config_status

router = APIRouter(prefix="/api/reports", tags=["reports"])

REPORT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class ReportRequest(BaseModel):
    region_id: str = Field(..., description="区域 id")
    year: int = Field(2025, ge=2021, le=2026)
    qwen_model: str = Field("qwen3.6-plus")
    analysis_job_id: str | None = Field(None, description="复用已保存的分析正文")


class FullReportRequest(BaseModel):
    year: int = Field(2025, ge=2021, le=2026)
    qwen_model: str = Field("qwen3.6-plus")
    analysis_source: str = Field("prefer_saved", pattern="^(prefer_saved|live_all)$")


@router.post("/generate")
def generate_report(req: ReportRequest):
    """同步单区域 Word（占位）：仅建 job 目录与 status.json，未装配 docx。"""
    job_id = f"REPORT_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    job_dir = REPORT_OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / "status.json").write_text(
        json.dumps({"status": "completed", "progress": 1, "total": 1,
                    "region_id": req.region_id, "year": req.year,
                    "analysis_job_id": req.analysis_job_id}, ensure_ascii=False),
        encoding="utf-8",
    )
    return {"job_id": job_id, "download_url": f"/api/reports/{job_id}/download"}


@router.post("/generate-full")
def generate_full_report(req: FullReportRequest):
    """九区域完整报告（占位）：立即返回 202，后台任务后续实现。"""
    job_id = f"REPORT_{int(time.time())}_{uuid.uuid4().hex[:6]}_full"
    job_dir = REPORT_OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / "status.json").write_text(
        json.dumps({"status": "queued", "progress": 0, "total": 9,
                    "year": req.year, "analysis_source": req.analysis_source}, ensure_ascii=False),
        encoding="utf-8",
    )
    from fastapi.responses import JSONResponse

    return JSONResponse({"job_id": job_id}, status_code=202)


@router.get("/history")
def list_reports():
    """扫描 REPORT_* 目录，仅 status=completed 且有 docx 的列正式版本。"""
    versions = []
    for job_dir in sorted(REPORT_OUTPUT_DIR.glob("REPORT_*")):
        status_path = job_dir / "status.json"
        if not status_path.exists():
            continue
        status = json.loads(status_path.read_text(encoding="utf-8"))
        docx = list(job_dir.glob("*.docx"))
        if status.get("status") != "completed" or not docx:
            continue
        versions.append({"job_id": job_dir.name, **status, "docx": docx[0].name,
                         "updated_at": docx[0].stat().st_mtime})
    versions.sort(key=lambda v: v.get("updated_at", 0), reverse=True)
    return versions


@router.get("/{job_id}/status")
def report_status(job_id: str):
    if not re.fullmatch(r"REPORT_\d+_[0-9a-f]{6}(_full)?", job_id):
        raise HTTPException(400, "非法 job_id")
    status_path = REPORT_OUTPUT_DIR / job_id / "status.json"
    if not status_path.exists():
        raise HTTPException(404, f"作业不存在 {job_id}")
    return json.loads(status_path.read_text(encoding="utf-8"))


@router.get("/{job_id}/download")
def download_report(job_id: str):
    if not re.fullmatch(r"REPORT_\d+_[0-9a-f]{6}(_full)?", job_id):
        raise HTTPException(400, "非法 job_id")
    job_dir = REPORT_OUTPUT_DIR / job_id
    docx = next(job_dir.glob("*.docx"), None) if job_dir.exists() else None
    if docx is None:
        raise HTTPException(404, "未找到可下载的 Word 文档")
    return FileResponse(docx, filename=docx.name)
