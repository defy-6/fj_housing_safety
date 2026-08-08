# 数据库设计草案

推荐使用 PostgreSQL + PostGIS。业务统计使用规范化事实表，地图边界使用空间字段；前端不直接读取原始宽表。

## 核心表

| 表 | 作用 | 关键字段 |
|---|---|---|
| `dim_region` | 行政区与展示层级 | `region_code`, `region_name`, `region_level`, `parent_code`, `region_type`, `geom` |
| `region_alias` | 原始名称映射 | `source_name`, `canonical_region_code`, `source_system` |
| `dim_metric` | 指标字典 | `metric_code`, `metric_name`, `topic`, `unit`, `aggregation_rule` |
| `data_source` | 文件与批次追溯 | `source_id`, `file_name`, `cutoff_date`, `checksum`, `imported_at` |
| `fact_region_metric` | 区域年度指标事实 | `region_code`, `data_year`, `metric_code`, `metric_value`, `scenario`, `is_simulated`, `source_id` |
| `simulation_run` | 模拟参数与版本 | `run_id`, `base_year`, `target_year`, `fluctuation_pct`, `random_seed`, `rule_version` |
| `quality_check_result` | 数据质量结果 | `batch_id`, `rule_code`, `severity`, `record_key`, `message` |

`fact_region_metric` 建议唯一键：`(region_code, data_year, metric_code, scenario)`。

## 指标编码示例

- `inspection.major_hazard.count`
- `inspection.general_hazard.count`
- `inspection.no_hazard.count`
- `building.age.2000s.count`
- `building.structure.masonry.count`
- `place.small_venue.major_hazard.count`
- `rectification.major.completed.demolish.count`
- `rectification.general.in_progress.count`

## 聚合原则

- `SUM`：房屋数量、隐患数量、整治数量。
- `WEIGHTED_AVG`：比例类指标，按其分母加权。
- `DERIVED`：隐患率、整治率、同比等，查询时由分子分母计算。
- `NONE`：无法跨区域直接聚合的等级、文本、状态。

## 地图查询建议

1. 默认返回 `region_level='city'` 的简化边界和当前指标。
2. 缩放或点击后按 `parent_code` 返回区县边界。
3. 不同缩放层级使用不同精度的简化几何，减少首屏数据量。
4. 前端颜色分级由服务端同时返回断点或统一按业务阈值计算。

## 真实与模拟数据隔离

- 2024：`scenario='actual'`, `is_simulated=false`
- 2025/2026 测试：`scenario='test_5pct'`, `is_simulated=true`
- 生产默认查询只允许 `actual`；测试环境显式选择模拟场景。
