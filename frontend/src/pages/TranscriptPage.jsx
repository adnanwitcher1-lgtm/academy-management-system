import { useEffect, useMemo, useState } from "react";
import { api, loadSession } from "../lib/api";
import { AppShell } from "../components/ui";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const fmt = (n) => String(Math.round(Number(n) * 100) / 100);

// Grade scale: change the cut-offs here if the academy uses a different one.
const gradeFor = (p) => (p >= 90 ? "A+" : p >= 80 ? "A" : p >= 70 ? "B" : p >= 60 ? "C" : p >= 50 ? "D" : "F");

// The logged-in user's id, read from the JWT, so only this student's marks are shown.
function userIdFromToken() {
  try {
    const token = loadSession()?.access;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.user_id ?? null;
  } catch {
    return null;
  }
}

export default function TranscriptPage() {
  const [marks, setMarks] = useState([]);
  const [diag, setDiag] = useState(null);
  const [examId, setExamId] = useState("");
  const [subjectView, setSubjectView] = useState("all"); // __VIEW_PATCHED__
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      setDiag({ total: all.length, uid, ids: [...new Set(all.map((m) => m.student))].slice(0, 6) });
        const newest = [...mine].sort((a, b) =>
          String(b.exam_date ?? "").localeCompare(String(a.exam_date ?? ""))
        )[0];
        if (newest) setExamId(String(newest.exam));
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const exams = useMemo(() => {
    const seen = new Map();
    for (const m of marks) {
      if (!seen.has(m.exam)) {
        seen.set(m.exam, { id: m.exam, name: m.exam_name ?? `Exam ${m.exam}`, date: m.exam_date ?? "" });
      }
    }
    return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [marks]);

  const exam = exams.find((e) => String(e.id) === String(examId));

  const examRows = useMemo(
    () =>
      marks
        .filter((m) => String(m.exam) === String(examId))
        .sort((a, b) => (a.subject_name || "").localeCompare(b.subject_name || "")),
    [marks, examId]
  );

  const subjectNames = useMemo(
    () => [...new Set(examRows.map((m) => m.subject_name).filter(Boolean))],
    [examRows]
  );

  const rows = useMemo(
    () => (subjectView === "all" ? examRows : examRows.filter((m) => m.subject_name === subjectView)),
    [examRows, subjectView]
  );

  const obtained = rows.reduce((sum, m) => sum + Number(m.obtained_marks), 0);
  const outOf = rows.reduce((sum, m) => sum + Number(m.total_marks), 0);
  const pct = outOf > 0 ? (obtained / outOf) * 100 : 0;
  const studentName = rows[0]?.student_name || marks[0]?.student_name || "Student";

  return (
    <AppShell title="My results" subtitle="View your marks and print your report card.">
      <style>{css}</style>
      <div className="tx">
        {error && (
          <div className="tx-msg" role="alert">
            {error}
          </div>
        )}
        {loading && <p className="tx-muted">Loading results...</p>}
        {!loading && !error && marks.length === 0 && (<>
          <p className="tx-muted">No marks have been published for you yet.</p>
          {diag && <p className="tx-muted">Debug: API returned {diag.total} marks, none match your id ({String(diag.uid)}). Marks belong to student ids: {diag.ids.join(", ")}</p>}</>
        )}

        {marks.length > 0 && (
          <div className="tx-controls">
            <label>
              Exam
              <select value={examId} onChange={(e) => { setExamId(e.target.value); setSubjectView("all"); }}>
                {exams.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                    {x.date ? ` (${x.date})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              View
              <select value={subjectView} onChange={(e) => setSubjectView(e.target.value)}>
                <option value="all">Full report card (all subjects)</option>
                {subjectNames.map((n) => (
                  <option key={n} value={n}>
                    {n} only
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => window.print()} disabled={rows.length === 0}>
              Print report card
            </button>
          </div>
        )}

        {rows.length > 0 && (
          <article className="tx-sheet">
            <header className="tx-head">
              <h1>KEEN Evening Coaching</h1>
              <p>{subjectView === "all" ? "Full report card" : subjectView + " result"}</p>
            </header>

            <dl className="tx-meta">
              <div>
                <dt>Student</dt>
                <dd>{studentName}</dd>
              </div>
              <div>
                <dt>{subjectView === "all" ? "Report" : "Subject"}</dt><dd>{subjectView === "all" ? "All subjects" : subjectView}</dd>
              </div>
              {subjectView !== "all" && (rows[0]?.date || exam?.date) && (
                <div>
                  <dt>Date</dt>
                  <dd>{rows[0]?.date || exam?.date}</dd>
                </div>
              )}
            </dl>

            <table className="tx-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th className="num">Obtained</th>
                  <th className="num">Total</th>
                  <th className="num">Percentage</th>
                  <th className="num">Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const p = Number(m.total_marks) > 0 ? (Number(m.obtained_marks) / Number(m.total_marks)) * 100 : 0;
                  return (
                    <tr key={m.id}>
                      <td>{m.subject_name}{subjectView === "all" && (m.date || exam?.date) && (<div style={{ fontSize: 12, opacity: 0.7, fontWeight: 400 }}>{m.date || exam?.date}</div>)}</td>
                      <td className="num">{fmt(m.obtained_marks)}</td>
                      <td className="num">{fmt(m.total_marks)}</td>
                      <td className="num">{p.toFixed(1)}%</td>
                      <td className="num">{gradeFor(p)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Overall</td>
                  <td className="num">{fmt(obtained)}</td>
                  <td className="num">{fmt(outOf)}</td>
                  <td className="num">{pct.toFixed(1)}%</td>
                  <td className="num">{gradeFor(pct)}</td>
                </tr>
              </tfoot>
            </table>

            <p className="tx-scale">Grade scale: A+ 90 and above, A 80-89, B 70-79, C 60-69, D 50-59, F below 50.</p>

            <div className="tx-sign">
              <span>Parent signature</span>
              <span>Principal</span>
            </div>
          </article>
        )}
      </div>
    </AppShell>
  );
}

const css = `
.tx { --tx-line: #cfd6de; --tx-muted: #5d6b7a; --tx-accent: #1f4e8c; max-width: 820px; }
.tx-muted { color: var(--tx-muted); }
.tx-msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; background: #fdecea; color: #b3261e; }
.tx-controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; margin-bottom: 20px; }
.tx-controls label { display: flex; flex-direction: column; gap: 6px; font-size: .9rem; font-weight: 600; }
.tx-controls select { min-width: 220px; padding: 8px 10px; font: inherit; font-weight: 400; border: 1px solid var(--tx-line); border-radius: 6px; background: #fff; }
.tx-controls button { padding: 10px 22px; font: inherit; font-weight: 600; color: #fff; background: var(--tx-accent); border: 0; border-radius: 6px; cursor: pointer; }
.tx-controls button:disabled { background: #a9b4c2; cursor: not-allowed; }
.tx select:focus-visible, .tx button:focus-visible { outline: 2px solid var(--tx-accent); outline-offset: 2px; }
.tx-sheet { background: #fff; border: 1px solid var(--tx-line); border-radius: 8px; padding: 32px; color: #1c2530; }
.tx-head { text-align: center; border-bottom: 2px solid #1c2530; padding-bottom: 12px; margin-bottom: 20px; }
.tx-head h1 { margin: 0; font-size: 1.5rem; }
.tx-head p { margin: 4px 0 0; color: var(--tx-muted); }
.tx-meta { display: flex; flex-wrap: wrap; gap: 8px 32px; margin: 0 0 20px; }
.tx-meta div { display: flex; gap: 8px; }
.tx-meta dt { color: var(--tx-muted); }
.tx-meta dd { margin: 0; font-weight: 600; }
.tx-table { width: 100%; border-collapse: collapse; }
.tx-table th, .tx-table td { padding: 9px 12px; text-align: left; border: 1px solid var(--tx-line); }
.tx-table th { background: #2B3033; color: #17E0E4; font-size: .85rem; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.tx-table .num { text-align: right; }
.tx-table tfoot td { font-weight: 700; background: #E3FAFB; color: #2B3033; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.tx-scale { margin: 12px 0 0; font-size: .8rem; color: var(--tx-muted); }
.tx-sign { display: flex; justify-content: space-between; margin-top: 64px; }
.tx-sign span { width: 40%; padding-top: 6px; border-top: 1px solid #2B3033; text-align: center; font-size: .85rem; }
  .tx-table th, .tx-table td { border-color: #0FB3B8; }
  [class*="tx-"] h1, [class*="tx-"] h2 { color: #2B3033; }
  [class*="tx-"] h3 { color: #0FB3B8; }
@media print {
  @page { size: A4; margin: 15mm; }
  body * { visibility: hidden; }
  .tx-sheet, .tx-sheet * { visibility: visible; }
  .tx-sheet { position: absolute; left: 0; top: 0; width: 100%; border: 0; padding: 0; }
}
`;