"use client";

import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";
import type { WeeklyIntensity } from "@/lib/analytics";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/** Horas por semana en zona baja / media / alta, con el % de zona baja arriba de cada barra en el tooltip. */
export function IntensityChart({ data }: { data: WeeklyIntensity[] }) {
  const labels = data.map((w) => new Date(w.weekStart).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", timeZone: "America/Argentina/Buenos_Aires" }));
  const r = (n: number) => Math.round(n * 10) / 10;
  const chartData = {
    labels,
    datasets: [
      { label: "Baja (Z1–Z2)", data: data.map((w) => r(w.lowH)), backgroundColor: "#2A8C82", borderRadius: 3 },
      { label: "Media (Z3–Z4)", data: data.map((w) => r(w.midH)), backgroundColor: "#E8A33D", borderRadius: 3 },
      { label: "Alta (Z5–Z7)", data: data.map((w) => r(w.highH)), backgroundColor: "#E5636A", borderRadius: 3 },
    ],
  };
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", align: "end", labels: { boxWidth: 10, boxHeight: 8, color: "#8A97A6", padding: 12, font: { family: "IBM Plex Mono", size: 10 } } },
      tooltip: {
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
      x: { stacked: true, grid: { display: false }, ticks: { color: "#5A6673", font: { size: 9 } }, border: { color: "#2A3441" } },
      y: { stacked: true, grid: { color: "#1E2731" }, ticks: { color: "#5A6673", font: { size: 9 } }, border: { display: false }, title: { display: true, text: "horas", color: "#5A6673", font: { size: 9 } } },
    },
  };
  return (
    <div style={{ height: "220px" }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
