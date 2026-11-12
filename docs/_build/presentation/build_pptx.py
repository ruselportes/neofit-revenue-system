# -*- coding: utf-8 -*-
"""Builds docs/presentation/Title-Presentation.pptx: the 12-slide title-hearing deck for
"Revenue Monitoring and Payment Recording System for NeoFit Fitness Gym" as an editable PowerPoint file
(Tahoma / Trebuchet MS only, so it opens correctly in WPS). Screens come from docs/presentation/screens,
made by docs/presentation/mockups/build.py."""
from pathlib import Path
from PIL import Image, ImageDraw
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

HERE = Path(__file__).parent
SCREENS = HERE.parent.parent / "presentation" / "screens"
ICONS = HERE / "icons"
FRAMES = HERE / "frames"; FRAMES.mkdir(exist_ok=True)
OUT = HERE.parent.parent / "presentation" / "Title-Presentation.pptx"

PX = 6350  # EMU per canvas pixel (1920 x 1080 canvas = 13.333 x 7.5 in)
TAHOMA, TREB = "Tahoma", "Trebuchet MS"
DARK, LIGHT, CARD_D, CARD_L = "0A0E1A", "F4F1E8", "131A2B", "FBFAF5"
MINT, TEAL, ORANGE, INK, MUTED = "00E5A0", "08694F", "C2410C", "111827", "4B5563"
TOTAL = 12
FOOT = "NeoFit Fitness Gym · Title hearing"
FOOT_PROTO = "Prototype screens · sample data"


def E(v): return Emu(int(round(v * PX)))


prs = Presentation()
prs.slide_width, prs.slide_height = E(1920), E(1080)
BLANK = prs.slide_layouts[6]


def new_slide(color):
    s = prs.slides.add_slide(BLANK)
    f = s.background.fill; f.solid(); f.fore_color.rgb = RGBColor.from_string(color)
    return s


def T(t, px, color=INK, bold=False, font=TAHOMA, spc=None, italic=False):
    return dict(t=t, px=px, c=color, b=bold, font=font, spc=spc, i=italic)


def text(slide, x, y, w, h, paras, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, line=1.15, gap=6):
    tb = slide.shapes.add_textbox(E(x), E(y), E(w), E(h))
    tf = tb.text_frame; tf.word_wrap = True; tf.auto_size = None; tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    if isinstance(paras, dict):
        paras = [[paras]]
    for i, runs in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align; p.line_spacing = line
        if i > 0: p.space_before = Pt(gap)
        for rs in (runs if isinstance(runs, list) else [runs]):
            r = p.add_run(); r.text = rs["t"]; f = r.font
            f.size = Pt(rs["px"] / 2); f.bold = rs["b"]; f.italic = rs["i"]; f.name = rs["font"]
            f.color.rgb = RGBColor.from_string(rs["c"])
            if rs["spc"]: r.font._element.set("spc", str(rs["spc"]))
    return tb


