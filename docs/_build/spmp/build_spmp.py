# -*- coding: utf-8 -*-
import copy, json, re, sys
from pathlib import Path
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, Inches, RGBColor, Emu

sys.path.insert(0, str(Path(__file__).parent))
import content as C

HERE = Path(__file__).parent
TEMPLATE = r"C:\capstone\internal\templates\1. Software Project Management Plan Template.docx"
FONT = "Tahoma"
pages = json.loads((HERE / "pages.json").read_text()) if (HERE / "pages.json").exists() and "--final" in sys.argv else {}

doc = Document(TEMPLATE)
body = doc.element.body
for el in list(body):
    if el.tag != qn("w:sectPr"):
        body.remove(el)

# ---------- helpers: XML ----------
def el(tag, **attrs):
    e = OxmlElement(tag)
    for k, v in attrs.items():
        e.set(qn(k), str(v))
    return e

def set_rfonts(rpr, name=FONT):
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = el("w:rFonts"); rpr.insert(0, rf)
    for a in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
        rf.attrib.pop(qn(a), None)
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rf.set(qn(a), name)

# ---------- numbering ----------
numbering = doc.part.numbering_part.element
# heading numbering (abstractNum 2 via numId 3): sane indents for levels 0-2
absn = [a for a in numbering.findall(qn("w:abstractNum")) if a.get(qn("w:abstractNumId")) == "2"][0]
for lvl in absn.findall(qn("w:lvl")):
    ilvl = int(lvl.get(qn("w:ilvl")))
    if ilvl > 2:
        continue
    width = [432, 576, 720][ilvl]
    ppr = lvl.find(qn("w:pPr"))
    for child in list(ppr):
        ppr.remove(child)
    tabs = el("w:tabs"); tabs.append(el("w:tab", **{"w:val": "num", "w:pos": width})); ppr.append(tabs)
    ppr.append(el("w:ind", **{"w:left": width, "w:hanging": width}))
    lt = lvl.find(qn("w:lvlText"))
    lt.set(qn("w:val"), ["%1.", "%1.%2.", "%1.%2.%3."][ilvl])
    suff = lvl.find(qn("w:suff"))
    if suff is None:
        suff = el("w:suff", **{"w:val": "tab"}); lvl.insert(list(lvl).index(lt), suff)
    rpr = lvl.find(qn("w:rPr"))
    if rpr is not None:
        lvl.remove(rpr)

next_abs = max(int(a.get(qn("w:abstractNumId"))) for a in numbering.findall(qn("w:abstractNum"))) + 1
next_num = max(int(n.get(qn("w:numId"))) for n in numbering.findall(qn("w:num"))) + 1

def add_abstract(levels):
    """levels: list of (fmt, text, font, left, hanging)"""
    global next_abs, next_num
    a = el("w:abstractNum", **{"w:abstractNumId": next_abs})
    a.append(el("w:multiLevelType", **{"w:val": "hybridMultilevel"}))
    for i, (fmt, text, font, left, hanging) in enumerate(levels):
        lvl = el("w:lvl", **{"w:ilvl": i})
        lvl.append(el("w:start", **{"w:val": 1}))
        lvl.append(el("w:numFmt", **{"w:val": fmt}))
        lvl.append(el("w:lvlText", **{"w:val": text}))
        lvl.append(el("w:lvlJc", **{"w:val": "left"}))
        ppr = el("w:pPr"); ppr.append(el("w:ind", **{"w:left": left, "w:hanging": hanging})); lvl.append(ppr)
        if font:
            rpr = el("w:rPr"); rpr.append(el("w:rFonts", **{"w:ascii": font, "w:hAnsi": font, "w:hint": "default"})); lvl.append(rpr)
        a.append(lvl)
    # abstractNums must precede nums
    first_num = numbering.find(qn("w:num"))
    first_num.addprevious(a)
    n = el("w:num", **{"w:numId": next_num}); n.append(el("w:abstractNumId", **{"w:val": next_abs}))
    numbering.append(n)
    next_abs += 1; next_num += 1
    return next_num - 1

