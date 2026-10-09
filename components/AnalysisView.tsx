import { Fragment } from "react";
import { SECTION_META, type Block, type ParsedAnalysis } from "@/lib/analysis-format";

function inline(text: string, key: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong> : <Fragment key={`${key}-${i}`}>{p}</Fragment>
  );
}

function Blocks({ blocks, k }: { blocks: Block[]; k: string }) {
  const out: React.ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (!items.length) return;
    out.push(
      <ul key={`${k}-ul${out.length}`} className="analysis-list">
        {items.map((t, i) => <li key={i}>{inline(t, `${k}-li${out.length}-${i}`)}</li>)}
      </ul>
    );
    items = [];
  };
  blocks.forEach((b, i) => {
    if (b.type === "li") { items.push(b.text); return; }
    flush();
    out.push(<p key={`${k}-p${i}`} className="analysis-p">{inline(b.text, `${k}-p${i}`)}</p>);
  });
  flush();
  return <>{out}</>;
}

/** Análisis de una sesión en secciones con ícono (chat). El mismo contenido va al mail con lib/email/template. */
export function AnalysisView({ parsed }: { parsed: ParsedAnalysis }) {
  return (
    <div className="analysis">
      {parsed.intro.length > 0 && <Blocks blocks={parsed.intro} k="intro" />}
      {parsed.sections.map((s, i) => {
        const meta = SECTION_META[s.key];
        return (
          <section key={i} className="analysis-sec" style={{ ["--sec" as string]: meta.color }}>
            <h4 className="analysis-h">
              <span className="analysis-ico" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: meta.svg }} />
              </span>
              {s.heading}
            </h4>
            <Blocks blocks={s.blocks} k={`s${i}`} />
          </section>
        );
      })}
      {parsed.sources && <div className="analysis-src">Fuentes: {parsed.sources}</div>}
    </div>
  );
}
