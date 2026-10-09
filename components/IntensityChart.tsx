"use client";

import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";
import type { WeeklyIntensity } from "@/lib/analytics";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/** Horas por semana en zona baja / media / alta, con el % de zona baja arriba de cada barra en el tooltip. */
export function IntensityChart({ data }: { data: WeeklyIntensity[] }) {
  // Debajo de cada fecha: % del tiempo en zona baja de esa semana
  const labels = data.map((w) => [
    new Date(w.weekStart).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", timeZone: "America/Argentina/Buenos_Aires" }),
    w.totalH > 0 ? `${Math.round((w.lowH / w.totalH) * 100)}%` : "–",
  ]);
  const r = (n: number) => Math.round(n * 10) / 10;
  const chartData = {
    labels,
    datasets: [
      { label: "Baja (Z1–Z2)", data: data.map((w) => r(w.lowH)), backgroundColor: "#3FB8AC", borderRadius: 4, borderSkipped: false, maxBarThickness: 34 },
      { label: "Media (Z3–Z4)", data: data.map((w) => r(w.midH)), backgroundColor: "#E8A33D", borderRadius: 4, borderSkipped: false, maxBarThickness: 34 },
      { label: "Alta (Z5–Z7)", data: data.map((w) => r(w.highH)), backgroundColor: "#E5636A", borderRadius: 4, borderSkipped: false, maxBarThickness: 34 },
    ],
  };
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", align: "end", labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 8, boxHeight: 8, color: "#8A97A6", padding: 14, font: { family: "system-ui, -apple-system, Segoe UI, sans-serif", size: 10 } } },
      tooltip: {
        backgroundColor: "#0B0E13",
        borderColor: "rgba(255,255,255,.1)",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y} h`,
          footer: (items: any[]) => {
            const w = data[items[0].dataIndex];
            return w.totalH > 0 ? `Zona baja: ${Math.round((w.lowH / w.totalH) * 100)}% del tiempo` : "";
          },
        },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: "#5A6673", font: { size: 10 } }, border: { display: false } },
      y: { stacked: true, grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#5A6673", font: { size: 10 }, maxTicksLimit: 5 }, border: { display: false }, title: { display: true, text: "horas", color: "#5A6673", font: { size: 10 } } },
    },
  };
  return (
    <div>
      <div style={{ height: "230px" }}>
        <Bar data={chartData} options={options} />
      </div>
      <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "8px" }}>Debajo de cada fecha: % del tiempo en zona baja.</div>
    </div>
  );
}
