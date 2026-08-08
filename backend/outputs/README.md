# 智能分析中间产物

按作业目录保存，命名 `ANALYSIS_<时间戳>_<id>/` 与 `REPORT_<时间戳>_<id>/`。
每个作业包含可审计的中间 JSON（analysis_input / county_profile / case_report_result /
reviewed_content / review_metadata / status），支持断点复用与人工审核闭环。

- `analysis/` — 智能分析正文与审核稿
- `reports/` — Word 报告与装配状态

本目录内容为运行时产物，不进入 Git 仓库。
