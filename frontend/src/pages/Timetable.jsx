import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AppShell, Button, Modal, Notice, INPUT_CLS } from "../components/ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat" };
const CLASS_ORDER = ["pg-8th", "pre-9th", "9th", "10th", "1st year"];
const ADDRESS = "Goal Park, Raheem Garden, Muzaffar colony street # 23";
const UPDATED_KEY = "keen.timetable.updated";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const hhmm = (t) => (t || "").slice(0, 5);
const titleCase = (s) => (s || "").toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
const cleanLabel = (s) => (s || "").replace(/\s*\([^)]*\)\s*$/, "");
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hh = Number(h);
  return (hh % 12 || 12) + ":" + m + " " + (hh >= 12 ? "PM" : "AM");
};
const classRank = (label) => {
  const i = CLASS_ORDER.indexOf((label || "").toLowerCase());
  return i < 0 ? 99 : i;
};
const sortClasses = (list) => [...list].sort((a, b) => classRank(a.label) - classRank(b.label) || a.label.localeCompare(b.label));
const todayDay = () => {
  const n = ["Sunday", ...DAYS][new Date().getDay()];
  return DAYS.includes(n) ? n : "Monday";
};
const dmy = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getDate()) + "-" + p(d.getMonth() + 1) + "-" + d.getFullYear();
};
const readUpdated = () => {
  try {
    const v = localStorage.getItem(UPDATED_KEY);
    return v ? dmy(new Date(v)) : dmy(new Date());
  } catch {
    return dmy(new Date());
  }
};
const markUpdated = () => {
  try {
    localStorage.setItem(UPDATED_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
};
const messageOf = (err) => {
  const p = err && err.payload;
  if (p && typeof p === "object") {
    const parts = [];
    for (const v of Object.values(p)) {
      if (Array.isArray(v)) parts.push(...v.map(String));
      else if (typeof v === "string") parts.push(v);
    }
    if (parts.length) return parts.join(" ");
  }
  return (err && err.message) || "Something went wrong. Try again.";
};

function periodsOf(list) {
  const seen = new Map();
  for (const s of list) {
    const start = hhmm(s.start_time);
    const end = hhmm(s.end_time);
    const key = start + "-" + end;
    if (!seen.has(key)) seen.set(key, { key, start, end });
  }
  return [...seen.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

function CellText({ slots }) {
  if (!slots.length) return null;
  const subjects = [...new Set(slots.map((s) => (s.subject_name || "").toUpperCase()))];
  const teachers = [...new Set(slots.map((s) => titleCase(s.teacher_name)).filter(Boolean))];
  const rooms = [...new Set(slots.map((s) => s.room).filter(Boolean))];
  return (
    <>
      <div className="tt-sub">{subjects.join(" / ")}</div>
      <div className="tt-tch">{teachers.length ? teachers.join(", ") : "No teacher yet"}</div>
      {rooms.length > 0 && <div className="tt-room">Room {rooms.join(", ")}</div>}
    </>
  );
}


function Grid({ cols, rows, slotsFor, onCell, editable }) {
  return (
    <div className="tt-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th className="tt-timeh">Time</th>
            {cols.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.key}>
              <th scope="row" className="tt-time">
                {fmtTime(p.start)} - {fmtTime(p.end)}
              </th>
              {cols.map((c) => {
                const slots = slotsFor(p, c);
                const inner = <CellText slots={slots} />;
                return (
                  <td key={c.key} className={editable ? "tt-edit" : ""}>
                    {editable ? (
                      <button
                        type="button"
                        className="tt-cellbtn"
                        onClick={() => onCell(c, p, slots)}
                        aria-label={(slots.length ? "Edit " : "Add to ") + c.label + " " + p.start}
                      >
                        {inner || <span className="tt-plus tt-noprint">+</span>}
                      </button>
                    ) : (
                      inner
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sheet({ sub, updated, children }) {
  return (
    <section className="tt-sheet">
      <div className="tt-phead">
        <div className="tt-bism" dir="rtl" lang="ar">
          بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </div>
        <div className="tt-titlerow">
          <img src="/keen-logo.png" alt="" className="tt-logo" />
          <h1>KEEN EVENING COACHING</h1>
          <img src="/keen-logo.png" alt="" className="tt-logo" />
        </div>
        <div className="tt-ttl">Time Table{sub ? " - " + sub : ""}</div>
      </div>
      {children}
      <div className="tt-pfoot">
        <div>
          <b>Address:</b> {ADDRESS}
        </div>
        <div>
          <b>Updated on:</b> {updated}
        </div>
      </div>
    </section>
  );
}

export default function Timetable() {
  const { role } = useAuth();
  const isAdmin = role !== "teacher" && role !== "student";

  const [options, setOptions] = useState({ classes: [], subjects: [] });
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updated, setUpdated] = useState(readUpdated());
  const [day, setDay] = useState(todayDay()); // a day name or "week"
  const [extra, setExtra] = useState({}); // day -> [{key,start,end}] empty rows added locally
  const [newRow, setNewRow] = useState({ start: "", end: "" });

  const [cell, setCell] = useState(null);
  const [copy, setCopy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [perror, setPerror] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.listTimetable("");
      setSlots(asList(data));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!isAdmin) return undefined;
    let alive = true;
    api
      .listTimetableOptions()
      .then((d) => alive && setOptions({ classes: d.classes || [], subjects: d.subjects || [] }))
      .catch((e) => alive && setError(messageOf(e)));
    return () => {
      alive = false;
    };
  }, [load, isAdmin]);

  const classes = useMemo(() => {
    if (isAdmin) return sortClasses(options.classes);
    const m = new Map();
    for (const s of slots) m.set(s.school_class, { id: s.school_class, label: s.class_label });
    return sortClasses([...m.values()]);
  }, [isAdmin, options.classes, slots]);

  const week = day === "week";
  const daySlots = useMemo(() => slots.filter((s) => s.day_of_week === day), [slots, day]);
  const dayCols = classes.map((c) => ({ key: String(c.id), label: c.label, id: c.id }));
  const singleClass = !isAdmin && classes.length === 1;

  const slotsAt = (list, p, pred) =>
    list.filter((s) => hhmm(s.start_time) === p.start && hhmm(s.end_time) === p.end && pred(s));

  const rowsFor = (d, list) => {
    const rows = periodsOf(list);
    const keys = new Set(rows.map((r) => r.key));
    for (const e of extra[d] || []) if (!keys.has(e.key)) rows.push(e);
    return rows.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  };

  async function afterChange(msg) {
    markUpdated();
    setUpdated(readUpdated());
    await load();
    setNotice(msg);
  }

  const subjectsOf = (classId) => options.subjects.filter((s) => String(s.school_class) === String(classId));

  function openCell({ classId, dayName, period, existing }) {
    setPerror("");
    setNotice("");
    setCell({
      classId: String(classId || ""),
      days: [dayName],
      start: period ? period.start : "",
      end: period ? period.end : "",
      room: existing.find((s) => s.room)?.room || "",
      subjectIds: existing.map((s) => s.subject),
      orig:
        period && existing.length
          ? { day: dayName, start: period.start, end: period.end, subjectIds: existing.map((s) => s.subject), room: existing.find((s) => s.room)?.room || "" }
          : null,
    });
  }

  const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function saveCell() {
    const c = cell;
    if (!c.classId) return setPerror("Pick a class.");
    if (!c.subjectIds.length) return setPerror("Pick at least one subject.");
    if (!c.start || !c.end) return setPerror("Pick the start and end time.");
    if (!c.days.length) return setPerror("Pick at least one day.");
    setBusy(true);
    setPerror("");
    const moved = c.orig && (c.orig.start !== c.start || c.orig.end !== c.end);
    try {
      if (moved) {
        await api.deleteTimetableCell({ school_class: Number(c.classId), days: [c.orig.day], start_time: c.orig.start, end_time: c.orig.end });
      }
      try {
        await api.setTimetableCell({
          school_class: Number(c.classId),
          days: c.days.length === 6 ? "all" : c.days,
          start_time: c.start,
          end_time: c.end,
          subject_ids: c.subjectIds,
          room: c.room || "",
        });
      } catch (e) {
        if (moved) {
          try {
            await api.setTimetableCell({ school_class: Number(c.classId), days: [c.orig.day], start_time: c.orig.start, end_time: c.orig.end, subject_ids: c.orig.subjectIds, room: c.orig.room || "" });
          } catch {
            /* best effort restore */
          }
        }
        throw e;
      }
      setCell(null);
      await afterChange("Saved " + (c.days.length === 6 ? "for all days" : "for " + c.days.map((d) => SHORT[d]).join(", ")) + ".");
    } catch (e) {
      setPerror(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCell() {
    const c = cell;
    const cls = classes.find((x) => String(x.id) === c.classId);
    const where = c.days.length === 6 ? "all days" : c.days.join(", ");
    if (!window.confirm("Delete " + (cls?.label || "this") + " lecture(s) at " + fmtTime(c.start) + " - " + fmtTime(c.end) + " on " + where + "?")) return;
    setBusy(true);
    setPerror("");
    try {
      await api.deleteTimetableCell({ school_class: Number(c.classId), days: c.days, start_time: c.start, end_time: c.end });
      setCell(null);
      await afterChange("Cell deleted.");
    } catch (e) {
      setPerror(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyDay() {
    if (!copy.to.length) return setPerror("Pick at least one day to copy to.");
    if (!window.confirm("Copy " + day + " to " + copy.to.join(", ") + "? The lectures already on those days will be replaced.")) return;
    setBusy(true);
    setPerror("");
    try {
      await api.copyTimetableDay({ from_day: day, to_days: copy.to });
      setCopy(null);
      await afterChange(day + " copied to " + copy.to.map((d) => SHORT[d]).join(", ") + ".");
    } catch (e) {
      setPerror(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearDay() {
    if (!window.confirm("Clear ALL lectures of " + day + " for every class? This cannot be undone.")) return;
    setError("");
    setNotice("");
    try {
      await api.clearTimetableDay({ day });
      setExtra((x) => ({ ...x, [day]: [] }));
      await afterChange(day + " cleared.");
    } catch (e) {
      setError(messageOf(e));
    }
  }

  function addRow() {
    if (!newRow.start || !newRow.end) return setError("Pick the start and end time of the new row.");
    if (newRow.end <= newRow.start) return setError("End time must be after the start time.");
    setError("");
    const key = newRow.start + "-" + newRow.end;
    setExtra((x) => ({ ...x, [day]: [...(x[day] || []), { key, start: newRow.start, end: newRow.end }] }));
    setNewRow({ start: "", end: "" });
  }

  const title = isAdmin ? "Timetable" : role === "teacher" ? "My timetable" : "My class timetable";
  const subtitle = isAdmin
    ? "KEEN EVENING COACHING weekly timetable. Sunday is the weekly off."
    : "Your lectures for the week. Sunday is closed.";

  const dayGrid = (d, editable) => {
    const list = slots.filter((s) => s.day_of_week === d);
    return (
      <Grid
        cols={dayCols}
        rows={rowsFor(d, list)}
        editable={editable}
        slotsFor={(p, c) => slotsAt(list, p, (s) => s.school_class === c.id)}
        onCell={(c, p, ex) => openCell({ classId: c.id, dayName: d, period: p, existing: ex })}
      />
    );
  };

  const noData = !loading && !slots.length && !isAdmin;

  return (
    <AppShell title={title} subtitle={subtitle}>
      <style>{css}</style>
      <div className="tt">
        <div className="tt-noprint space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="tt-days" role="tablist">
              {DAYS.map((d) => (
                <button key={d} type="button" role="tab" aria-selected={day === d} className={day === d ? "on" : ""} onClick={() => { setDay(d); setError(""); setNotice(""); }}>
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{SHORT[d]}</span>
                </button>
              ))}
              <button type="button" role="tab" aria-selected={week} className={"tt-weekbtn " + (week ? "on" : "")} onClick={() => { setDay("week"); setError(""); setNotice(""); }}>
                Full week
              </button>
            </div>
            <Button variant="secondary" onClick={() => window.print()} disabled={!slots.length}>
              Print
            </Button>
          </div>

          {isAdmin && !week && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-keen-muted">
                  New row from
                  <input type="time" className="tt-time-in" value={newRow.start} onChange={(e) => setNewRow({ ...newRow, start: e.target.value })} />
                </label>
                <label className="text-xs text-keen-muted">
                  to
                  <input type="time" className="tt-time-in" value={newRow.end} onChange={(e) => setNewRow({ ...newRow, end: e.target.value })} />
                </label>
                <Button variant="secondary" onClick={addRow}>+ Add time row</Button>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => { setPerror(""); setCopy({ to: [] }); }} disabled={!daySlots.length}>
                  Copy this day to...
                </Button>
                <Button variant="danger" onClick={clearDay} disabled={!daySlots.length}>
                  Clear this day
                </Button>
              </div>
            </div>
          )}

          <Notice>{error}</Notice>
          <Notice tone="success">{notice}</Notice>
        </div>

        {loading && <p className="mt-4 text-sm text-keen-muted">Loading timetable...</p>}
        {noData && (
          <p className="mt-4 text-sm text-keen-muted">
            {role === "student" ? "No timetable has been published for your class yet." : "No lectures have been scheduled for you yet."}
          </p>
        )}

        {!loading && !noData && (
          <div className="tt-screen mt-4">
            {!week && (
              <Sheet sub={day} updated={updated}>
                {dayGrid(day, isAdmin)}
              </Sheet>
            )}
            {week && singleClass && (
              <Sheet sub={classes[0].label} updated={updated}>
                <Grid
                  cols={DAYS.map((d) => ({ key: d, label: d }))}
                  rows={periodsOf(slots)}
                  editable={false}
                  slotsFor={(p, c) => slotsAt(slots, p, (s) => s.day_of_week === c.key)}
                />
              </Sheet>
            )}
            {week && !singleClass &&
              DAYS.filter((d) => isAdmin || slots.some((s) => s.day_of_week === d)).map((d) => (
                <Sheet key={d} sub={d} updated={updated}>
                  {slots.some((s) => s.day_of_week === d) || extra[d]?.length ? (
                    dayGrid(d, isAdmin)
                  ) : (
                    <p className="tt-empty">Nothing scheduled on {d} yet.</p>
                  )}
                </Sheet>
              ))}
          </div>
        )}
      </div>

      <Modal
        open={!!cell}
        title={cell?.orig ? "Edit time slot" : "Add time slot"}
        subtitle="Pick the subjects, time and days. Teachers show next to each subject."
        onClose={() => !busy && setCell(null)}
        footer={
          cell && (
            <>
              {cell.orig && (
                <Button variant="danger" onClick={deleteCell} disabled={busy} className="mr-auto">
                  Delete cell
                </Button>
              )}
              <Button variant="secondary" onClick={() => setCell(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={saveCell} disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </Button>
            </>
          )
        }
      >
        {cell && (
          <div className="space-y-5 text-sm">
            <Notice>{perror}</Notice>

            <label className="block">
              <span className="tt-lbl">Class</span>
              <select
                className={INPUT_CLS}
                value={cell.classId}
                disabled={!!cell.orig}
                onChange={(e) => setCell({ ...cell, classId: e.target.value, subjectIds: [] })}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>

            <div>
              <span className="tt-lbl">Subjects (pick one or more)</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {subjectsOf(cell.classId).map((s) => (
                  <label key={s.id} className={"tt-check " + (cell.subjectIds.includes(s.id) ? "on" : "")}>
                    <input
                      type="checkbox"
                      checked={cell.subjectIds.includes(s.id)}
                      onChange={() => setCell({ ...cell, subjectIds: toggleIn(cell.subjectIds, s.id) })}
                    />
                    <span>
                      <b className="uppercase">{cleanLabel(s.label)}</b>
                      <small>{s.teacher_name ? titleCase(s.teacher_name) : "No teacher yet"}</small>
                    </span>
                  </label>
                ))}
                {subjectsOf(cell.classId).length === 0 && (
                  <p className="text-keen-muted">This class has no subjects yet.</p>
                )}
              </div>
            </div>

            <div>
              <span className="tt-lbl">Time slot</span>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <small className="text-keen-muted">Start</small>
                  <input type="time" className={INPUT_CLS} value={cell.start} onChange={(e) => setCell({ ...cell, start: e.target.value })} />
                </label>
                <label>
                  <small className="text-keen-muted">End</small>
                  <input type="time" className={INPUT_CLS} value={cell.end} onChange={(e) => setCell({ ...cell, end: e.target.value })} />
                </label>
              </div>
              {periodsOf(slots).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {periodsOf(slots).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className="tt-chip"
                      onClick={() => setCell({ ...cell, start: p.start, end: p.end })}
                    >
                      {fmtTime(p.start)} - {fmtTime(p.end)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="block">
              <span className="tt-lbl">Room (optional)</span>
              <input className={INPUT_CLS} value={cell.room} maxLength={30} onChange={(e) => setCell({ ...cell, room: e.target.value })} placeholder="e.g. Room 2" />
            </label>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="tt-lbl !mb-0">Apply to days</span>
                <button
                  type="button"
                  className="text-xs font-semibold text-keen-cyanDark hover:underline"
                  onClick={() => setCell({ ...cell, days: cell.days.length === 6 ? [cell.orig?.day || (day === "week" ? "Monday" : day)] : [...DAYS] })}
                >
                  {cell.days.length === 6 ? "Only one day" : "All days"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <label key={d} className={"tt-check tt-daycheck " + (cell.days.includes(d) ? "on" : "")}>
                    <input type="checkbox" checked={cell.days.includes(d)} onChange={() => setCell({ ...cell, days: toggleIn(cell.days, d) })} />
                    <span>{SHORT[d]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!copy}
        title={"Copy " + (day === "week" ? "" : day) + " to other days"}
        subtitle="Every class's lectures of this day are copied. The target days are replaced."
        onClose={() => !busy && setCopy(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCopy(null)} disabled={busy}>Cancel</Button>
            <Button onClick={copyDay} disabled={busy}>{busy ? "Copying..." : "Copy"}</Button>
          </>
        }
      >
        {copy && (
          <div className="space-y-4 text-sm">
            <Notice>{perror}</Notice>
            <div className="flex flex-wrap gap-2">
              {DAYS.filter((d) => d !== day).map((d) => (
                <label key={d} className={"tt-check tt-daycheck " + (copy.to.includes(d) ? "on" : "")}>
                  <input type="checkbox" checked={copy.to.includes(d)} onChange={() => setCopy({ to: toggleIn(copy.to, d) })} />
                  <span>{d}</span>
                </label>
              ))}
            </div>
            <button type="button" className="text-xs font-semibold text-keen-cyanDark hover:underline" onClick={() => setCopy({ to: DAYS.filter((d) => d !== day) })}>
              Select all other days
            </button>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

const css = `
.tt-days { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.tt-days button { padding: 6px 14px; font-size: .8rem; font-weight: 600; color: #21262B; background: #fff; border: 1px solid #D9E2EC; border-radius: 999px; }
.tt-days button.on { background: #00D9F5; border-color: #00D9F5; color: #14181B; }
.tt-days .tt-weekbtn { border-color: #21262B; }
.tt-days .tt-weekbtn.on { background: #21262B; border-color: #21262B; color: #fff; }
.tt-time-in { display: block; margin-top: 2px; padding: 6px 8px; font-size: .85rem; color: #21262B; background: #fff; border: 1px solid #D9E2EC; border-radius: 8px; }
.tt-sheet { background: #fff; border: 1px solid #D9E2EC; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
.tt-phead { text-align: center; margin-bottom: 12px; }
.tt-bism { font-size: 1.3rem; line-height: 1.5; color: #000; }
.tt-titlerow { display: flex; align-items: center; justify-content: center; gap: 16px; }
.tt-logo { height: 56px; width: auto; flex-shrink: 0; }
.tt-phead h1 { margin: 0; font-size: clamp(1.2rem, 4vw, 2rem); font-weight: 900; letter-spacing: .03em; color: #000; }
.tt-ttl { font-style: italic; font-size: 1.1rem; margin-top: 2px; color: #000; }
.tt-pfoot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; margin-top: 12px; font-size: .85rem; color: #000; }
.tt-empty { padding: 24px; text-align: center; font-size: .85rem; color: #5A6672; border: 1px dashed #D9E2EC; }
.tt-wrap { overflow-x: auto; background: #fff; border: 1px solid #000; }
.tt-table { width: 100%; min-width: 640px; border-collapse: collapse; table-layout: fixed; }
.tt-table th, .tt-table td { border: 1px solid #000; text-align: center; vertical-align: middle; padding: 0; }
.tt-table thead th { background: #000; color: #fff; padding: 10px 6px; font-size: .9rem; font-weight: 700; }
.tt-table .tt-timeh { width: 150px; }
.tt-table .tt-time { padding: 8px 6px; font-size: .8rem; font-weight: 700; background: #f3f4f6; color: #000; }
.tt-table td { height: 64px; padding: 6px 4px; }
.tt-table td.tt-edit { padding: 0; }
.tt-cellbtn { display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; min-height: 64px; padding: 6px 4px; cursor: pointer; }
.tt-cellbtn:hover { background: #E6FBFE; }
.tt-plus { font-size: 1.2rem; color: #cbd5e1; }
.tt-sub { font-size: .9rem; font-weight: 800; color: #000; text-transform: uppercase; line-height: 1.2; }
.tt-tch { margin-top: 2px; font-size: .78rem; color: #21262B; line-height: 1.25; }
.tt-room { margin-top: 2px; font-size: .7rem; font-style: italic; color: #5A6672; }
.tt-lbl { display: block; margin-bottom: 6px; font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #5A6672; }
.tt-check { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #D9E2EC; border-radius: 10px; cursor: pointer; background: #fff; }
.tt-check.on { border-color: #00B8D4; background: #E6FBFE; }
.tt-check input { width: 16px; height: 16px; accent-color: #00B8D4; flex-shrink: 0; }
.tt-check small { display: block; font-size: .72rem; color: #5A6672; }
.tt-daycheck { padding: 6px 12px; }
.tt-chip { padding: 3px 10px; font-size: .72rem; font-weight: 600; border: 1px solid #D9E2EC; border-radius: 999px; background: #fff; color: #21262B; }
.tt-chip:hover { background: #E6FBFE; }

@media print {
  @page { size: A4 landscape; margin: 10mm; }
  body * { visibility: hidden; }
  .tt .tt-noprint, .tt-plus { display: none !important; }
  .tt-screen, .tt-screen * { visibility: visible; }
  .tt-screen { position: absolute; left: 0; top: 0; width: 100%; margin: 0 !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tt-sheet { border: 0; border-radius: 0; padding: 0; margin: 0; break-after: page; page-break-after: always; }
  .tt-sheet:last-child { break-after: auto; page-break-after: auto; }
  .tt-bism { font-size: 18pt; }
  .tt-logo { height: 60px; }
  .tt-phead h1 { font-size: 26pt; }
  .tt-ttl { font-size: 15pt; }
  .tt-wrap { overflow: visible; border: 0; }
  .tt-table { min-width: 0; }
  .tt-table td { height: 46px; }
  .tt-cellbtn { min-height: 0; padding: 0; display: block; }
  .tt-pfoot { font-size: 10pt; }
}
`;
