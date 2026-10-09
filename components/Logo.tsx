/** Isologo (aro + rayo) y marca de Overkill Cycling. El SVG vive en /public/brand/mark.svg. */
export function LogoMark({ size = 56 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/mark.svg" width={size} height={size} alt="" style={{ display: "block" }} />;
}

export function Wordmark({ size = 34, center = true }: { size?: number; center?: boolean }) {
  return (
    <div style={{ textAlign: center ? "center" : "left", lineHeight: 1 }}>
      <div
        style={{
          fontSize: `${size}px`,
          fontWeight: 800,
          fontStyle: "italic",
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          background: "linear-gradient(180deg, #FFFFFF 15%, #BFC9D3 50%, #4FD1C5 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: "drop-shadow(0 0 14px rgba(79,209,197,.35))",
        }}
      >
        Overkill
      </div>
      <div style={{ fontSize: `${Math.max(10, size * 0.3)}px`, fontWeight: 600, letterSpacing: "0.5em", textTransform: "uppercase", color: "var(--teal)", marginTop: "6px", paddingLeft: center ? "0.5em" : 0 }}>
        Cycling
      </div>
    </div>
  );
}
