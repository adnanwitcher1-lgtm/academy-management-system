import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, downloadPdf, pdfPaths } from "../lib/api";
import { AppShell, Button, Notice, Panel } from "../components/ui";

/* One student's whole record in one place: details, attendance, fees and results.
   - Admin opens it from the Students list  (/hod/students/:rosterId)
   - A student sees only their own          (/student/profile, `self`) */

const money = (v) => "Rs " + Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });

const fmtDate = (d) => {
  if (!d) return "-";
  const x = new Date(String(d).length <= 10 ? d + "T00:00:00" : d);
  return isNaN(x) ? String(d) : x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const monthLabel = (ym) => {
  const [y, m] = String(ym).split("-");
  const x = new Date(Number(y), Number(m) - 1, 1);
  return isNaN(x) ? ym : x.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

const STATUS_STYLE = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  late: "bg-amber-50 text-amber-700 border-amber-200",
  absent: "bg-red-50 text-red-700 border-red-200",
  leave: "bg-sky-50 text-sky-700 border-sky-200",
  holiday: "bg-violet-50 text-violet-700 border-violet-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  carried: "bg-slate-100 text-slate-600 border-slate-200",
};

function Chip({ value }) {
  const key = String(value || "").toLowerCase();
  return (
    <span
      className={
        "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase " +
        (STATUS_STYLE[key] || "bg-slate-50 text-slate-600 border-slate-200")
      }
    >
      {key === "carried" ? "Carried forward" : key}
    </span>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-keen-muted">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-keen-charcoal">{value || "-"}</p>
    </div>
  );
}

function Tile({ label, value, tone = "" }) {
  return (
    <div className="rounded-xl border border-keen-border bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-keen-muted">{label}</p>
      <p className={"mt-1 text-xl font-extrabold text-keen-charcoal " + tone}>{value}</p>
    </div>
  );
}

function Table({ head, children, empty }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-keen-border text-[11px] uppercase text-keen-muted">
            {head.map((h) => (
              <th key={h.label ?? h} className={"px-4 py-2.5 " + (h.right ? "text-right" : "")}>
                {h.label ?? h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export default function StudentProfile({ self = false }) {
  const { rosterId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("overview");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(self ? await api.myOverview() : await api.studentOverview(rosterId));
    } catch (e) {
      setError(e.message || "Could not load this profile.");
    }
  }, [self, rosterId]);

  useEffect(() => {
    load();
  }, [load]);

  const pdf = async (key, path, name, open = false) => {
    setBusy(key);
    setError("");
    try {
      await downloadPdf(path, name, { open });
    } catch (e) {
      setError(e.message || "Could not create the PDF.");
    } finally {
      setBusy("");
    }
  };

  const back = self ? (
    <Link to="/student" className="text-xs font-bold text-keen-cyanDark hover:underline">
      ← Back to dashboard
    </Link>
  ) : (
    <Link to="/hod/students" className="text-xs font-bold text-keen-cyanDark hover:underline">
      ← Back to students
    </Link>
  );

  if (error && !data) {
    return (
      <AppShell title="Student profile" action={back}>
        <Notice>{error}</Notice>
      </AppShell>
    );
  }
  if (!data) {
    return (
      <AppShell title="Student profile" action={back}>
        <p className="text-sm text-keen-muted">Loading profile...</p>
      </AppShell>
    );
  }

  const s = data.student;
  const att = data.attendance.summary;
  const fs = data.fee_summary;
  const profilePdf = self ? pdfPaths.myProfile() : pdfPaths.studentProfile(s.roster_id);
  const fileName = `student-profile-${s.roll_no}.pdf`;
  const tabs = [
    ["overview", "Overview"],
    ["attendance", "Attendance"],
    ["fees", "Fees"],
    ["results", "Results"],
  ];

  return (
    <AppShell
      title={s.full_name}
      subtitle={`Roll no ${s.roll_no}${s.class_label ? " · " + s.class_label : ""}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {back}
          <Button
            variant="secondary"
            disabled={busy === "print"}
            onClick={() => pdf("print", profilePdf, fileName, true)}
          >
            {busy === "print" ? "Opening..." : "Print"}
          </Button>
          <Button disabled={busy === "pdf"} onClick={() => pdf("pdf", profilePdf, fileName)}>
            {busy === "pdf" ? "Preparing..." : "Download PDF"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Notice>{error}</Notice>

        <div className="rounded-2xl border border-keen-border bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            <Detail label="Name" value={s.full_name} />
            <Detail label="Father name" value={s.father_name} />
            <Detail label="Roll no" value={s.roll_no} />
            <Detail label="Class" value={s.class_label} />
            <Detail label="Phone" value={s.phone_number} />
            <Detail label="Date of birth" value={s.date_of_birth ? fmtDate(s.date_of_birth) : ""} />
            <Detail label="B-Form / CNIC" value={s.cnic_or_bform} />
            <Detail label="Monthly fee" value={s.monthly_fee ? money(s.monthly_fee) : "Class fee"} />
            <Detail label="Enrolled on" value={fmtDate(s.enrolled_on)} />
            <Detail label="Login username" value={s.username} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile
            label="Attendance"
            value={att.percent != null ? Math.round(att.percent) + "%" : "-"}
            tone={att.percent != null && att.percent < 75 ? "text-red-600" : ""}
          />
          <Tile label="Fee paid" value={money(fs.paid)} tone="text-emerald-600" />
          <Tile label="Fee pending" value={money(fs.pending)} tone={Number(fs.pending) > 0 ? "text-red-600" : ""} />
          <Tile
            label="Last result"
            value={data.results[0] ? Math.round(data.results[0].percentage) + "% " + data.results[0].grade : "-"}
          />
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-keen-border">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition " +
                (tab === key
                  ? "border-keen-cyanDark text-keen-charcoal"
                  : "border-transparent text-keen-muted hover:text-keen-charcoal")
              }
            >
              {label}
            </button>
          ))}
        </div>

        {(tab === "overview" || tab === "attendance") && (
          <Panel title="Attendance">
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
              <Tile label="Present" value={att.present} />
              <Tile label="Late" value={att.late} />
              <Tile label="Absent" value={att.absent} />
              <Tile label="Leave" value={att.leave} />
              <Tile label="Holidays" value={att.holiday ?? 0} />
            </div>
            {tab === "attendance" && (
              <>
                <Table
                  head={["Month", "Present", "Late", "Absent", "Leave", "Attendance"]}
                  empty={
                    data.attendance.monthly.length === 0 && (
                      <p className="p-6 text-center text-sm text-keen-muted">No attendance marked yet.</p>
                    )
                  }
                >
                  {data.attendance.monthly.map((m) => (
                    <tr key={m.month}>
                      <td className="px-4 py-2.5 font-semibold">{monthLabel(m.month)}</td>
                      <td className="px-4 py-2.5">{m.present}</td>
                      <td className="px-4 py-2.5">{m.late}</td>
                      <td className="px-4 py-2.5">{m.absent}</td>
                      <td className="px-4 py-2.5">{m.leave}</td>
                      <td className="px-4 py-2.5 font-bold">{m.percent != null ? Math.round(m.percent) + "%" : "-"}</td>
                    </tr>
                  ))}
                </Table>
                <p className="border-t border-keen-border px-4 pt-3 text-xs font-bold text-keen-muted">Recent days</p>
                <Table head={["Date", "Day", "Status", "Note"]}>
                  {data.attendance.records.slice(0, 40).map((r) => (
                    <tr key={r.date}>
                      <td className="px-4 py-2">{fmtDate(r.date)}</td>
                      <td className="px-4 py-2">{r.weekday}</td>
                      <td className="px-4 py-2">
                        <Chip value={r.status} />
                      </td>
                      <td className="px-4 py-2 text-keen-muted">{r.note || ""}</td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
          </Panel>
        )}

        {(tab === "overview" || tab === "fees") && (
          <Panel title="Fee record">
            <Table
              head={["Challan", "Month", { label: "Total", right: true }, "Due", "Status", "Received by", ""]}
              empty={
                data.fees.length === 0 && (
                  <p className="p-6 text-center text-sm text-keen-muted">No fee challans yet.</p>
                )
              }
            >
              {(tab === "overview" ? data.fees.slice(0, 5) : data.fees).map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2.5 font-mono text-xs">{f.challan_no}</td>
                  <td className="px-4 py-2.5">{f.month || "-"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{money(f.total)}</td>
                  <td className="px-4 py-2.5">{fmtDate(f.due_date)}</td>
                  <td className="px-4 py-2.5">
                    <Chip value={f.status} />
                    {f.status === "paid" && f.paid_on && (
                      <span className="ml-2 text-[11px] text-keen-muted">{fmtDate(f.paid_on)}</span>
                    )}
                    {Number(f.fine) > 0 && (
                      <span className="ml-2 text-[11px] font-semibold text-red-600">fine {money(f.fine)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{f.received_by_name || "-"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {f.status !== "carried" && (
                      <button
                        type="button"
                        disabled={busy === "slip" + f.id}
                        onClick={() => pdf("slip" + f.id, pdfPaths.feeSlip(f.id), `fee-slip-${f.challan_no}.pdf`)}
                        className="text-xs font-bold text-keen-cyanDark hover:underline disabled:opacity-50"
                      >
                        {busy === "slip" + f.id ? "..." : "PDF"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
        )}

        {(tab === "overview" || tab === "results") && (
          <Panel title="Results">
            {data.results.length === 0 && (
              <p className="p-6 text-center text-sm text-keen-muted">No exam results yet.</p>
            )}
            {data.results.map((b) => (
              <div key={b.exam_id} className="border-b border-slate-100 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-keen-charcoal">{b.exam_name}</p>
                    <p className="text-xs text-keen-muted">
                      {fmtDate(b.exam_date)} · {b.obtained}/{b.total} · {b.percentage}% · Grade {b.grade}
                    </p>
                  </div>
                  {s.user_id && (
                    <Button
                      variant="secondary"
                      disabled={busy === "rc" + b.exam_id}
                      onClick={() =>
                        pdf("rc" + b.exam_id, pdfPaths.reportCard(b.exam_id, s.user_id), `result-card-${s.roll_no}-${b.exam_id}.pdf`)
                      }
                    >
                      {busy === "rc" + b.exam_id ? "Preparing..." : "Result card PDF"}
                    </Button>
                  )}
                </div>
                {tab === "results" && (
                  <Table head={["Subject", "Obtained", "Total", "%", "Grade"]}>
                    {b.rows.map((r) => (
                      <tr key={r.subject}>
                        <td className="px-4 py-2 font-semibold">{r.subject}</td>
                        <td className="px-4 py-2">{r.obtained}</td>
                        <td className="px-4 py-2">{r.total}</td>
                        <td className="px-4 py-2">{r.percentage}%</td>
                        <td className="px-4 py-2 font-bold">{r.grade}</td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>
            ))}
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
