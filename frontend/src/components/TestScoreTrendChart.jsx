import { useEffect, useMemo, useState } from "react";
import { api, loadSession } from "../lib/api";

const W = 340;
const H = 200;
const PAD = { l: 38, r: 12, t: 12, b: 28 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;
const TICKS = [0, 25, 50, 75, 100];

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const f1 = (v) => v.toFixed(1);

function userIdFromToken() {
  try {
    const token = loadSession()?.access;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.user_id ?? null;
  } catch {
    return null;
  }
}

export default function TestScoreTrendChart() {
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hover, setHover] = useState(null);
  const [diag, setDiag] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .listMarks()
      .then((data) => {
        if (!alive) return;
        const all = asList(data);
        const uid = userIdFromToken();
        const mine = uid ? all.filter((m) => String(m.student) === String(uid)) : all;
        setMarks(mine);
        setDiag({ total: all.length, mine: mine.length, uid, ids: [...new Set(all.map((m) => m.student))].slice(0, 6) });
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const exams = useMemo(() => {
    const byExam = new Map();
    for (const m of marks) {
      const key = m.exam;
      if (!byExam.has(key)) {
        byExam.set(key, {
          id: key,
          name: m.exam_name ?? `Exam ${key}`,
          date: m.exam_date ?? "",
          obtained: 0,
          total: 0,
        });
      }
      const e = byExam.get(key);
      e.obtained += Number(m.obtained_marks);
      e.total += Number(m.total_marks);
    }
    return [...byExam.values()]
      .map((e) => ({ ...e, percent: e.total > 0 ? (e.obtained / e.total) * 100 : null }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [marks]);

  const n = exams.length;
  const xAt = (i) => PAD.l + (n <= 1 ? PLOT_W / 2 : (PLOT_W * i) / (n - 1));
  const yAt = (p) => PAD.t + PLOT_H * (1 - p / 100);

  const pts = exams
    .map((e, i) => ({ i, e, x: xAt(i), y: e.percent === null ? null : yAt(e.percent) }))
    .filter((p) => p.y !== null);

  const line = pts
    .map((p, k) => (k === 0 ? "M" + f1(p.x) + "," + f1(p.y) : "L" + f1(p.x) + "," + f1(p.y)))
    .join(" ");

  const latest = exams[exams.length - 1];
  const hovered = hover !== null ? exams[hover] : null;

  return (
    <div className="tsc">
      <style>{css}</style>
      <div className="tsc-top">
        <div>
          <div className="tsc-big">
            {latest && latest.percent !== null ? latest.percent.toFixed(1) + "%" : "—"}
          </div>
          <div className="tsc-cap">{latest ? latest.name : "No results published yet"}</div>
        </div>
      </div>

      {error && <p className="tsc-err">{error}</p>}
      {diag && diag.mine === 0 && (
        <p className="tsc-err">
          Debug: API returned {diag.total} marks, {diag.mine} match your id ({String(diag.uid)}).
          {diag.total > 0 && " Marks belong to student ids: " + diag.ids.join(", ")}
        </p>
      )}

      {n > 0 ? (
        <div className="tsc-chart" onMouseLeave={() => setHover(null)}>
          <svg viewBox={"0 0 " + W + " " + H} className="tsc-svg" role="img" aria-label="Test score trend">
            {TICKS.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={yAt(t)}
                  y2={yAt(t)}
                  className={t === 0 ? "tsc-axis" : "tsc-grid"}
                />
                <text x={PAD.l - 6} y={yAt(t) + 3} textAnchor="end" className="tsc-tick">
                  {t}%
                </text>
              </g>
            ))}
            <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={yAt(0)} className="tsc-axis" />

            {exams.map((e, i) => (
              <text key={e.id} x={xAt(i)} y={H - 8} textAnchor="middle" className="tsc-tick">
                {e.name.length > 8 ? e.name.slice(0, 8) + "…" : e.name}
              </text>
            ))}

            {pts.length > 1 && <path d={line} className="tsc-line" />}
            {pts.map((p) => (
              <circle
                key={p.e.id}
                cx={p.x}
                cy={p.y}
                r={p.i === n - 1 ? 4.5 : 3}
                className="tsc-dot"
                onMouseEnter={() => setHover(p.i)}
              />
            ))}
          </svg>

          {hovered && (
            <div
              className="tsc-tip"
              style={{ left: Math.min(84, Math.max(16, (xAt(hover) / W) * 100)) + "%" }}
            >
              <strong>{hovered.name}</strong>
              <span>
                {hovered.percent !== null
                  ? hovered.percent.toFixed(1) + "% (" + hovered.obtained + "/" + hovered.total + ")"
                  : "No marks"}
              </span>
            </div>
          )}
        </div>
      ) : (
        !loading && !error && <p className="tsc-empty">No results published yet.</p>
      )}
    </div>
  );
}

const css = `
.tsc { width: 100%; }
.tsc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.tsc-big { font-size: 2rem; font-weight: 800; line-height: 1.1; color: #0f1c2e; }
.tsc-cap { margin-top: 2px; font-size: .8rem; color: #5d6b7a; }
.tsc-chart { position: relative; margin-top: 8px; }
.tsc-svg { display: block; width: 100%; height: auto; }
.tsc-grid { stroke: #e6ecf1; stroke-width: 1; stroke-dasharray: 3 3; }
.tsc-axis { stroke: #c4ccd6; stroke-width: 1; }
.tsc-tick { font-size: 9px; fill: #7a8797; }
.tsc-line { fill: none; stroke: #7c3aed; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.tsc-dot { fill: #fff; stroke: #7c3aed; stroke-width: 2; cursor: pointer; }
.tsc-tip { position: absolute; top: 0; z-index: 2; display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; font-size: .75rem; color: #0f1c2e; background: #fff; border: 1px solid #d9dfe6; border-radius: 8px; box-shadow: 0 6px 18px rgba(16,24,40,.12); transform: translateX(-50%); pointer-events: none; white-space: nowrap; }
.tsc-tip span { color: #5d6b7a; }
.tsc-empty { padding: 24px 0; text-align: center; font-size: .85rem; color: #5d6b7a; }
.tsc-err { margin: 8px 0 0; font-size: .85rem; color: #b3261e; }
`;