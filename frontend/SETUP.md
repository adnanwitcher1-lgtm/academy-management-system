# Keen frontend — setup

Drop these into your Vite React project root (`Keen Academy/frontend`), replacing what's there.

```
index.html                         <- your theme's tailwind.config, unchanged
public/keen-logo.png               <- the real emblem (replaces the "KEEN" text circle)
src/main.jsx
src/App.jsx                        <- routes + role guards
src/lib/api.js                     <- fetch wrapper, token refresh
src/lib/auth.jsx                   <- session context
src/components/ui.jsx              <- sidebar shell, buttons, pills, panels
src/pages/Login.jsx
src/pages/StudentDashboard.jsx
src/pages/HodDashboard.jsx
```

One dependency:

```powershell
npm install react-router-dom
npm run dev
```

## Backend must allow the browser

Requests come from `http://localhost:5173`, so Django needs CORS:

```powershell
pip install django-cors-headers
```

In `settings.py`:

```python
INSTALLED_APPS = [..., "corsheaders"]
MIDDLEWARE = ["corsheaders.middleware.CorsMiddleware", ...]  # above CommonMiddleware
CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
```

## Endpoints used

| Purpose | Route |
|---|---|
| Login | `POST /api/auth/login/` |
| Pending list | `GET /api/auth/students/pending/` |
| Approve | `POST /api/auth/students/pending/<id>/approve/` |
| Token refresh | `POST /api/auth/token/refresh/` |
| Signup | `POST /api/auth/signup/` (not wired to a page yet) |

Change the refresh/signup paths in `src/lib/api.js` if your `urls.py` differs.

## Role names

`App.jsx` treats `hod`, `admin` and `staff` as admin-level and `student` as student.
If your login returns a different string for the admin account, update the `allow`
array in `App.jsx` and the `roles` array in `NAV` inside `src/components/ui.jsx`.

## What the theme kept

- Same token names and hex values: `keen.cyan`, `cyanDark`, `cyanSoft`, `charcoal`,
  `darkest`, `surface`, `border`, `muted`; page background `#F4F8FA`.
- Charcoal sidebar with cyan pill on the active link, `Django + React` / `ONLINE`
  footer, 04:00–09:00 batch line in the header, `rounded-2xl` white cards with
  `border-keen-border`, uppercase `text-[10px]` table heads, cyan-soft row hover.
- Sidebar links for Teacher, Exams, Fees and Timetables are shown but greyed out —
  those modules don't exist in the backend yet.

## Test it

1. Sign in as Ali (`ali1234567`) — lands on the student dashboard.
2. Sign out, sign in as the admin — Saira (KEEN-103) shows in Pending Student Signups.
3. Click Approve — the row clears and a confirmation appears.
4. Sign in as Saira — she can now get in.
