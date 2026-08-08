# 福建省房屋安全数据库

## 文件

- `housing-safety.sqlite`：可直接使用的完整 SQLite 数据库。
- `schema.sql`：数据库表、索引和视图定义。
- `database-report.md`：构建规模、质量检查和查询约定。
- `../scripts/build_database.py`：从原始 Excel 可重复构建数据库。

## 数据范围

- 2024：原始实际数据，三张工作表全部指标。
- 2025、2026：固定随机种子生成的 ±5% 测试数据。
- 112 个区域：福建省、9 个设区市、平潭综合试验区、101 个区县/开发区/片区源单元。
- 180 个指标：基础信息 49 个、隐患整治 72 个、潜在风险 59 个。

## 常用查询

```sql
-- 查看某一区域三年全部指标
SELECT *
FROM v_metric_values
WHERE region_name = '福州市'
ORDER BY data_year, topic, metric_path;

-- 查询重大安全隐患年度比较
SELECT r.region_name, y.*
FROM v_yearly_comparison y
JOIN dim_region r ON r.region_id = y.region_id
WHERE y.metric_id = 'basic.c003';

-- 查看源数据汇总差异
SELECT *
FROM quality_check_result
WHERE rule_code = 'SOURCE_SUMMARY_RECONCILIATION';
```

## 重建

运行项目的数据库构建脚本即可覆盖生成数据库。原始 Excel 不会被修改。
