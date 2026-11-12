# -*- coding: utf-8 -*-
"""Draws the SRS figures: use case diagrams (SVG in HTML, rendered by Edge),
the system overview diagram, and the prototype composites (from the mockup PNGs)."""
import subprocess, textwrap
from html import escape
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw
from usecases import USECASES, PROTOTYPES, prototype_parts

HERE = Path(__file__).parent
FIG = HERE / "fig"; FIG.mkdir(exist_ok=True)
SCREENS = HERE.parent.parent / "presentation" / "prototype-screens"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
INK = "#222"

def wrap(text, width):
    return textwrap.wrap(text, width) or [text]

def actor(x, y, name):
    lines = wrap(name, 14)
    s = [f'<g stroke="{INK}" stroke-width="2.2" fill="none">',
         f'<circle cx="{x}" cy="{y-38}" r="13" fill="#fff"/>', f'<line x1="{x}" y1="{y-25}" x2="{x}" y2="{y+12}"/>',
         f'<line x1="{x-22}" y1="{y-12}" x2="{x+22}" y2="{y-12}"/>', f'<line x1="{x}" y1="{y+12}" x2="{x-18}" y2="{y+40}"/>',
         f'<line x1="{x}" y1="{y+12}" x2="{x+18}" y2="{y+40}"/></g>']
    for i, ln in enumerate(lines):
        s.append(f'<text x="{x}" y="{y+62+i*18}" text-anchor="middle" font-size="16" font-weight="700" fill="{INK}">{escape(ln)}</text>')
    return "".join(s)

