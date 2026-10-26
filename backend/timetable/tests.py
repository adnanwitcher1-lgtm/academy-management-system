from django.test import TestCase
from rest_framework.test import APIClient

from accounts.factories import make_admin, make_class, make_student, make_subject, make_teacher

from .models import TimetableSlot


class TimetableCellTests(TestCase):
    def setUp(self):
        self.admin = make_admin()
        self.klass = make_class("10th")
        self.other_class = make_class("9th")
        self.shahzaib = make_teacher("t1", "Sir Shahzaib")
        self.noor = make_teacher("t2", "Miss Noor")
        self.bio = make_subject(self.klass, "Bio", "BIO10", self.shahzaib)
        self.comp = make_subject(self.klass, "Comp", "COMP10", self.noor)
        self.phy = make_subject(self.klass, "Physics", "PHY10", self.noor)
        self.bio9 = make_subject(self.other_class, "Bio", "BIO9", self.shahzaib)
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def save(self, subjects, days="all", start="15:00", end="15:30", klass=None):
        return self.api.post(
            "/api/timetable/slots/set-cell/",
            {"school_class": (klass or self.klass).id, "days": days, "start_time": start, "end_time": end,
             "subject_ids": [s.id for s in subjects]},
            format="json",
        )

    def test_one_slot_can_hold_several_subjects_for_the_whole_week(self):
        r = self.save([self.bio, self.comp])
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(TimetableSlot.objects.filter(school_class=self.klass).count(), 12)  # 2 subjects x 6 days
        monday = self.api.get(f"/api/timetable/slots/?school_class={self.klass.id}").data
        rows = monday["results"] if isinstance(monday, dict) else monday
        names = {x["subject_name"] for x in rows if x["day_of_week"] == "Monday"}
        self.assertEqual(names, {"Bio", "Comp"})

    def test_saving_a_cell_again_replaces_it(self):
        self.save([self.bio, self.comp], days=["Monday"])
        self.save([self.phy], days=["Monday"])
        subjects = set(TimetableSlot.objects.filter(day_of_week="Monday").values_list("subject__name", flat=True))
        self.assertEqual(subjects, {"Physics"})

    def test_overlapping_but_different_times_are_refused(self):
        self.save([self.bio], days=["Monday"], start="15:00", end="16:00")
        r = self.save([self.phy], days=["Monday"], start="15:30", end="16:30")
        self.assertEqual(r.status_code, 400)
        self.assertIn("overlaps", r.data["detail"])

    def test_a_teacher_cannot_be_in_two_classes_at_once(self):
        self.save([self.bio], days=["Monday"])
        r = self.save([self.bio9], days=["Monday"], klass=self.other_class)
        self.assertEqual(r.status_code, 400)
        self.assertIn("already teaching", r.data["detail"])

    def test_subject_of_another_class_is_refused(self):
        self.assertEqual(self.save([self.bio9]).status_code, 400)

    def test_delete_cell_and_clear_day(self):
        self.save([self.bio, self.comp], days=["Monday", "Tuesday"])
        d = self.api.post("/api/timetable/slots/delete-cell/", {"school_class": self.klass.id, "days": ["Monday"], "start_time": "15:00", "end_time": "15:30"}, format="json")
        self.assertEqual(d.data["deleted"], 2)
        self.assertEqual(TimetableSlot.objects.count(), 2)
        c = self.api.post("/api/timetable/slots/clear-day/", {"day": "Tuesday"}, format="json")
        self.assertEqual(c.data["deleted"], 2)
        self.assertEqual(TimetableSlot.objects.count(), 0)

    def test_copy_day_to_the_rest_of_the_week(self):
        self.save([self.bio, self.comp], days=["Monday"])
        r = self.api.post("/api/timetable/slots/copy-day/", {"from_day": "Monday", "to_days": "all"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(TimetableSlot.objects.filter(day_of_week="Saturday").count(), 2)

    def test_students_only_see_their_own_class_and_cannot_edit(self):
        self.save([self.bio], days=["Monday"])
        self.save([self.bio9], days=["Tuesday"], klass=self.other_class)
        student = make_student("R001", "Ali", klass=self.klass)
        c = APIClient(); c.force_authenticate(student)
        data = c.get("/api/timetable/slots/").data
        rows = data["results"] if isinstance(data, dict) else data
        self.assertEqual({x["class_label"] for x in rows}, {"10th"})
        r = c.post("/api/timetable/slots/set-cell/", {"school_class": self.klass.id, "days": "all", "start_time": "10:00", "end_time": "11:00", "subject_ids": [self.bio.id]}, format="json")
        self.assertEqual(r.status_code, 403)
