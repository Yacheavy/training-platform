"use client";

import { useState } from "react";
import { FEEL_LABELS, RPE_LABELS } from "@/lib/ratings";

/** Elige RPE (1–10) y sensación (1–5). Va dentro de un <form>: manda los valores en campos ocultos `rpe` y `feel`. */
export function RatingFields({ rpe: rpe0, feel: feel0, onTouch }: { rpe?: number | null; feel?: number | null; onTouch?: () => void }) {
  const [rpe, setRpe] = useState<number | null>(rpe0 ?? null);
  const [feel, setFeel] = useState<number | null>(feel0 ?? null);
  return (
    <div className="rate-wrap">
      <input type="hidden" name="rpe" value={rpe ?? ""} />
      <input type="hidden" name="feel" value={feel ?? ""} />

      <div className="rate-block">
        <div className="rate-title">
          <span>Esfuerzo percibido (RPE)</span>
          <span className="rate-value">{rpe != null ? `${rpe} · ${RPE_LABELS[rpe]}` : "Tocá un número"}</span>
        </div>
        <div className="rpe-row" role="radiogroup" aria-label="Esfuerzo percibido de 1 a 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rpe === n}
              className={`rpe-btn${rpe === n ? " on" : ""}`}
              style={{ ["--lvl" as string]: String(n / 10) }}
              onClick={() => { setRpe(rpe === n ? null : n); onTouch?.(); }}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="rate-ends"><span>Muy fácil</span><span>Máximo</span></div>
      </div>

      <div className="rate-block">
        <div className="rate-title">
          <span>Cómo te sentiste</span>
          <span className="rate-value">{feel != null ? FEEL_LABELS[feel] : ""}</span>
        </div>
        <div className="feel-row" role="radiogroup" aria-label="Sensación">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={feel === n}
              className={`feel-btn${feel === n ? " on" : ""}`}
              onClick={() => { setFeel(feel === n ? null : n); onTouch?.(); }}
            >
              {FEEL_LABELS[n]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
