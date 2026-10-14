import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AppShell, Notice } from "../components/ui";
import TeacherPerformance from "../components/TeacherPerformance";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const hhmm = (t) => (t || "").slice(0, 5);
const toMin = (t) => {
  const [h, m] = hhmm(t).split(":").map(Number);
  return h * 60 + (m || 0);
};
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hh = Number(h);
  return (hh % 12 || 12) + ":" + m + " " + (hh >= 12 ? "PM" : "AM");
};
const titleCase = (s) => (s || "").toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
const BAR_TONES = ["#0AA9D4", "#17E0E4", "#7C3AED", "#F59E0B", "#E11D48", "#16A34A"];
const toneFor = (text) => {
  let n = 0;
  for (const ch of String(text || "")) n += ch.charCodeAt(0);
  return BAR_TONES[n % BAR_TONES.length];
};


const card = "rounded-2xl border border-keen-border bg-white shadow-sm";

function StatCard({ label, value, hint, icon, href }) {
  const body = (
    <div className={card + " min-w-0 p-5 transition hover:-translate-y-0.5 hover:shadow-md"}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-keen-muted">{label}</p>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-keen-cyanSoft text-base">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-extrabold text-keen-charcoal">{value}</p>
      <p className="mt-1 text-xs text-keen-muted">{hint}</p>
    </div>
  );
  return href ? <a href={href} className="block">{body}</a> : body;
}



