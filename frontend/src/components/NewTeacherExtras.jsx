import { useEffect, useState } from "react";
import { api } from "../lib/api";

const FREQUENCIES = [
  { value: "daily", label: "Task of the day" },
  { value: "weekly", label: "Task of the week" },
  { value: "monthly", label: "Task of the month" },
];
const freqLabel = (v) => FREQUENCIES.find((x) => x.value === v)?.label ?? v;
const inputCls = "rounded-lg border border-keen-border bg-white px-2.5 py-1.5 text-xs";
const EMPTY_DRAFT = { title: "", frequency: "daily", due_date: "" };

// Lectures picker and tasks list for the Add Teacher form.
// value = { subjectIds: [], tasks: [{ title, frequency, due_date }] }
export default function NewTeacherExtras({ value, onChange }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  useEffect(() => {
    let alive = true;
    api
      .listLectureOptions()
      .then((data) => alive && setOptions(Array.isArray(data) ? data : data?.results ?? []))
      .catch((e) => alive && setLoadError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const toggleSubject = (id) => {
    const has = value.subjectIds.includes(id);
    onChange({
      ...value,
      subjectIds: has ? value.subjectIds.filter((x) => x !== id) : [...value.subjectIds, id],
    });
  };

  const addTask = () => {
    if (!draft.title.trim()) return;
    onChange({
      ...value,
      tasks: [
        ...value.tasks,
        { title: draft.title.trim(), frequency: draft.frequency, due_date: draft.due_date || null },
      ],
    });
    setDraft(EMPTY_DRAFT);
  };

  const removeTask = (index) => {
    onChange({ ...value, tasks: value.tasks.filter((_, i) => i !== index) });
  };

  return (
    <>
      <section className="space-y-3">
        <p className="text-xs font-bold text-keen-charcoal">Lectures (subjects)</p>
        {loading && <p className="text-xs text-keen-muted">Loading subjects...</p>}
        {loadError && <p className="text-[11px] font-medium text-red-600">{loadError}</p>}
        {!loading && !loadError && options.length === 0 && (
          <p className="text-xs text-keen-muted">No subjects exist yet. Add them on the Subjects page first.</p>
        )}
        {options.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((s) => (
              <label key={s.id} className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={value.subjectIds.includes(s.id)}
                  onChange={() => toggleSubject(s.id)}
                />
                <span>
                  <span className="font-bold text-keen-charcoal">{s.name}</span>
                  {s.class_name ? " (" + s.class_name + ")" : ""}
                  {s.teacher_id && (
                    <span className="block text-keen-muted">
                      Now with {s.teacher_name}. Ticking it moves it to this teacher.
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-bold text-keen-charcoal">Tasks</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-bold text-keen-muted">
            Task
            <input
              className={inputCls + " w-56"}
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
          <button
            type="button"
            onClick={addTask}
            disabled={!draft.title.trim()}
            className="rounded-lg border border-keen-border px-3 py-1.5 text-xs font-bold text-keen-charcoal disabled:opacity-50"
          >
            Add task
          </button>
        </div>
        {value.tasks.length > 0 && (
          <ul className="divide-y divide-keen-border rounded-lg border border-keen-border">
            {value.tasks.map((t, i) => (
              <li key={i} className="flex items-center gap-3 p-3 text-xs">
                <span className="flex-1 font-bold text-keen-charcoal">{t.title}</span>
                <span className="text-keen-muted">{freqLabel(t.frequency)}</span>
                <span className="text-keen-muted">{t.due_date || "No due date"}</span>
                <button type="button" className="text-red-600 underline" onClick={() => removeTask(i)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] font-medium text-keen-muted">
          Tasks and lectures are saved with the teacher. You can change them later with Manage in the faculty
          list.
        </p>
      </section>
    </>
  );
}