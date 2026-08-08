"""分析模块路由（骨架）。

对应参考项目 backend/app/routers/analysis.py。当前为最小可运行样板：
- context / models / history / {job_id} / review 直接可用（读 SQLite 与产物目录）
- generate 走 subprocess 调用 LLM 管线（管线本身为占位实现，未接真实 LLM）
"""

from __future__ import annotations

import json
import re
import subprocess
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import ANALYSIS_OUTPUT_DIR, CONFIG_DIR, DATABASE_PATH, LLM_MODEL_REGISTRY, registry_with_config_status

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

PIPELINE_SCRIPT = Path(__file__).resolve().parents[2] / "analysis" / "run_case_pipeline.py"
PIPELINE_TIMEOUT_SECONDS = 360

ANALYSIS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class AnalysisRequest(BaseModel):
    region_id: str = Field(..., description="区域 id（dim_region.region_id）")
    year: int = Field(2025, ge=2021, le=2026)
    qwen_model: str = Field("qwen3.6-plus", description="LLM_MODEL_REGISTRY 中的模型 key")


def _job_dir(job_id: str) -> Path:
    return ANALYSIS_OUTPUT_DIR / job_id


@router.get("/regions")
def list_regions():
    """区域下拉数据：dim_region 全部区域（骨架，供工作台选择）。"""
    if not DATABASE_PATH.exists():
        raise HTTPException(500, f"数据库不存在: {DATABASE_PATH}")
    import sqlite3

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT region_id, region_name FROM dim_region ORDER BY "
        "CASE region_level WHEN 'province' THEN 0 WHEN 'city' THEN 1 "
        "WHEN 'special_city' THEN 1 ELSE 2 END, region_name"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/context")
def get_context(region_id: str, year: int = 2025):
    """区域画像依据：从 SQLite 读取区域基本信息与指标快照。"""
    if not DATABASE_PATH.exists():
        raise HTTPException(500, f"数据库不存在: {DATABASE_PATH}")
    import sqlite3

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    region = conn.execute(
        "SELECT region_id, region_name, region_level, parent_region_id, region_type "
        "FROM dim_region WHERE region_id = ?",
        (region_id,),
    ).fetchone()
    if region is None:
        conn.close()
        raise HTTPException(404, f"未找到区域 {region_id}")
    metrics = conn.execute(
        "SELECT m.metric_id, m.metric_name, m.metric_path, m.topic, m.category, m.unit, "
        "f.metric_value, f.is_simulated "
        "FROM fact_region_metric f JOIN dim_metric m ON m.metric_id = f.metric_id "
        "WHERE f.region_id = ? AND f.data_year = ? "
        "ORDER BY m.metric_path LIMIT 200",
        (region_id, year),
    ).fetchall()
    conn.close()
    return {
        "region": dict(region),
        "year": year,
        "metric_count": len(metrics),
        "metrics_sample": [dict(m) for m in metrics],
    }


@router.get("/models")
def list_models():
    """模型注册表 + 每模型 configured 状态（前端下拉与密钥提示用）。"""
    return registry_with_config_status()


@router.post("/generate")
def generate_analysis(req: AnalysisRequest):
    """同步生成分析正文：建 job 目录 -> subprocess 跑管线 -> 读结果写 metadata。"""
    if req.qwen_model not in LLM_MODEL_REGISTRY:
        raise HTTPException(400, f"未知模型 {req.qwen_model}")
    job_id = f"ANALYSIS_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    job_dir = _job_dir(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)

    env = {
        "REGION_ID": req.region_id,
        "REPORT_YEAR": str(req.year),
        "QWEN_MODEL": LLM_MODEL_REGISTRY[req.qwen_model]["model"],
        "QWEN_BASE_URL": LLM_MODEL_REGISTRY[req.qwen_model]["base_url"],
        "QWEN_OUTPUT_DIR": str(job_dir),
        "COUNTY_PROFILES_PATH": str(CONFIG_DIR / "region_profiles.json"),
    }
    try:
        result = subprocess.run(
            ["py", "-3", str(PIPELINE_SCRIPT)],
            env=env,
            capture_output=True,
            text=True,
            timeout=PIPELINE_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "分析管线超时")
    if result.returncode != 0:
        raise HTTPException(502, f"分析管线失败: {result.stderr[-500:]}")

    content_path = job_dir / "case_report_result.json"
    content = json.loads(content_path.read_text(encoding="utf-8")) if content_path.exists() else {"content": ""}
    (job_dir / "review_metadata.json").write_text(
        json.dumps({"status": "generated", "region_id": req.region_id, "year": req.year,
                    "qwen_model": req.qwen_model, "batch": "preview"}, ensure_ascii=False),
        encoding="utf-8",
    )
    return {"job_id": job_id, "content": content}


@router.post("/regenerate-section")
def regenerate_section(job_id: str, section_title: str):
    """单段重写占位：未接真实 LLM，返回原样提示。"""
    return {"job_id": job_id, "section_title": section_title, "status": "stub", "text": ""}


@router.get("/history")
def list_history():
    """扫描 ANALYSIS_*/review_metadata.json 列出版本。"""
    versions = []
    for job_dir in sorted(ANALYSIS_OUTPUT_DIR.glob("ANALYSIS_*")):
        meta_path = job_dir / "review_metadata.json"
        if not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        versions.append({"job_id": job_dir.name, **meta})
    versions.sort(key=lambda v: v["job_id"], reverse=True)
    return versions


@router.get("/{job_id}")
def get_analysis(job_id: str):
    """载入正文：优先 reviewed_content.json，否则 case_report_result.json。"""
    if not re.fullmatch(r"ANALYSIS_\d+_[0-9a-f]{6}", job_id):
        raise HTTPException(400, "非法 job_id")
    job_dir = _job_dir(job_id)
    if not job_dir.exists():
        raise HTTPException(404, f"作业不存在 {job_id}")
    reviewed = job_dir / "reviewed_content.json"
    content_path = reviewed if reviewed.exists() else job_dir / "case_report_result.json"
    if not content_path.exists():
        raise HTTPException(404, "未找到分析正文")
    return {"job_id": job_id, "content": json.loads(content_path.read_text(encoding="utf-8")),
            "source": "reviewed" if reviewed.exists() else "generated"}


class ReviewRequest(BaseModel):
    job_id: str
    content: dict


@router.post("/review")
def save_review(req: ReviewRequest):
    """保存人工审核稿 -> reviewed_content.json，status 置 reviewed。"""
    if not re.fullmatch(r"ANALYSIS_\d+_[0-9a-f]{6}", req.job_id):
        raise HTTPException(400, "非法 job_id")
    job_dir = _job_dir(req.job_id)
    if not job_dir.exists():
        raise HTTPException(404, f"作业不存在 {req.job_id}")
    (job_dir / "reviewed_content.json").write_text(json.dumps(req.content, ensure_ascii=False), encoding="utf-8")
    meta_path = job_dir / "review_metadata.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["status"] = "reviewed"
        meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return {"job_id": req.job_id, "status": "reviewed"}