export default function TeacherDashboard() {
  const { session } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [hasAttendanceClass, setHasAttendanceClass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [subj, tt, tk, cls] = await Promise.all([
        api.listSubjects(),
        api.listTimetable().catch(() => []),
        api.listTeacherTasks().catch(() => []),
        api.attendanceClasses().catch(() => []),
      ]);
      setSubjects(asList(subj));
      setTimetable(asList(tt));
      setTasks(asList(tk));
      setHasAttendanceClass(asList(cls).length > 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const today = DAY_NAMES[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = titleCase(String(session?.username || "").split(/[\s._-]/)[0]);

  const todayLectures = useMemo(
    () =>
      timetable
        .filter((s) => s.day_of_week === today)
        .sort((a, b) => hhmm(a.start_time).localeCompare(hhmm(b.start_time))),
    [timetable, today]
  );
  const nextLecture = todayLectures.find((s) => toMin(s.start_time) > nowMin);
  const nextIn = nextLecture ? toMin(nextLecture.start_time) - nowMin : null;
  const totalMinutes = todayLectures.reduce((sum, s) => sum + Math.max(0, toMin(s.end_time) - toMin(s.start_time)), 0);
  const openTasks = tasks.filter((t) => !t.is_done);

  // First gap of 30+ minutes between two lectures becomes the "planning period".
  let planning = null;
  for (let i = 0; i < todayLectures.length - 1; i++) {
    const gap = toMin(todayLectures[i + 1].start_time) - toMin(todayLectures[i].end_time);
    if (gap >= 30) {
      planning = { from: todayLectures[i].end_time, to: todayLectures[i + 1].start_time, gap };
      break;
    }
  }

  const fmtNext = (m) => (m >= 60 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : m + " min");

  return (
    <AppShell title="Dashboard" subtitle="Your classes, schedule and student progress.">
      <Notice>{error}</Notice>

      {/* Greeting */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0AA9D4]">
            <span className="h-0.5 w-8 bg-[#0AA9D4]" />
            {today}, {MONTHS[now.getMonth()]} {now.getDate()}
          </p>
          <h2 className="mt-2 text-3xl font-extrabold text-keen-charcoal sm:text-4xl">
            {greeting}{firstName ? ", " + firstName : ""}.
          </h2>
          <p className="mt-1 text-sm text-keen-muted">Here&apos;s what&apos;s happening with your classes today.</p>
        </div>
        <a href="/teacher/tasks" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#17E0E4] to-[#0AA9D4] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:shadow-md">
          <span className="text-lg leading-none">+</span> Create assignment
        </a>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Subjects" value={loading ? "-" : subjects.length} hint="Assigned to you" icon="📚" href="/teacher/marks" />
        <StatCard
          label="Classes today"
          value={loading ? "-" : todayLectures.length}
          hint={nextIn !== null ? "Next class in " + fmtNext(nextIn) : todayLectures.length ? "All done for today" : "Nothing scheduled"}
          icon="🗓️"
          href="/timetable"
        />
        <StatCard label="Open tasks" value={loading ? "-" : openTasks.length} hint={openTasks.length ? "Waiting on you" : "All caught up"} icon="✅" href="/teacher/tasks" />
        {hasAttendanceClass ? (
          <StatCard label="Attendance" value="Take" hint="Mark today's register" icon="🧾" href="/attendance" />
        ) : (
          <StatCard label="Teaching time" value={loading ? "-" : Math.floor(totalMinutes / 60) + "h " + (totalMinutes % 60) + "m"} hint="Scheduled today" icon="⏱️" />
        )}
      </div>

      {/* Today's schedule */}
      <section className={card + " mb-6 overflow-hidden"}>
        <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-5">
          <div>
            <h3 className="text-lg font-extrabold text-keen-charcoal">Today&apos;s schedule</h3>
            <p className="text-xs text-keen-muted">
              {loading ? "Loading..." : todayLectures.length + (todayLectures.length === 1 ? " class" : " classes") + " · " + Math.floor(totalMinutes / 60) + "h " + (totalMinutes % 60) + "m total"}
            </p>
          </div>
          <a href="/timetable" className="text-sm font-bold text-[#0AA9D4] hover:underline">Full timetable &rarr;</a>
        </div>
        {loading ? (
          <p className="border-t border-keen-border p-8 text-center text-xs font-medium text-keen-muted">Loading...</p>
        ) : todayLectures.length === 0 ? (
          <div className="border-t border-keen-border p-10 text-center">
            <p className="text-sm font-bold text-keen-charcoal">No lectures today</p>
            <p className="mt-1 text-xs text-keen-muted">Nothing scheduled on the timetable for {today}.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-keen-border">
            {todayLectures.map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-6 py-4 transition hover:bg-keen-cyanSoft/40">
                <div className="w-20 shrink-0">
                  <p className="text-sm font-extrabold text-keen-charcoal">{fmtTime(s.start_time)}</p>
                  <p className="text-[11px] text-keen-muted">{fmtTime(s.end_time)}</p>
                </div>
                <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: toneFor(s.subject_name) }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-keen-charcoal">{s.subject_name}</p>
                  <p className="truncate text-xs text-keen-muted">{s.class_label}{s.room ? " · Room " + s.room : ""}</p>
                </div>
                {nextLecture && nextLecture.id === s.id && (
                  <span className="shrink-0 rounded-full bg-keen-cyanSoft px-3 py-1 text-xs font-bold text-[#0AA9D4]">In {fmtNext(nextIn)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {planning && (
          <div className="mx-6 mb-5 mt-1 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="text-keen-muted">
              <b className="text-keen-charcoal">Planning period</b> from {fmtTime(planning.from)} to {fmtTime(planning.to)}
            </span>
            <span className="text-xs font-bold text-keen-muted">{planning.gap} min</span>
          </div>
        )}
      </section>

      <div className="mb-6">
        <TeacherPerformance />
      </div>
      {/* Assignments (your tasks) */}
      <section className={card + " mb-6 overflow-hidden"}>
        <div className="flex items-start justify-between px-6 pb-4 pt-5">
          <div>
            <h3 className="text-lg font-extrabold text-keen-charcoal">Assignments</h3>
            <p className="text-xs text-keen-muted">Recent and upcoming work</p>
          </div>
          <a href="/teacher/tasks" className="text-sm font-bold text-[#0AA9D4] hover:underline">View all &rarr;</a>
        </div>
        {loading ? (
          <p className="border-t border-keen-border p-8 text-center text-xs font-medium text-keen-muted">Loading...</p>
        ) : openTasks.length === 0 ? (
          <div className="border-t border-keen-border p-10 text-center">
            <p className="text-sm font-bold text-keen-charcoal">Nothing pending</p>
            <p className="mt-1 text-xs text-keen-muted">New tasks will show up here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-keen-border">
            {openTasks.slice(0, 5).map((t, i) => (
              <li key={t.id ?? i} className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-keen-cyanSoft/40">
                <div className="min-w-0">
                  <p className="truncate font-bold text-keen-charcoal">{t.title || t.name || "Untitled task"}</p>
                  {t.description && <p className="truncate text-xs text-keen-muted">{t.description}</p>}
                </div>
                {(t.due_date || t.due) && (
                  <span className="shrink-0 rounded-full bg-keen-cyanSoft px-3 py-1 text-xs font-bold text-[#0AA9D4]">{t.due_date || t.due}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Subjects */}
      <section className={card + " overflow-hidden"}>
        <div className="px-6 pb-4 pt-5">
          <h3 className="text-lg font-extrabold text-keen-charcoal">{subjects.length} subjects assigned to you</h3>
        </div>
        {loading ? (
          <p className="border-t border-keen-border p-8 text-center text-xs font-medium text-keen-muted">Loading...</p>
        ) : subjects.length === 0 ? (
          <div className="border-t border-keen-border p-10 text-center">
            <p className="text-sm font-bold text-keen-charcoal">No subjects assigned yet</p>
            <p className="mt-1 text-xs text-keen-muted">Ask the admin to assign you a subject from School Classes / Subjects.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-keen-border">
            {subjects.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-6 py-3 transition hover:bg-keen-cyanSoft/40">
                <div className="min-w-0">
                  <p className="truncate font-bold text-keen-charcoal">{s.name}</p>
                  <p className="text-xs text-keen-muted">{s.code || "-"}</p>
                </div>
                <a href="/teacher/marks" className="shrink-0 rounded-full bg-keen-cyanSoft px-3 py-1 text-xs font-bold text-[#0AA9D4] hover:underline">Enter marks</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}