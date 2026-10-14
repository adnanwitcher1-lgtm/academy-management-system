// Change this to your real logo. If it's in src/assets, use:
//   import logo from "../assets/logo.png";  and set LOGO = logo
// If it's in the public folder, use a path like "/logo.png".
const LOGO = "/keen-logo.png";

const money = (n) => "Rs " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 });

export default function FeeReceipt({ payment, status, onClose }) {
  const paid = status === "paid";
  const receiptNo = "KA-" + String(payment.id).padStart(5, "0");

  return (
    <div className="fr-overlay" onClick={onClose}>
      <style>{css}</style>
      <div className="fr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fr-bar">
          <strong>Fee Receipt</strong>
          <div className="fr-bar-actions">
            <button type="button" className="fr-btn" onClick={() => window.print()}>
              Print
            </button>
            <button type="button" className="fr-btn fr-btn-light" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="fr-scroll">
          <div className="fr-sheet">
            <div className="fr-head">
              <img src={LOGO} alt="Keen Academy" className="fr-logo" />
              <div>
                <h2>Keen Academy</h2>
                <p>Keep Education Ever Noble</p>
              </div>
              <div className="fr-title">
                <h3>FEE RECEIPT</h3>
                <p>No. {receiptNo}</p>
              </div>
            </div>

            <table className="fr-table">
              <tbody>
                <tr>
                  <th>Student</th>
                  <td>{payment.student_name}</td>
                </tr>
                <tr>
                  <th>Class</th>
                  <td>{payment.class_label || "-"}</td>
                </tr>
                <tr>
                  <th>Due Date</th>
                  <td>{payment.due_date}</td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>
                    <span className={"fr-stamp " + (paid ? "fr-paid" : "fr-unpaid")}>
                      {paid ? "PAID" : "UNPAID"}
                    </span>
                  </td>
                </tr>
                <tr className="fr-total">
                  <th>Amount</th>
                  <td>{money(payment.amount)}</td>
                </tr>
              </tbody>
            </table>

            <div className="fr-sign">
              <div>
                <span />
                Received by
              </div>
              <div>
                <span />
                Parent / Guardian
              </div>
            </div>
            <p className="fr-foot">This is a computer-generated receipt. Printed on {new Date().toLocaleDateString("en-GB")}.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const css = `
.fr-overlay { position: fixed; inset: 0; background: rgba(15,23,32,.55); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 16px; }
.fr-modal { background: #f1f5f6; border-radius: 14px; width: 100%; max-width: 760px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; }
.fr-bar { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #fff; border-bottom: 1px solid #e3e7ed; }
.fr-bar-actions { display: flex; gap: 8px; }
.fr-btn { padding: 8px 16px; border-radius: 8px; border: 0; background: #2b3033; color: #fff; font-weight: 600; cursor: pointer; }
.fr-btn-light { background: #fff; color: #2b3033; border: 1px solid #d9dfe6; }
.fr-scroll { overflow: auto; padding: 18px; }
.fr-sheet { background: #fff; width: 100%; max-width: 640px; margin: 0 auto; padding: 32px; border: 2px solid #0fb3b8; border-radius: 6px; color: #2b3033; }
.fr-head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #17e0e4; padding-bottom: 16px; }
.fr-logo { width: 64px; height: 64px; object-fit: contain; }
.fr-head h2 { margin: 0; font-size: 24px; color: #2b3033; }
.fr-head p { margin: 2px 0 0; font-size: 12px; color: #0fb3b8; font-weight: 600; }
.fr-title { margin-left: auto; text-align: right; }
.fr-title h3 { margin: 0; font-size: 18px; letter-spacing: .05em; }
.fr-title p { margin: 2px 0 0; font-size: 13px; color: #5d6b7a; }
.fr-table { width: 100%; border-collapse: collapse; margin-top: 22px; font-size: 15px; }
.fr-table th { text-align: left; width: 35%; padding: 11px 12px; background: #f1f5f6; color: #5d6b7a; font-weight: 600; border: 1px solid #e3e7ed; }
.fr-table td { padding: 11px 12px; border: 1px solid #e3e7ed; }
.fr-total th, .fr-total td { font-size: 18px; font-weight: 700; color: #2b3033; background: #e8fafa; }
.fr-stamp { padding: 3px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.fr-paid { background: #e6f4ea; color: #1e7e34; }
.fr-unpaid { background: #fdecea; color: #b3261e; }
.fr-sign { display: flex; justify-content: space-between; margin-top: 56px; font-size: 13px; color: #5d6b7a; }
.fr-sign div { width: 40%; text-align: center; }
.fr-sign span { display: block; border-top: 1px solid #2b3033; margin-bottom: 6px; }
.fr-foot { margin: 28px 0 0; text-align: center; font-size: 11px; color: #94a0ad; }

@media print {
  @page { size: A4; margin: 14mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body * { visibility: hidden; }
  .fr-sheet, .fr-sheet * { visibility: visible; }
  .fr-sheet { position: absolute; left: 0; top: 0; width: 100%; max-width: none; border-width: 2px; }
  .fr-overlay, .fr-modal, .fr-scroll { position: static; background: none; overflow: visible; max-height: none; padding: 0; }
}
`;