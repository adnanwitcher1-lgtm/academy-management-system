import { useEffect, useMemo, useState } from "react";
import { api, loadSession } from "../lib/api";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? d?.records ?? d?.history ?? d?.days ?? []);
const iso = (d) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const COLORS = { present: "#1e6b3a", late: "#d19a00", absent: "#b3261e", leave: "#1d4ed8" };

function userId() {
  try {
    const t = loadSession()?.access;
    return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).user_id ?? null;
  } catch {
    return null;
  }
}

export default function StudentAttendanceCard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    api
      .attendanceHistory(userId(), iso(from), iso(to))
      .then((d) => alive && setRows(asList(d)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const days = useMemo(
    () =>
      rows
        .map((r) => ({ date: String(r.date ?? "").slice(0, 10), status: String(r.status ?? "").toLowerCase() }))
        .filter((r) => COLORS[r.status])
        .sort((a, b) => a.date.localeCompare(b.date)),
    [rows]
  );
  const attended = days.filter((d) => d.status === "present" || d.status === "late").length;
  const pct = days.length ? Math.round((attended * 100) / days.length) : null;

  return (
    <div>
      <div style={{ fontSize: "2rem", fontWeight: 800, color: pct !== null && pct < 75 ? "#b3261e" : "#0f1c2e" }}>
        {pct !== null ? pct + "%" : "-"}
      </div>
      <div style={{ fontSize: ".8rem", color: "#5d6b7a" }}>
        {pct !== null ? attended + " of " + days.length + " days attended (last 30 days)" : "No attendance marked yet"}
      </div>
      {error && <p style={{ color: "#b3261e", fontSize: ".85rem" }}>{error}</p>}
      {!loading && !error && rows.length > 0 && days.length === 0 && (
        <p style={{ color: "#b3261e", fontSize: ".8rem" }}>
          Got {rows.length} records but no recognizable date/status fields. First record: {JSON.stringify(rows[0])}
        </p>
      )}
      <div style={{ display: "flex", gap: 4, marginTop: 14, alignItems: "flex-end", height: 40 }}>
        {days.slice(-14).map((d) => (
          <div
            key={d.date}
            title={d.date + ": " + d.status}
            style={{ flex: 1, height: d.status === "absent" ? 14 : 40, borderRadius: 4, background: COLORS[d.status] }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: ".7rem", color: "#5d6b7a", flexWrap: "wrap" }}>
        {Object.entries(COLORS).map(([k, c]) => (
          <span key={k}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: c, marginRight: 4 }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}