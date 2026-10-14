import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button, Field, Logo, Notice } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const ready = form.username && form.password;

  async function submit() {
    if (!ready || busy) return;
    setError("");
    setBusy(true);
    try {
      const session = await login(form.username.trim(), form.password);
      const dest = session.role === "student" ? "/student" : session.role === "teacher" ? "/teacher" : "/hod";
      navigate(dest, { replace: true });
    } catch (err) {
      setError(
        err.status === 401
          ? "Wrong username or password. If you just signed up, your account still needs admin approval."
          : err.message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden lg:flex flex-col justify-between bg-keen-charcoal p-12 overflow-hidden">
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(0,217,245,0.30), transparent 70%)" }}
        />
        <Logo size={72} className="border-2 border-keen-cyan relative" />

        <div className="relative max-w-sm">
          <h2 className="text-4xl font-black leading-tight text-white tracking-tight">
            Evening classes, daylight-clear records.
          </h2>
          <p className="mt-4 text-sm font-medium text-slate-300">
            Attendance, fees, results and enrolment for every Keen student — in one place.
          </p>
        </div>

        <p className="relative text-[10px] font-bold uppercase tracking-widest text-keen-cyan">
          Keep Education Ever Noble
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={48} />
            <div>
              <h1 className="font-extrabold text-xs tracking-wider text-keen-charcoal">
                KEEN EVENING
              </h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-keen-cyanDark">
                Keep Education Ever Noble
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-keen-charcoal">Sign in</h1>
          <p className="mt-1 text-xs text-keen-muted">
            Admin, teachers and students use the same door.
          </p>

          <div className="mt-6 space-y-4 rounded-2xl border border-keen-border bg-white p-6 shadow-sm">
            <Field
              label="Username"
              value={form.username}
              onChange={update("username")}
              autoComplete="username"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={update("password")}
              autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <Notice>{error}</Notice>
            <Button onClick={submit} disabled={!ready || busy} className="w-full py-2.5">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </div>

          <p className="mt-5 text-center text-[11px] font-medium text-keen-muted">
            New student?{" "}
            <Link to="/signup/student" className="text-keen-cyanDark font-bold">
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-center text-[11px] font-medium text-keen-muted">
            <Link to="/admin/login" className="text-keen-cyanDark font-bold">
              Admin sign in →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

