import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { AppShell, Notice, Panel } from "../components/ui";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const GROUPS = [
  { value: "daily", title: "Task of the day" },
  { value: "weekly", title: "Task of the week" },
  { value: "monthly", title: "Task of the month" },
];

const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
};

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .listTeacherTasks()
      .then((data) => alive && setTasks(asList(data)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function toggle(task) {
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

  const today = todayStr();

  return (
    <AppShell title="My tasks" subtitle="Tick a task when it is done.">
      <Notice>{error}</Notice>
      {loading && <p className="text-xs text-keen-muted">Loading tasks...</p>}
      {!loading && !error && tasks.length === 0 && (
        <p className="text-xs text-keen-muted">No tasks have been assigned to you yet.</p>
      )}
      <div className="space-y-6">
        {GROUPS.map((g) => {
          const rows = tasks.filter((t) => t.frequency === g.value);
          if (rows.length === 0) return null;
          return (
            <Panel key={g.value} title={g.title}>
              <ul className="divide-y divide-keen-border">
                {rows.map((t) => {
                  const late = !t.is_done && t.due_date && t.due_date < today;
                  return (
                    <li key={t.id} className="flex items-center gap-3 p-3 text-xs">
                      <input
                        type="checkbox"
                        checked={t.is_done}
                        disabled={busyId === t.id}
                        onChange={() => toggle(t)}
                        aria-label={"Mark done: " + t.title}
                      />
                      <span className={"flex-1 " + (t.is_done ? "text-keen-muted line-through" : "text-keen-charcoal font-bold")}>
                        {t.title}
                      </span>
                      <span className={late ? "font-bold text-red-600" : "text-keen-muted"}>
                        {t.due_date ? (late ? "Overdue: " : "Due ") + t.due_date : "No due date"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          );
        })}
      </div>
    </AppShell>
  );
}