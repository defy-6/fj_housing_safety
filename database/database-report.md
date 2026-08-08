# 福建省房屋安全数据库构建报告

## 构建结果

- 数据库：`database/housing-safety.sqlite`
- 数据库版本：1.0.0
- 原始年份：2024
- 模拟年份：2025、2026（逐年 ±5%，固定随机种子 20242026）
- 区域：112 个
- 指标：180 个
- 事实记录：60,480 条
- 原始行快照：336 条
- 质量检查：84 条
- 失败检查：0 条
- 汇总差异观察项：73 条

## 核心表

| 表/视图 | 用途 |
|---|---|
| `dim_region` | 省、市、区县/开发区/片区区域维表 |
| `dim_metric` | 180 个完整指标及原始列位置 |
| `fact_region_metric` | 2024 实际与 2025/2026 模拟事实长表 |
| `source_row_snapshot` | 三张源表每一行的完整 JSON 快照 |
| `simulation_run` | 模拟场景、浮动范围和随机种子 |
| `quality_check_result` | 完整性和勾稽检查结果 |
| `v_metric_values` | 已关联区域和指标名称的查询视图 |
| `v_yearly_comparison` | 2024—2026 横向比较视图 |

## 查询约定

- 实际数据：`scenario='actual' AND is_simulated=0`
- 测试数据：`scenario='test_5pct' AND is_simulated=1`
- 每条 2024 事实均保存源工作表、源行、源列。
- 质量观察项不改写原始数据；源汇总与明细差异均保存在 `quality_check_result`。
