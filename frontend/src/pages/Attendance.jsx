import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, loadSession } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/ui";

const STATUSES = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "leave", label: "Leave" },
];
const labelOf = (v) => STATUSES.find((s) => s.value === v)?.label ?? "-";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const titleCase = (s) =>
  (s || "").toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());

const pad = (n) => String(n).padStart(2, "0");
const isoOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const todayStr = () => isoOf(new Date());
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoOf(d);
};
const monthStart = () => todayStr().slice(0, 8) + "01";
const fmtDate = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
const fmtLong = (iso) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
const fmtShort = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtClock = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
const fmtStamp = () =>
  new Date().toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

// The signed-in user's id, read from the login token, for the student's own view.
function userIdFromToken() {
  try {
    const token = loadSession()?.access;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.user_id ?? null;
  } catch {
    return null;
  }
}

function StatusPill({ status }) {
  if (!status) return <span className="at-pill at-st-none">Not marked</span>;
  return <span className={"at-pill at-st-" + status}>{labelOf(status)}</span>;
}

export default function Attendance() {
  const { role } = useAuth();
  const isStudent = role === "student";
  const [tab, setTab] = useState("class");

  return (
    <AppShell
      title={isStudent ? "My attendance" : "Attendance"}
      subtitle={
        isStudent
          ? "Your attendance record."
          : tab === "class"
          ? "Mark attendance for a class and print the sheet."
          : tab === "date"
          ? "See saved attendance for any past date."
          : "Look up any student's attendance history."
      }
    >
      <style>{css}</style>
      <div className="at">
        {isStudent ? (
          <StudentHistory userId={userIdFromToken()} />
        ) : (
          <>
            <div className="at-tabs at-noprint" role="tablist" aria-label="Attendance sections">
              <button type="button" role="tab" className="at-tab" aria-selected={tab === "class"} onClick={() => setTab("class")}>
                By class
              </button>
              <button type="button" role="tab" className="at-tab" aria-selected={tab === "date"} onClick={() => setTab("date")}>
                By date
              </button>
              <button type="button" role="tab" className="at-tab" aria-selected={tab === "search"} onClick={() => setTab("search")}>
                Search student
              </button>
            </div>
            {tab === "class" ? <ClassSheet /> : tab === "date" ? <ByDate /> : <SearchStudent />}
          </>
        )}
      </div>
    </AppShell>
  );
}

