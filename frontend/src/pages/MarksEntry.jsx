import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/ui";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const classIdOf = (o) => String(o?.school_class?.id ?? o?.school_class ?? o?.class_id ?? "");
const classLabelOf = (o) =>
  o?.class_label ?? o?.school_class_label ?? o?.school_class_name ?? o?.class_name ?? o?.school_class?.label ?? o?.school_class?.name ?? "";
const classOf = (o) => classLabelOf(o) || (classIdOf(o) ? "Class " + classIdOf(o) : "");
const subjectName = (s) => s.name ?? s.title ?? `Subject ${s.id}`;

const gradeFor = (pct) => {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "F";
};
const PASS_PCT = 40;

const card = "rounded-2xl border border-keen-border bg-white shadow-sm";
const selectCls =
  "w-full rounded-xl border border-keen-border bg-slate-50 px-3 py-2.5 text-sm font-semibold text-keen-charcoal outline-none focus:border-keen-cyan focus:bg-white focus:ring-2 focus:ring-keen-cyan/30 disabled:opacity-60";
const labelCls = "mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-[#0AA9D4]";

function StatusPill({ pass }) {
  return (
    <span
      className={
        "inline-block rounded-full px-3 py-1 text-xs font-bold " +
        (pass ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")
      }
    >
      {pass ? "Pass" : "Fail"}
    </span>
  );
}

export default function MarksEntry() {
  const { session } = useAuth();
  const [tab, setTab] = useState("enter");
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [examId, setExamId] = useState("");
  const [totalMarks, setTotalMarks] = useState("100");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [entries, setEntries] = useState({}); // { [userId]: "78" }
  const [saved, setSaved] = useState({}); // last saved values
  const [markIds, setMarkIds] = useState({}); // { [userId]: existing Mark id }
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.listSubjects(), api.listExams()])
      .then(([subs, exs]) => {
        if (!alive) return;
        setSubjects(asList(subs));
        setExams(asList(exs));
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoadingBase(false));
    return () => {
      alive = false;
    };
  }, []);

  const subject = subjects.find((s) => String(s.id) === subjectId);
  const exam = exams.find((x) => String(x.id) === examId);
  const ready = subjectId && examId;

  // Only exams of the selected subject's class (exams with no class are open to all).
  const subjectClass = subject ? classIdOf(subject) || classOf(subject) : "";
  const availableExams = useMemo(
    () =>
      exams.filter((x) => {
        if (!subjectClass) return true;
        const k = classIdOf(x) || classOf(x);
        return !k || k === subjectClass;
      }),
    [exams, subjectClass]
  );

  useEffect(() => {
    if (examId && !availableExams.some((x) => String(x.id) === examId)) setExamId("");
  }, [availableExams, examId]);

  useEffect(() => {
    setStudents([]);
    setEntries({});
    setSaved({});
    setMarkIds({});
    setNotice("");
    if (!subjectId || !examId) return;

    let alive = true;
    setLoadingRows(true);
    setError("");
    Promise.all([api.listSubjectStudents(subjectId), api.listMarks()])
      .then(([studs, marksData]) => {
        if (!alive) return;
        const existing = asList(marksData).filter(
          (m) => m.exam === Number(examId) && m.subject === Number(subjectId)
        );
        const vals = {};
        const ids = {};
        for (const m of existing) {
          vals[m.student] = String(Number(m.obtained_marks));
          ids[m.student] = m.id;
        }
        if (existing.length) setTotalMarks(String(Number(existing[0].total_marks)));
        setStudents(asList(studs));
        setEntries(vals);
        setSaved(vals);
        setMarkIds(ids);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoadingRows(false));
    return () => {
      alive = false;
    };
  }, [subjectId, examId]);

  const total = Number(totalMarks);
  const totalValid = Number.isFinite(total) && total > 0;
  const passMark = totalValid ? Math.ceil((total * PASS_PCT) / 100) : 0;
  const missingUserId = students.length > 0 && students.some((s) => s.user_id === undefined);

  const invalid = useMemo(() => {
    const bad = new Set();
    for (const s of students) {
      const raw = entries[s.user_id];
      if (raw === undefined || raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || (totalValid && n > total)) bad.add(s.user_id);
    }
    return bad;
  }, [students, entries, total, totalValid]);

  const filled = students.filter((s) => entries[s.user_id] !== undefined && entries[s.user_id] !== "").length;
  const dirty = students.some((s) => (entries[s.user_id] ?? "") !== (saved[s.user_id] ?? ""));
  const canSave = !saving && totalValid && filled > 0 && invalid.size === 0 && !missingUserId && dirty;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        String(s.full_name || s.username || "").toLowerCase().includes(q) ||
        String(s.roll_no || "").toLowerCase().includes(q)
    );
  }, [students, query]);

  const setEntry = (userId, value) => {
    setNotice("");
    setEntries((prev) => ({ ...prev, [userId]: value }));
  };

  const discard = () => {
    setEntries(saved);
    setNotice("");
    setError("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    const ids = { ...markIds };
    const nowSaved = { ...saved };
    const failed = [];
    let done = 0;

    for (const s of students) {
      const raw = entries[s.user_id];
      if (raw === undefined || raw === "") continue;
      if (saved[s.user_id] === raw && ids[s.user_id]) continue;
      const body = { obtained_marks: Number(raw), total_marks: total };
      try {
        if (ids[s.user_id]) {
          await api.updateMark(ids[s.user_id], body);
        } else {
          const created = await api.createMark({
            ...body,
            exam: Number(examId),
            subject: Number(subjectId),
            student: s.user_id,
          });
          ids[s.user_id] = created.id;
        }
        nowSaved[s.user_id] = raw;
        done += 1;
      } catch (e) {
        failed.push(`${s.full_name || s.username}: ${e.message}`);
      }
    }

    setMarkIds(ids);
    setSaved(nowSaved);
    if (done) setNotice(`Saved marks for ${done} student${done === 1 ? "" : "s"}.`);
    if (failed.length) setError(`Could not save ${failed.length}: ${failed.join(" | ")}`);
    setSaving(false);
  };

  // Result sheet figures (from what is entered on screen).
  const graded = students
    .map((s) => ({ s, raw: entries[s.user_id] }))
    .filter((r) => r.raw !== undefined && r.raw !== "" && Number.isFinite(Number(r.raw)));
  const passCount = graded.filter((r) => totalValid && Number(r.raw) >= passMark).length;
  const average = graded.length ? graded.reduce((a, r) => a + Number(r.raw), 0) / graded.length : 0;
  const highest = graded.length ? Math.max(...graded.map((r) => Number(r.raw))) : 0;

  const filters = (
    <div className={card + " mr-noprint mb-6 p-5 sm:p-6"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label>
          <span className={labelCls}>Subject</span>
          <select className={selectCls} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={loadingBase}>
            <option value="">{loadingBase ? "Loading..." : "Select a subject"}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {subjectName(s)}{classOf(s) ? ` (${classOf(s)})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>Examination</span>
          <select className={selectCls} value={examId} onChange={(e) => setExamId(e.target.value)} disabled={loadingBase}>
            <option value="">{loadingBase ? "Loading..." : "Select an exam"}</option>
            {availableExams.map((x) => (
              <option key={x.id} value={x.id}>{x.name}{x.date ? ` (${x.date})` : ""}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>Find student</span>
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-keen-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" />
            </svg>
            <input
              className={selectCls + " pl-9 font-medium"}
              placeholder="Name or roll no..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </label>
      </div>
    </div>
  );

  return (
    <AppShell
      title={tab === "enter" ? "Enter exam marks" : "Subject result sheet"}
      subtitle={
        tab === "enter"
          ? "Enter and update marks for every student in your selected subject."
          : "Review and print the complete class result for one subject."
      }
      action={
        tab === "print" ? (
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!ready || students.length === 0}
            className="mr-noprint inline-flex items-center gap-2 rounded-xl bg-keen-cyan px-5 py-3 text-sm font-bold text-keen-darkest shadow-sm shadow-keen-cyan/25 hover:bg-keen-cyanDark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
            </svg>
            Print result sheet
          </button>
        ) : null
      }
    >
      <style>{css}</style>

      {/* Tabs */}
      <div className="mr-noprint inline-flex rounded-2xl border border-keen-border bg-white p-1.5 shadow-sm">
        {[
          ["enter", "Enter exam marks"],
          ["print", "Print result sheet"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              "rounded-xl px-5 py-2.5 text-sm font-bold transition-colors " +
              (tab === key ? "bg-keen-cyan text-keen-darkest shadow-sm" : "text-keen-muted hover:text-keen-charcoal")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mr-noprint space-y-3">
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-keen-cyan/40 bg-keen-cyanSoft px-3.5 py-2.5 text-xs font-medium text-keen-charcoal">{notice}</p>}
      </div>

      {filters}

      <div className="mr-noprint">
        {!loadingBase && subjects.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-keen-muted">
            No subjects are assigned to you yet. Ask the admin to assign one.
          </p>
        )}
        {!loadingBase && subjects.length > 0 && exams.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-keen-muted">
            No exams exist yet. Ask the admin to create one on the Exams page.
          </p>
        )}
        {subjects.length > 0 && exams.length > 0 && !ready && (
          <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-keen-muted">
            Choose a subject and an examination to see the class list.
          </p>
        )}
        {loadingRows && <p className="p-6 text-center text-sm text-keen-muted">Loading students...</p>}
        {ready && !loadingRows && students.length === 0 && !error && (
          <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-keen-muted">
            No registered students in this subject&apos;s class yet. Students appear here after they register with their roll number.
          </p>
        )}
        {missingUserId && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
            The students endpoint is not returning user_id. Restart the Django server and reload this page.
          </p>
        )}
      </div>

      {/* ---------- ENTER TAB ---------- */}
      {tab === "enter" && ready && students.length > 0 && !missingUserId && (
        <section className={card + " overflow-hidden"}>
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
            <div>
              <h3 className="text-xl font-extrabold text-keen-charcoal">{subject ? subjectName(subject) : "Subject"} marks</h3>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-keen-muted">
                Maximum marks:
                <input
                  type="number"
                  min="1"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(e.target.value)}
                  className="w-20 rounded-lg border border-keen-border bg-white px-2 py-1 text-center text-xs font-bold text-keen-charcoal outline-none focus:border-keen-cyan"
                  aria-label="Maximum marks"
                />
                · Passing marks: {totalValid ? passMark : "-"}
              </p>
            </div>
            <span className={"flex items-center gap-2 text-sm font-bold " + (dirty ? "text-amber-600" : "text-emerald-600")}>
              <span className={"h-2 w-2 rounded-full " + (dirty ? "bg-amber-500" : "bg-emerald-500")} />
              {dirty ? "Unsaved changes" : "All marks saved"}
            </span>
          </div>

          <div className="overflow-x-auto border-t border-keen-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-keen-muted">
                <tr>
                  <th className="px-6 py-4">Roll no.</th>
                  <th className="px-4 py-4">Student</th>
                  <th className="px-4 py-4">Marks obtained</th>
                  <th className="px-4 py-4 text-center">Grade</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((s) => {
                  const raw = entries[s.user_id];
                  const has = raw !== undefined && raw !== "";
                  const bad = invalid.has(s.user_id);
                  const n = Number(raw);
                  const pct = has && totalValid ? (n / total) * 100 : null;
                  const pass = has && totalValid && !bad ? n >= passMark : null;
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-keen-cyanSoft/30">
                      <td className="px-6 py-4 font-semibold text-keen-muted">{s.roll_no}</td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-keen-charcoal">{s.full_name || s.username}</p>
                        {s.username && s.full_name && <p className="text-xs text-keen-muted">{s.username}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max={totalValid ? total : undefined}
                            step="0.5"
                            value={raw ?? ""}
                            onChange={(e) => setEntry(s.user_id, e.target.value)}
                            aria-label={`Marks for ${s.full_name || s.username}`}
                            aria-invalid={bad}
                            className={
                              "w-24 rounded-xl border px-3 py-2.5 text-center font-bold outline-none focus:ring-2 " +
                              (bad
                                ? "border-red-400 bg-red-50 text-red-600 focus:ring-red-200"
                                : pass === false
                                ? "border-red-200 bg-red-50 text-red-600 focus:ring-red-200"
                                : "border-keen-border bg-white text-keen-charcoal focus:border-keen-cyan focus:ring-keen-cyan/30")
                            }
                          />
                          <span className="text-keen-muted">/ {totalValid ? total : "-"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-extrabold text-keen-charcoal">
                        {pct !== null && !bad ? gradeFor(pct) : "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {pass === null ? <span className="text-keen-muted">-</span> : <StatusPill pass={pass} />}
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-keen-muted">No student matches &quot;{query}&quot;.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-keen-border bg-slate-50/50 px-5 py-4 sm:px-6">
            <span className="text-sm text-keen-muted">
              {filled} of {students.length} students completed
              {invalid.size > 0 && ` - ${invalid.size} out of range`}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={discard}
                disabled={!dirty || saving}
                className="rounded-xl border border-keen-border bg-white px-5 py-2.5 text-sm font-bold text-keen-charcoal transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="inline-flex items-center gap-2 rounded-xl bg-keen-cyan px-6 py-2.5 text-sm font-bold text-keen-darkest shadow-sm shadow-keen-cyan/25 transition-colors hover:bg-keen-cyanDark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save marks"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ---------- PRINT TAB ---------- */}
      {tab === "print" && ready && students.length > 0 && !missingUserId && (
        <section className={card + " mr-print-area p-6 sm:p-10"}>
          <div className="border-b-2 border-keen-charcoal pb-5 text-center">
            <img src="/keen-logo.png" alt="" width="56" height="56" className="mx-auto mb-2 rounded-full" />
            <h2 className="text-2xl font-extrabold uppercase tracking-wide text-keen-charcoal">KEEN Evening Coaching</h2>
            <p className="mt-1 text-sm font-semibold text-keen-muted">
              {exam ? exam.name : "Examination"} · {subject ? subjectName(subject) : "Subject"}
              {classOf(subject || {}) ? " · " + classOf(subject) : ""}
            </p>
            <p className="text-xs text-keen-muted">
              Maximum marks: {totalValid ? total : "-"} · Passing marks: {totalValid ? passMark : "-"}
              {exam?.date ? " · " + exam.date : ""}
            </p>
          </div>

          <table className="mr-sheet mt-6 w-full text-left text-sm">
            <thead>
              <tr>
                <th>Roll no.</th>
                <th>Student</th>
                <th className="text-center">Marks</th>
                <th className="text-center">Grade</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const raw = entries[s.user_id];
                const has = raw !== undefined && raw !== "" && Number.isFinite(Number(raw));
                const n = Number(raw);
                const pass = has && totalValid ? n >= passMark : null;
                return (
                  <tr key={s.id}>
                    <td>{s.roll_no}</td>
                    <td className="font-semibold">{s.full_name || s.username}</td>
                    <td className="text-center">{has ? `${n} / ${totalValid ? total : "-"}` : "-"}</td>
                    <td className="text-center font-bold">{has && totalValid ? gradeFor((n / total) * 100) : "-"}</td>
                    <td className="text-center">{pass === null ? "-" : pass ? "Pass" : "Fail"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mr-summary mt-6 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-center text-sm sm:grid-cols-4">
            <div><p className="text-[11px] font-bold uppercase tracking-widest text-keen-muted">Students</p><p className="text-lg font-extrabold text-keen-charcoal">{students.length}</p></div>
            <div><p className="text-[11px] font-bold uppercase tracking-widest text-keen-muted">Passed</p><p className="text-lg font-extrabold text-keen-charcoal">{passCount} / {graded.length}</p></div>
            <div><p className="text-[11px] font-bold uppercase tracking-widest text-keen-muted">Average</p><p className="text-lg font-extrabold text-keen-charcoal">{average.toFixed(1)}</p></div>
            <div><p className="text-[11px] font-bold uppercase tracking-widest text-keen-muted">Highest</p><p className="text-lg font-extrabold text-keen-charcoal">{highest}</p></div>
          </div>

          <div className="mt-12 flex justify-between text-xs text-keen-muted">
            <span>Subject teacher: <b className="text-keen-charcoal">{session?.username}</b></span>
            <span className="border-t border-keen-charcoal pt-1">Signature</span>
          </div>
        </section>
      )}
    </AppShell>
  );
}

const css = `
.mr-sheet th, .mr-sheet td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
.mr-sheet thead th { background: #f1f5f9; font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; color: #5d6b7a; }
@media print {
  @page { size: A4; margin: 14mm; }
  body * { visibility: hidden; }
  .mr-print-area, .mr-print-area * { visibility: visible; }
  .mr-print-area { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
  .mr-noprint { display: none !important; }
  html, body, #root, #root div { overflow: visible !important; height: auto !important; max-height: none !important; }
  .mr-sheet th, .mr-sheet td { padding: 6px 8px; border: 1px solid #94a3b8; }
  .mr-sheet thead th { background: #e2e8f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .mr-summary { background: #fff !important; border: 1px solid #94a3b8; }
}
`;