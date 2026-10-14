import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button, Notice, Panel } from "./ui";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const FREQUENCIES = [
  { value: "daily", label: "Task of the day" },
  { value: "weekly", label: "Task of the week" },
  { value: "monthly", label: "Task of the month" },
];
const freqLabel = (v) => FREQUENCIES.find((x) => x.value === v)?.label ?? v;

const inputCls = "rounded-lg border border-keen-border bg-white px-2.5 py-1.5 text-xs";
const EMPTY_TASK = { title: "", frequency: "daily", due_date: "" };

export default function TeacherExtras({ profile, onChanged, onClose }) {
  const [subjects, setSubjects] = useState([]);
  const [unassignOk, setUnassignOk] = useState(true);
  const [picked, setPicked] = useState(new Set());
  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState(EMPTY_TASK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const name = (profile.first_name + " " + (profile.last_name || "")).trim() || profile.username;

  const applyLectures = (data) => {
    setSubjects(data.subjects);
    setUnassignOk(data.unassign_supported);
    setPicked(new Set(data.subjects.filter((s) => s.mine).map((s) => s.id)));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [lect, tks] = await Promise.all([
        api.getTeacherLectures(profile.id),
        api.listTeacherTasks(profile.id),
      ]);
      applyLectures(lect);
      setTasks(asList(tks));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  useEffect(() => {
    setNotice("");
    load();
  }, [load]);

  const toggleSubject = (id) => {
    setNotice("");
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function saveLectures() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await api.setTeacherLectures(profile.id, [...picked]);
      applyLectures(data);
      setNotice("Lectures saved.");
      onChanged && onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addTask() {
    if (!draft.title.trim()) return;
    setError("");
    setNotice("");
    try {
      const created = await api.createTeacherTask({
        teacher: profile.id,
        title: draft.title.trim(),
        frequency: draft.frequency,
        due_date: draft.due_date || null,
      });
      setTasks((list) => [created, ...list]);
      setDraft(EMPTY_TASK);
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleTask(task) {
    setBusyId(task.id);
    setError("");
    try {
      const updated = await api.updateTeacherTask(task.id, { is_done: !task.is_done });
      setTasks((list) => list.map((x) => (x.id === task.id ? updated : x)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeTask(task) {
    if (!window.confirm("Delete the task \"" + task.title + "\"?")) return;
    setBusyId(task.id);
    setError("");
    try {
      await api.deleteTeacherTask(task.id);
      setTasks((list) => list.filter((x) => x.id !== task.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel title={"Lectures and tasks: " + name}>
      <div className="p-5 space-y-8">
        <Notice>{error}</Notice>
        <Notice tone="success">{notice}</Notice>

        <section className="space-y-3">
          <p className="text-xs font-bold text-keen-charcoal">Lectures (subjects)</p>
          {loading ? (
            <p className="text-xs text-keen-muted">Loading...</p>
          ) : subjects.length === 0 ? (
            <p className="text-xs text-keen-muted">No subjects exist yet. Add them on the Subjects page.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {subjects.map((s) => {
                const other = s.teacher_id && !s.mine;
                return (
                  <label key={s.id} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={picked.has(s.id)}
                      onChange={() => toggleSubject(s.id)}
                    />
                    <span>
                      <span className="font-bold text-keen-charcoal">{s.name}</span>
                      {s.class_name ? " (" + s.class_name + ")" : ""}
                      {other && (
                        <span className="block text-keen-muted">
                          Now with {s.teacher_name}. Ticking it moves it to this teacher.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {!unassignOk && (
            <p className="text-[11px] font-medium text-keen-muted">
              Unticking a subject cannot leave it without a teacher. To take it off this teacher, assign it to
              someone else on the Subjects page.
            </p>
          )}
          <Button onClick={saveLectures} disabled={saving || loading}>
            {saving ? "Saving..." : "Save lectures"}
          </Button>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-bold text-keen-charcoal">Tasks</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-bold text-keen-muted">
              Task
              <input
                className={inputCls + " w-64"}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-keen-muted">
              Repeats
              <select
                className={inputCls}
                value={draft.frequency}
                onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}
              >
                {FREQUENCIES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-keen-muted">
              Due date
              <input
                type="date"
                className={inputCls}
                value={draft.due_date}
                onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
              />
            </label>
            <Button onClick={addTask} disabled={!draft.title.trim()}>
              Add task
            </Button>
          </div>

          {!loading && tasks.length === 0 && <p className="text-xs text-keen-muted">No tasks yet.</p>}
          {tasks.length > 0 && (
            <ul className="divide-y divide-keen-border rounded-lg border border-keen-border">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-3 text-xs">
                  <input
                    type="checkbox"
                    checked={t.is_done}
                    disabled={busyId === t.id}
                    onChange={() => toggleTask(t)}
                    aria-label={"Mark done: " + t.title}
                  />
                  <span className={"flex-1 " + (t.is_done ? "text-keen-muted line-through" : "text-keen-charcoal font-bold")}>
                    {t.title}
                  </span>
                  <span className="text-keen-muted">{freqLabel(t.frequency)}</span>
                  <span className="text-keen-muted">{t.due_date || "No due date"}</span>
                  <button
                    type="button"
                    className="text-red-600 underline"
                    disabled={busyId === t.id}
                    onClick={() => removeTask(t)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button type="button" className="text-xs font-bold text-keen-muted underline" onClick={onClose}>
          Close
        </button>
      </div>
    </Panel>
  );
}