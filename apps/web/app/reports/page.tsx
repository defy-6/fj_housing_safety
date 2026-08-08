"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, API_BASE } from "@/lib/api";

type RegionRow = { region_id: string; region_name: string };
type ReportItem = { job_id: string; region_id?: string; year?: number; docx?: string; updated_at?: number };

/** 报告输出工作台（骨架占位）：生成 Word 报告、查看历史与下载。 */
export default function ReportWorkbench() {
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [regionId, setRegionId] = useState("");
  const [year, setYear] = useState(2025);
  const [history, setHistory] = useState<ReportItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    apiFetch<{ status: string }>("/api/health")
      .then(() => setBackendUp(true))
      .catch(() => setBackendUp(false));
    apiFetch<RegionRow[]>("/api/analysis/regions")
      .then(rows => {
        if (rows.length) {
          setRegions(rows);
          setRegionId(rows[0].region_id);
        }
      })
      .catch(() => {});
    refreshHistory();
  }, []);

  const refreshHistory = () =>
    apiFetch<ReportItem[]>("/api/reports/history")
      .then(setHistory)
      .catch(() => setHistory([]));

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      await apiFetch<{ job_id: string }>("/api/reports/generate", {
        method: "POST",
        body: JSON.stringify({ region_id: regionId, year, qwen_model: "qwen3.6-plus" }),
      });
      refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="workbenchPage">
      <header className="wbTop">
        <div>
          <Link href="/">← 返回监测大屏</Link>
          <h1>报告输出工作台</h1>
          <p>Word 报告生成、版本保留与下载（骨架版，未接 Word 装配器）</p>
        </div>
        <span className={backendUp === null ? "wbState" : backendUp ? "wbState up" : "wbState down"}>
          {backendUp === null ? "检测后端…" : backendUp ? "后端在线" : `后端离线（${API_BASE}）`}
        </span>
      </header>

      <section className="wbControls">
        <label>区域
          <select value={regionId} onChange={e => setRegionId(e.target.value)} disabled={!regions.length}>
            {regions.length === 0 && <option>（请先启动后端）</option>}
            {regions.map(r => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}
          </select>
        </label>
        <label>年度
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}{y === 2024 ? " 实际" : " 模拟"}</option>)}
          </select>
        </label>
        <button className="wbPrimary" onClick={generate} disabled={generating || !regionId}>
          {generating ? "生成中…" : "生成 Word 报告"}
        </button>
      </section>

      {error && <p className="wbError">{error}</p>}

      <section className="wbBody">
        <article className="wbReport">
          <h2>报告历史</h2>
          {history.length === 0 ? (
            <p className="wbMuted">暂无已完成报告。骨架版只登记作业，不产出 docx；接入 Word 装配器后此处会列出正式版本。</p>
          ) : (
            <table className="wbTable">
              <thead><tr><th>作业</th><th>区域</th><th>年度</th><th>下载</th></tr></thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.job_id}>
                    <td>{item.job_id}</td>
                    <td>{item.region_id ?? "-"}</td>
                    <td>{item.year ?? "-"}</td>
                    <td>{item.docx
                      ? <a href={`${API_BASE}/api/reports/${item.job_id}/download`} target="_blank" rel="noreferrer">下载 .docx</a>
                      : "未产出"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </main>
  );
}
