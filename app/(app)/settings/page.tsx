import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSettingsData, saveTemplateSlot, saveThresholds, addGoal, deleteGoal, saveProfile } from "@/lib/settings-actions";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const STIMULUS_OPTIONS = ["cycling", "gym", "rest"];

export default async function SettingsPage() {
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

      {/* Perfil del atleta */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "16px" }}>Tu perfil</h2>
        <p style={{ fontSize: "11.5px", color: "#5A6673", marginBottom: "16px" }}>
          Esto le da contexto real al chat sobre quién sos — actualizalo cuando sientas que cambió algo, no hace falta que sea diario.
        </p>
        <form action={saveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Potencia en VO2max (W) — mejor esfuerzo de ~5 min o test de rampa</label>
            <input name="pvo2maxWatts" type="number" min={100} max={800} defaultValue={user?.pvo2maxWatts ?? ""} placeholder="Ej: 380 (vacío = el HIIT usa un % de tu FTP)" style={inputStyle} />
            {user?.pvo2maxUpdatedAt && (
              <div style={{ fontSize: "10px", color: "#5A6673", marginTop: "4px" }}>
                Actualizado: {new Date(user.pvo2maxUpdatedAt).toLocaleDateString("es-AR")} — el HIIT usa el 100% de este valor y la recuperación el 50%
              </div>
            )}
          </div>
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
