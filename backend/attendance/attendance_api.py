from datetime import date, timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.models import SchoolClass, Subject
from accounts.models import StudentProfile, TeacherProfile

from .models import AttendanceEntry, TeacherAttendance

STATUSES = [c[0] for c in AttendanceEntry.Status.choices]
TEACHER_STATUSES = [c[0] for c in TeacherAttendance.Status.choices]


def _name(user):
    return (user.get_full_name() or user.username) if user else ""


def _teacher_class_ids(user):
    return set(Subject.objects.filter(teacher=user).values_list("school_class_id", flat=True))


def _can_use_class(user, class_id):
    if user.role == "student":
        return False
    if user.role == "teacher":
        return class_id in _teacher_class_ids(user)
    return True


def _class_students(school_class):
    return list(
        StudentProfile.objects.select_related("user", "roster_entry")
        .filter(roster_entry__school_class=school_class, roster_entry__is_claimed=True)
        .order_by("roster_entry__roll_no")
    )


def _read_day(raw):
    """(ok, value): a blank means no date, an unreadable value is an error."""
    if not raw:
        return True, None
    try:
        return True, date.fromisoformat(str(raw))
    except ValueError:
        return False, None


def _summary(statuses):
    out = {"present": 0, "absent": 0, "late": 0, "leave": 0}
    for s in statuses:
        if s in out:
            out[s] += 1
    total = sum(out.values())
    out["total"] = total
    # Present and Late count as attended, out of every day that was marked.
    out["percent"] = round((out["present"] + out["late"]) * 100 / total) if total else None
    return out


def _build_sheet(school_class, day):
    profiles = _class_students(school_class)
    entries = {
        e.student_id: e
        for e in AttendanceEntry.objects.select_related("marked_by").filter(
            date=day, student_id__in=[p.user_id for p in profiles]
        )
    }
    rows = []
    for p in profiles:
        e = entries.get(p.user_id)
        rows.append(
            {
                "student": p.user_id,
                "name": _name(p.user),
                "roll_no": p.roster_entry.roll_no,
                "status": e.status if e else None,
                "note": e.note if e else "",
            }
        )
    summary = _summary([r["status"] for r in rows if r["status"]])
    summary["unmarked"] = len(rows) - summary["total"]
    latest = max(entries.values(), key=lambda e: e.marked_at) if entries else None
    return {
        "school_class": school_class.id,
        "class_label": str(school_class),
        "date": day.isoformat(),
        "weekday": day.strftime("%A"),
        "students": rows,
        "summary": summary,
        "marked_at": latest.marked_at if latest else None,
        "marked_by": _name(latest.marked_by) if latest else "",
    }


def _deny(message, code=403):
    return Response({"detail": message}, status=code)


