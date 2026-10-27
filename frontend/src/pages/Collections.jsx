import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { AppShell } from "../components/ui";

const money = (n) => "Rs " + Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
const todayStr = () => new Date().toLocaleDateString("en-CA");
const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const CATEGORIES = [
  ["sheets", "Sheets"],
  ["notes", "Notes"],
  ["books", "Books"],
  ["stationery", "Stationery"],
  ["registration", "Registration / admission"],
  ["test", "Test / exam fee"],
  ["other", "Other"],
];
const emptyForm = () => ({
  date: todayStr(), category: "notes", item: "", quantity: 1, amount: "",
  student: "", payer_name: "", received_by_name: "", note: "",
});

export default function Collections() {
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [month, setMonth] = useState("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, sum] = await Promise.all([api.listCollections(), api.collectionsSummary()]);
      setItems(asList(list));
      setSummary(sum);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.listFeeStudents().then((d) => setStudents(asList(d))).catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((x) => {
      if (category && x.category !== category) return false;
      if (month && !x.date.startsWith(month)) return false;
      if (q && !(x.item + " " + x.paid_by + " " + x.received_by_name + " " + (x.note || "")).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, category, month]);

  const total = filtered.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const hasFilters = search || category || month;

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
    setOpen(true);
  }

  function openEdit(x) {
    setEditingId(x.id);
    setForm({
      date: x.date, category: x.category, item: x.item, quantity: x.quantity, amount: x.amount,
      student: x.student || "", payer_name: x.payer_name || "", received_by_name: x.received_by_name || "", note: x.note || "",
    });
    setFormError("");
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const payload = {
      date: form.date, category: form.category, item: form.item.trim(), quantity: Number(form.quantity) || 1,
      amount: form.amount, student: form.student || null, payer_name: form.student ? "" : form.payer_name.trim(),
      received_by_name: form.received_by_name.trim(), note: form.note.trim(),
    };
    try {
      if (editingId) await api.updateCollection(editingId, payload);
      else await api.createCollection(payload);
      setOpen(false);
      setNotice(editingId ? "Collection updated." : "Collection added. It is counted in your income.");
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(x) {
    if (!window.confirm(`Delete "${x.item}" (${money(x.amount)})? It will be removed from income too.`)) return;
    setError("");
    try {
      await api.deleteCollection(x.id);
      setNotice("Collection deleted.");
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell title="Collections" subtitle="Money received other than monthly fees: sheets, notes, books and more. It is added to your income.">
      <style>{css}</style>

      {error && <div className="oc-alert oc-err">{error}</div>}
      {notice && <div className="oc-alert oc-ok">{notice}</div>}

      <div className="oc-cards">
        <div className="oc-card">
          <span>This month</span>
          <strong>{money(summary?.month_total)}</strong>
          <small>{summary?.month_count || 0} entr{summary?.month_count === 1 ? "y" : "ies"}</small>
        </div>
        <div className="oc-card">
          <span>All time</span>
          <strong>{money(summary?.all_time_total)}</strong>
        </div>
        <div className="oc-card">
          <span>{hasFilters ? "Filtered total" : "Shown total"}</span>
          <strong>{money(total)}</strong>
          <small>{filtered.length} entr{filtered.length === 1 ? "y" : "ies"}</small>
        </div>
      </div>

      {summary?.by_category?.length > 0 && (
        <div className="oc-chips">
          {summary.by_category.map((c) => (
            <button key={c.category} type="button" className={"oc-chip" + (category === c.category ? " on" : "")}
              onClick={() => setCategory(category === c.category ? "" : c.category)}>
              {c.label}: <b>{money(c.amount)}</b>
            </button>
          ))}
          <span className="oc-chipnote">this month</span>
        </div>
      )}

      <div className="oc-toolbar">
        <input type="search" placeholder="Search item, who paid, notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All types</option>
          {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label>Month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        {hasFilters && (
          <button type="button" className="oc-btn" onClick={() => { setSearch(""); setCategory(""); setMonth(""); }}>Clear</button>
        )}
        <button type="button" className="oc-btn oc-btn-primary oc-push" onClick={openAdd}>+ New collection</button>
      </div>

      <div className="oc-wrap">
        <table className="oc-table">
          <thead>
            <tr>
              <th>Date</th><th>Item</th><th>Type</th><th>Qty</th><th>Paid by</th><th>Amount</th><th>Received by</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="oc-empty">Loading...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="oc-empty">{items.length === 0 ? "No collections yet. Add one with the button above." : "No collections match."}</td></tr>
            )}
            {!loading && filtered.map((x) => (
              <tr key={x.id}>
                <td>{x.date}</td>
                <td className="oc-strong">{x.item}{x.note ? <small className="oc-sub">{x.note}</small> : null}</td>
                <td><span className="oc-tag">{x.category_label}</span></td>
                <td>{x.quantity}</td>
                <td>{x.paid_by || "-"}</td>
                <td className="oc-strong">{money(x.amount)}</td>
                <td>{x.received_by_name || "-"}</td>
                <td>
                  <div className="oc-actions">
                    <button type="button" className="oc-link" onClick={() => openEdit(x)}>Edit</button>
                    <button type="button" className="oc-link oc-danger" onClick={() => remove(x)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="oc-overlay" onClick={() => !saving && setOpen(false)}>
          <form className="oc-panel" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="oc-head">
              <h3>{editingId ? "Edit collection" : "New collection"}</h3>
              <button type="button" className="oc-x" onClick={() => setOpen(false)}>&times;</button>
            </div>
            <div className="oc-body">
              <div className="oc-row2">
                <label>Type *
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
                <label>Date *
                  <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </label>
              </div>
              <label>What was it for? *
                <input type="text" required maxLength={150} placeholder="e.g. Chemistry notes, Physics sheets"
                  value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
              </label>
              <div className="oc-row2">
                <label>Quantity
                  <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </label>
                <label>Total amount (Rs) *
                  <input type="number" required min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </label>
              </div>
              <label>Student (optional)
                <select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })}>
                  <option value="">Not a registered student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.roll_no}{s.class_label ? ", " + s.class_label : ""})</option>
                  ))}
                </select>
              </label>
              {!form.student && (
                <label>Paid by (name)
                  <input type="text" maxLength={150} placeholder="Who paid, if not a registered student"
                    value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} />
                </label>
              )}
              <label>Received by
                <input type="text" maxLength={150} placeholder="Leave empty to use your name"
                  value={form.received_by_name} onChange={(e) => setForm({ ...form, received_by_name: e.target.value })} />
              </label>
              <label>Notes
                <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
              {formError && <div className="oc-alert oc-err" style={{ marginBottom: 0 }}>{formError}</div>}
            </div>
            <div className="oc-foot">
              <button type="button" className="oc-btn" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="oc-btn oc-btn-primary" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Add collection"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

