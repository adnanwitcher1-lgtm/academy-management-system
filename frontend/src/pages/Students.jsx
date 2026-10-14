import { useCallback, useEffect, useMemo, useState } from "react";
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

  for (const ch of String(text || "?")) {
    n += ch.charCodeAt(0);
  }

  return TONES[n % TONES.length];
};

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const nullable = (v) => (v === "" ? null : v);

const idString = (v) =>
  v === null || v === undefined ? "" : String(v);

const classLabel = (s) =>
  (s.class_name || "-") +
  (s.section ? " " + s.section : "");

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

  if (isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold " +
        toneFor(text)
      }
    >
      {(text || "?")[0].toUpperCase()}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-5 w-5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.004 3C9.377 3 4 8.377 4 15.004c0 2.395.63 4.64 1.826 6.62L4 29l7.55-1.79a11.94 11.94 0 0 0 4.454.86h.005c6.627 0 12.004-5.377 12.004-12.005C28.013 8.377 22.636 3 16.004 3zm7.03 17.03c-.297.834-1.47 1.527-2.408 1.727-.64.136-1.475.246-4.287-.92-3.59-1.487-5.9-5.13-6.08-5.367-.176-.238-1.454-1.937-1.454-3.694 0-1.757.92-2.62 1.246-2.98.326-.36.712-.45.95-.45.238 0 .476.003.684.013.22.01.514-.083.804.615.297.71 1.01 2.468 1.098 2.648.088.18.147.39.03.628-.118.238-.177.386-.353.594-.176.208-.37.464-.53.624-.176.176-.36.367-.155.72.207.353.92 1.518 1.975 2.46 1.356 1.21 2.5 1.585 2.854 1.762.353.176.56.147.767-.09.208-.238.884-1.032 1.12-1.386.235-.353.47-.294.792-.177.324.117 2.062.973 2.416 1.15.354.177.588.264.676.412.088.147.088.85-.208 1.684z" />
    </svg>
  );
}

