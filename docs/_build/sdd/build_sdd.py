# -*- coding: utf-8 -*-
"""Builds docs/SDD.docx and docs/SDD.md. Run: python figures_sdd.py (once, or after changing diagrams),
then python build_sdd.py

python build_sdd.py --no-interface builds docs/SDD-without-Interface-Design.docx and .md instead: the same
document without Section 5 (Human Interface Design), for the version submitted before the system is built."""
import shutil, sys
from pathlib import Path

HERE = Path(__file__).parent
DOCS = HERE.parent.parent
sys.path.insert(0, str(HERE.parent / "lib"))
sys.path.insert(0, str(HERE))
from docbuilder import DocBuilder
from tomd import to_markdown
import twopass
import content_sdd as C

TEMPLATE = r"C:\capstone\internal\templates\3. Software Design Description Template.docx"
if "--no-interface" in sys.argv:
    BLOCKS, FIG_ENTRIES, TAB_ENTRIES = C.without_interface()
    OUT, PDF, PAGES, NAME = HERE / "SDD-no-interface-build.docx", HERE / "sdd-no-interface.pdf", HERE / "pages-no-interface.json", "SDD-without-Interface-Design"
else:
    BLOCKS, FIG_ENTRIES, TAB_ENTRIES = C.DOC, C.FIG_ENTRIES, C.TAB_ENTRIES
    OUT, PDF, PAGES, NAME = HERE / "SDD-build.docx", HERE / "sdd.pdf", HERE / "pages.json", "SDD"


def build(pages):
    b = DocBuilder(TEMPLATE, HERE, pages)
    b.title_page(C.DOC_TITLE, C.TITLE_PAGE_LINES)
    b.list_page("List of Figures", FIG_ENTRIES, "Figure No.")
    b.list_page("List of Tables", TAB_ENTRIES, "Table No.")
    b.start_body()
    b.render_blocks(BLOCKS, C.TABLES, C.FIGURES)
    b.header_footer([C.DOC_TITLE] + C.TITLE_LINES)
    b.save(OUT, "Software Design Description", C.SYSTEM)


if __name__ == "__main__":
    labels = [l for l, _ in FIG_ENTRIES] + [l for l, _ in TAB_ENTRIES]
    pages, total = twopass.run(build, labels, OUT, PDF, PAGES, first="Introduction")
    print("pages:", total, pages)
    shutil.copy(OUT, DOCS / f"{NAME}.docx")
    assets = DOCS / "assets" / "sdd"
    assets.mkdir(parents=True, exist_ok=True)
    for f in C.FIGURES.values():
        shutil.copy(HERE / f["path"], assets / Path(f["path"]).name)
    md = to_markdown(C.DOC_TITLE, C.SYSTEM, [], BLOCKS, C.TABLES, C.FIGURES, fig_prefix="assets/sdd/")
    (DOCS / f"{NAME}.md").write_text(md, encoding="utf-8")
    print(f"copied to docs/{NAME}.docx, docs/{NAME}.md and docs/assets/sdd/")
