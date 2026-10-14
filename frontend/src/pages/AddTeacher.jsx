import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { AppShell, Button, Notice } from "../components/ui";
import TeacherExtras from "../components/TeacherExtras";
import NewTeacherExtras from "../components/NewTeacherExtras";
import TeacherAttendanceModal from "../components/TeacherAttendanceModal";


// Fields shown with a red * in the form. Add a key here to make another field required.
const REQUIRED = ["first_name"];

const EMPTY = {
  first_name: "",
  last_name: "",
  username: "",
  password: "",
  cnic: "",
  phone_number: "",
  email: "",
  address: "",
  subject_specialization: "",
  joining_date: "",
  shift_start: "",
  shift_end: "",
  salary: "",
  is_active: "true",
};

const EMPTY_EXTRAS = { subjectIds: [], tasks: [] };

const fromProfile = (p) => ({
  first_name: p?.first_name ?? "",
  last_name: p?.last_name ?? "",
  username: p?.username ?? "",
  cnic: p?.cnic ?? "",
  phone_number: p?.phone_number ?? "",
  email: p?.email ?? "",
  address: p?.address ?? "",
  subject_specialization: p?.subject_specialization ?? "",
  joining_date: p?.joining_date ?? "",
  shift_start: (p?.shift_start ?? "").slice(0, 5),
  shift_end: (p?.shift_end ?? "").slice(0, 5),
  salary:
    p?.salary === null || p?.salary === undefined
      ? ""
      : String(Number(p?.salary)),
  is_active: p?.is_active === false ? "false" : "true",
});

const CNIC_OK = /^\d{5}-\d{7}-\d$/;

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const nullable = (v) => (v === "" ? null : v);

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

const fullName = (p) =>
  (p?.first_name + " " + (p?.last_name || "")).trim() || p?.username;

const initialOf = (p) => (fullName(p)[0] || "?").toUpperCase();

function formatCnic(value) {
  const d = value.replace(/\D/g, "").slice(0, 13);

  if (d.length <= 5) return d;

  if (d.length <= 12) {
    return d.slice(0, 5) + "-" + d.slice(5);
  }

  return d.slice(0, 5) + "-" + d.slice(5, 12) + "-" + d.slice(12);
}

function minutesOf(t) {
  if (!t) return null;

  const [h, m] = t.split(":");

  return Number(h) * 60 + Number(m);
}

function shiftHours(start, end) {
  const a = minutesOf(start);
  const b = minutesOf(end);

  if (a === null || b === null || b <= a) return null;

  const mins = b - a;
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  return m ? h + " h " + m + " min" : h + " h";
}

function fmtTime(t) {
  if (!t) return "-";

  const [h, m] = t.split(":");
  const hh = Number(h);

  return (
    (hh % 12 || 12) +
    ":" +
    m +
    " " +
    (hh >= 12 ? "PM" : "AM")
  );
}

const money = (n) =>
  n === null || n === undefined || n === ""
    ? "-"
    : "Rs " + Number(n).toLocaleString("en-PK");

const inputCls =
  "w-full rounded-lg border border-keen-border bg-slate-50 px-3 py-2.5 text-sm text-keen-charcoal outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200";