function buildWhatsappLink({
  full_name,
  username,
  password,
  phone_number,
}) {
  const digits = (phone_number || "").replace(
    /[^\d]/g,
    ""
  );

  const text =
    `Hi ${full_name}, here are your Keen Academy login details:\n` +
    `Username: ${username}\n` +
    `Password: ${password}\n\n` +
    `Please keep these safe.`;

  const encoded = encodeURIComponent(text);

  return digits
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

const admissionCss = `
.af-sheet { background: #fff; border: 1px solid #dfe5ec; border-top: 6px solid #0A8F94; border-radius: 10px; padding: 32px 36px; color: #1c2530; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.af-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; margin-bottom: 22px; border-bottom: 1px solid #dfe5ec; }
.af-head-left { display: flex; align-items: center; gap: 12px; }
.af-head img { height: 56px; width: auto; }
.af-head h1 { margin: 0; font-size: 1.6rem; font-weight: 800; color: #0A8F94; letter-spacing: .01em; }
.af-head p { margin: 2px 0 0; font-size: .78rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #5d6b7a; }
.af-roll { text-align: right; }
.af-roll span { display: block; font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #5d6b7a; }
.af-roll strong { font-size: 1.15rem; font-weight: 800; color: #1c2530; }
.af-info { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 24px; background: #E3FAFB; border: 1px solid #E3FAFB; border-radius: 8px; padding: 18px 22px; margin-bottom: 28px; }
.af-info div { display: flex; flex-direction: column; gap: 4px; }
.af-info span { font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #5d6b7a; }
.af-info strong { font-size: 1rem; font-weight: 700; color: #1c2530; }
.af-sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 48px; }
.af-sign span { flex: 1; padding-top: 6px; border-top: 1px solid #1c2530; text-align: center; font-size: .82rem; color: #5d6b7a; }
@media print {
  @page { size: A4; margin: 15mm; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body * { visibility: hidden; }
  .af-sheet, .af-sheet * { visibility: visible; }
  .af-sheet { position: absolute; left: 0; top: 0; width: 100%; border: 0; border-top: 6px solid #0A8F94; border-radius: 0; padding: 12px 0 0; }
}
`;

function AdmissionForm({ student, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6 print:static print:bg-white print:p-0">
      <style>{admissionCss}</style>
      <div className="w-full print:max-w-none" style={{ maxWidth: "210mm" }}>
        {/* A4_SCREEN */}
        <div className="mb-4 flex justify-end gap-2 print:hidden">
          <Button variant="quiet" onClick={onClose} className="px-4 py-2 text-sm">
            Close
          </Button>
          <Button onClick={() => window.print()} className="px-4 py-2 text-sm">
            Print
          </Button>
        </div>

        <article className="af-sheet mx-auto" style={{ width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
          <header className="af-head">
            <div className="af-head-left">
              <img
                src="/keen-logo.png"
                alt="KEEN Academy logo"
                style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
              />
              <div>
                <h1>KEEN Academy</h1>
                <p>Student Admission Form</p>
              </div>
            </div>
            <div className="af-roll">
              <span>Roll No.</span>
              <strong>{student.roll_no || "-"}</strong>
            </div>
          </header>

          <dl className="af-info">
            <div>
              <span>Full Name</span>
              <strong>{student.full_name || "-"}</strong>
            </div>
            <div>
              <span>Class</span>
              <strong>{(student.class_name || "-") + (student.section ? " " + student.section : "")}</strong>
            </div>
            <div>
              <span>Date of Birth</span>
              <strong>{student.date_of_birth || "-"}</strong>
            </div>
            <div>
              <span>CNIC / B-Form</span>
              <strong>{student.cnic_or_bform || "-"}</strong>
            </div>
            <div>
              <span>Phone Number</span>
              <strong>{student.phone_number || "-"}</strong>
            </div>
            <div>
              <span>Enrollment Date</span>
              <strong>{student.created_at ? String(student.created_at).slice(0, 10) : "-"}</strong>
            </div>
          </dl>

          <div className="af-sign">
            <span>Parent / Guardian Signature</span>
            <span>Admin Signature</span>
          </div>
        </article>
      </div>
    </div>
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
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" | "active" | "unclaimed"
  const [refreshing, setRefreshing] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({ ...EMPTY });
  const [initial, setInitial] = useState({ ...EMPTY });

  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [actingId, setActingId] = useState(null);

  const [credentials, setCredentials] = useState(null);

  const [printStudent, setPrintStudent] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
    }

    setPageError("");

    try {
      const [
        rosterData,
        pendingData,
        classData,
      ] = await Promise.all([
        api.listStudentManage(),
        api.pendingStudents(),
        api.listSchoolClasses(),
      ]);

      setRoster(asList(rosterData));
      setPending(asList(pendingData));
      setClasses(asList(classData));
    } catch (err) {
      setPageError(
        err?.message || "Unable to load student data."
      );
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

  const isEdit = editing !== null;

  const ready =
    form.roll_no.trim() !== "" &&
    form.full_name.trim() !== "" &&
    form.class_name.trim() !== "" &&
    (isEdit || form.password.trim().length >= 8);

  const dirty =
    JSON.stringify(form) !== JSON.stringify(initial);

  function pickClass(e) {
    const value = e.target.value;

    const c = classes.find(
      (x) => String(x.id) === value
    );

    setForm((f) => ({
      ...f,
      school_class: value,
      class_name: c
        ? c.name
        : f.class_name,
      section: c
        ? c.section || ""
        : f.section,
    }));
  }

  function openAdd() {
    setForm({ ...EMPTY });
    setInitial({ ...EMPTY });
    setEditing(null);
    setFormError("");
    setShowPassword(false);
    setOpen(true);
  }

  function openEdit(s) {
    const start = fromEntry(s);

    setForm(start);
    setInitial({ ...start });
    setEditing(s);
    setFormError("");
    setShowPassword(false);
    setOpen(true);
  }

  function closeNow() {
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY });
    setInitial({ ...EMPTY });
    setFormError("");
    setShowPassword(false);
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

  function closeCredentials() {
    setCredentials(null);
  }

  async function submit() {
    if (!ready || busy) {
      return;
    }

    const rollNo = form.roll_no.trim();
    const fullName = form.full_name.trim();
    const className = form.class_name.trim();
    const phone = form.phone_number.trim();
    const cnic = form.cnic_or_bform.trim();
    const password = form.password.trim();

    if (!rollNo || !fullName || !className) {
      setFormError(
        "Roll number, full name, and class name are required."
      );
      return;
    }

    if (!isEdit && password.length < 8) {
      setFormError(
        "Password must contain at least 8 characters."
      );
      return;
    }

    if (isEdit && password && password.length < 8) {
      setFormError(
        "New password must contain at least 8 characters."
      );
      return;
    }

    if (
      phone &&
      phone.replace(/\D/g, "").length < 10
    ) {
      setFormError(
        "Please enter a valid phone number."
      );
      return;
    }

    if (
      cnic &&
      !/^\d{5}-?\d{7}-?\d$/.test(cnic)
    ) {
      setFormError(
        "CNIC / B-form format looks invalid."
      );
      return;
    }

    setBusy(true);
    setFormError("");
    setNotice("");

    const payload = {
      roll_no: rollNo,
      full_name: fullName,
      class_name: className,
      section: form.section.trim(),
      school_class:
        form.school_class === ""
          ? null
          : Number(form.school_class),
      date_of_birth: nullable(
        form.date_of_birth
      ),
      cnic_or_bform: cnic,
      phone_number: phone,
    };

    const passwordWasSet = password.length > 0;

    if (!isEdit) {
      payload.password = password;
    } else if (passwordWasSet) {
      payload.password = password;
    }

    try {
      if (isEdit) {
        const updated =
          await api.updateStudentRoster(
            editing.id,
            payload
          );

        setRoster((list) =>
          list.map((item) =>
            item.id === editing.id
              ? updated
              : item
          )
        );

        setNotice(
          "Saved changes for " +
            updated.full_name +
            "."
        );

        closeNow();

        if (passwordWasSet) {
          setCredentials({
            full_name: updated.full_name,
            username: updated.username,
            password: payload.password,
            phone_number:
              updated.phone_number ||
              payload.phone_number,
          });
        }
      } else {
        const result =
          await api.enrollStudent(payload);

        await load(true);

        setNotice(
          payload.full_name +
            " was added to the roster."
        );

        closeNow();

        setCredentials({
          full_name:
            result?.full_name ||
            payload.full_name,
          username: result?.username,
          password: payload.password,
          phone_number:
            result?.phone_number ||
            payload.phone_number,
        });
      }
    } catch (err) {
      setFormError(
        err?.message ||
          "Unable to save the student."
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(s) {
    if (
      !window.confirm(
        "Delete " +
          s.full_name +
          " (" +
          s.roll_no +
          ")? This can't be undone."
      )
    ) {
      return;
    }

    setPageError("");
    setNotice("");
    setDeletingId(s.id);

    try {
      await api.deleteStudentRoster(s.id);

      setRoster((list) =>
        list.filter(
          (item) => item.id !== s.id
        )
      );

      setNotice(
        s.full_name + " was deleted."
      );
    } catch (err) {
      setPageError(
        err?.message ||
          "Unable to delete the student."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function approve(u) {
    const name =
      u.first_name || u.username;

    setPageError("");
    setNotice("");
    setActingId(u.id);

    try {
      await api.approveStudent(u.id);

      await load(true);

      setNotice(
        name +
          " was approved and can now sign in."
      );
    } catch (err) {
      setPageError(
        err?.message ||
          "Unable to approve this signup."
      );
    } finally {
      setActingId(null);
    }
  }

  async function reject(u) {
    const name =
      u.first_name || u.username;

    if (
      !window.confirm(
        "Reject the signup from " +
          name +
          "?"
      )
    ) {
      return;
    }

    setPageError("");
    setNotice("");
    setActingId(u.id);

    try {
      await api.rejectStudent(u.id);

      await load(true);

      setNotice(
        "Signup from " +
          name +
          " was rejected."
      );
    } catch (err) {
      setPageError(
        err?.message ||
          "Unable to reject this signup."
      );
    } finally {
      setActingId(null);
    }
  }

  async function refresh() {
    if (refreshing) return;

    setRefreshing(true);
    setPageError("");

    try {
      await load(true);
      setNotice("Student data refreshed.");
    } catch (err) {
      setPageError(
        err?.message ||
          "Unable to refresh student data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const count = roster.length;

  const activeCount = roster.filter(
    (student) => student.is_claimed
  ).length;

  const unclaimedCount =
    count - activeCount;

  function goToRosterWithStatus(value) {
    setTab("roster");
    setStatusFilter((current) =>
      current === value ? "" : value
    );
  }

  const filteredRoster = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return roster.filter((student) => {
      const matchesSearch =
        !query ||
        [
          student.full_name,
          student.roll_no,
          student.class_name,
          student.section,
          student.phone_number,
          student.cnic_or_bform,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          );

      const matchesClass =
        !classFilter ||
        String(
          student.school_class || ""
        ) === classFilter ||
        classLabel(student)
          .toLowerCase() ===
          classFilter.toLowerCase();

      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" &&
          student.is_claimed) ||
        (statusFilter === "unclaimed" &&
          !student.is_claimed);

      return (
        matchesSearch &&
        matchesClass &&
        matchesStatus
      );
    });
  }, [
    roster,
    search,
    classFilter,
    statusFilter,
  ]);

  const subtitle =
    count +
    " student" +
    (count === 1 ? "" : "s") +
    " on the roll" +
    (pending.length
      ? " - " +
        pending.length +
        " awaiting approval"
      : "");

  function clearRosterFilters() {
    setSearch("");
    setClassFilter("");
    setStatusFilter("");
  }

  return (
    <AppShell
      badge="Enrolment"
      title="Students Management"
      subtitle={subtitle}
      action={
        <AddButton onClick={openAdd}>
          + Add New Student
        </AddButton>
      }
    >
      {/* Tabs + refresh */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex shrink-0 flex-wrap gap-2">
          <TabButton
            active={tab === "roster"}
            onClick={() =>
              setTab("roster")
            }
          >
            Roster ({count})
          </TabButton>

          <TabButton
            active={tab === "pending"}
            onClick={() =>
              setTab("pending")
            }
          >
            Pending approvals (
            {pending.length})
          </TabButton>
        </div>

        <Button
          variant="quiet"
          onClick={refresh}
          disabled={
            refreshing || loading
          }
          className="w-full px-4 py-2.5 text-sm sm:w-fit"
        >
          {refreshing
            ? "Refreshing..."
            : "↻ Refresh"}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() =>
            goToRosterWithStatus("")
          }
          className={
            "rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 " +
            (statusFilter === ""
              ? "border-keen-charcoal ring-2 ring-keen-charcoal/20"
              : "border-keen-border")
          }
        >
          <div className="text-xs font-bold uppercase tracking-wider text-keen-muted">
            Total students
          </div>

          <div className="mt-1 text-2xl font-extrabold text-keen-charcoal">
            {count}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            goToRosterWithStatus("active")
          }
          className={
            "rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 " +
            (statusFilter === "active"
              ? "border-emerald-600 ring-2 ring-emerald-600/20"
              : "border-keen-border")
          }
        >
          <div className="text-xs font-bold uppercase tracking-wider text-keen-muted">
            Active accounts
          </div>

          <div className="mt-1 text-2xl font-extrabold text-emerald-700">
            {activeCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            goToRosterWithStatus("unclaimed")
          }
          className={
            "rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 " +
            (statusFilter === "unclaimed"
              ? "border-amber-600 ring-2 ring-amber-600/20"
              : "border-keen-border")
          }
        >
          <div className="text-xs font-bold uppercase tracking-wider text-keen-muted">
            Awaiting signup
          </div>

          <div className="mt-1 text-2xl font-extrabold text-amber-700">
            {unclaimedCount}
          </div>
        </button>
      </div>

      {/* Notifications */}
      <div className="space-y-3">
        <Notice>{pageError}</Notice>

        <Notice tone="success">
          {notice}
        </Notice>
      </div>

      {tab === "roster" ? (
        <>
          {/* Search / filter bar */}
          <div className="rounded-2xl border border-keen-border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-keen-muted">
                  ⌕
                </span>

                <input
                  className={
                    INPUT_CLS + " pl-9"
                  }
                  placeholder="Search by name, roll no, class, phone..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  aria-label="Search students"
                />
              </div>

              <select
                className={
                  INPUT_CLS + " lg:w-64"
                }
                value={classFilter}
                onChange={(e) =>
                  setClassFilter(
                    e.target.value
                  )
                }
                aria-label="Filter by class"
              >
                <option value="">
                  All classes
                </option>

                {classes.map((c) => (
                  <option
                    key={c.id}
                    value={String(c.id)}
                  >
                    {c.name}
                    {c.section
                      ? " " + c.section
                      : ""}
                  </option>
                ))}
              </select>

              <select
                className={
                  INPUT_CLS + " lg:w-48"
                }
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value
                  )
                }
                aria-label="Filter by account status"
              >
                <option value="">
                  All accounts
                </option>
                <option value="active">
                  Active only
                </option>
                <option value="unclaimed">
                  Awaiting signup only
                </option>
              </select>

              {(search ||
                classFilter ||
                statusFilter) && (
                <Button
                  variant="quiet"
                  onClick={
                    clearRosterFilters
                  }
                  className="w-full px-4 py-2.5 text-sm sm:w-auto"
                >
                  Clear
                </Button>
              )}
            </div>

            {!loading && (
              <div className="mt-3 text-xs font-semibold text-keen-muted">
                Showing{" "}
                {filteredRoster.length}{" "}
                of {count} students
              </div>
            )}
          </div>

          {/* Roster */}
          <div className="min-w-0 overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
            {loading ? (
              <div className="p-10 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-keen-charcoal" />

                <p className="mt-3 text-sm font-medium text-keen-muted">
                  Loading students...
                </p>
              </div>
            ) : filteredRoster.length ===
              0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                  {count === 0
                    ? "👨‍🎓"
                    : "⌕"}
                </div>

                <p className="mt-4 text-base font-bold text-keen-charcoal">
                  {count === 0
                    ? "No students yet"
                    : "No matching students"}
                </p>

                <p className="mt-1 text-sm text-keen-muted">
                  {count === 0
                    ? 'Click "Add New Student" to add the first one.'
                    : "Try a different search term or clear the filters."}
                </p>

                {count > 0 &&
                  (search ||
                    classFilter ||
                    statusFilter) && (
                    <button
                      type="button"
                      onClick={
                        clearRosterFilters
                      }
                      className="mt-4 text-sm font-bold text-keen-charcoal underline underline-offset-4"
                    >
                      Clear filters
                    </button>
                  )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[850px] w-full text-left text-sm">
                  <thead>
                    <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white">
                      <th className="px-4 py-3 sm:px-5 sm:py-4">
                        ID
                      </th>

                      <th className="px-4 py-3 sm:px-5 sm:py-4">
                        Student
                      </th>

                      <th className="px-4 py-3 sm:px-5 sm:py-4">
                        Class
                      </th>

                      <th className="px-4 py-3 sm:px-5 sm:py-4">
                        Account
                      </th>

                      <th className="px-4 py-3 sm:px-5 sm:py-4">
                        Source
                      </th>

                      <th className="px-4 py-3 sm:px-5 sm:py-4">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRoster.map(
                      (s) => (
                        <tr
                          key={s.id}
                          className="border-t border-keen-border transition-colors hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 sm:px-5 sm:py-4">
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-keen-muted">
                              #{s.id}
                            </span>
                          </td>

                          <td className="px-4 py-3 sm:px-5 sm:py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar
                                text={
                                  s.full_name
                                }
                              />

                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-keen-charcoal sm:text-base">
                                  {s.full_name ||
                                    "-"}
                                </div>

                                <div className="whitespace-nowrap font-mono text-sm text-keen-muted">
                                  {s.roll_no ||
                                    "-"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 sm:px-5 sm:py-4">
                            <span
                              className={
                                "whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold " +
                                toneFor(
                                  classLabel(
                                    s
                                  )
                                )
                              }
                            >
                              {classLabel(s)}
                            </span>
                          </td>

                          <td className="px-4 py-3 sm:px-5 sm:py-4">
                            {s.is_claimed ? (
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Not signed up
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-keen-charcoal">
                            <span className="whitespace-nowrap">
                              {s.source ===
                              "self"
                                ? "Self signup"
                                : "Admin"}
                            </span>
                          </td>

                          <td className="px-4 py-3 sm:px-5 sm:py-4">
                            <div className="flex shrink-0 gap-2">
                              <EditButton
                                onClick={() =>
                                  openEdit(s)
                                }
                              />

                              <DeleteButton
                                onClick={() =>
                                  remove(s)
                                }
                                busy={
                                  deletingId ===
                                  s.id
                                }
                              />

                              <Button
                                variant="quiet"
                                onClick={() =>
                                  setPrintStudent(s)
                                }
                                className="px-3 py-1.5 text-xs"
                              >
                                Print
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Pending approvals */
        <div className="min-w-0 overflow-hidden rounded-2xl border border-keen-border bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-keen-charcoal" />

              <p className="mt-3 text-sm font-medium text-keen-muted">
                Loading pending signups...
              </p>
            </div>
          ) : pending.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl">
                ✓
              </div>

              <p className="mt-4 text-base font-bold text-keen-charcoal">
                No pending signups
              </p>

              <p className="mt-1 text-sm text-keen-muted">
                New student signups that
                need approval will appear
                here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[850px] w-full text-left text-sm">
                <thead>
                  <tr className="bg-keen-charcoal text-xs font-extrabold uppercase tracking-wider text-white">
                    <th className="px-4 py-3 sm:px-5 sm:py-4">
                      ID
                    </th>

                    <th className="px-4 py-3 sm:px-5 sm:py-4">
                      Student
                    </th>

                    <th className="px-4 py-3 sm:px-5 sm:py-4">
                      Roll No
                    </th>

                    <th className="px-4 py-3 sm:px-5 sm:py-4">
                      Class
                    </th>

                    <th className="px-4 py-3 sm:px-5 sm:py-4">
                      Requested
                    </th>

                    <th className="px-4 py-3 sm:px-5 sm:py-4">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {pending.map((u) => {
                    const name =
                      u.first_name ||
                      u.username ||
                      "Student";

                    return (
                      <tr
                        key={u.id}
                        className="border-t border-keen-border transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 sm:px-5 sm:py-4">
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-keen-muted">
                            #{u.id}
                          </span>
                        </td>

                        <td className="px-4 py-3 sm:px-5 sm:py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar
                              text={name}
                            />

                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-keen-charcoal sm:text-base">
                                {name}
                              </div>

                              <div className="text-sm text-keen-muted">
                                {u.username ||
                                  "-"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-keen-charcoal">
                          {u.roll_no || "-"}
                        </td>

                        <td className="px-4 py-3 sm:px-5 sm:py-4">
                          <span
                            className={
                              "whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold " +
                              toneFor(
                                classLabel(
                                  u
                                )
                              )
                            }
                          >
                            {classLabel(u)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-keen-charcoal">
                          {prettyDate(
                            u.date_joined
                          )}
                        </td>

                        <td className="px-4 py-3 sm:px-5 sm:py-4">
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={
                                actingId ===
                                u.id
                              }
                              onClick={() =>
                                approve(u)
                              }
                              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              ✓ Approve
                            </button>

                            <button
                              type="button"
                              disabled={
                                actingId ===
                                u.id
                              }
                              onClick={() =>
                                reject(u)
                              }
                              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={open}
        wide
        title={
          isEdit
            ? "Edit Student"
            : "Add New Student"
        }
        subtitle={
          isEdit
            ? "Update the student's details below"
            : "Fill in the student's details below"
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
                : "Add Student"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            <FormItem
              label="Roll No"
              required
              hint={
                isEdit &&
                editing.is_claimed
                  ? "Locked because the student already has an account."
                  : ""
              }
            >
              <input
                className={INPUT_CLS + " w-full"}
                placeholder="KEEN-104"
                value={form.roll_no}
                onChange={update(
                  "roll_no"
                )}
                disabled={
                  isEdit &&
                  editing.is_claimed
                }
                autoComplete="off"
              />
            </FormItem>

            <FormItem
              label="Full name"
              required
            >
              <input
                className={INPUT_CLS + " w-full"}
                placeholder="Full name"
                value={form.full_name}
                onChange={update(
                  "full_name"
                )}
                autoComplete="name"
              />
            </FormItem>

            <FormItem
              label="Class"
              hint="Pick a class to fill in the name and section below."
            >
              <select
                className={INPUT_CLS + " w-full"}
                value={form.school_class}
                onChange={pickClass}
              >
                <option value="">
                  Not linked
                </option>

                {classes.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {c.name}
                    {c.section
                      ? " " +
                        c.section
                      : ""}
                  </option>
                ))}
              </select>
            </FormItem>

            <FormItem
              label="Class name"
              required
            >
              <input
                className={
                  INPUT_CLS +
                  (form.school_class
                    ? " cursor-not-allowed bg-slate-100 text-slate-500"
                    : "")
                }
                placeholder="e.g. 9th"
                value={form.class_name}
                onChange={update(
                  "class_name"
                )}
                disabled={
                  !!form.school_class
                }
              />
            </FormItem>

            <FormItem label="Section">
              <input
                className={INPUT_CLS + " w-full"}
                placeholder="e.g. A"
                value={form.section}
                onChange={update(
                  "section"
                )}
              />
            </FormItem>

            <FormItem label="Date of birth">
              <input
                type="date"
                className={INPUT_CLS + " w-full"}
                value={
                  form.date_of_birth
                }
                onChange={update(
                  "date_of_birth"
                )}
              />
            </FormItem>

            <FormItem label="CNIC / B-form">
              <input
                className={INPUT_CLS + " w-full"}
                placeholder="XXXXX-XXXXXXX-X"
                value={
                  form.cnic_or_bform
                }
                onChange={update(
                  "cnic_or_bform"
                )}
                inputMode="numeric"
              />
            </FormItem>

            <FormItem
              label="Phone number"
              hint="Used to send login details on WhatsApp."
            >
              <input
                className={INPUT_CLS + " w-full"}
                placeholder="e.g. 923001234567"
                value={
                  form.phone_number
                }
                onChange={update(
                  "phone_number"
                )}
                inputMode="tel"
                autoComplete="tel"
              />
            </FormItem>

            {isEdit ? (
              <FormItem
                label="Reset password"
                wide
                hint="Leave blank to keep their current password. Type a new one (min 8 characters) to change it."
              >
                <div className="relative">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    className={
                      INPUT_CLS +
                      " pr-24"
                    }
                    placeholder="Leave blank to keep unchanged"
                    value={
                      form.password
                    }
                    onChange={update(
                      "password"
                    )}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) =>
                          !value
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-bold text-keen-muted hover:bg-slate-100 hover:text-keen-charcoal"
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>
              </FormItem>
            ) : (
              <FormItem
                label="Password"
                required
                wide
                hint="At least 8 characters. The student will use this to log in."
              >
                <div className="relative">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    className={
                      INPUT_CLS +
                      " pr-24"
                    }
                    placeholder="Set a login password"
                    value={
                      form.password
                    }
                    onChange={update(
                      "password"
                    )}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) =>
                          !value
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-bold text-keen-muted hover:bg-slate-100 hover:text-keen-charcoal"
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>
              </FormItem>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-keen-muted">
            Fields marked{" "}
            <span className="font-bold text-keen-charcoal">
              *
            </span>{" "}
            are required. Passwords are only
            shown here when you choose to
            reveal them.
          </div>

          <Notice>{formError}</Notice>
        </div>
      </Modal>

      {printStudent && (
        <AdmissionForm
          student={printStudent}
          onClose={() => setPrintStudent(null)}
        />
      )}

      {/* Credentials modal */}
      <Modal
        open={!!credentials}
        title="Student account ready"
        subtitle="Send the login details now, or copy them manually."
        onClose={closeCredentials}
        footer={
          <>
            <Button
              variant="quiet"
              onClick={
                closeCredentials
              }
              className="w-full px-4 py-2.5 text-sm sm:w-auto"
            >
              Close
            </Button>

            {credentials && (
                <a
                href={buildWhatsappLink(
                  credentials
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5b]"
              >
                <WhatsAppIcon />
                Send on WhatsApp
              </a>
            )}
          </>
        }
      >
        {credentials && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-bold text-emerald-800">
                {credentials.full_name}
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                The account is ready.
              </p>
            </div>

            <div className="rounded-lg border border-keen-border bg-slate-50 p-4 font-mono text-sm">
              <div>
                <span className="font-bold">
                  Username:
                </span>{" "}
                {credentials.username ||
                  "-"}
              </div>

              <div className="mt-2">
                <span className="font-bold">
                  Password:
                </span>{" "}
                {credentials.password ||
                  "-"}
              </div>
            </div>

            {!credentials.phone_number && (
              <Notice>
                No phone number was entered.
                The WhatsApp button will open
                a blank chat with the message
                pre-filled, so you'll need to
                choose the contact manually.
              </Notice>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
