import React, { useCallback, useEffect, useState } from "react";
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
  roll_no: "",
  full_name: "",
  class_name: "",
  section: "",
  school_class: "",
  date_of_birth: "",
  cnic_or_bform: "",
  phone_number: "",
  password: "",
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
const nullable = (v) => (v === "" ? null : v);
const idString = (v) => (v === null || v === undefined ? "" : String(v));
const classLabel = (s) => (s.class_name || "-") + (s.section ? " " + s.section : "");

const fromEntry = (s) => ({
  roll_no: s.roll_no ?? "",
  full_name: s.full_name ?? "",
  class_name: s.class_name ?? "",
  section: s.section ?? "",
  school_class: idString(s.school_class),
  date_of_birth: s.date_of_birth ?? "",
  cnic_or_bform: s.cnic_or_bform ?? "",
  phone_number: s.phone_number ?? "",
  password: "",
});

function prettyDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M16.004 3C9.377 3 4 8.377 4 15.004c0 2.395.63 4.64 1.826 6.62L4 29l7.55-1.79a11.94 11.94 0 0 0 4.454.86h.005c6.627 0 12.004-5.377 12.004-12.005C28.013 8.377 22.636 3 16.004 3zm7.03 17.03c-.297.834-1.47 1.527-2.408 1.727-.64.136-1.475.246-4.287-.92-3.59-1.487-5.9-5.13-6.08-5.367-.176-.238-1.454-1.937-1.454-3.694 0-1.757.92-2.62 1.246-2.98.326-.36.712-.45.95-.45.238 0 .476.003.684.013.22.01.514-.083.804.615.297.71 1.01 2.468 1.098 2.648.088.18.147.39.03.628-.118.238-.177.386-.353.594-.176.208-.37.464-.53.624-.176.176-.36.367-.155.72.207.353.92 1.518 1.975 2.46 1.356 1.21 2.5 1.585 2.854 1.762.353.176.56.147.767-.09.208-.238.884-1.032 1.12-1.386.235-.353.47-.294.792-.177.324.117 2.062.973 2.416 1.15.354.177.588.264.676.412.088.147.088.85-.208 1.684z" />
    </svg>
  );
}

