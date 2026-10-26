"""One student's whole record in a single place: details, attendance, fees and results.

Admin sees any student (by roster id); a student sees only their own."""

from collections import OrderedDict
from datetime import date

from django.shortcuts import get_object_or_404
from reportlab.lib.units import mm
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from attendance.attendance_api import _summary, _with_holidays
from attendance.models import AttendanceEntry
from config.pdf_common import P, build_pdf, fmt_date, grid_table, header_block, key_value_table, money, spacer
from exams.grades import grade_for
from exams.models import Mark
from fees.models import FeePayment

from .models import StudentRoster


def _num(value):
    return float(value or 0)


def build_overview(roster):
    account = getattr(roster, "student_account", None)
    user = account.user if account else None
    klass = roster.school_class

    student = {
        "roster_id": roster.id,
        "user_id": user.id if user else None,
        "username": user.username if user else "",
        "is_active": user.is_active if user else False,
        "full_name": roster.full_name,
        "father_name": roster.father_name,
        "roll_no": roster.roll_no,
        "class_label": str(klass) if klass else roster.class_name,
        "phone_number": roster.phone_number,
        "date_of_birth": roster.date_of_birth,
        "cnic_or_bform": roster.cnic_or_bform,
        "monthly_fee": roster.monthly_fee,
        "enrolled_on": roster.created_at.date(),
    }

    attendance = {"summary": _summary([]), "monthly": [], "records": []}
    fees, results = [], []

    if user:
        recs = [
            {"date": e.date.isoformat(), "weekday": e.date.strftime("%A"), "status": e.status, "note": e.note}
            for e in AttendanceEntry.objects.filter(student=user).order_by("-date")
        ]
        recs = _with_holidays(recs, None, None, roster.created_at.date())
        monthly = OrderedDict()
        for r in sorted(recs, key=lambda r: r["date"]):
            monthly.setdefault(r["date"][:7], []).append(r["status"])
        attendance = {
            "summary": _summary([r["status"] for r in recs]),
            "monthly": [{"month": k, **_summary(v)} for k, v in monthly.items()][::-1],
            "records": recs[:90],
        }

        for p in FeePayment.objects.filter(student=user).order_by("-due_date", "-id"):
            fees.append(
                {
                    "id": p.id,
                    "challan_no": p.challan_no,
                    "month": p.month.strftime("%B %Y") if p.month else "",
                    "amount": p.amount,
                    "arrears": p.arrears,
                    "fine": p.fine,
                    "fine_note": p.fine_note,
                    "total": p.total,
                    "due_date": p.due_date,
                    "status": p.status,
                    "paid_on": p.paid_on,
                    "received_by_name": p.received_by_name,
                }
            )

        by_exam = OrderedDict()
        marks = Mark.objects.select_related("exam", "subject").filter(student=user).order_by("-exam__date", "subject__name")
        for m in marks:
            block = by_exam.setdefault(
                m.exam_id,
                {"exam_id": m.exam_id, "exam_name": m.exam.name, "exam_date": m.exam.date, "rows": [], "obtained": 0.0, "total": 0.0},
            )
            o, t = _num(m.obtained_marks), _num(m.total_marks)
            pct = round(o / t * 100, 1) if t else 0
            block["rows"].append({"subject": m.subject.name, "obtained": o, "total": t, "percentage": pct, "grade": grade_for(pct)})
            block["obtained"] += o
            block["total"] += t
        for b in by_exam.values():
            b["percentage"] = round(b["obtained"] / b["total"] * 100, 2) if b["total"] else 0
            b["grade"] = grade_for(b["percentage"])
            results.append(b)

    live = [f for f in fees if f["status"] != "carried"]
    fee_summary = {
        "billed": sum((f["total"] for f in live), 0),
        "paid": sum((f["total"] for f in live if f["status"] == "paid"), 0),
        "pending": sum((f["total"] for f in live if f["status"] == "pending"), 0),
    }
    return {"student": student, "attendance": attendance, "fees": fees, "fee_summary": fee_summary, "results": results}