BULLET_ABS_LEVELS = [("bullet", "\uf0b7", "Symbol", 720, 360), ("bullet", "o", "Courier New", 1440, 360)]
ARROW_ABS_LEVELS = [("bullet", "\u00d8", "Wingdings", 720, 360), ("bullet", "\uf0b7", "Symbol", 1440, 360)]

def new_bullets():
    return add_abstract(BULLET_ABS_LEVELS)

def new_arrows():
    return add_abstract(ARROW_ABS_LEVELS)

def new_numbered():
    return add_abstract([("decimal", "%1.", None, 720, 360)])

# ---------- styles ----------
st = doc.styles
normal = st["Normal"]
normal.font.name = FONT; normal.font.size = Pt(12)
set_rfonts(normal.element.get_or_add_rPr())
for name, size, bold, color, italic in (("Heading 1", 16, True, "FFFFFF", False), ("Heading 2", 16, True, "000000", False),
                                        ("Heading 3", 12, True, "000000", False), ("Title", 20, True, "000000", False),
                                        ("Subtitle", 14, False, "000000", True)):
    s = st[name]
    s.font.name = FONT; s.font.size = Pt(size); s.font.bold = bold; s.font.italic = italic
    s.font.color.rgb = RGBColor.from_string(color)
    set_rfonts(s.element.get_or_add_rPr())

# ---------- paragraph helpers ----------
def fmt(p, align=WD_ALIGN_PARAGRAPH.JUSTIFY, before=12, after=0, line=1.5, first=None, left=None, keep=False):
    pf = p.paragraph_format
    pf.alignment = align
    pf.space_before = Pt(before); pf.space_after = Pt(after)
    pf.line_spacing = line
    if first is not None: pf.first_line_indent = Inches(first)
    if left is not None: pf.left_indent = Inches(left)
    pf.keep_with_next = keep
    pf.widow_control = True
    return p

def runs(p, text, size=12, bold=False, italic=False, color=None):
    parts = re.split(r"(\*\*.+?\*\*)", text)
    for part in parts:
        if not part:
            continue
        b = bold
        if part.startswith("**") and part.endswith("**"):
            part = part[2:-2]; b = True
        r = p.add_run(part)
        r.font.name = FONT; r.font.size = Pt(size); r.bold = b; r.italic = italic
        set_rfonts(r._r.get_or_add_rPr())
        if color: r.font.color.rgb = RGBColor.from_string(color)
    return p

def para(text, **kw):
    size = kw.pop("size", 12); bold = kw.pop("bold", False); italic = kw.pop("italic", False)
    kw.setdefault("first", 0.5)
    p = doc.add_paragraph()
    fmt(p, **kw)
    return runs(p, text, size=size, bold=bold, italic=italic)

def set_num(p, num_id, ilvl=0):
    ppr = p._p.get_or_add_pPr()
    numpr = el("w:numPr"); numpr.append(el("w:ilvl", **{"w:val": ilvl})); numpr.append(el("w:numId", **{"w:val": num_id}))
    anchor = None
    for tag in ("w:pStyle", "w:keepNext", "w:keepLines", "w:pageBreakBefore", "w:framePr", "w:widowControl"):
        found = ppr.find(qn(tag))
        if found is not None: anchor = found
    if anchor is not None: anchor.addnext(numpr)
    else: ppr.insert(0, numpr)

def list_item(text, num_id, ilvl=0, before=6):
    p = doc.add_paragraph()
    fmt(p, before=before, first=None)
    set_num(p, num_id, ilvl)
    return runs(p, text)

def heading(level, text, numbered=True):
    p = doc.add_paragraph(style=f"Heading {level}")
    if level == 1:
        if not numbered:
            set_num(p, 0, 0)
        p.paragraph_format.left_indent = Inches(0.3 if numbered else 0.06)
        p.paragraph_format.first_line_indent = Inches(-0.3 if numbered else 0)
    else:
        set_num(p, 3, level - 1)
    pf = p.paragraph_format
    pf.space_before = Pt(0 if level == 1 else (24 if level == 2 else 18)); pf.space_after = Pt(6)
    pf.keep_with_next = True; pf.line_spacing = 1.15
    r = p.add_run(text); r.font.name = FONT; set_rfonts(r._r.get_or_add_rPr())
    return p

