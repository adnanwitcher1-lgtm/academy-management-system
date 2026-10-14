import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button, Field, Logo, Notice } from "../components/ui";

const ADMIN_ROLES = ["hod", "admin", "staff"];

export default function AdminLogin() {
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
      if (!ADMIN_ROLES.includes(session.role)) {
        setError("This account doesn't have admin access. Use the regular sign-in page instead.");
        return;
      }
      navigate("/hod", { replace: true });
    } catch (err) {
      setError(err.status === 401 ? "Username or password is wrong." : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-keen-charcoal px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <Logo size={48} className="border-2 border-keen-cyan" />
          <div>
            <h1 className="font-extrabold text-xs tracking-wider text-white">KEEN EVENING</h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-keen-cyan">
              Admin access
            </p>
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white">Admin sign in</h1>
        <p className="mt-1 text-xs text-slate-400">
          Restricted to admin, HOD and staff accounts.
        </p>

        <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-keen-darkest p-6">
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

        <p className="mt-5 text-center text-[11px] font-medium text-slate-400">
          Not an admin? <Link to="/login" className="text-keen-cyan font-bold">Go to regular sign in</Link>
        </p>
      </div>
    </div>
  );
}

