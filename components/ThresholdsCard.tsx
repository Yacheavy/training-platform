import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { VARIANTS, EVIDENCE_LABELS, FAMILY_LABELS, FAMILY_ORDER, BANNABLE_KEYS } from "@/lib/training-engine/variants";

interface Thresholds {
  minTsb: number;
  hrvDropAlertPct: number;
  weeksBetweenFtpTest: number;
  ftpTestProtocol: string;
  deloadRatio: string;
  vo2Stimulus?: string | null;
  varietyLevel?: string | null;
  bannedStimuli?: string[] | null;
  periodization?: string | null;
}

function Field({ label, hint, why, unit, children }: { label: string; hint: string; why?: string; unit?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className={`control${unit ? " has-unit" : ""}`}>
        {children}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="hint">{hint}</div>
      {why && (
        <details className="hint" style={{ marginTop: "4px" }}>
          <summary style={{ cursor: "pointer", color: "var(--teal)" }}>¿Por qué?</summary>
          <div style={{ marginTop: "4px" }}>{why}</div>
        </details>
      )}
    </div>
  );
}

export function RecoveryRulesCard({
  thresholds,
  action,
  cardStyle,
}: {
  thresholds: Partial<Thresholds> | null;
  action: (formData: FormData) => Promise<unknown>;
  cardStyle: React.CSSProperties;
}) {
  const t = thresholds ?? {};
  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 4px" }}>Alertas de recuperación</h2>
      <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "0 0 20px" }}>
        Con estos valores la app decide cuándo recomendar descanso. Los valores sugeridos funcionan bien para empezar.
      </p>

      <ActionForm action={action} success="Alertas guardadas">
        <div className="group">
          <h3 className="group-title">Cuándo avisar que estás cansado</h3>
          <p className="group-desc">Si se cumplen estas señales, la disponibilidad del día pasa a ámbar o rojo y se sugiere bajar la intensidad.</p>
          <div className="field-grid">
            <Field
              label="Fatiga máxima aceptable (TSB)"
              unit="TSB"
              hint="Tu forma es CTL menos ATL. Por debajo de este valor se marca fatiga alta. Entre −10 y −30 es normal en semanas de carga; sugerido: −30."
            >
              <input name="minTsb" type="number" step="1" min={-60} max={0} defaultValue={t.minTsb ?? -30} />
            </Field>
            <Field
              label="Caída de HRV que enciende la alerta"
              unit="%"
              hint="Solo se usa mientras tengas menos de 4 semanas de datos de HRV. Después la app compara contra tu propia variabilidad. Sugerido: 7,5."
            >
              <input name="hrvDropAlertPct" type="number" step="0.5" min={1} max={50} defaultValue={t.hrvDropAlertPct ?? 7.5} />
            </Field>
          </div>
        </div>

        <div style={{ marginTop: "22px" }}>
          <SubmitButton
            pendingText="Guardando…"
            style={{ background: "var(--teal)", color: "#08201C", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600 }}
          >
            Guardar alertas
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}


