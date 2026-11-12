# -*- coding: utf-8 -*-
"""Option B script: docs/presentation/option-b/Presentation-Script-Option-B.docx (Tahoma only, WPS-safe).
Matches the deck made by edit_option_b.py."""
from pathlib import Path
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = Path(__file__).parent.parent.parent / "presentation" / "option-b" / "Presentation-Script-Option-B.docx"
TITLE = "Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning for NeoFit Fitness Gym"
JAY, LIZA, RUSEL, EFREN, CARL, RAYLA = ("Jay Mark A. Reños", "Liza Mae C. Sugala", "Rusel R. Portes",
                                       "Efren S. Cabudbud Jr.", "Carl Vey P. Sente", "Rayla G. Lanaza")

SLIDES = [
    (1, "Cover", JAY, [
        f"Good day, panel. We are presenting the {TITLE}.",
        "Our team: Jay Mark Reños, project manager; Liza Mae Sugala, systems analyst; Rusel Portes, team leader and lead developer; "
        "Efren Cabudbud, database and QA; Carl Vey Sente, UI/UX; and Rayla Lanaza, documentation.",
        "In short: NeoFit keeps its logbook, and the system turns its pages into revenue records."]),
    (2, "NeoFit's logbook is still on paper", LIZA, [
        "NeoFit writes every check-in and payment in a paper logbook, one “name – amount” line per entry, and those "
        "pages are the gym's only record. That causes four problems.",
        "One, the revenue is added up by hand, page by page. Two, wrong amounts and double entries slip into the totals. Three, "
        "paper records are hard to search and easy to lose. Four, putting the logbook into a system by typing every line would "
        "be slow and tiring for the staff.",
        "That is why we scan the page: the system reads the logbook, so no one has to encode it by hand."]),
    (3, "How the system works", LIZA, [
        "The system works in five steps. The staff take a photo of the logbook page. AI reads the names and amounts. The staff "
        "fix only the rows the system flags. The records sync to the cloud, or wait on the phone if there is no internet. Then "
        "the owner sees the revenue.",
        "There are two apps: a mobile app for the staff and the owner on Android, and a desktop admin app on Windows."]),
    (4, "Six core features", RUSEL, [
        "These are our six core features.",
        "One, AI logbook scanning: Google Gemini 2.5 Flash reads the page when online; Google ML Kit reads it on the phone when "
        "offline.",
        "Two, rate-table check: any amount that is not an official NeoFit rate is flagged so the staff can fix it before saving.",
        "Three, offline-first sync: scans wait on the phone and upload automatically later.",
        "Four, revenue analytics: daily, weekly, monthly and yearly totals, charts, and a Word report.",
        "Five, gym management on the desktop: members and rates.",
        "Six, role-based access: the staff scan logbooks; only the owner sees the revenue and manages the staff.",
        "Next, the prototype."]),
    (5, "Scan a logbook page", CARL, [
        "This is the staff side of the mobile app.",
        "1. Sign in. The session stays signed in on the device.",
        "2. Capture. Line up the page in the frame. The staff can pick an earlier date for older pages, and a counter shows the "
        "AI scans left for the day.",
        "3. Review. The AI results appear as editable rows. Lorraine's 75 is flagged because it is not a NeoFit rate; the staff "
        "corrects it to 70.",
        "4. Saved. The screen shows the date, the number of entries and the total.",
        "5. My uploads. Each upload shows whether it is synced or still pending."]),
    (6, "Monitor revenue and staff", CARL, [
        "This is the owner's side of the mobile app. The owner can also scan, using the same flow as the staff.",
        "Dashboard: revenue for today, this week, this month and this year, and a 7-day chart.",
        "Revenue history: every upload, with the name of the staff member who scanned it. Tap one to see its entries.",
        "Staff accounts: the owner can disable or re-enable a staff account.",
        "Settings: edit the profile, change the password, check the sync status, and export revenue records as CSV."]),
    (7, "Dashboard and members", EFREN, [
        "This is the desktop admin app on the gym's Windows computer.",
        "Dashboard: active members, and today's, this month's and this year's revenue. It also lists members whose plans have "
        "expired or will expire soon.",
        "Members: the full member list with photos and plans. The admin can search by name or ID, filter by status, and add, "
        "edit or renew a member."]),
    (8, "Official rates", EFREN, [
        "This is NeoFit's official price table.",
        "Every scanned amount is checked against it, and an amount that is not a NeoFit rate is flagged before saving. When the "
        "owner changes a price here, all revenue figures use the new rate right away."]),
    (9, "Revenue and logbook sync", RUSEL, [
        "Revenue: the month's total, a daily chart with the peak day, and breakdowns by source and by plan. If the same payment "
        "appears in a scanned page and in a member's payment, it is counted only once. The report downloads as a Word document.",
        "Logbook: this is where the phone scans arrive, grouped by date. It is the same page we scanned earlier; Lorraine now "
        "shows 70 because the staff corrected it. The admin can still edit or delete entries."]),
    (10, "Technology stack", RUSEL, [
        "The mobile app uses React Native with Expo and TypeScript. The AI is Google Gemini 2.5 Flash when online and Google ML "
        "Kit on the phone when offline. The cloud is Supabase: a PostgreSQL database, sign-in, and row-level security so the "
        "staff can only write their own uploads. The desktop app uses Electron, React and Vite, with a local Express API and a "
        "SQLite database.",
        "All of these are open source or have free tiers, which keeps the project within budget."]),
    (11, "Scope and limitations", RAYLA, [
        "Scope: one client, NeoFit Fitness Gym, one branch. An Android app for the staff and the owner, and a Windows desktop "
        "admin app. It reads handwritten names and amounts.",
        "Limitations: it needs readable handwriting and good light. Offline reading is less accurate than the online AI. AI scans "
        "are limited to five per day to control cost. And it does not process online payments."]),
    (12, "Salamat!", RAYLA, [
        "That is our system. Salamat, thank you, panel. We welcome your questions and suggestions."]),
]

