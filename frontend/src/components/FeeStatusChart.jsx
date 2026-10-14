import { useEffect, useState } from "react";
import { api } from "../lib/api";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const money = (n) => "Rs " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });

export default function FeeStatusChart() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  let paid = 0;
  let outstanding = 0;
  for (const p of payments) {
    if (p.status === "paid") paid += Number(p.amount);
    else outstanding += Number(p.amount);
  }
  const total = paid + outstanding;
  const paidPct = total > 0 ? (paid / total) * 100 : 0;

  return (
    <div className="fsc">
      <style>{css}</style>
      <div className="fsc-top">
        <div>
          <div className="fsc-big">{total > 0 ? money(outstanding) : "—"}</div>
          <div className="fsc-cap">{total > 0 ? "Outstanding" : "No fee challans issued yet"}</div>
        </div>
      </div>

      {error && <p className="fsc-err">{error}</p>}

      {total > 0 && (
        <>
          <div className="fsc-bar">
            <div className="fsc-bar-paid" style={{ width: paidPct + "%" }} />
          </div>
          <div className="fsc-legend">
            <span className="fsc-chip fsc-c-paid">Paid {money(paid)}</span>
            <span className="fsc-chip fsc-c-due">Due {money(outstanding)}</span>
          </div>
        </>
      )}
    </div>
  );
}

const css = `
.fsc { width: 100%; }
.fsc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.fsc-big { font-size: 2rem; font-weight: 800; line-height: 1.1; color: #0f1c2e; }
.fsc-cap { margin-top: 2px; font-size: .8rem; color: #5d6b7a; }
.fsc-bar { margin-top: 16px; height: 10px; border-radius: 999px; background: #fdecea; overflow: hidden; }
.fsc-bar-paid { height: 100%; background: #1e6b3a; border-radius: 999px; }
.fsc-legend { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.fsc-chip { padding: 2px 10px; border-radius: 999px; font-size: .75rem; font-weight: 600; }
.fsc-c-paid { background: #e7f4ec; color: #1e6b3a; }
.fsc-c-due { background: #fdecea; color: #b3261e; }
.fsc-err { margin: 8px 0 0; font-size: .85rem; color: #b3261e; }
`;
