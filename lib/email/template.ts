import { APP_NAME, CREATOR } from "@/lib/brand";
import { appUrl } from "./mailer";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b style="color:#E7ECF2">$1</b>');

/** Convierte el texto del análisis (párrafos separados por línea en blanco, **negrita**, línea "Fuentes:") en HTML de mail. */
export function bodyToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => {
      const t = para.trim();
      if (/^fuentes?:/i.test(t)) return `<p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#8A97A6">${inline(t)}</p>`;
      return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#C5CED8">${inline(t).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

/** Estructura común de los mails: logo, contenido, botón y pie. Tablas y estilos en línea para que funcione en cualquier cliente de mail. */
export function layoutEmail(o: { title: string; subtitle?: string; bodyHtml: string; ctaLabel?: string; ctaPath?: string }): string {
  const base = appUrl();
  const cta = o.ctaLabel && o.ctaPath
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 4px"><tr><td style="border-radius:12px;background:#4FD1C5"><a href="${base}${o.ctaPath}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#08201C;text-decoration:none">${esc(o.ctaLabel)}</a></td></tr></table>`
    : "";
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#0B0E13">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0E13"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#171E27;border-radius:20px;border:1px solid #2A3441;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center" style="padding:28px 28px 6px">
${base ? `<img src="${base}/brand/mark-email.png" width="84" height="84" alt="" style="display:block;border-radius:18px">` : ""}
<div style="margin-top:12px;font-size:22px;font-weight:800;font-style:italic;letter-spacing:-0.01em;color:#E7ECF2;text-transform:uppercase">Overkill</div>
<div style="margin-top:4px;font-size:10px;font-weight:600;letter-spacing:5px;color:#4FD1C5;text-transform:uppercase">Cycling</div>
</td></tr>
<tr><td style="padding:22px 28px 6px">
<h1 style="margin:0 0 4px;font-size:20px;line-height:1.3;color:#E7ECF2;font-weight:600">${esc(o.title)}</h1>
${o.subtitle ? `<div style="margin:0 0 18px;font-size:13px;color:#8A97A6">${esc(o.subtitle)}</div>` : '<div style="height:14px"></div>'}
${o.bodyHtml}
${cta}
</td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid #2A3441;font-size:11.5px;line-height:1.6;color:#5A6673">
Este análisis lo genera una IA con tus datos de entrenamiento. Es una guía deportiva: no reemplaza a un médico ni da diagnósticos.<br>
${APP_NAME} · creada por ${esc(CREATOR.name)}.<br>
${base ? `<a href="${base}/settings" style="color:#8A97A6">Dejar de recibir estos mails (Ajustes)</a> · <a href="${base}/privacidad" style="color:#8A97A6">Privacidad</a>` : ""}
</td></tr>
</table></td></tr></table></body></html>`;
}
