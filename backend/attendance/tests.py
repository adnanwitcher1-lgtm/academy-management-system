from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.factories import make_admin, make_class, make_student

from .models import AttendanceEntry, Holiday

SUNDAY = date(2026, 10, 18)
WEDNESDAY = date(2026, 10, 21)
THURSDAY = date(2026, 10, 22)


class AttendanceTests(TestCase):
    def setUp(self):
        self.admin = make_admin()
        self.klass = make_class("10th")
        self.ali = make_student("R001", "Ali Raza", klass=self.klass)
        self.sana = make_student("R002", "Sana Bibi", klass=self.klass)
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def sheet(self, day):
        return self.api.get(f"/api/attendance/sheet/?school_class={self.klass.id}&date={day.isoformat()}")

    def mark(self, day, ali="present", sana="present"):
        return self.api.post(
            "/api/attendance/sheet/",
            {"school_class": self.klass.id, "date": day.isoformat(),
             "records": [{"student": self.ali.id, "status": ali}, {"student": self.sana.id, "status": sana}]},
            format="json",
        )

    def test_all_four_statuses_can_be_marked(self):
        for status in ("present", "late", "absent", "leave"):
            r = self.mark(WEDNESDAY, ali=status)
            self.assertEqual(r.status_code, 200, r.content)
            row = [s for s in r.data["students"] if s["student"] == self.ali.id][0]
            self.assertEqual(row["status"], status)

    def test_holiday_cannot_be_marked_by_hand(self):
        r = self.mark(WEDNESDAY, ali="holiday")
        self.assertEqual(r.status_code, 400)

    def test_sunday_is_a_holiday_automatically(self):
        data = self.sheet(SUNDAY).data
        self.assertTrue(data["is_holiday"])
        self.assertIn("Sunday", data["holiday_title"])
        self.assertTrue(all(s["status"] == "holiday" for s in data["students"]))
        self.assertEqual(self.mark(SUNDAY).status_code, 400)

    def test_adding_a_holiday_marks_every_student_and_removing_it_clears_them(self):
        r = self.api.post("/api/attendance/holidays/", {"date": WEDNESDAY.isoformat(), "title": "Eid"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["students_marked"], 2)
        self.assertEqual(AttendanceEntry.objects.filter(date=WEDNESDAY, status="holiday").count(), 2)
        self.assertTrue(self.sheet(WEDNESDAY).data["is_holiday"])
        self.assertEqual(self.mark(WEDNESDAY).status_code, 400)

        gone = self.api.delete(f"/api/attendance/holidays/{r.data['id']}/")
        self.assertEqual(gone.status_code, 204)
        self.assertEqual(AttendanceEntry.objects.filter(date=WEDNESDAY).count(), 0)
        self.assertFalse(self.sheet(WEDNESDAY).data["is_holiday"])

    def test_a_real_mark_is_never_overwritten_by_a_holiday(self):
        self.mark(WEDNESDAY, ali="absent")
        self.api.post("/api/attendance/holidays/", {"date": WEDNESDAY.isoformat(), "title": "Strike"}, format="json")
        self.assertEqual(AttendanceEntry.objects.get(student=self.ali, date=WEDNESDAY).status, "absent")

    def test_only_admin_adds_holidays(self):
        student = APIClient()
        student.force_authenticate(self.ali)
        r = student.post("/api/attendance/holidays/", {"date": WEDNESDAY.isoformat(), "title": "x"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Holiday.objects.exists())

    def test_holidays_do_not_count_against_the_percentage(self):
        self.mark(WEDNESDAY, ali="present")
        self.mark(THURSDAY, ali="absent")
        Holiday.objects.create(date=date(2026, 10, 20), title="Ashura")
        from .holidays import mark_holiday_for_students

        mark_holiday_for_students(date(2026, 10, 20))
        r = self.api.get(f"/api/attendance/student/{self.ali.id}/?from=2026-10-19&to=2026-10-22")
        s = r.data["summary"]
        self.assertEqual((s["present"], s["absent"], s["holiday"]), (1, 1, 1))
        self.assertEqual(s["percent"], 50)
        statuses = {x["date"]: x["status"] for x in r.data["records"]}
        self.assertEqual(statuses["2026-10-20"], "holiday")
