"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export function LoadChart({ data }: { data: { date: string; ctl: number | null; atl: number | null; tsb: number | null }[] }) {
  const chartData = {
    labels: data.map((d) => new Date(d.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })),
    datasets: [
      {
        label: "CTL",
        data: data.map((d) => d.ctl),
        borderColor: "#4FD1C5",
        backgroundColor: "rgba(79,209,197,.08)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: "ATL",
        data: data.map((d) => d.atl),
        borderColor: "#E8A33D",
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: "TSB",
        data: data.map((d) => d.tsb),
        borderColor: "#6FA8DC",
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 1.5,
        borderDash: [4, 3],
      },
    ],
  };

   const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        position: "top" as const,
        align: "end" as const,
        labels: { boxWidth: 10, boxHeight: 2, color: "#8A97A6", padding: 14, font: { family: "system-ui, -apple-system, Segoe UI, sans-serif", size: 10.5 } },
      },
    },
    scales: {
      x: { grid: { color: "#1E2731" }, ticks: { color: "#5A6673", font: { size: 9 } }, border: { color: "#2A3441" } },
      y: { grid: { color: "#1E2731" }, ticks: { color: "#5A6673", font: { size: 9 } }, border: { color: "#2A3441" } },
    },
  };

  return (
    <div style={{ height: "220px" }}>
      <Line data={chartData} options={options} />
    </div>
  );
}