import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { AppShell } from "../components/ui";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const money = (n) => "Rs " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 });
const challanNo = (p) => "FEE-" + String(p.id).padStart(5, "0");

const todayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
};
const isOverdue = (p) => p.status === "pending" && p.due_date < todayStr();
const statusOf = (p) => (p.status === "paid" ? "paid" : isOverdue(p) ? "overdue" : "pending");
const STATUS_TEXT = { paid: "Paid", overdue: "Overdue", pending: "Pending" };

export default function MyFees() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(null);

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

  // Opens the print dialog once the sheet for the chosen challan is on the page.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);

  const totals = useMemo(() => {
    let outstanding = 0;
    let paid = 0;
    for (const p of payments) {
      if (p.status === "paid") paid += Number(p.amount);
      else outstanding += Number(p.amount);
    }
    return { outstanding, paid };
  }, [payments]);

  return (
    <AppShell title="My fees" subtitle="Your fee challans and payment history.">
      <style>{css}</style>
      <div className="mf">
        {error && (
          <div className="mf-msg" role="alert">
            {error}
          </div>
        )}
        {loading && <p className="mf-muted">Loading fees...</p>}
        {!loading && !error && payments.length === 0 && (
          <p className="mf-muted">No fee challans have been issued to you yet.</p>
        )}

        {payments.length > 0 && (
          <>
            <div className="mf-stats">
              <div>
                <span>To pay</span>
                <strong>{money(totals.outstanding)}</strong>
              </div>
              <div>
                <span>Paid so far</span>
                <strong>{money(totals.paid)}</strong>
              </div>
            </div>

            <div className="mf-table-wrap">
              <table className="mf-table">
                <thead>
                  <tr>
                    <th>Challan</th>
                    <th>Due date</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th className="num">Print</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const st = statusOf(p);
                    return (
                      <tr key={p.id}>
                        <td>{challanNo(p)}</td>
                        <td>{p.due_date}</td>
                        <td className="num">{money(p.amount)}</td>
                        <td>
                          <span className={"mf-badge mf-" + st}>{STATUS_TEXT[st]}</span>
                        </td>
                        <td className="num">
                          <button type="button" onClick={() => setPrinting(p)}>
                            {p.status === "paid" ? "Print receipt" : "Print challan"}
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

        {printing && (
          <article className="mf-sheet">
            <header>
              <h1>KEEN Evening Coaching</h1>
              <p>{printing.status === "paid" ? "Payment receipt" : "Fee challan"}</p>
            </header>
            <dl>
              <div>
                <dt>Challan no.</dt>
                <dd>{challanNo(printing)}</dd>
              </div>
              <div>
                <dt>Student</dt>
                <dd>{printing.student_name}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{money(printing.amount)}</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{printing.due_date}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{printing.status === "paid" ? "Paid" : "Unpaid"}</dd>
              </div>
            </dl>
            <div className="mf-sign">
              <span>Parent signature</span>
              <span>Accounts office stamp</span>
            </div>
          </article>
        )}
      </div>
    </AppShell>
  );
}

const css = `
.mf { --mf-line: #d9dfe6; --mf-muted: #5d6b7a; --mf-accent: #1f4e8c; max-width: 820px; }
.mf-muted { color: var(--mf-muted); }
.mf-msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; background: #fdecea; color: #b3261e; }
.mf-stats { display: flex; flex-wrap: wrap; gap: 32px; margin-bottom: 20px; }
.mf-stats div { display: flex; flex-direction: column; gap: 2px; }
.mf-stats span { color: var(--mf-muted); font-size: .85rem; }
.mf-stats strong { font-size: 1.25rem; }
.mf-table-wrap { overflow-x: auto; border: 1px solid var(--mf-line); border-radius: 8px; background: #fff; }
.mf-table { width: 100%; border-collapse: collapse; }
.mf-table th, .mf-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--mf-line); }
.mf-table tbody tr:last-child td { border-bottom: 0; }
.mf-table th { font-size: .85rem; color: var(--mf-muted); font-weight: 600; background: #f6f8fa; }
.mf-table .num { text-align: right; }
.mf-badge { padding: 3px 10px; border-radius: 999px; font-size: .8rem; font-weight: 600; }
.mf-paid { background: #e7f4ec; color: #1e6b3a; }
.mf-pending { background: #fff4d6; color: #7a5a00; }
.mf-overdue { background: #fdecea; color: #b3261e; }
.mf-table td button { padding: 6px 14px; font: inherit; color: var(--mf-accent); background: #fff; border: 1px solid var(--mf-accent); border-radius: 6px; cursor: pointer; }
.mf-table td button:focus-visible { outline: 2px solid var(--mf-accent); outline-offset: 2px; }
.mf-sheet { display: none; }
@media print {
  @page { size: A4; margin: 15mm; }
  body * { visibility: hidden; }
  .mf-sheet, .mf-sheet * { visibility: visible; }
  .mf-sheet { display: block; position: absolute; left: 0; top: 0; width: 100%; color: #1c2530; }
  .mf-sheet header { text-align: center; border-bottom: 2px solid #1c2530; padding-bottom: 12px; margin-bottom: 24px; }
  .mf-sheet h1 { margin: 0; font-size: 1.5rem; }
  .mf-sheet header p { margin: 4px 0 0; }
  .mf-sheet dl { margin: 0; }
  .mf-sheet dl div { display: flex; gap: 16px; padding: 10px 0; border-bottom: 1px solid #cfd6de; }
  .mf-sheet dt { width: 160px; color: #5d6b7a; }
  .mf-sheet dd { margin: 0; font-weight: 600; }
  .mf-sign { display: flex; justify-content: space-between; margin-top: 90px; }
  .mf-sign span { width: 40%; padding-top: 6px; border-top: 1px solid #1c2530; text-align: center; font-size: .85rem; }
}
`;