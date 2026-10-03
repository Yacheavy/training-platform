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

export function HrvRhrChart({ data }: { data: { date: string; hrv: number | null; restingHr: number | null }[] }) {
  const chartData = {
    labels: data.map((d) => new Date(d.date).toLocaleDateString("es-AR", { weekday: "short" })),
    datasets: [
      {
        label: "HRV (ms)",
        data: data.map((d) => d.hrv),
        borderColor: "#4FD1C5",
        pointRadius: 2,
        pointBackgroundColor: "#4FD1C5",
        tension: 0.4,
        borderWidth: 2,
        yAxisID: "y",
      },
      {
        label: "FC reposo (bpm)",
        data: data.map((d) => d.restingHr),
        borderColor: "#E5636A",
        pointRadius: 2,
        pointBackgroundColor: "#E5636A",
        tension: 0.4,
        borderWidth: 2,
        yAxisID: "y1",
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
        labels: { boxWidth: 10, boxHeight: 2, color: "#8A97A6", padding: 12, font: { family: "IBM Plex Mono", size: 10 } },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#5A6673", font: { size: 9 } }, border: { color: "#2A3441" } },
      y: {
        position: "left" as const,
        grid: { color: "#1E2731" },
        ticks: { color: "#5A6673", font: { size: 9 } },
        border: { display: false },
      },
      y1: {
        position: "right" as const,
        grid: { display: false },
        ticks: { color: "#5A6673", font: { size: 9 } },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{ height: "180px" }}>
      <Line data={chartData} options={options} />
    </div>
  );
}