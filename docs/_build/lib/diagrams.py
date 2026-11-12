# -*- coding: utf-8 -*-
"""SVG generators for UML class diagrams, sequence diagrams and ER diagrams, rendered to PNG with Edge."""
import subprocess
from html import escape
from pathlib import Path
from PIL import Image, ImageChops

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
INK, LINE, HEAD, ALT = "#1f2328", "#444", "#1446B3", "#E8EEFB"
FONT = "Arial, Helvetica, sans-serif"
CW = 7.4  # approx. width of one character at 13.5px Arial


def render(svg, W, H, png):
    png = Path(png)
    html = png.with_suffix(".html")
    html.write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>html,body{{margin:0;background:#fff}}</style></head><body>{svg}</body></html>', encoding="utf-8")
    from edge import screenshot
    screenshot(html, png, W, H)  # waits until Edge has written the file
    html.unlink()
    im = Image.open(png).convert("RGB")
    bbox = ImageChops.difference(im, Image.new("RGB", im.size, "white")).getbbox()
    pad = 24
    im.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad))).save(png)


def t(x, y, s, size=13.5, weight=400, anchor="start", color=INK, italic=False):
    st = ' font-style="italic"' if italic else ""
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{color}"{st}>{escape(s)}</text>'


def defs():
    return ('<defs>'
            '<marker id="open" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto"><path d="M1,1 L11,6 L1,11" fill="none" stroke="#444" stroke-width="1.5"/></marker>'
            '<marker id="solid" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto"><path d="M1,1 L11,6 L1,11 z" fill="#444"/></marker>'
            '<marker id="diamond" markerWidth="18" markerHeight="12" refX="1" refY="6" orient="auto"><path d="M1,6 L8,1 L16,6 L8,11 z" fill="#444"/></marker>'
            '</defs>')


# ------------------------------------------------------------------ class diagrams
def class_box(c):
    stereo = c.get("stereo")
    lines_a, lines_m = c.get("attrs", []), c.get("methods", [])
    width = max([len(c["name"]) * 8.6 + 30] + [len(s) * CW + 24 for s in lines_a + lines_m] + [len(stereo) * 7 + 30 if stereo else 0])
    width = max(width, 170)
    head_h = 46 if stereo else 32
    h = head_h + max(1, len(lines_a)) * 19 + 10 + (max(1, len(lines_m)) * 19 + 10 if lines_m or c.get("show_methods", True) else 0)
    return width, h, head_h


