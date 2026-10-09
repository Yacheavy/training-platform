"use client";

import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";
import type { WeekPlanVsActual } from "@/lib/analytics";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/** TSS planificado (barra tenue) contra TSS realizado (barra sólida) por semana. */
export function PlanVsActualChart({ data }: { data: WeekPlanVsActual[] }) {
  const labels = data.map((w) => new Date(w.weekStart).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", timeZone: "America/Argentina/Buenos_Aires" }));
  const chartData = {
    labels,
    datasets: [
      { label: "Planificado", data: data.map((w) => w.plannedTss || null), backgroundColor: "rgba(138,151,166,.28)", borderColor: "#5A6673", borderWidth: 1, borderRadius: 4, borderSkipped: false, maxBarThickness: 34 },
      { label: "Realizado", data: data.map((w) => w.actualTss || null), backgroundColor: "#4FD1C5", borderRadius: 4, borderSkipped: false, maxBarThickness: 34 },
    ],
  };
  const fmtH = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", align: "end", labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 8, boxHeight: 8, color: "#8A97A6", padding: 12, font: { family: "system-ui, -apple-system, Segoe UI, sans-serif", size: 10 } } },
      tooltip: {
        backgroundColor: "#0B0E13", borderColor: "rgba(255,255,255,.1)", borderWidth: 1, padding: 10, 
        callbacks: {
          label: (ctx: any) => {
            const w = data[ctx.dataIndex];
            return ctx.datasetIndex === 0 ? `Planificado: ${w.plannedTss} TSS · ${fmtH(w.plannedMin)}` : `Realizado: ${w.actualTss} TSS · ${fmtH(w.actualMin)}`;
          },
          footer: (items: any[]) => {
            const w = data[items[0].dataIndex];
            return w.compliancePct != null ? `Cumplimiento: ${w.compliancePct}%${w.isCurrent ? " (hasta hoy)" : ""}` : "";
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#5A6673", font: { size: 10 } }, border: { display: false } },
      y: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#5A6673", font: { size: 10 } }, border: { display: false }, title: { display: true, text: "TSS semanal", color: "#5A6673", font: { size: 10 } } },
    },
  };
  return (
    <div style={{ height: "220px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
