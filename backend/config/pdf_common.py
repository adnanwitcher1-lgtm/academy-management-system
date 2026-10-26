"""Shared building blocks for every PDF the academy prints (fee slips, result cards, student profiles)."""

from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ACADEMY_NAME = "KEEN EVENING COACHING"
ADDRESS = "Goal Park, Raheem Garden, Muzaffar colony street # 23"
LOGO = Path(settings.BASE_DIR) / "assets" / "keen-logo.png"

INK = colors.HexColor("#21262B")
MUTED = colors.HexColor("#5A6672")
LINE = colors.HexColor("#D9E2EC")
CYAN = colors.HexColor("#00B8D4")
SOFT = colors.HexColor("#E6FBFE")

_base = getSampleStyleSheet()
STYLES = {
    "title": ParagraphStyle("t", parent=_base["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=INK, alignment=TA_CENTER, spaceAfter=0),
    "sub": ParagraphStyle("s", parent=_base["Normal"], fontName="Helvetica", fontSize=10, leading=13, textColor=MUTED, alignment=TA_CENTER),
    "doc": ParagraphStyle("d", parent=_base["Normal"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=INK, alignment=TA_CENTER, spaceBefore=4, spaceAfter=2),
    "section": ParagraphStyle("sec", parent=_base["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=INK, spaceBefore=10, spaceAfter=3),
    "normal": ParagraphStyle("n", parent=_base["Normal"], fontName="Helvetica", fontSize=9.5, leading=12.5, textColor=INK),
    "bold": ParagraphStyle("b", parent=_base["Normal"], fontName="Helvetica-Bold", fontSize=9.5, leading=12.5, textColor=INK),
    "small": ParagraphStyle("sm", parent=_base["Normal"], fontName="Helvetica", fontSize=8, leading=10, textColor=MUTED),
    "right": ParagraphStyle("r", parent=_base["Normal"], fontName="Helvetica", fontSize=9.5, leading=12.5, textColor=INK, alignment=TA_RIGHT),
}


def P(text, style="normal"):
    return Paragraph(str(text), STYLES[style])


def spacer(mm_height=3):
    return Spacer(1, mm_height * mm)


def money(value):
    value = Decimal(value or 0)
    return "Rs {:,.0f}".format(value) if value == value.to_integral_value() else "Rs {:,.2f}".format(value)


def fmt_date(value):
    if not value:
        return "-"
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, str):
        try:
            value = date.fromisoformat(value[:10])
        except ValueError:
            return value
    return value.strftime("%d %b %Y")


def header_block(document_title, line=""):
    """Logo, academy name, address and the document title, centred at the top of the page."""
    center = [P(ACADEMY_NAME, "title"), P(ADDRESS, "sub")]
    if line:
        center.append(P(line, "sub"))
    center.append(P(document_title, "doc"))
    cells = [[Image(str(LOGO), 18 * mm, 18 * mm) if LOGO.exists() else "", center, Image(str(LOGO), 18 * mm, 18 * mm) if LOGO.exists() else ""]]
    table = Table(cells, colWidths=[24 * mm, 138 * mm, 24 * mm])
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, 0), 1.2, CYAN), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return table


def key_value_table(rows, col_widths=(48 * mm, 134 * mm)):
    data = [[P(k, "bold"), P(v if v not in (None, "") else "-")] for k, v in rows]
    table = Table(data, colWidths=list(col_widths))
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("BACKGROUND", (0, 0), (0, -1), SOFT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def grid_table(headers, rows, col_widths, right_cols=()):
    data = [[P(h, "bold") for h in headers]] + [
        [P(c, "right" if i in right_cols else "normal") for i, c in enumerate(r)] for r in rows
    ]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("BACKGROUND", (0, 0), (-1, 0), SOFT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table


def build_pdf(story, filename):
    """Render the story to an A4 PDF and return it as a download response."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=12 * mm, rightMargin=12 * mm, topMargin=10 * mm, bottomMargin=12 * mm, title=filename, author=ACADEMY_NAME)

    def footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(12 * mm, 7 * mm, f"{ACADEMY_NAME} - printed {date.today().strftime('%d %b %Y')}")
        canvas.drawRightString(A4[0] - 12 * mm, 7 * mm, f"Page {_doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response
