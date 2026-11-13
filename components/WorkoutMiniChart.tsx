const TYPE_COLORS: Record<string, string> = {
  warmup_z1: "var(--blue-dim)",
  warmup_z2: "var(--teal-dim)",
  warmup_activation: "var(--red-dim)",
  warmup_recovery: "var(--surface-3)",
  warmup_blowout: "#E8A33D",
  interval: "#E5636A",
  recovery: "var(--teal-dim)",
  z2: "#4FD1C5",
  z2_fill: "var(--teal-dim)",
  cooldown_z2: "var(--teal-dim)",
  cooldown_z1: "var(--blue-dim)",
  gym: "#B79BEF",
  flexibility: "#B79BEF",
  test_20min: "#B79BEF",
  test_8min: "#B79BEF",
  test_5min: "#B79BEF",
};

export function WorkoutMiniChart({
  blocks,
}: {
  blocks: { type: string; durationSec: number; targetWatts: number }[];
}) {
  if (!blocks || blocks.length === 0) return null;

  const totalSec = blocks.reduce((s, b) => s + b.durationSec, 0);
  const maxWatts = Math.max(...blocks.map((b) => b.targetWatts), 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", height: "24px", gap: "1px" }}>
      {blocks.map((b, i) => {
        const widthPct = (b.durationSec / totalSec) * 100;
        const heightPct = Math.max(15, (b.targetWatts / maxWatts) * 100);
        return (
          <div
            key={i}
            style={{
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              background: TYPE_COLORS[b.type] ?? "#5A6673",
              borderRadius: "1px",
              minWidth: "1px",
            }}
          />
        );
      })}
    </div>
  );
}