def ellipse(cx, cy, rx, ry, name):
    lines = wrap(name, 20 if rx < 140 else 24)
    s = [f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#fff" stroke="{INK}" stroke-width="2"/>']
    y0 = cy - (len(lines) - 1) * 9 + 5
    for i, ln in enumerate(lines):
        s.append(f'<text x="{cx}" y="{y0+i*18}" text-anchor="middle" font-size="15" font-weight="700" fill="{INK}">{escape(ln)}</text>')
    return "".join(s)

def usecase_svg(uc):
    a, b = uc["a"], uc["b"]
    has_right = bool(uc["right"])
    W = 1100
    rows = max(len(a), len(b), 1)
    step, ry = 96, 36
    top = 70
    H = top + rows * step + 50
    bx0 = 220
    bx1 = W - 220 if has_right else W - 50
    two = bool(b)
    if two:
        rx = 128
        ca = bx0 + (bx1 - bx0) * 0.28; cb = bx0 + (bx1 - bx0) * 0.74
    else:
        rx = 170
        ca = (bx0 + bx1) / 2; cb = None
    def ys(n):
        span = rows * step
        start = top + 40 + (span - n * step) / 2 + step / 2
        return [start + i * step for i in range(n)]
    pos = {}
    for n, y in zip(a, ys(len(a))): pos[n] = (ca, y)
    for n, y in zip(b, ys(len(b))): pos[n] = (cb, y)
    parts = [f'<rect x="{bx0}" y="20" width="{bx1-bx0}" height="{H-40}" fill="#fff" stroke="{INK}" stroke-width="2"/>',
             f'<text x="{(bx0+bx1)/2}" y="50" text-anchor="middle" font-size="19" font-weight="700" fill="{INK}">Revenue Collection and Monitoring System</text>']
    def actor_pos(names, x):
        n = len(names)
        return {nm: (x, 20 + (H - 40) * (i + 0.5) / n) for i, nm in enumerate(names)}
    apos = actor_pos(uc["left"], 95)
    apos.update(actor_pos(uc["right"], W - 95))
    lines = []
    for act, targets in uc["links"].items():
        axp, ayp = apos[act]
        left = act in uc["left"]
        for t in targets:
            cx, cy = pos[t]
            ex = cx - rx if left else cx + rx
            sx = axp + (28 if left else -28)
            lines.append(f'<line x1="{sx}" y1="{ayp-8}" x2="{ex}" y2="{cy}" stroke="#555" stroke-width="1.6"/>')
    incl = []
    for src, dst in uc["include"]:
        sx, sy = pos[src]; dx, dy = pos[dst]
        x1, x2 = sx + rx, dx - rx
        incl.append(f'<line x1="{x1}" y1="{sy}" x2="{x2+2}" y2="{dy}" stroke="#555" stroke-width="1.6" stroke-dasharray="7 5" marker-end="url(#arr)"/>')
        mx, my = (x1 + x2) / 2, (sy + dy) / 2
        incl.append(f'<text x="{mx}" y="{my-6}" text-anchor="middle" font-size="13" font-style="italic" fill="#333" stroke="#fff" stroke-width="4" paint-order="stroke">«include»</text>')
    shapes = [ellipse(x, y, rx, ry, n) for n, (x, y) in pos.items()]
    actors = [actor(x, y, n) for n, (x, y) in apos.items()]
    defs = '<defs><marker id="arr" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10" fill="none" stroke="#555" stroke-width="1.6"/></marker></defs>'
    body = defs + "".join(parts) + "".join(lines) + "".join(incl) + "".join(shapes) + "".join(actors)
    return W, H, f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Arial, Helvetica, sans-serif">{body}</svg>'

def overview_svg():
    W, H = 1200, 620
    box = lambda x, y, w, h, title, sub, fill="#1446B3": (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{fill}"/>'
        f'<text x="{x+w/2}" y="{y+h/2-6}" text-anchor="middle" font-size="22" font-weight="700" fill="#fff">{escape(title)}</text>'
        f'<text x="{x+w/2}" y="{y+h/2+20}" text-anchor="middle" font-size="15" fill="#E6ECFA">{escape(sub)}</text>')
    ext = lambda x, y, w, h, title, sub: (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#fff" stroke="#1446B3" stroke-width="2.5" stroke-dasharray="9 6"/>'
        f'<text x="{x+w/2}" y="{y+h/2-6}" text-anchor="middle" font-size="20" font-weight="700" fill="#1446B3">{escape(title)}</text>'
        f'<text x="{x+w/2}" y="{y+h/2+20}" text-anchor="middle" font-size="15" fill="#333">{escape(sub)}</text>')
    def arrow(x1, y1, x2, y2, label, both=False):  # a label with "|" is stacked above the line, one part per row
        lines = label.split("|")
        s = (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#1446B3" stroke-width="3" marker-end="url(#a)"' + (' marker-start="url(#s)"' if both else '') + '/>')
        for i, ln in enumerate(lines):
            y = (y1 + y2) / 2 - 10 - (len(lines) - 1 - i) * 18
            s += f'<text x="{(x1+x2)/2}" y="{y}" text-anchor="middle" font-size="15" fill="#222" stroke="#fff" stroke-width="5" paint-order="stroke">{escape(ln)}</text>'
        return s
    defs = ('<defs><marker id="a" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1446B3"/></marker>'
            '<marker id="s" markerWidth="10" markerHeight="10" refX="2" refY="5" orient="auto"><path d="M10,0 L0,5 L10,10 z" fill="#1446B3"/></marker></defs>')
    parts = [defs,
             ext(40, 30, 300, 110, "Paper Logbook", "handwritten “name – amount” lines"),
             box(40, 230, 300, 140, "Mobile App", "Android · staff, owner, members"),
             ext(460, 30, 300, 110, "Google Gemini API", "online OCR (Gemini 2.5 Flash)"),
             box(460, 230, 300, 140, "Supabase Cloud", "PostgreSQL · Auth · RLS"),
             box(860, 230, 300, 140, "Desktop App", "Windows · administrator"),
             ext(860, 480, 300, 110, "Local SQLite Database", "members, payments, rates"),
             ext(40, 480, 300, 110, "Google ML Kit", "offline OCR on the phone"),
             ext(460, 480, 300, 110, "Expo Push Service", "renewal reminders"),
             arrow(190, 140, 190, 228, "photo"),
             arrow(342, 270, 458, 110, "page image", both=True),
             arrow(342, 320, 458, 320, "uploads,|member data", both=True),
             arrow(762, 300, 858, 300, "logbook,|member data", both=True),
             arrow(1010, 374, 1010, 476, "records", both=True),
             arrow(190, 374, 190, 476, "offline OCR", both=True),
             arrow(610, 374, 610, 476, "reminders"),
             arrow(458, 520, 344, 362, "push")]
    return W, H, f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Arial, Helvetica, sans-serif">{"".join(parts)}</svg>'

def render(name, W, H, svg):
    html = FIG / f"{name}.html"
    html.write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>html,body{{margin:0;background:#fff}}</style></head><body>{svg}</body></html>', encoding="utf-8")
    png = FIG / f"{name}.png"
    import sys; sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
    from edge import screenshot
    screenshot(html, png, W, H)  # waits until Edge has written the file
    trim(png)

def trim(png, pad=24):
    im = Image.open(png).convert("RGB")
    bbox = ImageChops.difference(im, Image.new("RGB", im.size, "white")).getbbox()
    im.crop((max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(im.width, bbox[2]+pad), min(im.height, bbox[3]+pad))).save(png)

def phone(path, h=1600):
    im = Image.open(path).convert("RGB")
    w = int(im.width * h / im.height)
    im = im.resize((w, h))
    bez = 26
    frame = Image.new("RGB", (w + 2 * bez, h + 2 * bez), "white")
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle([0, 0, frame.width - 1, frame.height - 1], radius=90, fill="#05070D")
    mask = Image.new("L", (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=66, fill=255)
    frame.paste(im, (bez, bez), mask)
    return frame

def desktop(path, w=2400):
    im = Image.open(path).convert("RGB")
    im = im.resize((w, int(im.height * w / im.width)))
    out = Image.new("RGB", (im.width + 6, im.height + 6), "#9aa0a6"); out.paste(im, (3, 3))
    return out

def prototypes():
    for pr, (names, _) in PROTOTYPES.items():
        for key, part in prototype_parts(pr, names):
            imgs = [phone(SCREENS / "mobile" / f"{n}.png") if n.startswith("m-") else desktop(SCREENS / "desktop" / f"{n}.png") for n in part]
            if part[0].startswith("m-"):
                gap = 90
                W = sum(i.width for i in imgs) + gap * (len(imgs) - 1); H = max(i.height for i in imgs)
                canvas = Image.new("RGB", (W, H), "white"); x = 0
                for i in imgs: canvas.paste(i, (x, 0)); x += i.width + gap
            else:
                gap = 70
                W = max(i.width for i in imgs); H = sum(i.height for i in imgs) + gap * (len(imgs) - 1)
                canvas = Image.new("RGB", (W, H), "white"); y = 0
                for i in imgs: canvas.paste(i, (0, y)); y += i.height + gap
            canvas.save(FIG / f"{key}.png")

if __name__ == "__main__":
    render("overview", *overview_svg())
    for uc in USECASES:
        render(uc["id"], *usecase_svg(uc))
        print(uc["id"], Image.open(FIG / f"{uc['id']}.png").size)
    prototypes()
    print("prototypes done")
