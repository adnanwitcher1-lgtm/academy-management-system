import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const OPTIONS = [
  ["present", "Present", "bg-emerald-600 text-white border-emerald-600"],
  ["absent", "Absent", "bg-red-600 text-white border-red-600"],
  ["late", "Late", "bg-amber-500 text-white border-amber-500"],
  ["leave", "Leave", "bg-sky-600 text-white border-sky-600"],
];

const BADGE = {
  present: "bg-emerald-100 text-emerald-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-amber-100 text-amber-700",
  leave: "bg-sky-100 text-sky-700",
  none: "bg-slate-100 text-slate-500",
};

const LABEL = { present: "Present", absent: "Absent", late: "Late", leave: "Leave", none: "Not marked" };

const localDay = (daysAgo = 0) =>
  new Date(Date.now() - daysAgo * 86400000).toLocaleDateString("en-CA");

const fmtLong = (iso) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

function Chip({ label, value, cls }) {
  return (
    <span className={"rounded-full px-3 py-1 text-xs font-bold " + cls}>
      {label}: {value}
    </span>
  );
}

export default function TeacherAttendanceModal({ onClose }) {
  const [tab, setTab] = useState("mark");

  // ---- mark tab ----
  const [day, setDay] = useState(localDay());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // ---- by-date tab (read-only) ----
  const [viewDay, setViewDay] = useState(localDay());
  const [viewRows, setViewRows] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewStatus, setViewStatus] = useState("");

  // ---- history tab (date range) ----
  const [histTeacher, setHistTeacher] = useState("");
  const [from, setFrom] = useState(localDay(30));
  const [to, setTo] = useState(localDay());
  const [hist, setHist] = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await api.teacherAttendanceSheet(day);
      setRows(res.rows || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  const loadView = useCallback(async () => {
    setViewLoading(true);
    setViewError("");
    try {
      const res = await api.teacherAttendanceSheet(viewDay);
      setViewRows(res.rows || []);
    } catch (e) {
      setViewError(e.message);
    } finally {
      setViewLoading(false);
    }
  }, [viewDay]);

  useEffect(() => {
    if (tab === "date") loadView();
  }, [tab, loadView]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    setHistError("");
    try {
      const params = { from, to };
      if (histTeacher) params.teacher = histTeacher;
      setHist(await api.teacherAttendanceHistory(params));
    } catch (e) {
      setHistError(e.message);
    } finally {
      setHistLoading(false);
    }
  }, [histTeacher, from, to]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  const setField = (id, field, value) =>
    setRows((list) => list.map((r) => (r.teacher === id ? { ...r, [field]: value } : r)));

  const markAllPresent = () =>
    setRows((list) => list.map((r) => ({ ...r, status: r.status || "present" })));

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const entries = rows
        .filter((r) => r.status)
        .map((r) => ({ teacher: r.teacher, status: r.status, note: r.note }));
      const res = await api.saveTeacherAttendance({ date: day, entries });
      setNotice(`Saved attendance for ${res.saved} teacher(s).`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const unmarked = rows.filter((r) => !r.status).length;

  const viewTotals = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0, none: 0 };
    for (const r of viewRows) {
      if (r.status) c[r.status] += 1;
      else c.none += 1;
    }
    return c;
  }, [viewRows]);

  const viewVisible = viewRows.filter((r) =>
    !viewStatus ? true : viewStatus === "none" ? !r.status : r.status === viewStatus
  );

  const tabClass = (name) =>
    "px-4 py-2 text-sm font-bold border-b-2 " +
    (tab === name ? "border-keen-charcoal text-keen-charcoal" : "border-transparent text-slate-400");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 pt-4">
          <div className="flex gap-2">
            <button type="button" className={tabClass("mark")} onClick={() => setTab("mark")}>
              Mark Attendance
            </button>
            <button type="button" className={tabClass("date")} onClick={() => setTab("date")}>
              By date
            </button>
            <button type="button" className={tabClass("history")} onClick={() => setTab("history")}>
              Teacher history
            </button>
          </div>
          <button type="button" onClick={onClose} className="pb-2 text-2xl leading-none text-slate-400">
            &times;
          </button>
        </div>

        {/* ================= MARK ================= */}
        {tab === "mark" && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-3">
              <input
                type="date"
                value={day}
                onChange={(e) => e.target.value && setDay(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={markAllPresent}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-keen-charcoal hover:bg-slate-50"
              >
                Mark unmarked as Present
              </button>
              <span className="ml-auto text-xs text-slate-500">
                {rows.length} teachers{unmarked ? ` · ${unmarked} unmarked` : ""}
              </span>
            </div>

            {error && <div className="mx-6 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {notice && <div className="mx-6 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

            <div className="flex-1 overflow-y-auto px-6 py-3">
              {loading && <p className="py-8 text-center text-sm text-slate-400">Loading...</p>}
              {!loading && rows.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">No teachers found.</p>
              )}
              {!loading &&
                rows.map((r) => (
                  <div
                    key={r.teacher}
                    className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-3 last:border-0"
                  >
                    <div className="w-44 text-sm font-semibold text-keen-charcoal">{r.name}</div>
                    <div className="flex gap-1.5">
                      {OPTIONS.map(([value, label, active]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setField(r.teacher, "status", value)}
                          className={
                            "rounded-lg border px-3 py-1.5 text-xs font-bold " +
                            (r.status === value ? active : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      maxLength={200}
                      placeholder="Note (optional)"
                      value={r.note}
                      onChange={(e) => setField(r.teacher, "note", e.target.value)}
                      className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                    />
                  </div>
                ))}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-keen-charcoal"
              >
                Close
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || loading}
                className="rounded-xl bg-keen-charcoal px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Attendance"}
              </button>
            </div>
          </>
        )}

        {/* ================= BY DATE ================= */}
        {tab === "date" && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                Date
                <input
                  type="date"
                  value={viewDay}
                  max={localDay()}
                  onChange={(e) => e.target.value && setViewDay(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                Status
                <select
                  value={viewStatus}
                  onChange={(e) => setViewStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">All</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="leave">Leave</option>
                  <option value="none">Not marked</option>
                </select>
              </label>
            </div>

            {viewError && (
              <div className="mx-6 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{viewError}</div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-3">
              {viewLoading && <p className="py-8 text-center text-sm text-slate-400">Loading...</p>}

              {!viewLoading && !viewError && (
                <>
                  <p className="mb-2 text-base font-bold text-keen-charcoal">{fmtLong(viewDay)}</p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Chip label="Present" value={viewTotals.present} cls={BADGE.present} />
                    <Chip label="Absent" value={viewTotals.absent} cls={BADGE.absent} />
                    <Chip label="Late" value={viewTotals.late} cls={BADGE.late} />
                    <Chip label="Leave" value={viewTotals.leave} cls={BADGE.leave} />
                    <Chip label="Not marked" value={viewTotals.none} cls={BADGE.none} />
                  </div>

                  {viewVisible.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">No teachers match.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-slate-400">
                          <th className="py-2">#</th>
                          <th>Teacher</th>
                          <th>Status</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewVisible.map((r, i) => (
                          <tr key={r.teacher} className="border-t border-slate-100">
                            <td className="py-2.5 text-slate-400">{i + 1}</td>
                            <td className="font-semibold text-keen-charcoal">{r.name}</td>
                            <td>
                              <span
                                className={
                                  "rounded-full px-3 py-1 text-xs font-bold " + BADGE[r.status || "none"]
                                }
                              >
                                {LABEL[r.status || "none"]}
                              </span>
                            </td>
                            <td className="text-slate-500">{r.note || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-keen-charcoal px-5 py-2.5 text-sm font-bold text-white"
              >
                Close
              </button>
            </div>
          </>
        )}

        {/* ================= HISTORY ================= */}
        {tab === "history" && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-3">
              <select
                value={histTeacher}
                onChange={(e) => setHistTeacher(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">All teachers (summary)</option>
                {rows.map((r) => (
                  <option key={r.teacher} value={r.teacher}>
                    {r.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {histError && (
              <div className="mx-6 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{histError}</div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-3">
              {histLoading && <p className="py-8 text-center text-sm text-slate-400">Loading...</p>}

              {!histLoading && hist?.teachers && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-400">
                      <th className="py-2">Teacher</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Late</th>
                      <th>Leave</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hist.teachers.map((t) => (
                      <tr
                        key={t.teacher}
                        className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                        onClick={() => setHistTeacher(String(t.teacher))}
                      >
                        <td className="py-2.5 font-semibold text-keen-charcoal">{t.name}</td>
                        <td>{t.present}</td>
                        <td>{t.absent}</td>
                        <td>{t.late}</td>
                        <td>{t.leave}</td>
                        <td className="font-bold">{t.percent === null ? "-" : t.percent + "%"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!histLoading && hist?.records && (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="mr-2 text-sm font-bold text-keen-charcoal">{hist.teacher.name}</span>
                    <Chip label="Present" value={hist.summary.present} cls={BADGE.present} />
                    <Chip label="Absent" value={hist.summary.absent} cls={BADGE.absent} />
                    <Chip label="Late" value={hist.summary.late} cls={BADGE.late} />
                    <Chip label="Leave" value={hist.summary.leave} cls={BADGE.leave} />
                    <span className="ml-auto text-xs font-bold text-slate-500">
                      {hist.summary.percent === null ? "-" : hist.summary.percent + "% attendance"}
                    </span>
                  </div>
                  {hist.records.length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-400">No attendance marked in this period.</p>
                  )}
                  {hist.records.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-slate-400">
                          <th className="py-2">Date</th>
                          <th>Day</th>
                          <th>Status</th>
                          <th>Note</th>
                          <th>Marked by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hist.records.map((r) => (
                          <tr key={r.date} className="border-t border-slate-100">
                            <td className="py-2.5">{r.date}</td>
                            <td>{r.weekday}</td>
                            <td>
                              <span className={"rounded-full px-3 py-1 text-xs font-bold " + BADGE[r.status]}>
                                {LABEL[r.status]}
                              </span>
                            </td>
                            <td className="text-slate-500">{r.note || "-"}</td>
                            <td className="text-slate-500">{r.marked_by || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              {histTeacher && (
                <button
                  type="button"
                  onClick={() => setHistTeacher("")}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-keen-charcoal"
                >
                  Back to all teachers
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-keen-charcoal px-5 py-2.5 text-sm font-bold text-white"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}