QUESTIONS = [
    ("Are you trying to impress NeoFit, or to solve their problem?",
     "To solve it. The core is NeoFit's revenue: it is added up by hand from paper today. The AI has one job, reading the "
     "logbook so nobody has to encode it by hand. Every other feature serves the revenue.", JAY),
    ("Why not let the staff type the entries directly?",
     "Typing every line into a system is exactly the slow and tiring part we want to remove. With scanning, the staff keep "
     "writing the logbook as they do now, and one photo per page replaces encoding every line.", LIZA),
    ("Isn't scanning another process?",
     "It replaces two: adding up the pages by hand and encoding them. It is one photo per page, and the staff review only the "
     "rows the system flags.", LIZA),
    ("How accurate is the AI?",
     "There are three safeguards: each amount is checked against NeoFit's rates, repeated lines are flagged, and nothing is "
     "saved until a person confirms the page. When a digit cannot be read, the amount is left blank instead of guessed. We "
     "will measure the accuracy on real NeoFit pages during testing.", RUSEL),
    ("What if there is no internet?",
     "The phone reads the page offline with Google ML Kit, and the confirmed page waits on the phone and uploads when the "
     "connection returns.", RUSEL),
    ("Why only five AI scans per day?",
     "To stay within the free quota of the Gemini API. After five, the offline reader on the phone still works.", RUSEL),
    ("Does NeoFit need a computer?",
     "The desktop app runs on one Windows computer. Scanning and the owner's revenue view work on the phones alone.", EFREN),
]

TOPICS = [("Problem and requirements", LIZA), ("AI, scanning, sync and code", RUSEL),
          ("Database, desktop app and data", EFREN), ("Screens and design", CARL),
          ("Schedule and documents", f"{JAY}, {RAYLA}")]

# ------------------------------------------------------------------ document (same layout as build_script.py)
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
table([["Topic", "Answered by"]] + [[t, w] for t, w in TOPICS], [Inches(3.2), Inches(3.3)])

zoom = doc.settings.element.find(qn("w:zoom"))
if zoom is not None: zoom.set(qn("w:percent"), "100")
doc.core_properties.title = "Presentation Script"
doc.core_properties.author = "Capstone Team"
doc.save(OUT)
print("saved", OUT)