class AttendanceClassesView(APIView):
    """Classes the signed-in user may take attendance for."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == "student":
            return Response([])
        qs = SchoolClass.objects.all()
        if user.role == "teacher":
            qs = qs.filter(pk__in=_teacher_class_ids(user))
        rows = [{"id": c.id, "label": str(c)} for c in qs]
        rows.sort(key=lambda r: r["label"])
        return Response(rows)


class AttendanceSheetView(APIView):
    """GET a class sheet for a date, POST to save it."""

    permission_classes = [permissions.IsAuthenticated]

    def _class(self, request, raw):
        if not str(raw or "").isdigit():
            return None, _deny("Pick a class.", 400)
        klass = SchoolClass.objects.filter(pk=int(raw)).first()
        if not klass:
            return None, _deny("That class does not exist.", 404)
        if not _can_use_class(request.user, klass.id):
            return None, _deny("You can only take attendance for your own classes.")
        return klass, None

    def get(self, request):
        klass, err = self._class(request, request.query_params.get("school_class"))
        if err:
            return err
        ok, day = _read_day(request.query_params.get("date"))
        if not ok:
            return _deny("Use a date like 2026-09-21.", 400)
        return Response(_build_sheet(klass, day or date.today()))

    def post(self, request):
        klass, err = self._class(request, request.data.get("school_class"))
        if err:
            return err
        ok, day = _read_day(request.data.get("date"))
        if not ok or day is None:
            return _deny("Pick a valid date.", 400)
        if day > date.today():
            return _deny("You can't mark attendance for a future date.", 400)
        records = request.data.get("records")
        if not isinstance(records, list) or not records:
            return _deny("Mark at least one student.", 400)

        allowed = {p.user_id for p in _class_students(klass)}
        cleaned = []
        for r in records:
            sid = r.get("student") if isinstance(r, dict) else None
            st = r.get("status") if isinstance(r, dict) else None
            if sid not in allowed:
                return _deny("One of the students is not in this class.", 400)
            if st not in STATUSES:
                return _deny("Status must be present, absent, late or leave.", 400)
            cleaned.append((sid, st, str(r.get("note") or "")[:200]))

        now = timezone.now()
        with transaction.atomic():
            for sid, st, note in cleaned:
                AttendanceEntry.objects.update_or_create(
                    student_id=sid,
                    date=day,
                    defaults={
                        "school_class": klass,
                        "status": st,
                        "note": note,
                        "marked_at": now,
                        "marked_by": request.user,
                    },
                )
        return Response(_build_sheet(klass, day))


class AttendanceSearchView(APIView):
    """Find a student by name or roll number."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == "student":
            return Response([])
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response([])
        qs = StudentProfile.objects.select_related("user", "roster_entry__school_class").filter(
            Q(user__first_name__icontains=q)
            | Q(user__last_name__icontains=q)
            | Q(user__username__icontains=q)
            | Q(roster_entry__roll_no__icontains=q)
            | Q(roster_entry__full_name__icontains=q)
        )
        if user.role == "teacher":
            qs = qs.filter(roster_entry__school_class_id__in=_teacher_class_ids(user))
        rows = []
        for p in qs.order_by("roster_entry__roll_no")[:15]:
            klass = p.roster_entry.school_class
            rows.append(
                {
                    "id": p.user_id,
                    "name": _name(p.user),
                    "roll_no": p.roster_entry.roll_no,
                    "class_label": str(klass) if klass else "",
                }
            )
        return Response(rows)


class StudentAttendanceView(APIView):
    """One student's attendance history and totals, optionally between two dates."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        user = request.user
        profile = (
            StudentProfile.objects.select_related("user", "roster_entry__school_class")
            .filter(user_id=user_id)
            .first()
        )
        if not profile:
            return _deny("Student not found.", 404)
        klass = profile.roster_entry.school_class
        if user.role == "student":
            if user.id != user_id:
                return _deny("You can only view your own attendance.")
        elif user.role == "teacher":
            if not klass or klass.id not in _teacher_class_ids(user):
                return _deny("That student is not in one of your classes.")

        ok_from, start = _read_day(request.query_params.get("from"))
        ok_to, end = _read_day(request.query_params.get("to"))
        if not (ok_from and ok_to):
            return _deny("Use dates like 2026-09-21.", 400)

        qs = AttendanceEntry.objects.select_related("marked_by").filter(student_id=user_id)
        if start:
            qs = qs.filter(date__gte=start)
        if end:
            qs = qs.filter(date__lte=end)
        records = [
            {
                "date": e.date.isoformat(),
                "weekday": e.date.strftime("%A"),
                "status": e.status,
                "note": e.note,
                "marked_at": e.marked_at,
                "marked_by": _name(e.marked_by),
            }
            for e in qs.order_by("-date")
        ]
        return Response(
            {
                "student": {
                    "id": user_id,
                    "name": _name(profile.user),
                    "roll_no": profile.roster_entry.roll_no,
                    "class_label": str(klass) if klass else "",
                },
                "records": records,
                "summary": _summary([r["status"] for r in records]),
            }
        )


class AttendanceTodayView(APIView):
    """Today's totals across every class, for the dashboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role in ("student", "teacher"):
            return _deny("Only staff can view the overall summary.")
        today = date.today()
        s = _summary(AttendanceEntry.objects.filter(date=today).values_list("status", flat=True))
        return Response({"date": today.isoformat(), **s})


