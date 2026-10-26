import { useEffect, useMemo, useState } from "react";
import { api, downloadPdf, pdfPaths } from "../lib/api";
import { AppShell } from "../components/ui";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const money = (n) => "Rs " + Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
const todayStr = () => new Date().toLocaleDateString("en-CA");
const fmtDay = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-";
const statusOf = (p) =>
  p.status === "paid" ? "paid" : p.status === "carried" ? "carried" : p.due_date < todayStr() ? "overdue" : "pending";
const STATUS_TEXT = { paid: "Paid", overdue: "Overdue", pending: "Pending", carried: "Carried to next challan" };

export default function MyFees() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .listFees()
      .then((data) => alive && setPayments(asList(data)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const sorted = useMemo(
    () => [...payments].sort((a, b) => String(b.month || b.due_date).localeCompare(String(a.month || a.due_date)) || b.id - a.id),
    [payments]
  );
  // The current challan: newest one that still has to be paid, else the newest overall.
  const current = sorted.find((p) => p.status === "pending") || sorted.find((p) => p.status !== "carried") || null;
  const studentName = sorted[0]?.student_name || "";
  const classLabel = sorted[0]?.class_label || "";

  const totals = useMemo(() => {
    let outstanding = 0;
    let paid = 0;
    for (const p of payments) {
      if (p.status === "paid") paid += Number(p.total || 0);
      else if (p.status === "pending") outstanding += Number(p.total || 0);
    }
    return { outstanding, paid };
  }, [payments]);

  async function pdf(p) {
    setBusy(p.id);
    setError("");
    try {
      await downloadPdf(pdfPaths.feeSlip(p.id), (p.challan_no || "fee-slip") + ".pdf");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const cur = current ? statusOf(current) : null;

  return (
    <AppShell title="My fees" subtitle="Your fee challans and payment history.">
      <style>{css}</style>
      <div className="mf">
        {studentName && (
          <p className="mf-who">
            <strong>{studentName}</strong>
            {classLabel && <span> · {classLabel}</span>}
          </p>
        )}
        {error && (
          <div className="mf-msg" role="alert">
            {error}
          </div>
        )}
        {loading && <p className="mf-muted">Loading fees...</p>}
        {!loading && !error && payments.length === 0 && (
          <p className="mf-muted">No fee challans have been issued to you yet.</p>
        )}

        {current && (
          <section className="mf-card">
            <div className="mf-card-head">
              <div>
                <span className="mf-eyebrow">CURRENT CHALLAN</span>
                <h2>{current.month_label || current.challan_no}</h2>
                <small>{current.challan_no} · Due {fmtDay(current.due_date)}</small>
              </div>
              <span className={"mf-badge mf-" + cur}>{STATUS_TEXT[cur]}</span>
            </div>
            <dl className="mf-lines">
              <div><dt>Monthly fee</dt><dd>{money(current.amount)}</dd></div>
              <div><dt>Previous arrears</dt><dd>{money(current.arrears)}</dd></div>
              <div>
                <dt>Fine</dt>
                <dd>{Number(current.fine) > 0 ? <span className="mf-badge mf-overdue">Fine Rs {Number(current.fine).toLocaleString("en-PK")}{current.fine_note ? " - " + current.fine_note : ""}</span> : money(0)}</dd>
              </div>
              <div><dt>Due date</dt><dd>{fmtDay(current.due_date)}</dd></div>
              <div className="mf-total"><dt>Total payable</dt><dd>{money(current.total)}</dd></div>
            </dl>
            {current.status === "paid" && (
              <p className="mf-paidnote">Paid on {fmtDay(current.paid_on)}{current.received_by_name ? ", received by " + current.received_by_name : ""}.</p>
            )}
            <div className="mf-card-foot">
              <button type="button" className="mf-btn" disabled={busy === current.id} onClick={() => pdf(current)}>
                {busy === current.id ? "Preparing..." : "Download PDF"}
              </button>
              {totals.outstanding > 0 && <span className="mf-muted">Total still to pay: <strong>{money(totals.outstanding)}</strong></span>}
            </div>
          </section>
        )}

        {payments.length > 0 && (
          <>
            <h3 className="mf-h">Fee history</h3>
            <div className="mf-table-wrap">
              <table className="mf-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Amount</th>
                    <th className="num">Arrears</th>
                    <th className="num">Fine</th>
                    <th className="num">Total</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Paid on</th>
                    <th>Received by</th>
                    <th className="num">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => {
                    const st = statusOf(p);
                    return (
                      <tr key={p.id} className={st === "carried" ? "mf-dim" : ""}>
                        <td>{p.month_label || p.challan_no}</td>
                        <td className="num">{money(p.amount)}</td>
                        <td className="num">{money(p.arrears)}</td>
                        <td className="num" title={p.fine_note || ""}>{Number(p.fine) > 0 ? money(p.fine) + (p.fine_note ? " (" + p.fine_note + ")" : "") : "-"}</td>
                        <td className="num">{money(p.total)}</td>
                        <td>{fmtDay(p.due_date)}</td>
                        <td><span className={"mf-badge mf-" + st}>{STATUS_TEXT[st]}</span></td>
                        <td>{p.status === "paid" ? fmtDay(p.paid_on) : "-"}</td>
                        <td>{p.status === "paid" ? p.received_by_name || "-" : "-"}</td>
                        <td className="num">
                          <button type="button" disabled={busy === p.id} onClick={() => pdf(p)}>
                            {p.status === "paid" ? "Receipt" : "Challan"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

const css = `
.mf-lines .mf-badge { white-space: normal; text-align: right; }
.mf { --mf-line: #d9dfe6; --mf-muted: #5d6b7a; --mf-accent: #0a8a8f; max-width: 900px; }
.mf-who { margin: 0 0 16px; font-size: 1.05rem; color: #1c2530; }
.mf-who span { color: var(--mf-muted); }
.mf-muted { color: var(--mf-muted); }
.mf-msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; background: #fdecea; color: #b3261e; }
.mf-card { background: #fff; border: 1px solid var(--mf-line); border-radius: 14px; padding: 20px 22px; margin-bottom: 24px; box-shadow: 0 2px 10px rgba(28,37,48,.04); }
.mf-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.mf-eyebrow { font-size: .75rem; font-weight: 700; letter-spacing: .14em; color: #0fb3b8; }
.mf-card h2 { margin: 4px 0 2px; font-size: 1.4rem; color: #1c2530; }
.mf-card small { color: var(--mf-muted); }
.mf-lines { margin: 16px 0 0; }
.mf-lines > div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef0f3; }
.mf-lines dt { color: var(--mf-muted); }
.mf-lines dt small { display: block; font-size: .8rem; }
.mf-lines dd { margin: 0; font-weight: 600; }
.mf-lines .mf-total { border-bottom: 0; font-size: 1.2rem; }
.mf-lines .mf-total dt { color: #1c2530; font-weight: 700; }
.mf-paidnote { margin: 6px 0 0; color: #1e6b3a; font-size: .9rem; }
.mf-card-foot { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 14px; }
.mf-btn { padding: 9px 18px; font: inherit; font-weight: 600; color: #fff; background: #0fb3b8; border: 0; border-radius: 10px; cursor: pointer; }
.mf-btn:disabled { opacity: .6; cursor: default; }
.mf-h { margin: 0 0 10px; font-size: 1.1rem; color: #1c2530; }
.mf-table-wrap { overflow-x: auto; border: 1px solid var(--mf-line); border-radius: 10px; background: #fff; }
.mf-table { width: 100%; border-collapse: collapse; white-space: nowrap; }
.mf-table th, .mf-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--mf-line); }
.mf-table tbody tr:last-child td { border-bottom: 0; }
.mf-table th { font-size: .85rem; color: var(--mf-muted); font-weight: 600; background: #f6f8fa; }
.mf-table .num { text-align: right; }
.mf-dim td { opacity: .6; }
.mf-badge { padding: 3px 10px; border-radius: 999px; font-size: .8rem; font-weight: 600; }
.mf-paid { background: #e7f4ec; color: #1e6b3a; }
.mf-pending { background: #fff4d6; color: #7a5a00; }
.mf-overdue { background: #fdecea; color: #b3261e; }
.mf-carried { background: #eef0f3; color: #6b7684; }
.mf-table td button { padding: 6px 14px; font: inherit; color: var(--mf-accent); background: #fff; border: 1px solid var(--mf-accent); border-radius: 8px; cursor: pointer; }
.mf-table td button:disabled { opacity: .6; }
.mf-table td button:focus-visible, .mf-btn:focus-visible { outline: 2px solid var(--mf-accent); outline-offset: 2px; }
`;
