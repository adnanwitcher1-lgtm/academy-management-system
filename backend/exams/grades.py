"""Percentage -> grade, used on result cards and the student profile."""

GRADES = [(90, "A+"), (80, "A"), (70, "B+"), (60, "B"), (50, "C"), (40, "D"), (0, "F")]


def grade_for(percentage):
    for floor, grade in GRADES:
        if percentage >= floor:
            return grade
    return "F"
