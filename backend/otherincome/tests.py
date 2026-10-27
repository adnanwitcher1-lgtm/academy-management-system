from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.factories import make_admin, make_student, make_teacher


class OtherCollectionTests(TestCase):
    def setUp(self):
        self.admin = make_admin()
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_add_list_and_summary(self):
        r = self.client.post(
            "/api/collections/",
            {"date": date.today().isoformat(), "category": "notes", "item": "Chemistry notes", "quantity": 2,
             "amount": "600", "payer_name": "Walk-in child"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["received_by_name"], "Admin User")
        self.assertEqual(r.json()["paid_by"], "Walk-in child")
        self.assertEqual(len(self.client.get("/api/collections/").json()), 1)
        s = self.client.get("/api/collections/summary/").json()
        self.assertEqual(s["month_total"], 600.0)
        self.assertEqual(s["by_category"][0]["label"], "Notes")

    def test_amount_must_be_positive(self):
        r = self.client.post("/api/collections/", {"date": date.today().isoformat(), "item": "x", "amount": "0"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_student_and_teacher_blocked(self):
        for user in (make_student(), make_teacher()):
            c = APIClient()
            c.force_authenticate(user)
            self.assertEqual(c.get("/api/collections/").status_code, 403)

    def test_counts_in_dashboard_income(self):
        self.client.post("/api/collections/", {"date": date.today().isoformat(), "item": "Sheets", "category": "sheets", "amount": "1500"}, format="json")
        d = self.client.get("/api/dashboard/summary/").json()["finance"]
        self.assertEqual(d["other_income"], 1500.0)
        self.assertEqual(d["income"], 1500.0)
        self.assertEqual(d["net"], 1500.0)
        self.assertFalse(d["is_loss"])