def overview_pdf(data):
    s = data["student"]
    att = data["attendance"]["summary"]
    story = [
        header_block("STUDENT PROFILE", f"Printed {fmt_date(date.today())}"),
        spacer(5),
        key_value_table(
            [
                ("Name", s["full_name"]),
                ("Father name", s["father_name"] or "-"),
                ("Roll no", s["roll_no"]),
                ("Class", s["class_label"] or "-"),
                ("Phone", s["phone_number"] or "-"),
                ("Date of birth", fmt_date(s["date_of_birth"])),
                ("B-Form / CNIC", s["cnic_or_bform"] or "-"),
                ("Monthly fee", money(s["monthly_fee"]) if s["monthly_fee"] else "Class fee"),
                ("Enrolled on", fmt_date(s["enrolled_on"])),
            ]
        ),
        P("Attendance", "section"),
        key_value_table(
            [
                ("Attendance", f"{att['percent']}%" if att["percent"] is not None else "No attendance marked yet"),
                ("Present / Late", f"{att['present']} / {att['late']}"),
                ("Absent / Leave", f"{att['absent']} / {att['leave']}"),
                ("Holidays", str(att.get("holiday", 0))),
            ]
        ),
    ]
    if data["attendance"]["monthly"]:
        rows = [
            [m["month"], str(m["present"]), str(m["late"]), str(m["absent"]), str(m["leave"]), f"{m['percent']}%" if m["percent"] is not None else "-"]
            for m in data["attendance"]["monthly"][:12]
        ]
        story += [spacer(3), grid_table(["Month", "Present", "Late", "Absent", "Leave", "Attendance"], rows, [40 * mm, 28 * mm, 28 * mm, 28 * mm, 28 * mm, 28 * mm], right_cols=(1, 2, 3, 4, 5))]

    story.append(P("Fee record", "section"))
    fs = data["fee_summary"]
    story.append(key_value_table([("Total billed", money(fs["billed"])), ("Paid", money(fs["paid"])), ("Pending", money(fs["pending"]))]))
    if data["fees"]:
        rows = [
            [f["challan_no"], f["month"] or "-", money(f["total"]), fmt_date(f["due_date"]), "CARRIED" if f["status"] == "carried" else f["status"].upper(), fmt_date(f["paid_on"]) if f["paid_on"] else "-", f["received_by_name"] or "-"]
            for f in data["fees"][:24]
        ]
        story += [spacer(3), grid_table(["Challan", "Month", "Total", "Due", "Status", "Paid on", "Received by"], rows, [24 * mm, 28 * mm, 24 * mm, 24 * mm, 22 * mm, 24 * mm, 34 * mm], right_cols=(2,))]

    story.append(P("Results", "section"))
    if not data["results"]:
        story.append(P("No exam results yet."))
    for b in data["results"]:
        story.append(P(f"{b['exam_name']} ({fmt_date(b['exam_date'])}) - {b['obtained']:g}/{b['total']:g}, {b['percentage']:g}%, grade {b['grade']}", "bold"))
        rows = [[r["subject"], f"{r['obtained']:g}", f"{r['total']:g}", f"{r['percentage']:g}%", r["grade"]] for r in b["rows"]]
        story += [spacer(1), grid_table(["Subject", "Obtained", "Total", "%", "Grade"], rows, [74 * mm, 28 * mm, 28 * mm, 26 * mm, 24 * mm], right_cols=(1, 2, 3, 4)), spacer(3)]
    return build_pdf(story, f"student-profile-{s['roll_no']}.pdf")


class StudentOverviewView(APIView):
    """GET /students/<roster id>/overview/ (admin)  or  /students/me/overview/ (the student)."""

    permission_classes = [permissions.IsAuthenticated]
    as_pdf = False

    def get(self, request, pk=None):
        user = request.user
        if pk is None:
            if user.role != "student":
                return Response({"detail": "Only students have a personal profile."}, status=403)
            roster = get_object_or_404(StudentRoster, student_account__user=user)
        else:
            if user.role != "admin":
                return Response({"detail": "Admins only."}, status=403)
            roster = get_object_or_404(StudentRoster.objects.select_related("school_class"), pk=pk)
        data = build_overview(roster)
        return overview_pdf(data) if self.as_pdf else Response(data)


class StudentOverviewPdfView(StudentOverviewView):
    as_pdf = True
