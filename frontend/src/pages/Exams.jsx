import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  AddButton,
  AppShell,
  Button,
  DeleteButton,
  EditButton,
  FormItem,
  INPUT_CLS,
  Modal,
  Notice,
} from "../components/ui";

const EMPTY = { name: "", date: "", school_class: "" };

const TONES = [
  "bg-amber-50 text-amber-800 border-amber-200",
  "bg-orange-50 text-orange-800 border-orange-200",
  "bg-violet-50 text-violet-800 border-violet-200",
  "bg-[#E3FAFB] text-[#0A8F94] border-[#17E0E4]",
  "bg-emerald-50 text-emerald-800 border-emerald-200",
];
const toneFor = (text) => {
  let n = 0;
  for (const ch of String(text || "?")) n += ch.charCodeAt(0);
  return TONES[n % TONES.length];
};

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const labelOf = (c) => c.name + (c.section ? " " + c.section : "");
const gradeFor = (p) =>
  p >= 90 ? "A+" : p >= 80 ? "A" : p >= 70 ? "B" : p >= 60 ? "C" : p >= 50 ? "D" : "F";
const fmt = (n) => String(Math.round(Number(n) * 100) / 100);

function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
}

function prettyDate(value) {
  if (!value) return "-";
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-4 py-2 text-sm font-bold transition-colors " +
        (active
          ? "border-keen-charcoal bg-keen-charcoal text-white"
          : "border-keen-border bg-white text-keen-charcoal hover:bg-slate-50")
      }
    >
      {children}
    </button>
  );
}

function ModeTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "border-b-2 px-4 py-2.5 text-sm font-bold transition-colors " +
        (active
          ? "border-[#0A8F94] text-[#0A8F94]"
          : "border-transparent text-keen-muted hover:text-keen-charcoal")
      }
    >
      {children}
    </button>
  );
}

// Turns each result row's subject list into a lookup keyed by subject name,
// and returns the full sorted set of subject names seen across all rows.
function pivotSubjects(results) {
  const subjectSet = new Set();
  for (const r of results) {
    for (const row of r.rows) subjectSet.add(row.subject_name);
  }
  const subjects = [...subjectSet].sort();
  const withLookup = results.map((r) => {
    const bySubject = {};
    for (const row of r.rows) bySubject[row.subject_name] = row;
    return { ...r, bySubject };
  });
  return { subjects, rows: withLookup };
}