def rect(slide, x, y, w, h, fill, line=None, radius=0, shape=None):
    kind = shape or (MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE)
    sh = slide.shapes.add_shape(kind, E(x), E(y), E(w), E(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = RGBColor.from_string(fill)
    if line:
        sh.line.color.rgb = RGBColor.from_string(line); sh.line.width = Pt(0.75)
    else:
        sh.line.fill.background()
    if radius and kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        sh.adjustments[0] = min(0.5, radius / min(w, h))
    sh.shadow.inherit = False
    return sh


def header(slide, eyebrow, title, dark=False):
    text(slide, 128, 128, 1664, 34, T(eyebrow.upper(), 24, MINT if dark else TEAL, True, spc=300))
    text(slide, 128, 170, 1664, 80, T(title, 64, "EEF2F7" if dark else INK, True, TREB))


def footer(slide, n, left=FOOT, dark=False):
    c = "7C879B" if dark else "5B6270"
    text(slide, 128, 992, 1100, 30, T(left, 24, c))
    text(slide, 1392, 992, 400, 30, T(f"{n:02d} / {TOTAL}", 24, c), align=PP_ALIGN.RIGHT)


def phone(name, bg=LIGHT):
    out = FRAMES / f"{name}.png"
    im = Image.open(SCREENS / f"{name}.png").convert("RGB")
    h = 1600; w = int(im.width * h / im.height); im = im.resize((w, h))
    bez = 26
    frame = Image.new("RGB", (w + 2 * bez, h + 2 * bez), "#" + bg)
    ImageDraw.Draw(frame).rounded_rectangle([0, 0, frame.width - 1, frame.height - 1], radius=90, fill="#05070D")
    mask = Image.new("L", (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=66, fill=255)
    frame.paste(im, (bez, bez), mask); frame.save(out)
    return out


def add_phone(slide, name, x, y, w, bg=LIGHT):
    h = w * 583 / 280
    slide.shapes.add_picture(str(phone(name, bg)), E(x), E(y), E(w), E(h))
    return h


def bullets(slide, x, y, w, h, items, px=30, color="374151", mark="•  ", line=1.35, gap=18):
    return text(slide, x, y, w, h, [[T(mark, px, TEAL, True), T(it, px, color)] for it in items], line=line, gap=gap)


# ---------------- 1. Cover ----------------
s = new_slide(DARK)
text(s, 128, 250, 1000, 34, T("IT 428 · CAPSTONE PROJECT 1 · TITLE HEARING", 24, MINT, True, spc=300))
text(s, 128, 300, 1000, 330, T("Revenue Monitoring and Payment Recording System", 84, "EEF2F7", True, TREB), line=1.05)
text(s, 128, 640, 1000, 60, T("for NeoFit Fitness Gym", 48, MINT, True, TREB))
s.shapes.add_picture(str(SCREENS / "cover-hero.png"), E(1192), E(200), E(600), E(540))
team = [("J.M. Reños", "Project Manager"), ("L.M. Sugala", "Systems Analyst"), ("R. Portes", "Lead Developer"),
        ("E. Cabudbud Jr.", "Database & QA"), ("C.V. Sente", "UI/UX Designer"), ("R. Lanaza", "Documentation")]
cw = (1664 - 5 * 24) / 6
for i, (n, r) in enumerate(team):
    x = 128 + i * (cw + 24)
    rect(s, x, 934, cw, 2, MINT if i == 2 else "243049")
    text(s, x, 950, cw, 32, T(n, 24, "EEF2F7", True))
    text(s, x, 984, cw, 32, T(r, 24, "7C879B"))

# ---------------- 2. Problem ----------------
s = new_slide(LIGHT)
header(s, "Problem", "NeoFit's logbook is still on paper")
s.shapes.add_picture(str(SCREENS / "logbook-page.png"), E(128), E(282), E(540), E(660))
probs = [("clock-orange", "Revenue is added up by hand, page by page"),
         ("warning-orange", "Wrong amounts and double entries go unnoticed"),
         ("chart-orange", "The owner has no timely view of the revenue"),
         ("book-orange", "Paper records are hard to search and easy to lose")]
pw, ph = (1792 - 736 - 24) / 2, 250
for i, (icon, t) in enumerate(probs):
    x = 736 + (i % 2) * (pw + 24); y = 300 + (i // 2) * (ph + 24)
    rect(s, x, y, pw, ph, CARD_L, "DDD7C8", 20)
    s.shapes.add_picture(str(ICONS / f"{icon}.png"), E(x + 36), E(y + 36), E(52), E(52))
    text(s, x + 36, y + 110, pw - 72, 120, T(t, 34, INK, True, TREB), line=1.2)
text(s, 736, 862, 1056, 80, [[T("Each line is written as ", 28, MUTED), T("name – amount", 28, INK, True), T(". Line 6 has a wrong amount; Ian is written twice.", 28, MUTED)]], line=1.3)
footer(s, 2)

# ---------------- 3. How it works ----------------
s = new_slide(DARK)
header(s, "Solution", "Record it once, see the revenue at once", dark=True)
rows = [("Today, on paper", "7C879B", "243049",
         [("Write", "“name – amount” in the logbook"), ("Tally", "add up by hand, page by page"), ("Wait", "the owner waits for the total")]),
        ("With the system", MINT, "0F3B31",
         [("Type", "the same “name – amount”"), ("Check", "rate and double entry checked"), ("See", "totals update for the owner")])]
for r, (label, lc, fill, steps) in enumerate(rows):
    y = 300 + r * 250
    text(s, 128, y + 70, 300, 60, T(label, 32, lc, True, TREB))
    for i, (h, d) in enumerate(steps):
        x = 450 + i * 460
        rect(s, x, y, 400, 200, CARD_D if r == 0 else fill, "243049" if r == 0 else MINT, 20)
        text(s, x + 32, y + 34, 336, 50, T(h, 40, "EEF2F7" if r == 0 else MINT, True, TREB))
        text(s, x + 32, y + 98, 336, 90, T(d, 28, "A9B4C8" if r == 0 else "D6F5EA"), line=1.3)
        if i < 2:
            rect(s, x + 408, y + 88, 44, 26, "3A4660" if r == 0 else MINT, shape=MSO_SHAPE.RIGHT_ARROW)
text(s, 128, 836, 1664, 60, T("The staff keep the same routine: they type what they used to write. No extra step.", 34, "EEF2F7", True, TREB))
footer(s, 3, dark=True)

# ---------------- 4. Core features ----------------
s = new_slide(LIGHT)
header(s, "Core features", "Built around NeoFit's revenue")
feats = [("lightning-teal", "Quick entry", "Type “name – amount”, or tap one of NeoFit's rates"),
         ("warning-orange", "Rate check", "An amount that is not a NeoFit rate is flagged before saving"),
         ("warning-teal", "Double-entry warning", "The same name and amount twice in a day is flagged"),
         ("chart-teal", "Live revenue", "Today, this week, this month and this year, by plan"),
         ("book-teal", "Search and reports", "Find any past entry; download monthly reports as PDF"),
         ("lock-teal", "Staff accounts", "Each entry shows who recorded it; only the owner sees revenue")]
fw = (1664 - 48) / 3
for i, (icon, h, d) in enumerate(feats):
    x = 128 + (i % 3) * (fw + 24); y = 298 + (i // 3) * (260 + 24)
    rect(s, x, y, fw, 260, CARD_L, "DDD7C8", 20)
    s.shapes.add_picture(str(ICONS / f"{icon}.png"), E(x + 32), E(y + 32), E(48), E(48))
    text(s, x + 32, y + 98, fw - 64, 46, T(h, 34, INK, True, TREB))
    text(s, x + 32, y + 150, fw - 64, 90, T(d, 26, MUTED), line=1.3)
footer(s, 4)


# ---------------- 5-6. Prototype: phones ----------------
def phones_slide(n, eyebrow, title, items, xs, w=280):
    s = new_slide(LIGHT)
    header(s, eyebrow, title)
    for (name, cap), x in zip(items, xs):
        h = add_phone(s, name, x, 276, w)
        text(s, x - 30, 276 + h + 14, w + 60, 40, T(cap, 26, INK, True), align=PP_ALIGN.CENTER)
    footer(s, n, FOOT_PROTO)
    return s


staff = [("login", "1 · Sign in"), ("record", "2 · Record"), ("warn-rate", "3 · Rate check"), ("warn-dup", "4 · Double entry"), ("today", "5 · Today's list")]
phones_slide(5, "Prototype · Front desk", "Record an entry", staff, [128 + i * 346 for i in range(5)])
owner = [("dashboard", "Dashboard"), ("history", "History by day"), ("search", "Search a name"), ("reports", "Reports")]
phones_slide(6, "Prototype · Owner", "Monitor the revenue", owner, [256 + i * 376 for i in range(4)])

# ---------------- 7. Owner settings ----------------
s = new_slide(LIGHT)
header(s, "Prototype · Owner", "Rates and staff accounts")
for (name, cap), x in zip((("rates", "Official rates"), ("staff", "Staff accounts")), (128, 488)):
    h = add_phone(s, name, x, 276, 300)
    text(s, x - 30, 276 + h + 14, 360, 40, T(cap, 26, INK, True), align=PP_ALIGN.CENTER)
rect(s, 900, 290, 892, 640, CARD_L, "DDD7C8", 20)
text(s, 948, 340, 796, 50, T("Why these matter for revenue", 34, INK, True, TREB))
bullets(s, 948, 404, 796, 510, [
    "The rate table is the reference for every amount typed at the front desk.",
    "When NeoFit changes a price, the owner updates it here, and the checks follow at once.",
    "Each staff member signs in with an account, so every entry shows who recorded it.",
    "The owner can disable an account when a staff member leaves."], px=27)
footer(s, 7, FOOT_PROTO)

# ---------------- 8. Problem -> solution ----------------
s = new_slide(DARK)
header(s, "Fit to the problem", "Each problem has a direct answer", dark=True)
rows = [("NeoFit's problem", "How the system answers it"),
        ("Revenue is added up by hand", "Totals update with every entry"),
        ("Wrong amounts and double entries", "Rate check and double-entry warning when the entry is typed"),
        ("No timely view of the revenue", "Owner dashboard: today, this week, this month, this year"),
        ("Paper is hard to search and easy to lose", "Searchable records kept in the cloud")]
tbl = s.shapes.add_table(len(rows), 2, E(128), E(310), E(1664), E(len(rows) * 96)).table
tbl.columns[0].width = E(700); tbl.columns[1].width = E(964)
for r, (a, b) in enumerate(rows):
    tbl.rows[r].height = E(96)
    for c, val in enumerate((a, b)):
        cell = tbl.cell(r, c); cell.fill.solid(); cell.fill.fore_color.rgb = RGBColor.from_string(CARD_D if r == 0 else (DARK if r % 2 else "0E1424"))
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = E(28); cell.margin_right = E(28)
        tf = cell.text_frame; tf.paragraphs[0].text = ""
        run = tf.paragraphs[0].add_run(); run.text = val
        run.font.name = TAHOMA; run.font.size = Pt(15); run.font.bold = (r == 0 or c == 0)
        run.font.color.rgb = RGBColor.from_string(MINT if (r > 0 and c == 1) else "EEF2F7")
footer(s, 8, dark=True)

# ---------------- 9. Optional: AI import ----------------
s = new_slide(LIGHT)
header(s, "Optional feature", "Import the past logbook pages")
h = add_phone(s, "import", 128, 276, 300)
text(s, 98, 276 + h + 14, 360, 40, T("Import past logbook", 26, INK, True), align=PP_ALIGN.CENTER)
rect(s, 560, 300, 1232, 470, CARD_L, "DDD7C8", 20)
bullets(s, 608, 344, 1136, 400, [
    "Used once, for the pages NeoFit wrote before the system.",
    "AI reads each old page; the owner checks the flagged rows, then imports.",
    "The owner gets revenue history and comparisons from the first day.",
    "It is not part of the daily routine: new entries are always typed directly."], px=30)
rect(s, 560, 800, 1232, 90, "E8F4EF", None, 16)
text(s, 600, 800, 1160, 90, T("Optional: the core system works fully without it.", 30, TEAL, True, TREB), anchor=MSO_ANCHOR.MIDDLE)
footer(s, 9, FOOT_PROTO)

# ---------------- 10. Technology ----------------
s = new_slide(DARK)
header(s, "Technology", "Technology stack", dark=True)
rows = [("Part", "Technology"), ("Mobile app (staff and owner)", "React Native (Expo), TypeScript · Android"),
        ("Database and sign-in", "Supabase: PostgreSQL, Auth, Row-Level Security"),
        ("Reports", "PDF generated on the phone"), ("Optional past-page import", "Google Gemini API")]
tbl = s.shapes.add_table(len(rows), 2, E(128), E(320), E(1664), E(len(rows) * 80)).table
tbl.columns[0].width = E(620); tbl.columns[1].width = E(1044)
for r, (a, b) in enumerate(rows):
    tbl.rows[r].height = E(80)
    for c, val in enumerate((a, b)):
        cell = tbl.cell(r, c); cell.fill.solid(); cell.fill.fore_color.rgb = RGBColor.from_string(CARD_D if r == 0 else DARK)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = E(24); cell.margin_right = E(24)
        tf = cell.text_frame; tf.paragraphs[0].text = ""
        run = tf.paragraphs[0].add_run(); run.text = val
        run.font.name = TAHOMA; run.font.size = Pt(16); run.font.bold = (r == 0)
        run.font.color.rgb = RGBColor.from_string("EEF2F7" if (r == 0 or c == 1) else MINT)
text(s, 128, 760, 1664, 50, T("No new hardware: the app runs on an Android phone or tablet at the front desk.", 30, "A9B4C8"))
footer(s, 10, dark=True)

# ---------------- 11. Scope ----------------
s = new_slide(LIGHT)
header(s, "Scope", "Scope and limitations")
cols = [("Scope", TEAL, ["NeoFit Fitness Gym, one branch", "Android app for the front desk and the owner",
                         "Payments recorded as “name – amount”", "Revenue dashboard, search and PDF reports"]),
        ("Limitations", ORANGE, ["Records only what the staff enter", "No online payment processing",
                                 "Internet needed to sync; entries wait on the phone", "Old-page import depends on handwriting"])]
for i, (h, color, items) in enumerate(cols):
    x = 128 + i * (816 + 32)
    rect(s, x, 298, 816, 460, CARD_L, "DDD7C8", 20)
    rect(s, x + 14, 298, 788, 8, color)
    text(s, x + 40, 338, 736, 54, T(h, 40, INK, True, TREB))
    text(s, x + 40, 410, 736, 330, [[T("•  " + it, 30, "374151")] for it in items], line=1.4)
footer(s, 11)

# ---------------- 12. Closing ----------------
s = new_slide(DARK)
text(s, 128, 300, 1664, 190, T("Salamat!", 160, MINT, True, TREB), align=PP_ALIGN.CENTER, line=1.0)
text(s, 128, 520, 1664, 80, T("Questions and suggestions are welcome.", 56, "EEF2F7", True, TREB), align=PP_ALIGN.CENTER)
text(s, 128, 992, 1664, 30, T("Reños · Sugala · Portes · Cabudbud · Sente · Lanaza", 24, "7C879B"), align=PP_ALIGN.CENTER)

prs.core_properties.title = "Revenue Monitoring and Payment Recording System for NeoFit Fitness Gym"
prs.core_properties.author = "Capstone Team"
prs.save(OUT)
print("saved", OUT)
