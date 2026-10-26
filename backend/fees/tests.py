from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.factories import make_admin, make_class, make_student
from notifications.models import Notification

from . import billing
from .models import FeePayment

OCT = date(2026, 10, 1)
NOV = date(2026, 11, 1)


class MonthlyChallanTests(TestCase):
    def setUp(self):
        self.admin = make_admin()
        self.klass = make_class("10th", fee=2500)
        self.ali = make_student("R001", "Ali Raza", klass=self.klass)
        self.sana = make_student("R002", "Sana Bibi", klass=self.klass, fee=1800)  # her own fee
        from accounts.models import StudentRoster

        StudentRoster.objects.update(created_at="2026-01-05T00:00:00Z")

    def test_each_student_gets_own_fee_due_on_the_tenth(self):
        out = billing.generate_for_month(OCT)
        self.assertEqual(out["created"], 2)
        ali = FeePayment.objects.get(student=self.ali, month=OCT)
        sana = FeePayment.objects.get(student=self.sana, month=OCT)
        self.assertEqual(ali.amount, Decimal("2500"))
        self.assertEqual(sana.amount, Decimal("1800"))
        self.assertEqual(ali.due_date, date(2026, 10, 10))
        self.assertEqual(ali.fine, 0)

    def test_running_twice_creates_nothing_more(self):
        billing.generate_for_month(OCT)
        again = billing.generate_for_month(OCT)
        self.assertEqual(again["created"], 0)
        self.assertEqual(FeePayment.objects.count(), 2)

    def test_both_student_and_admin_are_notified(self):
        billing.generate_for_month(OCT)
        self.assertTrue(Notification.objects.filter(user=self.ali, kind="challan").exists())
        self.assertTrue(Notification.objects.filter(user=self.admin, kind="challan").exists())

    def test_unpaid_month_is_carried_into_next_challan(self):
        billing.generate_for_month(OCT)
        paid = FeePayment.objects.get(student=self.sana, month=OCT)
        paid.status = "paid"
        paid.paid_on = date(2026, 10, 9)
        paid.save()
        billing.generate_for_month(NOV)

        nov = FeePayment.objects.get(student=self.ali, month=NOV)
        self.assertEqual(nov.arrears, Decimal("2500"))
        self.assertEqual(nov.total, Decimal("5000"))
        old = FeePayment.objects.get(student=self.ali, month=OCT)
        self.assertEqual(old.status, "carried")
        self.assertEqual(old.carried_to_id, nov.id)
        # the student who paid starts clean
        self.assertEqual(FeePayment.objects.get(student=self.sana, month=NOV).arrears, 0)

    def test_student_without_any_fee_is_skipped(self):
        free = make_student("R003", "No Fee", klass=make_class("PG"))
        out = billing.generate_for_month(OCT)
        self.assertEqual(out["skipped_no_fee"], 1)
        self.assertFalse(FeePayment.objects.filter(student=free).exists())


class FeeApiTests(TestCase):
    def setUp(self):
        self.admin = make_admin()
        self.klass = make_class("10th", fee=2500)
        self.ali = make_student("R001", "Ali Raza", father="Raza Khan", klass=self.klass)
        self.other = make_student("R002", "Sana Bibi", klass=self.klass)
        self.challan = FeePayment.objects.create(student=self.ali, amount=2500, due_date=date(2026, 10, 10), month=OCT)
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def test_marking_paid_stores_who_received_it(self):
        r = self.api.patch(f"/api/fees/payments/{self.challan.id}/", {"status": "paid", "received_by_name": "Miss Amna"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["received_by_name"], "Miss Amna")
        self.assertIsNotNone(r.data["paid_on"])
        self.assertTrue(Notification.objects.filter(user=self.ali, kind="payment").exists())

    def test_receiver_defaults_to_the_admin_who_marked_it(self):
        r = self.api.patch(f"/api/fees/payments/{self.challan.id}/", {"status": "paid"}, format="json")
        self.assertEqual(r.data["received_by_name"], "Admin User")

    def test_fine_is_empty_then_added_later_and_student_is_told(self):
        r = self.api.get(f"/api/fees/payments/{self.challan.id}/")
        self.assertEqual(Decimal(r.data["fine"]), 0)
        r = self.api.patch(f"/api/fees/payments/{self.challan.id}/", {"fine": "200", "fine_note": "Late fee"}, format="json")
        self.assertEqual(Decimal(r.data["total"]), Decimal("2700"))
        n = Notification.objects.get(user=self.ali, kind="fine")
        self.assertIn("Late fee", n.body)
        student = APIClient()
        student.force_authenticate(self.ali)
        mine = student.get("/api/fees/payments/").data
        rows = mine["results"] if isinstance(mine, dict) else mine
        self.assertEqual(Decimal(rows[0]["fine"]), 200)
        self.assertEqual(rows[0]["fine_note"], "Late fee")

    def test_only_the_admin_can_edit_a_challan(self):
        student = APIClient()
        student.force_authenticate(self.ali)
        r = student.patch(f"/api/fees/payments/{self.challan.id}/", {"fine": "5"}, format="json")
        self.assertEqual(r.status_code, 403)
        r = student.patch(f"/api/fees/payments/{self.challan.id}/", {"status": "paid"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_pending_list_has_only_unpaid_and_a_summary(self):
        paid = FeePayment.objects.create(student=self.other, amount=2500, due_date=date(2026, 9, 10), month=date(2026, 9, 1), status="paid", paid_on=date(2026, 9, 5))
        r = self.api.get("/api/fees/payments/pending/")
        self.assertEqual(r.status_code, 200)
        ids = [row["id"] for row in r.data["results"]]
        self.assertIn(self.challan.id, ids)
        self.assertNotIn(paid.id, ids)
        self.assertEqual(r.data["summary"]["students"], 1)

    def test_fee_slip_downloads_as_pdf_with_receiver(self):
        self.api.patch(f"/api/fees/payments/{self.challan.id}/", {"status": "paid", "received_by_name": "Miss Amna"}, format="json")
        r = self.api.get(f"/api/fees/payments/{self.challan.id}/slip/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertTrue(r.content.startswith(b"%PDF"))

    def test_student_can_download_own_slip_but_not_someone_elses(self):
        student = APIClient()
        student.force_authenticate(self.ali)
        self.assertEqual(student.get(f"/api/fees/payments/{self.challan.id}/slip/").status_code, 200)
        theirs = FeePayment.objects.create(student=self.other, amount=2500, due_date=date(2026, 10, 10), month=OCT)
        self.assertEqual(student.get(f"/api/fees/payments/{theirs.id}/slip/").status_code, 404)

    def test_generate_month_endpoint_is_safe_to_press_twice(self):
        FeePayment.objects.all().delete()
        from accounts.models import StudentRoster

        StudentRoster.objects.update(created_at="2026-01-05T00:00:00Z")
        first = self.api.post("/api/fees/payments/generate-month/", {"month": "2026-10"}, format="json")
        second = self.api.post("/api/fees/payments/generate-month/", {"month": "2026-10"}, format="json")
        self.assertEqual(first.data["created"], 2)
        self.assertEqual(second.data["created"], 0)
