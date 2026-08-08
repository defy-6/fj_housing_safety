"""共享配置：路径定位、产物保留策略、模型注册表。

参考《城乡融合评估系统》的 LLM_MODEL_REGISTRY 设计：
一张 {key -> label/base_url/model/api_key_env} 表同时驱动
① /api/analysis/models 返回配置状态 ② 子进程环境注入 ③ 前端模型下拉。
新增模型 = 注册表加一行 + 配置对应环境变量，前后端零改动。
"""

from __future__ import annotations

import os
from pathlib import Path

# 项目根目录（backend/app/config.py -> backend -> 项目根）
ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
DATABASE_PATH = ROOT / "database" / "housing-safety.sqlite"

# 中间产物目录（与 scripts/ 的数据产物分离，可独立审计、断点复用）
ANALYSIS_OUTPUT_DIR = BACKEND_DIR / "outputs" / "analysis"
REPORT_OUTPUT_DIR = BACKEND_DIR / "outputs" / "reports"
CONFIG_DIR = BACKEND_DIR / "configs"

# 正式 Word 版本保留数量（按「类型+年度+地区」保留最近 N 版）
FORMAL_OUTPUT_RETENTION = 2

# 模型 -> 密钥环境变量映射（密钥不进代码库）
LLM_MODEL_REGISTRY: dict[str, dict[str, str]] = {
    "qwen3.6-plus": {
        "label": "通义千问 Qwen3.6 Plus",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen3.6-plus",
        "api_key_env": "DASHSCOPE_API_KEY",
    },
    "qwen-turbo": {
        "label": "通义千问 Qwen Turbo",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-turbo",
        "api_key_env": "DASHSCOPE_API_KEY",
    },
    "deepseek-chat": {
        "label": "DeepSeek V4 Chat",
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "api_key_env": "DEEPSEEK_API_KEY",
    },
}


def model_is_configured(key: str) -> bool:
    """对应密钥环境变量是否已设置。"""
    entry = LLM_MODEL_REGISTRY.get(key)
    if not entry:
        return False
    return bool(os.environ.get(entry["api_key_env"]))


def registry_with_config_status() -> dict[str, dict]:
    """返回带 configured 标记的注册表快照（/api/analysis/models 用）。"""
    return {
        key: {**meta, "configured": model_is_configured(key)}
        for key, meta in LLM_MODEL_REGISTRY.items()
    }
