import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const LABEL = { present: "Present", absent: "Absent", late: "Late", leave: "Leave" };
const titleCase = (s) =>
  (s || "").toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
};
const fmtDate = (iso) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

export default function AttendanceByDate() {
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
          <input type="date" value={day} max={todayStr()} onChange={(e) => e.target.value && setDay(e.target.value)} />
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

      {error && <div className="at-msg at-err">{error}</div>}
      {loading && <p className="at-muted">Loading attendance...</p>}

      {!loading && !error && (
        <>
          <p className="at-dateline">{fmtDate(day)}</p>
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
              <div key={sh.school_class} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "1.05rem" }}>{sh.class_label}</h3>
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
                              {s.status ? (
                                <span className={"at-pill at-st-" + s.status}>{LABEL[s.status]}</span>
                              ) : (
                                <span className="at-pill at-st-none">Not marked</span>
                              )}
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