import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, loadSession } from "../lib/api";
import { AppShell } from "../components/ui";
import StudentAttendanceCard from "../components/StudentAttendanceCard";
import UpcomingExamsCard from "../components/UpcomingExamsCard";
import FeeStatusChart from "../components/FeeStatusChart";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const titleCase = (s) => (s || "").toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
const TONES = ["#0fb3b8", "#7c3aed", "#d97706", "#e11d48", "#2563eb", "#16a34a"];
const toneFor = (text) => {
  let n = 0;
  for (const ch of String(text || "?")) n += ch.charCodeAt(0);
  return TONES[n % TONES.length];
};
const pick = (o, keys) => keys.map((k) => o[k]).find((x) => x !== undefined && x !== null && x !== "");
const hhmm = (t) => String(t ?? "").slice(0, 5);
const fmtTime = (t) => {
  const s = hhmm(t);
  if (!s) return "";
  const [h, m] = s.split(":");
  const hh = Number(h);
  return (hh % 12 || 12) + ":" + m + " " + (hh >= 12 ? "PM" : "AM");
};
const NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
function dayIndex(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" || /^\d+$/.test(String(v))) return Number(v);
  const i = NAMES.findIndex((n) => n.startsWith(String(v).toLowerCase().slice(0, 3)));
  return i >= 0 ? i : null;
}

function gradeFor(pct) {
  if (pct === null) return null;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "D";
}

function userId() {
  try {
    const t = loadSession()?.access;
    return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).user_id ?? null;
  } catch {
    return null;
  }
}

