"""房屋安全智能分析管线（CLI 入口，骨架占位）。

对应参考项目 backend/analysis/run_case_pipeline.py。当前为最小可运行样板：
- 只做「确定性数据准备」：读 SQLite + 区域画像配置，产出 analysis_input.json 与
  case_report_result.json（占位正文），不调用真实 LLM。
- 设计契约与参考项目一致：stdout 最后一行打印结果 JSON 路径；
  后续接入 LLM 时只需替换 generate_case_report 阶段。

用法（由 Web 层 subprocess 调用，参数全部走环境变量）：
    py -3 backend/analysis/run_case_pipeline.py
    环境变量：REGION_ID / REPORT_YEAR / QWEN_OUTPUT_DIR / COUNTY_PROFILES_PATH
              （可选：QWEN_MODEL / QWEN_BASE_URL / QWEN_API_KEY 供真实 LLM 阶段使用）
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE = BACKEND_DIR.parent / "database" / "housing-safety.sqlite"


def load_profile(profiles_path: Path, region_id: str) -> dict:
    """读取区域画像配置；文件不存在时返回空占位。"""
    if not profiles_path.exists():
        return {"region_id": region_id, "note": "region_profiles.json 未配置，使用空占位"}
    profiles = json.loads(profiles_path.read_text(encoding="utf-8"))
    return profiles.get(region_id, {"region_id": region_id, "note": "未收录于 region_profiles.json"})


def collect_database_facts(db_path: Path, region_id: str, year: int) -> dict:
    """从 SQLite 读取区域指标快照（确定性数据准备）。"""
    if not db_path.exists():
        return {"error": f"数据库不存在: {db_path}"}
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    region = conn.execute(
        "SELECT region_id, region_name, region_level, region_type FROM dim_region WHERE region_id=?",
        (region_id,),
    ).fetchone()
    metrics = conn.execute(
        "SELECT m.metric_id, m.metric_name, m.metric_path, m.topic, m.category, m.unit, "
        "f.metric_value, f.is_simulated "
        "FROM fact_region_metric f JOIN dim_metric m ON m.metric_id=f.metric_id "
        "WHERE f.region_id=? AND f.data_year=? ORDER BY m.metric_path",
        (region_id, year),
    ).fetchall()
    conn.close()
    return {
        "region": dict(region) if region else None,
        "year": year,
        "metric_count": len(metrics),
        "metrics": [dict(m) for m in metrics],
    }


def main() -> int:
    region_id = os.environ.get("REGION_ID", "")
    year = int(os.environ.get("REPORT_YEAR", "2025"))
    output_dir = Path(os.environ.get("QWEN_OUTPUT_DIR", str(Path.cwd())))
    profiles_path = Path(os.environ.get("COUNTY_PROFILES_PATH", str(BACKEND_DIR / "configs" / "region_profiles.json")))
    db_path = Path(os.environ.get("DATABASE_PATH", str(DEFAULT_DATABASE)))

    output_dir.mkdir(parents=True, exist_ok=True)

    profile = load_profile(profiles_path, region_id)
    facts = collect_database_facts(db_path, region_id, year)

    # ① analysis_input.json —— 指标事实快照
    (output_dir / "analysis_input.json").write_text(
        json.dumps({"region_id": region_id, "year": year, **facts}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    # ② county_profile.json —— 区域画像 + 数据库事实（真实 LLM 阶段输入）
    (output_dir / "county_profile.json").write_text(
        json.dumps({"facts": {**profile, "database_facts": facts}}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    # ③ case_report_result.json —— 最终正文（占位：确定性摘要，未接 LLM）
    region_name = (facts.get("region") or {}).get("region_name", region_id)
    placeholder_content = {
        "title": f"{region_name} {year} 年房屋安全分析（占位）",
        "sections": [
            {"heading": "一、总体概况", "paragraphs": [
                f"{region_name} {year} 年房屋安全指标共 {facts.get('metric_count', 0)} 项。" 
                "此正文由骨架管线生成，接入 LLM 后将替换为模型输出。"],
            },
            {"heading": "二、隐患特征", "paragraphs": ["待 LLM 生成。"]},
        ],
    }
    (output_dir / "case_report_result.json").write_text(
        json.dumps(placeholder_content, ensure_ascii=False, indent=2), encoding="utf-8",
    )
    # ④ analysis_stage.json —— 阶段状态
    (output_dir / "analysis_stage.json").write_text(
        json.dumps({"stage": "completed", "quality_warnings": ["LLM 未接入，正文为占位内容"]},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    result_path = output_dir / "case_report_result.json"
    print(result_path)  # 约定：stdout 最后一行 = 结果 JSON 路径
    return 0


if __name__ == "__main__":
    sys.exit(main())