function Item({ label, required, error, hint, wide, children }) {
  return (
    <label className={"block " + (wide ? "sm:col-span-2" : "")}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-keen-muted">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>

      {children}

      {hint && (
        <span className="mt-1 block text-[11px] font-medium text-keen-muted">
          {hint}
        </span>
      )}

      {error && (
        <span className="mt-1 block text-[11px] font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

export default function AddTeacher() {
  const [mode, setMode] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [extras, setExtras] = useState(EMPTY_EXTRAS);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [created, setCreated] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [resettingPw, setResettingPw] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [showAttendance, setShowAttendance] = useState(false);

  const loadProfiles = useCallback(async () => {
    try {
      setProfiles(asList(await api.listTeacherProfiles()));
    } catch (e) {
      setPageError(e.message);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const update = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.value,
    }));

  const isReq = (key) => REQUIRED.includes(key);

  const isEdit = mode === "edit";

  const credentials = created || resetResult;

  const problems = useMemo(() => {
    const p = {};

    if (form.cnic && !CNIC_OK.test(form.cnic)) {
      p.cnic = "Use the format 00000-0000000-0.";
    }

    if (
      form.shift_start &&
      form.shift_end &&
      minutesOf(form.shift_end) <= minutesOf(form.shift_start)
    ) {
      p.shift = "Shift end must be after shift start.";
    }

    if (form.salary !== "" && Number(form.salary) < 0) {
      p.salary = "Salary cannot be negative.";
    }

    return p;
  }, [form]);

  const hours = shiftHours(form.shift_start, form.shift_end);

  const ready =
    REQUIRED.every((k) => String(form[k]).trim().length > 0) &&
    Object.keys(problems).length === 0;

  const dirty = isEdit
    ? editing &&
      JSON.stringify(form) !== JSON.stringify(fromProfile(editing))
    : Object.entries(form).some(
        ([k, v]) => k !== "is_active" && v !== ""
      ) ||
      extras.subjectIds.length > 0 ||
      extras.tasks.length > 0;

  function openAdd() {
    setForm(EMPTY);
    setExtras(EMPTY_EXTRAS);
    setEditing(null);
    setError("");
    setCreated(null);
    setResetResult(null);
    setMode("add");
  }

  function openEdit(p) {
    setForm(fromProfile(p));
    setEditing(p);
    setError("");
    setCreated(null);
    setResetResult(null);
    setMode("edit");
  }

  async function handleResetPassword() {
    if (!editing) return;

    if (!window.confirm("Reset the password for this teacher?")) return;

    setResettingPw(true);
    setError("");

    try {
      const data = await api.resetTeacherPassword(editing.id);
      setResetResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setResettingPw(false);
    }
  }

  function sendCredentialsWhatsApp() {
    if (!created) return;

    const phone = String(form.phone_number || "").replace(/\D/g, "");

    if (!phone) {
      setError(
        "Teacher phone number is required to send credentials via WhatsApp."
      );
      return;
    }

    let whatsappNumber = phone;

    // Convert Pakistani 03XXXXXXXXX format to 923XXXXXXXXX
    if (phone.startsWith("0")) {
      whatsappNumber = "92" + phone.slice(1);
    }

    const teacherName = form.first_name?.trim() || "Teacher";

    const message =
      "Hello " +
      teacherName +
      ",\n\n" +
      "Your Keen Academy teacher account has been created.\n\n" +
      "Username: " +
      created.username +
      "\n" +
      "Temporary Password: " +
      created.temporary_password +
      "\n\n" +
      "Please change your password after your first login.\n\n" +
      "Regards,\nKeen Academy";

    const url =
      "https://wa.me/" +
      whatsappNumber +
      "?text=" +
      encodeURIComponent(message);

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function closeNow() {
    setForm(EMPTY);
    setExtras(EMPTY_EXTRAS);
    setEditing(null);
    setError("");
    setCreated(null);
    setResetResult(null);
    setMode(null);
  }

  function close() {
    if (
      !created &&
      dirty &&
      !window.confirm("Discard your changes? What you typed will be lost.")
    ) {
      return;
    }

    closeNow();
  }

  async function submit() {
    if (!ready || busy) return;

    setError("");
    setNotice("");
    setBusy(true);

    try {
      const base = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        subject_specialization: form.subject_specialization.trim(),
        cnic: form.cnic,
        address: form.address.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        joining_date: nullable(form.joining_date),
        shift_start: nullable(form.shift_start),
        shift_end: nullable(form.shift_end),
        salary: nullable(form.salary),
      };

      if (isEdit) {
        await api.updateTeacherProfile(editing.id, {
          ...base,
          is_active: form.is_active === "true",
        });

        await loadProfiles();

        setNotice("Saved changes for " + base.first_name + ".");
        closeNow();
      } else {
        const payload = {
          ...base,
          subject_ids: extras.subjectIds,
          tasks: extras.tasks,
        };

        if (form.username.trim()) {
          payload.username = form.username.trim();
        }

        if (form.password && form.password.trim()) {
          payload.password = form.password.trim();
        }

        const data = await api.createTeacher(payload);

        setCreated(data);

        // Keep the phone number and name so WhatsApp can use them
        // after the credentials are generated.
        setForm((current) => ({
          ...EMPTY,
          first_name: current.first_name,
          phone_number: current.phone_number,
        }));

        setExtras(EMPTY_EXTRAS);

        loadProfiles();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p) {
    const name = fullName(p);

    const msg =
      "Delete " +
      name +
      "? This permanently removes their login and profile. To keep their records, set the status to Inactive instead.";

    if (!window.confirm(msg)) return;

    setPageError("");
    setNotice("");
    setDeletingId(p.id);

    try {
      await api.deleteTeacher(p.id);

      setProfiles((list) => list.filter((x) => x.id !== p.id));

      setNotice(name + " was deleted.");
    } catch (err) {
      setPageError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const count = profiles.length;

  return (
    <AppShell
      badge="Teaching staff"
      title="Teachers Management"
      subtitle={
        count + " teacher" + (count === 1 ? "" : "s") + " registered"
      }
            action={
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowAttendance(true)}
            className="rounded-xl border border-keen-border bg-white px-5 py-3 text-sm font-bold text-keen-charcoal shadow-sm hover:bg-slate-50"
          >
            Teacher Attendance
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-xl bg-keen-cyan px-5 py-3 text-sm font-bold text-keen-darkest shadow-sm shadow-keen-cyan/25 hover:bg-keen-cyanDark"
          >
            + Add New Teacher
          </button>
        </div>
      }
      
    >
      <div className="space-y-3">
        <Notice>{pageError}</Notice>
        <Notice tone="success">{notice}</Notice>
      </div>

      <div className="overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
        {count === 0 ? (
          <p className="p-6 text-sm text-keen-muted">
            No teachers yet. Click "Add New Teacher" to add the first one.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white">
                  <th className="px-3 py-3">Teacher</th>
                  <th className="px-3 py-3">Lectures</th>
                  <th className="px-3 py-3">Contact No</th>
                  <th className="px-3 py-3">Hours</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {profiles.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-keen-border"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold " +
                            toneFor(fullName(p))
                          }
                        >
                          {initialOf(p)}
                        </div>

                        <div>
                          <div className="whitespace-nowrap text-base font-bold text-keen-charcoal">
                            {fullName(p)}
                          </div>

                          <div
                            className="max-w-[200px] truncate text-sm text-keen-muted"
                            title={p.email || p.username}
                          >
                            {p.email || p.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm text-keen-charcoal">
                      {(p.assigned_lectures || []).length === 0 ? (
                        "None yet"
                      ) : (
                        <div className="flex flex-col gap-1">
                          {p.assigned_lectures.map((l, i) => (
                            <span key={i} className="whitespace-nowrap">
                              {l.name}
                              {l.class_name
                                ? " (" + l.class_name + ")"
                                : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 font-mono text-sm text-keen-charcoal">
                      {p.phone_number || "-"}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-keen-charcoal">
                      {p.shift_start ? (
                        <>
                          {fmtTime(p.shift_start)} &ndash;{" "}
                          {fmtTime(p.shift_end)}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {p.is_active === false ? (
                        <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
                          Inactive
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-blue-600"
                        >
                          <BtnIcon paths={EDIT_ICON} />
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === p.id}
                          onClick={() => remove(p)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          <BtnIcon paths={DELETE_ICON} />
                          {deletingId === p.id
                            ? "Deleting..."
                            : "Delete"}
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

      {mode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="teacher-modal-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-keen-border px-8 py-6">
              <div>
                <h2
                  id="teacher-modal-title"
                  className="text-xl font-bold text-keen-charcoal"
                >
                  {credentials
                    ? resetResult
                      ? "Password reset"
                      : "Teacher added"
                    : isEdit
                    ? "Edit Teacher"
                    : "Add New Teacher"}
                </h2>

                <p className="mt-1 text-sm text-keen-muted">
                  {created
                    ? "Share the login below. It is shown only once."
                    : isEdit
                    ? "Update the teacher's details below"
                    : "Fill in the teacher's details below"}
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="text-2xl leading-none text-keen-muted hover:text-keen-charcoal"
              >
                &times;
              </button>
            </div>

            <div className="overflow-y-auto px-8 py-6">
              {created ? (
                <div className="space-y-4">
                  <Notice tone="success">{credentials.message}</Notice>

                  <div className="space-y-2 rounded-lg border border-keen-border bg-slate-50 p-4">
                    <Row
                      label="Username"
                      value={credentials.username}
                    />

                    <Row
                      label="Temporary password"
                      value={credentials.temporary_password}
                    />
                  </div>

                  <p className="text-[11px] font-medium text-keen-muted">
                    The teacher must change this password on first login.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Item
                      label="First name"
                      required={isReq("first_name")}
                    >
                      <input
                        className={inputCls}
                        placeholder="First name"
                        value={form.first_name}
                        onChange={update("first_name")}
                      />
                    </Item>

                    <Item
                      label="Last name"
                      required={isReq("last_name")}
                    >
                      <input
                        className={inputCls}
                        placeholder="Last name"
                        value={form.last_name}
                        onChange={update("last_name")}
                      />
                    </Item>

                    <Item
                      label="CNIC"
                      required={isReq("cnic")}
                      error={problems.cnic}
                    >
                      <input
                        className={inputCls}
                        placeholder="XXXXX-XXXXXXX-X"
                        value={form.cnic}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            cnic: formatCnic(e.target.value),
                          }))
                        }
                      />
                    </Item>

                    <Item
                      label="Contact No"
                      required={isReq("phone_number")}
                    >
                      <input
                        className={inputCls}
                        placeholder="03XX-XXXXXXX"
                        value={form.phone_number}
                        onChange={update("phone_number")}
                      />
                    </Item>

                    <Item
                      label="Email"
                      required={isReq("email")}
                    >
                      <input
                        type="email"
                        className={inputCls}
                        value={form.email}
                        onChange={update("email")}
                      />
                    </Item>

                    <Item
                      label="Subject specialization"
                      required={isReq("subject_specialization")}
                    >
                      <input
                        className={inputCls}
                        placeholder="e.g. Physics"
                        value={form.subject_specialization}
                        onChange={update("subject_specialization")}
                      />
                    </Item>

                    <Item
                      label="Residential address"
                      required={isReq("address")}
                      wide
                    >
                      <input
                        className={inputCls}
                        value={form.address}
                        onChange={update("address")}
                      />
                    </Item>

                    <Item
                      label="Joining date"
                      required={isReq("joining_date")}
                    >
                      <input
                        type="date"
                        className={inputCls}
                        value={form.joining_date}
                        onChange={update("joining_date")}
                      />
                    </Item>

                    <Item
                      label="Base salary (Rs per month)"
                      required={isReq("salary")}
                      error={problems.salary}
                    >
                      <input
                        type="number"
                        min="0"
                        className={inputCls}
                        value={form.salary}
                        onChange={update("salary")}
                      />
                    </Item>

                    <Item
                      label="Shift start"
                      required={isReq("shift_start")}
                    >
                      <input
                        type="time"
                        className={inputCls}
                        value={form.shift_start}
                        onChange={update("shift_start")}
                      />
                    </Item>

                    <Item
                      label="Shift end"
                      required={isReq("shift_end")}
                      error={problems.shift}
                      hint={
                        hours ? "Daily commitment: " + hours : ""
                      }
                    >
                      <input
                        type="time"
                        className={inputCls}
                        value={form.shift_end}
                        onChange={update("shift_end")}
                      />
                    </Item>

                    {isEdit ? (
                      <>
                        <Item
                          label="Username"
                          hint="The username cannot be changed."
                        >
                          <input
                            className={inputCls}
                            value={form.username}
                            disabled
                          />
                        </Item>

                        <Item
                          label="Status"
                          hint="Inactive teachers cannot sign in."
                        >
                          <select
                            className={inputCls}
                            value={form.is_active}
                            onChange={update("is_active")}
                          >
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                        </Item>
                      </>
                    ) : (
                      <>
                        <Item
                          label="Username"
                          hint="Leave blank to generate one automatically."
                          wide
                        >
                          <input
                            className={inputCls}
                            value={form.username}
                            onChange={update("username")}
                          />
                        </Item>

                        <Item
                          label="Password"
                          hint="Leave blank to auto-generate a temporary password."
                          wide
                        >
                          <input
                            type="text"
                            className={inputCls}
                            value={form.password || ""}
                            onChange={update("password")}
                            placeholder="Leave blank to auto-generate"
                          />
                        </Item>
                      </>
                    )}
                  </div>

                  {isEdit ? (
                    <TeacherExtras
                      key={editing.id}
                      profile={editing}
                      onChanged={loadProfiles}
                      onClose={close}
                    />
                  ) : (
                    <div className="space-y-6">
                      <NewTeacherExtras
                        value={extras}
                        onChange={setExtras}
                      />
                    </div>
                  )}

                  <Notice>{error}</Notice>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-keen-border px-8 py-4">
              {credentials ? (
                <>
                  <button
                    type="button"
                    onClick={sendCredentialsWhatsApp}
                    className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700"
                  >
                    📱 Send via WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={openAdd}
                    className="rounded-lg border border-keen-border px-4 py-2.5 text-sm font-bold text-keen-charcoal"
                  >
                    Add another teacher
                  </button>

                  <Button onClick={closeNow}>Done</Button>
                </>
              ) : (
                <>
                  {isEdit ? (
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resettingPw}
                      className="mr-auto rounded-lg border border-red-300 px-4 py-2.5 text-sm font-bold text-red-600"
                    >
                      {resettingPw
                        ? "Resetting..."
                        : "Reset Password"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg border border-keen-border px-4 py-2.5 text-sm font-bold text-keen-charcoal"
                  >
                    Cancel
                  </button>

                  <Button
                    onClick={submit}
                    disabled={!ready || busy}
                  >
                    {busy
                      ? isEdit
                        ? "Saving..."
                        : "Adding..."
                      : isEdit
                      ? "Save Changes"
                      : "Add Teacher"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        
      )}


      {showAttendance && (
        <TeacherAttendanceModal onClose={() => setShowAttendance(false)} />
      )}
    </AppShell>
    
  );
}

function BtnIcon({ paths }) {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const EDIT_ICON = [
  "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7",
  "M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
];

const DELETE_ICON = [
  "M3 6h18",
  "M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
  "M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2",
  "M10 11v6",
  "M14 11v6",
];

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-bold text-keen-muted">{label}</span>

      <code className="font-mono font-bold text-keen-charcoal">
        {value}
      </code>
    </div>
  );
}