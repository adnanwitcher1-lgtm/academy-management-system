import { useEffect, useState } from "react";
import { api } from "../lib/api";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function dayIndex(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" || /^\d+$/.test(String(v))) return Number(v);
  const i = NAMES.findIndex((n) => n.startsWith(String(v).toLowerCase().slice(0, 3)));
  return i >= 0 ? i : null;
}
const pick = (o, keys) => keys.map((k) => o[k]).find((x) => x !== undefined && x !== null && x !== "");
const hhmm = (t) => String(t ?? "").slice(0, 5);

export default function TodayClassesCard() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .listTimetable()
      .then((d) => alive && setSlots(asList(d)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const today = (new Date().getDay() + 6) % 7; // Monday = 0
  const todays = slots
    .filter((s) => dayIndex(pick(s, ["day", "weekday", "day_of_week"])) === today)
    .sort((a, b) => hhmm(pick(a, ["start_time", "start"])).localeCompare(hhmm(pick(b, ["start_time", "start"]))));

  return (
    <div>
      {error && <p style={{ color: "#b3261e", fontSize: ".85rem" }}>{error}</p>}
      {!loading && !error && slots.length === 0 && (
        <p style={{ color: "#5d6b7a", fontSize: ".85rem", textAlign: "center", padding: "16px 0" }}>
          No timetable has been published yet.
        </p>
      )}
      {!loading && !error && slots.length > 0 && todays.length === 0 && (
        <div>
          <p style={{ color: "#5d6b7a", fontSize: ".85rem", textAlign: "center", padding: "16px 0" }}>
            No classes scheduled for today.
          </p>
          <p style={{ color: "#b3261e", fontSize: ".75rem" }}>
            Debug: {slots.length} timetable slots found, none match today. First slot: {JSON.stringify(slots[0])}
          </p>
        </div>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {todays.map((s, i) => (
          <li key={s.id ?? i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #e6ecf1" }}>
            <div>
              <div style={{ fontWeight: 700, color: "#0f1c2e", fontSize: ".9rem" }}>
                {pick(s, ["subject_name", "subject_title"]) ?? (typeof s.subject === "object" ? s.subject?.name : s.subject) ?? "Class"}
              </div>
              <div style={{ fontSize: ".75rem", color: "#5d6b7a" }}>
                {pick(s, ["teacher_name", "teacher"]) ?? ""} {pick(s, ["room"]) ? " - Room " + s.room : ""}
              </div>
            </div>
            <span style={{ alignSelf: "center", padding: "2px 10px", borderRadius: 999, fontSize: ".75rem", fontWeight: 600, background: "#e0f7fb", color: "#0e7490" }}>
              {hhmm(pick(s, ["start_time", "start"]))} - {hhmm(pick(s, ["end_time", "end"]))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}