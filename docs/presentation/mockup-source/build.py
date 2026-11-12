import os, re, subprocess, sys
from pathlib import Path

here = Path(__file__).parent
out = here / "out"
out.mkdir(exist_ok=True)
png = here / "png"
png.mkdir(exist_ok=True)

status = (here / "status.html").read_text(encoding="utf-8")
sidebar = (here / "sidebar.html").read_text(encoding="utf-8")

# Sample September 2026 daily revenue, days 1..26 (sums to 38,450)
base = [1180, 1420, 1260, 1390, 1710, 1830, 1150, 1240, 1380, 1310, 1450, 1820, 1940, 1210,
        1290, 1470, 1360, 1520, 1880, 1990, 1260, 1330, 1500, 1410, 1690, 1460]
total = sum(base)
assert total == 38450, total
days = base

def fmt_k(v):
    return f"₱{v/1000:.1f}k"

def chart_svg():
    W, H = 1070, 250
    left, right, top, bottom = 44, 12, 14, 30
    n_days = 30
    maxv = 2500
    def x(d):
        return left + (d - 1) * (W - left - right) / (n_days - 1)
    def y(v):
        return top + (1 - v / maxv) * (H - top - bottom)
    pts = [(x(i + 1), y(v)) for i, v in enumerate(days)]
    # smooth path (catmull-rom -> bezier)
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    area = d + f" L{pts[-1][0]:.1f},{y(0):.1f} L{pts[0][0]:.1f},{y(0):.1f} Z"
    grid = "".join(
        f'<line x1="{left}" y1="{y(v):.1f}" x2="{W-right}" y2="{y(v):.1f}" stroke="#27272a"/>'
        f'<text x="{left-8}" y="{y(v)+4:.1f}" text-anchor="end">{"₱" + (str(v//1000) + "k" if v else "0")}</text>'
        for v in (0, 1000, 2000)
    )
    xl = "".join(f'<text x="{x(dd):.1f}" y="{H-8}" text-anchor="middle">{dd}</text>' for dd in (1, 5, 10, 15, 20, 25, 30))
    pk = max(range(len(days)), key=lambda i: days[i])
    px, py = pts[pk]
    sel = 25  # day 26 (today)
    sx, sy = pts[sel]
    return f'''<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="display:block;font-family:Inter;font-size:11px;fill:#a1a1aa">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb" stop-opacity=".35"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>
{grid}{xl}
<path d="{area}" fill="url(#g)"/>
<path d="{d}" fill="none" stroke="#3b82f6" stroke-width="2.5"/>
<line x1="{px:.1f}" y1="{py:.1f}" x2="{px:.1f}" y2="{y(0):.1f}" stroke="#f59e0b" stroke-dasharray="3 3"/>
<circle cx="{px:.1f}" cy="{py:.1f}" r="5" fill="#f59e0b" stroke="#0f0f10" stroke-width="2"/>
<text x="{px:.1f}" y="{py-10:.1f}" text-anchor="middle" style="fill:#f59e0b;font-weight:700">Peak</text>
<circle cx="{sx:.1f}" cy="{sy:.1f}" r="5" fill="#3b82f6" stroke="#fafafa" stroke-width="2"/>
</svg>'''

def cal_html():
    cells = ['<div class="d"></div>'] * 2
    for dd in range(1, 31):
        if dd <= 26:
            cls = "d h sel" if dd == 26 else "d h"
            cells.append(f'<div class="{cls}">{dd}<small>{fmt_k(days[dd-1])}</small></div>')
        else:
            cells.append(f'<div class="d fut">{dd}</div>')
    return '<div class="gr">' + "".join(cells) + "</div>"

entries = [("Dimple", 70), ("Ian", 450), ("AJ", 60), ("Rose", 90), ("Nathalie", 70), ("Lorraine", 70),
           ("Matthew", 60), ("Janice", 0), ("Carlo", 350), ("Bea", 80), ("Mark", 70), ("Joy", 90)]
assert sum(a for _, a in entries) == 1460

def rows_html():
    r = []
    for n, a in entries:
        r.append(f'<tr><td><b>{n}</b></td><td>₱{a:,}</td><td><span class="badge scan">Scan</span></td>'
                 f'<td class="muted" style="font-size:13px">9:43 AM</td>'
                 f'<td style="text-align:right;white-space:nowrap"><span class="btn2" style="padding:4px 10px;font-size:12px">Edit</span> '
                 f'<span class="btn2" style="padding:4px 10px;font-size:12px;color:#ff5252">Delete</span></td></tr>')
    return "".join(r)


