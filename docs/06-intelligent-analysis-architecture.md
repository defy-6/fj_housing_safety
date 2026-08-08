# 智能分析模块与报告输出 —— 架构与预留说明

> 参考来源：《城乡融合评估系统》智能分析模块（FastAPI + Next16/vinext），迁移说明见
> `.reasonix/attachments/clipboard-20260807-182851.089770-000003.md`。
> 当前本项目为「骨架 + 最小可运行样板」：可启动、可调用、可验证，**未接真实 LLM**。

## 1. 总体架构（目标形态）

```
前端工作台 (apps/web/app/analysis + app/reports, "use client")
   │  fetch(API_BASE = http://127.0.0.1:8010, 由 apps/web/lib/api.ts 统一出口)
   ▼
FastAPI (backend/app/main.py + routers/analysis.py + routers/reports.py)
   │  subprocess.run(LLM 管线, timeout=360s) / BackgroundTasks(九县报告)
   ▼
独立 Python 管线 (backend/analysis/run_case_pipeline.py)
   │  ① 确定性数据准备(SQLite + region_profiles) ② LLM 正文生成(未接)
   ▼
中间产物 JSON 目录 (backend/outputs/analysis/ANALYSIS_<ts>_<id>/)
   │
   ▼
Word 装配器 (backend/reports/build_full_report.py —— 未建, 后续接入)
   ▼
.docx 输出 (backend/outputs/reports/REPORT_<ts>_<id>/)
```

关键设计决策（沿用参考项目）：

- **LLM 调用与 Web 服务解耦**：管线是可独立运行的 CLI 子进程，环境变量注入模型/密钥/超时，Web 层只管编排与超时回收。
- **密钥不进代码库**：模型→密钥环境变量映射集中在 `LLM_MODEL_REGISTRY`（`backend/app/config.py`）一张表，前端可查询每模型是否已配置。
- **产物全部落盘 JSON**：每步有可审计中间文件，支持断点复用与人工审核闭环。
- **确定性部分永不交给 LLM**：区域概况/特色任务用审定资料库（`backend/configs/region_profiles.json`）直接注入。
- **审核版本优先**：`generated → reviewed` 状态机 + `reviewed_content.json` 覆盖，报告输出优先复用人工审过的正文。

## 2. 目录预留

```text
backend/
├── app/
│   ├── main.py               # FastAPI 入口（health + CORS + 路由挂载）
│   ├── config.py             # 路径定位、产物保留策略、LLM_MODEL_REGISTRY
│   └── routers/
│       ├── analysis.py       # /api/analysis/*（见 3.1）
│       └── reports.py        # /api/reports/*（见 3.2）
├── analysis/
│   ├── run_case_pipeline.py  # 管线 CLI（数据准备 + 占位正文）
│   └── llm_client.py         # OpenAI 兼容客户端 + JSON 容错（备而未用）
├── configs/
│   └── region_profiles.json  # 区域画像配置（示例 2 市，按需扩充全部 9 市+区县）
├── outputs/                  # 运行时产物（不入 Git）
│   ├── analysis/             #   ANALYSIS_<ts>_<id>/
│   └── reports/              #   REPORT_<ts>_<id>/
├── requirements.txt
└── .env.example              # 密钥环境变量模板（复制为 .env）
```

前端预留：

```text
apps/web/
├── lib/api.ts                # API_BASE 常量 + apiFetch（部署可覆盖，避免硬编码）
├── app/analysis/page.tsx     # 智能分析工作台（区域/年度/模型选择 + 正文展示）
└── app/reports/page.tsx      # 报告输出工作台（生成/历史/下载）
```

## 3. API 一览（骨架可调用）

### 3.1 分析（backend/app/routers/analysis.py）

| 路由 | 方法 | 作用 | 状态 |
|---|---|---|---|
| `/api/analysis/regions` | GET | 区域下拉（dim_region 全量） | ✅ |
| `/api/analysis/context` | GET | 区域画像依据（基本信息 + 指标快照） | ✅ |
| `/api/analysis/models` | GET | 模型注册表 + 每模型 `configured` | ✅ |
| `/api/analysis/generate` | POST | 建 job 目录 → subprocess 跑管线 → 读结果 | ✅（管线为占位） |
| `/api/analysis/regenerate-section` | POST | 单段重写 | 占位（返回 stub） |
| `/api/analysis/history` | GET | 扫 `ANALYSIS_*/review_metadata.json` 列版本 | ✅ |
| `/api/analysis/{job_id}` | GET | 载入正文（reviewed 优先） | ✅ |
| `/api/analysis/review` | POST | 保存审核稿 → `reviewed_content.json` | ✅ |

### 3.2 报告（backend/app/routers/reports.py）

| 路由 | 方法 | 作用 | 状态 |
|---|---|---|---|
| `/api/reports/generate` | POST | 单区域 Word（骨架只登记作业） | 占位（未装配 docx） |
| `/api/reports/generate-full` | POST | 九区域完整报告（202 立即返回） | 占位（后台任务未实现） |
| `/api/reports/history` | GET | 仅 completed 且有 docx 的列正式版本 | ✅ |
| `/api/reports/{job_id}/status` | GET | 读 status.json | ✅ |
| `/api/reports/{job_id}/download` | GET | 下载 .docx | 占位（无 docx 时 404） |

## 4. 启动与验证

### 4.1 后端

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

- 接口文档：http://127.0.0.1:8010/docs
- 健康检查：http://127.0.0.1:8010/api/health
- 模型配置状态：http://127.0.0.1:8010/api/analysis/models（`configured` 反映密钥环境变量是否已设）

### 4.2 前端

```powershell
cd apps\web
npm run dev        # 大屏 http://localhost:3100/
```

- 智能分析工作台：http://localhost:3100/analysis
- 报告输出工作台：http://localhost:3100/reports
- 后端地址可在 `apps/web/.env.local` 用 `NEXT_PUBLIC_API_BASE` 覆盖。

### 4.3 管线单独调试

```powershell
$env:REGION_ID="350100"; $env:REPORT_YEAR="2025"
$env:QWEN_OUTPUT_DIR="backend/outputs/analysis/demo"
py -3 backend/analysis/run_case_pipeline.py
```

## 5. 后续接入清单（接真实 LLM 与 Word 时）

1. `backend/configs/region_profiles.json` 扩充全部 9 市 + 重点区县画像（概况/优先指标/重点类型）。
2. `run_case_pipeline.py` 的 generate_case_report 阶段接 `llm_client` + prompt 模板
   （`case_report.md`、`section_rewrite.md`，SYSTEM_PROMPT 约定从参考项目搬入）。
3. 质量自检 `_selection_issues`：字数/段数/指标覆盖/优先指标必须纳入或说明理由，不合格自动 repair。
4. 新增 `backend/reports/build_full_report.py` 装配器 + 图包（chart manifest）流程。
5. 前端工作台从占位改为真实编辑器（逐段修改 + 保存审核稿 + 单段重写按钮）。
6. 生产部署：`analysis_source=prefer_saved` 复用已审核正文，避免重复调用 LLM。

## 6. 迁移踩坑备忘（来自参考项目）

- 前端 API 地址统一走 `apps/web/lib/api.ts`，不再硬编码 8 处。
- DeepSeek V4 必须 `extra_body={"thinking": {"type": "disabled"}}` + max_tokens ≥ 8192。
- `httpx.Client(trust_env=False)` 刻意绕代理；无代理环境无影响。
- 产物目录里的 `assembly_manifest.json` 记录旧机器绝对路径，不可直接复用。
- 历史产物目录不进入 Git；`backend/outputs/` 已在 .gitignore 中排除。
