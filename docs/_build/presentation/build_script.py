# -*- coding: utf-8 -*-
"""Builds docs/presentation/Presentation-Script.docx: who presents which slide, what to say, and
prepared answers to the questions the panel is likely to ask. Tahoma only (WPS-safe)."""
from pathlib import Path
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = Path(__file__).parent.parent.parent / "presentation" / "Presentation-Script.docx"
TITLE = "Revenue Monitoring and Payment Recording System for NeoFit Fitness Gym"
JAY, LIZA, RUSEL, EFREN, CARL, RAYLA = ("Jay Mark A. Reños", "Liza Mae C. Sugala", "Rusel R. Portes",
                                       "Efren S. Cabudbud Jr.", "Carl Vey P. Sente", "Rayla G. Lanaza")

SLIDES = [
    (1, "Cover", JAY, [
        f"Good day, panel. We are presenting the {TITLE}.",
        "Our team: Jay Mark Reños, project manager; Liza Mae Sugala, systems analyst; Rusel Portes, team leader and lead developer; "
        "Efren Cabudbud, database and QA; Carl Vey Sente, UI/UX; and Rayla Lanaza, documentation.",
        "Our goal is simple: help NeoFit know its revenue, accurately and on time."]),
    (2, "NeoFit's logbook is still on paper", LIZA, [
        "Today, NeoFit's front desk writes every check-in and payment in a paper logbook, one line per entry: the name and the amount. "
        "That paper is the gym's only record.",
        "This causes four problems. One, the revenue is added up by hand, page by page. Two, wrong amounts and double entries go "
        "unnoticed: on this sample page, line 6 says 75, which is not a NeoFit rate, and Ian is written twice. Three, the owner has "
        "no timely view of the revenue. Four, paper is hard to search and easy to lose."]),
    (3, "Record it once, see the revenue at once", LIZA, [
        "Our solution replaces the paper, not the routine.",
        "Today, the staff write the name and amount, someone tallies by hand, and the owner waits for the total. With our system, the "
        "staff type the same name and amount on an Android phone or tablet. The system checks it and saves it, and the totals update "
        "for the owner right away.",
        "There is no extra step: typing replaces writing, and the tally disappears."]),
    (4, "Built around NeoFit's revenue", RUSEL, [
        "These are our six core features.",
        "One, quick entry: type the name and amount, or tap one of NeoFit's rates. Two, rate check: an amount that is not a NeoFit "
        "rate is flagged before saving. Three, double-entry warning: the same name and amount twice in a day is flagged. Four, live "
        "revenue for today, this week, this month and this year. Five, search and reports: find any past entry and download monthly "
        "reports. Six, staff accounts: every entry shows who recorded it, and only the owner sees the revenue."]),
    (5, "Record an entry", CARL, [
        "This is the front desk.",
        "1. Sign in: each staff member has an account.",
        "2. Record: type the name, then type the amount or tap a rate. The app shows which plan the amount matches.",
        "3. Rate check: Lorraine's 75 is not a NeoFit rate, so the app asks the staff to fix it before saving.",
        "4. Double entry: Ian's 450 was already recorded at 7:55, so the app asks before saving it again.",
        "5. Today's list: every entry with its time, and the total for the day."]),
    (6, "Monitor the revenue", CARL, [
        "This is the owner's side.",
        "Dashboard: the revenue for today, this week, this month and this year, the last seven days, and the revenue by plan.",
        "History: the total of each day; tap a day to see its entries.",
        "Search: type a name to see all of that person's payments.",
        "Reports: a monthly summary the owner can download as PDF or share."]),
    (7, "Rates and staff accounts", EFREN, [
        "The owner keeps two things up to date.",
        "The official rates: every amount typed at the front desk is checked against this table. When NeoFit changes a price, the "
        "owner updates it here.",
        "The staff accounts: each staff member signs in with an account, so every entry shows who recorded it. The owner can disable "
        "an account when someone leaves."]),
    (8, "Each problem has a direct answer", JAY, [
        "To sum up the solution: each feature answers one of NeoFit's problems.",
        "Revenue added up by hand: the totals update with every entry. Wrong amounts and double entries: they are checked when the "
        "entry is typed. No timely view: the owner's dashboard. Paper that is hard to search and easy to lose: searchable records kept "
        "in the cloud.",
        "We kept only the features that solve these problems."]),
    (9, "Import the past logbook pages", RUSEL, [
        "This one is optional.",
        "NeoFit already has pages written before the system. The app can read those old pages once with AI; the owner checks the "
        "flagged rows and imports them. That gives the owner revenue history from the first day.",
        "It is not part of the daily routine: new entries are always typed directly. If the panel prefers, we can leave it out; the "
        "core system does not depend on it."]),
    (10, "Technology stack", EFREN, [
        "The app is built with React Native and Expo in TypeScript, for Android. The database and sign-in run on Supabase: "
        "PostgreSQL, authentication, and row-level security so each account reaches only its own functions. Reports are generated as "
        "PDF on the phone. The optional import uses the Google Gemini API.",
        "All of these are open source or have free tiers, and NeoFit needs no new computer: the app runs on an Android phone or "
        "tablet at the front desk."]),
    (11, "Scope and limitations", RAYLA, [
        "Scope: NeoFit Fitness Gym, one branch; an Android app for the front desk and the owner; payments recorded as name and "
        "amount; and a revenue dashboard, search and PDF reports.",
        "Limitations: the system records only what the staff enter; it does not process online payments; it needs internet to sync, "
        "although entries wait safely on the phone; and the optional old-page import depends on the handwriting."]),
    (12, "Salamat!", RAYLA, [
        "That is our system. Salamat, thank you, panel. We welcome your questions and suggestions."]),
]

