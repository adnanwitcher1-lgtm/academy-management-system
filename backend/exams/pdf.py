"""Result card PDF: one student, one exam."""

from reportlab.lib.units import mm

from accounts.serializers import display_name
from config.pdf_common import P, build_pdf, fmt_date, grid_table, header_block, key_value_table, spacer

from .grades import grade_for
from .models import Mark


def result_card_response(exam, student):
    profile = getattr(student, "student_profile", None)
    entry = getattr(profile, "roster_entry", None) if profile else None
    klass = getattr(entry, "school_class", None) if entry else None

    marks = list(Mark.objects.select_related("subject").filter(exam=exam, student=student).order_by("subject__name"))
    obtained = sum(float(m.obtained_marks) for m in marks)
    total = sum(float(m.total_marks) for m in marks)
    pct = round(obtained / total * 100, 2) if total else 0

    rows = []
    for m in marks:
        o, t = float(m.obtained_marks), float(m.total_marks)
        p = round(o / t * 100, 1) if t else 0
        rows.append([m.subject.name, f"{o:g}", f"{t:g}", f"{p:g}%", grade_for(p)])
    rows.append(["TOTAL", f"{obtained:g}", f"{total:g}", f"{pct:g}%", grade_for(pct)])

    story = [
        header_block("RESULT CARD", exam.name),
        spacer(5),
        key_value_table([
            ("Student", display_name(student)),
            ("Father name", entry.father_name if entry else ""),
            ("Roll no", entry.roll_no if entry else ""),
            ("Class", str(klass) if klass else (entry.class_name if entry else "")),
            ("Exam", f"{exam.name} ({fmt_date(exam.date)})"),
        ]),
        spacer(5),
    ]
    if marks:
        story.append(grid_table(["Subject", "Obtained", "Total", "Percentage", "Grade"], rows,
                                [70 * mm, 28 * mm, 28 * mm, 32 * mm, 24 * mm], right_cols=(1, 2, 3, 4)))
        story += [spacer(4), P(f"Overall: {obtained:g} / {total:g} - {pct:g}% - Grade {grade_for(pct)}", "bold")]
    else:
        story.append(P("No marks have been entered for this student in this exam yet."))
    story += [spacer(16), P("Principal signature: ______________________", "normal")]
    return build_pdf(story, f"result-card-{entry.roll_no if entry else student.pk}-{exam.pk}.pdf")
