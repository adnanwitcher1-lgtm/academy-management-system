"""Small helpers that build users, classes and students for the tests."""

from academics.models import SchoolClass, Subject
from accounts.models import StudentProfile, StudentRoster, TeacherProfile, User


def make_admin(username="admin"):
    return User.objects.create_user(username, password="Pass12345!", role="admin", first_name="Admin", last_name="User")


def make_class(name="10th", fee=None):
    klass = SchoolClass.objects.create(name=name)
    if fee:
        from fees.models import FeeStructure

        FeeStructure.objects.create(school_class=klass, amount=fee)
    return klass


def make_teacher(username="t1", name="Sir Numan"):
    user = User.objects.create_user(username, password="Pass12345!", role="teacher", first_name=name)
    TeacherProfile.objects.create(user=user, subject_specialization="Chemistry")
    return user


def make_subject(klass, name="Chemistry", code=None, teacher=None):
    return Subject.objects.create(name=name, code=code or (name[:3].upper() + str(klass.id)), school_class=klass, teacher=teacher)


def make_student(roll="R001", name="Ali Raza", father="Raza Khan", klass=None, fee=None):
    klass = klass or make_class()
    roster = StudentRoster.objects.create(
        roll_no=roll, full_name=name, father_name=father, class_name=klass.name,
        school_class=klass, monthly_fee=fee, phone_number="03001234567", is_claimed=True,
    )
    user = User.objects.create_user(roll.lower(), password="Pass12345!", role="student", first_name=name)
    StudentProfile.objects.create(user=user, roster_entry=roster)
    return user
