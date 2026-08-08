PRAGMA foreign_keys=ON;
CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE import_batch(
  batch_id INTEGER PRIMARY KEY, source_file TEXT NOT NULL, source_sha256 TEXT NOT NULL,
  cutoff_date TEXT NOT NULL, imported_at TEXT NOT NULL, workbook_sheets INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running','complete','failed'))
);
CREATE TABLE data_source(
  source_id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL REFERENCES import_batch(batch_id),
  sheet_name TEXT NOT NULL, header_rows INTEGER NOT NULL, first_data_row INTEGER NOT NULL,
  source_rows INTEGER NOT NULL, source_columns INTEGER NOT NULL, UNIQUE(batch_id,sheet_name)
);
CREATE TABLE dim_region(
  region_id TEXT PRIMARY KEY, region_name TEXT NOT NULL, region_level TEXT NOT NULL,
  parent_region_id TEXT REFERENCES dim_region(region_id), region_type TEXT NOT NULL,
  canonical_city TEXT, source_city_name TEXT, source_county_name TEXT
);
CREATE TABLE region_alias(
  alias_id INTEGER PRIMARY KEY, alias_name TEXT NOT NULL, region_id TEXT NOT NULL REFERENCES dim_region(region_id),
  alias_type TEXT NOT NULL, UNIQUE(alias_name,region_id)
);
CREATE TABLE dim_metric(
  metric_id TEXT PRIMARY KEY, sheet_name TEXT NOT NULL, source_column INTEGER NOT NULL,
  metric_name TEXT NOT NULL, metric_path TEXT NOT NULL, topic TEXT NOT NULL, category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'count', value_type TEXT NOT NULL DEFAULT 'integer',
  aggregation_rule TEXT NOT NULL DEFAULT 'SUM', UNIQUE(sheet_name,source_column)
);
CREATE TABLE source_row_snapshot(
  snapshot_id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES data_source(source_id),
  source_row INTEGER NOT NULL, region_id TEXT NOT NULL REFERENCES dim_region(region_id),
  source_city_name TEXT NOT NULL, source_county_name TEXT NOT NULL, row_json TEXT NOT NULL,
  UNIQUE(source_id,source_row)
);
CREATE TABLE simulation_run(
  run_id INTEGER PRIMARY KEY, scenario TEXT NOT NULL, base_year INTEGER NOT NULL,
  target_years TEXT NOT NULL, fluctuation_min REAL NOT NULL, fluctuation_max REAL NOT NULL,
  random_seed INTEGER NOT NULL, rule_version TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE fact_region_metric(
  fact_id INTEGER PRIMARY KEY, region_id TEXT NOT NULL REFERENCES dim_region(region_id),
  data_year INTEGER NOT NULL, metric_id TEXT NOT NULL REFERENCES dim_metric(metric_id),
  metric_value REAL NOT NULL, scenario TEXT NOT NULL, is_simulated INTEGER NOT NULL CHECK(is_simulated IN (0,1)),
  source_id INTEGER REFERENCES data_source(source_id), source_row INTEGER, source_column INTEGER,
  simulation_run_id INTEGER REFERENCES simulation_run(run_id), base_year INTEGER,
  UNIQUE(region_id,data_year,metric_id,scenario)
);
CREATE TABLE quality_check_result(
  check_id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL REFERENCES import_batch(batch_id),
  rule_code TEXT NOT NULL, severity TEXT NOT NULL CHECK(severity IN ('INFO','WARNING','ERROR')),
  status TEXT NOT NULL CHECK(status IN ('PASS','FAIL','OBSERVATION')),
  record_key TEXT, expected_value TEXT, actual_value TEXT, message TEXT NOT NULL,
  checked_at TEXT NOT NULL
);
CREATE INDEX idx_fact_year_metric ON fact_region_metric(data_year,metric_id,scenario);
CREATE INDEX idx_fact_region_year ON fact_region_metric(region_id,data_year,scenario);
CREATE INDEX idx_region_parent ON dim_region(parent_region_id);
CREATE INDEX idx_quality_rule ON quality_check_result(rule_code,status);
CREATE VIEW v_metric_values AS
SELECT f.data_year,f.scenario,f.is_simulated,r.region_id,r.region_name,r.region_level,r.parent_region_id,
       m.metric_id,m.metric_name,m.metric_path,m.topic,m.category,m.unit,f.metric_value
FROM fact_region_metric f JOIN dim_region r ON r.region_id=f.region_id JOIN dim_metric m ON m.metric_id=f.metric_id;
CREATE VIEW v_yearly_comparison AS
SELECT region_id,metric_id,
       MAX(CASE WHEN data_year=2024 THEN metric_value END) AS value_2024,
       MAX(CASE WHEN data_year=2025 THEN metric_value END) AS value_2025,
       MAX(CASE WHEN data_year=2026 THEN metric_value END) AS value_2026
FROM fact_region_metric GROUP BY region_id,metric_id;
