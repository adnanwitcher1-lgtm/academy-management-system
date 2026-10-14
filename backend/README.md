# KEEN AMS — Backend (Django REST API)

## Setup
```bash
python -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser --username admin   # then set role='admin' via /admin/ or shell
python manage.py runserver
```

## Key endpoints (all under /api/)
| Endpoint | Method | Who | Purpose |
|---|---|---|---|
| `/api/auth/login/` | POST | anyone | username+password -> JWT access/refresh + role |
| `/api/auth/login/refresh/` | POST | anyone | refresh access token |
| `/api/auth/teachers/create/` | POST | admin | create a teacher account (returns generated username/temp password) |
| `/api/auth/students/roster/enroll/` | POST | admin | pre-register a student's Roll No. |
| `/api/auth/students/roster/` | GET | admin | view roster + claim status |
| `/api/auth/students/signup/` | POST | public | student self-registers with Roll No. + details |
| `/api/academics/classes/` | GET/POST | admin write, all read | classes/sections |
| `/api/academics/subjects/` | GET/POST | admin write, all read | Subject List — teacher's dropdown is this, filtered to their own subjects |
| `/api/exams/exams/` | GET/POST | admin write | exam definitions |
| `/api/exams/marks/` | GET/POST | teacher write | marks entry — auto-visible to the student instantly |

## Notes
- Custom user model: `accounts.User`, with `role` in `admin`/`teacher`/`student`.
- SQLite by default (`db.sqlite3`) — swap `DATABASES` in `config/settings.py` for PostgreSQL when moving beyond local dev.
- CORS is pre-opened for `http://localhost:5173` (Vite's default port) for the `frontend/` React app.
- This folder is fully independent of `frontend/` — only the REST API connects them.
