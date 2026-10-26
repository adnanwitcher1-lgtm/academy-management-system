from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from attendance.models import AttendanceEntry
from exams.models import Exam, Mark
from fees.models import FeePayment

from .factories import make_admin, make_class, make_student, make_subject, make_teacher
from .models import StudentRoster


class StudentEnrollmentTests(TestCase):
    def setUp(self):
        self.admin = make_admin()
        self.klass = make_class("9th", fee=2000)
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def enrol(self, **extra):
        body = {
            "roll_no": "R100", "full_name": "Hira Fatima", "father_name": "Tariq Mehmood",
            "class_name": "9th", "school_class": self.klass.id, "phone_number": "03001112223",
            "password": "Student@123", **extra,
        }
        return self.api.post("/api/auth/students/roster/enroll/", body, format="json")

    def test_enrol_saves_father_name_and_own_fee(self):
        r = self.enrol(monthly_fee="2800")
        self.assertEqual(r.status_code, 201, r.content)
        roster = StudentRoster.objects.get(roll_no="R100")
        self.assertEqual(roster.father_name, "Tariq Mehmood")
        self.assertEqual(str(roster.monthly_fee), "2800.00")

    def test_fee_can_be_left_empty_to_use_the_class_fee(self):
        self.assertEqual(self.enrol().status_code, 201)
        self.assertIsNone(StudentRoster.objects.get(roll_no="R100").monthly_fee)

    def test_negative_fee_is_refused(self):
        self.assertEqual(self.enrol(monthly_fee="-5").status_code, 400)

    def test_manage_list_and_edit_father_name(self):
        self.enrol()
        roster = StudentRoster.objects.get(roll_no="R100")
        rows = self.api.get("/api/auth/students/manage/").data
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.assertEqual(rows[0]["father_name"], "Tariq Mehmood")
        r = self.api.patch(f"/api/auth/students/manage/{roster.id}/", {"father_name": "Tariq Aziz", "monthly_fee": "3000"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        roster.refresh_from_db()
        self.assertEqual(roster.father_name, "Tariq Aziz")

    def test_login_returns_the_students_real_name(self):
        self.enrol()
        r = APIClient().post("/api/auth/login/", {"username": "r100", "password": "Student@123"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["full_name"], "Hira Fatima")
        me = APIClient()
        me.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])
        profile = me.get("/api/profiles/me/").data
        self.assertEqual(profile["full_name"], "Hira Fatima")
        self.assertEqual(profile["father_name"], "Tariq Mehmood")


class StudentProfileTests(TestCase):
    def setUp(self):
        self.admin = make_admin()
        self.klass = make_class("10th")
        self.ali = make_student("R001", "Ali Raza", father="Raza Khan", klass=self.klass)
        self.sana = make_student("R002", "Sana Bibi", klass=self.klass)
        teacher = make_teacher()
        self.subject = make_subject(self.klass, "Physics", teacher=teacher)
        AttendanceEntry.objects.create(student=self.ali, school_class=self.klass, date=date(2026, 10, 20), status="present")
        AttendanceEntry.objects.create(student=self.ali, school_class=self.klass, date=date(2026, 10, 21), status="late")
        AttendanceEntry.objects.create(student=self.ali, school_class=self.klass, date=date(2026, 10, 22), status="absent")
        FeePayment.objects.create(student=self.ali, amount=2500, due_date=date(2026, 10, 10), month=date(2026, 10, 1), status="paid", paid_on=date(2026, 10, 8), received_by_name="Miss Amna")
        self.exam = Exam.objects.create(name="Mid Term", date=date(2026, 10, 15), school_class=self.klass)
        Mark.objects.create(exam=self.exam, subject=self.subject, student=self.ali, obtained_marks=78, total_marks=100)
        self.roster = StudentRoster.objects.get(roll_no="R001")
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def test_admin_sees_the_whole_record(self):
        r = self.api.get(f"/api/auth/students/{self.roster.id}/overview/")
        self.assertEqual(r.status_code, 200, r.content)
        d = r.data
        self.assertEqual(d["student"]["full_name"], "Ali Raza")
        self.assertEqual(d["student"]["father_name"], "Raza Khan")
        self.assertEqual(d["student"]["phone_number"], "03001234567")
        self.assertEqual(d["attendance"]["summary"]["present"], 1)
        self.assertEqual(d["attendance"]["summary"]["absent"], 1)
        self.assertEqual(d["fees"][0]["received_by_name"], "Miss Amna")
        self.assertEqual(float(d["fee_summary"]["paid"]), 2500.0)
        self.assertEqual(d["results"][0]["rows"][0]["subject"], "Physics")
        self.assertEqual(d["results"][0]["percentage"], 78.0)

    def test_profile_pdf_downloads(self):
        r = self.api.get(f"/api/auth/students/{self.roster.id}/overview/pdf/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b"%PDF"))

    def test_student_sees_only_their_own_profile(self):
        me = APIClient()
        me.force_authenticate(self.ali)
        r = me.get("/api/auth/students/me/overview/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["student"]["roll_no"], "R001")
        self.assertEqual(me.get(f"/api/auth/students/{StudentRoster.objects.get(roll_no='R002').id}/overview/").status_code, 403)
        self.assertEqual(me.get("/api/auth/students/me/overview/pdf/").status_code, 200)

    def test_result_card_pdf_for_admin_and_own_student_only(self):
        url = f"/api/exams/exams/{self.exam.id}/report-card/{self.ali.id}/"
        r = self.api.get(url)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b"%PDF"))
        mine = APIClient(); mine.force_authenticate(self.ali)
        self.assertEqual(mine.get(url).status_code, 200)
        other = APIClient(); other.force_authenticate(self.sana)
        self.assertEqual(other.get(url).status_code, 403)
        teacher = APIClient(); teacher.force_authenticate(make_teacher("t2", "Miss X"))
        self.assertEqual(teacher.get(url).status_code, 403)
