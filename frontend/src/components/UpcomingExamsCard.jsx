import { useEffect, useState } from "react";
import { api } from "../lib/api";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const iso = (d) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dateOf = (e) => String(e.date ?? e.exam_date ?? e.start_date ?? "").slice(0, 10);

export default function UpcomingExamsCard() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .listExams()
      .then((d) => alive && setExams(asList(d)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const today = iso(new Date());
  const upcoming = exams
    .filter((e) => dateOf(e) >= today)
    .sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
    .slice(0, 4);
  const daysLeft = (d) => Math.round((new Date(d + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);

  return (
    <div>
      {error && <p style={{ color: "#b3261e", fontSize: ".85rem" }}>{error}</p>}
      {!loading && !error && upcoming.length === 0 && (
        <p style={{ color: "#5d6b7a", fontSize: ".85rem", padding: "24px 0", textAlign: "center" }}>
          No upcoming exams scheduled.
        </p>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {upcoming.map((e) => {
          const n = daysLeft(dateOf(e));
          return (
            <li
              key={e.id}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #e6ecf1" }}
            >
              <div>
                <div style={{ fontWeight: 700, color: "#0f1c2e", fontSize: ".9rem" }}>{e.name ?? e.title ?? "Exam " + e.id}</div>
                <div style={{ fontSize: ".75rem", color: "#5d6b7a" }}>{dateOf(e)}</div>
              </div>
              <span
                style={{
                  alignSelf: "center", padding: "2px 10px", borderRadius: 999, fontSize: ".75rem", fontWeight: 600,
                  background: n <= 3 ? "#fdecea" : "#e0f7fb", color: n <= 3 ? "#b3261e" : "#0e7490",
                }}
              >
                {n === 0 ? "Today" : n === 1 ? "Tomorrow" : "In " + n + " days"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}