"use client";

import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler);

type P = { date: string; ctl: number | null; atl: number | null; tsb: number | null };

const tick = { color: "#5A6673", font: { size: 10 } };
const tooltip = {
  backgroundColor: "#0B0E13",
  borderColor: "rgba(255,255,255,.1)",
  borderWidth: 1,
  padding: 10,
  boxPadding: 4,
};
const tsbColor = (v: number | null) => (v == null ? "transparent" : v < -25 ? "#E5636A" : v > 5 ? "#4FD1C5" : "#6FA8DC");

/** Carga: arriba fitness (área) y fatiga (línea fina); abajo la forma (TSB) en barras coloreadas por zona. */
export function LoadChart({ data }: { data: P[] }) {
  const labels = data.map((d) => new Date(d.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }));
  const x = { grid: { display: false }, ticks: { ...tick, maxTicksLimit: 8, maxRotation: 0 }, border: { display: false } };

  const lineData = {
    labels,
    datasets: [
      {
        label: "Fitness (CTL)",
        data: data.map((d) => d.ctl),
        borderColor: "#4FD1C5",
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return "transparent";
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, "rgba(79,209,197,.32)");
          g.addColorStop(1, "rgba(79,209,197,0)");
          return g;
        },
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2.25,
      },
      {
        label: "Fatiga (ATL)",
        data: data.map((d) => d.atl),
        borderColor: "#B58CE0",
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 1.25,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (i: { dataset: { label?: string }; parsed: { y: number | null } }) => `${i.dataset.label}: ${i.parsed.y?.toFixed(1)}` } } },
    scales: {
      x: { ...x, ticks: { ...x.ticks, display: false } },
      y: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { ...tick, maxTicksLimit: 4 }, border: { display: false } },
    },
  };

  const barData = {
    labels,
    datasets: [{ label: "Forma (TSB)", data: data.map((d) => d.tsb), backgroundColor: data.map((d) => tsbColor(d.tsb)), borderRadius: 2, borderSkipped: false as const, barPercentage: 0.8, categoryPercentage: 1 }],
  };
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...tooltip, displayColors: false, callbacks: { label: (i: { parsed: { y: number | null } }) => `Forma (TSB): ${i.parsed.y != null && i.parsed.y > 0 ? "+" : ""}${i.parsed.y}` } } },
    scales: {
      x,
      y: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { ...tick, maxTicksLimit: 3 }, border: { display: false } },
    },
  };

  const key = (c: string, t: string, thin?: boolean) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <i style={{ width: 12, height: thin ? 2 : 3, borderRadius: 2, background: c, display: "inline-block" }} />
      {t}
    </span>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "8px" }}>
        {key("#4FD1C5", "Fitness (CTL)")}
        {key("#B58CE0", "Fatiga (ATL)", true)}
      </div>
      <div style={{ height: "170px" }}>
        <Line data={lineData} options={lineOptions} />
      </div>
      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "10px 0 4px", display: "flex", gap: "14px", flexWrap: "wrap" }}>
        <span>Forma (TSB)</span>
        {key("#4FD1C5", "fresco", true)}
        {key("#6FA8DC", "entrenable", true)}
        {key("#E5636A", "muy fatigado", true)}
      </div>
      <div style={{ height: "90px" }}>
        <Bar data={barData} options={barOptions} />
      </div>
    </div>
  );
}