function ClassSheet() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [day, setDay] = useState(todayStr());
  const [sheet, setSheet] = useState(null);
  const [draft, setDraft] = useState({});
  const [loadingBase, setLoadingBase] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const reqRef = useRef(0);

  const applySheet = (data) => {
    setSheet(data);
    const d = {};
    for (const s of data.students) if (s.status) d[s.student] = { status: s.status, note: s.note || "" };
    setDraft(d);
  };

  useEffect(() => {
    let alive = true;
    api
      .attendanceClasses()
      .then((data) => {
        if (!alive) return;
        const list = asList(data);
        setClasses(list);
        if (list.length) setClassId(String(list[0].id));
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoadingBase(false));
    return () => {
      alive = false;
    };
  }, []);

  const loadSheet = useCallback(async () => {
    if (!classId || !day) {
      setSheet(null);
      setDraft({});
      return;
    }
    const id = ++reqRef.current;
    setLoading(true);
    setError("");
    try {
      const data = await api.attendanceSheet(classId, day);
      if (id === reqRef.current) applySheet(data);
    } catch (e) {
      if (id === reqRef.current) {
        setError(e.message);
        setSheet(null);
      }
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [classId, day]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const students = sheet?.students ?? [];

  const dirty = students.some((s) => {
    const d = draft[s.student];
    return (d?.status ?? null) !== (s.status ?? null) || (d?.note ?? "") !== (s.note ?? "");
  });

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0, unmarked: 0 };
    for (const s of students) {
      const st = draft[s.student]?.status;
      if (st) c[st] += 1;
      else c.unmarked += 1;
    }
    return c;
  }, [students, draft]);

  const markedCount = students.length - counts.unmarked;

  const confirmLeave = () => !dirty || window.confirm("You have unsaved attendance. Discard it?");
  const pickClass = (v) => {
    if (confirmLeave()) {
      setNotice("");
      setClassId(v);
    }
  };
  const pickDay = (v) => {
    if (v && confirmLeave()) {
      setNotice("");
      setDay(v);
    }
  };

  const setStatus = (id, status) => {
    setNotice("");
    setDraft((d) => {
      const cur = d[id] || { status: null, note: "" };
      return { ...d, [id]: { ...cur, status: cur.status === status ? null : status } };
    });
  };
  const setNote = (id, note) => {
    setNotice("");
    setDraft((d) => ({ ...d, [id]: { status: d[id]?.status ?? null, note } }));
  };
  const markAllPresent = () => {
    setNotice("");
    setDraft((d) => {
      const next = { ...d };
      for (const s of students) next[s.student] = { status: "present", note: d[s.student]?.note ?? "" };
      return next;
    });
  };

  async function save() {
    const records = students
      .filter((s) => draft[s.student]?.status)
      .map((s) => ({ student: s.student, status: draft[s.student].status, note: (draft[s.student].note || "").trim() }));
    if (records.length === 0) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await api.saveAttendance({ school_class: Number(classId), date: day, records });
      applySheet(data);
      setNotice("Saved attendance for " + records.length + " student" + (records.length === 1 ? "" : "s") + ".");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="at-controls at-noprint">
        <label>
          Class
          <select value={classId} onChange={(e) => pickClass(e.target.value)} disabled={loadingBase}>
            {classes.length === 0 && <option value="">{loadingBase ? "Loading..." : "No classes"}</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" value={day} max={todayStr()} onChange={(e) => pickDay(e.target.value)} />
        </label>
        <div className="at-actions">
          <button type="button" className="at-btn" onClick={markAllPresent} disabled={students.length === 0}>
            Mark all present
          </button>
          <button type="button" className="at-btn" onClick={() => window.print()} disabled={students.length === 0}>
            Print class attendance
          </button>
          <button type="button" className="at-btn at-btn-primary" onClick={save} disabled={saving || !dirty || markedCount === 0}>
            {saving ? "Saving..." : "Save attendance"}
          </button>
        </div>
      </div>

      {error && (
        <div className="at-msg at-err at-noprint" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="at-msg at-ok at-noprint" role="status">
          {notice}
        </div>
      )}

      {!loadingBase && classes.length === 0 && !error && (
        <p className="at-muted at-noprint">
          No classes available. A teacher sees the classes of their own subjects, so ask the admin to assign one.
        </p>
      )}
      {loading && <p className="at-muted at-noprint">Loading class list...</p>}
      {sheet && !loading && students.length === 0 && (
        <p className="at-muted at-noprint">
          No registered students in this class yet. Students appear here after they register with their roll number.
        </p>
      )}

      {students.length > 0 && (
        <>
          <div className="at-noprint">
            <p className="at-dateline">
              {sheet.weekday}, {fmtDate(sheet.date)}
              {sheet.marked_at && (
                <span className="at-muted">
                  {" "}
                  &middot; last saved {fmtClock(sheet.marked_at)}
                  {sheet.marked_by ? " by " + titleCase(sheet.marked_by) : ""}
                </span>
              )}
            </p>
            <div className="at-chips">
              <span className="at-chip at-st-present">Present {counts.present}</span>
              <span className="at-chip at-st-absent">Absent {counts.absent}</span>
              <span className="at-chip at-st-late">Late {counts.late}</span>
              <span className="at-chip at-st-leave">Leave {counts.leave}</span>
              <span className="at-chip at-st-none">Not marked {counts.unmarked}</span>
              {dirty && <span className="at-unsaved">Unsaved changes</span>}
            </div>

            <div className="at-wrap">
              <table className="at-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Roll no.</th>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const cur = draft[s.student]?.status ?? null;
                    return (
                      <tr key={s.student}>
                        <td>{i + 1}</td>
                        <td>{s.roll_no}</td>
                        <td className="at-name">{titleCase(s.name)}</td>
                        <td>
                          <div className="at-seg" role="group" aria-label={"Status for " + s.name}>
                            {STATUSES.map((st) => (
                              <button
                                key={st.value}
                                type="button"
                                aria-pressed={cur === st.value}
                                className={"s-" + st.value}
                                onClick={() => setStatus(s.student, st.value)}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input
                            className="at-note"
                            value={draft[s.student]?.note ?? ""}
                            maxLength={200}
                            placeholder="Optional"
                            onChange={(e) => setNote(s.student, e.target.value)}
                            aria-label={"Note for " + s.name}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <article className="at-print">
            <header>
              <h1>KEEN Evening Coaching</h1>
              <p>Class attendance sheet</p>
            </header>
            <dl className="at-print-meta">
              <div>
                <dt>Class</dt>
                <dd>{sheet.class_label}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{fmtDate(sheet.date)}</dd>
              </div>
              <div>
                <dt>Day</dt>
                <dd>{sheet.weekday}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{sheet.marked_at ? fmtClock(sheet.marked_at) : "Not saved yet"}</dd>
              </div>
              {sheet.marked_by && (
                <div>
                  <dt>Marked by</dt>
                  <dd>{titleCase(sheet.marked_by)}</dd>
                </div>
              )}
            </dl>
            <table className="at-print-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Roll no.</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.student}>
                    <td>{i + 1}</td>
                    <td>{s.roll_no}</td>
                    <td>{titleCase(s.name)}</td>
                    <td>{draft[s.student]?.status ? labelOf(draft[s.student].status) : "-"}</td>
                    <td>{draft[s.student]?.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="at-print-totals">
              Present {counts.present}, Absent {counts.absent}, Late {counts.late}, Leave {counts.leave}, Not marked{" "}
              {counts.unmarked}. Total students {students.length}.
            </p>
            <p className="at-print-stamp">Printed on {fmtStamp()}</p>
            <div className="at-sign">
              <span>Class teacher</span>
              <span>Principal</span>
            </div>
          </article>
        </>
      )}
    </div>
  );
}

// Read-only view: pick a past date and see every class's saved attendance for that day.
function ByDate() {
  const [day, setDay] = useState(todayStr());
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const classes = asList(await api.attendanceClasses());
        const all = await Promise.all(classes.map((c) => api.attendanceSheet(c.id, day)));
        if (alive) setSheets(all);
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [day]);

  const visible = useMemo(
    () => sheets.filter((s) => !classFilter || String(s.school_class) === classFilter),
    [sheets, classFilter]
  );

  const totals = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0, none: 0 };
    for (const sh of visible)
      for (const s of sh.students) {
        if (s.status) c[s.status] += 1;
        else c.none += 1;
      }
    return c;
  }, [visible]);

  return (
    <div>
      <div className="at-controls">
        <label>
          Date
          <input
            type="date"
            value={day}
            max={todayStr()}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
        </label>
        <label>
          Class
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All classes</option>
            {sheets.map((s) => (
              <option key={s.school_class} value={s.school_class}>
                {s.class_label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="leave">Leave</option>
            <option value="none">Not marked</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="at-msg at-err" role="alert">
          {error}
        </div>
      )}
      {loading && <p className="at-muted">Loading attendance...</p>}

      {!loading && !error && (
        <>
          <p className="at-dateline">{fmtLong(day)}</p>
          <div className="at-chips">
            <span className="at-chip at-st-present">Present {totals.present}</span>
            <span className="at-chip at-st-absent">Absent {totals.absent}</span>
            <span className="at-chip at-st-late">Late {totals.late}</span>
            <span className="at-chip at-st-leave">Leave {totals.leave}</span>
            <span className="at-chip at-st-none">Not marked {totals.none}</span>
          </div>

          {visible.length === 0 && <p className="at-muted">No classes found.</p>}

          {visible.map((sh) => {
            const rows = sh.students.filter((s) =>
              !statusFilter ? true : statusFilter === "none" ? !s.status : s.status === statusFilter
            );
            if (statusFilter && rows.length === 0) return null;
            return (
              <div key={sh.school_class} className="at-block">
                <h3 className="at-block-title">{sh.class_label}</h3>
                {sh.students.length === 0 ? (
                  <p className="at-muted">No registered students in this class.</p>
                ) : (
                  <div className="at-wrap">
                    <table className="at-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Roll no.</th>
                          <th>Student</th>
                          <th>Status</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((s, i) => (
                          <tr key={s.student}>
                            <td>{i + 1}</td>
                            <td>{s.roll_no}</td>
                            <td className="at-name">{titleCase(s.name)}</td>
                            <td>
                              <StatusPill status={s.status} />
                            </td>
                            <td>{s.note || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function SearchStudent() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const reqRef = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++reqRef.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchAttendanceStudents(text);
        if (id === reqRef.current) {
          setResults(asList(data));
          setError("");
        }
      } catch (e) {
        if (id === reqRef.current) setError(e.message);
      } finally {
        if (id === reqRef.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div>
      <div className="at-controls">
        <label className="at-search">
          Student name or roll number
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type at least 2 letters"
            autoFocus
          />
        </label>
      </div>

      {error && (
        <div className="at-msg at-err" role="alert">
          {error}
        </div>
      )}
      {q.trim().length >= 2 && !searching && results.length === 0 && !error && (
        <p className="at-muted">No students match "{q.trim()}".</p>
      )}
      {results.length > 0 && (
        <ul className="at-results">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={selected?.id === r.id ? "at-result at-result-on" : "at-result"}
                onClick={() => setSelected(r)}
              >
                <span className="at-result-name">{titleCase(r.name)}</span>
                <span className="at-muted">
                  {r.roll_no}
                  {r.class_label ? " - " + r.class_label : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <>
          <MarkStudent key={"mark-" + selected.id} student={selected} onSaved={() => setVersion((v) => v + 1)} />
          <StudentHistory key={selected.id + "-" + version} userId={selected.id} />
        </>
      )}
    </div>
  );
}

// Mark (or change) one student's attendance for a chosen date, straight from the search tab.
function MarkStudent({ student, onSaved }) {
  const [day, setDay] = useState(todayStr());
  const [classId, setClassId] = useState(undefined); // undefined = looking up, null = not found
  const [status, setStatus] = useState(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // the search result only carries the class name, so find its id in the class list
  useEffect(() => {
    let alive = true;
    api
      .attendanceClasses()
      .then((d) => {
        if (!alive) return;
        const match = asList(d).find((c) => c.label === student.class_label);
        setClassId(match ? match.id : null);
        if (!match) setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setClassId(null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [student.class_label]);

  // load what is already saved for the chosen day
  useEffect(() => {
    if (!classId) return;
    let alive = true;
    setLoading(true);
    setError("");
    setNotice("");
    api
      .attendanceSheet(classId, day)
      .then((sheet) => {
        if (!alive) return;
        const row = sheet.students.find((s) => s.student === student.id);
        setSaved(row?.status ? { status: row.status, note: row.note || "" } : null);
        setStatus(row?.status ?? null);
        setNote(row?.note || "");
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [classId, day, student.id]);

  const dirty = status !== (saved?.status ?? null) || note.trim() !== (saved?.note ?? "");

  async function save() {
    if (!status || !classId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.saveAttendance({
        school_class: Number(classId),
        date: day,
        records: [{ student: student.id, status, note: note.trim() }],
      });
      setSaved({ status, note: note.trim() });
      setNotice("Saved " + labelOf(status) + " for " + titleCase(student.name) + " on " + fmtShort(day) + ".");
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="at-mark">
      <div className="at-mark-head">
        <h3>
          Mark attendance: {titleCase(student.name)}
          <span className="at-muted">
            {" "}
            ({student.roll_no}
            {student.class_label ? ", " + student.class_label : ""})
          </span>
        </h3>
        {saved && (
          <span className="at-muted">
            Already marked <StatusPill status={saved.status} />
          </span>
        )}
      </div>

      {classId === null && (
        <p className="at-muted">Could not find this student's class here. Use the By class tab to mark attendance.</p>
      )}

      {classId && (
        <>
          <div className="at-controls">
            <label>
              Date
              <input type="date" value={day} max={todayStr()} onChange={(e) => e.target.value && setDay(e.target.value)} />
            </label>
            <div className="at-field">
              <span>Status</span>
              <div className="at-seg" role="group" aria-label="Status">
                {STATUSES.map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    aria-pressed={status === st.value}
                    className={"s-" + st.value}
                    onClick={() => {
                      setNotice("");
                      setStatus(st.value);
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="at-mark-note">
              Note
              <input
                value={note}
                maxLength={200}
                placeholder="Optional"
                onChange={(e) => {
                  setNotice("");
                  setNote(e.target.value);
                }}
              />
            </label>
            <button
              type="button"
              className="at-btn at-btn-primary"
              onClick={save}
              disabled={saving || loading || !status || !dirty}
            >
              {saving ? "Saving..." : "Save attendance"}
            </button>
          </div>
          {loading && <p className="at-muted">Loading...</p>}
        </>
      )}

      {error && (
        <div className="at-msg at-err" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="at-msg at-ok" role="status" style={{ marginTop: 12, marginBottom: 0 }}>
          {notice}
        </div>
      )}
    </div>
  );
}

function StudentHistory({ userId }) {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    setError("");
    api
      .attendanceHistory(userId, from, to)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId, from, to]);

  const preset = (key) => {
    if (key === "7") {
      setFrom(daysAgo(6));
      setTo(todayStr());
    } else if (key === "30") {
      setFrom(daysAgo(29));
      setTo(todayStr());
    } else if (key === "month") {
      setFrom(monthStart());
      setTo(todayStr());
    } else {
      setFrom("");
      setTo("");
    }
  };

  if (!userId) {
    return <p className="at-muted">Could not tell which student you are. Sign out and sign in again.</p>;
  }

  const sm = data?.summary;
  const pct = sm?.percent;

  return (
    <div className="at-history">
      {data && (
        <div className="at-student">
          <h2>{titleCase(data.student.name)}</h2>
          <p className="at-muted">
            {data.student.roll_no}
            {data.student.class_label ? " - " + data.student.class_label : ""}
          </p>
        </div>
      )}

      <div className="at-controls">
        <label>
          From
          <input type="date" value={from} max={to || todayStr()} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from || undefined} max={todayStr()} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="at-actions">
          <button type="button" className="at-btn" onClick={() => preset("7")}>
            Last 7 days
          </button>
          <button type="button" className="at-btn" onClick={() => preset("30")}>
            Last 30 days
          </button>
          <button type="button" className="at-btn" onClick={() => preset("month")}>
            This month
          </button>
          <button type="button" className="at-btn" onClick={() => preset("all")}>
            All time
          </button>
        </div>
      </div>

      {error && (
        <div className="at-msg at-err" role="alert">
          {error}
        </div>
      )}
      {loading && <p className="at-muted">Loading attendance...</p>}

      {sm && !loading && (
        <>
          <div className="at-cards">
            <div className="at-card">
              <span>Present</span>
              <strong>{sm.present}</strong>
            </div>
            <div className="at-card">
              <span>Absent</span>
              <strong>{sm.absent}</strong>
            </div>
            <div className="at-card">
              <span>Late</span>
              <strong>{sm.late}</strong>
            </div>
            <div className="at-card">
              <span>Leave</span>
              <strong>{sm.leave}</strong>
            </div>
            <div className="at-card at-card-pct">
              <span>Attendance</span>
              <strong className={pct !== null && pct < 75 ? "at-low" : ""}>{pct === null ? "-" : pct + "%"}</strong>
              <div className="at-bar">
                <div className={"at-bar-fill" + (pct !== null && pct < 75 ? " at-bar-low" : "")} style={{ width: (pct || 0) + "%" }} />
              </div>
            </div>
          </div>
          <p className="at-muted at-hint">Attendance counts Present and Late days out of all days marked.</p>

          {data.records.length === 0 ? (
            <p className="at-muted">No attendance has been marked in this period.</p>
          ) : (
            <div className="at-wrap">
              <table className="at-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Status</th>
                    <th>Time marked</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.date}>
                      <td>{fmtShort(r.date)}</td>
                      <td>{r.weekday}</td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td>{fmtClock(r.marked_at)}</td>
                      <td>{r.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const css = `
.at { --at-line: #d9dfe6; --at-muted: #5d6b7a; --at-accent: #1f4e8c; }
.at-muted { color: var(--at-muted); }
.at-hint { font-size: .85rem; margin: 6px 0 16px; }
.at-tabs { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid var(--at-line); }
.at-tab { margin-bottom: -1px; padding: 10px 20px; font: inherit; font-weight: 600; color: var(--at-muted); background: none; border: 0; border-bottom: 3px solid transparent; cursor: pointer; }
.at-tab:hover { color: #1c2530; }
.at-tab[aria-selected="true"] { color: var(--at-accent); border-bottom-color: var(--at-accent); }
.at-controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; margin-bottom: 18px; }
.at-controls label { display: flex; flex-direction: column; gap: 6px; font-size: .9rem; font-weight: 600; }
.at select, .at input { padding: 8px 10px; font: inherit; font-weight: 400; border: 1px solid var(--at-line); border-radius: 6px; background: #fff; }
.at-controls select { min-width: 200px; }
.at-search { flex: 1; max-width: 420px; }
.at-search input { width: 100%; }
.at-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-left: auto; }
.at-btn { padding: 9px 16px; font: inherit; font-weight: 700; color: #1c2530; background: #fff; border: 1px solid var(--at-line); border-radius: 8px; cursor: pointer; }
.at-btn-primary { color: #fff; background: var(--at-accent); border-color: var(--at-accent); }
.at-btn:disabled { opacity: .55; cursor: not-allowed; }
.at select:focus-visible, .at input:focus-visible, .at button:focus-visible { outline: 2px solid var(--at-accent); outline-offset: 2px; }
.at-msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; font-size: .95rem; }
.at-err { background: #fdecea; color: #b3261e; }
.at-ok { background: #e7f4ec; color: #1e6b3a; }
.at-dateline { margin: 0 0 10px; font-size: 1.05rem; font-weight: 700; }
.at-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 14px; }
.at-chip, .at-pill { padding: 3px 12px; border-radius: 999px; font-size: .8rem; font-weight: 600; }
.at-unsaved { margin-left: 6px; font-size: .85rem; font-weight: 600; color: #b54708; }
.at-st-present { background: #e7f4ec; color: #1e6b3a; }
.at-st-absent { background: #fdecea; color: #b3261e; }
.at-st-late { background: #fff4d6; color: #7a5a00; }
.at-st-leave { background: #e8f0fc; color: #1d4ed8; }
.at-st-none { background: #eef0f3; color: #5d6b7a; }
.at-block { margin-bottom: 22px; }
.at-block-title { margin: 0 0 8px; font-size: 1.05rem; }
.at-wrap { overflow-x: auto; border: 1px solid var(--at-line); border-radius: 8px; background: #fff; }
.at-table { width: 100%; border-collapse: collapse; }
.at-table th, .at-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--at-line); }
.at-table tbody tr:last-child td { border-bottom: 0; }
.at-table th { font-size: .85rem; color: var(--at-muted); font-weight: 600; background: #f6f8fa; }
.at-name { font-weight: 600; }
.at-seg { display: inline-flex; border: 1px solid var(--at-line); border-radius: 8px; overflow: hidden; }
.at-seg button { padding: 6px 12px; font: inherit; font-size: .8rem; font-weight: 600; color: #475467; background: #fff; border: 0; border-right: 1px solid var(--at-line); cursor: pointer; }
.at-seg button:last-child { border-right: 0; }
.at-seg button:hover { background: #f6f8fa; }
.at-seg button[aria-pressed="true"].s-present { background: #e7f4ec; color: #1e6b3a; }
.at-seg button[aria-pressed="true"].s-absent { background: #fdecea; color: #b3261e; }
.at-seg button[aria-pressed="true"].s-late { background: #fff4d6; color: #7a5a00; }
.at-seg button[aria-pressed="true"].s-leave { background: #e8f0fc; color: #1d4ed8; }
.at-note { width: 100%; min-width: 140px; }
.at-results { list-style: none; margin: 0 0 24px; padding: 0; max-width: 520px; border: 1px solid var(--at-line); border-radius: 8px; background: #fff; overflow: hidden; }
.at-results li + li { border-top: 1px solid var(--at-line); }
.at-result { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 10px 14px; font: inherit; text-align: left; background: #fff; border: 0; cursor: pointer; }
.at-result:hover, .at-result-on { background: #eef4fb; }
.at-result-name { font-weight: 700; }
.at-student h2 { margin: 0; font-size: 1.3rem; }
.at-student p { margin: 2px 0 16px; }
.at-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-top: 8px; }
.at-card { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; background: #fff; border: 1px solid var(--at-line); border-radius: 12px; }
.at-card span { font-size: .8rem; color: var(--at-muted); }
.at-card strong { font-size: 1.6rem; }
.at-low { color: #b3261e; }
.at-bar { height: 6px; background: #e6ecf1; border-radius: 999px; overflow: hidden; }
.at-bar-fill { height: 100%; background: #1e8e5a; }
.at-bar-low { background: #dc2626; }
.at-mark { background: #fff; border: 1px solid var(--at-line); border-radius: 12px; padding: 16px 18px; margin: 4px 0 22px; }
.at-mark-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.at-mark-head h3 { margin: 0; font-size: 1.05rem; }
.at-mark .at-controls { margin-bottom: 0; }
.at-field { display: flex; flex-direction: column; gap: 6px; font-size: .9rem; font-weight: 600; }
.at-mark-note { flex: 1; min-width: 180px; }
.at-mark-note input { width: 100%; }
.at-print { display: none; }
@media print {
  @page { size: A4; margin: 15mm; }
  body * { visibility: hidden; }
  .at-print, .at-print * { visibility: visible; }
  .at-print { display: block; position: absolute; left: 0; top: 0; width: 100%; color: #1c2530; font-size: 11pt; }
  .at-noprint { display: none !important; }
  .at-print header { text-align: center; border-bottom: 2px solid #1c2530; padding-bottom: 10px; margin-bottom: 14px; }
  .at-print h1 { margin: 0; font-size: 1.5rem; }
  .at-print header p { margin: 4px 0 0; }
  .at-print-meta { display: flex; flex-wrap: wrap; gap: 6px 28px; margin: 0 0 14px; }
  .at-print-meta div { display: flex; gap: 8px; }
  .at-print-meta dt { color: #5d6b7a; }
  .at-print-meta dd { margin: 0; font-weight: 600; }
  .at-print-table { width: 100%; border-collapse: collapse; }
  .at-print-table th, .at-print-table td { padding: 6px 8px; text-align: left; border: 1px solid #999; }
  .at-print-table th { background: #eee; }
  .at-print-totals { margin: 12px 0 0; font-weight: 600; }
  .at-print-stamp { margin: 6px 0 0; font-size: 9pt; color: #5d6b7a; }
  .at-sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 70px; }
  .at-sign span { flex: 1; padding-top: 6px; border-top: 1px solid #1c2530; text-align: center; font-size: .85rem; }
}
`;