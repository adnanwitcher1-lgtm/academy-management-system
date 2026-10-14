import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button, Field, Logo, Notice } from "../components/ui";

const EMPTY = {
  roll_no: "",
  full_name: "",
  class_name: "",
  section: "",
  activation_code: "",
  username: "",
  password: "",
};

export default function StudentSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const ready = form.roll_no && form.full_name && form.username && form.password.length >= 8;

  async function submit() {
    if (!ready || busy) return;
    setError("");
    setBusy(true);
    try {
      const payload = { ...form };
      const data = await api.studentSignup(payload);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm text-center">
          <Logo size={56} className="mx-auto mb-6" />
          <h1 className="text-2xl font-black tracking-tight text-keen-charcoal">
            {result.pending_approval ? "Signup submitted" : "Account created"}
          </h1>
          <p className="mt-3 text-sm text-keen-muted">{result.message}</p>
          <Button className="mt-6" onClick={() => navigate("/login")}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <Logo size={48} />
          <div>
            <h1 className="font-extrabold text-xs tracking-wider text-keen-charcoal">
              KEEN EVENING
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-keen-cyanDark">
              Student sign up
            </p>
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-keen-charcoal">
          Create your student account
        </h1>
        <p className="mt-1 text-xs text-keen-muted">
          If the admin already enrolled your Roll No., just confirm your name and set a
          username and password. Otherwise fill in your class as well.
        </p>

        <div className="mt-6 space-y-4 rounded-2xl border border-keen-border bg-white p-6 shadow-sm">
          <Field label="Roll No." value={form.roll_no} onChange={update("roll_no")} />
          <Field label="Full name" value={form.full_name} onChange={update("full_name")} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class (if new)" value={form.class_name} onChange={update("class_name")} />
            <Field label="Section" value={form.section} onChange={update("section")} />
          </div>
          <Field
            label="Activation code (if given by admin)"
            value={form.activation_code}
            onChange={update("activation_code")}
          />
          <Field label="Choose a username" value={form.username} onChange={update("username")} />
          <Field
            label="Choose a password (min 8 characters)"
            type="password"
            value={form.password}
            onChange={update("password")}
          />
          <Notice>{error}</Notice>
          <Button onClick={submit} disabled={!ready || busy} className="w-full py-2.5">
            {busy ? "Creating account…" : "Sign up"}
          </Button>
        </div>

        <p className="mt-5 text-center text-[11px] font-medium text-keen-muted">
          Already have an account? <Link to="/login" className="text-keen-cyanDark font-bold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

