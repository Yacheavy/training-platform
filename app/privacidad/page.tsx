import type { Metadata } from "next";
import { APP_NAME, CREATOR, CONSENT_VERSION } from "@/lib/brand";

export const metadata: Metadata = { title: `Privacidad · ${APP_NAME}` };

const h2 = { fontSize: "17px", fontWeight: 600, letterSpacing: "-0.01em", margin: "28px 0 8px" } as const;
const p = { fontSize: "14.5px", color: "var(--text-muted)", lineHeight: 1.65, margin: "0 0 10px" } as const;
const ul = { ...p, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px" } as const;

export default function PrivacyPage() {
  return (
    <div className="page-container-narrow" style={{ maxWidth: "720px" }}>
      <a href="/login" style={{ color: "var(--teal)", fontSize: "13px", textDecoration: "none" }}>← Volver</a>
      <h1 style={{ fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", margin: "14px 0 6px" }}>Política de privacidad</h1>
      <p style={{ ...p, fontSize: "12.5px", color: "var(--text-dim)" }}>{APP_NAME} · versión {CONSENT_VERSION}</p>

      <h2 style={h2}>Quién es el responsable</h2>
      <p style={p}>
        {CREATOR.name}, {CREATOR.role.toLowerCase()}. Contacto: <a href={`mailto:${CREATOR.email}`} style={{ color: "var(--teal)" }}>{CREATOR.email}</a> o WhatsApp{" "}
        <a href={CREATOR.whatsappLink} style={{ color: "var(--teal)" }}>{CREATOR.whatsapp}</a>.
      </p>

      <h2 style={h2}>Qué datos se guardan</h2>
      <ul style={ul}>
        <li>Tu cuenta: nombre y email de Google, con los que ingresás.</li>
        <li>Datos de entrenamiento que traemos de tu cuenta de Intervals.icu: salidas, potencia, frecuencia cardíaca, carga.</li>
        <li>Datos de recuperación: HRV, frecuencia cardíaca en reposo, sueño.</li>
        <li>El email con el que tu entrenador te invita, para enviarte la invitación.</li>
        <li>Tu email también se usa para enviarte el análisis de tus salidas, que podés desactivar en Ajustes.</li>
        <li>Lo que cargás vos: perfil (peso, FTP, objetivos, preferencias), check-ins diarios, nutrición de las salidas y tus mensajes con el asistente.</li>
        <li>Tu clave de Intervals, guardada cifrada. Solo se usa para traer tus datos y enviar tus sesiones.</li>
      </ul>

      <h2 style={h2}>Para qué se usan</h2>
      <p style={p}>
        Para calcular cómo estás cada día, armar y ajustar tu plan de entrenamiento y acompañarte. No se venden, no se usan para publicidad y no se comparten con terceros con fines comerciales.
      </p>

      <h2 style={h2}>Quién puede verlos</h2>
      <ul style={ul}>
        <li>Vos, en tu cuenta.</li>
        <li>Tu entrenador, que ve tus datos para acompañarte.</li>
        <li>
          Proveedores que hacen funcionar la app: Vercel (alojamiento), Neon (base de datos), Google (inicio de sesión y envío de los mails), Intervals.icu (origen de tus datos), Open-Meteo (clima de tus salidas) y Anthropic (el asistente de chat).
          A Anthropic se le envían tus datos de entrenamiento y tus mensajes para generar la respuesta, sin tu nombre ni tu email.
          A Open-Meteo solo se le envía la ubicación aproximada del inicio de la salida y la fecha, para estimar el clima; esa ubicación no se guarda en la app.
        </li>
      </ul>

      <h2 style={h2}>Tus derechos</h2>
      <p style={p}>
        Podés pedir en cualquier momento ver, corregir o borrar tus datos, o desconectar Intervals desde Ajustes. Escribí al contacto de arriba. La Agencia de Acceso a la Información Pública es el organismo que atiende reclamos por la Ley 25.326 de protección de datos personales de Argentina.
      </p>

      <h2 style={h2}>Cuánto tiempo se guardan</h2>
      <p style={p}>Mientras uses la app. Si pedís que se borren, se eliminan tu cuenta y tus datos.</p>

      <h2 style={h2}>Lo que esta app no es</h2>
      <p style={p}>
        Es una herramienta de planificación deportiva. No da diagnósticos ni reemplaza a un médico. Si algo no te cae bien o sentís un síntoma, consultá a un profesional de la salud.
      </p>
    </div>
  );
}
