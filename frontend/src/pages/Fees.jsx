import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const money = (n) => "Rs " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 });
const classLabel = (c) => c.name ?? c.title ?? "Class " + c.id;

const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
};
const isOverdue = (p) => p.status === "pending" && p.due_date < todayStr();
const statusOf = (p) => (p.status === "paid" ? "paid" : isOverdue(p) ? "overdue" : "pending");
const STATUS_TEXT = { paid: "Paid", overdue: "Overdue", pending: "Pending" };

export function FeesPanel() {
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState({ school_class: "", amount: "", due_date: "" });
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [cls, pays] = await Promise.all([api.listSchoolClasses(), api.listFees()]);
      setClasses(asList(cls));
      setPayments(asList(pays));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canGenerate =
    !generating && form.school_class && Number(form.amount) > 0 && form.due_date;

  const generate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const res = await api.generateChallans({
        school_class: Number(form.school_class),
        amount: form.amount,
        due_date: form.due_date,
      });
      const plural = res.created === 1 ? "" : "s";
      const skipped = res.skipped ? ", skipped " + res.skipped + " already billed for that date" : "";
      setNotice("Created " + res.created + " challan" + plural + skipped + ".");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = async (p, status) => {
    setBusyId(p.id);
    setError("");
    try {
      const updated = await api.updateFee(p.id, { status });
      setPayments((list) => list.map((x) => (x.id === p.id ? updated : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const totals = useMemo(() => {
    let outstanding = 0;
    let collected = 0;
    let overdue = 0;
    for (const p of payments) {
      if (p.status === "paid") collected += Number(p.amount);
      else {
        outstanding += Number(p.amount);
        if (isOverdue(p)) overdue += 1;
      }
    }
    return { outstanding, collected, overdue };
  }, [payments]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => {
      if (filter === "paid" && p.status !== "paid") return false;
      if (filter === "pending" && p.status !== "pending") return false;
      if (filter === "overdue" && !isOverdue(p)) return false;
      if (q && !(p.student_name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [payments, filter, query]);

  return (
    <>
      <style>{css}</style>
      <div className="fe">
        {error && (
          <div className="fe-msg fe-err" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="fe-msg fe-ok" role="status">
            {notice}
          </div>
        )}

        <form className="fe-gen" onSubmit={generate}>
          <label>
            Class
            <select
              value={form.school_class}
              onChange={(e) => setForm({ ...form, school_class: e.target.value })}
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount per student (Rs)
            <input
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </label>
          <button type="submit" disabled={!canGenerate}>
            {generating ? "Generating..." : "Generate challans"}
          </button>
        </form>

        <div className="fe-stats">
          <div>
            <span>Outstanding</span>
            <strong>{money(totals.outstanding)}</strong>
          </div>
          <div>
            <span>Collected</span>
            <strong>{money(totals.collected)}</strong>
          </div>
          <div>
            <span>Overdue challans</span>
            <strong>{totals.overdue}</strong>
          </div>
        </div>

        <div className="fe-filters">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
            <option value="all">All challans</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
          <input
            type="search"
            placeholder="Search by student name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading && <p className="fe-muted">Loading challans...</p>}
        {!loading && payments.length === 0 && (
          <p className="fe-muted">No challans yet. Pick a class above and generate them.</p>
        )}
        {!loading && payments.length > 0 && rows.length === 0 && (
          <p className="fe-muted">No challans match this filter.</p>
        )}

        {rows.length > 0 && (
          <div className="fe-table-wrap">
            <table className="fe-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th className="num">Amount</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th className="num">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const st = statusOf(p);
                  return (
                    <tr key={p.id}>
                      <td>{p.student_name}</td>
                      <td className="num">{money(p.amount)}</td>
                      <td>{p.due_date}</td>
                      <td>
                        <span className={"fe-badge fe-" + st}>{STATUS_TEXT[st]}</span>
                      </td>
                      <td className="num">
                        {p.status === "paid" ? (
                          <button
                            type="button"
                            className="fe-link"
                            disabled={busyId === p.id}
                            onClick={() => setStatus(p, "pending")}
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="fe-pay"
                            disabled={busyId === p.id}
                            onClick={() => setStatus(p, "paid")}
                          >
                            {busyId === p.id ? "Saving..." : "Mark paid"}
                          </button>
                        )}
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
.fe { --fe-line: #d9dfe6; --fe-muted: #5d6b7a; --fe-accent: #1f4e8c; max-width: 900px; }
.fe-muted { color: var(--fe-muted); }
.fe-msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; font-size: .95rem; }
.fe-err { background: #fdecea; color: #b3261e; }
.fe-ok { background: #e7f4ec; color: #1e6b3a; }
.fe-gen { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; margin-bottom: 24px; }
.fe-gen label { display: flex; flex-direction: column; gap: 6px; font-size: .9rem; font-weight: 600; }
.fe select, .fe input { padding: 8px 10px; font: inherit; font-weight: 400; border: 1px solid var(--fe-line); border-radius: 6px; background: #fff; }
.fe-gen select { min-width: 180px; }
.fe-gen input { width: 170px; }
.fe-gen button { padding: 10px 20px; font: inherit; font-weight: 600; color: #fff; background: var(--fe-accent); border: 0; border-radius: 6px; cursor: pointer; }
.fe-gen button:disabled { background: #a9b4c2; cursor: not-allowed; }
.fe select:focus-visible, .fe input:focus-visible, .fe button:focus-visible { outline: 2px solid var(--fe-accent); outline-offset: 2px; }
.fe-stats { display: flex; flex-wrap: wrap; gap: 32px; margin-bottom: 20px; }
.fe-stats div { display: flex; flex-direction: column; gap: 2px; }
.fe-stats span { color: var(--fe-muted); font-size: .85rem; }
.fe-stats strong { font-size: 1.25rem; }
.fe-filters { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }
.fe-filters input { min-width: 240px; }
.fe-table-wrap { overflow-x: auto; border: 1px solid var(--fe-line); border-radius: 8px; background: #fff; }
.fe-table { width: 100%; border-collapse: collapse; }
.fe-table th, .fe-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--fe-line); }
.fe-table tbody tr:last-child td { border-bottom: 0; }
.fe-table th { font-size: .85rem; color: var(--fe-muted); font-weight: 600; background: #f6f8fa; }
.fe-table .num { text-align: right; }
.fe-badge { padding: 3px 10px; border-radius: 999px; font-size: .8rem; font-weight: 600; }
.fe-paid { background: #e7f4ec; color: #1e6b3a; }
.fe-pending { background: #fff4d6; color: #7a5a00; }
.fe-overdue { background: #fdecea; color: #b3261e; }
.fe-pay { padding: 6px 14px; font: inherit; font-weight: 600; color: #fff; background: var(--fe-accent); border: 0; border-radius: 6px; cursor: pointer; }
.fe-pay:disabled, .fe-link:disabled { opacity: .6; cursor: not-allowed; }
.fe-link { padding: 6px 10px; font: inherit; color: var(--fe-accent); background: none; border: 0; cursor: pointer; text-decoration: underline; }
`;