/** Estilo del plan: cómo se arman las semanas (test de FTP, descarga, VO2max, variedad, periodización). */
export function PlanStyleCard({
  thresholds,
  action,
  cardStyle,
  activeObjective,
}: {
  thresholds: Partial<Thresholds> | null;
  activeObjective?: string | null;
  action: (formData: FormData) => Promise<unknown>;
  cardStyle: React.CSSProperties;
}) {
  const t = thresholds ?? {};
  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 4px" }}>Estilo del plan</h2>
      <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "0 0 20px" }}>
        Cómo se arman las semanas: cuándo se testea el FTP, cada cuánto se descarga, qué VO2max se hace y cuánta variedad hay. Después de guardar, regenerá el plan para aplicarlo.
      </p>

      <ActionForm action={action} success="Estilo guardado. Regenerá el plan para aplicar los cambios.">
        <input type="hidden" name="_planner" value="1" />
        <div className="group">
          <h3 className="group-title">Test de FTP</h3>
          <p className="group-desc">El test se programa la primera semana después de una descarga, cuando llegás descansado.</p>
          <div className="field-grid">
            <Field label="Cada cuántas semanas" unit="semanas" hint="Con 0 no se programan tests. Sugerido: 5 a 8 semanas.">
              <input name="weeksBetweenFtpTest" type="number" step="1" min={0} max={26} defaultValue={t.weeksBetweenFtpTest ?? 5} />
            </Field>
            <Field label="Protocolo" hint="El de 20 minutos es el más usado. El de 5 minutos estima el FTP a partir de tu potencia aeróbica máxima.">
              <select name="ftpTestProtocol" defaultValue={t.ftpTestProtocol ?? "20min"}>
                <option value="20min">20 minutos (FTP = 95% del promedio)</option>
                <option value="8min">8 minutos, dos intentos</option>
                <option value="5min">5 minutos (estimado)</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="group">
          <h3 className="group-title">Semanas de carga y de descarga</h3>
          <p className="group-desc">Cada cuánto el plan baja el volumen para que absorbas el entrenamiento. En la descarga se mantiene una sesión intensa corta.</p>
          <div className="field-grid">
            <Field
              label="Periodización"
              hint="Lineal (sugerido): 1 sesión de VO2max por semana. Por bloques: en los bloques de VO2max, la primera semana de cada mesociclo lleva 2 sesiones y el resto 1."
              why="Es una adaptación propia inspirada en Rønnestad 2014, que usó 5 sesiones en una semana en ciclistas bien entrenados. Un metaanálisis de 6 estudios (107 personas) mostró efectos pequeños a favor de los bloques, con estudios chicos y de baja calidad metodológica; una revisión en ciclistas no halló preponderancia de un modelo de periodización."
            >
              <select name="periodization" defaultValue={t.periodization ?? "linear"}>
                <option value="linear">Lineal — sugerido</option>
                <option value="block">Por bloques (semana intensificada de VO2max)</option>
              </select>
            </Field>
            <Field label="Ciclo" hint="Más semanas de carga suben el volumen acumulado; si venís muy cargado o tenés más de 45 años, elegí ciclos más cortos.">
              <select name="deloadRatio" defaultValue={t.deloadRatio ?? "4:1"}>
                <option value="2:1">2 de carga, 1 de descarga</option>
                <option value="3:1">3 de carga, 1 de descarga</option>
                <option value="4:1">4 de carga, 1 de descarga</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="group">
          <h3 className="group-title">Estímulo de VO2max</h3>
          <p className="group-desc">
            {activeObjective === "vo2max"
              ? "Tu bloque activo es de VO2max: se hace UNA sesión intensa por semana. Elegí cuál; el segundo día de calidad es un rodaje Z2 con sprints."
              :`Se aplica cuando el bloque activo es de VO2max${activeObjective ? ` (el actual es «${activeObjective}», así que por ahora no cambia nada)` : ""}.`}
          </p>
          <div className="field-grid">
            <Field label="Sesión de VO2max" hint="Qué sesión de VO2max se hace cada semana. «Rotar» alterna tres variantes."
              why="HIIT genuino: libro de López Chicharro 2018. Rønnestad 30/15 tiene ensayos en ciclistas entrenados y progresa por series. VO2max largo 5′ y alternar son criterio de práctica.">
              <select name="vo2Stimulus" defaultValue={t.vo2Stimulus ?? (t.varietyLevel === "conservative" ? "hiit_genuino" : "rotate")}>
                <option value="rotate">Rotar: HIIT genuino / Rønnestad 30/15 / VO2max largo 5′</option>
                <option value="hiit_genuino">Solo HIIT genuino 7×3′ al 100% PAM</option>
                <option value="ronnestad_30_15">Solo Rønnestad 30/15 (3×13 de 30″/15″)</option>
                <option value="alternate">Alternar semanas: HIIT genuino / Rønnestad</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="group">
          <h3 className="group-title">Variedad de sesiones</h3>
          <p className="group-desc">
            El plan rota entre variantes de cada familia (base, umbral, VO2max, neuromuscular, fuerza en bici) respetando tu objetivo, la separación entre sesiones duras y las semanas de descarga. Cada variante muestra cuánta evidencia tiene: varias son práctica de entrenadores, no ensayos.
          </p>
          <div className="field-grid">
            <Field label="Nivel de variedad" hint="Conservador: casi solo las sesiones clásicas del objetivo. Equilibrado (sugerido): rotación moderada. Variado: más variantes y más seguido.">
              <select name="varietyLevel" defaultValue={t.varietyLevel ?? "balanced"}>
                <option value="conservative">Conservador</option>
                <option value="balanced">Equilibrado — sugerido</option>
                <option value="varied">Variado</option>
              </select>
            </Field>
          </div>
          <details style={{ marginTop: "12px" }}>
            <summary style={{ cursor: "pointer", fontSize: "13px", color: "var(--teal)" }}>Vetar variantes que no querés que aparezcan</summary>
            <div style={{ marginTop: "10px" }}>
              {FAMILY_ORDER.map((fam) => {
                const items = BANNABLE_KEYS.map((k) => VARIANTS[k]).filter((v) => v.family === fam);
                if (!items.length) return null;
                return (
                  <div key={fam} style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "6px" }}>{FAMILY_LABELS[fam]}</div>
                    {items.map((v) => (
                      <label key={v.key} style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "12.5px", marginBottom: "6px", cursor: "pointer" }}>
                        <input type="checkbox" name="banned" value={v.key} defaultChecked={(t.bannedStimuli ?? []).includes(v.key)} style={{ marginTop: "3px" }} />
                        <span>
                          <b>{v.label}</b> <span style={{ color: "var(--text-dim)" }}>· {EVIDENCE_LABELS[v.evidence]}</span>
                          <span style={{ display: "block", color: "var(--text-muted)" }}>{v.purpose}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </details>
        </div>

        <div style={{ marginTop: "22px" }}>
          <SubmitButton
            pendingText="Guardando…"
            style={{ background: "var(--teal)", color: "#08201C", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600 }}
          >
            Guardar estilo del plan
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

