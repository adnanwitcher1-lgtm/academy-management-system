import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const money = (n) => "Rs " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 });
const original = (row) =>
  row.amount === null || row.amount === undefined ? "" : String(Number(row.amount));

export function FeeStructurePanel() {
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(asList(await api.listFeeStructureOverview()));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const valueOf = (row) => edits[row.school_class] ?? original(row);
  const changed = (row) => valueOf(row) !== original(row);
  const valid = (row) => Number(valueOf(row)) > 0;

  const totals = useMemo(() => {
    let set = 0;
    let monthly = 0;
    for (const r of rows) {
      if (r.amount !== null && r.amount !== undefined) {
        set += 1;
        monthly += Number(r.amount) * r.students;
      }
    }
    return { set, monthly };
  }, [rows]);

  async function save(row) {
    setBusyId(row.school_class);
    setError("");
    setNotice("");
    try {
      const amount = valueOf(row);
      if (row.structure_id) {
        await api.updateFeeStructure(row.structure_id, { amount });
      } else {
        await api.createFeeStructure({ school_class: row.school_class, amount });
      }
      setEdits((prev) => {
        const next = { ...prev };
        delete next[row.school_class];
        return next;
      });
      await load();
      setNotice("Saved the fee for " + row.label + ".");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row) {
    if (!window.confirm("Remove the fee for " + row.label + "? Challans already issued are not changed.")) return;
    setBusyId(row.school_class);
    setError("");
    setNotice("");
    try {
      await api.deleteFeeStructure(row.structure_id);
      await load();
      setNotice("Removed the fee for " + row.label + ".");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className="fst">
        {error && (
          <div className="fst-msg fst-err" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="fst-msg fst-ok" role="status">
            {notice}
          </div>
        )}

        <div className="fst-stats">
          <div>
            <span>Classes with a fee</span>
            <strong>
              {totals.set} of {rows.length}
            </strong>
          </div>
          <div>
            <span>Billed each month (registered students)</span>
            <strong>{money(totals.monthly)}</strong>
          </div>
        </div>

        {loading && <p className="fst-muted">Loading classes...</p>}
        {!loading && rows.length === 0 && (
          <p className="fst-muted">No classes exist yet. Add them on the Classes page first.</p>
        )}

        {rows.length > 0 && (
          <div className="fst-wrap">
            <table className="fst-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th className="num">Registered students</th>
                  <th className="num">Monthly fee</th>
                  <th className="num">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const busy = busyId === r.school_class;
                  return (
                    <tr key={r.school_class}>
                      <td>{r.label}</td>
                      <td className="num">{r.students}</td>
                      <td className="num">
                        <span className="fst-rs">Rs</span>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          placeholder="Not set"
                          value={valueOf(r)}
                          onChange={(e) => setEdits({ ...edits, [r.school_class]: e.target.value })}
                          aria-label={"Monthly fee for " + r.label}
                          className={changed(r) && !valid(r) ? "bad" : ""}
                        />
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="fst-save"
                          disabled={busy || !changed(r) || !valid(r)}
                          onClick={() => save(r)}
                        >
                          {busy ? "Saving..." : "Save"}
                        </button>
                        {r.structure_id && (
                          <button type="button" className="fst-link" disabled={busy} onClick={() => remove(r)}>
                            Remove
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

        <p className="fst-next">
          <a href="/fees?tab=dues">See dues and generate challans</a>
        </p>
      </div>
    </>
  );
}

const css = `
.fst { --fst-line: #d9dfe6; --fst-muted: #5d6b7a; --fst-accent: #1f4e8c; max-width: 820px; }
.fst-muted { color: var(--fst-muted); }
.fst-msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; font-size: .95rem; }
.fst-err { background: #fdecea; color: #b3261e; }
.fst-ok { background: #e7f4ec; color: #1e6b3a; }
.fst-stats { display: flex; flex-wrap: wrap; gap: 32px; margin-bottom: 20px; }
.fst-stats div { display: flex; flex-direction: column; gap: 2px; }
.fst-stats span { color: var(--fst-muted); font-size: .85rem; }
.fst-stats strong { font-size: 1.25rem; }
.fst-wrap { overflow-x: auto; border: 1px solid var(--fst-line); border-radius: 8px; background: #fff; }
.fst-table { width: 100%; border-collapse: collapse; }
.fst-table th, .fst-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--fst-line); }
.fst-table tbody tr:last-child td { border-bottom: 0; }
.fst-table th { font-size: .85rem; color: var(--fst-muted); font-weight: 600; background: #f6f8fa; }
.fst-table .num { text-align: right; white-space: nowrap; }
.fst-rs { color: var(--fst-muted); margin-right: 6px; }
.fst-table td input { width: 130px; padding: 6px 8px; text-align: right; font: inherit; border: 1px solid var(--fst-line); border-radius: 6px; }
.fst-table td input.bad { border-color: #b3261e; background: #fdecea; }
.fst-table td input:focus-visible, .fst-table button:focus-visible { outline: 2px solid var(--fst-accent); outline-offset: 2px; }
.fst-save { padding: 6px 16px; font: inherit; font-weight: 600; color: #fff; background: var(--fst-accent); border: 0; border-radius: 6px; cursor: pointer; }
.fst-save:disabled { background: #a9b4c2; cursor: not-allowed; }
.fst-link { margin-left: 10px; padding: 6px 8px; font: inherit; color: #b3261e; background: none; border: 0; cursor: pointer; text-decoration: underline; }
.fst-link:disabled { opacity: .6; cursor: not-allowed; }
.fst-next { margin-top: 20px; }
.fst-next a { font-weight: 600; }
`;