const css = `
.oc-alert { padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.oc-err { background: #fdecea; color: #b3261e; }
.oc-ok { background: #e6f4ea; color: #1e7e34; }

.oc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 18px; }
.oc-card { display: flex; flex-direction: column; gap: 4px; padding: 16px 18px; background: #fff; border: 1px solid #e3e7ed; border-radius: 12px; border-left: 4px solid #0fb3b8; }
.oc-card span { font-size: 13px; color: #5d6b7a; font-weight: 600; }
.oc-card strong { font-size: 24px; color: #1c2530; }
.oc-card small { color: #94a0ad; font-size: 12px; }

.oc-toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 18px; }
.oc-toolbar input, .oc-toolbar select { padding: 8px 12px; border: 1px solid #d9dfe6; border-radius: 8px; font-size: 14px; background: #fff; }
.oc-toolbar input[type="search"] { flex: 1; min-width: 220px; }
.oc-toolbar label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #5d6b7a; }
.oc-push { margin-left: auto; }

.oc-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #d9dfe6; background: #fff; color: #1c2530; font-size: 14px; font-weight: 600; cursor: pointer; }
.oc-btn-primary { background: #0fb3b8; border-color: #0fb3b8; color: #fff; }
.oc-btn-primary:hover { background: #0c9a9f; }
.oc-btn:disabled { opacity: .6; cursor: default; }

.oc-wrap { background: #fff; border: 1px solid #e3e7ed; border-radius: 12px; overflow-x: auto; }
.oc-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.oc-table th { text-align: left; padding: 12px 16px; background: #f7f8fa; color: #5d6b7a; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
.oc-table td { padding: 12px 16px; border-top: 1px solid #eef0f3; vertical-align: middle; }
.oc-strong { font-weight: 600; color: #1c2530; }
.oc-notes { color: #5d6b7a; max-width: 260px; }
.oc-empty { text-align: center; color: #94a0ad; padding: 32px 16px; }
.oc-tag { padding: 3px 12px; border-radius: 999px; background: #e8fafa; color: #0a7f84; font-size: 12px; font-weight: 600; }
.oc-actions { display: flex; gap: 14px; }
.oc-link { background: none; border: 0; padding: 0; font-size: 13px; font-weight: 600; color: #1f4e8c; cursor: pointer; }
.oc-danger { color: #b3261e; }

.oc-overlay { position: fixed; inset: 0; background: rgba(15,23,32,.45); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
.oc-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
.oc-chip { border: 1px solid #d9dfe6; background: #fff; border-radius: 999px; padding: 5px 14px; font-size: 13px; cursor: pointer; color: #1c2530; }
.oc-chip.on { background: #e8fafa; border-color: #0fb3b8; }
.oc-chip b { margin-left: 4px; }
.oc-chipnote { font-size: 12px; color: #94a0ad; }
.oc-sub { display: block; font-weight: 400; font-size: 12px; color: #94a0ad; }
.oc-body select { padding: 9px 12px; border: 1px solid #d9dfe6; border-radius: 8px; font: inherit; font-size: 14px; background: #fff; }
.oc-panel { background: #fff; border-radius: 14px; width: 100%; max-width: 480px; max-height: 92vh; overflow: auto; }
.oc-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #eef0f3; }
.oc-head h3 { margin: 0; font-size: 16px; }
.oc-x { background: none; border: 0; font-size: 22px; line-height: 1; color: #94a0ad; cursor: pointer; }
.oc-body { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; }
.oc-body label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #5d6b7a; }
.oc-body input, .oc-body textarea { padding: 9px 12px; border: 1px solid #d9dfe6; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 400; color: #1c2530; }
.oc-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.oc-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #eef0f3; background: #fafbfc; }
`;