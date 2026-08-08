# Project Structure and Naming Rules

项目内部路径采用英文命名，说明文档与页面内容可继续使用中文。

## Directory layout

```text
.
├── apps/
│   └── web/              # Web application and browser assets
│       ├── app/          # Page components and global styles
│       ├── public/data/  # Generated browser-ready JSON and map data
│       ├── lib/          # Shared frontend utilities (API base, fetch)
│       └── scripts/      # Web startup helpers
├── backend/              # Intelligent analysis + report backend (FastAPI skeleton)
│   ├── app/              # FastAPI service (main, config, routers)
│   ├── analysis/         # Standalone LLM pipeline CLI (data prep + generation)
│   ├── configs/          # Region profile configuration
│   └── outputs/          # Runtime analysis/report artifacts (git-ignored)
├── config/               # Simulation and processing configuration
├── data/
│   ├── raw/              # Immutable source files
│   ├── staging/          # Cleaned intermediate data
│   ├── processed/        # Publishable processed data
│   ├── simulated/        # Test and simulated data
│   └── reference/        # Administrative and business reference data
├── database/             # SQLite database, schema, queries and migrations
├── docs/                 # Workflow, inventory and design documentation
├── outputs/              # Reports and exported deliverables
├── runtime/              # PID, URL and local service logs
├── scripts/              # Database and platform-data build scripts
├── tests/                # Data and application checks
└── start-platform.command
```

## Naming rules

- 目录和文件使用英文小写。
- 多词名称使用 `kebab-case`，例如 `housing-analytics.json`。
- Python 文件使用 `snake_case`，例如 `build_database.py`。
- React/TypeScript 入口遵循框架约定，例如 `page.tsx`、`layout.tsx`。
- 原始资料使用“内容-年份-日期”的稳定名称，不把中文标题写进路径。
- 行政区名称属于业务数据，可在 JSON 内容中保留中文；地图文件名使用拼音或行政区代码。
- `data/raw/` 只读保留，生成数据统一写入 `apps/web/public/data/`、`database/` 或 `outputs/`。

## Build flow

```text
data/raw
  -> scripts/build_database.py
  -> database/housing-safety.sqlite
  -> scripts/build_platform_data.py
  -> apps/web/public/data
  -> apps/web
```

运行时文件不属于业务数据，统一放在 `runtime/`，包括服务进程号、当前 URL 和前端日志。
