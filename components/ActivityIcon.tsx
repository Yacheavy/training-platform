/** Ícono según el tipo de actividad (bici, pesas u otro). */
export function ActivityIcon({ type, size = 20 }: { type: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (type === "Ride" || type === "VirtualRide") {
    return (
      <svg {...common}>
        <circle cx="5.5" cy="17" r="3.5" />
        <circle cx="18.5" cy="17" r="3.5" />
        <path d="M5.5 17 9 8h5l4.5 9M9 8 12 17M14 8l-1.5-3H10" />
      </svg>
    );
  }
  if (type === "WeightTraining") {
    return (
      <svg {...common}>
        <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
