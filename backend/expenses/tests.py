from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.factories import make_admin, make_class, make_student
from fees.models import FeePayment

from .models import Expense


class DashboardFinanceTests(TestCase):
    def setUp(self):
        self.admin = make_admin()
        self.ali = make_student("R001", "Ali Raza", klass=make_class("10th"))
        self.api = APIClient()
        self.api.force_authenticate(self.admin)
        self.today = date.today()
        self.first = self.today.replace(day=1)

    def finance(self):
        r = self.api.get("/api/dashboard/summary/")
        self.assertEqual(r.status_code, 200, r.content)
        return r.data["finance"]

    def test_income_is_what_was_received_and_a_loss_is_flagged(self):
        FeePayment.objects.create(student=self.ali, amount=2000, fine=500, due_date=self.first, month=self.first, status="paid", paid_on=self.today)
        Expense.objects.create(title="Rent", amount=3000, date=self.today, category="Rent")
        f = self.finance()
        self.assertEqual(f["income"], 2500)
        self.assertEqual(f["expenses"], 3000)
        self.assertEqual(f["net"], -500)
        self.assertTrue(f["is_loss"])

    def test_profit_when_income_is_higher(self):
        FeePayment.objects.create(student=self.ali, amount=5000, due_date=self.first, month=self.first, status="paid", paid_on=self.today)
        Expense.objects.create(title="Tea", amount=1000, date=self.today, category="Misc")
        f = self.finance()
        self.assertEqual(f["net"], 4000)
        self.assertFalse(f["is_loss"])
        self.assertEqual(len(f["months"]), 6)

    def test_unpaid_fees_show_as_pending_and_top_defaulters(self):
        FeePayment.objects.create(student=self.ali, amount=2500, fine=100, due_date=self.first.replace(day=10), month=self.first)
        f = self.finance()
        self.assertEqual(f["pending_total"], 2600)
        self.assertEqual(f["top_defaulters"][0]["student"], "Ali Raza")

    def test_only_admins_see_the_dashboard(self):
        s = APIClient(); s.force_authenticate(self.ali)
        self.assertEqual(s.get("/api/dashboard/summary/").status_code, 403)
