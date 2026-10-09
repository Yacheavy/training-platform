"use client";

import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface Props {
  points: { date: string; hrv: number | null; restingHr: number | null; roll7: number | null }[];
  band: { low: number; high: number; mean: number; days: number } | null;
}

/** HRV diario + media móvil de 7 días sobre la banda de tu línea base (±0,5 DE de 60 días); FC de reposo en el eje derecho. */
export function HrvRhrChart({ points, band }: Props) {
  const labels = points.map((p) => new Date(p.date).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", timeZone: "UTC" }));
  const bandData = (v: number | undefined) => points.map(() => (v != null ? Math.round(v * 10) / 10 : null));

  const datasets: any[] = [];
  if (band) {
    datasets.push(
      { label: "Banda alta", data: bandData(band.high), borderWidth: 0, pointRadius: 0, fill: false, yAxisID: "y", order: 5 },
      { label: "Tu rango habitual", data: bandData(band.low), borderWidth: 0, pointRadius: 0, fill: "-1", backgroundColor: "rgba(79,209,197,.12)", yAxisID: "y", order: 5 }
    );
  }
  datasets.push(
    {
      label: "HRV",
      data: points.map((p) => p.hrv),
      borderColor: "rgba(79,209,197,.55)",
      pointBackgroundColor: "#4FD1C5",
      pointRadius: 2,
      borderWidth: 1.25,
      tension: 0.25,
      spanGaps: true,
      yAxisID: "y",
      order: 3,
    },
    {
      label: "HRV media 7 días",
      data: points.map((p) => (p.roll7 != null ? Math.round(p.roll7 * 10) / 10 : null)),
      borderColor: "#4FD1C5",
      pointRadius: 0,
      borderWidth: 3,
      tension: 0.35,
      spanGaps: true,
      yAxisID: "y",
      order: 2,
    },
    {
      label: "FC reposo",
      data: points.map((p) => p.restingHr),
      borderColor: "#E5636A",
      pointBackgroundColor: "#E5636A",
      pointRadius: 2,
      borderWidth: 1.5,
      borderDash: [4, 3],
      tension: 0.25,
      spanGaps: true,
      yAxisID: "y1",
      order: 4,
    }
  );

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: {
          usePointStyle: true,
          pointStyle: "line",
          boxWidth: 14,
          boxHeight: 3,
          color: "#8A97A6",
          padding: 12,
          font: { family: "system-ui, -apple-system, Segoe UI, sans-serif", size: 10 },
          filter: (item: { text: string }) => item.text !== "Banda alta",
        },
      },
      tooltip: { backgroundColor: "#0B0E13", borderColor: "rgba(255,255,255,.1)", borderWidth: 1, padding: 10, filter: (item: { dataset: { label?: string } }) => item.dataset.label !== "Banda alta" && item.dataset.label !== "Tu rango habitual" },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#5A6673", font: { size: 10 }, maxTicksLimit: 8 }, border: { display: false } },
      y: { position: "left", grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#5A6673", font: { size: 10 } }, border: { display: false }, title: { display: true, text: "HRV (ms)", color: "#5A6673", font: { size: 10 } } },
      y1: { position: "right", grid: { display: false }, ticks: { color: "#5A6673", font: { size: 10 } }, border: { display: false }, title: { display: true, text: "FC reposo (lpm)", color: "#5A6673", font: { size: 10 } } },
    },
  };

  return (
    <div style={{ height: "230px" }}>
      <Line data={{ labels, datasets }} options={options} />
    </div>
  );
}
