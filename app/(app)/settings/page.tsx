import { TemplateEditor } from "@/components/TemplateEditor";
import { GoalsCard } from "@/components/GoalsCard";
import { ThresholdsCard } from "@/components/ThresholdsCard";
import { dateKeyLocal } from "@/lib/tz";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { auth } from "@/auth";
import { regeneratePlan } from "@/lib/plan-actions";
import { getAccessData, inviteAthlete, removeInvite, connectIntervals, disconnectIntervals, syncFullHistory } from "@/lib/access-actions";
import { redirect } from "next/navigation";
import { getSettingsData, saveTemplate, saveThresholds, addGoal, deleteGoal, saveProfile, saveMetrics, applyIntervalsValue, refreshMetricsNow } from "@/lib/settings-actions";
import { DURATION_LABEL, type StoredPowerCurve, type StoredSportSettings } from "@/lib/athlete-metrics";


export const maxDuration = 60;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ regenerated?: string; warnings?: string; invite?: string; intervals?: string; history?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { template, goals, thresholds, user } = await getSettingsData(session.user.id);
  const access = await getAccessData(session.user.id);
  
  const cardStyle = { background: "#171E27", border: "1px solid #2A3441", borderRadius: "14px", padding: "20px", marginBottom: "20px" };
  const labelStyle = { fontSize: "11px", color: "#8A97A6", textTransform: "uppercase" as const, marginBottom: "6px", display: "block" };
  const inputStyle = { background: "#242F3B", border: "1px solid #2A3441", borderRadius: "7px", color: "#E7ECF2", padding: "7px 9px", fontSize: "13px", width: "100%" };
  const btnStyle = { background: "#4FD1C5", color: "#0A1310", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" };

  return (
    <div className="page-container-narrow" style={{ minHeight: "100vh", background: "#10151C", color: "#E7ECF2", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "24px" }}>Configuración</h1>

      {/* Conexión con Intervals (cada persona usa su propia cuenta) */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "6px" }}>Conexión con Intervals.icu</h2>
        <p style={{ fontSize: "11.5px", color: "#5A6673", marginBottom: "14px" }}>
          En Intervals: Settings → Developer Settings → API Key. Pegá tu Athlete ID (por ejemplo i12345) y la clave. Se guardan cifradas y solo se usan para traer tus datos y enviar tus sesiones.
        </p>
        {access.intervals.connected || access.intervals.usingLegacyEnv ? (
          <div style={{ fontSize: "12.5px", marginBottom: "12px" }}>
            <span style={{ color: "#4FD1C5" }}>✓ Conectado</span>
            {access.intervals.athleteId ? ` (${access.intervals.athleteId})` : " (configuración del servidor)"}
            {access.intervals.lastSyncAt ? ` · última sincronización: ${new Date(access.intervals.lastSyncAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}` : ""}
          </div>
        ) : (
          <div style={{ fontSize: "12.5px", color: "#E8A33D", marginBottom: "12px" }}>Todavía no conectaste Intervals: no vas a ver tus actividades ni tu HRV.</div>
        )}
        <ActionForm action={connectIntervals} success={null} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Athlete ID</label>
            <input name="athleteId" placeholder="i12345" autoComplete="off" style={inputStyle} required />
          </div>
          <div>
            <label style={labelStyle}>API key</label>
            <input name="apiKey" type="password" autoComplete="off" placeholder="••••••••" style={inputStyle} required />
          </div>
          <SubmitButton style={{ ...btnStyle, gridColumn: "1 / -1" }}>{access.intervals.connected ? "Reemplazar clave" : "Conectar"}</SubmitButton>
        </ActionForm>
        {sp.intervals === "ok" && <div style={{ fontSize: "12px", color: "#4FD1C5", marginTop: "10px" }}>Conectado. Ya trajimos el último año; si querés más historial, usá el botón de abajo.</div>}
        {sp.intervals === "invalid" && <div style={{ fontSize: "12px", color: "#E5636A", marginTop: "10px" }}>Revisá el Athlete ID (ej. i12345) y la clave.</div>}
        {sp.intervals === "rejected" && <div style={{ fontSize: "12px", color: "#E5636A", marginTop: "10px" }}>Intervals rechazó esas credenciales. Verificá que sean las tuyas.</div>}
        {sp.history != null && <div style={{ fontSize: "12px", color: "#4FD1C5", marginTop: "10px" }}>Historial sincronizado: {sp.history} actividades.</div>}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
          {(access.intervals.connected || access.intervals.usingLegacyEnv) && (
            <ActionForm action={syncFullHistory} success={null}>
              <SubmitButton style={{ ...btnStyle, background: "transparent", color: "#8A97A6", border: "1px solid #2A3441", fontSize: "12px", padding: "6px 10px" }}>Traer historial completo (hasta 5 años)</SubmitButton>
            </ActionForm>
          )}
          {access.intervals.connected && (
            <ActionForm action={disconnectIntervals} success="Intervals desconectado">
              <SubmitButton style={{ ...btnStyle, background: "transparent", color: "#E5636A", border: "1px solid #2A3441", fontSize: "12px", padding: "6px 10px" }}>Desconectar</SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>

      {/* Alumnos (solo entrenador) */}
      {access.isCoach && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: "14px", marginBottom: "6px" }}>Alumnos</h2>
          <p style={{ fontSize: "11.5px", color: "#5A6673", marginBottom: "14px" }}>
            Solo pueden entrar las cuentas de Google cuyo email figure acá. Cada alumno ve únicamente sus propios datos y conecta su propio Intervals.
          </p>
          <ActionForm action={inviteAthlete} success={null} style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
            <input name="email" type="email" placeholder="email@gmail.com" style={{ ...inputStyle, flex: "1 1 220px", width: "auto" }} required />
            <SubmitButton style={btnStyle}>Invitar</SubmitButton>
          </ActionForm>
          {sp.invite === "ok" && <div style={{ fontSize: "12px", color: "#4FD1C5", marginBottom: "10px" }}>Invitación guardada. Avisale que entre con esa cuenta de Google.</div>}
          {sp.invite === "invalid" && <div style={{ fontSize: "12px", color: "#E5636A", marginBottom: "10px" }}>Ese email no es válido.</div>}
          {access.invites.map((i) => (
            <div key={i.email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "8px 0", borderTop: "1px solid #2A3441", fontSize: "13px" }}>
              <div>
                {i.email}
                <span style={{ color: "#5A6673", fontSize: "11px", marginLeft: "8px" }}>{i.joined ? `ingresó${i.name ? ` · ${i.name}` : ""}` : "pendiente de ingresar"}</span>
              </div>
              {i.isCoach ? (
                <span style={{ color: "#5A6673", fontSize: "11px" }}>Entrenador</span>
              ) : (
                <ActionForm action={removeInvite} success="Invitación eliminada">
                  <input type="hidden" name="email" value={i.email} />
                  <SubmitButton style={{ background: "transparent", border: "1px solid #2A3441", color: "#E5636A", borderRadius: "6px", padding: "3px 9px", fontSize: "11px", cursor: "pointer" }}>Quitar</SubmitButton>
                </ActionForm>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Plan */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "6px" }}>Plan de entrenamiento</h2>
        <p style={{ fontSize: "11.5px", color: "#5A6673", marginBottom: "14px" }}>
          Si cambiaste los días de la plantilla, el FTP o la potencia en VO2max, regenerá las sesiones planificadas para que las usen. Solo se reemplazan las sesiones
          planificadas desde hoy; las del pasado y las que ya aprobaste o enviaste a Intervals no se tocan.
        </p>
        <ActionForm action={regeneratePlan} success={null}>
          <SubmitButton style={btnStyle}>Regenerar plan desde hoy</SubmitButton>
        </ActionForm>
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

            <ActionForm action={saveMetrics} success="Rendimiento guardado" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "10px" }}>
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
              <SubmitButton style={{ ...btnStyle, gridColumn: "1 / -1" }}>Guardar rendimiento</SubmitButton>
            </ActionForm>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "14px 0" }}>
              {fields.map((f) =>
                f.remote != null && f.remote !== f.value ? (
                  <ActionForm key={f.name} action={applyIntervalsValue} success="Valor aplicado">
                    <input type="hidden" name="field" value={f.name} />
                    <SubmitButton style={{ ...btnStyle, background: "transparent", color: f.value != null && f.remote < f.value ? "#E8A33D" : "#4FD1C5", border: f.value != null && f.remote < f.value ? "1px solid #E8A33D" : "1px solid #2A3441", fontSize: "12px", padding: "6px 10px" }}>
                      {f.value != null && f.remote < f.value ? "⚠ Menor que tu valor actual · " : ""}Intervals: {f.remote} {f.unit}{f.remoteLabel ? ` (${f.remoteLabel})` : ""} → usar en {f.label.split(" (")[0]}
                    </SubmitButton>
                  </ActionForm>
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
            <ActionForm action={refreshMetricsNow} success="Datos de Intervals actualizados" style={{ marginTop: "8px" }}>
              <SubmitButton style={{ ...btnStyle, background: "transparent", color: "#8A97A6", border: "1px solid #2A3441", fontSize: "12px", padding: "6px 10px" }}>
                Leer de Intervals ahora
              </SubmitButton>
            </ActionForm>
          </div>
        );
      })()}

      {/* Perfil del atleta */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "16px" }}>Tu perfil</h2>
        <p style={{ fontSize: "11.5px", color: "#5A6673", marginBottom: "16px" }}>
          Esto le da contexto real al chat sobre quién sos — actualizalo cuando sientas que cambió algo, no hace falta que sea diario.
        </p>
        <ActionForm action={saveProfile} success="Perfil guardado" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
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
          <SubmitButton style={btnStyle}>Guardar perfil</SubmitButton>
        </ActionForm>
      </div>

      {/* Plantilla semanal */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", marginBottom: "6px" }}>Días de entrenamiento</h2>
        <p style={{ fontSize: "11.5px", color: "#5A6673", marginBottom: "14px" }}>
          Elegí qué hacés cada día, cuáles son de calidad (intensidad) y cuánto duran. Se guarda todo junto con un solo botón; después regenerá el plan para aplicarlo.
        </p>
        <TemplateEditor slots={template.map((t) => ({ dayOfWeek: t.dayOfWeek, stimulusType: t.stimulusType, isQualityDay: t.isQualityDay, targetDurationMin: t.targetDurationMin }))} action={saveTemplate} />
      </div>

      <GoalsCard
        goals={goals.map((g) => ({
          id: g.id,
          goalType: g.goalType as "EVENT" | "PERFORMANCE",
          name: g.name,
          eventDate: g.eventDate ? g.eventDate.toISOString().slice(0, 10) : null,
          priority: g.priority as "A" | "B" | "C",
          metric: g.metric,
          baselineValue: g.baselineValue,
          targetValue: g.targetValue,
        }))}
        todayKey={dateKeyLocal(new Date())}
        currentFtp={user?.ftp ?? null}
        addAction={addGoal}
        deleteAction={deleteGoal}
        cardStyle={cardStyle}
      />

      <ThresholdsCard
        thresholds={thresholds ? { minTsb: thresholds.minTsb, hrvDropAlertPct: thresholds.hrvDropAlertPct, weeksBetweenFtpTest: thresholds.weeksBetweenFtpTest, ftpTestProtocol: thresholds.ftpTestProtocol ?? undefined, deloadRatio: thresholds.deloadRatio } : null}
        action={saveThresholds}
        cardStyle={cardStyle}
      />
    </div>
  );
}
