"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ATHLETE_TZ } from "@/lib/tz";
import { splitOptions } from "@/lib/chat/parse-response";
import type { ChatUsageSummary } from "@/lib/chat/usage";

const usd = (n: number) => `US$ ${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`.replace(".", ",");

interface Msg {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ChatFocus {
  kind: "workout" | "activity";
  tag: string;
  title: string;
  meta: string;
  href: string;
  linkLabel: string;
  suggestions: { label: string; prompt: string }[];
}

const SUGGESTIONS = [
  "¿Cómo estoy hoy para entrenar?",
  "Explicame la sesión de hoy",
  "Resumime cómo viene mi semana",
  "¿Por qué hay semanas de descarga en mi plan?",
];

/** Negritas **así** dentro de una línea. */
function inline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong> : <Fragment key={`${key}-${i}`}>{p}</Fragment>
  );
}

/** Render mínimo de markdown: títulos, listas, negritas y párrafos. */
function renderContent(content: string) {
  const lines = content.split("\n");
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(
      <Tag key={`l${out.length}`} style={{ margin: "6px 0", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "3px" }}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `li${out.length}-${i}`)}</li>
        ))}
      </Tag>
    );
    list = null;
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      const text = (bullet ?? num)![1];
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push(text);
      return;
    }
    flush();
    if (!line.trim()) return;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) {
      out.push(
        <div key={idx} style={{ fontWeight: 600, margin: "8px 0 2px" }}>
          {inline(h[1], `h${idx}`)}
        </div>
      );
      return;
    }
    out.push(
      <p key={idx} style={{ margin: "0 0 6px" }}>
        {inline(line, `p${idx}`)}
      </p>
    );
  });
  flush();
  return out;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toLocaleDateString("es-AR", { timeZone: ATHLETE_TZ }) === new Date().toLocaleDateString("es-AR", { timeZone: ATHLETE_TZ });
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: ATHLETE_TZ });
  return sameDay ? time : `${d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: ATHLETE_TZ })}, ${time}`;
}

