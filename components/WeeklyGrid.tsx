const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  cycling: { bg: "#2A5C56", text: "#4FD1C5", label: "Bici" },
  gym: { bg: "#2A3350", text: "#6FA8DC", label: "Gym" },
  flexibility: { bg: "#2F2A45", text: "#B79BEF", label: "Flex" },
  rest: { bg: "#242F3B", text: "#5A6673", label: "Descanso" },
};

export function WeeklyGrid({
  slots,
}: {
  slots: { dayOfWeek: number; stimulusType: string; isQualityDay: boolean; targetDurationMin: number | null }[];
}) {
  const today = new Date().getDay();
  const slotByDay = new Map(slots.map((s) => [s.dayOfWeek, s]));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "6px" }}>
      {DAY_NAMES.map((name, dayOfWeek) => {
        const slot = slotByDay.get(dayOfWeek);
        const colors = TYPE_COLORS[slot?.stimulusType ?? "rest"];
        const isToday = dayOfWeek === today;

        return (
          <div
            key={dayOfWeek}
            style={{
              border: `1px solid ${isToday ? "var(--teal)" : "var(--border)"}`,
              background: isToday ? "rgba(79,209,197,.05)" : "transparent",
              borderRadius: "10px",
              padding: "10px 8px",
              minHeight: "70px",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase" }}>
              {name}
            </div>
            {slot && slot.stimulusType !== "rest" ? (
              <div style={{ marginTop: "6px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "3px 6px",
                    borderRadius: "5px",
                    background: colors.bg,
                    color: colors.text,
                    fontWeight: 500,
                  }}
                >
                  {colors.label}
                  {slot.isQualityDay ? " ★" : ""}
                </span>
                {slot.targetDurationMin && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--text-dim)", marginTop: "4px" }}>
                    {slot.targetDurationMin}min
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "8px" }}>—</div>
            )}
          </div>
        );
      })}
    </div>
  );
}