import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ALL_ID = "__all__";
const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const titleCase = (s) => (s || "").toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
const TONES = ["tone-teal", "tone-blue", "tone-violet", "tone-amber", "tone-rose", "tone-green"];
const toneFor = (text) => {
  let n = 0;
  for (const ch of String(text || "")) n += ch.charCodeAt(0);
  return TONES[n % TONES.length];
};
const todayName = () => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
const ICON_EDIT = "M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z";
const ICON_TRASH = "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6";
function TtIcon({ d }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const hhmm = (t) => (t || "").slice(0, 5);
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hh = Number(h);
  return (hh % 12 || 12) + ":" + m + " " + (hh >= 12 ? "PM" : "AM");
};

// Turns the API's validation errors into one readable sentence.
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

const EMPTY = { school_class: "", subject: "", day_of_week: "Monday", start_time: "", end_time: "", room: "" };
const fromSlot = (s) => ({
  school_class: String(s.school_class),
  subject: String(s.subject),
  day_of_week: s.day_of_week,
  start_time: hhmm(s.start_time),
  end_time: hhmm(s.end_time),
  room: s.room || "",
});

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

function slotsAt(list, period, day) {
  return list.filter(
    (s) => s.day_of_week === day && hhmm(s.start_time) === period.start && hhmm(s.end_time) === period.end
  );
}

function CellActions({ s, busyId, onEdit, onDelete }) {
  return (
    <div className="tt-actions tt-noprint">
      <button type="button" className="tt-icon" title="Edit lecture" aria-label={"Edit " + s.subject_name} disabled={busyId === s.id} onClick={() => onEdit(s)}>
        <TtIcon d={ICON_EDIT} />
      </button>
      <button type="button" className="tt-icon tt-icon-del" title="Delete lecture" aria-label={"Delete " + s.subject_name} disabled={busyId === s.id} onClick={() => onDelete(s)}>
        <TtIcon d={ICON_TRASH} />
      </button>
    </div>
  );
}

