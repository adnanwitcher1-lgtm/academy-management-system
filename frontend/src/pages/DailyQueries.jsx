import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { AppShell } from "../components/ui";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const money = (n) => "Rs " + Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 });
const todayStr = () => new Date().toLocaleDateString("en-CA");
const AUDIENCE = { all: "Everyone", teacher: "Teachers", student: "Students" };
const KIND = {
  student: ["Student", "dq-k-student"],
  teacher: ["Teacher", "dq-k-teacher"],
  inquiry: ["Inquiry", "dq-k-inquiry"],
  fee: ["Fee", "dq-k-fee"],
  announcement: ["Notice", "dq-k-notice"],
  expense: ["Expense", "dq-k-expense"],
};

function fmtWhen(at, hasTime) {
  if (!at) return "";
  const d = new Date(at);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (at.slice(0, 10) === todayStr()) return hasTime ? time : "Today";
  return hasTime ? date + ", " + time : date;
}

const fmtStamp = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "";

export default function DailyQueries() {
  const [days, setDays] = useState(1);
  const [data, setData] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ title: "", body: "", target_role: "all" });
  const [posting, setPosting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(
    async (silent) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const [feed, ann] = await Promise.all([api.dailyFeed(days), api.listAnnouncements()]);
        setData(feed);
        setNotices(asList(ann));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [days]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 60000);
    return () => clearInterval(t);
  }, [load]);

  async function postNotice(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setPosting(true);
    setError("");
    setMsg("");
    try {
      await api.createAnnouncement({ title: form.title.trim(), body: form.body.trim(), target_role: form.target_role });
      setForm({ title: "", body: "", target_role: form.target_role });
      setMsg("Announcement posted.");
      setShowForm(false);
      load(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function removeNotice(a) {
    if (!window.confirm(`Delete announcement "${a.title}"?`)) return;
    setError("");
    try {
      await api.deleteAnnouncement(a.id);
      setNotices((list) => list.filter((x) => x.id !== a.id));
      setMsg("Announcement deleted.");
      load(true);
    } catch (err) {
      setError(err.message);
    }
  }

  const c = data?.counts;
  const windowLabel = days === 1 ? "today" : "last 7 days";
  const cards = c
    ? [
        ["New students", c.new_students, windowLabel],
        ["New teachers", c.new_teachers, windowLabel],
        ["New inquiries", c.new_inquiries, windowLabel],
        ["Fees collected", money(c.fees_collected), c.fees_count + " payment(s), " + windowLabel],
        ["Announcements", c.announcements, windowLabel],
      ]
    : [];

  return (
    <AppShell title="Daily Queries" subtitle="What happened today: new people, inquiries, notices and the day's schedule.">
      <style>{css}</style>

      <div className="dq-top">
        <div className="dq-toggle">
          <button type="button" className={days === 1 ? "on" : ""} onClick={() => setDays(1)}>
            Today
          </button>
          <button type="button" className={days === 7 ? "on" : ""} onClick={() => setDays(7)}>
            Last 7 days
          </button>
        </div>
        <button type="button" className="dq-btn" onClick={() => load(false)}>
          Refresh
        </button>
      </div>

      {error && <div className="dq-alert dq-err">{error}</div>}
      {msg && <div className="dq-alert dq-ok">{msg}</div>}
      {loading && !data && <p className="dq-muted">Loading...</p>}

      {data && (
        <>
          <div className="dq-cards">
            {cards.map(([label, value, sub]) => (
              <div key={label} className="dq-card">
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{sub}</small>
              </div>
            ))}
          </div>

          <div className="dq-grid">
            <div className="dq-col">
              <section className="dq-panel">
                <h3>{days === 1 ? "Today's activity" : "Recent activity"}</h3>
                {data.activity.length === 0 && <p className="dq-muted">Nothing new {windowLabel}.</p>}
                {data.activity.map((a, i) => {
                  const [label, cls] = KIND[a.type] || [a.type, ""];
                  return (
                    <div key={a.type + i} className="dq-feed">
                      <span className={"dq-kind " + cls}>{label}</span>
                      <div className="dq-feed-text">
                        <strong>{a.title}</strong>
                        <small>{a.detail}</small>
                      </div>
                      <span className="dq-when">{fmtWhen(a.at, a.has_time)}</span>
                    </div>
                  );
                })}
              </section>

              <section className="dq-panel">
                <div className="dq-panel-head">
                  <h3>{days === 1 ? "Today's inquiries" : "Inquiries, last 7 days"}</h3>
                  <a href="/inquiries" className="dq-link">
                    Open all inquiries
                  </a>
                </div>
                {data.inquiries.length === 0 ? (
                  <p className="dq-muted">No new inquiries {windowLabel}.</p>
                ) : (
                  <div className="dq-wrap">
                    <table className="dq-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Guardian</th>
                          <th>Phone</th>
                          <th>Class</th>
                          <th>Source</th>
                          <th>Status</th>
                          <th>Received</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.inquiries.map((i) => (
                          <tr key={i.id}>
                            <td className="dq-strong">{i.student_name}</td>
                            <td>{i.guardian_name || "-"}</td>
                            <td>{i.guardian_phone}</td>
                            <td>{i.intended_class}</td>
                            <td>{i.source}</td>
                            <td>
                              <span className="dq-status">{i.status}</span>
                            </td>
                            <td>{fmtStamp(i.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="dq-col">

              <section className="dq-panel">
                <h3>Today's schedule</h3>
                <p className="dq-muted dq-day">{data.weekday}</p>
                {data.schedule.exams.map((x) => (
                  <div key={"e" + x.id} className="dq-slot dq-slot-exam">
                    <span className="dq-time">Exam</span>
                    <div>
                      <strong>{x.name}</strong>
                      <small>{x.class || "All classes"}</small>
                    </div>
                  </div>
                ))}
                {data.schedule.lectures.map((l) => (
                  <div key={"l" + l.id} className="dq-slot">
                    <span className="dq-time">{l.start}</span>
                    <div>
                      <strong>{l.subject}</strong>
                      <small>
                        {l.class}
                        {l.teacher ? " · " + l.teacher : ""}
                        {l.room ? " · Room " + l.room : ""} · until {l.end}
                      </small>
                    </div>
                  </div>
                ))}
                {data.schedule.exams.length === 0 && data.schedule.lectures.length === 0 && (
                  <p className="dq-muted">Nothing scheduled today.</p>
                )}
              </section>

              <section className="dq-promo">
                <span className="dq-promo-dot dq-promo-dot-a" />
                <span className="dq-promo-dot dq-promo-dot-b" />
                <div className="dq-promo-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 10v4a1 1 0 001 1h2l9 4V5L6 9H4a1 1 0 00-1 1z" />
                    <path d="M7 15.5V19a1.5 1.5 0 003 0v-2.2" />
                    <path d="M18.5 9a4.5 4.5 0 010 6" />
                  </svg>
                </div>
                <div className="dq-promo-text">
                  <h3>Share an update</h3>
                  <p>Keep students and teachers informed with a new announcement.</p>
                  <button
                    type="button"
                    className="dq-promo-link"
                    onClick={() => {
                      setMsg("");
                      setShowForm(true);
                    }}
                  >
                    Create announcement
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </section>

              {notices.length > 0 && (
                <section className="dq-panel">
                  <h3>Recent announcements</h3>
                  {notices.slice(0, 6).map((a) => (
                    <div key={a.id} className="dq-notice">
                      <div className="dq-notice-top">
                        <strong>{a.title}</strong>
                        <span className="dq-pill">{AUDIENCE[a.target_role] || a.target_role}</span>
                      </div>
                      <p>{a.body}</p>
                      <div className="dq-notice-foot">
                        <small>
                          {a.created_by_name ? a.created_by_name + " · " : ""}
                          {fmtStamp(a.created_at)}
                        </small>
                        <button type="button" className="dq-del" onClick={() => removeNotice(a)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </div>
          </div>
        </>
      )}
          {showForm && (
        <div className="dq-overlay" onClick={() => !posting && setShowForm(false)}>
          <form className="dq-modal" onClick={(e) => e.stopPropagation()} onSubmit={postNotice}>
            <div className="dq-modal-head">
              <h3>Create announcement</h3>
              <button type="button" className="dq-x" onClick={() => setShowForm(false)}>
                &times;
              </button>
            </div>
            <div className="dq-modal-body">
              <label>
                Title
                <input
                  type="text"
                  maxLength={150}
                  placeholder="e.g. Parent-teacher meeting"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>
              <label>
                Message
                <textarea
                  rows={4}
                  placeholder="Write the announcement..."
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  required
                />
              </label>
              <div className="dq-aud">
                <span>Send to</span>
                <div className="dq-aud-opts">
                  {[
                    ["all", "Teachers and students"],
                    ["teacher", "Teachers only"],
                    ["student", "Students only"],
                  ].map(([v, l]) => (
                    <button
                      type="button"
                      key={v}
                      className={form.target_role === v ? "on" : ""}
                      onClick={() => setForm({ ...form, target_role: v })}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="dq-modal-foot">
              <button type="button" className="dq-btn" onClick={() => setShowForm(false)} disabled={posting}>
                Cancel
              </button>
              <button type="submit" className="dq-btn dq-primary" disabled={posting}>
                {posting ? "Posting..." : "Post announcement"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

const css = `
.dq-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.dq-toggle { display: inline-flex; border: 1px solid #d9dfe6; border-radius: 10px; overflow: hidden; background: #fff; }
.dq-toggle button { padding: 8px 18px; border: 0; background: #fff; font: inherit; font-size: 14px; font-weight: 600; color: #5d6b7a; cursor: pointer; }
.dq-toggle button.on { background: #0fb3b8; color: #fff; }
.dq-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #d9dfe6; background: #fff; font: inherit; font-size: 14px; font-weight: 600; color: #1c2530; cursor: pointer; }
.dq-primary { background: #0fb3b8; border-color: #0fb3b8; color: #fff; }
.dq-primary:disabled { opacity: .6; cursor: default; }
.dq-alert { padding: 10px 16px; border-radius: 8px; margin-bottom: 14px; font-size: 14px; }
.dq-err { background: #fdecea; color: #b3261e; }
.dq-ok { background: #e6f4ea; color: #1e7e34; }
.dq-muted { color: #94a0ad; font-size: 14px; margin: 0; }

.dq-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 18px; }
.dq-card { display: flex; flex-direction: column; gap: 4px; padding: 16px 18px; background: #fff; border: 1px solid #e3e7ed; border-left: 4px solid #0fb3b8; border-radius: 12px; }
.dq-card span { font-size: 13px; font-weight: 600; color: #5d6b7a; }
.dq-card strong { font-size: 26px; color: #1c2530; }
.dq-card small { font-size: 12px; color: #94a0ad; }

.dq-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 18px; align-items: start; }
@media (max-width: 1000px) { .dq-grid { grid-template-columns: minmax(0, 1fr); } }
.dq-col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.dq-panel { background: #fff; border: 1px solid #e3e7ed; border-radius: 14px; padding: 18px 20px; }
.dq-panel h3 { margin: 0 0 12px; font-size: 16px; color: #1c2530; }
.dq-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 4px; }
.dq-link { font-size: 13px; font-weight: 600; color: #1f4e8c; text-decoration: none; }
.dq-link:hover { text-decoration: underline; }

.dq-feed { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid #eef0f3; }
.dq-feed:first-of-type { border-top: 0; }
.dq-feed-text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.dq-feed-text strong { font-size: 14px; color: #1c2530; }
.dq-feed-text small { font-size: 12px; color: #5d6b7a; }
.dq-when { font-size: 12px; color: #94a0ad; white-space: nowrap; }
.dq-kind { min-width: 74px; text-align: center; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.dq-k-student { background: #e8f0fc; color: #1d4ed8; }
.dq-k-teacher { background: #efe8fc; color: #6d28d9; }
.dq-k-inquiry { background: #fff4d6; color: #7a5a00; }
.dq-k-fee { background: #e6f4ea; color: #1e7e34; }
.dq-k-notice { background: #e8fafa; color: #0a7f84; }
.dq-k-expense { background: #fdecea; color: #b3261e; }

.dq-wrap { overflow-x: auto; }
.dq-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dq-table th { text-align: left; padding: 8px 10px; background: #f7f8fa; color: #5d6b7a; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; }
.dq-table td { padding: 9px 10px; border-top: 1px solid #eef0f3; white-space: nowrap; }
.dq-strong { font-weight: 600; color: #1c2530; }
.dq-status { padding: 2px 10px; border-radius: 999px; background: #eef0f3; color: #475467; font-size: 12px; font-weight: 600; }

.dq-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.dq-form input, .dq-form textarea, .dq-form select { padding: 9px 12px; border: 1px solid #d9dfe6; border-radius: 8px; font: inherit; font-size: 14px; }
.dq-form-row { display: flex; gap: 8px; }
.dq-form-row select { flex: 1; }
.dq-notice { padding: 12px 0; border-top: 1px solid #eef0f3; }
.dq-notice-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.dq-notice p { margin: 6px 0; font-size: 14px; color: #475467; white-space: pre-wrap; }
.dq-notice-foot { display: flex; justify-content: space-between; align-items: center; }
.dq-notice-foot small { font-size: 12px; color: #94a0ad; }
.dq-pill { padding: 2px 10px; border-radius: 999px; background: #e8fafa; color: #0a7f84; font-size: 11px; font-weight: 700; }
.dq-del { background: none; border: 0; padding: 0; font-size: 12px; font-weight: 600; color: #b3261e; cursor: pointer; }

.dq-day { margin-bottom: 8px; }
.dq-slot { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-top: 1px solid #eef0f3; }
.dq-slot > div { display: flex; flex-direction: column; }
.dq-slot strong { font-size: 14px; color: #1c2530; }
.dq-slot small { font-size: 12px; color: #5d6b7a; }
.dq-time { min-width: 74px; font-size: 13px; font-weight: 700; color: #0a7f84; }
.dq-slot-exam .dq-time { color: #b3261e; }

.dq-promo { position: relative; overflow: hidden; display: flex; align-items: center; gap: 22px; padding: 28px; border-radius: 20px; color: #fff; background: linear-gradient(135deg, #2f3fa8 0%, #4558d4 100%); }
.dq-promo::after { content: ""; position: absolute; top: -70px; right: -50px; width: 170px; height: 170px; border-radius: 50%; border: 1px solid rgba(255,255,255,.18); }
.dq-promo-dot { position: absolute; border-radius: 50%; background: rgba(160,180,255,.9); }
.dq-promo-dot-a { width: 14px; height: 14px; top: 22px; left: 112px; }
.dq-promo-dot-b { width: 10px; height: 10px; bottom: 22px; left: 22px; background: #6f86ff; }
.dq-promo-icon { flex: none; width: 92px; height: 92px; border-radius: 24px; background: #fff; color: #3a4bbd; display: flex; align-items: center; justify-content: center; transform: rotate(-8deg); box-shadow: 0 14px 30px rgba(10,20,80,.35); }
.dq-promo-icon svg { width: 44px; height: 44px; }
.dq-promo-text { position: relative; z-index: 1; }
.dq-promo-text h3 { margin: 0 0 6px; font-size: 22px; font-weight: 700; color: #fff; }
.dq-promo-text p { margin: 0 0 14px; font-size: 13px; line-height: 1.5; color: rgba(255,255,255,.82); max-width: 260px; }
.dq-promo-link { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; padding: 0; color: #fff; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.dq-promo-link svg { width: 14px; height: 14px; transition: transform .15s; }
.dq-promo-link:hover svg { transform: translateX(3px); }

.dq-overlay { position: fixed; inset: 0; background: rgba(15,23,32,.5); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 16px; }
.dq-modal { background: #fff; border-radius: 18px; width: 100%; max-width: 480px; max-height: 92vh; overflow: auto; }
.dq-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid #eef0f3; }
.dq-modal-head h3 { margin: 0; font-size: 17px; color: #1c2530; }
.dq-x { background: none; border: 0; font-size: 24px; line-height: 1; color: #94a0ad; cursor: pointer; }
.dq-modal-body { display: flex; flex-direction: column; gap: 14px; padding: 20px 22px; }
.dq-modal-body label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #5d6b7a; }
.dq-modal-body input, .dq-modal-body textarea { padding: 10px 12px; border: 1px solid #d9dfe6; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 400; color: #1c2530; }
.dq-aud { display: flex; flex-direction: column; gap: 8px; }
.dq-aud > span { font-size: 13px; font-weight: 600; color: #5d6b7a; }
.dq-aud-opts { display: flex; flex-wrap: wrap; gap: 8px; }
.dq-aud-opts button { padding: 7px 14px; border-radius: 999px; border: 1px solid #d9dfe6; background: #fff; font: inherit; font-size: 13px; font-weight: 600; color: #5d6b7a; cursor: pointer; }
.dq-aud-opts button.on { background: #3a4bbd; border-color: #3a4bbd; color: #fff; }
.dq-modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid #eef0f3; background: #fafbfc; }
`;