import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import { AppShell, Button } from "../components/ui";
import AttendanceTrendChart from "../components/AttendanceTrendChart";

/* KEEN palette */
const CYAN = "#19D3F3";
const DEEP = "#0AA9D4";
const INK = "#0F2230";

const money = (n) => `PKR ${Number(n || 0).toLocaleString()}`;

function Card({ title, to, right, children, className = "" }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {(title || right) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-500">{to ? <Link to={to} className="hover:text-cyan-700 hover:underline">{title}</Link> : title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

function Pill({ tone = "slate", children }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    cyan: "bg-cyan-50 text-cyan-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

const feeTone = (s) =>
  ({ paid: "green", pending: "amber", overdue: "red" }[String(s).toLowerCase()] || "slate");

function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1] || pts[i];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[i + 2] || pts[i + 1];
    const t = 0.2;
    d += ` C ${x1 + (x2 - x0) * t} ${y1 + (y2 - y0) * t}, ${x2 - (x3 - x1) * t} ${y2 - (y3 - y1) * t}, ${x2} ${y2}`;
  }
  return d;
}

function EnrollmentChart({ data }) {
  const W = 320, H = 110, PAD = 8;
  const { line, area, last, labels } = useMemo(() => {
    const vals = data.map((d) => d.count);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const pts = data.map((d, i) => [
      PAD + (i * (W - PAD * 2)) / Math.max(data.length - 1, 1),
      PAD + (H - PAD * 2) * (1 - (d.count - min) / span),
    ]);
    const l = smoothPath(pts);
    return {
      line: l,
      area: pts.length > 1 ? `${l} L ${pts.at(-1)[0]} ${H} L ${pts[0][0]} ${H} Z` : "",
      last: pts.at(-1),
      labels: data.map((d) => d.month),
    };
  }, [data]);

  if (data.length < 2) return <p className="text-sm text-slate-400">Not enough data yet.</p>;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" role="img" aria-label="Enrollment trend">
        <defs>
          <linearGradient id="enrollFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={CYAN} stopOpacity="0.35" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#enrollFill)" />
        <path d={line} fill="none" stroke={DEEP} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r="4.5" fill="#fff" stroke={DEEP} strokeWidth="2.5" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-400">
        {labels.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

function Gauge({ pct }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative mx-auto w-44">
      <svg viewBox="0 0 180 100" className="w-full" role="img" aria-label={`Attendance ${v}%`}>
        <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#E5EAEC" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          pathLength="100"
          fill="none"
          stroke={DEEP}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${v} 100`}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center text-3xl font-extrabold" style={{ color: INK }}>
        {v}%
      </div>
    </div>
  );
}

function FeeBar({ pct, goal }) {
  return (
    <div>
      <div className="text-4xl font-extrabold" style={{ color: INK }}>{pct}%</div>
      <div className="relative mt-4 h-2.5 rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${CYAN}, ${DEEP})` }} />
        <div className="absolute -top-1 w-0.5 bg-slate-400" style={{ left: `${goal}%`, height: 18 }} title={`Goal ${goal}%`} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-medium text-slate-400">
        <span>Goal: {goal}%</span>
        <span>{pct}% received</span>
      </div>
    </div>
  );
}

