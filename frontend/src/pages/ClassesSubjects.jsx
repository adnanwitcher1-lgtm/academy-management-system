import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
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

const EMPTY_CLASS = { name: "", section: "" };
const EMPTY_SUBJECT = { name: "", code: "", school_class: "", teacher: "" };

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
const idString = (v) => (v === null || v === undefined ? "" : String(v));
const teacherName = (t) => ((t.first_name || t.username || "") + " " + (t.last_name || "")).trim();
const labelOf = (c) => c.name + (c.section ? " " + c.section : "");

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-4 py-2 text-sm font-bold transition-colors " +
        (active
          ? "border-keen-charcoal bg-keen-charcoal text-white"
          : "border-keen-border bg-white text-keen-charcoal hover:bg-slate-50")
      }
    >
      {children}
    </button>
  );
}

function Avatar({ text }) {
  return (
    <div
      className={
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold " + toneFor(text)
      }
    >
      {(text || "?")[0].toUpperCase()}
    </div>
  );
}

export default function ClassesSubjects() {
  const location = useLocation();
  const [tab, setTab] = useState(location.pathname.includes("/subjects") ? "subjects" : "classes");
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null); // "classes" | "subjects" | null
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [initial, setInitial] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingKey, setDeletingKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const [classData, subjectData, teacherData] = await Promise.all([
        api.listSchoolClasses(),
        api.listSubjects(),
        api.listTeachers(),
      ]);
      setClasses(asList(classData));
      setSubjects(asList(subjectData));
      setTeachers(asList(teacherData));
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
  const isEdit = editingId !== null;
  const ready =
    modal === "classes"
      ? String(form.name || "").trim() !== ""
      : modal === "subjects" &&
        String(form.name || "").trim() !== "" &&
        form.school_class !== "" &&
        form.teacher !== "";
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function classLabel(id) {
    const c = classes.find((x) => x.id === id);
    return c ? labelOf(c) : "-";
  }

  function openAdd() {
    const start = tab === "classes" ? EMPTY_CLASS : EMPTY_SUBJECT;
    setForm(start);
    setInitial(start);
    setEditingId(null);
    setFormError("");
    setModal(tab);
  }

  function openEditClass(c) {
    const start = { name: c.name || "", section: c.section || "" };
    setForm(start);
    setInitial(start);
    setEditingId(c.id);
    setFormError("");
    setModal("classes");
  }

  function openEditSubject(s) {
    const start = {
      name: s.name || "",
      code: s.code || "",
      school_class: idString(s.school_class),
      teacher: idString(s.teacher),
    };
    setForm(start);
    setInitial(start);
    setEditingId(s.id);
    setFormError("");
    setModal("subjects");
  }

  function closeNow() {
    setModal(null);
    setEditingId(null);
    setForm({});
    setInitial({});
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
    try {
      if (modal === "classes") {
        const payload = { name: form.name.trim(), section: (form.section || "").trim() };
        if (isEdit) {
          const updated = await api.updateSchoolClass(editingId, payload);
          setClasses((list) => list.map((i) => (i.id === editingId ? updated : i)));
          setNotice("Saved changes for " + labelOf(updated) + ".");
        } else {
          const created = await api.createSchoolClass(payload);
          setClasses((list) => [...list, created]);
          setNotice(labelOf(created) + " was added.");
        }
      } else {
        const payload = {
          name: form.name.trim(),
          code: (form.code || "").trim(),
          school_class: Number(form.school_class),
          teacher: Number(form.teacher),
        };
        if (isEdit) {
          const updated = await api.updateSubject(editingId, payload);
          setSubjects((list) => list.map((i) => (i.id === editingId ? updated : i)));
          setNotice("Saved changes for " + updated.name + ".");
        } else {
          const created = await api.createSubject(payload);
          setSubjects((list) => [...list, created]);
          setNotice(created.name + " was added.");
        }
      }
      closeNow();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeClass(c) {
    if (!window.confirm("Delete " + labelOf(c) + "? This can't be undone.")) return;
    setPageError("");
    setNotice("");
    setDeletingKey("c" + c.id);
    try {
      await api.deleteSchoolClass(c.id);
      setClasses((list) => list.filter((i) => i.id !== c.id));
      setNotice(labelOf(c) + " was deleted.");
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDeletingKey("");
    }
  }

  async function removeSubject(s) {
    if (!window.confirm("Delete " + s.name + "? This can't be undone.")) return;
    setPageError("");
    setNotice("");
    setDeletingKey("s" + s.id);
    try {
      await api.deleteSubject(s.id);
      setSubjects((list) => list.filter((i) => i.id !== s.id));
      setNotice(s.name + " was deleted.");
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDeletingKey("");
    }
  }

  const noClasses = !loading && classes.length === 0;
  const noTeachers = !loading && teachers.length === 0;

  return (
    <AppShell
      badge="Academics"
      title="Classes & Subjects"
      subtitle={
        classes.length + " class" + (classes.length === 1 ? "" : "es") + " and " +
        subjects.length + " subject" + (subjects.length === 1 ? "" : "s") + " registered"
      }
      action={<AddButton onClick={openAdd}>{tab === "classes" ? "+ Add New Class" : "+ Add New Subject"}</AddButton>}
    >
      <div className="flex gap-2">
        <TabButton active={tab === "classes"} onClick={() => setTab("classes")}>
          Classes ({classes.length})
        </TabButton>
        <TabButton active={tab === "subjects"} onClick={() => setTab("subjects")}>
          Subjects ({subjects.length})
        </TabButton>
      </div>

      <div className="space-y-3">
        <Notice>{pageError}</Notice>
        <Notice tone="success">{notice}</Notice>
      </div>

      <div className="overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm font-medium text-keen-muted">Loading...</p>
        ) : tab === "classes" ? (
          classes.length === 0 ? (
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
                    <th className="px-5 py-4">Subjects</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id} className="border-t border-keen-border">
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-keen-muted">#{c.id}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar text={c.name} />
                          <div className="text-base font-bold text-keen-charcoal">{c.name}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {c.section ? (
                          <span className={"whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold " + toneFor(c.section)}>
                            {c.section}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-5 py-4 text-base text-keen-charcoal">
                        {subjects.filter((s) => s.school_class === c.id).length}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <EditButton onClick={() => openEditClass(c)} />
                          <DeleteButton onClick={() => removeClass(c)} busy={deletingKey === "c" + c.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : subjects.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-bold text-keen-charcoal">No subjects yet</p>
            <p className="mt-1 text-sm text-keen-muted">Click "Add New Subject" to add the first one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white">
                  <th className="px-5 py-4">ID</th>
                  <th className="px-5 py-4">Subject</th>
                  <th className="px-5 py-4">Class</th>
                  <th className="px-5 py-4">Teacher</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id} className="border-t border-keen-border">
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-keen-muted">#{s.id}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar text={s.name} />
                        <div>
                          <div className="text-base font-bold text-keen-charcoal">{s.name}</div>
                          {s.code ? <div className="whitespace-nowrap font-mono text-sm text-keen-muted">{s.code}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={"whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold " + toneFor(classLabel(s.school_class))}>
                        {classLabel(s.school_class)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-base text-keen-charcoal">{s.teacher_name || "-"}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <EditButton onClick={() => openEditSubject(s)} />
                        <DeleteButton onClick={() => removeSubject(s)} busy={deletingKey === "s" + s.id} />
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
        open={modal !== null}
        title={(isEdit ? "Edit " : "Add New ") + (modal === "classes" ? "Class" : "Subject")}
        subtitle={"Fill in the " + (modal === "classes" ? "class" : "subject") + " details below"}
        onClose={close}
        footer={
          <>
            <Button variant="quiet" onClick={close} className="px-4 py-2.5 text-sm">
              Cancel
            </Button>
            <Button onClick={submit} disabled={!ready || busy} className="px-4 py-2.5 text-sm">
              {busy ? "Saving..." : isEdit ? "Save Changes" : modal === "classes" ? "Add Class" : "Add Subject"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {modal === "classes" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormItem label="Class name" required>
                <input className={INPUT_CLS} placeholder="e.g. 9th" value={form.name || ""} onChange={update("name")} />
              </FormItem>
              <FormItem label="Section">
                <input className={INPUT_CLS} placeholder="e.g. A" value={form.section || ""} onChange={update("section")} />
              </FormItem>
            </div>
          ) : modal === "subjects" ? (
            <>
              {noClasses ? <Notice>Add a class first. Subjects need one to belong to.</Notice> : null}
              {noTeachers ? <Notice>No teacher accounts exist yet. Add one from the Teachers page first.</Notice> : null}
              <div className="grid gap-5 sm:grid-cols-2">
                <FormItem label="Subject name" required>
                  <input className={INPUT_CLS} placeholder="e.g. Physics" value={form.name || ""} onChange={update("name")} />
                </FormItem>
                <FormItem label="Code">
                  <input className={INPUT_CLS} placeholder="e.g. PHY9" value={form.code || ""} onChange={update("code")} />
                </FormItem>
                <FormItem label="Class" required>
                  <select className={INPUT_CLS} value={form.school_class || ""} onChange={update("school_class")}>
                    <option value="">Select a class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {labelOf(c)}
                      </option>
                    ))}
                  </select>
                </FormItem>
                <FormItem label="Teacher" required>
                  <select className={INPUT_CLS} value={form.teacher || ""} onChange={update("teacher")}>
                    <option value="">Select a teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {teacherName(t)}
                      </option>
                    ))}
                  </select>
                </FormItem>
              </div>
            </>
          ) : null}
          <Notice>{formError}</Notice>
        </div>
      </Modal>
    </AppShell>
  );
}