function StudentResultSheet({ student, exam, subjects, onClose, initialView = "all" }) {
  const [view, setView] = useState(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView, student?.student_id]);
  const shown = view === "all" ? subjects : subjects.filter((n) => n === view);
  const shownRows = shown.map((n) => student.bySubject[n]).filter(Boolean);
  const sumObt = view === "all" ? student.obtained_total : shownRows.reduce((s, r) => s + Number(r.obtained_marks), 0);
  const sumTot = view === "all" ? student.total_total : shownRows.reduce((s, r) => s + Number(r.total_marks), 0);
  const sumPct = view === "all" ? student.percentage : (sumTot > 0 ? Math.round((sumObt / sumTot) * 10000) / 100 : 0);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6 print:static print:bg-white print:p-0">
      <style>{sheetCss}</style>
      <div className="w-full max-w-2xl">
        <div className="mb-4 flex justify-end gap-2 print:hidden">
          <select
            className={INPUT_CLS + " max-w-xs"}
            value={view}
            onChange={(e) => setView(e.target.value)}
            aria-label="Choose report view"
          >
            <option value="all">Full report card (all subjects)</option>
            {subjects.map((n) => (
              <option key={n} value={n}>
                {n} only
              </option>
            ))}
          </select>
          <Button variant="quiet" onClick={onClose} className="px-4 py-2 text-sm">
            Close
          </Button>
          <Button onClick={() => window.print()} className="px-4 py-2 text-sm">
            Print
          </Button>
        </div>

        <article className="rs-sheet">
          <header className="rs-head">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><img src="/keen-logo.png" alt="KEEN Academy logo" style={{ height: 56, width: "auto", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} /><h1>KEEN Academy</h1></div>
            <p>{view === "all" ? "Student Report Card" : view + " Result"}</p>
          </header>

          <section className="rs-info">
            <div>
              <span>Student Name</span>
              <strong>{student.student_name}</strong>
            </div>
            <div>
              <span>Roll No.</span>
              <strong>{student.roll_no || "-"}</strong>
            </div>
            <div>
              <span>{view === "all" ? "Report" : "Date"}</span>
              <strong>{view === "all" ? "All subjects" : (() => { const d = shownRows[0]?.date || exam?.date; return d ? prettyDate(d) : "-"; })()}</strong>
            </div>
          </section>

          <table className="rs-table">
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
              {shown.map((name) => {
                const row = student.bySubject[name];
                if (!row) {
                  return (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className="num" colSpan={4}>
                        -
                      </td>
                    </tr>
                  );
                }
                const p = row.total_marks > 0 ? (row.obtained_marks / row.total_marks) * 100 : 0;
                return (
                  <tr key={name}>
                    <td>{name}{view === "all" && (row.date || exam?.date) && (<div style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>{prettyDate(row.date || exam.date)}</div>)}</td>
                    <td className="num">{fmt(row.obtained_marks)}</td>
                    <td className="num">{fmt(row.total_marks)}</td>
                    <td className="num">{p.toFixed(1)}%</td>
                    <td className="num">
                      <span className="rs-pill">{gradeFor(p)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <section className="rs-summary">
            <div>
              <span>Total Marks</span>
              <strong>
                {fmt(sumObt)} / {fmt(sumTot)}
              </strong>
            </div>
            <div>
              <span>Percentage</span>
              <strong>{sumPct}%</strong>
            </div>
            <div>
              <span>{view === "all" ? "Overall Grade" : "Grade"}</span>
              <strong>{gradeFor(sumPct)}</strong>
            </div>
          </section>

          <div className="rs-remarks">
            <span>Remarks</span>
          </div>

          <div className="rs-sign">
            <span>Parent signature</span>
            <span>Date: {prettyDate(todayString())}</span>
            <span>Principal</span>
          </div>
        </article>
      </div>
    </div>
  );
}

function FullStudentReportCard({ student, onClose }) {
  const rows = [...(student?.rows || [])].sort((a, b) => {
    const da = String(a.date || a.exam_date || "");
    const db = String(b.date || b.exam_date || "");
    return da.localeCompare(db) || String(a.subject_name || "").localeCompare(String(b.subject_name || ""));
  });

  const totalObt = rows.reduce((sum, r) => sum + Number(r.obtained_marks || 0), 0);
  const totalMax = rows.reduce((sum, r) => sum + Number(r.total_marks || 0), 0);
  const percentage = totalMax > 0 ? Math.round((totalObt / totalMax) * 10000) / 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6 print:static print:bg-white print:p-0">
      <style>{sheetCss}</style>

      <div className="w-full max-w-3xl">
        <div className="mb-4 flex justify-end gap-2 print:hidden">
          <Button variant="quiet" onClick={onClose} className="px-4 py-2 text-sm">
            Close
          </Button>
          <Button onClick={() => window.print()} className="px-4 py-2 text-sm">
            Print Full Report Card
          </Button>
        </div>

        <article className="rs-sheet">
          <header className="rs-head">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/keen-logo.png" alt="KEEN Academy logo" style={{ height: 56, width: "auto", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
              <h1>KEEN Academy</h1>
            </div>
            <p>Student Full Report Card</p>
          </header>

          <section className="rs-info">
            <div>
              <span>Student Name</span>
              <strong>{student.student_name}</strong>
            </div>
            <div>
              <span>Roll No.</span>
              <strong>{student.roll_no || "-"}</strong>
            </div>
            <div>
              <span>Report</span>
              <strong>All Exams & Subjects</strong>
            </div>
          </section>

          <table className="rs-table">
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    No marks found for this student.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const p = Number(row.total_marks) > 0 ? (Number(row.obtained_marks) / Number(row.total_marks)) * 100 : 0;
                  return (
                    <tr key={`${row.exam_id || "exam"}-${row.subject_name}-${index}`}>
                      <td>{row.subject_name || "-"}</td>
                      <td className="num">{fmt(row.obtained_marks)}</td>
                      <td className="num">{fmt(row.total_marks)}</td>
                      <td className="num">{p.toFixed(1)}%</td>
                      <td className="num">
                        <span className="rs-pill">{gradeFor(p)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <section className="rs-summary">
            <div>
              <span>Total Marks</span>
              <strong>{fmt(totalObt)} / {fmt(totalMax)}</strong>
            </div>
            <div>
              <span>Overall Percentage</span>
              <strong>{percentage}%</strong>
            </div>
            <div>
              <span>Overall Grade</span>
              <strong>{gradeFor(percentage)}</strong>
            </div>
          </section>

          <div className="rs-remarks">
            <span>Remarks</span>
          </div>

          <div className="rs-sign">
            <span>Parent signature</span>
            <span>Date: {prettyDate(todayString())}</span>
            <span>Principal</span>
          </div>
        </article>
      </div>
    </div>
  );
}

export default function Exams() {
  const [tab, setTab] = useState("exams");
  const [resultsMode, setResultsMode] = useState("exam"); // "exam" | "class" | "student"
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [initial, setInitial] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // ---- By exam ----
  const [resultsExamId, setResultsExamId] = useState("");
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [resultView, setResultView] = useState("all");
  const [sheetStudent, setSheetStudent] = useState(null);

  // ---- By class (aggregated across every exam for that class) ----
  const [classFilterId, setClassFilterId] = useState("");
  const [classRows, setClassRows] = useState([]);
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState("");
  const [classStudentSheet, setClassStudentSheet] = useState(null);

  // ---- By student ----
  const [fullReportStudents, setFullReportStudents] = useState([]);
  const [fullReportLoading, setFullReportLoading] = useState(false);
  const [fullReportError, setFullReportError] = useState("");
  const [fullReportStudent, setFullReportStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");

  const [markOpen, setMarkOpen] = useState(false);
  const [markSubjects, setMarkSubjects] = useState([]);
  const [markStudents, setMarkStudents] = useState([]);
  const [markForm, setMarkForm] = useState({ exam: "", subject: "", student: "", obtained_marks: "", total_marks: "100", date: "" });
  const [markBusy, setMarkBusy] = useState(false);
  const [markError, setMarkError] = useState("");
  const [markExistingId, setMarkExistingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const [exs, cls] = await Promise.all([api.listExams(), api.listSchoolClasses()]);
      setItems(asList(exs));
      setClasses(asList(cls));
    } catch (err) {
      setPageError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // FULL STUDENT REPORT LOADER (used by "By student" mode)
  useEffect(() => {
    if (!items || items.length === 0) {
      setFullReportStudents([]);
      return;
    }
    let alive = true;
    setFullReportLoading(true);
    setFullReportError("");

    Promise.all(
      items.map(async (exam) => {
        try {
          const data = await api.getExamResults(exam.id);
          return { exam, results: asList(data) };
        } catch {
          return { exam, results: [] };
        }
      })
    )
      .then((allExamResults) => {
        if (!alive) return;
        const byStudent = {};
        for (const block of allExamResults) {
          const exam = block.exam;
          for (const student of block.results) {
            const sid = String(student.student_id);
            if (!byStudent[sid]) {
              byStudent[sid] = {
                student_id: student.student_id,
                student_name: student.student_name,
                roll_no: student.roll_no,
                rows: [],
              };
            }
            for (const row of student.rows || []) {
              byStudent[sid].rows.push({
                exam_id: exam.id,
                exam_name: exam.name,
                exam_date: exam.date,
                subject_name: row.subject_name,
                date: row.date || exam.date,
                obtained_marks: row.obtained_marks,
                total_marks: row.total_marks,
              });
            }
          }
        }
        const list = Object.values(byStudent).sort((a, b) =>
          String(a.student_name || "").localeCompare(String(b.student_name || ""))
        );
        setFullReportStudents(list);
      })
      .catch((error) => {
        if (alive) setFullReportError(error?.message || "Could not load student report cards.");
      })
      .finally(() => {
        if (alive) setFullReportLoading(false);
      });

    return () => { alive = false; };
  }, [items]);

  // BY EXAM LOADER
  useEffect(() => {
    setResults([]);
    setResultsError("");

    if (!resultsExamId) {
      setResultView("all");
      return;
    }

    let alive = true;
    setResultsLoading(true);

    api
      .getExamResults(resultsExamId)
      .then((data) => {
        if (!alive) return;
        const list = asList(data);
        setResults(list);

        const selectedExam = items.find((x) => String(x.id) === String(resultsExamId));
        const examName = String(selectedExam?.name || "").trim().toLowerCase();
        const subjectSet = new Set();
        for (const student of list) {
          for (const row of student.rows || []) {
            if (row.subject_name) subjectSet.add(String(row.subject_name));
          }
        }
        const availableSubjects = [...subjectSet];
        const matchedSubject = availableSubjects.find((subject) => {
          const s = String(subject).trim().toLowerCase();
          return examName === s || examName.startsWith(s + " ") || examName.startsWith(s + "(") || examName.includes(s);
        });
        setResultView(matchedSubject || "all");
      })
      .catch((e) => {
        if (alive) {
          setResultsError(e.message);
          setResultView("all");
        }
      })
      .finally(() => {
        if (alive) setResultsLoading(false);
      });

    return () => { alive = false; };
  }, [resultsExamId, items]);

  // BY CLASS LOADER — pulls every exam for the chosen class, aggregates per
  // student, summing each subject's marks across all of that class's exams.
  useEffect(() => {
    setClassRows([]);
    setClassError("");

    if (!classFilterId) return;

    const classExams = items.filter((x) => String(x.school_class) === String(classFilterId));
    if (classExams.length === 0) return;

    let alive = true;
    setClassLoading(true);

    Promise.all(
      classExams.map(async (exam) => {
        try {
          const data = await api.getExamResults(exam.id);
          return { exam, results: asList(data) };
        } catch {
          return { exam, results: [] };
        }
      })
    )
      .then((allExamResults) => {
        if (!alive) return;
        const byStudent = {};
        for (const block of allExamResults) {
          const exam = block.exam;
          for (const student of block.results) {
            const sid = String(student.student_id);
            if (!byStudent[sid]) {
              byStudent[sid] = {
                student_id: student.student_id,
                student_name: student.student_name,
                roll_no: student.roll_no,
                rows: [],
                bySubject: {},
              };
            }
            const entry = byStudent[sid];
            for (const row of student.rows || []) {
              entry.rows.push({
                exam_id: exam.id,
                exam_name: exam.name,
                exam_date: exam.date,
                subject_name: row.subject_name,
                date: row.date || exam.date,
                obtained_marks: row.obtained_marks,
                total_marks: row.total_marks,
              });
              const name = row.subject_name;
              if (!entry.bySubject[name]) entry.bySubject[name] = { obtained_marks: 0, total_marks: 0 };
              entry.bySubject[name].obtained_marks += Number(row.obtained_marks || 0);
              entry.bySubject[name].total_marks += Number(row.total_marks || 0);
            }
          }
        }
        const list = Object.values(byStudent).map((s) => {
          const obtained_total = Object.values(s.bySubject).reduce((sum, v) => sum + v.obtained_marks, 0);
          const total_total = Object.values(s.bySubject).reduce((sum, v) => sum + v.total_marks, 0);
          const percentage = total_total > 0 ? Math.round((obtained_total / total_total) * 10000) / 100 : 0;
          return { ...s, obtained_total, total_total, percentage };
        });
        list.sort((a, b) => String(a.student_name || "").localeCompare(String(b.student_name || "")));
        setClassRows(list);
      })
      .catch((e) => {
        if (alive) setClassError(e.message);
      })
      .finally(() => {
        if (alive) setClassLoading(false);
      });

    return () => { alive = false; };
  }, [classFilterId, items]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const ready = form.name.trim().length > 0 && form.date !== "";
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const isEdit = editingId !== null;
  const today = todayString();

  function openAdd() {
    setForm(EMPTY);
    setInitial(EMPTY);
    setEditingId(null);
    setFormError("");
    setOpen(true);
  }

  function openEdit(item) {
    const start = {
      name: item.name || "",
      date: item.date || "",
      school_class: item.school_class ? String(item.school_class) : "",
    };
    setForm(start);
    setInitial(start);
    setEditingId(item.id);
    setFormError("");
    setOpen(true);
  }

  function closeNow() {
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY);
    setInitial(EMPTY);
    setFormError("");
  }

  function close() {
    if (dirty && !window.confirm("Discard your changes? What you typed will be lost.")) return;
    closeNow();
  }

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    const payload = {
      name: form.name.trim(),
      date: form.date,
      school_class: form.school_class ? Number(form.school_class) : null,
    };
    try {
      if (isEdit) {
        const updated = await api.updateExam(editingId, payload);
        setItems((list) => list.map((i) => (i.id === editingId ? updated : i)));
        setNotice("Saved changes for " + updated.name + ".");
      } else {
        const created = await api.createExam(payload);
        setItems((list) => [...list, created]);
        setNotice(created.name + " was added.");
      }
      closeNow();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm("Delete " + item.name + "? This can't be undone.")) return;
    setPageError("");
    setNotice("");
    setDeletingId(item.id);
    try {
      await api.deleteExam(item.id);
      setItems((list) => list.filter((i) => i.id !== item.id));
      setNotice(item.name + " was deleted.");
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function openAddMark() {
    setMarkError("");
    setMarkForm({
      exam: resultsExamId ? String(resultsExamId) : "",
      subject: "",
      student: "",
      obtained_marks: "",
      total_marks: "100",
      date: "",
    });
    setMarkStudents([]);
    setMarkOpen(true);
    try {
      setMarkSubjects(asList(await api.listSubjects()));
    } catch (err) {
      setMarkError(err.message);
    }
  }

  function updateMarkField(key) {
    return async (e) => {
      const value = e.target.value;
      setMarkForm((f) => ({ ...f, [key]: value }));
      setMarkExistingId(null);
      if (key === "subject") {
        setMarkForm((f) => ({ ...f, student: "" }));
        setMarkStudents([]);
        if (value) {
          try {
            setMarkStudents(asList(await api.listSubjectStudents(value)));
          } catch (err) {
            setMarkError(err.message);
          }
        }
      }
      if (key === "student") {
        const exam = markForm.exam;
        const subject = markForm.subject;
        if (exam && subject && value) {
          try {
            const all = asList(await api.listMarks());
            const existing = all.find(
              (m) =>
                String(m.exam) === String(exam) &&
                String(m.subject) === String(subject) &&
                String(m.student) === String(value)
            );
            if (existing) {
              setMarkExistingId(existing.id);
              setMarkForm((f) => ({
                ...f,
                obtained_marks: String(Number(existing.obtained_marks)),
                date: existing.date || "",
                total_marks: String(Number(existing.total_marks)),
              }));
            }
          } catch (err) {
            setMarkError(err.message);
          }
        }
      }
    };
  }

  const markReady =
    markForm.exam !== "" &&
    markForm.subject !== "" &&
    markForm.student !== "" &&
    markForm.obtained_marks !== "" &&
    markForm.total_marks !== "";

  async function submitMark() {
    if (!markReady || markBusy) return;
    setMarkBusy(true);
    setMarkError("");
    try {
      const body = {
        obtained_marks: Number(markForm.obtained_marks),
        total_marks: Number(markForm.total_marks),
        date: markForm.date || null,
      };
      if (markExistingId) {
        await api.updateMark(markExistingId, body);
      } else {
        await api.createMark({
          ...body,
          exam: Number(markForm.exam),
          subject: Number(markForm.subject),
          student: Number(markForm.student),
        });
      }
      setMarkOpen(false);
      setNotice("Mark saved.");
      if (String(markForm.exam) === String(resultsExamId)) {
        const data = await api.getExamResults(resultsExamId);
        setResults(asList(data));
      } else {
        setResultsExamId(markForm.exam);
      }
    } catch (err) {
      setMarkError(err.message);
    } finally {
      setMarkBusy(false);
    }
  }

  const count = items.length;
  const resultsExam = items.find((x) => String(x.id) === String(resultsExamId));
  const { subjects, rows } = useMemo(() => pivotSubjects(results), [results]);

  const visibleSubjects = resultView === "all" ? subjects : subjects.filter((name) => name === resultView);

  const visibleRows = rows.map((r) => {
    if (resultView === "all") return r;
    const selected = r.bySubject[resultView];
    if (!selected) return { ...r, obtained_total: 0, total_total: 0, percentage: 0 };
    const obtained = Number(selected.obtained_marks);
    const total = Number(selected.total_marks);
    return {
      ...r,
      obtained_total: obtained,
      total_total: total,
      percentage: total > 0 ? Math.round((obtained / total) * 10000) / 100 : 0,
    };
  });

  const classSubjects = useMemo(() => {
    const set = new Set();
    for (const r of classRows) for (const name of Object.keys(r.bySubject)) set.add(name);
    return [...set].sort();
  }, [classRows]);

  const selectedClassLabel = classes.find((c) => String(c.id) === String(classFilterId));

  const studentMatches = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return fullReportStudents.slice(0, 12);
    return fullReportStudents
      .filter(
        (s) =>
          String(s.student_name || "").toLowerCase().includes(q) ||
          String(s.roll_no || "").toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [fullReportStudents, studentSearch]);

  function switchMode(mode) {
    setResultsMode(mode);
    setResultsExamId("");
    setClassFilterId("");
  }

  return (
    <AppShell
      badge="Assessments"
      title="Exams & Results"
      subtitle={count + " exam" + (count === 1 ? "" : "s") + " registered"}
      action={tab === "exams" ? <AddButton onClick={openAdd}>+ Add New Exam</AddButton> : null}
    >
      <style>{sheetCss}</style>
      <div className="flex gap-2 print:hidden">
        <TabButton active={tab === "exams"} onClick={() => setTab("exams")}>
          Exams ({count})
        </TabButton>
        <TabButton active={tab === "results"} onClick={() => setTab("results")}>
          Results
        </TabButton>
      </div>

      <div className="space-y-3 print:hidden">
        <Notice>{pageError}</Notice>
        <Notice tone="success">{notice}</Notice>
      </div>

      {tab === "exams" ? (
        <div className="overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
          {loading ? (
            <p className="p-8 text-center text-sm font-medium text-keen-muted">Loading...</p>
          ) : count === 0 ? (
            <div className="p-10 text-center">
              <p className="text-base font-bold text-keen-charcoal">No exams yet</p>
              <p className="mt-1 text-sm text-keen-muted">Click "Add New Exam" to add the first one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white">
                    <th className="px-5 py-4">ID</th>
                    <th className="px-5 py-4">Exam</th>
                    <th className="px-5 py-4">Class</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-keen-border">
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-keen-muted">#{item.id}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold " +
                              toneFor(item.name)
                            }
                          >
                            {(item.name || "?")[0].toUpperCase()}
                          </div>
                          <div className="text-base font-bold text-keen-charcoal">{item.name}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {item.school_class_name ? (
                          <span className={"whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold " + toneFor(item.school_class_name)}>
                            {item.school_class_name}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-5 py-4 text-base text-keen-charcoal">{prettyDate(item.date)}</td>
                      <td className="px-5 py-4">
                        {item.date && item.date < today ? (
                          <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
                            Completed
                          </span>
                        ) : (
                          <span className="rounded-full border border-[#17E0E4] bg-[#E3FAFB] px-3 py-1 text-sm font-bold text-[#0A8F94]">
                            Upcoming
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <EditButton onClick={() => openEdit(item)} />
                          <DeleteButton onClick={() => remove(item)} busy={deletingId === item.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-1 border-b border-keen-border print:hidden">
            <ModeTab active={resultsMode === "exam"} onClick={() => switchMode("exam")}>By exam</ModeTab>
            <ModeTab active={resultsMode === "class"} onClick={() => switchMode("class")}>By class</ModeTab>
            <ModeTab active={resultsMode === "student"} onClick={() => switchMode("student")}>By student</ModeTab>
          </div>

          {resultsMode === "student" ? (
            <div className="space-y-4 print:hidden">
              <div className="max-w-md">
                <FormItem label="Search student" hint="Type a name or roll number">
                  <input
                    className={INPUT_CLS}
                    placeholder="e.g. Ali or KEEN-102"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    autoFocus
                  />
                </FormItem>
              </div>
              {fullReportError && <Notice>{fullReportError}</Notice>}
              <div className="overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
                {fullReportLoading ? (
                  <p className="p-8 text-center text-sm font-medium text-keen-muted">Loading students...</p>
                ) : studentMatches.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-base font-bold text-keen-charcoal">No students found</p>
                    <p className="mt-1 text-sm text-keen-muted">Try a different name or roll number.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-keen-border">
                    {studentMatches.map((s) => (
                      <button
                        key={s.student_id}
                        type="button"
                        onClick={() => setFullReportStudent(s)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold " + toneFor(s.student_name)}>
                            {(s.student_name || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-base font-bold text-keen-charcoal">{s.student_name}</div>
                            <div className="font-mono text-sm text-keen-muted">{s.roll_no || "-"}</div>
                          </div>
                        </div>
                        <span className="whitespace-nowrap rounded-lg bg-[#0A8F94] px-4 py-2 text-sm font-bold text-white">
                          View & print &rarr;
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : resultsMode === "class" ? (
            <>
              <div className="flex flex-wrap items-end gap-4 print:hidden">
                <FormItem label="Class">
                  <select className={INPUT_CLS} value={classFilterId} onChange={(e) => setClassFilterId(e.target.value)}>
                    <option value="">Select a class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {labelOf(c)}
                      </option>
                    ))}
                  </select>
                </FormItem>

                {classRows.length > 0 && (
                  <Button onClick={() => window.print()} className="px-4 py-2.5 text-sm">
                    Print class results
                  </Button>
                )}
              </div>

              <div className="print:hidden">
                <Notice>{classError}</Notice>
              </div>

              <div className="rs-printable overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
                {!classFilterId ? (
                  <div className="p-10 text-center print:hidden">
                    <p className="text-base font-bold text-keen-charcoal">Pick a class</p>
                    <p className="mt-1 text-sm text-keen-muted">Select a class above to see every student's combined results.</p>
                  </div>
                ) : classLoading ? (
                  <p className="p-8 text-center text-sm font-medium text-keen-muted print:hidden">Loading...</p>
                ) : classRows.length === 0 ? (
                  <div className="p-10 text-center print:hidden">
                    <p className="text-base font-bold text-keen-charcoal">No results yet</p>
                    <p className="mt-1 text-sm text-keen-muted">
                      No exams with marks have been recorded for {selectedClassLabel ? labelOf(selectedClassLabel) : "this class"} yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <h2 className="hidden px-5 pt-5 text-lg font-bold text-keen-charcoal print:block">
                      {selectedClassLabel ? labelOf(selectedClassLabel) : "Class"} — All subjects
                    </h2>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white print:bg-white print:text-keen-charcoal print:border-b-2 print:border-keen-charcoal">
                          <th className="px-5 py-4">Roll no.</th>
                          <th className="px-5 py-4">Student</th>
                          {classSubjects.map((name) => (
                            <th key={name} className="px-4 py-4 text-right">{name}</th>
                          ))}
                          <th className="px-5 py-4 text-right">Total</th>
                          <th className="px-5 py-4 text-right">%</th>
                          <th className="px-5 py-4 text-right">Grade</th>
                          <th className="px-5 py-4 print:hidden">Sheet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classRows.map((r) => (
                          <tr key={r.student_id} className="border-t border-keen-border">
                            <td className="px-5 py-4 font-mono text-sm text-keen-muted">{r.roll_no || "-"}</td>
                            <td className="px-5 py-4 text-base font-bold text-keen-charcoal">{r.student_name}</td>
                            {classSubjects.map((name) => (
                              <td key={name} className="px-4 py-4 text-right text-keen-charcoal">
                                {r.bySubject[name] ? fmt(r.bySubject[name].obtained_marks) : "-"}
                              </td>
                            ))}
                            <td className="px-5 py-4 text-right text-base text-keen-charcoal">
                              {fmt(r.obtained_total)}/{fmt(r.total_total)}
                            </td>
                            <td className="px-5 py-4 text-right text-base font-bold text-keen-charcoal">{r.percentage}%</td>
                            <td className="px-5 py-4 text-right">
                              <span className={"whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold " + toneFor(gradeFor(r.percentage))}>
                                {gradeFor(r.percentage)}
                              </span>
                            </td>
                            <td className="px-5 py-4 print:hidden">
                              <Button variant="quiet" onClick={() => setClassStudentSheet(r)} className="px-3 py-1.5 text-xs">
                                View / print
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4 print:hidden">
                <FormItem label="Exam">
                  <select className={INPUT_CLS} value={resultsExamId} onChange={(e) => setResultsExamId(e.target.value)}>
                    <option value="">Select an exam</option>
                    {items.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} ({prettyDate(x.date)})
                      </option>
                    ))}
                  </select>
                </FormItem>

                {subjects.length > 0 && (
                  <FormItem label="Subject">
                    <select className={INPUT_CLS} value={resultView} onChange={(e) => setResultView(e.target.value)} aria-label="Choose result view">
                      <option value="all">All subjects</option>
                      {subjects.map((name) => (
                        <option key={name} value={name}>
                          {name} only
                        </option>
                      ))}
                    </select>
                  </FormItem>
                )}

                <div className="flex gap-2">
                  <Button variant="quiet" onClick={openAddMark} className="px-4 py-2.5 text-sm">
                    + Add Mark
                  </Button>
                  {rows.length > 0 && (
                    <Button onClick={() => window.print()} className="px-4 py-2.5 text-sm">
                      {resultView === "all" ? "Print full results" : `Print ${resultView} results`}
                    </Button>
                  )}
                </div>
              </div>

              <div className="print:hidden">
                <Notice>{resultsError}</Notice>
              </div>

              <div className="rs-printable overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
                {!resultsExamId ? (
                  <div className="p-10 text-center print:hidden">
                    <p className="text-base font-bold text-keen-charcoal">Pick an exam</p>
                    <p className="mt-1 text-sm text-keen-muted">Select an exam above to see student results.</p>
                  </div>
                ) : resultsLoading ? (
                  <p className="p-8 text-center text-sm font-medium text-keen-muted print:hidden">Loading...</p>
                ) : rows.length === 0 ? (
                  <div className="p-10 text-center print:hidden">
                    <p className="text-base font-bold text-keen-charcoal">No marks yet</p>
                    <p className="mt-1 text-sm text-keen-muted">
                      No marks have been entered for {resultsExam?.name || "this exam"} yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <h2 className="hidden px-5 pt-5 text-lg font-bold text-keen-charcoal print:block">
                      {resultsExam?.name} — {prettyDate(resultsExam?.date)}
                    </h2>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white print:bg-white print:text-keen-charcoal print:border-b-2 print:border-keen-charcoal">
                          <th className="px-5 py-4">Roll no.</th>
                          <th className="px-5 py-4">Student</th>
                          {visibleSubjects.map((name) => (
                            <th key={name} className="px-4 py-4 text-right">
                              {name}
                              {resultView !== "all" && resultsExam?.date && (
                                <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>
                                  {prettyDate(visibleRows.find((r) => r.bySubject[name])?.bySubject[name]?.date || resultsExam.date)}
                                </div>
                              )}
                            </th>
                          ))}
                          <th className="px-5 py-4 text-right">Total</th>
                          <th className="px-5 py-4 text-right">%</th>
                          <th className="px-5 py-4 text-right">Grade</th>
                          <th className="px-5 py-4 print:hidden">Sheet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((r) => (
                          <tr key={r.student_id} className="border-t border-keen-border">
                            <td className="px-5 py-4 font-mono text-sm text-keen-muted">{r.roll_no || "-"}</td>
                            <td className="px-5 py-4 text-base font-bold text-keen-charcoal">{r.student_name}</td>
                            {subjects.map((name) => (
                              <td key={name} className="px-4 py-4 text-right text-keen-charcoal">
                                {r.bySubject[name] ? fmt(r.bySubject[name].obtained_marks) : "-"}
                              </td>
                            ))}
                            <td className="px-5 py-4 text-right text-base text-keen-charcoal">
                              {fmt(r.obtained_total)}/{fmt(r.total_total)}
                            </td>
                            <td className="px-5 py-4 text-right text-base font-bold text-keen-charcoal">{r.percentage}%</td>
                            <td className="px-5 py-4 text-right">
                              <span className={"whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold " + toneFor(gradeFor(r.percentage))}>
                                {gradeFor(r.percentage)}
                              </span>
                            </td>
                            <td className="px-5 py-4 print:hidden">
                              <Button variant="quiet" onClick={() => setSheetStudent(r)} className="px-3 py-1.5 text-xs">
                                View / print
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {fullReportStudent && (
        <FullStudentReportCard student={fullReportStudent} onClose={() => setFullReportStudent(null)} />
      )}

      {classStudentSheet && (
        <FullStudentReportCard student={classStudentSheet} onClose={() => setClassStudentSheet(null)} />
      )}

      {sheetStudent && (
        <StudentResultSheet
          student={sheetStudent}
          exam={resultsExam}
          subjects={subjects}
          initialView={resultView}
          onClose={() => setSheetStudent(null)}
        />
      )}

      <Modal
        open={markOpen}
        title="Add Mark"
        subtitle={"For " + (resultsExam?.name || "this exam")}
        onClose={() => setMarkOpen(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setMarkOpen(false)} className="px-4 py-2.5 text-sm">
              Cancel
            </Button>
            <Button onClick={submitMark} disabled={!markReady || markBusy} className="px-4 py-2.5 text-sm">
              {markBusy ? "Saving..." : "Add Mark"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormItem label="Exam" required>
              <select className={INPUT_CLS} value={markForm.exam} onChange={updateMarkField("exam")}>
                <option value="">Select an exam</option>
                {items.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({prettyDate(x.date)})
                  </option>
                ))}
              </select>
            </FormItem>
            <FormItem label="Subject" required>
              <select className={INPUT_CLS} value={markForm.subject} onChange={updateMarkField("subject")}>
                <option value="">Select a subject</option>
                {markSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? s.code + " - " + s.name : s.name}
                  </option>
                ))}
              </select>
            </FormItem>
            <FormItem label="Student" required>
              <select className={INPUT_CLS} value={markForm.student} onChange={updateMarkField("student")} disabled={!markForm.subject}>
                <option value="">{markForm.subject ? "Select a student" : "Pick a subject first"}</option>
                {markStudents.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.full_name || s.username}
                  </option>
                ))}
              </select>
            </FormItem>
            <FormItem label="Obtained marks" required>
              <input type="number" className={INPUT_CLS} value={markForm.obtained_marks} onChange={updateMarkField("obtained_marks")} />
            </FormItem>
            <FormItem label="Total marks" required>
              <input type="number" className={INPUT_CLS} value={markForm.total_marks} onChange={updateMarkField("total_marks")} />
            </FormItem>
            <FormItem label="Date (optional)" hint="Leave blank to use the exam date.">
              <input type="date" className={INPUT_CLS} value={markForm.date || ""} onChange={updateMarkField("date")} />
            </FormItem>
          </div>
          <Notice>{markError}</Notice>
        </div>
      </Modal>

      <Modal
        open={open}
        title={isEdit ? "Edit Exam" : "Add New Exam"}
        subtitle={isEdit ? "Update the exam details below" : "Fill in the exam details below"}
        onClose={close}
        footer={
          <>
            <Button variant="quiet" onClick={close} className="px-4 py-2.5 text-sm">
              Cancel
            </Button>
            <Button onClick={submit} disabled={!ready || busy} className="px-4 py-2.5 text-sm">
              {busy ? "Saving..." : isEdit ? "Save Changes" : "Add Exam"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormItem label="Exam name" required>
              <input className={INPUT_CLS} placeholder="e.g. Mid Term" value={form.name} onChange={update("name")} />
            </FormItem>
            <FormItem label="Date" required>
              <input type="date" className={INPUT_CLS} value={form.date} onChange={update("date")} />
            </FormItem>
            <FormItem label="Class">
              <select className={INPUT_CLS} value={form.school_class} onChange={update("school_class")}>
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {labelOf(c)}
                  </option>
                ))}
              </select>
            </FormItem>
          </div>
          <Notice>{formError}</Notice>
        </div>
      </Modal>
    </AppShell>
  );
}

const sheetCss = `
.rs-sheet { background: #fff; border: 1px solid #dfe5ec; border-top: 6px solid #0A8F94; border-radius: 10px; padding: 32px 36px; color: #1c2530; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.rs-head { text-align: center; padding-bottom: 14px; margin-bottom: 22px; border-bottom: 1px solid #dfe5ec; }
.rs-head h1 { margin: 0; font-size: 1.9rem; font-weight: 800; color: #0A8F94; letter-spacing: .01em; }
.rs-head p { margin: 4px 0 0; font-size: .8rem; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #5d6b7a; }
.rs-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; background: #E3FAFB; border: 1px solid #E3FAFB; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; }
.rs-info div { display: flex; flex-direction: column; gap: 2px; }
.rs-info span { font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #5d6b7a; }
.rs-info strong { font-size: 1rem; font-weight: 700; }
.rs-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: .92rem; }
.rs-table th { background: #0A8F94; color: #fff; text-align: left; padding: 10px 12px; font-size: .78rem; letter-spacing: .04em; text-transform: uppercase; }
.rs-table td { padding: 10px 12px; border-bottom: 1px solid #e6ebf2; }
.rs-table tbody tr:nth-child(even) td { background: #E3FAFB; }
.rs-table .num { text-align: right; }
.rs-pill { display: inline-block; min-width: 32px; text-align: center; padding: 2px 8px; border-radius: 999px; background: #E3FAFB; color: #0A8F94; font-weight: 800; font-size: .8rem; }
.rs-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
.rs-summary div { border: 1px solid #E3FAFB; background: #E3FAFB; border-radius: 8px; padding: 12px 14px; text-align: center; }
.rs-summary span { display: block; font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #5d6b7a; margin-bottom: 4px; }
.rs-summary strong { font-size: 1.35rem; font-weight: 800; color: #0A8F94; }
.rs-remarks { border: 1px solid #dfe5ec; border-radius: 8px; min-height: 70px; padding: 10px 14px; margin-bottom: 44px; }
.rs-remarks span { font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #5d6b7a; }
.rs-sign { display: flex; justify-content: space-between; gap: 24px; }
.rs-sign span { flex: 1; padding-top: 6px; border-top: 1px solid #1c2530; text-align: center; font-size: .82rem; }
@media print {
  @page { size: A4; margin: 15mm; }
  body * { visibility: hidden; }
  .rs-sheet, .rs-sheet *, .rs-printable, .rs-printable * { visibility: visible; }
  .rs-sheet { position: absolute; left: 0; top: 0; width: 100%; border: 0; border-top: 6px solid #0A8F94; border-radius: 0; padding: 12px 0 0; }
  .rs-printable { position: absolute; left: 0; top: 0; width: 100%; border: 0; box-shadow: none; }
}
`;