function buildWhatsappLink({ full_name, username, password, phone_number }) {
  const digits = (phone_number || "").replace(/[^\d]/g, "");
  const text =
    `Hi ${full_name}, here are your Keen Academy login details:\n` +
    `Username: ${username}\n` +
    `Password: ${password}\n\n` +
    `Please keep these safe.`;
  const encoded = encodeURIComponent(text);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

function WhatsappSendButton({ credentials }) {
  if (!credentials) return null;
  return React.createElement(
    "a",
    {
      href: buildWhatsappLink(credentials),
      target: "_blank",
      rel: "noopener noreferrer",
      className:
        "inline-flex items-center gap-2 rounded-md bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1ebe5b]",
    },
    React.createElement(WhatsAppIcon, null),
    "Send on WhatsApp"
  );
}

export default function Students() {
  const [roster, setRoster] = useState([]);
  const [pending, setPending] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("roster");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [initial, setInitial] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setPageError("");
    try {
      const [rosterData, pendingData, classData] = await Promise.all([
        api.listStudentManage(),
        api.pendingStudents(),
        api.listSchoolClasses(),
      ]);
      setRoster(asList(rosterData));
      setPending(asList(pendingData));
      setClasses(asList(classData));
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
  const isEdit = editing !== null;
  const ready =
    form.roll_no.trim() !== "" &&
    form.full_name.trim() !== "" &&
    form.class_name.trim() !== "" &&
    (isEdit || form.password.trim().length >= 8);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function pickClass(e) {
    const value = e.target.value;
    const c = classes.find((x) => String(x.id) === value);
    setForm((f) => ({
      ...f,
      school_class: value,
      class_name: c ? c.name : f.class_name,
      section: c ? c.section || "" : f.section,
    }));
  }

  function openAdd() {
    setForm(EMPTY);
    setInitial(EMPTY);
    setEditing(null);
    setFormError("");
    setOpen(true);
  }

  function openEdit(s) {
    const start = fromEntry(s);
    setForm(start);
    setInitial(start);
    setEditing(s);
    setFormError("");
    setOpen(true);
  }

  function closeNow() {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY);
    setInitial(EMPTY);
    setFormError("");
  }

  function close() {
    if (dirty && !window.confirm("Discard your changes? What you typed will be lost.")) return;
    closeNow();
  }

  function closeCredentials() {
    setCredentials(null);
  }

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    const payload = {
      roll_no: form.roll_no.trim(),
      full_name: form.full_name.trim(),
      class_name: form.class_name.trim(),
      section: form.section.trim(),
      school_class: form.school_class === "" ? null : Number(form.school_class),
      date_of_birth: nullable(form.date_of_birth),
      cnic_or_bform: form.cnic_or_bform.trim(),
      phone_number: form.phone_number.trim(),
    };
    if (!isEdit) {
      payload.password = form.password;
    }
    try {
      if (isEdit) {
        const updated = await api.updateStudentRoster(editing.id, payload);
        setRoster((list) => list.map((i) => (i.id === editing.id ? updated : i)));
        setNotice("Saved changes for " + updated.full_name + ".");
        closeNow();
      } else {
        const result = await api.enrollStudent(payload);
        await load(true);
        setNotice(payload.full_name + " was added to the roster.");
        closeNow();
        setCredentials({
          full_name: result?.full_name || payload.full_name,
          username: result?.username,
          password: payload.password,
          phone_number: result?.phone_number || payload.phone_number,
        });
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(s) {
    if (!window.confirm("Delete " + s.full_name + " (" + s.roll_no + ")? This can't be undone.")) return;
    setPageError("");
    setNotice("");
    setDeletingId(s.id);
    try {
      await api.deleteStudentRoster(s.id);
      setRoster((list) => list.filter((i) => i.id !== s.id));
      setNotice(s.full_name + " was deleted.");
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function approve(u) {
    const name = u.first_name || u.username;
    setPageError("");
    setNotice("");
    setActingId(u.id);
    try {
      await api.approveStudent(u.id);
      await load(true);
      setNotice(name + " was approved and can now sign in.");
    } catch (err) {
      setPageError(err.message);
    } finally {
      setActingId(null);
    }
  }

  async function reject(u) {
    const name = u.first_name || u.username;
    if (!window.confirm("Reject the signup from " + name + "?")) return;
    setPageError("");
    setNotice("");
    setActingId(u.id);
    try {
      await api.rejectStudent(u.id);
      await load(true);
      setNotice("Signup from " + name + " was rejected.");
    } catch (err) {
      setPageError(err.message);
    } finally {
      setActingId(null);
    }
  }

  const count = roster.length;
  const subtitle =
    count + " student" + (count === 1 ? "" : "s") + " on the roll" +
    (pending.length ? " - " + pending.length + " awaiting approval" : "");

  return (
    <AppShell
      badge="Enrolment"
      title="Students Management"
      subtitle={subtitle}
      action={<AddButton onClick={openAdd}>+ Add New Student</AddButton>}
    >
      <div className="flex gap-2">
        <TabButton active={tab === "roster"} onClick={() => setTab("roster")}>
          Roster ({count})
        </TabButton>
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
          Pending approvals ({pending.length})
        </TabButton>
      </div>

      <div className="space-y-3">
        <Notice>{pageError}</Notice>
        <Notice tone="success">{notice}</Notice>
      </div>

      {tab === "roster" ? (
        <div className="overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
          {loading ? (
            <p className="p-8 text-center text-sm font-medium text-keen-muted">Loading...</p>
          ) : count === 0 ? (
            <div className="p-10 text-center">
              <p className="text-base font-bold text-keen-charcoal">No students yet</p>
              <p className="mt-1 text-sm text-keen-muted">Click "Add New Student" to add the first one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white">
                    <th className="px-5 py-4">ID</th>
                    <th className="px-5 py-4">Student</th>
                    <th className="px-5 py-4">Class</th>
                    <th className="px-5 py-4">CNIC / B-form</th>
                    <th className="px-5 py-4">Account</th>
                    <th className="px-5 py-4">Source</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((s) => (
                    <tr key={s.id} className="border-t border-keen-border">
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-keen-muted">#{s.id}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar text={s.full_name} />
                          <div>
                            <div className="text-base font-bold text-keen-charcoal">{s.full_name}</div>
                            <div className="whitespace-nowrap font-mono text-sm text-keen-muted">{s.roll_no}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={"whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold " + toneFor(classLabel(s))}>
                          {classLabel(s)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-keen-charcoal">{s.cnic_or_bform || "-"}</td>
                      <td className="px-5 py-4">
                        {s.is_claimed ? (
                          <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="whitespace-nowrap rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
                            Not signed up
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-keen-charcoal">
                        <span className="whitespace-nowrap">{s.source === "self" ? "Self signup" : "Admin"}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <EditButton onClick={() => openEdit(s)} />
                          <DeleteButton onClick={() => remove(s)} busy={deletingId === s.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
          {loading ? (
            <p className="p-8 text-center text-sm font-medium text-keen-muted">Loading...</p>
          ) : pending.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-base font-bold text-keen-charcoal">No pending signups</p>
              <p className="mt-1 text-sm text-keen-muted">New student signups that need approval will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white">
                    <th className="px-5 py-4">ID</th>
                    <th className="px-5 py-4">Student</th>
                    <th className="px-5 py-4">Roll No</th>
                    <th className="px-5 py-4">Class</th>
                    <th className="px-5 py-4">Requested</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((u) => (
                    <tr key={u.id} className="border-t border-keen-border">
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-keen-muted">#{u.id}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar text={u.first_name || u.username} />
                          <div>
                            <div className="text-base font-bold text-keen-charcoal">{u.first_name || u.username}</div>
                            <div className="text-sm text-keen-muted">{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-keen-charcoal">{u.roll_no || "-"}</td>
                      <td className="px-5 py-4">
                        <span className={"whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold " + toneFor(classLabel(u))}>
                          {classLabel(u)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-keen-charcoal">{prettyDate(u.date_joined)}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actingId === u.id}
                            onClick={() => approve(u)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            &#10003; Approve
                          </button>
                          <button
                            type="button"
                            disabled={actingId === u.id}
                            onClick={() => reject(u)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            &#10005; Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={open}
        wide
        title={isEdit ? "Edit Student" : "Add New Student"}
        subtitle={isEdit ? "Update the student's details below" : "Fill in the student's details below"}
        onClose={close}
        footer={
          <>
            <Button variant="quiet" onClick={close} className="px-4 py-2.5 text-sm">
              Cancel
            </Button>
            <Button onClick={submit} disabled={!ready || busy} className="px-4 py-2.5 text-sm">
              {busy ? "Saving..." : isEdit ? "Save Changes" : "Add Student"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormItem
              label="Roll No"
              required
              hint={isEdit && editing.is_claimed ? "Locked because the student already has an account." : ""}
            >
              <input
                className={INPUT_CLS}
                placeholder="KEEN-104"
                value={form.roll_no}
                onChange={update("roll_no")}
                disabled={isEdit && editing.is_claimed}
              />
            </FormItem>
            <FormItem label="Full name" required>
              <input className={INPUT_CLS} placeholder="Full name" value={form.full_name} onChange={update("full_name")} />
            </FormItem>

            <FormItem label="Class" hint="Pick a class to fill in the name and section below.">
              <select className={INPUT_CLS} value={form.school_class} onChange={pickClass}>
                <option value="">Not linked</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name + (c.section ? " " + c.section : "")}
                  </option>
                ))}
              </select>
            </FormItem>
            <FormItem label="Class name" required>
              <input className={INPUT_CLS + (form.school_class ? " bg-slate-100 text-slate-500 cursor-not-allowed" : "")} placeholder="e.g. 9th" value={form.class_name} onChange={update("class_name")} disabled={!!form.school_class} />
            </FormItem>

            <FormItem label="Section">
              <input className={INPUT_CLS} placeholder="e.g. A" value={form.section} onChange={update("section")} />
            </FormItem>
            <FormItem label="Date of birth">
              <input type="date" className={INPUT_CLS} value={form.date_of_birth} onChange={update("date_of_birth")} />
            </FormItem>

            <FormItem label="CNIC / B-form">
              <input
                className={INPUT_CLS}
                placeholder="XXXXX-XXXXXXX-X"
                value={form.cnic_or_bform}
                onChange={update("cnic_or_bform")}
              />
            </FormItem>
            <FormItem label="Phone number" hint="Used to send login details on WhatsApp.">
              <input
                className={INPUT_CLS}
                placeholder="e.g. 923001234567"
                value={form.phone_number}
                onChange={update("phone_number")}
              />
            </FormItem>

            {!isEdit && (
              <FormItem label="Password" required wide hint="At least 8 characters. The student will use this to log in.">
                <input
                  type="text"
                  className={INPUT_CLS}
                  placeholder="Set a login password"
                  value={form.password}
                  onChange={update("password")}
                />
              </FormItem>
            )}
          </div>
          <Notice>{formError}</Notice>
        </div>
      </Modal>

      <Modal
        open={!!credentials}
        title="Student account created"
        subtitle="Send the login details, or copy them manually."
        onClose={closeCredentials}
        footer={
          <>
            <Button variant="quiet" onClick={closeCredentials} className="px-4 py-2.5 text-sm">
              Close
            </Button>
            <WhatsappSendButton credentials={credentials} />
          </>
        }
      >
        {credentials ? (
          <div className="space-y-3 text-sm">
            <p className="text-keen-charcoal">
              <span className="font-bold">{credentials.full_name}</span>'s account is ready.
            </p>
            <div className="rounded-lg border border-keen-border bg-slate-50 p-4 font-mono text-sm">
              <div>Username: {credentials.username}</div>
              <div>Password: {credentials.password}</div>
            </div>
            {credentials.phone_number ? null : (
              <Notice>No phone number was entered. The WhatsApp button will open a blank chat with the message pre-filled; pick the contact manually.</Notice>
            )}
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}