QUESTIONS = [
    ("Isn't typing on the phone also an extra process?",
     "No. The staff already write every entry by hand; typing replaces the writing. What disappears is the slow part: adding up "
     "the pages by hand.", LIZA),
    ("Why not use AI to read the logbook every day?",
     "Reading photos adds a step and can misread handwriting. Typing the entry directly is faster and exact. AI is only an optional, "
     "one-time import of old pages.", RUSEL),
    ("Are you solving NeoFit's problem or trying to impress them?",
     "Every feature answers one of NeoFit's four problems (slide 8). We removed what did not: the logbook photo scanning is no "
     "longer part of the daily work.", JAY),
    ("How is this different from using a spreadsheet?",
     "A spreadsheet still needs someone to type, add and check everything on a computer. Our app checks each amount against the "
     "rates when it is typed, warns about double entries, shows who recorded each entry, and gives the owner live totals on the "
     "phone.", RUSEL),
    ("What if there is no internet at the gym?",
     "Entries are saved on the phone and upload when the connection returns, so nothing is lost and the front desk keeps working.", RUSEL),
    ("What if the staff type a wrong name or amount?",
     "Wrong amounts are flagged by the rate check before saving. An entry can still be corrected afterward, and every entry shows who "
     "recorded it.", EFREN),
    ("Does NeoFit need to buy a computer?",
     "No. The app runs on an Android phone or tablet at the front desk.", EFREN),
    ("Why is revenue the core of the system?",
     "Because NeoFit's problem is knowing its revenue accurately and on time. Recording payments is how the revenue data is "
     "captured, and monitoring is how the owner uses it.", LIZA),
]

ANSWERS_BY_TOPIC = [("Problem and requirements", LIZA), ("App features, AI import and code", RUSEL),
                    ("Database, rates and data", EFREN), ("Screens and design", CARL),
                    ("Schedule and documents", f"{JAY}, {RAYLA}")]

# ------------------------------------------------------------------ document
doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
    setattr(sec, side, Inches(1))


