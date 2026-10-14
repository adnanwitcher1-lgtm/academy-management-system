import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  AddButton,
  AppShell,
  Button,
  DeleteButton,
  EditButton,
  FormItem,
  INPUT_CLS,
  Modal,
  Notice,
} from "../components/ui";

const EMPTY = { name: "", section: "" };

const TONES = [
  "bg-amber-50 text-amber-800 border-amber-200",
  "bg-orange-50 text-orange-800 border-orange-200",
  "bg-violet-50 text-violet-800 border-violet-200",
  "bg-sky-50 text-sky-800 border-sky-200",
  "bg-emerald-50 text-emerald-800 border-emerald-200",
];
const toneFor = (text) => {
  let n = 0;
  for (const ch of String(text || "?")) n += ch.charCodeAt(0);
  return TONES[n % TONES.length];
};

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const labelOf = (i) => i.name + (i.section ? " " + i.section : "");

export default function SchoolClasses() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [initial, setInitial] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      setItems(asList(await api.listSchoolClasses()));
    } catch (err) {
      setPageError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const ready = form.name.trim().length > 0;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const isEdit = editingId !== null;

  function openAdd() {
    setForm(EMPTY);
    setInitial(EMPTY);
    setEditingId(null);
    setFormError("");
    setOpen(true);
  }

  function openEdit(item) {
    const start = { name: item.name || "", section: item.section || "" };
    setForm(start);
    setInitial(start);
    setEditingId(item.id);
    setFormError("");
    setOpen(true);
  }

  function closeNow() {
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY);
    setInitial(EMPTY);
    setFormError("");
  }

  function close() {
    if (dirty && !window.confirm("Discard your changes? What you typed will be lost.")) return;
    closeNow();
  }

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    const payload = { name: form.name.trim(), section: form.section.trim() };
    try {
      if (isEdit) {
        const updated = await api.updateSchoolClass(editingId, payload);
        setItems((list) => list.map((i) => (i.id === editingId ? updated : i)));
        setNotice("Saved changes for " + labelOf(updated) + ".");
      } else {
        const created = await api.createSchoolClass(payload);
        setItems((list) => [...list, created]);
        setNotice(labelOf(created) + " was added.");
      }
      closeNow();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm("Delete " + labelOf(item) + "? This can't be undone.")) return;
    setPageError("");
    setNotice("");
    setDeletingId(item.id);
    try {
      await api.deleteSchoolClass(item.id);
      setItems((list) => list.filter((i) => i.id !== item.id));
      setNotice(labelOf(item) + " was deleted.");
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const count = items.length;

  return (
    <AppShell
      badge="Academics"
      title="Classes Management"
      subtitle={count + " class" + (count === 1 ? "" : "es") + " registered"}
      action={<AddButton onClick={openAdd}>+ Add New Class</AddButton>}
    >
      <div className="space-y-3">
        <Notice>{pageError}</Notice>
        <Notice tone="success">{notice}</Notice>
      </div>

      <div className="overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm font-medium text-keen-muted">Loading...</p>
        ) : count === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-bold text-keen-charcoal">No classes yet</p>
            <p className="mt-1 text-sm text-keen-muted">Click "Add New Class" to add the first one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white">
                  <th className="px-5 py-4">ID</th>
                  <th className="px-5 py-4">Class</th>
                  <th className="px-5 py-4">Section</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-keen-border">
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-keen-muted">#{item.id}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold " +
                            toneFor(item.name)
                          }
                        >
                          {(item.name || "?")[0].toUpperCase()}
                        </div>
                        <div className="text-base font-bold text-keen-charcoal">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {item.section ? (
                        <span className={"whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold " + toneFor(item.section)}>
                          {item.section}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <EditButton onClick={() => openEdit(item)} />
                        <DeleteButton onClick={() => remove(item)} busy={deletingId === item.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={open}
        title={isEdit ? "Edit Class" : "Add New Class"}
        subtitle={isEdit ? "Update the class details below" : "Fill in the class details below"}
        onClose={close}
        footer={
          <>
            <Button variant="quiet" onClick={close} className="px-4 py-2.5 text-sm">
              Cancel
            </Button>
            <Button onClick={submit} disabled={!ready || busy} className="px-4 py-2.5 text-sm">
              {busy ? "Saving..." : isEdit ? "Save Changes" : "Add Class"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormItem label="Class name" required>
              <input
                className={INPUT_CLS}
                placeholder="e.g. 9th"
                value={form.name}
                onChange={update("name")}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </FormItem>
            <FormItem label="Section">
              <input
                className={INPUT_CLS}
                placeholder="e.g. A"
                value={form.section}
                onChange={update("section")}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </FormItem>
          </div>
          <Notice>{formError}</Notice>
        </div>
      </Modal>
    </AppShell>
  );
}