def class_diagram(spec, png):
    boxes = {}
    parts = []
    for c in spec["classes"]:
        w, h, hh = class_box(c)
        x, y = c["x"], c["y"]
        boxes[c["id"]] = (x, y, w, h)
        fill = c.get("fill", "#FFFFFF")
        parts.append(f'<rect x="{x}" y="{y}" width="{w:.1f}" height="{h}" fill="{fill}" stroke="{INK}" stroke-width="1.6"/>')
        parts.append(f'<rect x="{x}" y="{y}" width="{w:.1f}" height="{hh}" fill="{ALT}" stroke="{INK}" stroke-width="1.6"/>')
        cy = y + 21
        if c.get("stereo"):
            parts.append(t(x + w / 2, y + 17, f"«{c['stereo']}»", 12, 400, "middle", "#555", True)); cy = y + 36
        parts.append(t(x + w / 2, cy, c["name"], 15, 700, "middle"))
        ay = y + hh
        attrs = c.get("attrs", [])
        for i, a in enumerate(attrs):
            parts.append(t(x + 10, ay + 18 + i * 19, a))
        ay2 = ay + max(1, len(attrs)) * 19 + 10
        methods = c.get("methods", [])
        if methods or c.get("show_methods", True):
            parts.append(f'<line x1="{x}" y1="{ay2}" x2="{x + w:.1f}" y2="{ay2}" stroke="{INK}" stroke-width="1.2"/>')
            for i, m in enumerate(methods):
                parts.append(t(x + 10, ay2 + 18 + i * 19, m))
    W = max(x + w for x, y, w, h in boxes.values()) + 40
    H = max(y + h for x, y, w, h in boxes.values()) + 40

    def clip(box, tx, ty):
        x, y, w, h = box
        cx, cy = x + w / 2, y + h / 2
        dx, dy = tx - cx, ty - cy
        if dx == 0 and dy == 0:
            return cx, cy
        sx = (w / 2) / abs(dx) if dx else 1e9
        sy = (h / 2) / abs(dy) if dy else 1e9
        s = min(sx, sy)
        return cx + dx * s, cy + dy * s

    def anchor(box, side, frac=0.5):
        x, y, w, h = box
        return {"left": (x, y + h * frac), "right": (x + w, y + h * frac),
                "top": (x + w * frac, y), "bottom": (x + w * frac, y + h)}[side]

    edges, mult = [], []
    for e in spec.get("edges", []):
        a, b = boxes[e["from"]], boxes[e["to"]]
        acx, acy = a[0] + a[2] / 2, a[1] + a[3] / 2
        bcx, bcy = b[0] + b[2] / 2, b[1] + b[3] / 2
        if "a" in e:  # routed edge: anchors on named sides, optional orthogonal waypoints
            p0, pb = anchor(a, *e["a"]), anchor(b, *e["b"])
            pts, cur = [p0], p0
            for d, v in e.get("via", []):
                if v == "b": v = pb[0] if d == "h" else pb[1]
                cur = (v, cur[1]) if d == "h" else (cur[0], v)
                pts.append(cur)
            pts.append(pb)
        else:
            if "ax" in e: acx = a[0] + a[2] * e["ax"]
            if "bx" in e: bcx = b[0] + b[2] * e["bx"]
            x1, y1 = clip(a, bcx, bcy) if "ax" not in e else (acx, a[1] + (a[3] if bcy > acy else 0))
            x2, y2 = clip(b, acx, acy) if "bx" not in e else (bcx, b[1] + (0 if bcy > acy else b[3]))
            pts = [(x1, y1), (x2, y2)]
        kind = e.get("kind", "assoc")
        dash = ' stroke-dasharray="7 5"' if kind == "uses" else ""
        mstart = ' marker-start="url(#diamond)"' if kind == "comp" else ""
        mend = ' marker-end="url(#open)"' if kind in ("uses", "nav") else ""
        pstr = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        edges.append(f'<polyline points="{pstr}" fill="none" stroke="{LINE}" stroke-width="1.5"{dash}{mstart}{mend}/>')
        if e.get("label"):
            segs = list(zip(pts, pts[1:]))
            (sx1, sy1), (sx2, sy2) = max(segs, key=lambda sg: (sg[0][0] - sg[1][0]) ** 2 + (sg[0][1] - sg[1][1]) ** 2)
            mx, my = (sx1 + sx2) / 2 + e.get("lx", 0), (sy1 + sy2) / 2 + e.get("ly", 0)
            if abs(sx2 - sx1) < abs(sy2 - sy1) and "lx" not in e:  # vertical segment: label beside it
                edges.append(f'<text x="{mx + 8:.1f}" y="{my + 4:.1f}" font-size="12.5" text-anchor="start" fill="#333" font-style="italic" stroke="#fff" stroke-width="4" paint-order="stroke">{escape(e["label"])}</text>')
            else:
                edges.append(f'<text x="{mx:.1f}" y="{my - 6:.1f}" font-size="12.5" text-anchor="middle" fill="#333" font-style="italic" stroke="#fff" stroke-width="4" paint-order="stroke">{escape(e["label"])}</text>')
        for key, (px, py), (qx, qy) in (("m1", pts[0], pts[1]), ("m2", pts[-1], pts[-2])):
            if e.get(key):
                L = ((qx - px) ** 2 + (qy - py) ** 2) ** 0.5 or 1
                ox, oy = px + (qx - px) / L * 26, py + (qy - py) / L * 26
                if abs(qx - px) > abs(qy - py):  # mostly horizontal: label above the line
                    mult.append(f'<text x="{ox:.1f}" y="{oy - 8:.1f}" font-size="12.5" text-anchor="middle" fill="#333" stroke="#fff" stroke-width="4" paint-order="stroke">{escape(e[key])}</text>')
                else:  # mostly vertical: label beside the line
                    mult.append(f'<text x="{ox + 9:.1f}" y="{oy + 4:.1f}" font-size="12.5" fill="#333" stroke="#fff" stroke-width="4" paint-order="stroke">{escape(e[key])}</text>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" font-family="{FONT}">{defs()}{"".join(edges)}{"".join(parts)}{"".join(mult)}</svg>'
    render(svg, W, H, png)


# ------------------------------------------------------------------ sequence diagrams
def sequence_diagram(spec, png):
    parts_ = spec["participants"]
    gap = spec.get("gap", 190)
    x0 = spec.get("x0", 80)
    xs = {p: x0 + i * gap for i, p in enumerate([p[0] for p in parts_])}
    top = 30
    step = spec.get("step", 44)
    msgs = spec["messages"]
    n = len(msgs)
    y_first = top + 118
    H = y_first + n * step + 60
    W = x0 + (len(parts_) - 1) * gap + 130
    for m in msgs:  # room for self-message labels on the right
        if m[0] == m[1]:
            W = max(W, xs[m[0]] + 60 + len(m[2]) * 7.2)
    out = []
    # fragments behind everything
    for fr in spec.get("fragments", []):
        i0, i1, label = fr["start"], fr["end"], fr["label"]
        fx0 = min(xs[p] for p in fr["span"]) - 80
        fx1 = max(xs[p] for p in fr["span"]) + 80
        fy0 = y_first + i0 * step - 34
        fy1 = y_first + i1 * step + 16
        out.append(f'<rect x="{fx0}" y="{fy0}" width="{fx1 - fx0}" height="{fy1 - fy0}" fill="#FAFBFE" stroke="#8a94a6" stroke-width="1.3"/>')
        tw = len(label) * 7 + 18
        out.append(f'<path d="M{fx0},{fy0} h{tw} v14 l-8,8 h{-(tw - 8)} z" fill="{ALT}" stroke="#8a94a6" stroke-width="1.2"/>')
        out.append(t(fx0 + 6, fy0 + 16, label, 12.5, 700))
        if "else" in fr:
            ey = y_first + fr["else"] * step - 30
            out.append(f'<line x1="{fx0}" y1="{ey}" x2="{fx1}" y2="{ey}" stroke="#8a94a6" stroke-width="1.2" stroke-dasharray="6 4"/>')
            out.append(t(fx0 + 8, ey + 15, fr.get("else_label", "[else]"), 12.5, 700))
    for pid, name, kind in parts_:
        x = xs[pid]
        ly = top + 78 if kind == "actor" else top + 22 + 17 * len(name.split("\n"))
        out.append(f'<line x1="{x}" y1="{ly}" x2="{x}" y2="{H - 20}" stroke="#9aa3b2" stroke-width="1.3" stroke-dasharray="6 5"/>')
        if kind == "actor":
            out.append(f'<g stroke="{INK}" stroke-width="2" fill="none"><circle cx="{x}" cy="{top + 8}" r="9" fill="#fff"/><line x1="{x}" y1="{top + 17}" x2="{x}" y2="{top + 36}"/><line x1="{x - 14}" y1="{top + 24}" x2="{x + 14}" y2="{top + 24}"/><line x1="{x}" y1="{top + 36}" x2="{x - 11}" y2="{top + 52}"/><line x1="{x}" y1="{top + 36}" x2="{x + 11}" y2="{top + 52}"/></g>')
            out.append(t(x, top + 70, name, 13, 700, "middle"))
        else:
            lines = name.split("\n")
            bw = max(len(l) for l in lines) * 7.6 + 26
            bh = 22 + 17 * len(lines)
            fill = "#FFF6E5" if kind == "ext" else "#FFFFFF"
            out.append(f'<rect x="{x - bw / 2:.1f}" y="{top}" width="{bw:.1f}" height="{bh}" rx="4" fill="{fill}" stroke="{INK}" stroke-width="1.6"/>')
            for i, l in enumerate(lines):
                out.append(t(x, top + 20 + i * 17, l, 13, 700, "middle"))
    for i, m in enumerate(msgs):
        a, b, label = m[0], m[1], m[2]
        kind = m[3] if len(m) > 3 else "call"
        y = y_first + i * step
        xa, xb = xs[a], xs[b]
        if a == b:
            out.append(f'<path d="M{xa},{y - 8} h40 v18 h-38" fill="none" stroke="{LINE}" stroke-width="1.5" marker-end="url(#solid)"/>')
            out.append(t(xa + 48, y + 2, label, 12.5))
            continue
        dash = ' stroke-dasharray="7 5"' if kind == "return" else ""
        marker = "open" if kind == "return" else "solid"
        out.append(f'<line x1="{xa}" y1="{y}" x2="{xb - (6 if xb > xa else -6)}" y2="{y}" stroke="{LINE}" stroke-width="1.5"{dash} marker-end="url(#{marker})"/>')
        out.append(f'<text x="{(xa + xb) / 2:.1f}" y="{y - 7}" font-size="12.5" text-anchor="middle" fill="{INK}" stroke="#fff" stroke-width="4" paint-order="stroke">{escape(label)}</text>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="{FONT}">{defs()}{"".join(out)}</svg>'
    render(svg, W, H, png)


# ------------------------------------------------------------------ ER diagrams
def erd(spec, png):
    boxes, out = {}, []
    for ent in spec["entities"]:
        cols = ent["cols"]
        w = max([len(ent["name"]) * 9 + 30] + [len(c[0]) * 7.8 + len(c[1]) * 7.2 + 64 for c in cols])
        h = 34 + len(cols) * 22 + 8
        x, y = ent["x"], ent["y"]
        boxes[ent["name"]] = (x, y, w, h)
        out.append(f'<rect x="{x}" y="{y}" width="{w:.1f}" height="{h}" fill="#fff" stroke="{INK}" stroke-width="1.6"/>')
        out.append(f'<rect x="{x}" y="{y}" width="{w:.1f}" height="34" fill="{HEAD}"/>')
        out.append(t(x + w / 2, y + 22, ent["name"], 15, 700, "middle", "#fff"))
        for i, (col, typ, key) in enumerate(cols):
            yy = y + 34 + 18 + i * 22
            if key:
                out.append(t(x + 10, yy, key, 11.5, 700, "start", "#B45309" if key == "PK" else "#1446B3"))
            out.append(t(x + 40, yy, col, 13.5, 700 if key == "PK" else 400))
            out.append(t(x + w - 10, yy, typ, 12.5, 400, "end", "#555"))
    for r in spec["rels"]:
        a, b = boxes[r["one"]], boxes[r["many"]]
        side = r.get("side", "h")
        if side == "h":
            if a[0] + a[2] <= b[0]:
                x1, x2 = a[0] + a[2], b[0]
            else:
                x1, x2 = a[0], b[0] + b[2]
            y1 = a[1] + a[3] / 2 if "ya" not in r else a[1] + 34 + 11 + r["ya"] * 22
            y2 = b[1] + b[3] / 2 if "yb" not in r else b[1] + 34 + 11 + r["yb"] * 22
            dirn = 1 if x2 > x1 else -1
            mid = (x1 + x2) / 2
            out.append(f'<path d="M{x1},{y1} H{mid} V{y2} H{x2}" fill="none" stroke="{LINE}" stroke-width="1.6"/>')
            # one end: two bars
            out.append(f'<line x1="{x1 + dirn * 10}" y1="{y1 - 8}" x2="{x1 + dirn * 10}" y2="{y1 + 8}" stroke="{LINE}" stroke-width="1.6"/>')
            out.append(f'<line x1="{x1 + dirn * 16}" y1="{y1 - 8}" x2="{x1 + dirn * 16}" y2="{y1 + 8}" stroke="{LINE}" stroke-width="1.6"/>')
            if r.get("oneone"):  # one-to-one: two bars at both ends
                for off in (10, 16):
                    out.append(f'<line x1="{x2 - dirn * off}" y1="{y2 - 8}" x2="{x2 - dirn * off}" y2="{y2 + 8}" stroke="{LINE}" stroke-width="1.6"/>')
                if r.get("label"):
                    out.append(f'<text x="{mid:.1f}" y="{min(y1, y2) - 8:.1f}" font-size="12.5" text-anchor="middle" fill="#333" font-style="italic" stroke="#fff" stroke-width="4" paint-order="stroke">{escape(r["label"])}</text>')
                continue
            # many end: crow's foot
            out.append(f'<path d="M{x2 - dirn * 14},{y2} L{x2},{y2 - 8} M{x2 - dirn * 14},{y2} L{x2},{y2 + 8} M{x2 - dirn * 14},{y2} L{x2},{y2}" stroke="{LINE}" stroke-width="1.6" fill="none"/>')
            out.append(f'<circle cx="{x2 - dirn * 22}" cy="{y2}" r="5" fill="#fff" stroke="{LINE}" stroke-width="1.5"/>' if r.get("optional") else f'<line x1="{x2 - dirn * 20}" y1="{y2 - 8}" x2="{x2 - dirn * 20}" y2="{y2 + 8}" stroke="{LINE}" stroke-width="1.6"/>')
            if r.get("label"):
                out.append(f'<text x="{mid:.1f}" y="{min(y1, y2) - 8:.1f}" font-size="12.5" text-anchor="middle" fill="#333" font-style="italic" stroke="#fff" stroke-width="4" paint-order="stroke">{escape(r["label"])}</text>')
        else:
            x1 = a[0] + a[2] / 2; x2 = b[0] + b[2] / 2
            y1, y2 = a[1] + a[3], b[1]
            mid = (y1 + y2) / 2
            out.append(f'<path d="M{x1},{y1} V{mid} H{x2} V{y2}" fill="none" stroke="{LINE}" stroke-width="1.6"/>')
            out.append(f'<line x1="{x1 - 8}" y1="{y1 + 10}" x2="{x1 + 8}" y2="{y1 + 10}" stroke="{LINE}" stroke-width="1.6"/><line x1="{x1 - 8}" y1="{y1 + 16}" x2="{x1 + 8}" y2="{y1 + 16}" stroke="{LINE}" stroke-width="1.6"/>')
            if r.get("oneone"):  # one-to-one: a bar at the far end, with a circle before it when optional (zero or one)
                out.append(f'<line x1="{x2 - 8}" y1="{y2 - 10}" x2="{x2 + 8}" y2="{y2 - 10}" stroke="{LINE}" stroke-width="1.6"/>')
                out.append(f'<circle cx="{x2}" cy="{y2 - 20}" r="5" fill="#fff" stroke="{LINE}" stroke-width="1.5"/>' if r.get("optional") else f'<line x1="{x2 - 8}" y1="{y2 - 16}" x2="{x2 + 8}" y2="{y2 - 16}" stroke="{LINE}" stroke-width="1.6"/>')
            else:
                out.append(f'<path d="M{x2},{y2 - 14} L{x2 - 8},{y2} M{x2},{y2 - 14} L{x2 + 8},{y2} M{x2},{y2 - 14} L{x2},{y2}" stroke="{LINE}" stroke-width="1.6" fill="none"/>')
                out.append(f'<circle cx="{x2}" cy="{y2 - 22}" r="5" fill="#fff" stroke="{LINE}" stroke-width="1.5"/>' if r.get("optional") else f'<line x1="{x2 - 8}" y1="{y2 - 20}" x2="{x2 + 8}" y2="{y2 - 20}" stroke="{LINE}" stroke-width="1.6"/>')
            if r.get("label"):
                out.append(f'<text x="{max(x1, x2) + 12:.1f}" y="{mid + 4:.1f}" font-size="12.5" text-anchor="start" fill="#333" font-style="italic" stroke="#fff" stroke-width="4" paint-order="stroke">{escape(r["label"])}</text>')
    W = max(x + w for x, y, w, h in boxes.values()) + 40
    H = max(y + h for x, y, w, h in boxes.values()) + 40
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" font-family="{FONT}">{"".join(out)}</svg>'
    render(svg, W, H, png)
