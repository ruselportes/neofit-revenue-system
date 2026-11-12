# -*- coding: utf-8 -*-
"""Option B deck, made by editing the user's copy of the old 12-slide deck (same design, no rebuild):
- title -> "Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning for NeoFit Fitness Gym"
- no "SulatSync" anywhere (text, footers, screens)
- Problem slide: 4th problem (encoding the logbook by hand is slow and tiring) -> scanning is the answer
- desktop prototype without the Attendance screen (slide 8 shows the rates only)
Usage: python edit_option_b.py "<path to SulatSync-Title-Presentation.pptx>"
Output: docs/presentation/option-b/Title-Presentation-Option-B.pptx"""
import io, sys
from pathlib import Path
from PIL import Image, ImageDraw
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

HERE = Path(__file__).parent
PRES = HERE.parent.parent / "presentation"
SCREENS = PRES / "prototype-screens"
ICONS = HERE / "icons"
OUT = PRES / "option-b" / "Title-Presentation-Option-B.pptx"; OUT.parent.mkdir(exist_ok=True)
SRC = Path(sys.argv[1])

PX = 6350
TAHOMA, TREB = "Tahoma", "Trebuchet MS"
LIGHT, CARD_L = "F4F1E8", "FBFAF5"
MINT, TEAL, INK = "00E5A0", "08694F", "111827"
TITLE = "Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning for NeoFit Fitness Gym"


def E(v): return Emu(int(round(v * PX)))


def T(t, px, color=INK, bold=False, font=TAHOMA):
    return dict(t=t, px=px, c=color, b=bold, font=font)


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
            f.size = Pt(rs["px"] / 2); f.bold = rs["b"]; f.name = rs["font"]
            f.color.rgb = RGBColor.from_string(rs["c"])
    return tb