function Donut({ pending, done }) {
  const total = pending + done;
  const R = 42;
  const C = 2 * Math.PI * R;
  const doneLen = total ? (done / total) * C : 0;
  const pendLen = total ? (pending / total) * C : 0;
  const pct = total ? Math.round((done * 100) / total) : 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${done} of ${total} tasks completed`}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#E5EAEC" strokeWidth="12" />
          {done > 0 && (
            <circle cx="50" cy="50" r={R} fill="none" stroke={CYAN} strokeWidth="12"
              strokeDasharray={`${doneLen} ${C}`} />
          )}
          {pending > 0 && (
            <circle cx="50" cy="50" r={R} fill="none" stroke="#F59E0B" strokeWidth="12"
              strokeDasharray={`${pendLen} ${C}`} strokeDashoffset={-doneLen} />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold" style={{ color: INK }}>{pct}%</span>
          <span className="text-[11px] font-medium text-slate-400">completed</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: CYAN }} />Completed
          </div>
          <div className="mt-0.5 text-lg font-extrabold" style={{ color: INK }}>{done}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-full bg-amber-500" />Pending
          </div>
          <div className="mt-0.5 text-lg font-extrabold" style={{ color: INK }}>{pending}</div>
        </div>
      </div>
    </div>
  );
}
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, pending, roster, inquiriesRaw] = await Promise.all([
        api.dashboardSummary(),
        api.pendingStudents(),
        api.listStudentRoster(),
        api.listInquiries(),
      ]);
      const asList = (x) => (Array.isArray(x) ? x : x?.results ?? []);
      summary.counts.students = asList(roster).length;
      summary.counts.pending_signups = asList(pending).length;
      const todayStr = new Date().toISOString().slice(0, 10);
      summary.todayInquiries = asList(inquiriesRaw).filter((i) => (i.created_at || "").slice(0, 10) === todayStr);
      setData(summary);
    } catch (e) {
      setError(e.message || "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error)
    return (
      <AppShell title="Admin dashboard"><div>
        <p className="mb-3 font-semibold text-rose-600">{error}</p>
        <button onClick={load} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Try again
        </button>
      </div></AppShell>
    );
  if (!data) return <AppShell title="Admin dashboard"><p className="text-slate-500">Loading dashboard...</p></AppShell>;

  const { counts, enrollment, attendance, fees, homework_pending, teachers, todayInquiries = [] } = data;
  const tasks = data.tasks || { pending: 0, done: 0 };
  const growth =
    enrollment.length > 1 && enrollment[0].count > 0
      ? Math.round(((enrollment.at(-1).count - enrollment[0].count) / enrollment[0].count) * 100)
      : null;

  const miniStats = [
    ["Students", counts.students, "/hod/students"],
    ["Teachers", counts.teachers, "/hod/teachers/new"],
    ["Classes", counts.classes, "/academics/classes"],
    ["Subjects", counts.subjects, "/academics/subjects"],
    ["Exams", counts.exams, "/exams"],
    ["Pending signups", counts.pending_signups, "/hod/students"],
  ];

  return (
    <AppShell
      title="Admin dashboard"
      subtitle="Overview of attendance, fees and academic operations."
      action={
        <Button variant="quiet" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      }
    >
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {miniStats.map(([label, value, to]) => (
          <Link key={label} to={to} className="rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-cyan-300 hover:shadow-md">
            <div className="text-xs font-semibold text-slate-400">{label}</div>
            <div className="text-2xl font-extrabold" style={{ color: label === "Pending signups" && value > 0 ? DEEP : INK }}>
              {value}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Enrollment trend" to="/hod/students"
          right={growth !== null && <Pill tone={growth >= 0 ? "cyan" : "red"}>{growth >= 0 ? "+" : ""}{growth}%</Pill>}
        >
          <EnrollmentChart data={enrollment} />
        </Card>


        <Card title="Attendance today">
          <AttendanceTrendChart />
        </Card>

        <Card title="Fee collection" to="/fees">
          <FeeBar pct={fees.collected_pct} goal={fees.goal_pct} />
        </Card>

        <Card title="Tasks" to="/teacher/tasks">
          <Donut pending={tasks.pending} done={tasks.done} />
        </Card>

        <Card
          title="Today's Inquiries" to="/inquiries"
          right={<Pill tone={todayInquiries.length > 0 ? "cyan" : "slate"}>{todayInquiries.length} today</Pill>}
        >
          {todayInquiries.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No inquiries today.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {todayInquiries.slice(0, 5).map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-semibold text-slate-700">{i.student_name}</div>
                    <div className="text-xs text-slate-400">{i.intended_class}</div>
                  </div>
                  <Pill tone={i.status === "enrolled" ? "green" : i.status === "dropped" ? "red" : "cyan"}>
                    {i.status.replace("_", " ")}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Teacher overview" to="/hod/teachers/new"
          right={
            <Link to="/hod/teachers/new" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">View all</Link>
          }
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-400">
                <th className="pb-2">Name</th><th className="pb-2">Subject</th><th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-slate-400">No teachers added yet.</td></tr>
              )}
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-xs font-bold text-cyan-300">
                        {t.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-semibold text-slate-700">{t.name}</span>
                    </div>
                  </td>
                 <td className="py-3 text-slate-500">
  {t.subject_specialization || "—"}
</td>
                  <td className="py-3 text-right"><Pill tone={t.active ? "green" : "slate"}>{t.active ? "active" : "inactive"}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card
          title="Fee collection details" to="/fees"
          right={
            <Link to="/fees" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
              View all
            </Link>
          }
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-400">
                <th className="pb-2">Student</th><th className="pb-2">Due date</th><th className="pb-2">Amount</th><th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fees.recent.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-slate-400">No fee challans yet.</td></tr>
              )}
              {fees.recent.map((f) => (
                <tr key={f.id}>
                  <td className="py-3 font-semibold text-slate-700">{f.student}</td>
                  <td className="py-3 text-slate-500">{f.due_date}</td>
                  <td className="py-3 font-semibold text-slate-700">{money(f.amount)}</td>
                  <td className="py-3 text-right"><Pill tone={feeTone(f.status)}>{f.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div></AppShell>
  );
}
