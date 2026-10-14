import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/ui";
import FeeReceipt from "../components/FeeReceipt";

const money = (n) => "Rs " + Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
const compact = (n) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const todayStr = () => new Date().toLocaleDateString("en-CA");
const fmtDay = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtShort = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
const titleCase = (s) =>
  (s || "").toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
const initials = (s) =>
  (s || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

// p may be null — a student with no fee record yet is "unbilled".
function computedStatus(p) {
  if (!p) return "unbilled";
  if (p.status === "paid") return "paid";
  return p.due_date < todayStr() ? "overdue" : "pending";
}

const STATUS_LABEL = { paid: "Paid", pending: "Pending", overdue: "Overdue", unbilled: "No fee set" };
const TABS = [
  ["all", "All students"],
  ["paid", "Paid"],
  ["pending", "Pending"],
  ["overdue", "Overdue"],
  ["unbilled", "No fee set"],
];

const ICONS = {
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  calendar: "M5 5h14v15H5zM5 10h14M9 3v4M15 3v4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  plus: "M12 5v14M5 12h14",
};

function Ico({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function FeeManagement() {
  const { session } = useAuth();
  const displayName = titleCase(session?.user?.first_name || session?.user?.username || session?.username || "");

  const [payments, setPayments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [tab, setTab] = useState("all");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [months, setMonths] = useState(6);

  // collecting = { student, payment } — payment is null for a student with no fee record yet.
  const [collecting, setCollecting] = useState(null);
  const [collectForm, setCollectForm] = useState({ amount: "", due_date: todayStr() });
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ student: "", amount: "", due_date: todayStr() });
  const [addSearch, setAddSearch] = useState("");

  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({ school_class: "", amount: "", due_date: todayStr() });
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pays, cls, studs] = await Promise.all([
        api.listFees(),
        api.listSchoolClasses(),
        api.listFeeStudents(),
      ]);
      setPayments(Array.isArray(pays) ? pays : pays?.results ?? []);
      setClasses(Array.isArray(cls) ? cls : cls?.results ?? []);
      setStudents(Array.isArray(studs) ? studs : studs?.results ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const today = todayStr();
    let collected = 0, pending = 0, overdue = 0, paidN = 0, pendN = 0, overN = 0, nextDue = "";
    const pendStudents = new Set();
    const overStudents = new Set();
    for (const p of payments) {
      const amt = Number(p.amount || 0);
      const st = computedStatus(p);
      if (st === "paid") { collected += amt; paidN += 1; }
      else if (st === "overdue") { overdue += amt; overN += 1; overStudents.add(p.student); }
      else {
        pending += amt; pendN += 1; pendStudents.add(p.student);
        if (p.due_date >= today && (!nextDue || p.due_date < nextDue)) nextDue = p.due_date;
      }
    }
    const total = collected + pending + overdue;
    return {
      collected, pending, overdue, paidN, pendN, overN,
      pendStudents: pendStudents.size, overStudents: overStudents.size,
      rate: total ? Math.round((collected * 1000) / total) / 10 : 0,
      avg: payments.length ? total / payments.length : 0,
      nextDue,
    };
  }, [payments]);

  const chart = useMemo(() => {
    const now = new Date();
    const bars = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      bars.push({
        key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"),
        label: d.toLocaleDateString("en-GB", { month: "short" }),
        value: 0,
      });
    }
    const index = new Map(bars.map((b, i) => [b.key, i]));
    for (const p of payments) {
      if (p.status !== "paid") continue;
      const key = String(p.paid_on || p.due_date || "").slice(0, 7);
      if (index.has(key)) bars[index.get(key)].value += Number(p.amount || 0);
    }
    return { bars, max: Math.max(0, ...bars.map((b) => b.value)) };
  }, [payments, months]);

  // One row per registered student. If they have a FeePayment, attach the most relevant one.
  const rows = useMemo(() => {
    const byStudent = new Map();
    for (const p of payments) {
      const existing = byStudent.get(p.student);
      if (!existing || String(p.due_date) > String(existing.due_date)) byStudent.set(p.student, p);
    }
    return students.map((s) => ({ student: s, payment: byStudent.get(s.id) || null }));
  }, [students, payments]);

  const sortedRows = useMemo(() => {
    const billed = rows.filter((r) => r.payment).sort((a, b) =>
      String(b.payment.paid_on || b.payment.due_date).localeCompare(String(a.payment.paid_on || a.payment.due_date)) ||
      b.payment.id - a.payment.id
    );
    const unbilled = rows.filter((r) => !r.payment).sort((a, b) => a.student.name.localeCompare(b.student.name));
    return [...billed, ...unbilled];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedRows.filter((row) => {
      const { student, payment } = row;
      if (classFilter) {
        if (payment) {
          if (String(payment.school_class) !== classFilter) return false;
        } else {
          const cls = classes.find((c) => String(c.id) === classFilter);
          if (!cls || !student.class_label?.includes(cls.name)) return false;
        }
      }
      const st = computedStatus(payment);
      if (tab !== "all" && st !== tab) return false;
      if (q) {
        const name = (student.name || "").toLowerCase();
        const roll = String(student.roll_no || "").toLowerCase();
        if (!name.includes(q) && !roll.includes(q)) return false;
      }
      return true;
    });
  }, [sortedRows, tab, classFilter, search, classes]);

  const visible = showAll ? filtered : filtered.slice(0, 8);

  const selectedStudent = useMemo(
    () => students.find((s) => String(s.id) === String(addForm.student)) || null,
    [students, addForm.student]
  );
  const studentMatches = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    const list = q
      ? students.filter((s) => (s.name || "").toLowerCase().includes(q) || String(s.roll_no || "").toLowerCase().includes(q))
      : students;
    return list.slice(0, 50);
  }, [students, addSearch]);

  function openCollect(row) {
    setCollecting(row);
    setCollectForm(
      row.payment
        ? { amount: String(row.payment.amount), due_date: row.payment.due_date }
        : { amount: "", due_date: todayStr() }
    );
    setError("");
  }
  function closeAdd() {
    setAddOpen(false); setAddSearch("");
    setAddForm({ student: "", amount: "", due_date: todayStr() });
  }

  async function submitCollect(e) {
    e.preventDefault();
    if (!collecting) return;
    setSaving(true); setError("");
    try {
      let updated;
      if (collecting.payment) {
        updated = await api.updateFee(collecting.payment.id, { status: "paid" });
      } else {
        if (!collectForm.amount || !collectForm.due_date) {
          setError("Enter an amount and due date.");
          setSaving(false);
          return;
        }
        updated = await api.createFee({
          student: collecting.student.id,
          amount: collectForm.amount,
          due_date: collectForm.due_date,
          status: "paid",
        });
      }
      setPayments((list) => [updated, ...list.filter((p) => p.id !== updated.id)]);
      setNotice("Payment recorded for " + titleCase(collecting.student.name) + ".");
      setCollecting(null);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function submitAdd(e) {
    e.preventDefault();
    if (!addForm.student || !addForm.amount || !addForm.due_date) return;
    setSaving(true); setError("");
    try {
      const created = await api.createFee({
        student: Number(addForm.student), amount: addForm.amount, due_date: addForm.due_date,
      });
      setPayments((list) => [created, ...list]);
      setNotice("Fee payment added for " + titleCase(created.student_name) + ".");
      closeAdd();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function submitGenerate(e) {
    e.preventDefault();
    setGenerating(true); setError("");
    try {
      const body = { due_date: genForm.due_date };
      if (genForm.school_class) body.school_class = Number(genForm.school_class);
      if (genForm.amount) body.amount = genForm.amount;
      const res = await api.generateChallans(body);
      setNotice(`Generated ${res.created} challan(s) across ${res.classes} class(es).`);
      setGenOpen(false);
      setGenForm({ school_class: "", amount: "", due_date: todayStr() });
      load();
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  }

  async function deletePayment(p, name) {
    if (!window.confirm(`Delete this fee entry for ${titleCase(name)}?`)) return;
    setError("");
    try {
      await api.deleteFee(p.id);
      setPayments((list) => list.filter((x) => x.id !== p.id));
      setNotice("Entry deleted.");
    } catch (e) { setError(e.message); }
  }

  function exportCsv() {
    const rows = [["Student", "Roll no", "Class", "Amount", "Due date", "Paid on", "Status"]];
    for (const row of filtered) {
      const p = row.payment;
      rows.push([
        titleCase(row.student.name), row.student.roll_no, p?.class_label || row.student.class_label || "",
        p ? p.amount : "", p ? p.due_date : "", p?.paid_on || "", STATUS_LABEL[computedStatus(p)],
      ]);
    }
    const csv = rows.map((r) => r.map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "fee-report-" + todayStr() + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title={greeting() + (displayName ? ", " + displayName : "")}
      subtitle="Here's how your academy's fee collection is looking today."
    >
      <style>{css}</style>

      {error && <div className="fx-alert fx-err">{error}</div>}
      {notice && <div className="fx-alert fx-ok">{notice}</div>}

      <div className="fx-topbar">
        <span className="fx-eyebrow">FEE MANAGEMENT</span>
        <div className="fx-top-actions">
          <button type="button" className="fx-btn" onClick={exportCsv} disabled={filtered.length === 0}>
            <Ico name="download" size={16} /> Export report
          </button>
          <button type="button" className="fx-btn" onClick={() => setGenOpen(true)}>Generate challans</button>
          <button type="button" className="fx-btn" onClick={() => setAddOpen(true)}>
            <Ico name="plus" size={16} /> Add payment
          </button>
        </div>
      </div>

      <div className="fx-stats">
        <div className="fx-stat">
          <span className="fx-tile fx-t-cyan"><Ico name="card" /></span>
          <p>Total collected</p>
          <strong>{money(stats.collected)}</strong>
          <small className="fx-good">{stats.paidN} payment(s) received</small>
        </div>
        <div className="fx-stat">
          <span className="fx-tile fx-t-amber"><Ico name="calendar" /></span>
          <p>Pending amount</p>
          <strong>{money(stats.pending)}</strong>
          <small>{stats.pendStudents} student(s) pending</small>
        </div>
        <div className="fx-stat">
          <span className="fx-tile fx-t-red"><Ico name="receipt" /></span>
          <p>Overdue</p>
          <strong>{money(stats.overdue)}</strong>
          <small>{stats.overStudents} require attention</small>
        </div>
        <div className="fx-stat">
          <span className="fx-tile fx-t-teal"><Ico name="trend" /></span>
          <p>Collection rate</p>
          <strong>{stats.rate}%</strong>
          <small className="fx-good">{stats.paidN} of {payments.length} billed entries paid</small>
        </div>
      </div>

      <div className="fx-mid">
        <section className="fx-card fx-chart">
          <div className="fx-chart-head">
            <div>
              <h3>Collection overview</h3>
              <p>Fee collection over the last {months} months</p>
            </div>
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </div>
          <div className="fx-bars">
            {chart.bars.map((b, i) => {
              const pct = chart.max ? (b.value / chart.max) * 100 : 0;
              const now = i === chart.bars.length - 1;
              return (
                <div key={b.key} className="fx-bar-col" title={b.label + ": " + money(b.value)}>
                  <div className="fx-bar-wrap">
                    <div className={"fx-bar" + (now ? " fx-bar-now" : "")} style={{ height: Math.max(pct, 2) + "%" }}>
                      {b.value > 0 && <span className="fx-bar-val">{compact(b.value)}</span>}
                    </div>
                  </div>
                  <span className="fx-bar-lbl">{b.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="fx-dark">
          <div className="fx-dark-top">
            <h3>Collection progress</h3>
            <span>{new Date().getFullYear()}</span>
          </div>
          <div className="fx-dark-pct">{stats.rate}%</div>
          <div className="fx-track"><div style={{ width: Math.min(stats.rate, 100) + "%" }} /></div>
          <div className="fx-mini">
            <div><span>Students</span><strong>{students.length}</strong></div>
            <div><span>Avg. fee</span><strong>{money(stats.avg)}</strong></div>
          </div>
          <div className="fx-next">
            <span className="fx-next-ico"><Ico name="calendar" size={18} /></span>
            <span>Next payment due</span>
            <strong>{stats.nextDue ? fmtShort(stats.nextDue) : "-"}</strong>
          </div>
        </section>
      </div>

      <section className="fx-card fx-table-card">
        <div className="fx-table-head">
          <div><h3>All students</h3><p>Every registered student, and their fee status</p></div>
          <div className="fx-table-tools">
            <input type="search" placeholder="Search name or roll no..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.section ? " " + c.section : ""}</option>
              ))}
            </select>
            {filtered.length > 8 && (
              <button type="button" className="fx-btn" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show less" : "View all"} &rsaquo;
              </button>
            )}
          </div>
        </div>

        <div className="fx-tabs" role="tablist">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key}
              className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        <div className="fx-scroll">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Student</th><th>Student ID</th><th>Amount</th><th>Payment date</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="fx-empty">Loading...</td></tr>}
              {!loading && visible.length === 0 && <tr><td colSpan={6} className="fx-empty">No students match.</td></tr>}
              {!loading && visible.map((row) => {
                const p = row.payment;
                const st = computedStatus(p);
                return (
                  <tr key={row.student.id}>
                    <td>
                      <div className="fx-student">
                        <span className={"fx-av fx-av-" + ((Number(row.student.id) || 0) % 5)}>{initials(row.student.name)}</span>
                        <div><strong>{titleCase(row.student.name)}</strong><small>{p?.class_label || row.student.class_label || "-"}</small></div>
                      </div>
                    </td>
                    <td className="fx-id">{row.student.roll_no || "-"}</td>
                    <td className="fx-amt">{p ? money(p.amount) : "-"}</td>
                    <td className="fx-date">
                      {p ? (st === "paid" && p.paid_on ? fmtDay(p.paid_on) : "Due " + fmtShort(p.due_date)) : "Not billed"}
                    </td>
                    <td><span className={"fx-pill fx-" + st}>{STATUS_LABEL[st]}</span></td>
                    <td>
                      <div className="fx-row-actions">
                        {st === "paid" ? (
                          <button type="button" className="fx-btn-line" onClick={() => setReceipt(p)}>
                            <Ico name="receipt" size={15} /> Print receipt
                          </button>
                        ) : (
                          <button type="button" className="fx-btn-solid" onClick={() => openCollect(row)}>
                            Collect payment
                          </button>
                        )}
                        {p && <button type="button" className="fx-del" onClick={() => deletePayment(p, row.student.name)}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {collecting && (
        <div className="fx-overlay" onClick={() => !saving && setCollecting(null)}>
          <form className="fx-panel" onClick={(e) => e.stopPropagation()} onSubmit={submitCollect}>
            <div className="fx-head"><h3>Collect payment: {titleCase(collecting.student.name)}</h3><button type="button" className="fx-x" onClick={() => setCollecting(null)}>&times;</button></div>
            <div className="fx-body">
              <div className="fx-row"><span>Roll No</span><strong>{collecting.student.roll_no || "-"}</strong></div>
              <div className="fx-row"><span>Class</span><strong>{collecting.payment?.class_label || collecting.student.class_label || "-"}</strong></div>
              {collecting.payment ? (
                <>
                  <div className="fx-row"><span>Due Date</span><strong>{collecting.payment.due_date}</strong></div>
                  <div className="fx-row fx-row-total"><span>Amount Due</span><strong>{money(collecting.payment.amount)}</strong></div>
                </>
              ) : (
                <div className="fx-form" style={{ marginTop: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#5d6b7a" }}>No fee has been set for this student yet.</p>
                  <label>Amount
                    <input type="number" min="1" step="0.01" value={collectForm.amount}
                      onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })} required />
                  </label>
                  <label>Due Date
                    <input type="date" value={collectForm.due_date}
                      onChange={(e) => setCollectForm({ ...collectForm, due_date: e.target.value })} required />
                  </label>
                </div>
              )}
            </div>
            <div className="fx-foot">
              <button type="button" className="fx-btn" onClick={() => setCollecting(null)} disabled={saving}>Cancel</button>
              <button type="submit" className="fx-btn fx-btn-primary" disabled={saving}>{saving ? "Saving..." : "Mark as Paid"}</button>
            </div>
          </form>
        </div>
      )}

      {addOpen && (
        <div className="fx-overlay" onClick={() => !saving && closeAdd()}>
          <form className="fx-panel" onClick={(e) => e.stopPropagation()} onSubmit={submitAdd}>
            <div className="fx-head"><h3>Add Fee Payment</h3><button type="button" className="fx-x" onClick={closeAdd}>&times;</button></div>
            <div className="fx-body fx-form">
              <div className="fx-field">
                <span className="fx-label">Student</span>
                {selectedStudent ? (
                  <div className="fx-picked">
                    <div>
                      <strong>{titleCase(selectedStudent.name)}</strong>
                      <small>{selectedStudent.roll_no}{selectedStudent.class_label ? " · " + selectedStudent.class_label : ""}</small>
                    </div>
                    <button type="button" className="fx-link" onClick={() => { setAddForm({ ...addForm, student: "" }); setAddSearch(""); }}>Change</button>
                  </div>
                ) : (
                  <>
                    <input type="search" autoFocus placeholder="Type name or roll no..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} />
                    <div className="fx-results">
                      {studentMatches.length === 0 && <div className="fx-noresult">No student found.</div>}
                      {studentMatches.map((s) => (
                        <button type="button" key={s.id} className="fx-result" onClick={() => setAddForm({ ...addForm, student: String(s.id) })}>
                          <span>{titleCase(s.name)}</span>
                          <small>{s.roll_no}{s.class_label ? " · " + s.class_label : ""}</small>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <label>Amount<input type="number" min="1" step="0.01" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} required /></label>
              <label>Due Date<input type="date" value={addForm.due_date} onChange={(e) => setAddForm({ ...addForm, due_date: e.target.value })} required /></label>
            </div>
            <div className="fx-foot">
              <button type="button" className="fx-btn" onClick={closeAdd} disabled={saving}>Cancel</button>
              <button type="submit" className="fx-btn fx-btn-primary" disabled={saving || !addForm.student}>{saving ? "Saving..." : "Add Payment"}</button>
            </div>
          </form>
        </div>
      )}

      {genOpen && (
        <div className="fx-overlay" onClick={() => !generating && setGenOpen(false)}>
          <form className="fx-panel" onClick={(e) => e.stopPropagation()} onSubmit={submitGenerate}>
            <div className="fx-head"><h3>Generate Challans</h3><button type="button" className="fx-x" onClick={() => setGenOpen(false)}>&times;</button></div>
            <div className="fx-body fx-form">
              <label>Class (leave blank for all classes with a fee set)
                <select value={genForm.school_class} onChange={(e) => setGenForm({ ...genForm, school_class: e.target.value })}>
                  <option value="">All classes</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.section ? " " + c.section : ""}</option>)}
                </select>
              </label>
              <label>Custom amount (optional, requires a class)
                <input type="number" min="1" step="0.01" value={genForm.amount} onChange={(e) => setGenForm({ ...genForm, amount: e.target.value })} />
              </label>
              <label>Due Date<input type="date" value={genForm.due_date} onChange={(e) => setGenForm({ ...genForm, due_date: e.target.value })} required /></label>
            </div>
            <div className="fx-foot">
              <button type="button" className="fx-btn" onClick={() => setGenOpen(false)} disabled={generating}>Cancel</button>
              <button type="submit" className="fx-btn fx-btn-primary" disabled={generating}>{generating ? "Generating..." : "Generate"}</button>
            </div>
          </form>
        </div>
      )}

      {receipt && <FeeReceipt payment={receipt} status={computedStatus(receipt)} onClose={() => setReceipt(null)} />}
    </AppShell>
  );
}

const css = `
.fx-alert { padding: 10px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 14px; }
.fx-err { background: #fdecea; color: #b3261e; }
.fx-ok { background: #e6f4ea; color: #1e7e34; }
.fx-topbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.fx-eyebrow { font-size: 13px; font-weight: 700; letter-spacing: .14em; color: #0fb3b8; }
.fx-top-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.fx-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 10px; border: 1px solid #d9dfe6; background: #fff; color: #2b3033; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.fx-btn:hover { background: #f6f8fa; }
.fx-btn-primary { background: #0fb3b8; border-color: #0fb3b8; color: #fff; box-shadow: 0 6px 16px rgba(15,179,184,.28); }
.fx-btn-primary:hover { background: #0c9a9f; }
.fx-btn:disabled { opacity: .55; cursor: default; }
.fx-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 18px; }
.fx-stat { display: flex; flex-direction: column; gap: 4px; padding: 20px 22px; background: #fff; border: 1px solid #e3e7ed; border-radius: 18px; box-shadow: 0 2px 10px rgba(28,37,48,.04); }
.fx-stat p { margin: 14px 0 0; font-size: 14px; color: #5d6b7a; }
.fx-stat strong { font-size: 26px; color: #1c2530; letter-spacing: -.01em; }
.fx-stat small { font-size: 13px; color: #94a0ad; }
.fx-stat .fx-good { color: #1e7e34; font-weight: 600; }
.fx-tile { width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
.fx-t-cyan { background: #e0f7f8; color: #0a8a8f; }
.fx-t-amber { background: #fff4de; color: #b5790a; }
.fx-t-red { background: #fdecea; color: #b3261e; }
.fx-t-teal { background: #e8eef0; color: #2b3033; }
.fx-card { background: #fff; border: 1px solid #e3e7ed; border-radius: 18px; box-shadow: 0 2px 10px rgba(28,37,48,.04); }
.fx-mid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; margin-bottom: 18px; }
@media (max-width: 1000px) { .fx-mid { grid-template-columns: minmax(0, 1fr); } }
.fx-chart { padding: 22px 24px; }
.fx-chart-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.fx-chart-head h3 { margin: 0; font-size: 20px; color: #1c2530; }
.fx-chart-head p { margin: 4px 0 0; font-size: 14px; color: #5d6b7a; }
.fx-chart-head select, .fx-table-tools select, .fx-table-tools input { padding: 9px 12px; border: 1px solid #d9dfe6; border-radius: 10px; background: #fff; font: inherit; font-size: 14px; color: #2b3033; }
.fx-bars { display: flex; align-items: stretch; gap: 14px; height: 250px; padding-top: 26px; margin-top: 10px; }
.fx-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 0; }
.fx-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.fx-bar { position: relative; width: 100%; border-radius: 10px 10px 4px 4px; background: #c3eff1; transition: height .3s; }
.fx-bar-now { background: #0fb3b8; }
.fx-bar-val { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: #5d6b7a; white-space: nowrap; }
.fx-bar-lbl { font-size: 13px; color: #94a0ad; }
.fx-dark { position: relative; overflow: hidden; padding: 22px 24px; border-radius: 18px; color: #fff; background: linear-gradient(160deg, #2b3033 0%, #1d2226 100%); }
.fx-dark::after { content: ""; position: absolute; top: -80px; right: -60px; width: 190px; height: 190px; border-radius: 50%; border: 1px solid rgba(255,255,255,.1); }
.fx-dark-top { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
.fx-dark-top h3 { margin: 0; font-size: 17px; font-weight: 600; color: #fff; }
.fx-dark-top span { font-size: 13px; color: rgba(255,255,255,.6); }
.fx-dark-pct { margin: 18px 0 12px; font-size: 52px; font-weight: 700; line-height: 1; position: relative; z-index: 1; }
.fx-track { height: 8px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
.fx-track div { height: 100%; border-radius: 999px; background: #17e0e4; }
.fx-mini { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
.fx-mini div { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-radius: 14px; background: rgba(255,255,255,.06); }
.fx-mini span { font-size: 13px; color: rgba(255,255,255,.6); }
.fx-mini strong { font-size: 20px; }
.fx-next { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 14px 16px; border-radius: 14px; background: rgba(255,255,255,.06); font-size: 14px; }
.fx-next span:nth-child(2) { flex: 1; color: rgba(255,255,255,.75); }
.fx-next-ico { width: 38px; height: 38px; border-radius: 11px; background: #0fb3b8; color: #fff; display: flex; align-items: center; justify-content: center; }
.fx-table-card { overflow: hidden; }
.fx-table-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; padding: 22px 24px 14px; }
.fx-table-head h3 { margin: 0; font-size: 20px; color: #1c2530; }
.fx-table-head p { margin: 4px 0 0; font-size: 14px; color: #5d6b7a; }
.fx-table-tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.fx-table-tools input { min-width: 210px; }
.fx-tabs { display: flex; gap: 6px; padding: 0 24px; border-bottom: 1px solid #eef0f3; overflow-x: auto; }
.fx-tabs button { padding: 12px 16px; border: 0; border-bottom: 3px solid transparent; background: none; font: inherit; font-size: 15px; font-weight: 600; color: #5d6b7a; cursor: pointer; white-space: nowrap; }
.fx-tabs button.on { color: #0fb3b8; border-bottom-color: #0fb3b8; }
.fx-scroll { overflow-x: auto; }
.fx-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.fx-table th { text-align: left; padding: 14px 24px; background: #f5f8f9; color: #5d6b7a; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.fx-table td { padding: 14px 24px; border-top: 1px solid #eef0f3; vertical-align: middle; white-space: nowrap; }
.fx-empty { text-align: center; color: #94a0ad; padding: 36px 16px !important; }
.fx-student { display: flex; align-items: center; gap: 12px; }
.fx-student div { display: flex; flex-direction: column; }
.fx-student strong { font-size: 15px; color: #1c2530; }
.fx-student small { font-size: 13px; color: #94a0ad; }
.fx-av { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex: none; }
.fx-av-0 { background: #e0f7f8; color: #0a8a8f; }
.fx-av-1 { background: #efe8fc; color: #6d28d9; }
.fx-av-2 { background: #fff4d6; color: #a16207; }
.fx-av-3 { background: #fde8ee; color: #be185d; }
.fx-av-4 { background: #e6f4ea; color: #1e7e34; }
.fx-id { color: #475467; }
.fx-amt { font-weight: 700; color: #1c2530; }
.fx-date { color: #475467; }
.fx-pill { padding: 4px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; }
.fx-paid { background: #e6f4ea; color: #1e7e34; }
.fx-pending { background: #fff4de; color: #b5790a; }
.fx-overdue { background: #fdecea; color: #b3261e; }
.fx-unbilled { background: #f1f3f5; color: #6b7684; }
.fx-row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 14px; }
.fx-btn-line { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px; border: 1px solid #d9dfe6; background: #fff; font: inherit; font-size: 13px; font-weight: 600; color: #2b3033; cursor: pointer; }
.fx-btn-line:hover { border-color: #0fb3b8; color: #0a8a8f; }
.fx-btn-solid { padding: 8px 14px; border-radius: 10px; border: 0; background: #0fb3b8; color: #fff; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.fx-btn-solid:hover { background: #0c9a9f; }
.fx-del { background: none; border: 0; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: #b3261e; cursor: pointer; }
.fx-link { background: none; border: 0; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: #0a8a8f; cursor: pointer; }
.fx-unavailable { font-size: 13px; color: #c3cad2; }
.fx-overlay { position: fixed; inset: 0; background: rgba(15,23,32,.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
.fx-panel { background: #fff; border-radius: 18px; width: 100%; max-width: 440px; max-height: 92vh; overflow: auto; }
.fx-panel-wide { max-width: 560px; }
.fx-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #eef0f3; }
.fx-head h3 { margin: 0; font-size: 17px; color: #1c2530; }
.fx-x { background: none; border: 0; font-size: 24px; line-height: 1; color: #94a0ad; cursor: pointer; }
.fx-body { display: flex; flex-direction: column; gap: 12px; padding: 20px 22px; }
.fx-body > input[type="search"] { padding: 10px 12px; border: 1px solid #d9dfe6; border-radius: 10px; font: inherit; font-size: 14px; }
.fx-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #5d6b7a; }
.fx-row-total { border-top: 1px solid #eef0f3; margin-top: 6px; padding-top: 12px; font-size: 16px; color: #1c2530; }
.fx-form { gap: 14px; }
.fx-form label, .fx-field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #5d6b7a; }
.fx-label { font-size: 13px; font-weight: 600; color: #5d6b7a; }
.fx-form select, .fx-form input { padding: 10px 12px; border: 1px solid #d9dfe6; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 400; }
.fx-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid #eef0f3; background: #fafbfc; }
.fx-results { max-height: 200px; overflow-y: auto; border: 1px solid #e3e7ed; border-radius: 10px; }
.fx-results-tall { max-height: 340px; }
.fx-result { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border: 0; border-bottom: 1px solid #eef0f3; background: #fff; text-align: left; font: inherit; font-size: 14px; color: #1c2530; cursor: pointer; }
.fx-result:last-child { border-bottom: 0; }
.fx-result:hover { background: #e8fafa; }
.fx-result small, .fx-picked small, .fx-pick small { color: #5d6b7a; font-size: 12px; font-weight: 500; }
.fx-noresult { padding: 14px; text-align: center; color: #94a0ad; font-size: 13px; font-weight: 500; }
.fx-picked { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border: 1px solid #0fb3b8; background: #e8fafa; border-radius: 10px; color: #1c2530; }
.fx-picked div, .fx-pick > div { display: flex; flex-direction: column; gap: 2px; }
.fx-pick { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #eef0f3; }
.fx-pick:last-child { border-bottom: 0; }
.fx-pick > div { flex: 1; min-width: 0; }
`;