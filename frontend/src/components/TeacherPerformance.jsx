import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const pad = (n) => String(n).padStart(2, "0");
const isoOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const todayStr = () => isoOf(new Date());
const DAY = 86400000;
const toMs = (iso) => new Date(iso + "T00:00:00").getTime();
const r1 = (n) => Math.round(n * 10) / 10;
const monthKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1);

const weighted = (list) => {
  const tot = list.reduce((s, x) => s + x.tot, 0);
  return tot ? (list.reduce((s, x) => s + x.obt, 0) / tot) * 100 : null;
};

const COLORS = { high: "#16a34a", mid: "#0aa5d3", low: "#f59e0b", none: "#cbd5e1" };

function Donut({ segs, total }) {
  const R = 70;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 180 180" className="tp-donut" role="img" aria-label="Score distribution">
      <circle cx="90" cy="90" r={R} fill="none" stroke="#eef2f5" strokeWidth="22" />
      {segs.map((s) => {
        const len = total ? (C * s.n) / total : 0;
        const el = (
          <circle
            key={s.key}
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="22"
            strokeDasharray={len + " " + (C - len)}
            strokeDashoffset={-offset}
            transform="rotate(-90 90 90)"
          />
        );
        offset += len;
        return el;
      })}
      <text x="90" y="92" textAnchor="middle" className="tp-donut-num">
        {total}
      </text>
      <text x="90" y="112" textAnchor="middle" className="tp-donut-lbl">
        STUDENTS
      </text>
    </svg>
  );
}

function ProgressChart({ cur, prev, weeks }) {
  const W = 640,
    H = 230,
    L = 36,
    R = 14,
    T = 14,
    B = 26;
  const vals = [...cur, ...prev].filter((v) => v != null);
  if (vals.length === 0) return <p className="tp-muted tp-empty">No marks in this period yet.</p>;

  let lo = Math.max(0, Math.floor((Math.min(...vals) - 8) / 10) * 10);
  let hi = Math.min(100, Math.ceil((Math.max(...vals) + 4) / 10) * 10);
  if (hi - lo < 20) lo = Math.max(0, hi - 20);
  if (hi - lo < 20) hi = lo + 20;

  const x = (j) => L + (weeks === 1 ? 0 : (j * (W - L - R)) / (weeks - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const pts = (arr) => arr.map((v, j) => (v == null ? null : { x: x(j), y: y(v), v })).filter(Boolean);
  const line = (p) => p.map((q, k) => (k ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1)).join(" ");
  const cp = pts(cur);
  const pp = pts(prev);
  const area =
    cp.length > 1
      ? line(cp) + " L" + cp[cp.length - 1].x.toFixed(1) + " " + (H - B) + " L" + cp[0].x.toFixed(1) + " " + (H - B) + " Z"
      : "";
  const last = cp[cp.length - 1];
  const grid = [lo, (lo + hi) / 2, hi];

  return (
    <svg viewBox={"0 0 " + W + " " + H} className="tp-chart" role="img" aria-label="Class progress">
      <defs>
        <linearGradient id="tp-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0aa5d3" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0aa5d3" stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#e6edf2" strokeDasharray="4 5" />
          <text x={L - 8} y={y(g) + 4} textAnchor="end" className="tp-axis">
            {Math.round(g)}%
          </text>
        </g>
      ))}
      {area && <path d={area} fill="url(#tp-area)" />}
      {pp.length > 1 && <path d={line(pp)} fill="none" stroke="#22e0e6" strokeWidth="2.5" strokeDasharray="6 5" strokeLinecap="round" />}
      {cp.length > 1 && <path d={line(cp)} fill="none" stroke="#0aa5d3" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
      {cp.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#0aa5d3">
          <title>{r1(p.v) + "%"}</title>
        </circle>
      ))}
      {last && <circle cx={last.x} cy={last.y} r="7" fill="#fff" stroke="#0aa5d3" strokeWidth="3.5" />}
      <text x={x(0)} y={H - 6} textAnchor="start" className="tp-axis">
        {weeks} weeks ago
      </text>
      <text x={x(weeks - 1)} y={H - 6} textAnchor="end" className="tp-axis">
        This week
      </text>
    </svg>
  );
}

