import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const money = (n) => "Rs " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 });

export function FeeDuesPanel() {
  const [dues, setDues] = useState([]);
  const [classes, setClasses] = useState([]);
  const [cls, setCls] = useState("all");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api.listDues(), api.listFeeStructureOverview()]);
      setDues(asList(d));
      setClasses(asList(c));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const withFee = classes.filter((c) => c.amount !== null && c.amount !== undefined);
  const target = cls === "all" ? withFee : withFee.filter((c) => String(c.school_class) === cls);
  const studentCount = target.reduce((n, c) => n + c.students, 0);
  const canGenerate = !generating && dueDate && withFee.length > 0;

  async function generate(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (studentCount === 0) {
      setError("There are no registered students in the selected class yet, so there is nothing to bill.");
      return;
    }
    const msg =
      "Create a fee challan for " + studentCount + " registered student" + (studentCount === 1 ? "" : "s") +
      ", due " + dueDate + "?";
    if (!window.confirm(msg)) return;
    setGenerating(true);
    try {
      const body = { due_date: dueDate };
      if (cls !== "all") body.school_class = Number(cls);
      const res = await api.generateChallans(body);
      const skipped = res.skipped ? ", skipped " + res.skipped + " already billed for that date" : "";
      setNotice(
        "Created " + res.created + " challan" + (res.created === 1 ? "" : "s") + " across " + res.classes +
          " class" + (res.classes === 1 ? "" : "es") + skipped + "."
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  const totals = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    let late = 0;
    for (const d of dues) {
      outstanding += Number(d.outstanding);
      overdue += Number(d.overdue_amount);
      if (d.overdue_count > 0) late += 1;
    }
    return { outstanding, overdue, late };
  }, [dues]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dues.filter((d) => {
      if (filter === "overdue" && d.overdue_count === 0) return false;
      if (!q) return true;
      return (
        (d.student_name || "").toLowerCase().includes(q) || (d.class_label || "").toLowerCase().includes(q)
      );
    });
  }, [dues, filter, query]);

  return (
    <>
      <style>{css}</style>
      <div className="fd">
        {error && (
          <div className="fd-msg fd-err" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="fd-msg fd-ok" role="status">
            {notice}
          </div>
        )}

        <form className="fd-gen" onSubmit={generate}>
          <label>
            Class
            <select value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="all">All classes with a fee set ({withFee.length})</option>
              {classes.map((c) => {
                const hasFee = c.amount !== null && c.amount !== undefined;
                return (
                  <option key={c.school_class} value={c.school_class} disabled={!hasFee}>
                    {c.label + (hasFee ? " (" + money(c.amount) + ")" : " (no fee set)")}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <button type="submit" disabled={!canGenerate}>
            {generating ? "Generating..." : "Generate challans"}
          </button>
        </form>
        {!loading && withFee.length === 0 && (
          <p className="fd-muted">
            No class fees are set yet. <a href="/fees?tab=structure">Set them on the Fee structure page</a> to generate
            challans from here.
          </p>
        )}

        <div className="fd-stats">
          <div>
            <span>Total outstanding</span>
            <strong>{money(totals.outstanding)}</strong>
          </div>
          <div>
            <span>Overdue</span>
            <strong className={totals.overdue > 0 ? "fd-late" : ""}>{money(totals.overdue)}</strong>
          </div>
          <div>
            <span>Students with dues</span>
            <strong>{dues.length}</strong>
          </div>
          <div>
            <span>Students overdue</span>
            <strong>{totals.late}</strong>
          </div>
        </div>

        <div className="fd-filters">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter dues">
            <option value="all">All dues</option>
            <option value="overdue">Overdue only</option>
          </select>
          <input
            type="search"
            placeholder="Search by student or class"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <a href="/fees?tab=payments">Record payments</a>
        </div>

        {loading && <p className="fd-muted">Loading dues...</p>}
        {!loading && dues.length === 0 && <p className="fd-muted">No outstanding dues. Every challan is paid.</p>}
        {!loading && dues.length > 0 && rows.length === 0 && <p className="fd-muted">No dues match this filter.</p>}

        {rows.length > 0 && (
          <div className="fd-wrap">
            <table className="fd-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th className="num">Challans</th>
                  <th className="num">Outstanding</th>
                  <th className="num">Overdue</th>
                  <th>Oldest due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const late = d.overdue_count > 0;
                  return (
                    <tr key={d.student}>
                      <td>{d.student_name}</td>
                      <td>{d.class_label || "-"}</td>
                      <td className="num">{d.pending_count}</td>
                      <td className="num">{money(d.outstanding)}</td>
                      <td className="num">{late ? money(d.overdue_amount) : "-"}</td>
                      <td>{d.oldest_due}</td>
                      <td>
                        <span className={"fd-badge " + (late ? "fd-b-late" : "fd-b-soon")}>
                          {late ? "Overdue" : "Upcoming"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

const css = `
.fd { --fd-line: #d9dfe6; --fd-muted: #5d6b7a; --fd-accent: #1f4e8c; max-width: 960px; }
.fd-muted { color: var(--fd-muted); }
.fd-msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; font-size: .95rem; }
.fd-err { background: #fdecea; color: #b3261e; }
.fd-ok { background: #e7f4ec; color: #1e6b3a; }
.fd-gen { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; margin-bottom: 16px; }
.fd-gen label { display: flex; flex-direction: column; gap: 6px; font-size: .9rem; font-weight: 600; }
.fd select, .fd input { padding: 8px 10px; font: inherit; font-weight: 400; border: 1px solid var(--fd-line); border-radius: 6px; background: #fff; }
.fd-gen select { min-width: 240px; }
.fd-gen button { padding: 10px 20px; font: inherit; font-weight: 600; color: #fff; background: var(--fd-accent); border: 0; border-radius: 6px; cursor: pointer; }
.fd-gen button:disabled { background: #a9b4c2; cursor: not-allowed; }
.fd select:focus-visible, .fd input:focus-visible, .fd button:focus-visible { outline: 2px solid var(--fd-accent); outline-offset: 2px; }
.fd-stats { display: flex; flex-wrap: wrap; gap: 32px; margin: 24px 0 20px; }
.fd-stats div { display: flex; flex-direction: column; gap: 2px; }
.fd-stats span { color: var(--fd-muted); font-size: .85rem; }
.fd-stats strong { font-size: 1.25rem; }
.fd-late { color: #b3261e; }
.fd-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 14px; }
.fd-filters input { min-width: 240px; }
.fd-filters a { margin-left: auto; font-weight: 600; }
.fd-wrap { overflow-x: auto; border: 1px solid var(--fd-line); border-radius: 8px; background: #fff; }
.fd-table { width: 100%; border-collapse: collapse; }
.fd-table th, .fd-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--fd-line); }
.fd-table tbody tr:last-child td { border-bottom: 0; }
.fd-table th { font-size: .85rem; color: var(--fd-muted); font-weight: 600; background: #f6f8fa; }
.fd-table .num { text-align: right; white-space: nowrap; }
.fd-badge { padding: 3px 10px; border-radius: 999px; font-size: .8rem; font-weight: 600; }
.fd-b-late { background: #fdecea; color: #b3261e; }
.fd-b-soon { background: #fff4d6; color: #7a5a00; }
`;