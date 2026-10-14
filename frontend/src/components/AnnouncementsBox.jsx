import { useEffect, useState } from "react";
import { api } from "../lib/api";

const AUDIENCE = { all: "Everyone", teacher: "Teachers", student: "Students" };
const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "";

export default function AnnouncementsBox({ limit = 5 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .listAnnouncements()
      .then((d) => alive && setItems((Array.isArray(d) ? d : d?.results ?? []).slice(0, limit)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [limit]);

  return (
    <div className="ab-box">
      <style>{css}</style>
      <h3>Announcements</h3>
      {loading && <p className="ab-muted">Loading...</p>}
      {error && <p className="ab-err">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="ab-muted">No announcements right now.</p>}
      {items.map((a) => (
        <div key={a.id} className="ab-item">
          <div className="ab-top">
            <strong>{a.title}</strong>
            <span className="ab-pill">{AUDIENCE[a.target_role] || a.target_role}</span>
          </div>
          <p>{a.body}</p>
          <small>
            {a.created_by_name ? a.created_by_name + " · " : ""}
            {fmt(a.created_at)}
          </small>
        </div>
      ))}
    </div>
  );
}

const css = `
.ab-box { background: #fff; border: 1px solid #e3e7ed; border-radius: 14px; padding: 18px 20px; }
.ab-box h3 { margin: 0 0 12px; font-size: 16px; color: #1c2530; }
.ab-muted { color: #94a0ad; font-size: 14px; margin: 0; }
.ab-err { color: #b3261e; font-size: 14px; margin: 0; }
.ab-item { padding: 12px 0; border-top: 1px solid #eef0f3; }
.ab-item:first-of-type { border-top: 0; padding-top: 0; }
.ab-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.ab-item p { margin: 6px 0; font-size: 14px; color: #475467; white-space: pre-wrap; }
.ab-item small { color: #94a0ad; font-size: 12px; }
.ab-pill { padding: 2px 10px; border-radius: 999px; background: #e8fafa; color: #0a7f84; font-size: 11px; font-weight: 700; }
`;