"use client";

import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, type Plugin } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

type Point = { date: string; score: number; status: "GREEN" | "AMBER" | "RED"; hasCheckin: boolean };
const COLOR = { GREEN: "#4FD1C5", AMBER: "#E8A33D", RED: "#E5636A" } as const;
const LABEL = { GREEN: "Alta", AMBER: "Moderada", RED: "Baja" } as const;

// Bandas de zona muy tenues detrás de la línea (0–49, 50–74, 75–100)
const zones: Plugin<"line"> = {
  id: "availZones",
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea: a, scales } = chart;
    const y = scales.y;
    const band = (from: number, to: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(a.left, y.getPixelForValue(to), a.right - a.left, y.getPixelForValue(from) - y.getPixelForValue(to));
    };
    band(0, 50, "rgba(229,99,106,.05)");
    band(50, 75, "rgba(232,163,61,.05)");
    band(75, 100, "rgba(79,209,197,.05)");
  },
};

export function AvailabilityHistoryChart({ data }: { data: Point[] }) {
  const chartData = {
    labels: data.map((d) => new Date(d.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })),
    datasets: [
      {
        label: "Disponibilidad",
        data: data.map((d) => d.score),
        borderColor: "rgba(231,236,242,.55)",
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return "transparent";
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, "rgba(79,209,197,.18)");
          g.addColorStop(1, "rgba(79,209,197,0)");
          return g;
        },
        fill: true,
        tension: 0.3,
        borderWidth: 1.5,
        pointRadius: data.map((d) => (d.hasCheckin ? 4 : 3)),
        pointHoverRadius: 6,
        pointBackgroundColor: data.map((d) => (d.hasCheckin ? COLOR[d.status] : "#10151C")),
        pointBorderColor: data.map((d) => COLOR[d.status]),
        pointBorderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0B0E13",
        borderColor: "rgba(255,255,255,.1)",
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          title: (items: { dataIndex: number }[]) => items[0] ? new Date(data[items[0].dataIndex].date).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "",
          label: (item: { dataIndex: number }) => {
            const d = data[item.dataIndex];
            return `${d.score} · ${LABEL[d.status]}${d.hasCheckin ? " · con check-in" : " · sin check-in"}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#5A6673", font: { size: 10 }, maxTicksLimit: 7, maxRotation: 0 }, border: { display: false } },
      y: { min: 0, max: 100, grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#5A6673", font: { size: 10 }, stepSize: 25 }, border: { display: false } },
    },
  };

  return (
    <div>
      <div style={{ height: "170px" }}>
        <Line data={chartData} options={options} plugins={[zones]} />
      </div>
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: "11.5px", color: "var(--text-muted)", marginTop: "10px" }}>
        {(["GREEN", "AMBER", "RED"] as const).map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <i style={{ width: 8, height: 8, borderRadius: "50%", background: COLOR[s], display: "inline-block" }} />
            {LABEL[s]}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <i style={{ width: 8, height: 8, borderRadius: "50%", border: "2px solid var(--text-muted)", display: "inline-block" }} />
          Sin check-in
        </span>
      </div>
    </div>
  );
}
