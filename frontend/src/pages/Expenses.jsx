import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { AppShell } from "../components/ui";

const money = (n) => "Rs " + Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
const todayStr = () => new Date().toLocaleDateString("en-CA");
const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const emptyForm = () => ({ title: "", amount: "", date: todayStr(), category: "", description: "" });

export default function Expenses() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(asList(await api.listExpenses()));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(
    () => [...new Set(items.map((x) => x.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((x) => {
      if (category && x.category !== category) return false;
      if (from && x.date < from) return false;
      if (to && x.date > to) return false;
      if (q) {
        const hay = (x.title + " " + x.category + " " + (x.description || "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, category, from, to]);

  const total = filtered.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const monthKey = todayStr().slice(0, 7);
  const monthTotal = items.filter((x) => x.date.startsWith(monthKey)).reduce((sum, x) => sum + Number(x.amount || 0), 0);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
    setOpen(true);
  }

  function openEdit(x) {
    setEditingId(x.id);
    setForm({
      title: x.title,
      amount: x.amount,
      date: x.date,
      category: x.category,
      description: x.description || "",
    });
    setFormError("");
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const payload = {
      title: form.title.trim(),
      amount: form.amount,
      date: form.date,
      category: form.category.trim(),
      description: form.description.trim(),
    };
    try {
      if (editingId) await api.updateExpense(editingId, payload);
      else await api.createExpense(payload);
      setOpen(false);
      setNotice(editingId ? "Expense updated." : "Expense added.");
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(x) {
    if (!window.confirm(`Delete expense "${x.title}"?`)) return;
    setError("");
    try {
      await api.deleteExpense(x.id);
      setItems((list) => list.filter((i) => i.id !== x.id));
      setNotice("Expense deleted.");
    } catch (e) {
      setError(e.message);
    }
  }

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setFrom("");
    setTo("");
  };
  const hasFilters = search || category || from || to;

  return (
    <AppShell title="Expenses" subtitle="Track institute spending.">
      <style>{css}</style>

      {error && <div className="ex-alert ex-err">{error}</div>}
      {notice && <div className="ex-alert ex-ok">{notice}</div>}

      <div className="ex-cards">
        <div className="ex-card">
          <span>{hasFilters ? "Filtered total" : "Total expenses"}</span>
          <strong>{money(total)}</strong>
          <small>{filtered.length} entr{filtered.length === 1 ? "y" : "ies"}</small>
        </div>
        <div className="ex-card">
          <span>This month</span>
          <strong>{money(monthTotal)}</strong>
        </div>
      </div>

      <div className="ex-toolbar">
        <input
          type="search"
          placeholder="Search title, category or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label>
          From
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        {hasFilters && (
          <button type="button" className="ex-btn" onClick={clearFilters}>
            Clear
          </button>
        )}
        <button type="button" className="ex-btn ex-btn-primary ex-push" onClick={openAdd}>
          + New Expense
        </button>
      </div>

      <div className="ex-wrap">
        <table className="ex-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="ex-empty">Loading...</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="ex-empty">{items.length === 0 ? "No expenses yet." : "No expenses match."}</td>
              </tr>
            )}
            {!loading &&
              filtered.map((x) => (
                <tr key={x.id}>
                  <td className="ex-strong">{x.title}</td>
                  <td>
                    <span className="ex-tag">{x.category}</span>
                  </td>
                  <td>{x.date}</td>
                  <td className="ex-strong">{money(x.amount)}</td>
                  <td className="ex-notes">{x.description || "-"}</td>
                  <td>
                    <div className="ex-actions">
                      <button type="button" className="ex-link" onClick={() => openEdit(x)}>
                        Edit
                      </button>
                      <button type="button" className="ex-link ex-danger" onClick={() => remove(x)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="ex-overlay" onClick={() => !saving && setOpen(false)}>
          <form className="ex-panel" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="ex-head">
              <h3>{editingId ? "Edit Expense" : "New Expense"}</h3>
              <button type="button" className="ex-x" onClick={() => setOpen(false)}>
                &times;
              </button>
            </div>
            <div className="ex-body">
              <label>
                Expense title *
                <input
                  type="text"
                  required
                  maxLength={150}
                  placeholder="e.g. Electricity bill, Office supplies"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <div className="ex-row2">
                <label>
                  Amount *
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </label>
                <label>
                  Date *
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Category *
                <input
                  type="text"
                  required
                  maxLength={100}
                  list="ex-cats"
                  placeholder="e.g. Utilities, Rent, Stationery"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                <datalist id="ex-cats">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label>
                Description / notes
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              {formError && <div className="ex-alert ex-err" style={{ marginBottom: 0 }}>{formError}</div>}
            </div>
            <div className="ex-foot">
              <button type="button" className="ex-btn" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="ex-btn ex-btn-primary" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Add expense"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

const css = `
.ex-alert { padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.ex-err { background: #fdecea; color: #b3261e; }
.ex-ok { background: #e6f4ea; color: #1e7e34; }

.ex-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 18px; }
.ex-card { display: flex; flex-direction: column; gap: 4px; padding: 16px 18px; background: #fff; border: 1px solid #e3e7ed; border-radius: 12px; border-left: 4px solid #0fb3b8; }
.ex-card span { font-size: 13px; color: #5d6b7a; font-weight: 600; }
.ex-card strong { font-size: 24px; color: #1c2530; }
.ex-card small { color: #94a0ad; font-size: 12px; }

.ex-toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 18px; }
.ex-toolbar input, .ex-toolbar select { padding: 8px 12px; border: 1px solid #d9dfe6; border-radius: 8px; font-size: 14px; background: #fff; }
.ex-toolbar input[type="search"] { flex: 1; min-width: 220px; }
.ex-toolbar label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #5d6b7a; }
.ex-push { margin-left: auto; }

.ex-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #d9dfe6; background: #fff; color: #1c2530; font-size: 14px; font-weight: 600; cursor: pointer; }
.ex-btn-primary { background: #0fb3b8; border-color: #0fb3b8; color: #fff; }
.ex-btn-primary:hover { background: #0c9a9f; }
.ex-btn:disabled { opacity: .6; cursor: default; }

.ex-wrap { background: #fff; border: 1px solid #e3e7ed; border-radius: 12px; overflow-x: auto; }
.ex-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.ex-table th { text-align: left; padding: 12px 16px; background: #f7f8fa; color: #5d6b7a; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
.ex-table td { padding: 12px 16px; border-top: 1px solid #eef0f3; vertical-align: middle; }
.ex-strong { font-weight: 600; color: #1c2530; }
.ex-notes { color: #5d6b7a; max-width: 260px; }
.ex-empty { text-align: center; color: #94a0ad; padding: 32px 16px; }
.ex-tag { padding: 3px 12px; border-radius: 999px; background: #e8fafa; color: #0a7f84; font-size: 12px; font-weight: 600; }
.ex-actions { display: flex; gap: 14px; }
.ex-link { background: none; border: 0; padding: 0; font-size: 13px; font-weight: 600; color: #1f4e8c; cursor: pointer; }
.ex-danger { color: #b3261e; }

.ex-overlay { position: fixed; inset: 0; background: rgba(15,23,32,.45); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
.ex-panel { background: #fff; border-radius: 14px; width: 100%; max-width: 480px; max-height: 92vh; overflow: auto; }
.ex-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #eef0f3; }
.ex-head h3 { margin: 0; font-size: 16px; }
.ex-x { background: none; border: 0; font-size: 22px; line-height: 1; color: #94a0ad; cursor: pointer; }
.ex-body { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; }
.ex-body label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #5d6b7a; }
.ex-body input, .ex-body textarea { padding: 9px 12px; border: 1px solid #d9dfe6; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 400; color: #1c2530; }
.ex-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ex-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #eef0f3; background: #fafbfc; }
`;