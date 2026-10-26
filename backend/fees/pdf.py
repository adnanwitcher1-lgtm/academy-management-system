"""The fee slip / receipt PDF for one challan."""

from reportlab.lib.units import mm

from config.pdf_common import P, build_pdf, fmt_date, header_block, key_value_table, money, spacer


def _student_info(user):
    profile = getattr(user, "student_profile", None)
    entry = getattr(profile, "roster_entry", None) if profile else None
    klass = getattr(entry, "school_class", None) if entry else None
    return {
        "name": (entry.full_name if entry and entry.full_name else user.get_full_name()) or user.username,
        "father": entry.father_name if entry else "",
        "roll": entry.roll_no if entry else "",
        "class": str(klass) if klass else (entry.class_name if entry else ""),
    }


def fee_slip_response(payment):
    info = _student_info(payment.student)
    paid = payment.status == "paid"
    title = "FEE RECEIPT" if paid else "FEE CHALLAN"
    rows = [
        ("Challan no", payment.challan_no),
        ("Student", info["name"]),
        ("Father name", info["father"] or "-"),
        ("Roll no / Class", f"{info['roll'] or '-'} / {info['class'] or '-'}"),
        ("For month", payment.month.strftime("%B %Y") if payment.month else "-"),
        ("Due date", fmt_date(payment.due_date)),
        ("Monthly fee", money(payment.amount)),
    ]
    if payment.arrears:
        rows.append(("Previous dues (arrears)", money(payment.arrears)))
    if payment.fine:
        rows.append(("Fine" + (f" ({payment.fine_note})" if payment.fine_note else ""), money(payment.fine)))
    rows.append(("TOTAL", money(payment.total)))
    rows.append(("Status", "PAID" if paid else ("CARRIED FORWARD" if payment.status == "carried" else "PENDING")))
    if paid:
        rows.append(("Paid on", fmt_date(payment.paid_on)))
        rows.append(("Received by", payment.received_by_name or "-"))
    story = [
        header_block(title),
        spacer(5),
        key_value_table(rows),
        spacer(14),
        P("Signature of receiver: ______________________", "normal"),
        spacer(4),
        P("This is a computer generated slip." if paid else "Please pay on or before the due date.", "small"),
    ]
    return build_pdf(story, f"fee-slip-{payment.challan_no}.pdf")