def shade(cell, fill):
    tcpr = cell._tc.get_or_add_tcPr()
    for old in tcpr.findall(qn("w:shd")): tcpr.remove(old)
    tcpr.append(el("w:shd", **{"w:val": "clear", "w:color": "auto", "w:fill": fill}))

def cell_text(cell, text, bold=False, size=11, align=WD_ALIGN_PARAGRAPH.LEFT, italic=False):
    cell.text = ""
    p = cell.paragraphs[0]
    fmt(p, align=align, before=3, after=3, line=1.0, first=0)
    runs(p, text, size=size, bold=bold, italic=italic)

def caption(label, name, where="above"):
    p = doc.add_paragraph()
    fmt(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=12 if where == "above" else 6, after=6 if where == "above" else 0, line=1.0, first=0, keep=(where == "above"))
    runs(p, label + " ", bold=True); runs(p, name)
    return p

def make_table(widths, header):
    t = doc.add_table(rows=1, cols=len(widths))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    tblpr = t._tbl.tblPr
    borders = el("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        borders.append(el(f"w:{side}", **{"w:val": "single", "w:sz": 4, "w:space": 0, "w:color": "000000"}))
    layout = el("w:tblLayout", **{"w:type": "fixed"})
    look = tblpr.find(qn("w:tblLook"))
    if look is not None:
        look.addprevious(borders); look.addprevious(layout)
    else:
        tblpr.append(borders); tblpr.append(layout)
    for gc, w in zip(t._tbl.tblGrid.findall(qn("w:gridCol")), widths):
        gc.set(qn("w:w"), str(int(w * 1440)))
    tblw = tblpr.find(qn("w:tblW"))
    if tblw is not None:
        tblw.set(qn("w:type"), "dxa"); tblw.set(qn("w:w"), str(int(sum(widths) * 1440)))
    hdr = t.rows[0]
    trpr = hdr._tr.get_or_add_trPr(); trpr.append(el("w:tblHeader"))
    for i, (w, h) in enumerate(zip(widths, header)):
        c = hdr.cells[i]; c.width = Inches(w); cell_text(c, h, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER); shade(c, "D9D9D9")
        for cp_ in c.paragraphs: cp_.paragraph_format.keep_with_next = True
    return t

def keep_rows(t, rows=None):
    """Keep table rows on the page of the caption below the table (all rows, or only the last)."""
    for row in (t.rows if rows is None else rows):
        for c in row.cells:
            for cp_ in c.paragraphs: cp_.paragraph_format.keep_with_next = True

def add_row(t, widths, values, bold=False, fill=None, aligns=None):
    row = t.add_row()
    trpr = row._tr.get_or_add_trPr(); trpr.append(el("w:cantSplit"))
    for i, (w, v) in enumerate(zip(widths, values)):
        c = row.cells[i]; c.width = Inches(w)
        a = aligns[i] if aligns else WD_ALIGN_PARAGRAPH.LEFT
        cell_text(c, v, bold=bold, align=a)
        if fill: shade(c, fill)
    return row

def table(key):
    if key == "workplan":
        widths = [0.6, 3.8, 2.1]
        t = make_table(widths, ["No.", "Project Task", "Estimated Schedule"])
        for no, name, sched, tasks in C.WORKPLAN:
            add_row(t, widths, [no, name, sched], bold=True, fill="F2F2F2")
            for tno, tname, tsched in tasks:
                add_row(t, widths, [tno, tname, tsched])
        keep_rows(t, t.rows[-1:])
        caption("Table 5.0", "Work Plan", where="below")
        return
    if key == "activities":
        widths = [0.6, 3.1, 1.8, 1.0]
        center = WD_ALIGN_PARAGRAPH.CENTER
        al = [WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.LEFT, center]
        t = make_table(widths, ["No.", "Project Task / Activity", "Role", "Labor Hours"])
        for no, name, tasks in C.ACTIVITIES:
            total = sum(h for _, _, acts in tasks for _, _, h in acts)
            add_row(t, widths, [no, name, "", f"{total} hrs"], bold=True, fill="F2F2F2", aligns=al)
            for tno, tname, acts in tasks:
                add_row(t, widths, [tno, tname, "", f"{sum(h for _, _, h in acts)} hrs"], bold=True, aligns=al)
                for aname, role, h in acts:
                    add_row(t, widths, ["", "     " + aname, role, f"{h} hrs"], aligns=al)
        grand = sum(C.iteration_hours())
        add_row(t, widths, ["", "Total", "", f"{grand} hrs"], bold=True, fill="D9D9D9", aligns=al)
        keep_rows(t, t.rows[-1:])
        caption("Table 6.0", "Work Activities", where="below")
        return
    label, name, widths, header, rows, opts = C.TABLES[key]
    t = make_table(widths, header)
    for i, r in enumerate(rows):
        last = opts.get("bold_last") and i == len(rows) - 1
        add_row(t, widths, r, bold=last, fill="F2F2F2" if last else None)
    keep_rows(t, None if len(rows) <= 12 else t.rows[-1:])  # short tables stay on one page
    caption(label, name, where="below")

def figure(key):
    label, name, path, width = C.FIGURES[key]
    p = doc.add_paragraph()
    fmt(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=12, after=0, line=1.0, first=0, keep=True)
    p.add_run().add_picture(str(HERE / path), width=Inches(width))
    caption(label, name, where="below")

def techlist(items):
    for label, value in items:
        p = doc.add_paragraph()
        fmt(p, before=4, line=1.5, first=None, align=WD_ALIGN_PARAGRAPH.LEFT)
        p.paragraph_format.left_indent = Inches(3.0); p.paragraph_format.first_line_indent = Inches(-2.5)
        p.paragraph_format.tab_stops.add_tab_stop(Inches(3.0))
        runs(p, f"**{label}:**\t{value}")

def refs(items):
    for i, text in enumerate(items, 1):
        p = doc.add_paragraph()
        fmt(p, align=WD_ALIGN_PARAGRAPH.LEFT, before=8, line=1.5, first=None)
        p.paragraph_format.left_indent = Inches(0.5); p.paragraph_format.first_line_indent = Inches(-0.5)
        runs(p, f"[{i}]\t{text}")

def list_page(title, entries, col):
    heading(1, title, numbered=False)
    p = doc.add_paragraph(); fmt(p, before=18, after=6, line=1.0, first=0, align=WD_ALIGN_PARAGRAPH.LEFT)
    p.paragraph_format.tab_stops.add_tab_stop(Inches(1.4)); p.paragraph_format.tab_stops.add_tab_stop(Inches(6.5), WD_TAB_ALIGNMENT.RIGHT)
    runs(p, f"**{col}\tDescription\tPage**")
    for label, name in entries:
        p = doc.add_paragraph(); fmt(p, before=6, after=0, line=1.5, first=0, align=WD_ALIGN_PARAGRAPH.LEFT)
        p.paragraph_format.tab_stops.add_tab_stop(Inches(1.4))
        p.paragraph_format.tab_stops.add_tab_stop(Inches(6.5), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
        pg = pages.get(label, "00")
        runs(p, f"{label}\t{name}\t{pg}")

# ---------- title page ----------
for _ in range(5):  # as in the school template: five empty Title lines, no info block
    fmt(doc.add_paragraph(style="Title"), before=0, line=1.0, first=0)
p = doc.add_paragraph(style="Title"); fmt(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=0, after=12, line=1.0, first=0); runs(p, "Software Project Management Plan", size=20, bold=True)
p = doc.add_paragraph(style="Subtitle"); fmt(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=6, after=12, line=1.0, first=0); runs(p, "for", size=14, italic=True)
for line in C.TITLE_PAGE_LINES:
    p = doc.add_paragraph(); fmt(p, align=WD_ALIGN_PARAGRAPH.CENTER, before=0, after=0, line=1.3, first=0); runs(p, line, size=15, bold=True)

# ---------- lists ----------
list_page("List of Figures", [(v[0], v[1]) for v in C.FIGURES.values()], "Figure No.")
table_entries = [(C.TABLES[k][0], C.TABLES[k][1]) for k in ("milestones", "definitions", "roles", "staff")]
table_entries += [("Table 5.0", "Work Plan"), ("Table 6.0", "Work Activities")]
table_entries += [(C.TABLES[k][0], C.TABLES[k][1]) for k in ("budget", "risks", "methods", "tools")]
list_page("List of Tables", table_entries, "Table No.")

# ---------- section break: front matter has no header/footer; body numbered from 1 ----------
doc.add_section(WD_SECTION.NEW_PAGE)
front = doc.sections[0]._sectPr
for ref in front.findall(qn("w:headerReference")) + front.findall(qn("w:footerReference")):
    front.remove(ref)
main = doc.sections[-1]._sectPr
pg = main.find(qn("w:pgNumType"))
if pg is None:
    pg = el("w:pgNumType"); main.find(qn("w:pgMar")).addnext(pg)
pg.set(qn("w:start"), "1"); pg.set(qn("w:fmt"), "decimal")
for s in doc.sections:
    s.left_margin = s.right_margin = s.top_margin = s.bottom_margin = Inches(1)

# ---------- body ----------
res_alloc = ("The development team has a fixed amount of time available for the project. Based on the estimated labor hours in the work activities, "
             "the team is allocated approximately {} labor hours for Iteration 1, {} labor hours for Iteration 2, {} labor hours for Iteration 3, and {} labor hours "
             "for the Final Testing, Defense and Deployment phase, for a total of {} labor hours.")
hrs = C.iteration_hours()
for idx, (kind, payload) in enumerate(C.DOC):
    nxt = C.DOC[idx + 1][0] if idx + 1 < len(C.DOC) else None
    if kind in ("h1", "h2", "h3"):
        heading(int(kind[1]), payload)
    elif kind == "p":
        if payload == "RESOURCE_ALLOCATION":
            payload = res_alloc.format(*hrs, sum(hrs))
        para(payload, keep=(nxt == "table"), after=6 if nxt == "table" else 0)
    elif kind == "bullets":
        nid = new_bullets()
        for item in payload:
            if isinstance(item, tuple):
                list_item(item[0], nid, 0)
                for sub in item[1]:
                    list_item(sub, nid, 1, before=2)
            else:
                list_item(item, nid, 0)
    elif kind == "arrows":
        nid = new_arrows()
        for head, items in payload:
            list_item(f"**{head}**", nid, 0, before=10)
            for it in items:
                list_item(it, nid, 1, before=4)
    elif kind == "numbered":
        nid = new_numbered()
        for it in payload:
            list_item(it, nid, 0)
    elif kind == "techlist":
        techlist(payload)
    elif kind == "table":
        table(payload)
    elif kind == "figure":
        figure(payload)
    elif kind == "refs":
        refs(payload)

# ---------- header text ----------
hdr = doc.sections[-1].header
hdr.is_linked_to_previous = False
for p in list(hdr.paragraphs):
    p._p.getparent().remove(p._p)
for t in list(hdr.tables):
    t._tbl.getparent().remove(t._tbl)
for text, size, bold in (("Software Project Management Plan", 8, True), (C.TITLE_L1, 7, False), (C.TITLE_L2, 7, False)):
    p = hdr.add_paragraph(); fmt(p, align=WD_ALIGN_PARAGRAPH.LEFT, before=0, after=0, line=1.0, first=0); runs(p, text, size=size, bold=bold)

# ---------- footer page number ----------
ftr = doc.sections[-1].footer
ftr.is_linked_to_previous = False
for p in list(ftr.paragraphs):
    p._p.getparent().remove(p._p)
for t in list(ftr.tables):
    t._tbl.getparent().remove(t._tbl)
p = ftr.add_paragraph(); fmt(p, align=WD_ALIGN_PARAGRAPH.RIGHT, before=0, after=0, line=1.0, first=0)
fld = el("w:fldSimple", **{"w:instr": " PAGE "})
r = OxmlElement("w:r"); rpr = OxmlElement("w:rPr"); set_rfonts(rpr); sz = el("w:sz", **{"w:val": 20}); rpr.append(sz); r.append(rpr)
t = OxmlElement("w:t"); t.text = "1"; r.append(t); fld.append(r); p._p.append(fld)

cp = doc.core_properties
cp.title = "Software Project Management Plan"; cp.author = "Capstone Team"; cp.subject = C.SYSTEM
out = HERE / ("SPMP-build.docx")
doc.save(out)
print("saved", out)
