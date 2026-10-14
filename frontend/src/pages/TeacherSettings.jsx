import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { AppShell } from "../components/ui";

const MAX_BIO = 240;
const titleCase = (s) =>
  (s || "").toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
const initialsOf = (name) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// Centre-crop to a square and shrink, so the stored image stays small.
function cropToDataUrl(file, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

export default function TeacherSettings() {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", bio: "", photo: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwOk, setPwOk] = useState("");

  const apply = useCallback((p) => {
    setSaved(p);
    setForm({
      full_name: p.full_name || p.username || "",
      email: p.email || "",
      phone: p.phone || "",
      bio: p.bio || "",
      photo: p.photo || "",
    });
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .getMyProfile()
      .then((p) => alive && apply(p))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [apply]);

  const dirty =
    !!saved &&
    (form.full_name !== (saved.full_name || saved.username || "") ||
      form.email !== (saved.email || "") ||
      form.phone !== (saved.phone || "") ||
      form.bio !== (saved.bio || "") ||
      form.photo !== (saved.photo || ""));

  const set = (key, value) => {
    setNotice("");
    setForm((f) => ({ ...f, [key]: value }));
  };

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setError("Please choose a PNG or JPG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("That image is larger than 5 MB.");
      return;
    }
    try {
      const url = await cropToDataUrl(file);
      setError("");
      set("photo", url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = { full_name: form.full_name, email: form.email, phone: form.phone, bio: form.bio };
      if (form.photo !== (saved.photo || "")) body.photo = form.photo;
      const res = await api.updateMyProfile(body);
      apply(res);
      setNotice("Your profile has been updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (saved) apply(saved);
    setError("");
    setNotice("");
  }

  async function toggle(key) {
    const next = !saved[key];
    setSaved((s) => ({ ...s, [key]: next }));
    setError("");
    setNotice("");
    try {
      await api.updateMyProfile({ [key]: next });
      setNotice("Preference saved.");
    } catch (e) {
      setSaved((s) => ({ ...s, [key]: !next }));
      setError(e.message);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError("");
    setPwOk("");
    if (pw.next.length < 8) return setPwError("The new password must be at least 8 characters.");
    if (pw.next !== pw.confirm) return setPwError("The new passwords do not match.");
    setPwBusy(true);
    try {
      await api.changeMyPassword({ current_password: pw.current, new_password: pw.next });
      setPw({ current: "", next: "", confirm: "" });
      setPwOpen(false);
      setPwOk("Password updated.");
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <AppShell title="Profile & preferences" subtitle="Manage your personal information and choose how you receive updates.">
      <style>{css}</style>

      <div className="st-wrap">
        {error && <div className="st-alert st-err">{error}</div>}
        {notice && <div className="st-alert st-ok">{notice}</div>}
        {pwOk && <div className="st-alert st-ok">{pwOk}</div>}

        {loading && <p className="st-muted">Loading...</p>}

        {saved && (
          <>
            {/* ---------- personal information ---------- */}
            <section className="st-card">
              <div className="st-head">
                <h3>Personal information</h3>
                <p>Update your photo and personal details.</p>
              </div>

              <div className="st-body">
                <div className="st-photo">
                  <div className="st-avatar-wrap">
                    {form.photo ? (
                      <img src={form.photo} alt="" className="st-avatar" />
                    ) : (
                      <div className="st-avatar st-avatar-initials">{initialsOf(form.full_name || saved.username)}</div>
                    )}
                    <button type="button" className="st-cam" onClick={() => fileRef.current?.click()} aria-label="Upload photo">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                        <circle cx="12" cy="13" r="3.5" />
                      </svg>
                    </button>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={onPick} />
                  </div>
                  <div>
                    <strong>Profile photo</strong>
                    <p>PNG or JPG, up to 5 MB.</p>
                    <div className="st-photo-actions">
                      <button type="button" className="st-link" onClick={() => fileRef.current?.click()}>
                        Upload new
                      </button>
                      {form.photo && (
                        <button type="button" className="st-link st-muted-link" onClick={() => set("photo", "")}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <label className="st-field">
                  Full name
                  <input type="text" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} maxLength={150} />
                </label>

                <div className="st-grid">
                  <label className="st-field">
                    Email address
                    <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </label>
                  <label className="st-field">
                    Phone number
                    <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} />
                  </label>
                </div>

                <div className="st-grid">
                  <label className="st-field">
                    Role
                    <input type="text" value={titleCase(saved.role) || "Teacher"} readOnly className="st-readonly" />
                  </label>
                  <label className="st-field">
                    Specialization
                    <input type="text" value={titleCase(saved.specialization) || "-"} readOnly className="st-readonly" />
                  </label>
                </div>

                <label className="st-field">
                  Bio
                  <textarea
                    rows={4}
                    value={form.bio}
                    maxLength={MAX_BIO}
                    placeholder="Tell students a little about yourself..."
                    onChange={(e) => set("bio", e.target.value)}
                  />
                  <span className="st-count">
                    {form.bio.length} / {MAX_BIO}
                  </span>
                </label>
              </div>

              <div className="st-foot">
                <button type="button" className="st-btn" onClick={cancel} disabled={!dirty || saving}>
                  Cancel
                </button>
                <button type="button" className="st-btn st-primary" onClick={save} disabled={!dirty || saving || !form.full_name.trim()}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </section>

            {/* ---------- notifications ---------- */}
            <section className="st-card">
              <div className="st-head">
                <h3>Notifications</h3>
                <p>Choose what you want to be notified about.</p>
              </div>
              <div className="st-toggles">
                <div className="st-toggle-row">
                  <div>
                    <strong>Email updates</strong>
                    <p>Weekly teaching summary</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={saved.email_updates}
                    className={"st-switch" + (saved.email_updates ? " on" : "")}
                    onClick={() => toggle("email_updates")}
                  >
                    <span />
                  </button>
                </div>
                <div className="st-toggle-row">
                  <div>
                    <strong>Class reminders</strong>
                    <p>Before every scheduled class</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={saved.class_reminders}
                    className={"st-switch" + (saved.class_reminders ? " on" : "")}
                    onClick={() => toggle("class_reminders")}
                  >
                    <span />
                  </button>
                </div>
              </div>
            </section>

            {/* ---------- password ---------- */}
            <section className="st-card">
              <div className="st-pw-head">
                <span className="st-lock">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 018 0v3" />
                  </svg>
                </span>
                <h3>Password &amp; security</h3>
                <p>Keep your account secure with a strong password.</p>
              </div>

              <div className="st-pw-body">
                <button type="button" className="st-pw-row" onClick={() => setPwOpen((v) => !v)} aria-expanded={pwOpen}>
                  <span>Change password</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: pwOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>

                {pwOpen && (
                  <form className="st-pw-form" onSubmit={changePassword}>
                    <label className="st-field">
                      Current password
                      <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
                    </label>
                    <div className="st-grid">
                      <label className="st-field">
                        New password
                        <input type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
                      </label>
                      <label className="st-field">
                        Confirm new password
                        <input type="password" autoComplete="new-password" minLength={8} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
                      </label>
                    </div>
                    {pwError && <div className="st-alert st-err" style={{ marginBottom: 0 }}>{pwError}</div>}
                    <div className="st-pw-actions">
                      <button type="button" className="st-btn" onClick={() => { setPwOpen(false); setPwError(""); }} disabled={pwBusy}>
                        Cancel
                      </button>
                      <button type="submit" className="st-btn st-primary" disabled={pwBusy}>
                        {pwBusy ? "Updating..." : "Update password"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

const css = `
.st-wrap { max-width: 860px; display: flex; flex-direction: column; gap: 22px; }
.st-muted { color: #94a0ad; font-size: 14px; }
.st-alert { padding: 10px 16px; border-radius: 10px; font-size: 14px; }
.st-err { background: #fdecea; color: #b3261e; }
.st-ok { background: #e6f4ea; color: #1e7e34; }

.st-card { background: #fff; border: 1px solid #e3e7ed; border-radius: 22px; box-shadow: 0 2px 12px rgba(28,37,48,.04); overflow: hidden; }
.st-head { padding: 24px 28px 18px; border-bottom: 1px solid #eef0f3; }
.st-head h3, .st-pw-head h3 { margin: 0; font-size: 21px; font-weight: 700; color: #1c2530; }
.st-head p, .st-pw-head p { margin: 4px 0 0; font-size: 14px; color: #5d6b7a; }
.st-body { display: flex; flex-direction: column; gap: 18px; padding: 24px 28px; }

.st-photo { display: flex; align-items: center; gap: 20px; }
.st-photo p { margin: 2px 0 8px; font-size: 14px; color: #5d6b7a; }
.st-photo strong { font-size: 17px; color: #1c2530; }
.st-avatar-wrap { position: relative; flex: none; }
.st-avatar { width: 104px; height: 104px; border-radius: 50%; object-fit: cover; display: block; }
.st-avatar-initials { display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800; color: #fff; background: linear-gradient(135deg, #17e0e4, #0aa5d3); }
.st-cam { position: absolute; right: -2px; bottom: -2px; width: 36px; height: 36px; border-radius: 50%; border: 3px solid #fff; background: #2b3033; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.st-photo-actions { display: flex; gap: 16px; }
.st-link { background: none; border: 0; padding: 0; font: inherit; font-size: 15px; font-weight: 700; color: #0a8a8f; cursor: pointer; }
.st-muted-link { color: #94a0ad; font-weight: 600; }

.st-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
@media (max-width: 640px) { .st-grid { grid-template-columns: 1fr; } }
.st-field { display: flex; flex-direction: column; gap: 8px; font-size: 15px; font-weight: 700; color: #2b3033; }
.st-field input, .st-field textarea { padding: 13px 16px; border: 1px solid #d9dfe6; border-radius: 14px; background: #fff; font: inherit; font-size: 15px; font-weight: 400; color: #1c2530; outline: none; }
.st-field input:focus, .st-field textarea:focus { border-color: #0fb3b8; box-shadow: 0 0 0 3px rgba(15,179,184,.18); }
.st-readonly { background: #f4f7f8 !important; color: #5d6b7a !important; cursor: not-allowed; }
.st-field textarea { resize: vertical; min-height: 110px; }
.st-count { align-self: flex-end; font-size: 13px; font-weight: 500; color: #94a0ad; }

.st-foot { display: flex; justify-content: flex-end; gap: 12px; padding: 18px 28px; border-top: 1px solid #eef0f3; background: #fafbfc; }
.st-btn { padding: 11px 22px; border-radius: 12px; border: 1px solid #d9dfe6; background: #fff; font: inherit; font-size: 15px; font-weight: 700; color: #2b3033; cursor: pointer; }
.st-btn:hover { background: #f6f8fa; }
.st-primary { background: #0fb3b8; border-color: #0fb3b8; color: #fff; box-shadow: 0 6px 16px rgba(15,179,184,.28); }
.st-primary:hover { background: #0c9a9f; }
.st-btn:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }

.st-toggles { padding: 4px 28px 10px; }
.st-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0; border-top: 1px solid #eef0f3; }
.st-toggle-row:first-child { border-top: 0; }
.st-toggle-row strong { font-size: 17px; color: #1c2530; }
.st-toggle-row p { margin: 3px 0 0; font-size: 14px; color: #5d6b7a; }
.st-switch { position: relative; flex: none; width: 56px; height: 32px; border-radius: 999px; border: 0; background: #cfd6dd; cursor: pointer; transition: background .15s; }
.st-switch span { position: absolute; top: 3px; left: 3px; width: 26px; height: 26px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); transition: transform .15s; }
.st-switch.on { background: #0fb3b8; }
.st-switch.on span { transform: translateX(24px); }

.st-pw-head { padding: 24px 28px 8px; }
.st-lock { width: 48px; height: 48px; border-radius: 14px; background: #e0f7f8; color: #0a8a8f; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
.st-pw-body { padding: 16px 28px 26px; }
.st-pw-row { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border: 1px solid #e3e7ed; border-radius: 16px; background: #fff; font: inherit; font-size: 17px; font-weight: 700; color: #1c2530; cursor: pointer; }
.st-pw-row:hover { background: #f6fbfb; border-color: #0fb3b8; }
.st-pw-form { display: flex; flex-direction: column; gap: 16px; margin-top: 18px; }
.st-pw-actions { display: flex; justify-content: flex-end; gap: 12px; }
`;