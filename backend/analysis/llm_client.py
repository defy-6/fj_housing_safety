"""LLM 客户端封装（骨架）。

对应参考项目 backend/analysis/indicator_analysis/llm_client.py。当前仅提供
环境注入与 OpenAI 兼容客户端工厂，供后续真实 LLM 阶段使用；本骨架不发起调用。

迁移要点（来自参考项目踩坑清单）：
- 全部走 OpenAI 兼容协议，厂商只差 base_url。
- `trust_env=False` 强制绕过本机代理直连（规避 Clash 干扰国内 API）。
- DeepSeek V4 需 `extra_body={"thinking": {"type": "disabled"}}` 且
  max_tokens >= 8192，否则 content 会被思考 token 吃光。
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from openai import OpenAI


def client_for_model(model_key: str, timeout: float = 210.0, max_retries: int = 0) -> OpenAI:
    """按注册表模型 key 构造 OpenAI 兼容客户端。"""
    from app.config import LLM_MODEL_REGISTRY

    entry = LLM_MODEL_REGISTRY.get(model_key)
    if not entry:
        raise ValueError(f"未知模型 key: {model_key}")

    api_key = os.environ.get("QWEN_API_KEY") or os.environ.get(entry["api_key_env"])
    if not api_key:
        raise ValueError(f"缺少密钥环境变量 {entry['api_key_env']}（或 QWEN_API_KEY）")

    return OpenAI(
        api_key=api_key,
        base_url=entry["base_url"],
        timeout=timeout,
        max_retries=max_retries,
        http_client=httpx.Client(trust_env=False),  # 刻意绕代理，见参考项目
    )


def request_kwargs(model_key: str, max_tokens: int = 4096) -> dict[str, Any]:
    """按厂商返回固定调用参数（temperature / response_format / extra_body）。"""
    kwargs: dict[str, Any] = {"temperature": 0.2, "response_format": {"type": "json_object"}}
    if model_key.startswith("qwen3"):
        kwargs["extra_body"] = {"enable_thinking": 0}
    elif model_key.startswith("deepseek"):
        kwargs["max_tokens"] = max(max_tokens, 8192)
        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
    return kwargs


def parse_json_object(text: str) -> Any:
    """容错 JSON 解析：剥 ```json 围栏 -> 取最外层 {...} -> loads -> json_repair 降级。"""
    import json
    import re

    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        cleaned = cleaned[start : end + 1]
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        try:
            from json_repair import repair_json

            return json.loads(repair_json(cleaned))
        except Exception:
            raise ValueError("LLM 输出无法解析为 JSON")
