"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

export function AvailabilityHistoryChart({ data }: { data: { date: string; score: number }[] }) {
  const chartData = {
    labels: data.map((d) => new Date(d.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })),
    datasets: [
      {
        label: "Disponibilidad",
        data: data.map((d) => d.score),
        borderColor: "#4FD1C5",
        backgroundColor: "rgba(79,209,197,.06)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#5A6673", font: { size: 9 }, maxTicksLimit: 8 }, border: { color: "#2A3441" } },
      y: {
        min: 0,
        max: 100,
        grid: { color: "#1E2731" },
        ticks: { color: "#5A6673", font: { size: 9 } },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{ height: "140px" }}>
      <Line data={chartData} options={options} />
    </div>
  );
}