# Report-driven dashboard structure

The 2024 analysis report was used only to understand analysis dimensions and presentation priorities. The platform does not depend on report chapters, wording or fixed conclusions.

## Module mapping

| Platform module | Analysis scope | Main information | Primary charts |
| --- | --- | --- | --- |
| Overview | Overall situation | inspection volume, hazard totals, regional distribution | KPI cards, city/county choropleth, regional ranking |
| Housing profile | Basic profile | construction age, structure, inspected housing types | age/structure composition, regional ranking, map |
| Hazard distribution | Hazard identification | general/major hazards and six key building types | hazard grade composition, city/county ranking, map |
| Inspection & rectification | Governance lifecycle | annual inspection and rectification status/method | progress composition, unrectified ranking, annual trend |
| Key programmes | Classified governance | six key building types | key-type comparison, map, indicator profile |
| Risk check-up | Potential risks | operating self-built, historic, old, altered and damaged buildings | risk-type composition, regional ranking, map |

## Display rules

- The map, ranking, category chart and KPI cards share the same selected year, region and metric.
- 2024 is the current actual-data baseline; 2025 and 2026 are clearly labelled simulation data for monitoring tests.
- Fixed report wording and chapter references are not displayed in the product.
- All database metrics remain available in the region detail drawer even when the overview uses a curated subset.
- Functional and development zones remain independent records and appear as approximate point locations at county zoom level.

## Annual data intake

- UI entry: `Data intake` in the page header.
- Endpoint: `POST /api/data-upload` using multipart form fields `year`, `datasetType` and `file`.
- Accepted staging formats: XLSX, XLS, CSV and JSON; maximum file size 50MB.
- Current endpoint validates upload metadata and reserves the integration contract. Parsing, comparison preview, approval and database replacement will be enabled after the real annual data template is available.
- When actual 2025 or 2026 data is approved, it should replace the corresponding simulated dataset while retaining a source-status field and import audit record.

The data-management workflow follows a four-stage safety model:

1. Upload the annual source file into an isolated staging area.
2. Run file integrity, year, region, metric, missing-value and duplicate checks without changing the production database.
3. Present record-level differences and require explicit human confirmation.
4. Back up the production database, import a new immutable batch, refresh derived platform data and roll back automatically on failure.

Each successful batch should retain the source filename, SHA-256 fingerprint, reporting year, update type, import time, operator, quality report and backup reference. The current implementation completes generic file preflight and exposes the future workflow in the interface; record parsing and production import remain disabled until the real annual workbook template is confirmed.