def rect(slide, x, y, w, h, fill, line=None, radius=0):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    sh = slide.shapes.add_shape(kind, E(x), E(y), E(w), E(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = RGBColor.from_string(fill)
    if line:
        sh.line.color.rgb = RGBColor.from_string(line); sh.line.width = Pt(0.75)
    else:
        sh.line.fill.background()
    if radius:
        sh.adjustments[0] = min(0.5, radius / min(w, h))
    sh.shadow.inherit = False
    return sh


def txt(sh):
    return sh.text_frame.text if sh.has_text_frame else ""


def set_text(sh, new):
    """Replace a shape's text, keeping the formatting of its first run."""
    p0 = sh.text_frame.paragraphs[0]
    for extra in sh.text_frame.paragraphs[1:]:
        extra._p.getparent().remove(extra._p)
    runs = p0.runs
    runs[0].text = new
    for r in runs[1:]:
        r._r.getparent().remove(r._r)


def remove(sh):
    sh._element.getparent().remove(sh._element)


def replace_image(slide, pic, png_bytes):
    rid = pic._element.blipFill.blip.rEmbed
    slide.part.related_part(rid)._blob = png_bytes


def png_bytes(im):
    b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()


def phone_frame(name):
    im = Image.open(SCREENS / "mobile" / f"{name}.png").convert("RGB")
    h = 1600; w = int(im.width * h / im.height); im = im.resize((w, h))
    bez = 26
    frame = Image.new("RGB", (w + 2 * bez, h + 2 * bez), "#" + LIGHT)
    ImageDraw.Draw(frame).rounded_rectangle([0, 0, frame.width - 1, frame.height - 1], radius=90, fill="#05070D")
    mask = Image.new("L", (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=66, fill=255)
    frame.paste(im, (bez, bez), mask)
    return png_bytes(frame)


def desktop(name):
    return (SCREENS / "desktop" / f"{name}.png").read_bytes()


prs = Presentation(SRC)
S = list(prs.slides)
assert len(S) == 12, len(S)

# ---- every slide: footers and leftover brand text ----
FOOTERS = {"SulatSync · Title hearing": "NeoFit Fitness Gym · Title hearing",
           "SulatSync · Prototype screens, sample data": "Prototype screens · sample data",
           "SulatSync · Reños · Sugala · Portes · Cabudbud · Sente · Lanaza": "Reños · Sugala · Portes · Cabudbud · Sente · Lanaza",
           "How SulatSync works": "How the system works",
           "Hybrid AI OCR": "AI logbook scanning",
           "Members, attendance and rates on the desktop": "Members and rates on the desktop"}
for s in S:
    for sh in list(s.shapes):
        if sh.has_text_frame and txt(sh) in FOOTERS:
            set_text(sh, FOOTERS[txt(sh)])

# ---- 7. dashboard caption: no check-ins (attendance is left out of the desktop prototype) ----
for sh in S[6].shapes:
    if sh.has_text_frame and txt(sh).startswith("Dashboard:"):
        runs = sh.text_frame.paragraphs[0].runs
        runs[-1].text = "members, today's logbook entries and revenue, plus expiry alerts"

# ---- 1. cover: new title ----
s = S[0]
for sh in list(s.shapes):
    if txt(sh) in ("SulatSync", "An AI-Powered Handwritten Logbook Digitization and Revenue Analytics System for NeoFit Fitness Gym"):
        remove(sh)
text(s, 128, 356, 1000, 180, T("Revenue Collection and Monitoring System", 78, "EEF2F7", True, TREB), line=1.05)
text(s, 128, 560, 1000, 56, T("with AI-Integrated Logbook Scanning", 40, "C9D2E0", True, TREB))
text(s, 128, 624, 1000, 60, T("for NeoFit Fitness Gym", 44, MINT, True, TREB))

# ---- 2. problem: four problems, scanning as the answer ----
s = S[1]
keep = {"PROBLEM", "NeoFit's logbook is still on paper", "NeoFit Fitness Gym · Title hearing", "02 / 12"}
for sh in list(s.shapes):
    if txt(sh) not in keep:
        remove(sh)
probs = [("clock-teal", "Revenue is added up by hand, page by page"),
         ("warning-orange", "Wrong amounts and double entries slip through"),
         ("book-teal", "Paper records are hard to search and easy to lose"),
         ("users-orange", "Encoding the logbook into a system by hand is slow and tiring")]
cw, ch = (1664 - 32) / 2, 190
for i, (icon, t) in enumerate(probs):
    x = 128 + (i % 2) * (cw + 32); y = 290 + (i // 2) * (ch + 28)
    rect(s, x, y, cw, ch, CARD_L, "DDD7C8", 20)
    s.shapes.add_picture(str(ICONS / f"{icon}.png"), E(x + 36), E(y + 40), E(56), E(56))
    text(s, x + 124, y + 36, cw - 160, ch - 60, T(t, 36, INK, True, TREB), line=1.2)
text(s, 128, 732, 1664, 120, [[T("Scanning the page saves the staff from encoding every line by hand. ", 38, TEAL, True, TREB)],
                              [T("The system reads the logbook and keeps the revenue records.", 30, "374151")]], line=1.25, gap=10)

# ---- 5-6. phone screens with the NeoFit login and settings ----
pics = [sh for sh in S[4].shapes if sh.shape_type == MSO_SHAPE_TYPE.PICTURE]
replace_image(S[4], pics[0], phone_frame("m-login"))
pics = [sh for sh in S[5].shapes if sh.shape_type == MSO_SHAPE_TYPE.PICTURE]
replace_image(S[5], pics[3], phone_frame("m-settings"))

# ---- 7 and 9. desktop screens (no brand in the sidebar or the revenue breakdown) ----
for idx, names in ((6, ("d-dashboard", "d-members")), (8, ("d-revenue", "d-logbook"))):
    pics = sorted([sh for sh in S[idx].shapes if sh.shape_type == MSO_SHAPE_TYPE.PICTURE], key=lambda p: p.left)
    for pic, name in zip(pics, names):
        replace_image(S[idx], pic, desktop(name))

# ---- 8. rates only (no attendance) ----
s = S[7]
for sh in list(s.shapes):
    if sh.shape_type == MSO_SHAPE_TYPE.PICTURE or txt(sh).startswith(("Attendance:", "Rates:")):
        remove(sh)
    elif txt(sh) == "Attendance and rates":
        set_text(sh, "Official rates")
pic = s.shapes.add_picture(str(SCREENS / "desktop" / "d-rates.png"), E(128), E(276), E(1024), E(640))
pic.line.color.rgb = RGBColor.from_string("CFC8B6"); pic.line.width = Pt(0.75)
rect(s, 1192, 276, 600, 640, CARD_L, "DDD7C8", 20)
text(s, 1232, 316, 520, 50, T("Why the rates matter", 34, INK, True, TREB))
items = ["Every scanned amount is checked against these prices.",
         "An amount that is not a NeoFit rate is flagged before saving.",
         "When NeoFit changes a price, the owner updates it here.",
         "All revenue figures use the new rates right away."]
text(s, 1232, 386, 520, 500, [[T("•  ", 28, TEAL, True), T(it, 28, "374151")] for it in items], line=1.35, gap=14)

prs.core_properties.title = TITLE
prs.core_properties.author = "Capstone Team"
prs.save(OUT)
print("saved", OUT)

# safety check: no brand left in any text
left = [(i + 1, txt(sh)) for i, sl in enumerate(prs.slides) for sh in sl.shapes if "SulatSync" in txt(sh)]
assert not left, left