export default function TeacherPerformance() {
  const [marks, setMarks] = useState([]);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weeks, setWeeks] = useState(12);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, cls] = await Promise.all([api.listMarks(), api.attendanceClasses()]);
        const sheets = await Promise.all(
          asList(cls).map((c) => api.attendanceSheet(c.id, todayStr()).catch(() => null))
        );
        if (!alive) return;
        setMarks(asList(m));
        const ids = new Set();
        for (const s of sheets) if (s) for (const st of s.students) ids.add(st.student);
        setRoster([...ids]);
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const d = useMemo(() => {
    const todayMs = toMs(todayStr());
    const rows = marks
      .map((m) => {
        const day = String(m.date || m.exam_date || "").slice(0, 10);
        return {
          sid: m.student,
          exam: m.exam,
          examName: m.exam_name,
          obt: Number(m.obtained_marks),
          tot: Number(m.total_marks),
          ms: day ? toMs(day) : NaN,
        };
      })
      .filter((m) => m.tot > 0 && !Number.isNaN(m.obt));

    // per-student averages -> performance bands
    const byStudent = new Map();
    for (const r of rows) {
      const e = byStudent.get(r.sid) || { obt: 0, tot: 0 };
      e.obt += r.obt;
      e.tot += r.tot;
      byStudent.set(r.sid, e);
    }
    let high = 0,
      mid = 0,
      low = 0;
    for (const e of byStudent.values()) {
      const p = (e.obt / e.tot) * 100;
      if (p >= 80) high += 1;
      else if (p >= 60) mid += 1;
      else low += 1;
    }
    let none = 0;
    for (const id of roster) if (!byStudent.has(id)) none += 1;
    const total = byStudent.size + none;

    // this month vs last month
    const now = new Date();
    const curKey = monthKey(now);
    const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const inMonth = (k) => rows.filter((r) => !Number.isNaN(r.ms) && monthKey(new Date(r.ms)) === k);
    const cm = weighted(inMonth(curKey));
    const pm = weighted(inMonth(prevKey));

    // last 12 exams -> bars
    const byExam = new Map();
    for (const r of rows) {
      if (r.exam == null) continue;
      const e = byExam.get(r.exam) || { name: r.examName || "Exam", ms: NaN, obt: 0, tot: 0 };
      e.obt += r.obt;
      e.tot += r.tot;
      if (!Number.isNaN(r.ms) && (Number.isNaN(e.ms) || r.ms > e.ms)) e.ms = r.ms;
      byExam.set(r.exam, e);
    }
    const bars = [...byExam.values()]
      .sort((a, b) => (a.ms || 0) - (b.ms || 0))
      .slice(-12)
      .map((e) => ({ name: e.name, value: (e.obt / e.tot) * 100 }));

    // weekly series
    const withIdx = rows
      .map((r) => ({ ...r, wi: Number.isNaN(r.ms) ? -1 : Math.floor((todayMs - r.ms) / (7 * DAY)) }))
      .filter((r) => r.wi >= 0);
    const W = weeks;
    const cur = [];
    const prev = [];
    for (let j = 0; j < W; j++) {
      const i = W - 1 - j;
      cur.push(weighted(withIdx.filter((r) => r.wi === i)));
      prev.push(weighted(withIdx.filter((r) => r.wi === i + W)));
    }

    return {
      overall: weighted(rows),
      monthDelta: cm != null && pm != null ? cm - pm : null,
      bars,
      counts: { high, mid, low, none },
      total,
      cur,
      prev,
      curAvg: weighted(withIdx.filter((r) => r.wi < W)),
      prevAvg: weighted(withIdx.filter((r) => r.wi >= W && r.wi < 2 * W)),
      hasMarks: rows.length > 0,
    };
  }, [marks, roster, weeks]);

  if (loading) return <p className="tp-muted">Loading performance...</p>;
  if (error) return <p className="tp-err">{error}</p>;

  const { counts, total } = d;
  const share = (n) => (total ? (n * 100) / total : 0);
  const segs = [
    { key: "high", n: counts.high, color: "#0aa5d3", label: "80-100" },
    { key: "mid", n: counts.mid, color: "#22e0e6", label: "60-79" },
    { key: "low", n: counts.low, color: "#f59e0b", label: "Below 60" },
    { key: "none", n: counts.none, color: COLORS.none, label: "Not graded" },
  ];
  const rowsUi = [
    ["Exceeding expectations", counts.high, COLORS.high],
    ["Meeting expectations", counts.mid, COLORS.mid],
    ["Needs support", counts.low, COLORS.low],
  ];
  const delta = d.curAvg != null && d.prevAvg != null ? d.curAvg - d.prevAvg : null;
  const nBars = d.bars.length;

  return (
    <div className="tp">
      <style>{css}</style>

      {!d.hasMarks && (
        <div className="tp-note">
          No marks have been entered yet, so these charts are empty. <a href="/teacher/marks">Enter marks</a> and they fill
          in automatically.
        </div>
      )}

      <div className="tp-top">
        <section className="tp-card">
          <h3>Student performance</h3>
          <p className="tp-sub">
            All your classes · {d.bars.length ? "last " + d.bars.length + " exam" + (d.bars.length === 1 ? "" : "s") : "no exams yet"}
          </p>

          <div className="tp-perf">
            <div className="tp-big">
              <div className="tp-bignum">
                {d.overall == null ? "-" : Math.round(d.overall)}
                {d.overall != null && <span>%</span>}
              </div>
              {d.monthDelta != null ? (
                <div className={"tp-trend " + (d.monthDelta >= 0 ? "up" : "down")}>
                  {d.monthDelta >= 0 ? "▲" : "▼"} {Math.abs(r1(d.monthDelta))}% vs last month
                </div>
              ) : (
                <div className="tp-trend flat">No month-to-month data yet</div>
              )}
            </div>
            <div className="tp-bars">
              {d.bars.length === 0 && <span className="tp-muted">No exam results yet.</span>}
              {d.bars.map((b, i) => (
                <div
                  key={i}
                  className="tp-bar"
                  title={b.name + ": " + r1(b.value) + "%"}
                  style={{
                    height: Math.max(b.value, 4) + "%",
                    background: "rgba(23,197,224," + (0.35 + (0.65 * i) / Math.max(nBars - 1, 1)) + ")",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="tp-rows">
            {rowsUi.map(([label, n, color]) => (
              <div key={label}>
                <div className="tp-row-top">
                  <span>{label}</span>
                  <strong>
                    {n} student{n === 1 ? "" : "s"}
                  </strong>
                </div>
                <div className="tp-track">
                  <div style={{ width: share(n) + "%", background: color }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="tp-card">
          <p className="tp-eyebrow">SCORE DISTRIBUTION</p>
          <div className="tp-donut-wrap">
            <Donut segs={segs} total={total} />
          </div>
          <ul className="tp-legend">
            {segs.map((s) => (
              <li key={s.key}>
                <span className="tp-dot" style={{ background: s.color }} />
                <span className="tp-leg-label">{s.label}</span>
                <strong>{Math.round(share(s.n))}%</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="tp-card tp-progress">
        <div className="tp-progress-head">
          <div>
            <h3>
              Class progress <span className="tp-live">LIVE</span>
            </h3>
            <p className="tp-sub">Average assessment score over time</p>
          </div>
          <div className="tp-toggle">
            <button type="button" className={weeks === 4 ? "on" : ""} onClick={() => setWeeks(4)}>
              4 weeks
            </button>
            <button type="button" className={weeks === 12 ? "on" : ""} onClick={() => setWeeks(12)}>
              12 weeks
            </button>
          </div>
        </div>

        <div className="tp-progress-mid">
          <div className="tp-avgrow">
            <div className="tp-avgnum">{d.curAvg == null ? "-" : r1(d.curAvg) + "%"}</div>
            {delta != null && (
              <span
                className={"tp-chip " + (delta >= 0 ? "up" : "down")}
                title={"Compared with the previous " + weeks + " weeks"}
              >
                {delta >= 0 ? "▲ +" : "▼ "}
                {r1(delta)}%
              </span>
            )}
          </div>
          <div className="tp-key">
            <span>
              <i style={{ background: "#0aa5d3" }} /> Average
            </span>
            <span>
              <i style={{ background: "#22e0e6" }} /> Previous {weeks} weeks
            </span>
          </div>
        </div>

        <ProgressChart cur={d.cur} prev={d.prev} weeks={weeks} />
      </section>
    </div>
  );
}

const css = `
.tp { display: flex; flex-direction: column; gap: 20px; }
.tp-muted { color: #94a0ad; font-size: 14px; }
.tp-err { color: #b3261e; font-size: 14px; }
.tp-empty { text-align: center; padding: 40px 0; }
.tp-note { padding: 12px 16px; border-radius: 12px; background: #e8fafa; color: #0a6f73; font-size: 14px; }
.tp-note a { font-weight: 700; color: #0a6f73; }
.tp-top { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 20px; }
@media (max-width: 980px) { .tp-top { grid-template-columns: minmax(0, 1fr); } }
.tp-card { background: #fff; border: 1px solid #e3e7ed; border-radius: 22px; padding: 26px 28px; box-shadow: 0 2px 12px rgba(28,37,48,.04); }
.tp-card h3 { margin: 0; font-size: 20px; font-weight: 700; color: #1c2530; }
.tp-sub { margin: 4px 0 0; font-size: 14px; color: #5d6b7a; }
.tp-eyebrow { margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: .16em; color: #5d6b7a; }

.tp-perf { display: flex; align-items: flex-end; gap: 28px; margin: 22px 0 24px; flex-wrap: wrap; }
.tp-bignum { font-size: 60px; font-weight: 800; line-height: 1; color: #1c2530; letter-spacing: -.02em; }
.tp-bignum span { font-size: 28px; color: #0aa5d3; margin-left: 2px; }
.tp-trend { margin-top: 8px; font-size: 14px; font-weight: 600; }
.tp-trend.up { color: #16a34a; }
.tp-trend.down { color: #b3261e; }
.tp-trend.flat { color: #94a0ad; font-weight: 500; }
.tp-bars { flex: 1; min-width: 220px; height: 120px; display: flex; align-items: flex-end; gap: 8px; }
.tp-bar { flex: 1; border-radius: 6px 6px 3px 3px; min-height: 4px; transition: height .3s; }

.tp-rows { display: flex; flex-direction: column; gap: 16px; }
.tp-row-top { display: flex; justify-content: space-between; font-size: 15px; color: #1c2530; margin-bottom: 8px; }
.tp-row-top strong { font-weight: 600; }
.tp-track { height: 9px; border-radius: 999px; background: #eef2f5; overflow: hidden; }
.tp-track div { height: 100%; border-radius: 999px; transition: width .3s; }

.tp-donut-wrap { display: flex; justify-content: center; margin: 14px 0 18px; }
.tp-donut { width: 190px; height: 190px; }
.tp-donut-num { font-size: 34px; font-weight: 800; fill: #1c2530; }
.tp-donut-lbl { font-size: 10px; font-weight: 700; letter-spacing: .14em; fill: #5d6b7a; }
.tp-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.tp-legend li { display: flex; align-items: center; gap: 10px; font-size: 15px; color: #1c2530; }
.tp-leg-label { flex: 1; }
.tp-dot { width: 11px; height: 11px; border-radius: 50%; }

.tp-progress-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.tp-live { margin-left: 8px; padding: 4px 12px; border-radius: 999px; background: #e0f7f8; color: #0a8a8f; font-size: 11px; font-weight: 700; letter-spacing: .06em; vertical-align: middle; }
.tp-toggle { display: inline-flex; padding: 4px; border-radius: 12px; background: #f1f4f6; }
.tp-toggle button { padding: 8px 16px; border: 0; border-radius: 9px; background: transparent; font: inherit; font-size: 14px; font-weight: 600; color: #5d6b7a; cursor: pointer; }
.tp-toggle button.on { background: #fff; color: #1c2530; box-shadow: 0 1px 4px rgba(28,37,48,.12); }
.tp-progress-mid { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin: 18px 0 10px; }
.tp-avgrow { display: flex; align-items: center; gap: 12px; }
.tp-avgnum { font-size: 44px; font-weight: 800; color: #1c2530; letter-spacing: -.02em; }
.tp-chip { padding: 5px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; }
.tp-chip.up { background: #e6f4ea; color: #16a34a; }
.tp-chip.down { background: #fdecea; color: #b3261e; }
.tp-key { display: flex; gap: 20px; font-size: 14px; color: #1c2530; }
.tp-key span { display: inline-flex; align-items: center; gap: 8px; }
.tp-key i { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.tp-chart { width: 100%; height: auto; display: block; border-radius: 14px; background: #f5fcfd; }
.tp-axis { font-size: 11px; fill: #94a0ad; }
`;