export default function StudentDashboard() {
  const { session } = useAuth();
  const displayName = titleCase(session?.user?.first_name || session?.username || "");

  const [slots, setSlots] = useState([]);
  const [marks, setMarks] = useState([]);
  const [attendancePct, setAttendancePct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

    Promise.all([
      api.listTimetable().catch(() => []),
      api.listMarks().catch(() => []),
      api.attendanceHistory(userId(), iso(from), iso(to)).catch(() => null),
    ]).then(([tt, mk, att]) => {
      if (!alive) return;
      setSlots(asList(tt));
      setMarks(asList(mk));
      if (att && att.summary && typeof att.summary.percent === "number") {
        setAttendancePct(Math.round(att.summary.percent));
      } else {
        const rows = asList(att?.records ?? att)
          .map((r) => String(r.status ?? "").toLowerCase())
          .filter((s) => ["present", "late", "absent", "leave"].includes(s));
        const attended = rows.filter((s) => s === "present" || s === "late").length;
        setAttendancePct(rows.length ? Math.round((attended * 100) / rows.length) : null);
      }
    }).finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, []);

  // ----- subjects, derived from timetable (subject name + teacher + room) -----
  const subjects = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      const name = pick(s, ["subject_name", "subject_title"]) || (typeof s.subject === "object" ? s.subject?.name : s.subject);
      if (!name) continue;
      if (!map.has(name)) {
        map.set(name, {
          name,
          teacher: pick(s, ["teacher_name", "teacher"]) || "",
          room: pick(s, ["room"]) || "",
          slots: [],
        });
      }
      map.get(name).slots.push(s);
    }
    return [...map.values()];
  }, [slots]);

  // ----- per-subject performance, derived from marks when a subject field exists -----
  const subjectPerf = useMemo(() => {
    const map = new Map();
    for (const m of marks) {
      const name = pick(m, ["subject_name", "subject_title"]) || (typeof m.subject === "object" ? m.subject?.name : m.subject);
      if (!name) continue;
      if (!map.has(name)) map.set(name, { obtained: 0, total: 0 });
      const e = map.get(name);
      e.obtained += Number(m.obtained_marks || 0);
      e.total += Number(m.total_marks || 0);
    }
    const out = new Map();
    for (const [name, v] of map) {
      out.set(name, v.total > 0 ? (v.obtained / v.total) * 100 : null);
    }
    return out;
  }, [marks]);

  const hasSubjectMarks = subjectPerf.size > 0;

  // ----- exam-based performance (fallback when marks don't carry a subject) -----
  const examPerf = useMemo(() => {
    const byExam = new Map();
    for (const m of marks) {
      const key = m.exam;
      if (!byExam.has(key)) byExam.set(key, { name: m.exam_name ?? "Exam " + key, obtained: 0, total: 0 });
      const e = byExam.get(key);
      e.obtained += Number(m.obtained_marks || 0);
      e.total += Number(m.total_marks || 0);
    }
    return [...byExam.values()].map((e) => ({ ...e, pct: e.total > 0 ? (e.obtained / e.total) * 100 : null }));
  }, [marks]);

  const perfBars = hasSubjectMarks
    ? [...subjectPerf.entries()].map(([name, pct]) => ({ name, pct }))
    : examPerf.map((e) => ({ name: e.name, pct: e.pct }));
  const perfMax = Math.max(1, ...perfBars.map((b) => b.pct || 0));

  // ----- today's timetable -----
  const today = (new Date().getDay() + 6) % 7; // Monday = 0
  const todaysSlots = slots
    .filter((s) => dayIndex(pick(s, ["day", "weekday", "day_of_week"])) === today)
    .sort((a, b) => hhmm(pick(a, ["start_time", "start"])).localeCompare(hhmm(pick(b, ["start_time", "start"]))));

  const now = hhmm(new Date().toTimeString());
  const remaining = todaysSlots.filter((s) => hhmm(pick(s, ["start_time", "start"])) >= now).length;

  // ----- next class per subject (for the subject cards' "Next:" line) -----
  function nextClassFor(subjName) {
    const matches = slots.filter((s) => {
      const name = pick(s, ["subject_name", "subject_title"]) || (typeof s.subject === "object" ? s.subject?.name : s.subject);
      return name === subjName;
    });
    if (!matches.length) return null;
    const todayIdx = today;
    const sorted = matches
      .map((s) => ({ s, d: dayIndex(pick(s, ["day", "weekday", "day_of_week"])), t: hhmm(pick(s, ["start_time", "start"])) }))
      .filter((x) => x.d !== null)
      .sort((a, b) => {
        const da = (a.d - todayIdx + 7) % 7;
        const db = (b.d - todayIdx + 7) % 7;
        if (da !== db) return da - db;
        return a.t.localeCompare(b.t);
      });
    return sorted[0] || null;
  }

  const dayLabel = (idx) => (idx === today ? "Today" : NAMES[idx] ? titleCase(NAMES[idx].slice(0, 3)) : "");

  const formattedDate = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

  return (
    <AppShell title="" subtitle="">
      <style>{css}</style>
      <div className="sd">
        <div className="sd-date">{formattedDate}</div>
        <div className="sd-head">
          <h1>Welcome back{displayName ? ", " + displayName : ""}</h1>
          <Link to="/timetable" className="sd-link">View full timetable &rarr;</Link>
        </div>

        <div className="sd-hero">
          <section className="sd-banner">
            <span className="sd-banner-tag">CLASS ATTENDANCE</span>
            <h2>{attendancePct === null ? "No attendance marked yet." : attendancePct >= 75 ? "You're right on track." : "Attendance needs attention."}</h2>
            <p>
              {attendancePct === null
                ? "Your attendance will appear here once it's recorded."
                : "Your attendance over the last 30 days is " + attendancePct + "%. " + (attendancePct >= 75 ? "Keep showing up!" : "Try to attend more classes.")}
            </p>
            {attendancePct !== null && (
              <div className="sd-banner-bar">
                <div className="sd-banner-fill" style={{ width: attendancePct + "%" }} />
                <span>{attendancePct}%</span>
              </div>
            )}
          </section>

          <aside className="sd-today">
            <div className="sd-today-head">
              <div>
                <h3>Today's timetable</h3>
                <p>{todaysSlots.length === 0 ? "No classes today" : remaining + " class" + (remaining === 1 ? "" : "es") + " remaining"}</p>
              </div>
            </div>
            <div className="sd-today-list">
              {todaysSlots.length === 0 && <p className="sd-muted">Nothing scheduled for today.</p>}
              {todaysSlots.map((s, i) => {
                const name = pick(s, ["subject_name", "subject_title"]) || (typeof s.subject === "object" ? s.subject?.name : s.subject) || "Class";
                const start = hhmm(pick(s, ["start_time", "start"]));
                const done = start < now;
                return (
                  <div key={s.id ?? i} className="sd-today-row">
                    <span className="sd-today-time">{fmtTime(start)}</span>
                    <span className="sd-today-bar" style={{ background: toneFor(name) }} />
                    <div className="sd-today-main">
                      <strong>{name}</strong>
                      <small>
                        {pick(s, ["room"]) ? "Room " + s.room : ""}
                        {pick(s, ["teacher_name", "teacher"]) ? " · " + titleCase(pick(s, ["teacher_name", "teacher"])) : ""}
                      </small>
                    </div>
                    {done && <span className="sd-today-check">&#10003;</span>}
                  </div>
                );
              })}
            </div>
            <Link to="/timetable" className="sd-today-full">View full timetable &rarr;</Link>
          </aside>
        </div>

        <div className="sd-section-head">
          <div>
            <h3>Subject overview</h3>
            <p>Your latest results and upcoming work</p>
          </div>
          <Link to="/student/results" className="sd-btn-outline">View results &rarr;</Link>
        </div>

        {!loading && subjects.length === 0 && (
          <p className="sd-muted">No subjects have been scheduled for your class yet.</p>
        )}

        <div className="sd-subjects">
          {subjects.map((subj) => {
            const pct = subjectPerf.get(subj.name);
            const grade = hasSubjectMarks ? gradeFor(pct ?? null) : null;
            const nc = nextClassFor(subj.name);
            return (
              <div key={subj.name} className="sd-subj-card">
                <div className="sd-subj-top">
                  <span className="sd-subj-icon" style={{ background: toneFor(subj.name) }}>
                    {subj.name[0]?.toUpperCase()}
                  </span>
                  {grade && (
                    <div className="sd-subj-grade">
                      <small>CURRENT GRADE</small>
                      <strong style={{ color: toneFor(subj.name) }}>{grade}</strong>
                    </div>
                  )}
                </div>
                <h4>{subj.name}</h4>
                <p className="sd-subj-sub">
                  {subj.teacher ? titleCase(subj.teacher) : "No teacher yet"}
                  {subj.room ? " · Room " + subj.room : ""}
                </p>
                <div className="sd-subj-foot">
                  <span>{nc ? "Next: " + dayLabel(nc.d) + ", " + fmtTime(nc.t) : "No upcoming class"}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sd-mid">
          <section className="sd-card">
            <div className="sd-card-head">
              <h3>Academic performance</h3>
              <p>Latest score by {hasSubjectMarks ? "subject" : "exam"}</p>
            </div>
            {perfBars.length === 0 ? (
              <p className="sd-muted">No results published yet.</p>
            ) : (
              <div className="sd-bars">
                {perfBars.map((b) => (
                  <div key={b.name} className="sd-bar-col" title={b.name + ": " + (b.pct === null ? "n/a" : b.pct.toFixed(1) + "%")}>
                    <div className="sd-bar-wrap">
                      <div className="sd-bar" style={{ height: (b.pct === null ? 0 : Math.max((b.pct / perfMax) * 100, 4)) + "%" }} />
                    </div>
                    <span>{b.name.length > 10 ? b.name.slice(0, 9) + "…" : b.name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="sd-dark">
            <div className="sd-dark-top">
              <h3>Fee status</h3>
            </div>
            <FeeStatusChart />
          </aside>
        </div>

        <div className="sd-mid">
          <section className="sd-card">
            <div className="sd-card-head"><h3>Upcoming exams</h3></div>
            <UpcomingExamsCard />
          </section>
          <section className="sd-card">
            <div className="sd-card-head"><h3>Attendance detail</h3></div>
            <StudentAttendanceCard />
          </section>
        </div>
      </div>
    </AppShell>
  );
}

const css = `
.sd { max-width: 1120px; margin: 0 auto; }
.sd-date { font-size: 12px; font-weight: 700; letter-spacing: .12em; color: #5d6b7a; }
.sd-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin: 4px 0 20px; }
.sd-head h1 { margin: 0; font-size: 28px; color: #1c2530; }
.sd-link { font-size: 14px; font-weight: 700; color: #0a8a8f; text-decoration: none; white-space: nowrap; }
.sd-link:hover { text-decoration: underline; }
.sd-muted { color: #5d6b7a; font-size: 14px; }

.sd-hero { display: grid; grid-template-columns: minmax(0,2fr) minmax(0,1fr); gap: 16px; margin-bottom: 28px; }
@media (max-width: 900px) { .sd-hero { grid-template-columns: 1fr; } }

.sd-banner { position: relative; overflow: hidden; padding: 28px 30px; border-radius: 20px; color: #fff; background: linear-gradient(135deg, #0fb3b8 0%, #0a7a7e 100%); }
.sd-banner-tag { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(255,255,255,.2); font-size: 11px; font-weight: 700; letter-spacing: .08em; }
.sd-banner h2 { margin: 14px 0 8px; font-size: 26px; }
.sd-banner p { margin: 0; max-width: 440px; color: rgba(255,255,255,.9); font-size: 14px; }
.sd-banner-bar { position: relative; margin-top: 20px; height: 10px; border-radius: 999px; background: rgba(255,255,255,.25); }
.sd-banner-fill { height: 100%; border-radius: 999px; background: #fff; }
.sd-banner-bar span { position: absolute; right: 0; top: -22px; font-size: 13px; font-weight: 700; }

.sd-today { display: flex; flex-direction: column; padding: 20px 22px; background: #fff; border: 1px solid #e3e7ed; border-radius: 20px; box-shadow: 0 2px 10px rgba(28,37,48,.04); }
.sd-today-head h3 { margin: 0; font-size: 16px; color: #1c2530; }
.sd-today-head p { margin: 2px 0 14px; font-size: 13px; color: #5d6b7a; }
.sd-today-list { display: flex; flex-direction: column; gap: 10px; flex: 1; }
.sd-today-row { display: flex; align-items: center; gap: 10px; }
.sd-today-time { width: 58px; flex: none; font-size: 12px; font-weight: 700; color: #5d6b7a; }
.sd-today-bar { width: 3px; align-self: stretch; border-radius: 3px; }
.sd-today-main { flex: 1; min-width: 0; }
.sd-today-main strong { display: block; font-size: 14px; color: #1c2530; }
.sd-today-main small { font-size: 12px; color: #94a0ad; }
.sd-today-check { color: #1e7e34; font-weight: 700; }
.sd-today-full { margin-top: 14px; padding: 10px; text-align: center; border-radius: 10px; background: #f5f8f9; font-size: 13px; font-weight: 700; color: #0a8a8f; text-decoration: none; }
.sd-today-full:hover { background: #e8fafa; }

.sd-section-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.sd-section-head h3 { margin: 0; font-size: 20px; color: #1c2530; }
.sd-section-head p { margin: 2px 0 0; font-size: 14px; color: #5d6b7a; }
.sd-btn-outline { padding: 9px 16px; border-radius: 10px; border: 1px solid #0fb3b8; color: #0a8a8f; font-size: 14px; font-weight: 700; text-decoration: none; white-space: nowrap; }
.sd-btn-outline:hover { background: #e8fafa; }

.sd-subjects { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 28px; }
.sd-subj-card { padding: 20px; background: #fff; border: 1px solid #e3e7ed; border-radius: 18px; box-shadow: 0 2px 10px rgba(28,37,48,.04); }
.sd-subj-top { display: flex; align-items: flex-start; justify-content: space-between; }
.sd-subj-icon { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; color: #fff; font-weight: 800; font-size: 18px; }
.sd-subj-grade { text-align: right; }
.sd-subj-grade small { display: block; font-size: 10px; font-weight: 700; letter-spacing: .06em; color: #94a0ad; }
.sd-subj-grade strong { font-size: 22px; }
.sd-subj-card h4 { margin: 16px 0 2px; font-size: 17px; color: #1c2530; }
.sd-subj-sub { margin: 0; font-size: 13px; color: #5d6b7a; }
.sd-subj-foot { margin-top: 14px; padding-top: 12px; border-top: 1px solid #eef0f3; font-size: 13px; color: #475467; }

.sd-mid { display: grid; grid-template-columns: minmax(0,2fr) minmax(0,1fr); gap: 16px; margin-bottom: 20px; }
@media (max-width: 900px) { .sd-mid { grid-template-columns: 1fr; } }
.sd-card { padding: 22px 24px; background: #fff; border: 1px solid #e3e7ed; border-radius: 18px; box-shadow: 0 2px 10px rgba(28,37,48,.04); }
.sd-card-head h3 { margin: 0; font-size: 18px; color: #1c2530; }
.sd-card-head p { margin: 4px 0 16px; font-size: 13px; color: #5d6b7a; }
.sd-dark { padding: 22px 24px; border-radius: 18px; color: #fff; background: linear-gradient(160deg, #2b3033 0%, #1d2226 100%); }
.sd-dark-top h3 { margin: 0 0 14px; font-size: 16px; color: #fff; }
.sd-dark .fsc-big, .sd-dark .fsc-cap { color: #fff; }
.sd-dark .fsc-cap { color: rgba(255,255,255,.7); }
.sd-dark .fsc-bar { background: rgba(255,255,255,.15); }
.sd-dark .fsc-chip.fsc-c-paid { background: rgba(255,255,255,.12); color: #7CE7C4; }
.sd-dark .fsc-chip.fsc-c-due { background: rgba(255,255,255,.12); color: #ff9c9c; }

.sd-bars { display: flex; align-items: stretch; gap: 14px; height: 200px; }
.sd-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
.sd-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.sd-bar { width: 100%; border-radius: 10px 10px 4px 4px; background: #0fb3b8; transition: height .3s; }
.sd-bar-col span { font-size: 12px; color: #94a0ad; white-space: nowrap; }
`;