class AttendanceTrendView(APIView):
    """Daily attendance totals for the last N days, for the dashboard chart."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role in ("student", "teacher"):
            return _deny("Only staff can view the overall trend.")
        raw = request.query_params.get("days", "7")
        days = int(raw) if str(raw).isdigit() else 7
        days = max(2, min(days, 31))
        today = date.today()
        start = today - timedelta(days=days - 1)
        by_day = {}
        for d, st in AttendanceEntry.objects.filter(date__gte=start, date__lte=today).values_list("date", "status"):
            by_day.setdefault(d, []).append(st)
        out = []
        for i in range(days):
            d = start + timedelta(days=i)
            out.append({"date": d.isoformat(), "weekday": d.strftime("%a"), **_summary(by_day.get(d, []))})
        return Response({"today": today.isoformat(), "days": out})


# ---------------------------------------------------------------------------
# Teacher attendance (marked by the admin)
# ---------------------------------------------------------------------------


def _teacher_name(t):
    user = getattr(t, "user", None)
    full = (user.get_full_name() or user.username) if user else ""
    if not full:
        full = " ".join(
            x for x in [getattr(t, "first_name", ""), getattr(t, "last_name", "")] if x
        ).strip()
    return full or str(t)


class TeacherAttendanceSheetView(APIView):
    """Admin marks every teacher for one day. GET loads the sheet, POST saves it."""

    permission_classes = [permissions.IsAuthenticated]

    def _denied(self, request):
        return request.user.role in ("student", "teacher")

    def get(self, request):
        if self._denied(request):
            return _deny("Only admins can mark teacher attendance.")
        ok, day = _read_day(request.query_params.get("date"))
        if not ok:
            return _deny("Use a date like 2026-09-21.", 400)
        day = day or timezone.localdate()

        saved = {e.teacher_id: e for e in TeacherAttendance.objects.filter(date=day)}
        rows = []
        for t in TeacherProfile.objects.order_by("id"):
            e = saved.get(t.id)
            rows.append(
                {
                    "teacher": t.id,
                    "name": _teacher_name(t),
                    "status": e.status if e else "",
                    "note": e.note if e else "",
                }
            )
        return Response(
            {
                "date": day.isoformat(),
                "rows": rows,
                "summary": _summary([r["status"] for r in rows if r["status"]]),
            }
        )

    def post(self, request):
        if self._denied(request):
            return _deny("Only admins can mark teacher attendance.")
        ok, day = _read_day(request.data.get("date"))
        if not ok or not day:
            return _deny("A valid date is required.", 400)

        valid_ids = set(TeacherProfile.objects.values_list("id", flat=True))
        saved = 0
        with transaction.atomic():
            for item in request.data.get("entries") or []:
                if not isinstance(item, dict):
                    continue
                try:
                    tid = int(item.get("teacher"))
                except (TypeError, ValueError):
                    continue
                status = item.get("status")
                if tid not in valid_ids or status not in TEACHER_STATUSES:
                    continue
                TeacherAttendance.objects.update_or_create(
                    teacher_id=tid,
                    date=day,
                    defaults={
                        "status": status,
                        "note": str(item.get("note") or "")[:200],
                        "marked_by": request.user,
                        "marked_at": timezone.now(),
                    },
                )
                saved += 1
        return Response({"saved": saved, "date": day.isoformat()})


class TeacherAttendanceHistoryView(APIView):
    """Past teacher attendance. ?teacher=<id> gives one teacher's days; without it, a summary per teacher."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role in ("student", "teacher"):
            return _deny("Only admins can view teacher attendance.")
        ok_from, start = _read_day(request.query_params.get("from"))
        ok_to, end = _read_day(request.query_params.get("to"))
        if not (ok_from and ok_to):
            return _deny("Use dates like 2026-09-21.", 400)

        qs = TeacherAttendance.objects.select_related("marked_by")
        if start:
            qs = qs.filter(date__gte=start)
        if end:
            qs = qs.filter(date__lte=end)

        raw = request.query_params.get("teacher")
        if raw:
            if not str(raw).isdigit():
                return _deny("Pick a teacher.", 400)
            teacher = TeacherProfile.objects.filter(pk=int(raw)).first()
            if not teacher:
                return _deny("Teacher not found.", 404)
            records = [
                {
                    "date": e.date.isoformat(),
                    "weekday": e.date.strftime("%A"),
                    "status": e.status,
                    "note": e.note,
                    "marked_by": _name(e.marked_by),
                }
                for e in qs.filter(teacher=teacher).order_by("-date")
            ]
            return Response(
                {
                    "teacher": {"id": teacher.id, "name": _teacher_name(teacher)},
                    "records": records,
                    "summary": _summary([r["status"] for r in records]),
                }
            )

        by_teacher = {}
        for tid, st in qs.values_list("teacher_id", "status"):
            by_teacher.setdefault(tid, []).append(st)
        rows = [
            {"teacher": t.id, "name": _teacher_name(t), **_summary(by_teacher.get(t.id, []))}
            for t in TeacherProfile.objects.order_by("id")
        ]
        return Response({"teachers": rows})