def set_font(style, size, bold=None, color=None):
    style.font.name = "Tahoma"
    rpr = style.element.get_or_add_rPr()
    rf = rpr.get_or_add_rFonts()
    for a in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
        rf.attrib.pop(qn(a), None)
    for a in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rf.set(qn(a), "Tahoma")
    style.font.size = Pt(size)
    if bold is not None: style.font.bold = bold
    if color: style.font.color.rgb = RGBColor.from_string(color)


normal = doc.styles["Normal"]
set_font(normal, 12)
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.line_spacing = 1.15
for name, size in (("Title", 22), ("Heading 1", 16), ("Heading 2", 14)):
    st = doc.styles[name]
    set_font(st, size, bold=True, color="111827")
    st.paragraph_format.space_before = Pt(0 if name == "Title" else 14)
    st.paragraph_format.space_after = Pt(4)
    st.paragraph_format.keep_with_next = True


def shade(cell, fill):
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(shd)


def table(rows, widths):
    t = doc.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            cell = t.cell(r, c); cell.width = widths[c]
            p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(2)
            run = p.add_run(val); run.font.size = Pt(11)
            if r == 0: run.bold = True; shade(cell, "E3F1EA")


def ranges(ns):
    out, i = [], 0
    while i < len(ns):
        j = i
        while j + 1 < len(ns) and ns[j + 1] == ns[j] + 1: j += 1
        out.append(str(ns[i]) if i == j else f"{ns[i]}–{ns[j]}"); i = j + 1
    return ", ".join(out)


doc.add_paragraph("Presentation Script", style="Title")
p = doc.add_paragraph(); r = p.add_run("Capstone Project 1 · Title Hearing · 12 slides"); r.font.color.rgb = RGBColor.from_string("5B6270")
p = doc.add_paragraph(); r = p.add_run(TITLE); r.italic = True

doc.add_paragraph("Who presents what", style="Heading 1")
order, nums, titles = [], {}, {}
for n, t, who, _ in SLIDES:
    if who not in nums: order.append(who)
    nums.setdefault(who, []).append(n); titles.setdefault(who, []).append(t)
table([["Presenter", "Slides", "Topics"]] + [[w, ranges(nums[w]), "; ".join(titles[w])] for w in order],
      [Inches(2.1), Inches(0.9), Inches(3.5)])

doc.add_paragraph("Script", style="Heading 1")
for n, t, who, lines in SLIDES:
    doc.add_paragraph(f"Slide {n} · {t}", style="Heading 2")
    p = doc.add_paragraph(); p.paragraph_format.keep_with_next = True
    r = p.add_run(f"Presenter: {who}"); r.bold = True; r.font.color.rgb = RGBColor.from_string("08694F")
    for line in lines:
        doc.add_paragraph(line)

doc.add_paragraph("Expected questions", style="Heading 1")
doc.add_paragraph("Short answers to the questions the panel is most likely to ask, with who answers each one.")
for q, a, who in QUESTIONS:
    p = doc.add_paragraph(); p.paragraph_format.keep_with_next = True; p.paragraph_format.space_before = Pt(8)
    r = p.add_run(f"Q: {q}"); r.bold = True
    p = doc.add_paragraph(); r = p.add_run(f"A ({who.split()[0]}): "); r.bold = True; r.font.color.rgb = RGBColor.from_string("08694F")
    p.add_run(a)

doc.add_paragraph("Q&A guide", style="Heading 1")
doc.add_paragraph("Who answers which kind of question from the panel:")
table([["Topic", "Answered by"]] + [[t, w] for t, w in ANSWERS_BY_TOPIC], [Inches(3.2), Inches(3.3)])

zoom = doc.settings.element.find(qn("w:zoom"))
if zoom is not None: zoom.set(qn("w:percent"), "100")
doc.core_properties.title = "Presentation Script"
doc.core_properties.author = "Capstone Team"
doc.save(OUT)
print("saved", OUT)
