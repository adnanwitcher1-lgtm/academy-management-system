import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { AppShell } from "../components/ui";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const STATUSES = [
  { value: "new", label: "New lead" },
  { value: "trial", label: "Trial class assigned" },
  { value: "follow_up", label: "Follow-up call" },
  { value: "enrolled", label: "Enrolled" },
  { value: "dropped", label: "Dropped" },
];
const SOURCES = [
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone call" },
  { value: "social", label: "Social media" },
  { value: "website", label: "Website" },
];
const labelOf = (list, value) => list.find((x) => x.value === value)?.label ?? value;

// Printed on every admission form. Edit these lines to match the academy's real policies.
const POLICIES = [
  "Fees are due by the date printed on each fee challan.",
  "Regular attendance is expected. Absences and late arrivals are reported to the guardian.",
  "Exam results are shared with the guardian after each exam.",
];

const EMPTY = {
  student_name: "",
  guardian_name: "",
  guardian_phone: "",
  intended_class: "",
  current_school: "",
  subjects: "",
  source: "walk_in",
};

const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
};
const isOpen = (lead) => lead.status !== "enrolled" && lead.status !== "dropped";
const followUpDue = (lead) => isOpen(lead) && lead.follow_up_date && lead.follow_up_date <= todayStr();

export default function Inquiries() {
  const [leads, setLeads] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [printing, setPrinting] = useState(null);

  const load = useCallback(async () => {
    try {
      const [ls, cls] = await Promise.all([api.listInquiries(), api.listSchoolClasses()]);
      setLeads(asList(ls));
      setClasses(asList(cls));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Opens the print dialog once the admission form for the chosen lead is on the page.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const canAdd =
    !saving && form.student_name.trim() && form.guardian_phone.trim() && form.intended_class.trim();

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const created = await api.createInquiry({
        ...form,
        student_name: form.student_name.trim(),
        guardian_name: form.guardian_name.trim(),
        guardian_phone: form.guardian_phone.trim(),
        intended_class: form.intended_class.trim(),
        current_school: form.current_school.trim(),
        subjects: form.subjects.trim(),
      });
      setLeads((list) => [created, ...list]);
      setForm(EMPTY);
      setNotice("Inquiry added for " + created.student_name + ".");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const patch = async (lead, changes) => {
    setBusyId(lead.id);
    setError("");
    setNotice("");
    try {
      const updated = await api.updateInquiry(lead.id, changes);
      setLeads((list) => list.map((x) => (x.id === lead.id ? updated : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (lead) => {
    if (!window.confirm("Delete the inquiry for " + lead.student_name + "?")) return;
    setBusyId(lead.id);
    setError("");
    try {
      await api.deleteInquiry(lead.id);
      setLeads((list) => list.filter((x) => x.id !== lead.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const c = { all: leads.length };
    for (const s of STATUSES) c[s.value] = 0;
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const dueCount = leads.filter(followUpDue).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return (
        l.student_name.toLowerCase().includes(q) ||
        (l.guardian_name || "").toLowerCase().includes(q) ||
        (l.guardian_phone || "").includes(q)
      );
    });
  }, [leads, filter, query]);

  return (
    <AppShell title="Inquiries" subtitle="Track prospective students from first contact to enrollment.">
      <style>{css}</style>
      <div className="iq">
        {error && (
          <div className="iq-msg iq-err" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="iq-msg iq-ok" role="status">
            {notice}
          </div>
        )}

        <form className="iq-form" onSubmit={add}>
          <label>
            Student name
            <input value={form.student_name} onChange={set("student_name")} />
          </label>
          <label>
            Guardian name
            <input value={form.guardian_name} onChange={set("guardian_name")} />
          </label>
          <label>
            Guardian phone
            <input type="tel" value={form.guardian_phone} onChange={set("guardian_phone")} />
          </label>
          <label>
            Intended class
            <input list="iq-classes" value={form.intended_class} onChange={set("intended_class")} />
            <datalist id="iq-classes">
              {classes.map((c) => (
                <option key={c.id} value={c.name ?? c.title ?? ""} />
              ))}
            </datalist>
          </label>
          <label>
            Current school
            <input value={form.current_school} onChange={set("current_school")} />
          </label>
          <label>
            Subjects of interest
            <input value={form.subjects} onChange={set("subjects")} />
          </label>
          <label>
            How they found us
            <select value={form.source} onChange={set("source")}>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!canAdd}>
            {saving ? "Adding..." : "Add inquiry"}
          </button>
        </form>

        <div className="iq-filters">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
            <option value="all">All inquiries ({counts.all})</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({counts[s.value] ?? 0})
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Search by student, guardian or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {dueCount > 0 && (
            <span className="iq-due-note">
              {dueCount} follow-up{dueCount === 1 ? "" : "s"} due
            </span>
          )}
        </div>

        {loading && <p className="iq-muted">Loading inquiries...</p>}
        {!loading && leads.length === 0 && (
          <p className="iq-muted">No inquiries yet. Add the first one above.</p>
        )}
        {!loading && leads.length > 0 && rows.length === 0 && (
          <p className="iq-muted">No inquiries match this filter.</p>
        )}

        {rows.length > 0 && (
          <div className="iq-table-wrap">
            <table className="iq-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Guardian</th>
                  <th>Class</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Follow-up</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.student_name}
                      {l.current_school && <div className="iq-sub">{l.current_school}</div>}
                    </td>
                    <td>
                      {l.guardian_name || "-"}
                      <div className="iq-sub">{l.guardian_phone}</div>
                    </td>
                    <td>{l.intended_class}</td>
                    <td>{labelOf(SOURCES, l.source)}</td>
                    <td>
                      <select
                        value={l.status}
                        disabled={busyId === l.id}
                        onChange={(e) => patch(l, { status: e.target.value })}
                        aria-label={"Status for " + l.student_name}
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="date"
                        value={l.follow_up_date || ""}
                        disabled={busyId === l.id}
                        className={followUpDue(l) ? "iq-late" : ""}
                        onChange={(e) => patch(l, { follow_up_date: e.target.value || null })}
                        aria-label={"Follow-up date for " + l.student_name}
                      />
                    </td>
                    <td className="num">
                      {l.status === "enrolled" && (
                        <button type="button" className="iq-print" onClick={() => setPrinting(l)}>
                          Admission form
                        </button>
                      )}
                      <button
                        type="button"
                        className="iq-link"
                        disabled={busyId === l.id}
                        onClick={() => remove(l)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {printing && (
          <article className="iq-sheet">
            <header>
              <h1>KEEN Evening Coaching</h1>
              <p>Admission form</p>
            </header>

            <h2>Student details</h2>
            <dl>
              <div>
                <dt>Student name</dt>
                <dd>{printing.student_name}</dd>
              </div>
              <div>
                <dt>Class</dt>
                <dd>{printing.intended_class}</dd>
              </div>
              <div>
                <dt>Current school</dt>
                <dd>{printing.current_school || "____________________"}</dd>
              </div>
              <div>
                <dt>Subjects</dt>
                <dd>{printing.subjects || "____________________"}</dd>
              </div>
              <div>
                <dt>Roll no.</dt>
                <dd>____________________</dd>
              </div>
              <div>
                <dt>Guardian</dt>
                <dd>{printing.guardian_name || "____________________"}</dd>
              </div>
              <div>
                <dt>Guardian phone</dt>
                <dd>{printing.guardian_phone}</dd>
              </div>
            </dl>

            <h2>Fee schedule</h2>
            <dl>
              <div>
                <dt>Monthly fee</dt>
                <dd>Rs ____________________</dd>
              </div>
              <div>
                <dt>Due each month by</dt>
                <dd>____________________</dd>
              </div>
            </dl>

            <h2>Academy policies</h2>
            <ul>
              {POLICIES.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>

            <h2>Guardian undertaking</h2>
            <p>
              I confirm that the details above are correct, and I agree to follow the academy policies
              and to pay fees by the due date.
            </p>

            <div className="iq-sign">
              <span>Parent signature</span>
              <span>Student signature</span>
              <span>Principal seal</span>
            </div>
          </article>
        )}
      </div>
    </AppShell>
  );
}

const css = `
.iq { --iq-line: #d9dfe6; --iq-muted: #5d6b7a; --iq-accent: #1f4e8c; max-width: 1000px; }
.iq-muted { color: var(--iq-muted); }
.iq-msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; font-size: .95rem; }
.iq-err { background: #fdecea; color: #b3261e; }
.iq-ok { background: #e7f4ec; color: #1e6b3a; }
.iq-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; align-items: end; margin-bottom: 24px; }
.iq-form label { display: flex; flex-direction: column; gap: 6px; font-size: .9rem; font-weight: 600; }
.iq select, .iq input { padding: 8px 10px; font: inherit; font-weight: 400; border: 1px solid var(--iq-line); border-radius: 6px; background: #fff; }
.iq-form button { padding: 10px 20px; font: inherit; font-weight: 600; color: #fff; background: var(--iq-accent); border: 0; border-radius: 6px; cursor: pointer; }
.iq-form button:disabled { background: #a9b4c2; cursor: not-allowed; }
.iq select:focus-visible, .iq input:focus-visible, .iq button:focus-visible { outline: 2px solid var(--iq-accent); outline-offset: 2px; }
.iq-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 14px; }
.iq-filters input { min-width: 260px; }
.iq-due-note { color: #b3261e; font-weight: 600; }
.iq-table-wrap { overflow-x: auto; border: 1px solid var(--iq-line); border-radius: 8px; background: #fff; }
.iq-table { width: 100%; border-collapse: collapse; }
.iq-table th, .iq-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--iq-line); vertical-align: top; }
.iq-table tbody tr:last-child td { border-bottom: 0; }
.iq-table th { font-size: .85rem; color: var(--iq-muted); font-weight: 600; background: #f6f8fa; }
.iq-table .num { text-align: right; white-space: nowrap; }
.iq-sub { color: var(--iq-muted); font-size: .85rem; }
.iq-late { border-color: #b3261e; background: #fdecea; }
.iq-print { padding: 6px 12px; font: inherit; color: var(--iq-accent); background: #fff; border: 1px solid var(--iq-accent); border-radius: 6px; cursor: pointer; margin-right: 8px; }
.iq-link { padding: 6px 8px; font: inherit; color: #b3261e; background: none; border: 0; cursor: pointer; text-decoration: underline; }
.iq-link:disabled { opacity: .6; cursor: not-allowed; }
.iq-sheet { display: none; }
@media print {
  @page { size: A4; margin: 15mm; }
  body * { visibility: hidden; }
  .iq-sheet, .iq-sheet * { visibility: visible; }
  .iq-sheet { display: block; position: absolute; left: 0; top: 0; width: 100%; color: #1c2530; font-size: 11pt; }
  .iq-sheet header { text-align: center; border-bottom: 2px solid #1c2530; padding-bottom: 10px; margin-bottom: 16px; }
  .iq-sheet h1 { margin: 0; font-size: 1.5rem; }
  .iq-sheet header p { margin: 4px 0 0; }
  .iq-sheet h2 { font-size: 1rem; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #cfd6de; }
  .iq-sheet dl { margin: 0; }
  .iq-sheet dl div { display: flex; gap: 16px; padding: 6px 0; }
  .iq-sheet dt { width: 150px; color: #5d6b7a; }
  .iq-sheet dd { margin: 0; font-weight: 600; }
  .iq-sheet ul { margin: 0; padding-left: 20px; }
  .iq-sheet p { margin: 0; }
  .iq-sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 80px; }
  .iq-sign span { flex: 1; padding-top: 6px; border-top: 1px solid #1c2530; text-align: center; font-size: .85rem; }
}
`;