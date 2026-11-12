# -*- coding: utf-8 -*-
"""Builds docs/SRS.docx. Run: python make_figures.py (once, or after changing diagrams), then python build_srs.py"""
import shutil, sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "lib"))
sys.path.insert(0, str(HERE))
from docbuilder import DocBuilder
import twopass
import content_srs as C

TEMPLATE = r"C:\capstone\internal\templates\2. Software Requirement Specification Template.docx"
OUT = HERE / "SRS-build.docx"
PDF = HERE / "srs.pdf"

def build(pages):
    b = DocBuilder(TEMPLATE, HERE, pages)
    b.title_page(C.DOC_TITLE, C.TITLE_PAGE_LINES)
    b.list_page("List of Figures", C.FIG_ENTRIES, "Figure No.")
    b.list_page("List of Tables", C.TAB_ENTRIES, "Table No.")
    b.start_body()
    b.render_blocks(C.DOC, C.TABLES, C.FIGURES)
    b.header_footer([C.DOC_TITLE] + C.TITLE_LINES)
    b.save(OUT, "Software Requirement Specification", C.SYSTEM)

if __name__ == "__main__":
    labels = [l for l, _ in C.FIG_ENTRIES] + [l for l, _ in C.TAB_ENTRIES]
    pages, total = twopass.run(build, labels, OUT, PDF, HERE / "pages.json")
    print("pages:", total, pages)
    shutil.copy(OUT, HERE.parent.parent / "SRS.docx")
    print("copied to docs/SRS.docx")
