import { auth } from "@/auth";
import { regeneratePlan } from "@/lib/plan-actions";
import { redirect } from "next/navigation";
import { getSettingsData, saveTemplateSlot, saveThresholds, addGoal, deleteGoal, saveProfile, saveMetrics, applyIntervalsValue, refreshMetricsNow } from "@/lib/settings-actions";
import { DURATION_LABEL, type StoredPowerCurve, type StoredSportSettings } from "@/lib/athlete-metrics";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const STIMULUS_OPTIONS = ["cycling", "gym", "rest"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ regenerated?: string; warnings?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { template, goals, thresholds, user } = await getSettingsData(session.user.id);
  const slotByDay = new Map(template.map((t) => [t.dayOfWeek, t]));

  const cardStyle = { background: "#171E27", border: "1px solid #2A3441", borderRadius: "14px", padding: "20px", marginBottom: "20px" };
  const labelStyle = { fontSize: "11px", color: "#8A97A6", textTransform: "uppercase" as const, marginBottom: "6px", display: "block" };
  const inputStyle = { background: "#242F3B", border: "1px solid #2A3441", borderRadius: "7px", color: "#E7ECF2", padding: "7px 9px", fontSize: "13px", width: "100%" };
  const btnStyle = { background: "#4FD1C5", color: "#0A1310", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" };

  return (
    <div className="page-container-narrow" style={{ minHeight: "100vh", background: "#10151C", color: "#E7ECF2", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "24px" }}>Configuración</h1>

      {/* Plan */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "6px" }}>Plan de entrenamiento</h2>
        <p style={{ fontSize: "11.5px", color: "#5A6673", marginBottom: "14px" }}>
          Si cambiaste los días de la plantilla, el FTP o la potencia en VO2max, regenerá las sesiones planificadas para que las usen. Solo se reemplazan las sesiones
          planificadas desde hoy; las del pasado y las que ya aprobaste o enviaste a Intervals no se tocan.
        </p>
        <form action={regeneratePlan}>
          <button type="submit" style={btnStyle}>Regenerar plan desde hoy</button>
        </form>
        {sp.regenerated != null && (
          <div style={{ fontSize: "12px", color: "#4FD1C5", marginTop: "10px" }}>
            Listo: {sp.regenerated} sesiones nuevas.{sp.warnings ? ` ${sp.warnings} advertencia(s) del validador — avisame.` : ""}
          </div>
        )}
      </div>

      {/* Rendimiento: curva de potencia y configuración de deporte (Intervals) */}
      {(() => {
        const curve = user?.powerCurveJson as StoredPowerCurve | null;
        const ss = user?.sportSettingsJson as StoredSportSettings | null;
        const best5 = curve?.points?.find((p) => p.secs === 300)?.watts ?? null;
        const fields = [
          { name: "ftp", label: "FTP (W)", value: user?.ftp, remote: ss?.ftp, unit: "W" },
          { name: "pvo2maxWatts", label: "Potencia en VO2max (W)", value: user?.pvo2maxWatts, remote: best5, unit: "W", remoteLabel: "mejor 5 min (90 d)" },
          { name: "lthr", label: "FC de umbral (lpm)", value: user?.lthr, remote: ss?.lthr, unit: "lpm" },
          { name: "maxHr", label: "FC máxima (lpm)", value: user?.maxHr, remote: ss?.maxHr, unit: "lpm" },
        ];
        return (
          <div style={cardStyle}>
            <h2 style={{ fontSize: "14px", marginBottom: "6px" }}>Rendimiento</h2>
            <p style={{ fontSize: "11.5px", color: "#5A6673", marginBottom: "16px" }}>
              Editá tus valores a mano o copiá los de Intervals. El HIIT usa el 100% de la potencia en VO2max y la recuperación el 50%; sin ese dato usa un % del FTP.
              Cambiar el FTP no regenera un plan ya creado.
            </p>

            <form action={saveMetrics} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "10px" }}>
              {fields.map((f) => (
                <div key={f.name}>
                  <label style={labelStyle}>{f.label}</label>
                  <input name={f.name} type="number" defaultValue={f.value ?? ""} style={inputStyle} />
                  <div style={{ fontSize: "10px", color: "#5A6673", marginTop: "4px" }}>
                    {f.name === "pvo2maxWatts" && user?.pvo2maxUpdatedAt
                      ? `${user.pvo2maxSource === "intervals-5min" ? "Desde Intervals" : "Manual"} · ${new Date(user.pvo2maxUpdatedAt).toLocaleDateString("es-AR")}`
                      : f.name === "ftp" && user?.ftpUpdatedAt
                        ? `Actualizado ${new Date(user.ftpUpdatedAt).toLocaleDateString("es-AR")}`
                        : "\u00A0"}
                  </div>
                </div>
              ))}
              <button type="submit" style={{ ...btnStyle, gridColumn: "1 / -1" }}>Guardar rendimiento</button>
            </form>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "14px 0" }}>
              {fields.map((f) =>
                f.remote != null && f.remote !== f.value ? (
                  <form key={f.name} action={applyIntervalsValue}>
                    <input type="hidden" name="field" value={f.name} />
                    <button type="submit" style={{ ...btnStyle, background: "transparent", color: "#4FD1C5", border: "1px solid #2A3441", fontSize: "12px", padding: "6px 10px" }}>
                      Intervals: {f.remote} {f.unit}{f.remoteLabel ? ` (${f.remoteLabel})` : ""} → usar en {f.label.split(" (")[0]}
                    </button>
                  </form>
                ) : null
              )}
            </div>

            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#8A97A6", marginBottom: "8px" }}>Curva de potencia — mejores esfuerzos, últimos 90 días</div>
            {curve?.points?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {curve.points.map((p) => (
                  <div key={p.secs} style={{ background: "#242F3B", borderRadius: "8px", padding: "8px 12px", minWidth: "78px" }}>
                    <div style={{ fontSize: "10px", color: "#8A97A6" }}>{DURATION_LABEL[p.secs] ?? `${p.secs}s`}</div>
                    <div style={{ fontSize: "16px", fontWeight: 600 }}>{p.watts} W</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: "#8A97A6" }}>
                {curve?.error ? `${curve.error}. Respuesta recibida: ${curve.sample}` : "Todavía no se trajo la curva. Se actualiza sola con la sincronización, o tocá el botón."}
              </div>
            )}
            {ss?.error && (
              <div style={{ fontSize: "11px", color: "#8A97A6", marginTop: "10px" }}>Configuración de deporte: {ss.error}. Respuesta recibida: {ss.sample}</div>
            )}
            <div style={{ fontSize: "10px", color: "#5A6673", marginTop: "10px" }}>
              {user?.powerCurveSyncedAt ? `Última lectura de Intervals: ${new Date(user.powerCurveSyncedAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}` : "Sin lectura de Intervals todavía"}
            </div>
            <form action={refreshMetricsNow} style={{ marginTop: "8px" }}>
              <button type="submit" style={{ ...btnStyle, background: "transparent", color: "#8A97A6", border: "1px solid #2A3441", fontSize: "12px", padding: "6px 10px" }}>
                Leer de Intervals ahora
              </button>
            </form>
          </div>
        );
      })()}

      {/* Perfil del atleta */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "16px" }}>Tu perfil</h2>
        <p style={{ fontSize: "11.5px", color: "#5A6673", marginBottom: "16px" }}>
          Esto le da contexto real al chat sobre quién sos — actualizalo cuando sientas que cambió algo, no hace falta que sea diario.
        </p>
        <form action={saveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Trayectoria / experiencia</label>
            <textarea
              name="trainingBackground"
              defaultValue={user?.trainingBackground ?? ""}
              placeholder="Ej: entreno hace 5 años, volumen típico 8-10h/semana, tuve una lesión de rodilla en 2023..."
              style={{ ...inputStyle, minHeight: "70px", resize: "vertical" as const }}
            />
          </div>
          <div>
            <label style={labelStyle}>Cómo te sentís en este momento</label>
            <textarea
              name="currentStateNote"
              defaultValue={user?.currentStateNote ?? ""}
              placeholder="Ej: vengo de un período de fatiga persistente, me está costando saber cuándo descansar..."
              style={{ ...inputStyle, minHeight: "70px", resize: "vertical" as const }}
            />
            {user?.currentStateUpdatedAt && (
              <div style={{ fontSize: "10px", color: "#5A6673", marginTop: "4px" }}>
                Última actualización: {new Date(user.currentStateUpdatedAt).toLocaleDateString("es-AR")}
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Preferencias / límites</label>
            <textarea
              name="preferences"
              defaultValue={user?.preferences ?? ""}
              placeholder="Ej: prefiero no usar rodillo salvo lluvia, domingos sin sesiones largas..."
              style={{ ...inputStyle, minHeight: "60px", resize: "vertical" as const }}
            />
          </div>
          <button type="submit" style={btnStyle}>Guardar perfil</button>
        </form>
      </div>

      {/* Plantilla semanal */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "16px" }}>Plantilla semanal</h2>
        {DAYS.map((dayName, dayOfWeek) => {
          const slot = slotByDay.get(dayOfWeek);
          return (
             <form action={saveTemplateSlot} key={dayOfWeek} className="form-row-5" style={{ marginBottom: "10px" }}>
              <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
              <div style={{ fontSize: "13px", paddingBottom: "8px" }}>{dayName}</div>
              <div>
                <label style={labelStyle}>Tipo de día</label>
                <select name="stimulusType" defaultValue={slot?.stimulusType ?? "rest"} style={inputStyle}>
                  {STIMULUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Calidad</label>
                <input type="checkbox" name="isQualityDay" defaultChecked={slot?.isQualityDay ?? false} style={{ width: "20px", height: "20px" }} />
              </div>
              <div>
                <label style={labelStyle}>Min</label>
                <input type="number" name="targetDurationMin" defaultValue={slot?.targetDurationMin ?? ""} style={inputStyle} />
              </div>
              <button type="submit" style={{ ...btnStyle, padding: "7px 12px" }}>Guardar</button>
            </form>
          );
        })}
      </div>

            {/* Objetivos */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "16px" }}>Objetivos</h2>
        {goals.map((g) => (
          <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", padding: "10px 0", borderBottom: "1px solid #1E2731" }}>
            <div>
              <span style={{ fontFamily: "monospace", fontSize: "11px", background: "#5C2A2E", color: "#E5636A", padding: "2px 8px", borderRadius: "6px", marginRight: "10px" }}>{g.priority}</span>
              <span style={{ fontFamily: "monospace", fontSize: "10px", background: "#242F3B", color: "#8A97A6", padding: "2px 8px", borderRadius: "6px", marginRight: "10px" }}>
                {g.goalType === "PERFORMANCE" ? "RENDIMIENTO" : "EVENTO"}
              </span>
              {g.goalType === "PERFORMANCE" ? (
                <span>{g.name}: {g.metric} {g.baselineValue ?? "?"} → {g.targetValue ?? "?"}{g.eventDate ? ` (para ${new Date(g.eventDate).toLocaleDateString("es-AR")})` : ""}</span>
              ) : (
                <span>{g.name} — {g.eventDate ? new Date(g.eventDate).toLocaleDateString("es-AR") : "sin fecha"}</span>
              )}
            </div>
            <form action={deleteGoal}>
              <input type="hidden" name="id" value={g.id} />
              <button type="submit" style={{ background: "transparent", color: "#8A97A6", border: "none", cursor: "pointer", fontSize: "12px" }}>eliminar</button>
            </form>
          </div>
        ))}
        <form action={addGoal} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
          <div className="form-row-3">
            <select name="goalType" style={inputStyle}>
              <option value="EVENT">Evento</option>
              <option value="PERFORMANCE">Rendimiento</option>
            </select>
            <input name="name" placeholder="Nombre (ej. 'FTP pre-temporada' o 'Maratón CABA')" style={inputStyle} required />
            <select name="priority" style={inputStyle}>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
          <div className="form-row-4">
            <input name="eventDate" type="date" style={inputStyle} placeholder="Fecha (opcional en rendimiento)" />
            <input name="metric" placeholder="Métrica (ej. FTP, VO2max)" style={inputStyle} />
            <input name="baselineValue" type="number" step="0.1" placeholder="Valor actual" style={inputStyle} />
            <input name="targetValue" type="number" step="0.1" placeholder="Valor objetivo" style={inputStyle} />
          </div>
          <button type="submit" style={{ ...btnStyle, alignSelf: "flex-start" }}>Agregar objetivo</button>
        </form>
      </div>

      {/* Umbrales */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "16px" }}>Umbrales y guardrails</h2>
        <form action={saveThresholds} className="form-row-3b">
          <div>
            <label style={labelStyle}>Ramp rate máx CTL/sem</label>
            <input name="maxCtlRampPerWeek" type="number" step="0.1" defaultValue={thresholds?.maxCtlRampPerWeek ?? 5.0} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Alerta caída HRV %</label>
            <input name="hrvDropAlertPct" type="number" step="0.1" defaultValue={thresholds?.hrvDropAlertPct ?? 7.5} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>TSB mínimo</label>
            <input name="minTsb" type="number" defaultValue={thresholds?.minTsb ?? -25} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Días sueño malo seguidos</label>
            <input name="maxConsecutiveBadSleepDays" type="number" defaultValue={thresholds?.maxConsecutiveBadSleepDays ?? 2} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Semanas entre test FTP</label>
            <input name="weeksBetweenFtpTest" type="number" defaultValue={thresholds?.weeksBetweenFtpTest ?? 5} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Protocolo de test FTP</label>
            <select name="ftpTestProtocol" defaultValue={thresholds?.ftpTestProtocol ?? "20min"} style={inputStyle}>
              <option value="20min">20 minutos (Coggan, x0.95)</option>
              <option value="8min">8 minutos (2 reps)</option>
              <option value="5min">5 minutos (extrapolado de VAM)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Ciclo carga:descarga</label>
            <input name="deloadRatio" defaultValue={thresholds?.deloadRatio ?? "4:1"} style={inputStyle} />
          </div>
          <button type="submit" style={{ ...btnStyle, gridColumn: "1 / -1" }}>Guardar umbrales</button>
        </form>
      </div>
    </div>
  );
}
