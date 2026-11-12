# -*- coding: utf-8 -*-
"""Shared builder for the capstone documents (SRS, SDD, STD).

Lays content onto a school template (IEEE-style .docx): title page, List of Figures and List of Tables
with real page numbers (two passes), numbered Heading 1-4, Tahoma body text at 1.5 spacing with 12 pt
before (Dean's formatting feedback), tables, figures, header and page-number footer.

Blocks: ("h1".."h4", text) ("p", text) ("bullets", [str | (str, [sub])]) ("arrows", [(head, [items])])
("numbered", [items]) ("techlist", [(label, value)]) ("refs", [items]) ("table", key) ("figure", key)
Inline **bold** is supported in text.
"""
import re
from pathlib import Path
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, Inches, RGBColor

FONT = "Tahoma"
J, L, C, R = WD_ALIGN_PARAGRAPH.JUSTIFY, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.RIGHT


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


class DocBuilder:
    def __init__(self, template, base_dir, pages=None):
        self.doc = Document(template)
        self.base = Path(base_dir)
        self.pages = pages or {}
        body = self.doc.element.body
        for e in list(body):
            if e.tag != qn("w:sectPr"):
                body.remove(e)
        self._setup_numbering()
        self._setup_styles()

    # ---------- setup ----------
    def _setup_numbering(self):
        num = self.doc.part.numbering_part.element
        self.numbering = num
        absn = [a for a in num.findall(qn("w:abstractNum")) if a.get(qn("w:abstractNumId")) == "2"][0]
        for lvl in absn.findall(qn("w:lvl")):
            ilvl = int(lvl.get(qn("w:ilvl")))
            if ilvl > 3:
                continue
            width = [432, 576, 720, 864][ilvl]
            ppr = lvl.find(qn("w:pPr"))
            for child in list(ppr):
                ppr.remove(child)
            tabs = el("w:tabs"); tabs.append(el("w:tab", **{"w:val": "num", "w:pos": width})); ppr.append(tabs)
            ppr.append(el("w:ind", **{"w:left": width, "w:hanging": width}))
            lvl.find(qn("w:lvlText")).set(qn("w:val"), ["%1.", "%1.%2.", "%1.%2.%3.", "%1.%2.%3.%4."][ilvl])
            rpr = lvl.find(qn("w:rPr"))
            if rpr is not None:
                lvl.remove(rpr)
        self.next_abs = max(int(a.get(qn("w:abstractNumId"))) for a in num.findall(qn("w:abstractNum"))) + 1
        self.next_num = max(int(n.get(qn("w:numId"))) for n in num.findall(qn("w:num"))) + 1

    def _add_abstract(self, levels):
        a = el("w:abstractNum", **{"w:abstractNumId": self.next_abs})
        a.append(el("w:multiLevelType", **{"w:val": "hybridMultilevel"}))
        for i, (fmt, text, font, left, hanging) in enumerate(levels):
            lvl = el("w:lvl", **{"w:ilvl": i})
            lvl.append(el("w:start", **{"w:val": 1})); lvl.append(el("w:numFmt", **{"w:val": fmt}))
            lvl.append(el("w:lvlText", **{"w:val": text})); lvl.append(el("w:lvlJc", **{"w:val": "left"}))
            ppr = el("w:pPr"); ppr.append(el("w:ind", **{"w:left": left, "w:hanging": hanging})); lvl.append(ppr)
            if font:
                rpr = el("w:rPr"); rpr.append(el("w:rFonts", **{"w:ascii": font, "w:hAnsi": font, "w:hint": "default"})); lvl.append(rpr)
            a.append(lvl)
        self.numbering.find(qn("w:num")).addprevious(a)
        n = el("w:num", **{"w:numId": self.next_num}); n.append(el("w:abstractNumId", **{"w:val": self.next_abs}))
        self.numbering.append(n)
        self.next_abs += 1; self.next_num += 1
        return self.next_num - 1

    def _setup_styles(self):
        st = self.doc.styles
        st["Normal"].font.name = FONT; st["Normal"].font.size = Pt(12)
        set_rfonts(st["Normal"].element.get_or_add_rPr())
        spec = (("Heading 1", 16, True, "FFFFFF", False), ("Heading 2", 16, True, "000000", False),
                ("Heading 3", 12, True, "000000", False), ("Title", 20, True, "000000", False),
                ("Subtitle", 14, False, "000000", True))
        for name, size, bold, color, italic in spec:
            s = st[name]
            s.font.name = FONT; s.font.size = Pt(size); s.font.bold = bold; s.font.italic = italic
            s.font.color.rgb = RGBColor.from_string(color)
            set_rfonts(s.element.get_or_add_rPr())
        try:
            s = st["Heading 4"]
            s.font.name = FONT; s.font.size = Pt(12); s.font.bold = True; s.font.italic = False
            s.font.color.rgb = RGBColor.from_string("000000"); set_rfonts(s.element.get_or_add_rPr())
            self.h4_style = "Heading 4"
        except KeyError:
            self.h4_style = "Heading 3"

    # ---------- low-level helpers ----------
    def fmt(self, p, align=J, before=12, after=0, line=1.5, first=None, left=None, keep=False):
        pf = p.paragraph_format
        pf.alignment = align; pf.space_before = Pt(before); pf.space_after = Pt(after); pf.line_spacing = line
        if first is not None: pf.first_line_indent = Inches(first)
        if left is not None: pf.left_indent = Inches(left)
        pf.keep_with_next = keep; pf.widow_control = True
        return p

    def runs(self, p, text, size=12, bold=False, italic=False, color=None):
        for part in re.split(r"(\*\*.+?\*\*)", text):
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

    def para(self, text, size=12, bold=False, italic=False, **kw):
        kw.setdefault("first", 0.5)
        p = self.doc.add_paragraph(); self.fmt(p, **kw)
        return self.runs(p, text, size=size, bold=bold, italic=italic)

    def set_num(self, p, num_id, ilvl=0):
        ppr = p._p.get_or_add_pPr()
        numpr = el("w:numPr"); numpr.append(el("w:ilvl", **{"w:val": ilvl})); numpr.append(el("w:numId", **{"w:val": num_id}))
        anchor = None
        for tag in ("w:pStyle", "w:keepNext", "w:keepLines", "w:pageBreakBefore", "w:framePr", "w:widowControl"):
            f = ppr.find(qn(tag))
            if f is not None: anchor = f
        if anchor is not None: anchor.addnext(numpr)
        else: ppr.insert(0, numpr)

    def list_item(self, text, num_id, ilvl=0, before=6):
        p = self.doc.add_paragraph(); self.fmt(p, before=before)
        self.set_num(p, num_id, ilvl)
        return self.runs(p, text)

    def heading(self, level, text, numbered=True):
        style = f"Heading {level}" if level <= 3 else self.h4_style
        p = self.doc.add_paragraph(style=style)
        if level == 1:
            if not numbered:
                self.set_num(p, 0, 0)
            p.paragraph_format.left_indent = Inches(0.3 if numbered else 0.06)
            p.paragraph_format.first_line_indent = Inches(-0.3 if numbered else 0)
        else:
            self.set_num(p, 3, level - 1)
        pf = p.paragraph_format
        pf.space_before = Pt({1: 0, 2: 24, 3: 18, 4: 14}[level]); pf.space_after = Pt(6)
        pf.keep_with_next = True; pf.line_spacing = 1.15
        r = p.add_run(text); r.font.name = FONT; set_rfonts(r._r.get_or_add_rPr())
        if level == 4:
            r.font.size = Pt(12); r.bold = True
        return p

    # ---------- tables ----------
    def shade(self, cell, fill):
        tcpr = cell._tc.get_or_add_tcPr()
        for old in tcpr.findall(qn("w:shd")): tcpr.remove(old)
        tcpr.append(el("w:shd", **{"w:val": "clear", "w:color": "auto", "w:fill": fill}))

    def cell_text(self, cell, text, bold=False, size=11, align=L):
        cell.text = ""
        lines = text if isinstance(text, list) else [text]
        for i, ln in enumerate(lines):
            p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
            self.fmt(p, align=align, before=3 if i == 0 else 1, after=3 if i == len(lines) - 1 else 1, line=1.0, first=0)
            self.runs(p, ln, size=size, bold=bold)

    def caption(self, label, name, where="above"):
        p = self.doc.add_paragraph()
        self.fmt(p, align=C, before=12 if where == "above" else 6, after=6 if where == "above" else 0, line=1.0, first=0, keep=(where == "above"))
        self.runs(p, label + " ", bold=True); self.runs(p, name)
        return p

    def make_table(self, widths, header=None):
        t = self.doc.add_table(rows=1 if header else 0, cols=len(widths))
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
        if header:
            hdr = t.rows[0]
            hdr._tr.get_or_add_trPr().append(el("w:tblHeader"))
            for i, (w, h) in enumerate(zip(widths, header)):
                c = hdr.cells[i]; c.width = Inches(w); self.cell_text(c, h, bold=True, align=C); self.shade(c, "D9D9D9")
                for cp in c.paragraphs: cp.paragraph_format.keep_with_next = True
        return t

    def add_row(self, t, widths, values, bold=False, fill=None, aligns=None, label_col=False, keep=False):
        row = t.add_row()
        row._tr.get_or_add_trPr().append(el("w:cantSplit"))
        for i, (w, v) in enumerate(zip(widths, values)):
            c = row.cells[i]; c.width = Inches(w)
            b = bold or (label_col and i == 0)
            self.cell_text(c, v, bold=b, align=aligns[i] if aligns else L)
            if fill: self.shade(c, fill)
            elif label_col and i == 0: self.shade(c, "F2F2F2")
            if keep:
                for cp in c.paragraphs: cp.paragraph_format.keep_with_next = True
        return row

    def table(self, spec):
        """spec: dict(label, name, widths, header, rows, kv=False, bold_last=False)
        With meta=[(label, value)], it becomes a data dictionary: the meta rows span the table, then
        the header row and the field rows follow."""
        if spec.get("meta"):
            return self.dict_table(spec)
        widths = spec["widths"]
        t = self.make_table(widths, spec.get("header"))
        rows = spec["rows"]
        for i, r in enumerate(rows):
            last = spec.get("bold_last") and i == len(rows) - 1
            # short tables stay on one page; long ones and use-case descriptions may split
            keep_all = spec.get("keep_all", not spec.get("kv") and len(rows) <= 12)
            keep = keep_all or i == len(rows) - 1  # the last row always stays with the caption below it
            self.add_row(t, widths, r, bold=last, fill="F2F2F2" if last else None, label_col=spec.get("kv", False), keep=keep)
        self.caption(spec["label"], spec["name"], where="below")
        return t

    def dict_table(self, spec):
        widths = spec["widths"]
        t = self.make_table(widths)
        for lab, val in spec["meta"]:
            row = self.add_row(t, widths, [lab] + [""] * (len(widths) - 1), label_col=True, keep=True)
            m = row.cells[1].merge(row.cells[-1])
            self.cell_text(m, val)
            for cp in m.paragraphs: cp.paragraph_format.keep_with_next = True
        self.add_row(t, widths, spec["header"], bold=True, fill="D9D9D9", aligns=[C] * len(widths), keep=True)
        for r in spec["rows"]:
            self.add_row(t, widths, r, keep=True)
        self.caption(spec["label"], spec["name"], where="below")
        return t

    def figure(self, spec):
        p = self.doc.add_paragraph()
        self.fmt(p, align=C, before=12, after=0, line=1.0, first=0, keep=True)
        p.add_run().add_picture(str(self.base / spec["path"]), width=Inches(spec["width"]))
        self.caption(spec["label"], spec["name"], where="below")

    # ---------- composite blocks ----------
    def techlist(self, items):
        for label, value in items:
            p = self.doc.add_paragraph(); self.fmt(p, before=4, align=L)
            p.paragraph_format.left_indent = Inches(3.0); p.paragraph_format.first_line_indent = Inches(-2.5)
            p.paragraph_format.tab_stops.add_tab_stop(Inches(3.0))
            self.runs(p, f"**{label}:**\t{value}")

    def refs(self, items):
        for i, text in enumerate(items, 1):
            p = self.doc.add_paragraph(); self.fmt(p, align=L, before=8)
            p.paragraph_format.left_indent = Inches(0.5); p.paragraph_format.first_line_indent = Inches(-0.5)
            self.runs(p, f"[{i}]\t{text}")

    def list_page(self, title, entries, col):
        self.heading(1, title, numbered=False)
        p = self.doc.add_paragraph(); self.fmt(p, before=18, after=6, line=1.0, first=0, align=L)
        p.paragraph_format.tab_stops.add_tab_stop(Inches(1.4)); p.paragraph_format.tab_stops.add_tab_stop(Inches(6.5), WD_TAB_ALIGNMENT.RIGHT)
        self.runs(p, f"**{col}\tDescription\tPage**")
        for label, name in entries:
            p = self.doc.add_paragraph(); self.fmt(p, before=4, after=0, line=1.3, first=0, align=L)
            p.paragraph_format.left_indent = Inches(1.4); p.paragraph_format.first_line_indent = Inches(-1.4)
            p.paragraph_format.tab_stops.add_tab_stop(Inches(1.4))
            p.paragraph_format.tab_stops.add_tab_stop(Inches(6.5), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
            self.runs(p, f"{label}\t{name}\t{self.pages.get(label, '00')}")

    def title_page(self, doc_title, title_lines, info=(), org_lines=()):
        """Same as the school template: five empty Title lines, the document name, "for", the system title.
        The template has no info block or college lines; pass info/org_lines only if they are ever needed."""
        for _ in range(5):
            self.fmt(self.doc.add_paragraph(style="Title"), before=0, line=1.0, first=0)
        p = self.doc.add_paragraph(style="Title"); self.fmt(p, align=C, before=0, after=12, line=1.0, first=0); self.runs(p, doc_title, size=20, bold=True)
        p = self.doc.add_paragraph(style="Subtitle"); self.fmt(p, align=C, before=6, after=12, line=1.0, first=0); self.runs(p, "for", size=14, italic=True)
        for line in title_lines:
            p = self.doc.add_paragraph(); self.fmt(p, align=C, before=0, after=0, line=1.3, first=0); self.runs(p, line, size=15, bold=True)
        if info or org_lines:
            for _ in range(6):
                self.fmt(self.doc.add_paragraph(), before=0, line=1.0, first=0)
        for label, value in info:
            p = self.doc.add_paragraph(); self.fmt(p, align=C, before=4, after=0, line=1.2, first=0)
            self.runs(p, f"**{label}:**  {value}")
        for i, line in enumerate(org_lines):
            p = self.doc.add_paragraph(); self.fmt(p, align=C, before=30 if i == 0 else 0, after=0, line=1.2, first=0)
            self.runs(p, line, bold=(i == 0))

    def start_body(self):
        self.doc.add_section(WD_SECTION.NEW_PAGE)
        front = self.doc.sections[0]._sectPr
        for ref in front.findall(qn("w:headerReference")) + front.findall(qn("w:footerReference")):
            front.remove(ref)
        main = self.doc.sections[-1]._sectPr
        pg = main.find(qn("w:pgNumType"))
        if pg is None:
            pg = el("w:pgNumType"); main.find(qn("w:pgMar")).addnext(pg)
        pg.set(qn("w:start"), "1"); pg.set(qn("w:fmt"), "decimal")
        for s in self.doc.sections:
            s.left_margin = s.right_margin = s.top_margin = s.bottom_margin = Inches(1)

    def render_blocks(self, blocks, tables, figures):
        bullets = lambda: self._add_abstract([("bullet", "", "Symbol", 720, 360), ("bullet", "o", "Courier New", 1440, 360)])
        arrows = lambda: self._add_abstract([("bullet", "Ø", "Wingdings", 720, 360), ("bullet", "", "Symbol", 1440, 360)])
        numbered = lambda: self._add_abstract([("decimal", "%1.", None, 720, 360)])
        for idx, (kind, payload) in enumerate(blocks):
            nxt = blocks[idx + 1][0] if idx + 1 < len(blocks) else None
            if kind == "p" and nxt in ("table", "figure"):
                kind = "pk"
            if kind in ("h1", "h2", "h3", "h4"):
                self.heading(int(kind[1]), payload)
            elif kind == "p":
                self.para(payload)
            elif kind == "pk":  # paragraph kept on the same page as the next block (e.g. a figure)
                self.para(payload, keep=True, after=6 if nxt == "table" else 0)
            elif kind == "bullets":
                nid = bullets()
                for item in payload:
                    if isinstance(item, tuple):
                        self.list_item(item[0], nid, 0)
                        for sub in item[1]: self.list_item(sub, nid, 1, before=2)
                    else:
                        self.list_item(item, nid, 0)
            elif kind == "arrows":
                nid = arrows()
                for head, items in payload:
                    self.list_item(f"**{head}**", nid, 0, before=10)
                    for it in items: self.list_item(it, nid, 1, before=4)
            elif kind == "numbered":
                nid = numbered()
                for it in payload: self.list_item(it, nid, 0)
            elif kind == "techlist":
                self.techlist(payload)
            elif kind == "refs":
                self.refs(payload)
            elif kind == "table":
                self.table(tables[payload])
            elif kind == "figure":
                self.figure(figures[payload])
            else:
                raise ValueError(kind)

    def header_footer(self, lines):
        hdr = self.doc.sections[-1].header; hdr.is_linked_to_previous = False
        for p in list(hdr.paragraphs): p._p.getparent().remove(p._p)
        for t in list(hdr.tables): t._tbl.getparent().remove(t._tbl)
        for i, text in enumerate(lines):
            p = hdr.add_paragraph(); self.fmt(p, align=L, before=0, after=0, line=1.0, first=0)
            self.runs(p, text, size=8 if i == 0 else 7, bold=(i == 0))
        ftr = self.doc.sections[-1].footer; ftr.is_linked_to_previous = False
        for p in list(ftr.paragraphs): p._p.getparent().remove(p._p)
        for t in list(ftr.tables): t._tbl.getparent().remove(t._tbl)
        p = ftr.add_paragraph(); self.fmt(p, align=R, before=0, after=0, line=1.0, first=0)
        fld = el("w:fldSimple", **{"w:instr": " PAGE "})
        r = OxmlElement("w:r"); rpr = OxmlElement("w:rPr"); set_rfonts(rpr); rpr.append(el("w:sz", **{"w:val": 20})); r.append(rpr)
        t = OxmlElement("w:t"); t.text = "1"; r.append(t); fld.append(r); p._p.append(fld)

    def save(self, path, title, subject):
        cp = self.doc.core_properties
        cp.title = title; cp.author = "Capstone Team"; cp.subject = subject
        # python-docx templates may carry a <w:zoom> without the required percent attribute
        zoom = self.doc.settings.element.find(qn("w:zoom"))
        if zoom is not None and zoom.get(qn("w:percent")) is None:
            zoom.set(qn("w:percent"), "100")
        self.doc.save(path)