export function ChatView({
  messages,
  workoutId,
  activityId,
  focus,
  action,
  usage,
}: {
  usage?: ChatUsageSummary;
  messages: Msg[];
  workoutId?: string;
  activityId?: string;
  focus?: ChatFocus;
  action: (formData: FormData) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: firstRender.current ? "auto" : "smooth", block: "end" });
    firstRender.current = false;
  }, [messages.length, pending]);

  // El campo crece con el texto (hasta 6 líneas)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  const send = async (formData: FormData) => {
    const value = String(formData.get("message") ?? "").trim();
    if (!value || pending) return;
    setError(null);
    setPending(value);
    setText("");
    try {
      await action(formData);
    } catch {
      setError("No se pudo enviar el mensaje. Probá de nuevo.");
      setText(value);
    } finally {
      setPending(null);
    }
  };

  const empty = messages.length === 0 && !pending;

  // Una sugerencia se envía directo (un toque), con el foco de la sesión incluido
  const sendSuggestion = (s: string) => {
    if (pending) return;
    const fd = new FormData();
    fd.set("message", s);
    if (workoutId) fd.set("focusedWorkoutId", workoutId);
    if (activityId) fd.set("focusedActivityId", activityId);
    void send(fd);
  };

  return (
    <div className="chat-shell">
      <header className="chat-header">
        <div className="chat-mark" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: "17px", fontWeight: 600, margin: 0 }}>Asistente de entrenamiento</h1>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            {workoutId ? (
              "Hablando de una sesión de tu plan"
            ) : activityId ? (
              "Hablando de una sesión que ya hiciste"
            ) : (
              "Conoce tu plan, tu carga y tu recuperación"
            )}
          </div>
        </div>
      </header>

      {usage && (
        <div className="chat-usage" style={{ fontSize: "11.5px", color: "var(--text-muted)", padding: "6px 4px 10px", lineHeight: 1.5 }}>
          {usage.remaining != null && (
            <span style={{ color: usage.remaining <= 5 ? "var(--amber)" : "var(--text-muted)", fontWeight: 600 }}>
              Te quedan {usage.remaining} de {usage.limit} mensajes hoy ·{" "}
            </span>
          )}
          Hoy: {usage.todayTokens.toLocaleString("es-AR")} tokens ≈ {usd(usage.todayCostUsd)} · Este mes: {usd(usage.monthCostUsd)} en {usage.monthMessages} respuestas
          {usage.avgCostPerMessageUsd != null && ` (≈ ${usd(usage.avgCostPerMessageUsd)} por respuesta)`}
          {!usage.isCoach && (
            <div style={{ color: "var(--text-dim)" }}>
              El asistente usa una API de IA que tiene costo. Si querés colaborar con ese gasto, hablalo con tu entrenador.
            </div>
          )}
        </div>
      )}

      {focus && (
        <div className="chat-focus">
          <div className="chat-focus-main">
            <div className="chat-focus-line">
              <span className="chat-focus-tag">✓ {focus.tag}</span>
              <span className="chat-focus-title">{focus.title}</span>
            </div>
            <div className="chat-focus-meta">{focus.meta}</div>
          </div>
          <Link href={focus.href} className="chat-focus-link">
            {focus.linkLabel} →
          </Link>
        </div>
      )}

      <div className="chat-thread">
        {empty && focus && (
          <div className="chat-empty">
            <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>Ya tengo los datos de esta sesión</div>
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
              Escribime lo que quieras saber o tocá una de las opciones de abajo.
            </div>
          </div>
        )}
        {empty && !focus && (
          <div className="chat-empty">
            <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>Preguntame lo que necesites</div>
            <div style={{ fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "16px" }}>
              Puedo explicar tus sesiones, revisar cómo estás o ajustar un entrenamiento.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="btn chip"
                  onClick={() => {
                    setText(s);
                    inputRef.current?.focus();
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const isBot = m.role !== "user";
          const { text: body, options } = isBot ? splitOptions(m.content) : { text: m.content, options: [] as string[] };
          const isLast = i === messages.length - 1;
          return (
            <div key={m.id} className={`msg ${isBot ? "msg-bot" : "msg-user"}`}>
              <div className="bubble">{isBot ? renderContent(body) : <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>}</div>
              {isBot && options.length > 0 && isLast && !pending && (
                <div className="msg-options" role="group" aria-label="Opciones de respuesta">
                  {options.map((o) => (
                    <button key={o} type="button" className="btn chip msg-option" onClick={() => sendSuggestion(o)}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
              <div className="msg-time">{timeLabel(m.createdAt)}</div>
            </div>
          );
        })}

        {pending && (
          <>
            <div className="msg msg-user">
              <div className="bubble">
                <span style={{ whiteSpace: "pre-wrap" }}>{pending}</span>
              </div>
            </div>
            <div className="msg msg-bot" aria-live="polite" aria-label="El asistente está respondiendo">
              <div className="bubble typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {focus && !pending && (
        <div className="chat-chips" role="group" aria-label="Sugerencias">
          {focus.suggestions.map((s) => (
            <button key={s.label} type="button" className="btn chip" onClick={() => sendSuggestion(s.prompt)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-composer"
        onSubmit={(e) => {
          // onSubmit (y no action=): con action, React retiene el estado "pendiente" hasta que termina la respuesta
          e.preventDefault();
          void send(new FormData(e.currentTarget));
        }}
      >
        {workoutId && <input type="hidden" name="focusedWorkoutId" value={workoutId} />}
        {activityId && <input type="hidden" name="focusedActivityId" value={activityId} />}
        {error && <div style={{ fontSize: "12px", color: "var(--red)", marginBottom: "6px" }}>{error}</div>}
        <div className="composer-box">
          <textarea
            ref={inputRef}
            name="message"
            rows={1}
            value={text}
            maxLength={2000}
            placeholder="Escribí tu mensaje"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            aria-label="Mensaje"
          />
          <button type="submit" className="btn send-btn" disabled={!text.trim() || !!pending} aria-label="Enviar mensaje">
            {pending ? (
              <span className="spinner" aria-hidden />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
        <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: "6px", textAlign: "center" }}>
          Enter envía · Shift + Enter agrega una línea
        </div>
      </form>
    </div>
  );
}
