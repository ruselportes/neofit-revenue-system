# -*- coding: utf-8 -*-
"""Two-pass build: build with placeholder page numbers, render to PDF through Word/WPS,
read the page of every figure and table caption, then build again with the real numbers."""
import json, re, subprocess
from pathlib import Path

RENDER = Path(__file__).parent / "render.ps1"

def render(docx, pdf):
    pdf = Path(pdf)
    if pdf.exists():
        pdf.unlink()
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(RENDER),
                    "-docx", str(Path(docx).resolve()), "-pdf", str(pdf.resolve())], capture_output=True, timeout=300)
    if not pdf.exists():
        raise RuntimeError("PDF render failed")

def find_pages(pdf, labels, first="Overview"):
    import fitz
    texts = [pg.get_text() for pg in fitz.open(str(pdf))]
    front = next(i for i, t in enumerate(texts) if i >= 2 and re.search(r"1\.\s*" + first, t))
    pages = {}
    for lab in labels:
        for i in range(front, len(texts)):
            if re.search(re.escape(lab) + r"\s", texts[i]):
                pages[lab] = str(i - front + 1)
                break
    return pages, len(texts)

def run(build, labels, docx, pdf, pages_json, first="Overview"):
    build({})
    render(docx, pdf)
    pages, _ = find_pages(pdf, labels, first)
    for attempt in range(3):
        build(pages)
        render(docx, pdf)
        new, total = find_pages(pdf, labels, first)
        if new == pages:
            Path(pages_json).write_text(json.dumps(pages, indent=1))
            return pages, total
        pages = new
    raise RuntimeError("page numbers did not settle")
