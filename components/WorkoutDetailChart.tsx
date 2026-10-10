const TYPE_COLORS: Record<string, string> = {
  warmup_z1: "#3A4A7A",
  warmup_z2: "#2A8C80",
  warmup_activation: "#B24A52",
  warmup_recovery: "#4A5A6B",
  warmup_blowout: "#E8A33D",
  interval: "#E5636A",
  recovery: "#2A8C80",
  z2: "#4FD1C5",
  z2_fill: "#2A8C80",
  cooldown_z2: "#2A8C80",
  cooldown_z1: "#3A4A7A",
  gym: "#B79BEF",
  flexibility: "#B79BEF",
  test_20min: "#B79BEF",
  test_8min: "#B79BEF",
  test_5min: "#B79BEF",
};

export function WorkoutDetailChart({
  blocks,
  ftp,
}: {
  blocks: { type: string; durationSec: number; targetWatts: number }[];
  ftp: number | null;
}) {
  if (!blocks?.length) return null;
  const totalSec = blocks.reduce((s, b) => s + b.durationSec, 0);
  const maxWatts = Math.max(...blocks.map((b) => b.targetWatts), ftp ?? 0, 1) * 1.08;
  const ftpPct = ftp ? (ftp / maxWatts) * 100 : null;

  return (
    <div style={{ position: "relative", height: "170px", display: "flex", alignItems: "flex-end", gap: "1px", borderBottom: "1px solid var(--border)" }}>
      {ftpPct != null && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: `${ftpPct}%`, borderTop: "1px dashed var(--text-dim)", opacity: 0.6, pointerEvents: "none" }}>
          <span style={{ position: "absolute", right: 0, top: "-15px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-dim)" }}>FTP {ftp} W</span>
        </div>
      )}
      {blocks.map((b, i) => (
        <div
          key={i}
          title={`${Math.round(b.durationSec / 60 * 10) / 10} min · ${b.targetWatts} W`}
          style={{
            width: `${(b.durationSec / totalSec) * 100}%`,
            height: `${Math.max(4, (b.targetWatts / maxWatts) * 100)}%`,
            background: TYPE_COLORS[b.type] ?? "#5A6673",
            borderRadius: "2px 2px 0 0",
            minWidth: "1px",
          }}
        />
      ))}
    </div>
  );
}
