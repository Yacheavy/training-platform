export function CheckinAdjustment({
  workoutLibraryKey,
  rationale,
}: {
  workoutLibraryKey: string | null;
  rationale: string | null;
}) {
  if (!workoutLibraryKey) {
    return (
      <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
        Sin sugerencia generada para hoy todavía.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 600, color: "var(--teal)", marginBottom: "10px" }}>
        {workoutLibraryKey}
      </div>
      <div style={{ fontSize: "11.5px", color: "var(--text-dim)", lineHeight: 1.6 }}>{rationale}</div>
    </div>
  );
}