function TimetableSheet({ title, slots, canEdit, role, busyId, onEdit, onDelete }) {
  const periods = periodsOf(slots);
  return (
    <div className="tt-sheet">
      <div className="tt-print-head">
        <h1>KEEN Evening Coaching</h1>
        <p>Weekly timetable{title ? ": " + title : ""}</p>
      </div>
      <div className="tt-wrap">
        <table className="tt-table">
          <thead>
            <tr>
              <th>Time</th>
              {DAYS.map((d) => (
                <th key={d} className={d === todayName() ? "tt-today" : ""}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.key}>
                <th scope="row" className="tt-time">
                  <span className="tt-start">{fmtTime(p.start)}</span>
                  <span className="tt-end">{fmtTime(p.end)}</span>
                </th>
                {DAYS.map((day) => (
                  <td key={day} className={day === todayName() ? "tt-today-col" : ""}>
                    {slotsAt(slots, p, day).map((s) => (
                      <div key={s.id} className={"tt-cell " + toneFor(s.subject_name)}>
                        <div className="tt-cell-main">
                          <div className="tt-subject">{s.subject_name}</div>
                          <div className="tt-teacher">
                            {role === "teacher" ? s.class_label : s.teacher_name ? titleCase(s.teacher_name) : "No teacher yet"}
                          </div>
                          {s.room && <span className="tt-room">Room {s.room}</span>}
                        </div>
                        {canEdit && <CellActions s={s} busyId={busyId} onEdit={onEdit} onDelete={onDelete} />}
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// One master sheet: a row per class, a column per day, lectures listed by time inside each cell.
function AllClassesSheet({ groups, canEdit, busyId, onEdit, onDelete }) {
  return (
    <div className="tt-sheet tt-master">
      <div className="tt-print-head">
        <h1>KEEN Evening Coaching</h1>
        <p>Weekly timetable: All classes</p>
      </div>
      <div className="tt-wrap">
        <table className="tt-table tt-master-table">
          <thead>
            <tr>
              <th>Class</th>
              {DAYS.map((d) => (
                <th key={d} className={d === todayName() ? "tt-today" : ""}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.cls.id}>
                <th scope="row" className="tt-time tt-classname">{g.cls.label}</th>
                {DAYS.map((day) => {
                  const daySlots = g.slots
                    .filter((s) => s.day_of_week === day)
                    .sort((a, b) => hhmm(a.start_time).localeCompare(hhmm(b.start_time)));
                  return (
                    <td key={day} className={day === todayName() ? "tt-today-col" : ""}>
                      {daySlots.map((s) => (
                        <div key={s.id} className={"tt-cell " + toneFor(s.subject_name)}>
                          <div className="tt-mtime">
                            {fmtTime(hhmm(s.start_time))} - {fmtTime(hhmm(s.end_time))}
                          </div>
                          <div className="tt-subject">{s.subject_name}</div>
                          <div className="tt-teacher">
                            {s.teacher_name ? titleCase(s.teacher_name) : "No teacher yet"}
                            {s.room ? " \u00b7 Room " + s.room : ""}
                          </div>
                          {canEdit && <CellActions s={s} busyId={busyId} onEdit={onEdit} onDelete={onDelete} />}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Timetable() {
  const { role } = useAuth();
  const canEdit = role !== "teacher" && role !== "student";

  const [options, setOptions] = useState({ classes: [], subjects: [] });
  const [classId, setClassId] = useState("");
  const [slots, setSlots] = useState([]);
  const [loadingBase, setLoadingBase] = useState(canEdit);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState(null); // "add" | "edit" | null
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [perror, setPerror] = useState("");
  const reqRef = useRef(0);

  useEffect(() => {
    if (!canEdit) return;
    let alive = true;
    api
      .listTimetableOptions()
      .then((data) => {
        if (!alive) return;
        const classes = data.classes || [];
        setOptions({ classes, subjects: data.subjects || [] });
        if (classes.length) setClassId(String(classes[0].id));
      })
      .catch((e) => alive && setError(messageOf(e)))
      .finally(() => alive && setLoadingBase(false));
    return () => {
      alive = false;
    };
  }, [canEdit]);

  const loadSlots = useCallback(async () => {
    if (canEdit && !classId) {
      setSlots([]);
      return;
    }
    const id = ++reqRef.current;
    setLoadingSlots(true);
    setError("");
    try {
      let data;
      if (canEdit && classId === ALL_ID) {
        const results = await Promise.all(options.classes.map((c) => api.listTimetable(String(c.id))));
        data = results.flatMap((r) => asList(r));
      } else {
        data = await api.listTimetable(canEdit ? classId : "");
      }
      if (id === reqRef.current) setSlots(asList(data));
    } catch (e) {
      if (id === reqRef.current) setError(messageOf(e));
    } finally {
      if (id === reqRef.current) setLoadingSlots(false);
    }
  }, [canEdit, classId, options.classes]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const classesWithSlots = useMemo(() => {
    if (!canEdit || classId !== ALL_ID) return null;
    const bySlot = new Map();
    for (const s of slots) {
      const key = String(s.school_class);
      if (!bySlot.has(key)) bySlot.set(key, []);
      bySlot.get(key).push(s);
    }
    return options.classes
      .map((c) => ({ cls: c, slots: bySlot.get(String(c.id)) || [] }))
      .filter((g) => g.slots.length > 0);
  }, [canEdit, classId, slots, options.classes]);

  const selectedClass = options.classes.find((c) => String(c.id) === classId);
  const printLabel = canEdit
    ? selectedClass?.label || ""
    : role === "teacher"
    ? "My timetable"
    : slots[0]?.class_label || "";

  // ---- popup ----
  const formSubjects = options.subjects.filter((s) => String(s.school_class) === String(form.school_class));
  const ready = form.school_class && form.subject && form.day_of_week && form.start_time && form.end_time;
  const dirty =
    modal === "edit" && editing
      ? JSON.stringify(form) !== JSON.stringify(fromSlot(editing))
      : JSON.stringify({ ...form, school_class: "" }) !== JSON.stringify({ ...EMPTY, school_class: "" });

  const setF = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function openAdd() {
    setForm({ ...EMPTY, school_class: classId === ALL_ID ? "" : classId });
    setEditing(null);
    setPerror("");
    setModal("add");
  }

  function openEdit(s) {
    setForm(fromSlot(s));
    setEditing(s);
    setPerror("");
    setModal("edit");
  }

  function closeNow() {
    setModal(null);
    setEditing(null);
    setForm(EMPTY);
    setPerror("");
  }

  function close() {
    if (dirty && !window.confirm("Discard your changes? What you typed will be lost.")) return;
    closeNow();
  }

  async function save() {
    if (!ready || saving) return;
    setSaving(true);
    setPerror("");
    setNotice("");
    try {
      const body = {
        school_class: Number(form.school_class),
        subject: Number(form.subject),
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room.trim(),
      };
      if (modal === "edit") await api.updateTimetableSlot(editing.id, body);
      else await api.createTimetableSlot(body);
      const verb = modal === "edit" ? "Saved changes to the" : "Added the";
      closeNow();
      if (classId !== ALL_ID && String(body.school_class) !== classId) {
        setClassId(String(body.school_class));
      } else {
        await loadSlots();
      }
      setNotice(verb + " lecture on " + body.day_of_week + ".");
    } catch (e) {
      setPerror(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(s) {
    const msg = "Delete " + s.subject_name + " on " + s.day_of_week + " at " + fmtTime(s.start_time) + "?";
    if (!window.confirm(msg)) return;
    setBusyId(s.id);
    setError("");
    setNotice("");
    try {
      await api.deleteTimetableSlot(s.id);
      setSlots((list) => list.filter((x) => x.id !== s.id));
      setNotice("Deleted the lecture.");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusyId(null);
    }
  }

  const title = canEdit ? "Timetables" : role === "teacher" ? "My timetable" : "My class timetable";
  const subtitle = canEdit
    ? "Weekly lectures for each class."
    : role === "teacher"
    ? "Your lectures for the week."
    : "Your class's lectures for the week.";

  return (
    <AppShell title={title} subtitle={subtitle}>
      <style>{css}</style>
      <div className="tt">
        <div className="tt-top tt-noprint">
          {canEdit && (
            <label className="tt-pick">
              Class
              <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={loadingBase}>
                {options.classes.length === 0 && <option value="">{loadingBase ? "Loading..." : "No classes"}</option>}
                {options.classes.length > 0 && <option value={ALL_ID}>All classes</option>}
                {options.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="tt-top-actions">
            <button type="button" className="tt-print" onClick={() => window.print()} disabled={slots.length === 0}>
              Print timetable
            </button>
            {canEdit && (
              <button type="button" className="tt-add" onClick={openAdd} disabled={options.classes.length === 0}>
                + Add Lecture
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="tt-msg tt-err tt-noprint" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="tt-msg tt-ok tt-noprint" role="status">
            {notice}
          </div>
        )}

        {canEdit && !loadingBase && options.classes.length === 0 && (
          <p className="tt-muted">No classes exist yet. Add them on the Classes page first.</p>
        )}
        {loadingSlots && <p className="tt-muted">Loading timetable...</p>}
        {!loadingSlots && classId !== ALL_ID && slots.length === 0 && (canEdit ? !!classId : true) && !error && (
          <p className="tt-muted">
            {canEdit
              ? "No lectures are scheduled for this class yet. Click Add Lecture to start."
              : role === "teacher"
              ? "No lectures have been scheduled for you yet."
              : "No timetable has been published for your class yet."}
          </p>
        )}
        {!loadingSlots && classId === ALL_ID && classesWithSlots && classesWithSlots.length === 0 && !error && (
          <p className="tt-muted">No lectures are scheduled for any class yet.</p>
        )}

        {classId === ALL_ID && classesWithSlots && classesWithSlots.length > 0 && (
          <AllClassesSheet
            groups={classesWithSlots}
            canEdit={canEdit}
            busyId={busyId}
            onEdit={openEdit}
            onDelete={remove}
          />
        )}

        {classId !== ALL_ID && slots.length > 0 && (
          <TimetableSheet
            title={printLabel}
            slots={slots}
            canEdit={canEdit}
            role={role}
            busyId={busyId}
            onEdit={openEdit}
            onDelete={remove}
          />
        )}

        {modal && (
          <div className="tt-backdrop" role="dialog" aria-modal="true" aria-labelledby="tt-modal-title">
            <div className="tt-modal">
              <div className="tt-modal-head">
                <div>
                  <h2 id="tt-modal-title">{modal === "edit" ? "Edit Lecture" : "Add Lecture"}</h2>
                  <p>{modal === "edit" ? "Update the lecture details below" : "Fill in the lecture details below"}</p>
                </div>
                <button type="button" className="tt-x" onClick={close} aria-label="Close">
                  &times;
                </button>
              </div>

              <div className="tt-modal-body">
                {perror && (
                  <div className="tt-msg tt-err wide" role="alert">
                    {perror}
                  </div>
                )}

                <label className="tt-field">
                  <span className="lbl">
                    Class <span className="req">*</span>
                  </span>
                  <select
                    value={form.school_class}
                    onChange={(e) => setForm((f) => ({ ...f, school_class: e.target.value, subject: "" }))}
                  >
                    <option value="">Select a class</option>
                    {options.classes.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="tt-field">
                  <span className="lbl">
                    Subject <span className="req">*</span>
                  </span>
                  <select value={form.subject} onChange={setF("subject")} disabled={!form.school_class}>
                    <option value="">{form.school_class ? "Select a subject" : "Pick a class first"}</option>
                    {formSubjects.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.label + (s.teacher_name ? " - " + s.teacher_name : " - no teacher yet")}
                      </option>
                    ))}
                  </select>
                  {form.school_class && formSubjects.length === 0 && (
                    <span className="hint">This class has no subjects yet. Add them on the Classes and Subjects page.</span>
                  )}
                </label>

                <label className="tt-field">
                  <span className="lbl">
                    Day <span className="req">*</span>
                  </span>
                  <select value={form.day_of_week} onChange={setF("day_of_week")}>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="tt-field">
                  <span className="lbl">Room</span>
                  <input value={form.room} onChange={setF("room")} placeholder="e.g. 3" />
                </label>

                <label className="tt-field">
                  <span className="lbl">
                    Start time <span className="req">*</span>
                  </span>
                  <input type="time" value={form.start_time} onChange={setF("start_time")} />
                </label>

                <label className="tt-field">
                  <span className="lbl">
                    End time <span className="req">*</span>
                  </span>
                  <input type="time" value={form.end_time} onChange={setF("end_time")} />
                </label>
              </div>

              <div className="tt-modal-foot">
                <button type="button" className="tt-cancel" onClick={close}>
                  Cancel
                </button>
                <button type="button" className="tt-submit" onClick={save} disabled={!ready || saving}>
                  {saving ? "Saving..." : modal === "edit" ? "Save Changes" : "Add Lecture"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const css = `
.tt { --tt-line: #d9dfe6; --tt-muted: #5d6b7a; --tt-accent: #1f4e8c; }
.tt-muted { color: var(--tt-muted); }
.tt-top { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.tt-pick { display: flex; flex-direction: column; gap: 6px; font-size: .9rem; font-weight: 600; }
.tt select, .tt input { padding: 8px 10px; font: inherit; font-weight: 400; border: 1px solid var(--tt-line); border-radius: 6px; background: #fff; }
.tt-pick select { min-width: 200px; }
.tt-top-actions { display: flex; gap: 10px; }
.tt-add { padding: 10px 18px; font: inherit; font-weight: 700; color: #fff; background: #1e8e5a; border: 0; border-radius: 8px; cursor: pointer; }
.tt-print { padding: 10px 18px; font: inherit; font-weight: 700; color: var(--tt-accent); background: #fff; border: 1px solid var(--tt-accent); border-radius: 8px; cursor: pointer; }
.tt-add:disabled, .tt-print:disabled, .tt-submit:disabled { opacity: .55; cursor: not-allowed; }
.tt select:focus-visible, .tt input:focus-visible, .tt button:focus-visible { outline: 2px solid var(--tt-accent); outline-offset: 2px; }
.tt-msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; font-size: .95rem; }
.tt-err { background: #fdecea; color: #b3261e; }
.tt-ok { background: #e7f4ec; color: #1e6b3a; }
.tt-print-head { display: none; }
.tt-wrap { overflow-x: auto; border: 1px solid var(--tt-line); border-radius: 8px; background: #fff; }
.tt-table { width: 100%; min-width: 860px; border-collapse: collapse; table-layout: fixed; }
.tt-table th, .tt-table td { padding: 10px; text-align: left; vertical-align: top; border: 1px solid var(--tt-line); }
.tt-table thead th { background: #f6f8fa; font-size: .85rem; color: var(--tt-muted); }
.tt-table .tt-time { width: 110px; background: #f6f8fa; font-size: .85rem; font-weight: 600; white-space: nowrap; }
.tt-cell:last-child { margin-bottom: 0; }
.tt-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, .5); }
.tt-modal { display: flex; flex-direction: column; width: 100%; max-width: 640px; max-height: 90vh; background: #fff; border-radius: 16px; box-shadow: 0 20px 50px rgba(0, 0, 0, .3); }
.tt-modal-head { display: flex; align-items: flex-start; justify-content: space-between; padding: 24px 32px; border-bottom: 1px solid var(--tt-line); }
.tt-modal-head h2 { margin: 0; font-size: 1.25rem; }
.tt-modal-head p { margin: 4px 0 0; color: var(--tt-muted); font-size: .9rem; }
.tt-x { background: none; border: 0; font-size: 1.7rem; line-height: 1; color: var(--tt-muted); cursor: pointer; }
.tt-modal-body { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 24px 32px; overflow-y: auto; }
.tt-modal-body .wide { grid-column: 1 / -1; }
.tt-field { display: flex; flex-direction: column; gap: 6px; }
.tt-field .lbl { font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tt-muted); }
.tt-field .req { color: #d92d20; }
.tt-field .hint { font-size: .75rem; color: var(--tt-muted); }
.tt-modal-body select, .tt-modal-body input { width: 100%; padding: 10px 12px; background: #f6f8fa; }
.tt-modal-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 32px; border-top: 1px solid var(--tt-line); }
.tt-cancel { padding: 10px 18px; font: inherit; font-weight: 700; color: #1c2530; background: #fff; border: 1px solid var(--tt-line); border-radius: 8px; cursor: pointer; }
.tt-submit { padding: 10px 20px; font: inherit; font-weight: 700; color: #fff; background: var(--tt-accent); border: 0; border-radius: 8px; cursor: pointer; }
.tone-teal { --tone-bg: #e6f5f3; --tone-bar: #0f9488; }
.tone-blue { --tone-bg: #e8f0fc; --tone-bar: #2563eb; }
.tone-violet { --tone-bg: #f0ebfc; --tone-bar: #7c3aed; }
.tone-amber { --tone-bg: #fdf3e1; --tone-bar: #d97706; }
.tone-rose { --tone-bg: #fce9ee; --tone-bar: #e11d48; }
.tone-green { --tone-bg: #e8f5ec; --tone-bar: #16a34a; }
.tt-cell { position: relative; padding: 10px 12px; margin-bottom: 8px; background: var(--tone-bg, #eef4fb); border-left: 4px solid var(--tone-bar, #1f4e8c); border-radius: 8px; }
.tt-subject { font-weight: 700; font-size: .95rem; color: #1c2530; }
.tt-teacher { margin-top: 2px; font-size: .8rem; color: #475467; }
.tt-room { display: inline-block; margin-top: 6px; padding: 2px 8px; font-size: .7rem; font-weight: 600; color: #475467; background: rgba(255, 255, 255, .75); border-radius: 999px; }
.tt-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; opacity: 0; transition: opacity .15s; }
.tt-cell:hover .tt-actions, .tt-cell:focus-within .tt-actions { opacity: 1; }
@media (hover: none) { .tt-actions { opacity: 1; } }
.tt-icon { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; color: #475467; background: rgba(255, 255, 255, .92); border: 1px solid #d0d5dd; border-radius: 6px; cursor: pointer; }
.tt-icon:hover { color: #1f4e8c; border-color: #1f4e8c; }
.tt-icon-del:hover { color: #b3261e; border-color: #b3261e; }
.tt-icon:disabled { opacity: .5; cursor: not-allowed; }
.tt-start { display: block; font-weight: 700; color: #1c2530; }
.tt-end { display: block; font-size: .8rem; font-weight: 400; color: #5d6b7a; }
.tt-table thead th.tt-today { color: #1f4e8c; background: #e8f0fc; box-shadow: inset 0 -3px 0 #1f4e8c; }
.tt-table td.tt-today-col { background: #fafcff; }

/* All classes master sheet */
.tt-master-table { min-width: 1100px; }
.tt-master-table .tt-classname { width: 120px; white-space: normal; }
.tt-master .tt-cell { padding: 6px 8px; margin-bottom: 6px; }
.tt-mtime { font-size: .72rem; font-weight: 700; color: #1c2530; }
.tt-master .tt-subject { font-size: .85rem; }
.tt-master .tt-teacher { font-size: .72rem; }
.tt-master .tt-actions { top: 4px; right: 4px; }

@media (max-width: 560px) { .tt-modal-body { grid-template-columns: 1fr; } }

@media print {
  @page { size: A4 landscape; margin: 12mm; }
  body * { visibility: hidden; }
  .tt-sheet, .tt-sheet * { visibility: visible; }
  .tt-sheet { position: absolute; left: 0; top: 0; width: 100%; color: #1c2530; }
  .tt-print-head { display: block; text-align: center; border-bottom: 2px solid #1c2530; padding-bottom: 8px; margin-bottom: 14px; }
  .tt-print-head h1 { margin: 0; font-size: 1.4rem; }
  .tt-print-head p { margin: 4px 0 0; }
  .tt-noprint { display: none !important; }
  .tt-wrap { overflow: visible; border: 0; }
  .tt-table { min-width: 0; font-size: 10pt; }
  .tt-table thead th.tt-today { color: #5d6b7a; background: #f6f8fa; box-shadow: none; }
  .tt-table td.tt-today-col { background: #fff; }
  .tt-cell { background: #f3f3f3; border-left-color: #1c2530; }
  .tt-room { background: #fff; border: 1px solid #ccc; }
  .tt-master-table { min-width: 0; font-size: 8pt; }
  .tt-master-table th, .tt-master-table td { padding: 4px 5px; }
  .tt-master .tt-cell { padding: 3px 5px; margin-bottom: 3px; }
  .tt-master .tt-subject { font-size: 8pt; }
  .tt-master .tt-teacher, .tt-mtime { font-size: 7pt; }
  .tt-master tr { break-inside: avoid; page-break-inside: avoid; }
}
`;