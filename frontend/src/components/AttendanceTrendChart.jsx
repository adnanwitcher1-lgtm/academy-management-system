import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const W = 340;
const H = 200;
const PAD = { l: 38, r: 12, t: 12, b: 28 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;
const TICKS = [0, 25, 50, 75, 100];
const RANGES = [7, 14, 30];
const LOW = 75;

const f1 = (v) => v.toFixed(1);
const monthDay = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// Cartesian attendance graph: % attended (0 to 100) against the last few days.
export default function AttendanceTrendChart({ refreshKey = 0 }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hover, setHover] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .attendanceTrend(days)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days, refreshKey]);

  const list = data?.days ?? [];
  const n = list.length;
  const xAt = (i) => PAD.l + (n <= 1 ? PLOT_W / 2 : (PLOT_W * i) / (n - 1));
  const yAt = (p) => PAD.t + PLOT_H * (1 - p / 100);
  const colW = n <= 1 ? PLOT_W : PLOT_W / (n - 1);

  const pts = list
    .map((d, i) => ({ i, d, x: xAt(i), y: d.percent === null ? null : yAt(d.percent) }))
    .filter((p) => p.y !== null);

  const line = pts
    .map((p, k) => {
      if (k === 0) return "M" + f1(p.x) + "," + f1(p.y);
      const q = pts[k - 1];
      const mx = (q.x + p.x) / 2;
      return "C" + f1(mx) + "," + f1(q.y) + " " + f1(mx) + "," + f1(p.y) + " " + f1(p.x) + "," + f1(p.y);
    })
    .join(" ");
  const area =
    pts.length > 1
      ? line + " L" + f1(pts[pts.length - 1].x) + "," + f1(yAt(0)) + " L" + f1(pts[0].x) + "," + f1(yAt(0)) + " Z"
      : "";

  const step = n <= 8 ? 1 : Math.ceil(n / 7);
  const xLabel = (d) => (n <= 8 ? d.weekday : String(Number(d.date.slice(8))));

  const stats = useMemo(() => {
    let attended = 0;
    let total = 0;
    for (const d of list) {
      attended += d.present + d.late;
      total += d.total;
    }
    return { average: total ? Math.round((attended * 100) / total) : null, any: total > 0 };
  }, [list]);

  const todayRow = n ? list[n - 1] : null;
  const hovered = hover !== null ? list[hover] : null;
  const tipLeft = hover !== null ? Math.min(84, Math.max(16, (xAt(hover) / W) * 100)) : 50;

  const summaryLabel = todayRow && todayRow.total
    ? "Attendance today " + todayRow.percent + " percent"
    : "Attendance not marked today";

  return (
    <div className="atc">
      <style>{css}</style>

      <div className="atc-top">
        <div>
          <div className="atc-big">{todayRow && todayRow.percent !== null ? todayRow.percent + "%" : "-"}</div>
          <div className="atc-cap">
            {todayRow && todayRow.total
              ? todayRow.present + todayRow.late + " of " + todayRow.total + " students attended today"
              : "Not marked yet today"}
          </div>
        </div>
        <div className="atc-range" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={days === r}
              onClick={() => {
                setHover(null);
                setDays(r);
              }}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="atc-err" role="alert">
          {error}
        </p>
      )}

      <div className="atc-chart" onMouseLeave={() => setHover(null)}>
        <svg viewBox={"0 0 " + W + " " + H} className="atc-svg" role="img" aria-label={summaryLabel}>
          <defs>
            <linearGradient id="atcFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
          </defs>

          {TICKS.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yAt(t)} y2={yAt(t)} className={t === 0 ? "atc-axis" : t === LOW ? "atc-threshold" : "atc-grid"} />
              <text x={PAD.l - 6} y={yAt(t) + 3} textAnchor="end" className="atc-tick">
                {t}%
              </text>
            </g>
          ))}
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={yAt(0)} className="atc-axis" />

          {list.map((d, i) =>
            (n - 1 - i) % step === 0 ? (
              <text key={d.date} x={xAt(i)} y={H - 8} textAnchor="middle" className="atc-tick">
                {xLabel(d)}
              </text>
            ) : null
          )}

          {hover !== null && <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.t} y2={yAt(0)} className="atc-cursor" />}
          {area && <path d={area} fill="url(#atcFill)" />}
          {pts.length > 1 && <path d={line} className="atc-line" />}
          {pts.map((p) => (
            <circle
              key={p.d.date}
              cx={p.x}
              cy={p.y}
              r={p.i === n - 1 ? 4.5 : 3}
              className={p.d.percent < LOW ? "atc-dot atc-dot-low" : "atc-dot"}
            />
          ))}
          {list.map((d, i) => (
            <rect
              key={d.date}
              x={xAt(i) - colW / 2}
              y={PAD.t}
              width={colW}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {hovered && (
          <div className="atc-tip" style={{ left: tipLeft + "%" }}>
            <strong>
              {hovered.weekday}, {monthDay(hovered.date)}
            </strong>
            {hovered.total ? (
              <>
                <span>{hovered.percent}% attended</span>
                <span>
                  Present {hovered.present} &middot; Absent {hovered.absent}
                </span>
                <span>
                  Late {hovered.late} &middot; Leave {hovered.leave}
                </span>
              </>
            ) : (
              <span>Not marked</span>
            )}
          </div>
        )}

        {!loading && !error && !stats.any && <div className="atc-empty">No attendance marked in this period.</div>}
      </div>

      <div className="atc-foot">
        {todayRow && todayRow.total > 0 && (
          <>
            <span className="atc-chip atc-c-present">Present {todayRow.present}</span>
            <span className="atc-chip atc-c-absent">Absent {todayRow.absent}</span>
            <span className="atc-chip atc-c-late">Late {todayRow.late}</span>
            <span className="atc-chip atc-c-leave">Leave {todayRow.leave}</span>
          </>
        )}
        {stats.average !== null && (
          <span className="atc-avg">
            {days}-day average {stats.average}%
          </span>
        )}
      </div>
    </div>
  );
}

const css = `
.atc { width: 100%; }
.atc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.atc-big { font-size: 2rem; font-weight: 800; line-height: 1.1; color: #0f1c2e; }
.atc-cap { margin-top: 2px; font-size: .8rem; color: #5d6b7a; }
.atc-range { display: inline-flex; overflow: hidden; border: 1px solid #d9dfe6; border-radius: 8px; }
.atc-range button { padding: 4px 10px; font: inherit; font-size: .75rem; font-weight: 600; color: #5d6b7a; background: #fff; border: 0; cursor: pointer; }
.atc-range button + button { border-left: 1px solid #d9dfe6; }
.atc-range button[aria-pressed="true"] { color: #0e7490; background: #e0f7fb; }
.atc-range button:focus-visible { outline: 2px solid #0e7490; outline-offset: -2px; }
.atc-chart { position: relative; margin-top: 8px; }
.atc-svg { display: block; width: 100%; height: auto; }
.atc-grid { stroke: #e6ecf1; stroke-width: 1; stroke-dasharray: 3 3; }
.atc-threshold { stroke: #dc2626; stroke-width: 1.25; stroke-dasharray: 5 3; }
.atc-axis { stroke: #c4ccd6; stroke-width: 1; }
.atc-tick { font-size: 9px; fill: #7a8797; }
.atc-line { fill: none; stroke: #0ea5c6; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.atc-dot { fill: #fff; stroke: #0ea5c6; stroke-width: 2; }
.atc-dot-low { stroke: #dc2626; }
.atc-cursor { stroke: #0ea5c6; stroke-width: 1; stroke-dasharray: 3 3; }
.atc-tip { position: absolute; top: 0; z-index: 2; display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; font-size: .75rem; color: #0f1c2e; background: #fff; border: 1px solid #d9dfe6; border-radius: 8px; box-shadow: 0 6px 18px rgba(16, 24, 40, .12); transform: translateX(-50%); pointer-events: none; white-space: nowrap; }
.atc-tip span { color: #5d6b7a; }
.atc-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 0 40px; font-size: .85rem; text-align: center; color: #5d6b7a; pointer-events: none; }
.atc-err { margin: 8px 0 0; font-size: .85rem; color: #b3261e; }
.atc-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.atc-chip { padding: 2px 10px; border-radius: 999px; font-size: .75rem; font-weight: 600; }
.atc-c-present { background: #e7f4ec; color: #1e6b3a; }
.atc-c-absent { background: #fdecea; color: #b3261e; }
.atc-c-late { background: #fff4d6; color: #7a5a00; }
.atc-c-leave { background: #e8f0fc; color: #1d4ed8; }
.atc-avg { margin-left: auto; font-size: .75rem; color: #5d6b7a; }
`;