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

const EMPTY = {
  name: "",
  code: "",
  school_class: "",
  teacher: "",
};

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

const idString = (v) =>
  v === null || v === undefined ? "" : String(v);

const teacherName = (t) =>
  (
    (t?.first_name || t?.username || "") +
    " " +
    (t?.last_name || "")
  ).trim();

function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
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
      const [subjectData, classData, teacherData] = await Promise.all([
        api.listSubjects(),
        api.listSchoolClasses(),
        api.listTeachers(),
      ]);

      setSubjects(asList(subjectData));
      setClasses(asList(classData));
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

  const update = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.value,
    }));

  const ready =
    form.name.trim().length > 0 &&
    form.school_class !== "" &&
    form.teacher !== "";

  const dirty =
    JSON.stringify(form) !== JSON.stringify(initial);

  const isEdit = editingId !== null;

  const noClasses =
    !loading && classes.length === 0;

  const noTeachers =
    !loading && teachers.length === 0;

  function classLabel(id) {
    const c = classes.find((x) => x.id === id);

    return c
      ? c.name + (c.section ? " " + c.section : "")
      : "-";
  }

  function openAdd() {
    setForm(EMPTY);
    setInitial(EMPTY);
    setEditingId(null);
    setFormError("");
    setOpen(true);
  }

  function openEdit(item) {
    const start = {
      name: item.name || "",
      code: item.code || "",
      school_class: idString(item.school_class),
      teacher: idString(item.teacher),
    };

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
    if (
      dirty &&
      !window.confirm(
        "Discard your changes? What you typed will be lost."
      )
    ) {
      return;
    }

    closeNow();
  }

  async function submit() {
    if (!ready || busy) return;

    setBusy(true);
    setFormError("");
    setNotice("");

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      school_class: Number(form.school_class),
      teacher: Number(form.teacher),
    };

    try {
      if (isEdit) {
        const updated = await api.updateSubject(
          editingId,
          payload
        );

        setSubjects((list) =>
          list.map((i) =>
            i.id === editingId ? updated : i
          )
        );

        setNotice(
          "Saved changes for " +
            updated.name +
            "."
        );
      } else {
        const created =
          await api.createSubject(payload);

        setSubjects((list) => [
          ...list,
          created,
        ]);

        setNotice(
          created.name +
            " was added."
        );
      }

      closeNow();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (
      !window.confirm(
        "Delete " +
          item.name +
          "? This can't be undone."
      )
    ) {
      return;
    }

    setPageError("");
    setNotice("");
    setDeletingId(item.id);

    try {
      await api.deleteSubject(item.id);

      setSubjects((list) =>
        list.filter((i) => i.id !== item.id)
      );

      setNotice(
        item.name +
          " was deleted."
      );
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const count = subjects.length;

  return (
    <AppShell
      badge="Academics"
      title="Subjects Management"
      subtitle={
        count +
        " subject" +
        (count === 1 ? "" : "s") +
        " registered"
      }
      action={
        <AddButton
          onClick={openAdd}
          className="w-full sm:w-auto"
        >
          + Add New Subject
        </AddButton>
      }
    >
      <div className="space-y-3">
        <Notice>{pageError}</Notice>
        <Notice tone="success">{notice}</Notice>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm font-medium text-keen-muted">
            Loading...
          </p>
        ) : count === 0 ? (
          <div className="p-6 text-center sm:p-10">
            <p className="text-base font-bold text-keen-charcoal">
              No subjects yet
            </p>

            <p className="mt-1 text-sm text-keen-muted">
              Click "Add New Subject" to add the first one.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead>
                <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white">
                  <th className="whitespace-nowrap px-4 py-3 sm:px-5 sm:py-4">
                    ID
                  </th>

                  <th className="whitespace-nowrap px-4 py-3 sm:px-5 sm:py-4">
                    Subject
                  </th>

                  <th className="whitespace-nowrap px-4 py-3 sm:px-5 sm:py-4">
                    Class
                  </th>

                  <th className="whitespace-nowrap px-4 py-3 sm:px-5 sm:py-4">
                    Teacher
                  </th>

                  <th className="whitespace-nowrap px-4 py-3 sm:px-5 sm:py-4">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {subjects.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-keen-border"
                  >
                    <td className="whitespace-nowrap px-4 py-3 sm:px-5 sm:py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-keen-muted">
                        #{s.id}
                      </span>
                    </td>

                    <td className="px-4 py-3 sm:px-5 sm:py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold sm:h-10 sm:w-10 " +
                            toneFor(s.name)
                          }
                        >
                          {(s.name || "?")[0].toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-keen-charcoal sm:text-base">
                            {s.name}
                          </div>

                          {s.code ? (
                            <div className="truncate font-mono text-xs text-keen-muted sm:text-sm">
                              {s.code}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 sm:px-5 sm:py-4">
                      <span
                        className={
                          "whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold sm:px-3 sm:text-sm " +
                          toneFor(
                            classLabel(s.school_class)
                          )
                        }
                      >
                        {classLabel(s.school_class)}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-sm text-keen-charcoal sm:px-5 sm:py-4 sm:text-base">
                      {s.teacher_name || "-"}
                    </td>

                    <td className="px-4 py-3 sm:px-5 sm:py-4">
                      <div className="flex shrink-0 gap-2">
                        <EditButton
                          onClick={() => openEdit(s)}
                        />

                        <DeleteButton
                          onClick={() => remove(s)}
                          busy={
                            deletingId === s.id
                          }
                        />
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
        title={
          isEdit
            ? "Edit Subject"
            : "Add New Subject"
        }
        subtitle={
          isEdit
            ? "Update the subject details below"
            : "Fill in the subject details below"
        }
        onClose={close}
        footer={
          <>
            <Button
              variant="quiet"
              onClick={close}
              className="w-full px-4 py-2.5 text-sm sm:w-auto"
            >
              Cancel
            </Button>

            <Button
              onClick={submit}
              disabled={!ready || busy}
              className="w-full px-4 py-2.5 text-sm sm:w-auto"
            >
              {busy
                ? "Saving..."
                : isEdit
                ? "Save Changes"
                : "Add Subject"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {noClasses ? (
            <Notice>
              Add a class first. Subjects need one to belong to.
            </Notice>
          ) : null}

          {noTeachers ? (
            <Notice>
              No teacher accounts exist yet. Add one from the
              Teachers page first.
            </Notice>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            <FormItem label="Subject name" required>
              <input
                className={INPUT_CLS + " w-full"}
                placeholder="e.g. Physics"
                value={form.name}
                onChange={update("name")}
              />
            </FormItem>

            <FormItem label="Code">
              <input
                className={INPUT_CLS + " w-full"}
                placeholder="e.g. PHY9"
                value={form.code}
                onChange={update("code")}
              />
            </FormItem>

            <FormItem label="Class" required>
              <select
                className={INPUT_CLS + " w-full"}
                value={form.school_class}
                onChange={update("school_class")}
              >
                <option value="">
                  Select a class
                </option>

                {classes.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {c.name +
                      (c.section
                        ? " " + c.section
                        : "")}
                  </option>
                ))}
              </select>
            </FormItem>

            <FormItem label="Teacher" required>
              <select
                className={INPUT_CLS + " w-full"}
                value={form.teacher}
                onChange={update("teacher")}
              >
                <option value="">
                  Select a teacher
                </option>

                {teachers.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                  >
                    {teacherName(t)}
                  </option>
                ))}
              </select>
            </FormItem>
          </div>

          <Notice>{formError}</Notice>
        </div>
      </Modal>
    </AppShell>
  );
}
export default Subjects;


