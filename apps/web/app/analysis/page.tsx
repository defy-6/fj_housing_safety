"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, API_BASE } from "@/lib/api";

type ModelInfo = { label: string; configured: boolean };
type RegionRow = { region_id: string; region_name: string };

const YEARS = [2024, 2025, 2026];

/** 智能分析工作台（骨架占位）：选择区域/年度/模型，调用后端生成分析正文。 */
export default function AnalysisWorkbench() {
  const [models, setModels] = useState<Record<string, ModelInfo> | null>(null);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [regionId, setRegionId] = useState("");
  const [year, setYear] = useState(2025);
  const [modelKey, setModelKey] = useState("qwen3.6-plus");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ job_id: string; content: { title: string; sections: { heading: string; paragraphs: string[] }[] } } | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Record<string, ModelInfo>>("/api/analysis/models").catch(() => null),
      apiFetch<RegionRow[]>("/api/regions").catch(() => []),
    ]).then(([modelData, regionData]) => {
      if (modelData) {
        setModels(modelData);
        const first = Object.keys(modelData)[0];
        if (first) setModelKey(first);
      }
      if (regionData.length) {
        setRegions(regionData);
        setRegionId(regionData[0].region_id);
      }
    });
  }, []);

  useEffect(() => {
    apiFetch<{ status: string }>("/api/health")
      .then(() => setBackendUp(true))
      .catch(() => setBackendUp(false));
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError("");
    try {
      const data = await apiFetch<{ job_id: string; content: { title: string; sections: { heading: string; paragraphs: string[] }[] } }>(
        "/api/analysis/generate",
        { method: "POST", body: JSON.stringify({ region_id: regionId, year, qwen_model: modelKey }) },
        370_000,
      );
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [regionId, year, modelKey]);

  return (
    <main className="workbenchPage">
      <header className="wbTop">
        <div>
          <Link href="/">← 返回监测大屏</Link>
          <h1>智能分析工作台</h1>
          <p>区域画像 + LLM 生成房屋安全分析正文（骨架版，后端未接真实 LLM）</p>
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
            {YEARS.map(y => <option key={y} value={y}>{y}{y === 2024 ? " 实际" : " 模拟"}</option>)}
          </select>
        </label>
        <label>模型
          <select value={modelKey} onChange={e => setModelKey(e.target.value)} disabled={!models}>
            {models && Object.entries(models).map(([key, m]) => (
              <option key={key} value={key}>{m.label}{m.configured ? "" : "（未配置密钥）"}</option>
            ))}
          </select>
        </label>
        <button className="wbPrimary" onClick={generate} disabled={generating || !regionId}>
          {generating ? "生成中（最长 6 分钟）…" : "生成分析"}
        </button>
      </section>

      {error && <p className="wbError">{error}</p>}

      <section className="wbBody">
        {result ? (
          <article className="wbReport">
            <h2>{result.content.title}</h2>
            {result.content.sections.map(s => (
              <section key={s.heading}>
                <h3>{s.heading}</h3>
                {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              </section>
            ))}
            <footer>job_id：{result.job_id} · 保存审核稿、单段重写、报告输出将在接入真实 LLM 后启用</footer>
          </article>
        ) : (
          <div className="wbEmpty">
            <b>分析正文将显示在此处</b>
            <p>选择区域、年度与模型后点击「生成分析」。当前为骨架管线，只输出占位正文。</p>
          </div>
        )}
      </section>
    </main>
  );
}
