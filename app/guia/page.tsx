import type { Metadata } from "next";
import { APP_NAME, CREATOR } from "@/lib/brand";

export const metadata: Metadata = { title: `Guía · ${APP_NAME}`, description: "Cómo instalar la app, conectar Intervals y armar tu plan de entrenamiento." };

const h2 = { fontSize: "19px", fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 10px" } as const;
const p = { fontSize: "14.5px", color: "var(--text-muted)", lineHeight: 1.65, margin: "0 0 10px" } as const;
const ol = { ...p, paddingLeft: "22px", display: "flex", flexDirection: "column", gap: "7px" } as const;
const card = { background: "var(--grad-card)", border: "1px solid rgba(255,255,255,.06)", borderRadius: "var(--radius)", padding: "22px", marginBottom: "18px" } as const;
const b = { color: "var(--text)" } as const;
const tag = { display: "inline-block", fontSize: "11px", fontWeight: 600, letterSpacing: ".04em", color: "var(--teal)", background: "rgba(79,209,197,.12)", borderRadius: "999px", padding: "3px 10px", marginBottom: "10px" } as const;

export default function GuidePage() {
  return (
    <div className="page-container-narrow" style={{ maxWidth: "720px" }}>
      <a href="/login" style={{ color: "var(--teal)", fontSize: "13px", textDecoration: "none" }}>← Volver</a>
      <h1 style={{ fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", margin: "14px 0 6px" }}>Guía de {APP_NAME}</h1>
      <p style={{ ...p, marginBottom: "22px" }}>Todo lo que necesitás para empezar: instalar la app, conectar tus datos, entender cada pantalla y armar tu plan. Leerla entera lleva unos 5 minutos.</p>

      <section style={card}>
        <span style={tag}>PASO 1</span>
        <h2 style={h2}>Entrar e instalar la app</h2>
        <ol style={ol}>
          <li>Abrí el link que te mandó tu entrenador y tocá <b style={b}>Continuar con Google</b>. Usá la cuenta con la que te invitaron; con otra no vas a poder entrar.</li>
          <li>Leé y aceptá la política de privacidad (qué datos se guardan y para qué).</li>
          <li><b style={b}>iPhone:</b> tiene que ser en Safari. Tocá el botón Compartir (el cuadrado con la flecha) y elegí <b style={b}>Agregar a inicio</b>.</li>
          <li><b style={b}>Android:</b> en Chrome, tocá los tres puntos y elegí <b style={b}>Instalar app</b> (o Agregar a la pantalla principal).</li>
          <li><b style={b}>Computadora:</b> no hace falta instalar nada, entrás desde el navegador.</li>
        </ol>
        <p style={p}>Instalada se abre a pantalla completa, con su ícono, como cualquier otra app. No ocupa casi espacio y se actualiza sola.</p>
      </section>

      <section style={card}>
        <span style={tag}>PASO 2</span>
        <h2 style={h2}>Conectar tu Intervals.icu</h2>
        <p style={p}>La app toma de Intervals tus salidas, tu HRV y tu carga, y le devuelve las sesiones planificadas para que las veas en tu reloj o ciclocomputador. Necesitás una cuenta gratuita en intervals.icu con tu dispositivo ya sincronizado.</p>
        <ol style={ol}>
          <li>Entrá a <a href="https://intervals.icu/settings" target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)" }}>intervals.icu/settings</a> y bajá hasta <b style={b}>Developer Settings</b>.</li>
          <li>Tocá <b style={b}>Generate API Key</b> y copiala.</li>
          <li>Tu <b style={b}>Athlete ID</b> (algo como i12345) aparece en esa misma página.</li>
          <li>En la app, pegá las dos cosas cuando te las pide (o en Ajustes → Conexión con Intervals.icu). La clave se guarda cifrada y solo se usa para leer tus datos y enviar tus sesiones.</li>
        </ol>
        <p style={p}>La primera vez trae tu último año de historia; con eso la app ya sabe cómo venís entrenando.</p>
      </section>

      <section style={card}>
        <span style={tag}>PASO 3</span>
        <h2 style={h2}>Cómo se usa: las cuatro pantallas</h2>
        <ol style={ol}>
          <li><b style={b}>Hoy:</b> cómo estás de recuperación (según tu HRV, frecuencia cardíaca en reposo, sueño y carga), la sesión de hoy y tu semana. Acá aprobás las sesiones y las enviás a Intervals.</li>
          <li><b style={b}>Plan:</b> tu objetivo, la temporada y los días de entrenamiento. Es donde armás y regenerás el plan (más abajo).</li>
          <li><b style={b}>Chat:</b> un asistente que conoce tus datos. Podés pedirle que analice tu última salida, que cambie una sesión o que te explique por qué hoy toca lo que toca. Cita fuentes y marca lo que es criterio práctico y no evidencia.</li>
          <li><b style={b}>Ajustes:</b> tu perfil (peso, FTP), la conexión con Intervals y los mails.</li>
        </ol>
      </section>

      <section style={card}>
        <span style={tag}>PASO 4</span>
        <h2 style={h2}>Cómo armar tu plan</h2>
        <p style={p}>Hacelo en este orden. Son datos que cargás una vez y después sólo ajustás.</p>
        <ol style={ol}>
          <li><b style={b}>Cargá tu FTP.</b> En Ajustes → Rendimiento. Sin el FTP la app no puede generar sesiones. Si no lo sabés, consultalo con tu entrenador. Cargá también tu potencia en VO2max si la tenés.</li>
          <li><b style={b}>Cargá tu objetivo.</b> En Plan → Objetivos: una carrera o evento con fecha, o una meta de rendimiento. Con eso la app sabe hacia dónde ir y cuánto tiempo tiene.</li>
          <li><b style={b}>Revisá la temporada.</b> En Plan → Temporada la app propone los bloques que faltan para llegar a tu objetivo (base, desarrollo, afinación…). Revisalos y tocá <b style={b}>Crear estos bloques</b> si te cierran.</li>
          <li><b style={b}>Elegí tus días.</b> En Plan → Días de entrenamiento marcá qué hacés cada día de la semana, cuáles son de calidad (los de intensidad) y cuánto tiempo tenés. Sé realista: un plan que podés cumplir vale más que uno ambicioso.</li>
          <li><b style={b}>Ajustá el estilo del plan</b> (opcional). Cada cuánto testear el FTP, cuánto descargar, cuánta variedad querés.</li>
          <li><b style={b}>Generá las sesiones.</b> Tocá <b style={b}>Regenerar plan desde hoy</b>. La app arma tus próximas semanas. Cada vez que cambies los días, el FTP o la potencia en VO2max, volvé a tocarlo.</li>
          <li><b style={b}>Aprobá y enviá.</b> En Hoy o en cada sesión, tocá <b style={b}>Aprobar</b> y después <b style={b}>Enviar a Intervals</b>: la sesión aparece en tu calendario de Intervals y se sincroniza con tu dispositivo.</li>
        </ol>
        <p style={p}>El plan <b style={b}>se adapta</b>: si tu recuperación está baja, la app lo tiene en cuenta y puede proponerte cambios en la sesión del día. Podés editar cualquier sesión a mano o pedirle ajustes al chat, y esas ediciones no se pisan al regenerar.</p>
      </section>

      <section style={card}>
        <span style={tag}>DESPUÉS DE CADA SALIDA</span>
        <h2 style={h2}>Los datos que sí o sí valen la pena</h2>
        <ol style={ol}>
          <li>Al abrir la app después de entrenar aparece un cuadro corto. Completá lo que comiste y tomaste, el <b style={b}>RPE</b> (qué tan duro lo sentiste, de 1 a 10) y cómo estuvieron las piernas. Son 20 segundos y mejoran mucho el análisis. El RPE y la sensación también viajan a tu Intervals.</li>
          <li>Te llega por mail el análisis de la salida, con lo que salió bien, lo que conviene mirar y lo que sigue. Podés elegir un resumen sin IA, o desactivarlo, en Ajustes → Mails.</li>
          <li>Respondé el chequeo diario cuando te lo pida (sueño, fatiga, estrés, dolor muscular y ánimo): es lo que le permite cuidarte de entrenar de más.</li>
        </ol>
      </section>

      <section style={card}>
        <h2 style={h2}>Dudas frecuentes</h2>
        <p style={p}><b style={b}>No me deja entrar.</b> Verificá que usás la cuenta de Google con la que te invitaron. Si sigue igual, avisale a tu entrenador.</p>
        <p style={p}><b style={b}>No aparecen mis salidas.</b> Revisá en Ajustes que Intervals figure conectado y que tu dispositivo haya sincronizado con Intervals.icu.</p>
        <p style={p}><b style={b}>¿Es un médico?</b> No. Es una herramienta de planificación deportiva: no da diagnósticos. Si algo te duele o te preocupa, consultá a un profesional.</p>
        <p style={p}><b style={b}>¿Quién ve mis datos?</b> Vos y tu entrenador. Todo el detalle está en la <a href="/privacidad" style={{ color: "var(--teal)" }}>política de privacidad</a>.</p>
      </section>

      <p style={{ ...p, fontSize: "13px", textAlign: "center", marginTop: "10px" }}>
        ¿Algo no funciona o no se entiende? Escribinos a <a href={`mailto:${CREATOR.email}`} style={{ color: "var(--teal)" }}>{CREATOR.email}</a>.
      </p>
    </div>
  );
}