members = [
 ("M-001","Rose Garcia","12 Mabini St.","Regular Plan - Monthly (No Treadmill)","2026-10-12","Active"),
 ("M-002","Ian Villanueva","48 Rizal Ave.","Regular Plan - Semi-Monthly (With Treadmill)","2026-09-30","Expiring Soon"),
 ("M-003","Nathalie Cruz","7 Luna St.","Regular Plan - Daily (No Treadmill)","2026-09-26","Active"),
 ("M-004","Matthew Reyes","22 Bonifacio St.","Student/Senior Plan - Monthly (No Treadmill)","2026-10-18","Active"),
 ("M-005","Lorraine Aquino","3 Osmeña Blvd.","Regular Plan - Semi-Monthly (No Treadmill)","2026-09-24","Expired"),
 ("M-006","Carlo Mendoza","91 Colon St.","Regular Plan - Monthly (No Treadmill)","2026-10-05","Active"),
 ("M-007","Bea Torres","15 Jakosalem St.","Student/Senior Plan - Daily (With Treadmill)","2026-09-26","Active"),
 ("M-008","Mark Dela Cruz","60 Juan Luna Ave.","Regular Plan - Monthly (With Treadmill)","2026-09-20","Expired"),
 ("M-009","Joy Bautista","8 Sikatuna St.","Student/Senior Plan - Monthly (With Treadmill)","2026-09-22","Expired"),
 ("M-010","Dimple Flores","34 Legaspi St.","Regular Plan - Daily (No Treadmill)","2026-09-26","Active"),
 ("M-011","AJ Navarro","19 Magallanes St.","Student/Senior Plan - Monthly (No Treadmill)","2026-10-21","Active"),
 ("M-012","Janice Ocampo","5 Zamora St.","Regular Plan - Monthly (No Treadmill)","2026-10-01","Expiring Soon"),
 ("M-013","Paolo Santiago","77 Gorordo Ave.","Regular Plan - Semi-Monthly (No Treadmill)","—","Pending"),
]
AVC = ["#2563eb","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4"]
def member_rows():
    cls={"Active":"act","Expired":"exp","Expiring Soon":"soon","Pending":"pen"}
    out=[]
    for i,(mid,n,a,pl,ex,st) in enumerate(members):
        ini="".join(w[0] for w in n.split()[:2]).upper()
        c=AVC[i%len(AVC)]
        out.append(f'<tr><td class="muted">{mid}</td><td><span class="av" style="background:{c}26;color:{c}">{ini}</span><b>{n}</b></td>'
                   f'<td class="muted">{a}</td><td>{pl}</td><td>{ex}</td><td><span class="b {cls[st]}">{st}</span></td>'
                   f'<td style="white-space:nowrap"><span class="btn2 a">Details</span> <span class="btn2 a">Edit</span> <span class="btn2 a" style="color:#ff5252">Delete</span></td></tr>')
    return "".join(out)
checkins=[18,21,19,20,24,26,16,17,22,19,21,23,25,15,18,20,19,22,24,27,17,19,21,20,22,23]
def att_cal():
    cells=['<div class="d"></div>']*2
    for dd in range(1,31):
        if dd<=26:
            n=checkins[dd-1]
            if n==0: cells.append(f'<div class="d">{dd}</div>')
            else:
                cls="d h sel" if dd==26 else "d h"
                cells.append(f'<div class="{cls}">{dd}<small>{n} in</small></div>')
        else: cells.append(f'<div class="d fut">{dd}</div>')
    return '<div class="gr">'+"".join(cells)+'</div>'

for f in sorted(here.glob("[md]-*.html")):
    html = f.read_text(encoding="utf-8")
    html = html.replace("<!--STATUS-->", status)
    m = re.search(r"<!--SIDEBAR:(\w+)-->", html)
    if m:
        sb = sidebar
        for k in ("dashboard", "members", "attendance", "rates", "revenue", "logbook"):
            sb = sb.replace("{{" + k + "}}", "on" if k == m.group(1) else "")
        html = html.replace(m.group(0), sb)
    html = html.replace("<!--CHART-->", chart_svg()).replace("<!--CAL-->", cal_html()).replace("<!--ROWS-->", rows_html()).replace("<!--MEMBERROWS-->", member_rows()).replace("<!--ATTCAL-->", att_cal())
    (out / f.name).write_text(html, encoding="utf-8")

for name in ("m.css", "d.css", "neofit-logo.png"):
    (out / name).write_bytes((here / name).read_bytes())

edge = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
for f in sorted(out.glob("*.html")):
    mobile = f.name.startswith("m-")
    w, h = (390, 844) if mobile else (1440, 900)
    target = png / (f.stem + ".png")
    target = target.resolve(); target.unlink(missing_ok=True)
    cmd = [edge, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
           f"--window-size={w},{h}", "--virtual-time-budget=6000", f"--screenshot={target}", f.resolve().as_uri()]
    subprocess.run(cmd, capture_output=True, timeout=90)
    # Edge may hand the job to a running instance and return early: wait until the file exists and stops growing
    import time
    last = -1
    for _ in range(120):
        time.sleep(0.5)
        if target.exists() and target.stat().st_size > 0:
            if target.stat().st_size == last: break
            last = target.stat().st_size
    print(f.name, target.exists() and target.stat().st_size)
