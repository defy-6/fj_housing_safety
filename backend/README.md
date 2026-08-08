# 智能分析后端（骨架）

对应参考项目《城乡融合评估系统》的智能分析模块，为「骨架 + 最小可运行样板」：
FastAPI 可启动、分析/报告路由可调用、管线 CLI 可独立运行，**未接真实 LLM**。

## 目录

```text
backend/
├── app/                      # FastAPI 服务
│   ├── main.py               # 入口（health + CORS + 路由挂载）
│   ├── config.py             # 路径定位、产物保留策略、LLM_MODEL_REGISTRY
│   └── routers/
│       ├── analysis.py       # /api/analysis/*（context/models/generate/history/review）
│       └── reports.py        # /api/reports/*（generate/generate-full/history/status/download）
├── analysis/                 # 独立 LLM 管线（CLI 子进程）
│   ├── run_case_pipeline.py  # 数据准备 + 正文生成（占位）
│   └── llm_client.py         # OpenAI 兼容客户端 + JSON 容错（供后续使用）
├── configs/
│   └── region_profiles.json  # 区域画像配置示例（对应参考项目 county_profiles.json）
├── outputs/                  # 运行时产物 ANALYSIS_*/REPORT_*（不入 Git）
├── requirements.txt
└── .env.example              # 密钥环境变量模板（复制为 .env）
```

## 启动

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

接口文档：http://127.0.0.1:8010/docs

## 与参考项目的对应关系

| 参考项目 | 本项目 | 状态 |
|---|---|---|
| backend/app/main.py（LLM_MODEL_REGISTRY） | backend/app/config.py | 已迁移 |
| backend/app/routers/analysis.py | backend/app/routers/analysis.py | 骨架（generate 走占位管线） |
| backend/app/routers/reports.py | backend/app/routers/reports.py | 骨架（Word 装配未接） |
| backend/analysis/run_case_pipeline.py | backend/analysis/run_case_pipeline.py | 占位（只做数据准备） |
| backend/analysis/indicator_analysis/llm_client.py | backend/analysis/llm_client.py | 客户端工厂已备，未发起调用 |
| backend/analysis/outputs/ | backend/outputs/analysis/ | 目录就绪 |
| backend/reports/outputs/ | backend/outputs/reports/ | 目录就绪 |
| backend/reports/configs/county_profiles.json | backend/configs/region_profiles.json | 示例 2 市，按需扩充 |
| build_dongshan_test_docx.py / build_full_report.py | （未建） | 后续接入 Word 装配器时补 |

## 后续接入清单（接真实 LLM 时）

1. `configs/region_profiles.json` 扩充全部 9 市 + 重点区县画像。
2. `run_case_pipeline.py` 的 generate_case_report 阶段接 llm_client + prompt 模板。
3. 新增 `backend/reports/build_full_report.py` 装配器与图包（chart manifest）流程。
4. 前端工作台从占位页改为真实编辑器（逐段修改 + 保存审核稿）。
