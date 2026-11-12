# -*- coding: utf-8 -*-
"""Prototype screens for "Revenue Monitoring and Payment Recording System for NeoFit Fitness Gym".

Every screen is written here as HTML with one shared set of sample data (so totals agree across screens),
then rendered to PNG with headless Microsoft Edge.  Run:  python build.py
Output: out/*.html (pages) and ../screens/*.png (390 x 844 phone screens at 2x, plus the cover image).
"""
import subprocess, time
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"; OUT.mkdir(exist_ok=True)
PNG = HERE.parent / "screens"; PNG.mkdir(exist_ok=True)
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
STATUS = (HERE / "status.html").read_text(encoding="utf-8")

# ------------------------------------------------------------------ sample data
DATE_LONG = "Wednesday, September 30, 2026"
RATE = {60: "Student/Senior · Daily", 70: "Regular · Daily", 80: "Student/Senior · Daily · Treadmill",
        90: "Regular · Daily · Treadmill", 300: "Student/Senior · Semi-monthly", 350: "Regular · Semi-monthly",
        400: "Student/Senior · Semi-monthly · Treadmill", 450: "Regular · Semi-monthly · Treadmill",
        600: "Student/Senior · Monthly", 700: "Regular · Monthly", 800: "Student/Senior · Monthly · Treadmill",
        900: "Regular · Monthly · Treadmill"}
CHIPS = [60, 70, 80, 90, 300, 350, 400, 450, 600, 700, 800, 900]
TODAY = [("7:40", "Dimple", 70), ("7:55", "Ian", 450), ("8:05", "AJ", 60), ("8:12", "Nathalie", 70),
         ("8:21", "Rose", 90), ("8:33", "Lorraine", 70), ("8:47", "Matthew", 60), ("9:02", "Carlo", 350),
         ("9:20", "Bea", 80), ("9:31", "Mark", 70), ("9:48", "Joy", 90), ("10:05", "Paolo", 700)]
assert sum(a for _, _, a in TODAY) == 2160
# September 2026 daily totals (day 1..30)
DAYS = [1180, 1420, 1260, 1390, 1710, 1830, 1150, 1240, 1380, 1310, 1450, 1820, 1940, 1210, 1290, 1470,
        1360, 1520, 1880, 1990, 1260, 1330, 1500, 1410, 1690, 1460, 1690, 1210, 1540, 2160]
MONTH, WEEK, YEAR = sum(DAYS), sum(DAYS[27:30]), 304200  # week = Mon Sep 28 - Wed Sep 30
assert (MONTH, WEEK) == (45050, 4910)
DAY_COUNTS = {30: 12, 29: 10, 28: 9, 27: 11, 26: 12, 25: 11, 24: 10}
BY_PLAN = [("Regular · Monthly", 15400, "#8B5CF6"), ("Regular · Daily", 10850, "#00E5A0"),
           ("Student/Senior · Monthly", 8400, "#EC4899"), ("Semi-monthly", 6300, "#FBBF24"),
           ("Student/Senior · Daily", 4100, "#3B82F6")]
assert sum(v for _, v, _ in BY_PLAN) == MONTH
STAFF = [("Mika Santos", "mika@neofit.gym", True, 214), ("Joel Ramos", "joel@neofit.gym", True, 198),
         ("Ana Lim", "ana@neofit.gym", False, 74)]
ENTRIES_MONTH = sum(s[3] for s in STAFF)
assert ENTRIES_MONTH == 486
peso = lambda v: f"₱{v:,}"

# ------------------------------------------------------------------ shared pieces
CSS = """
.hdr{padding:58px 24px 14px}
.title{font-size:26px;font-weight:800;letter-spacing:-.3px}
.sub{font-size:13px;color:#94A3B8;margin-top:2px}
.lbl{font-size:13px;font-weight:600;color:#94A3B8;margin-bottom:6px}
.inp{background:#1E293B;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:13px 16px;font-size:18px;font-weight:600}
.inp.on{border-color:rgba(0,229,160,.7);box-shadow:0 0 0 3px rgba(0,229,160,.12)}
.inp.warn{border-color:#FBBF24;box-shadow:0 0 0 3px rgba(251,191,36,.15)}
.chips{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.chip{background:#1E293B;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 0;text-align:center;font-size:15px;font-weight:700;color:#CBD5E1}
.chip.on{background:rgba(0,229,160,.15);border-color:#00E5A0;color:#00E5A0}
.pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700}
.ok{background:rgba(0,229,160,.14);color:#00E5A0}
.off{background:rgba(248,113,113,.14);color:#F87171}
.row{display:flex;align-items:center;padding:10px 24px;border-bottom:1px solid rgba(255,255,255,.06)}
.tm{width:58px;font-size:12px;color:#64748B;font-weight:600}
.nm{flex:1}.nm b{font-size:15px;font-weight:700;display:block}.nm span{font-size:11px;color:#64748B}
.amt{font-size:16px;font-weight:800;color:#4ADE80}
.section{font-size:11px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:.9px}
.seg{display:flex;background:#1E293B;border-radius:12px;padding:4px}
.seg div{flex:1;text-align:center;font-size:13px;font-weight:600;color:#94A3B8;padding:8px 0;border-radius:9px}
.seg .on{background:#00E5A0;color:#0A0E1A}
.sync{font-size:12px;font-weight:700;color:#00E5A0;background:rgba(0,229,160,.12);border-radius:999px;padding:5px 11px}
"""


def page(body, bg=None):
    style = f' style="background:{bg}"' if bg else ""
    return (f'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="m.css"><style>{CSS}</style></head>'
            f'<body{style}>{STATUS}{body}</body></html>')


def tabs(role, active):
    items = ([("record", "✍️", "Record"), ("today", "📋", "Today")] if role == "staff" else
             [("dashboard", "📊", "Dashboard"), ("record", "✍️", "Record"), ("history", "📅", "History"),
              ("reports", "📄", "Reports"), ("settings", "⚙️", "Settings")])
    t = "".join(f'<div class="tab{" on" if k == active else ""}"><div class="ic">{ic}</div>{lb}</div>' for k, ic, lb in items)
    return f'<div class="tabbar">{t}</div>'


def header(title, sub, right=""):
    return (f'<div class="hdr" style="display:flex;justify-content:space-between;align-items:flex-end">'
            f'<div><div class="title">{title}</div><div class="sub">{sub}</div></div>{right}</div>')


def record_form(name, amount, state):
    """state: 'on' (valid, rate matched), 'warn' (not a rate), 'dup' (valid amount, name already recorded)."""
    amt_cls = "warn" if state == "warn" else "on"
    match = ("" if state == "warn" else
             f'<div style="font-size:13px;font-weight:600;color:#00E5A0;margin-top:8px">✓ {RATE[amount]}</div>')
    chips = "".join(f'<div class="chip{" on" if (c == amount and state != "warn") else ""}">{c}</div>' for c in CHIPS)
    return f"""
<div class="card" style="margin:0 16px;padding:20px">
  <div class="lbl">Name</div>
  <div class="inp" style="margin-bottom:14px">{name}</div>
  <div class="lbl">Amount (₱)</div>
  <div class="inp {amt_cls}" style="font-size:30px;font-weight:800;padding:10px 16px">{amount}</div>
  {match}
  <div class="lbl" style="margin:14px 0 8px">Quick amounts · NeoFit rates</div>
  <div class="chips">{chips}</div>
  <div class="grad-btn" style="padding:15px;margin-top:16px">Save Entry</div>
</div>"""


def so_far(n):
    done = TODAY[:n]
    last = done[-1]
    return f"""
<div style="margin:12px 16px 0;display:flex;gap:8px">
  <div class="card" style="flex:1;padding:12px 14px"><div class="section">Today so far</div>
    <div style="font-size:18px;font-weight:800;margin-top:4px">{peso(sum(a for _, _, a in done))} <span style="font-size:12px;color:#94A3B8;font-weight:600">· {n} entries</span></div></div>
  <div class="card" style="flex:1;padding:12px 14px"><div class="section">Last saved</div>
    <div style="font-size:15px;font-weight:700;margin-top:4px">{last[1]} – {peso(last[2])}</div><div style="font-size:11px;color:#94A3B8;font-weight:600">{last[0]} AM</div></div>
</div>"""


SCREENS = {}

# 1. Login -----------------------------------------------------------------------------
SCREENS["login"] = page("""
<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:24px">
  <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:28px">
    <img src="neofit-logo.png" style="width:190px">
    <div class="muted" style="font-size:14px;font-weight:600;margin-top:14px;letter-spacing:.5px">Revenue Monitoring</div>
  </div>
  <div class="card" style="border-radius:24px;padding:30px">
    <div style="font-size:26px;font-weight:700">Welcome Back</div>
    <div class="muted" style="font-size:13px;margin:4px 0 22px">Sign in to your account</div>
    <div class="lbl">Email Address</div>
    <div class="inp on" style="font-size:15px;font-weight:500;margin-bottom:16px">staff@neofit.gym</div>
    <div class="lbl">Password</div>
    <div class="inp" style="font-size:15px;letter-spacing:3px;margin-bottom:16px">••••••••</div>
    <div class="grad-btn" style="padding:16px;margin-top:8px">Sign In</div>
  </div>
  <div style="text-align:center;font-size:11px;color:#475569;margin-top:28px">v1.0.0 · For authorized NeoFit staff only</div>
</div>""", bg="linear-gradient(180deg,#0A0E1A,#111827 50%,#0A0E1A)")

# 2. Record entry (valid) --------------------------------------------------------------------
SCREENS["record"] = page(header("Record Entry", DATE_LONG, '<span class="sync">✓ Synced</span>')
                         + record_form("Rose", 90, "on") + so_far(4) + tabs("staff", "record"))

# 3. Amount not on the rate table ------------------------------------------------------------
warn = """
<div style="margin:12px 16px 0;background:rgba(251,191,36,.10);border:1px solid rgba(251,191,36,.55);border-radius:14px;padding:14px 16px">
  <div style="font-size:15px;font-weight:800;color:#FBBF24">⚠ ₱75 is not a NeoFit rate</div>
  <div style="font-size:13px;color:#E2E8F0;margin-top:4px;line-height:19px">Closest rates are ₱70 and ₱80. Check the amount before saving.</div>
  <div style="display:flex;gap:8px;margin-top:12px">
    <div class="grad-btn" style="flex:1;padding:10px;font-size:14px">Fix Amount</div>
    <div style="flex:1;padding:10px;font-size:14px;text-align:center;border:1px solid rgba(255,255,255,.15);border-radius:12px;font-weight:600;color:#CBD5E1">Save Anyway</div>
  </div>
</div>"""
SCREENS["warn-rate"] = page(header("Record Entry", DATE_LONG, '<span class="sync">✓ Synced</span>')
                            + record_form("Lorraine", 75, "warn") + warn + tabs("staff", "record"))

# 4. Possible double entry ----------------------------------------------------------------------
sheet = """
<div style="position:absolute;inset:0;background:rgba(3,6,14,.72);z-index:30"></div>
<div style="position:absolute;left:0;right:0;bottom:0;background:#111827;border-top:1px solid rgba(255,255,255,.1);border-radius:26px 26px 0 0;padding:14px 24px 34px;z-index:31">
  <div style="width:44px;height:5px;border-radius:3px;background:#334155;margin:0 auto 18px"></div>
  <div style="width:52px;height:52px;border-radius:16px;background:rgba(251,191,36,.14);display:flex;align-items:center;justify-content:center;font-size:26px">⚠️</div>
  <div style="font-size:21px;font-weight:800;margin-top:14px">Possible double entry</div>
  <div style="font-size:14px;color:#CBD5E1;margin-top:8px;line-height:21px"><b style="color:#F1F5F9">Ian – ₱450</b> was already recorded today at <b style="color:#F1F5F9">7:55 AM</b> by Mika Santos.</div>
  <div style="font-size:13px;color:#94A3B8;margin-top:6px;line-height:19px">Save it again only if Ian really paid twice.</div>
  <div class="grad-btn" style="padding:15px;margin-top:20px">Cancel</div>
  <div style="padding:14px;margin-top:8px;text-align:center;border:1px solid rgba(255,255,255,.15);border-radius:12px;font-size:15px;font-weight:600;color:#CBD5E1">Save Anyway</div>
</div>"""
SCREENS["warn-dup"] = page(header("Record Entry", DATE_LONG, '<span class="sync">✓ Synced</span>')
                           + record_form("Ian", 450, "dup") + so_far(8) + tabs("staff", "record") + sheet)

# 5. Today's entries -----------------------------------------------------------------------------
rows = "".join(f'<div class="row"><span class="tm">{t} AM</span><div class="nm"><b>{n}</b><span>{RATE[a]}</span></div><span class="amt">{peso(a)}</span></div>'
               for t, n, a in reversed(TODAY))
SCREENS["today"] = page(header("Today's Entries", DATE_LONG, '<span class="sync">✓ Synced</span>') + f"""
<div class="card" style="margin:0 16px 10px;padding:16px 18px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#0F2A24,#111827)">
  <div><div class="section">Total today</div><div style="font-size:30px;font-weight:800;color:#00E5A0;margin-top:2px">{peso(2160)}</div></div>
  <div style="text-align:right"><div style="font-size:22px;font-weight:800">12</div><div class="sub">entries</div></div>
</div>
<div style="height:540px;overflow:hidden">{rows}</div>""" + tabs("staff", "today"))

# 6. Owner dashboard -----------------------------------------------------------------------------
def chart7():
    vals = DAYS[23:30]; labels = [f"9/{d}" for d in range(24, 31)]
    W, H, l, r, t, b = 318, 150, 40, 22, 14, 30
    x = lambda i: l + 16 + i * (W - l - r - 16) / 6  # first bar clear of the axis labels
    y = lambda v: t + (1 - v / 2500) * (H - t - b)
    pts = [(x(i), y(v)) for i, v in enumerate(vals)]
    bars = "".join(f'<rect x="{px - 12:.1f}" y="{py:.1f}" width="24" height="{y(0) - py:.1f}" rx="5" fill="{"#00E5A0" if i == 6 else "#1F6F5C"}"/>'
                   for i, (px, py) in enumerate(pts))
    grid = "".join(f'<line x1="{l}" y1="{y(v):.1f}" x2="{W - r}" y2="{y(v):.1f}" stroke="rgba(255,255,255,.08)"/>'
                   f'<text x="{l - 8}" y="{y(v) + 4:.1f}" text-anchor="end">{v // 1000}k</text>' for v in (0, 1000, 2000))
    xl = "".join(f'<text x="{px:.1f}" y="{H - 10}" text-anchor="middle">{lb}</text>' for (px, _), lb in zip(pts, labels))
    top = f'<text x="{pts[6][0]:.1f}" y="{pts[6][1] - 6:.1f}" text-anchor="middle" style="fill:#00E5A0">2,160</text>'
    return f'<svg width="{W}" height="{H}" style="font-family:Inter;font-size:10px;font-weight:700;fill:#CBD5E1">{grid}{bars}{xl}{top}</svg>'

cards = [("Today", 2160, "#00E5A0", "12 entries"), ("This Week", WEEK, "#8B5CF6", "Mon – Wed"),
         ("This Month", MONTH, "#FF6B35", "September"), ("This Year", YEAR, "#FBBF24", "2026")]
cards_html = "".join(f'<div class="card" style="position:relative;overflow:hidden;padding:16px 14px;border-radius:16px">'
                     f'<div style="position:absolute;left:0;right:0;top:0;height:3px;background:{c}"></div>'
                     f'<div class="section">{p}</div><div style="font-size:21px;font-weight:800;color:{c};margin-top:6px">{peso(v)}</div>'
                     f'<div style="font-size:11px;color:#94A3B8">{s}</div></div>' for p, v, c, s in cards)
plan_rows = "".join(f'<div style="margin-top:9px"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600"><span>{n}</span><span>{peso(v)}</span></div>'
                    f'<div style="height:6px;border-radius:3px;background:#1E293B;margin-top:4px"><div style="height:6px;border-radius:3px;width:{v / 15400 * 100:.0f}%;background:{c}"></div></div></div>'
                    for n, v, c in BY_PLAN[:4])
SCREENS["dashboard"] = page(f"""
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:56px 24px 16px">
  <div><div class="muted" style="font-size:14px">Good morning,</div><div style="font-size:25px;font-weight:800;margin-top:2px">Gym Owner</div></div>
  <div class="card" style="border-radius:12px;padding:5px 14px;font-size:13px;color:#94A3B8;font-weight:600">Sep 30</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 16px;margin-bottom:10px">{cards_html}</div>
<div class="card" style="margin:0 16px 10px;padding:14px 14px 6px"><div style="font-size:14px;font-weight:700;margin-bottom:6px">Last 7 Days</div>{chart7()}</div>
<div class="card" style="margin:0 16px;padding:12px 16px 14px"><div style="font-size:14px;font-weight:700">Revenue by Plan · September</div>{plan_rows}</div>
""" + tabs("owner", "dashboard"))

# 7. Revenue history ---------------------------------------------------------------------------------
day_rows = "".join(
    f'<div class="row" style="padding:12px 24px"><div style="width:52px"><div style="font-size:19px;font-weight:800">{d}</div>'
    f'<div style="font-size:11px;color:#64748B;font-weight:600">{["Thu","Fri","Sat","Sun","Mon","Tue","Wed"][d - 24]}</div></div>'
    f'<div class="nm"><div style="height:8px;border-radius:4px;background:#1E293B;margin-right:14px"><div style="height:8px;border-radius:4px;width:{DAYS[d - 1] / 2160 * 100:.0f}%;background:{"#00E5A0" if d == 30 else "#1F8A70"}"></div></div>'
    f'<span style="display:block;margin-top:6px">{DAY_COUNTS[d]} entries</span></div>'
    f'<span class="amt" style="color:#F1F5F9">{peso(DAYS[d - 1])}</span><span style="color:#475569;margin-left:10px">›</span></div>'
    for d in range(30, 23, -1))
SCREENS["history"] = page(header("History", "Revenue by day · tap a day to see its entries") + f"""
<div style="margin:0 16px 12px" class="inp" ><span style="color:#64748B;font-weight:500;font-size:15px">🔍 Search a name…</span></div>
<div class="card" style="margin:0 16px 8px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between">
  <span style="color:#94A3B8;font-size:18px">‹</span>
  <div style="text-align:center"><div style="font-size:15px;font-weight:700">September 2026</div>
  <div style="font-size:22px;font-weight:800;color:#00E5A0;margin-top:2px">{peso(MONTH)}</div><div class="sub">{ENTRIES_MONTH} entries</div></div>
  <span style="color:#94A3B8;font-size:18px">›</span>
</div>
{day_rows}""" + tabs("owner", "history"))

# 8. Search records ----------------------------------------------------------------------------------
found = [("Sep 30", "8:21 AM", "Mika Santos"), ("Sep 29", "8:10 AM", "Joel Ramos"), ("Sep 26", "8:15 AM", "Mika Santos"),
         ("Sep 22", "7:58 AM", "Joel Ramos"), ("Sep 19", "8:30 AM", "Mika Santos")]
f_rows = "".join(f'<div class="row" style="padding:12px 24px"><div style="width:74px"><div style="font-size:14px;font-weight:700">{d}</div>'
                 f'<div style="font-size:11px;color:#64748B">{t}</div></div><div class="nm"><b>Rose</b><span>{RATE[90]} · by {who}</span></div>'
                 f'<span class="amt">{peso(90)}</span></div>' for d, t, who in found)
SCREENS["search"] = page(header("History", "Search past records") + f"""
<div style="margin:0 16px 12px" class="inp on"><span style="font-size:15px">🔍 Rose</span><span style="float:right;color:#64748B">✕</span></div>
<div style="display:flex;gap:8px;margin:0 16px 14px">
  <span class="pill ok" style="font-size:12px;padding:6px 12px">This month</span>
  <span class="pill" style="font-size:12px;padding:6px 12px;background:#1E293B;color:#94A3B8">Last 3 months</span>
  <span class="pill" style="font-size:12px;padding:6px 12px;background:#1E293B;color:#94A3B8">All time</span>
</div>
<div class="card" style="margin:0 16px 8px;padding:14px 16px;display:flex;justify-content:space-between">
  <div><div class="section">Results</div><div style="font-size:18px;font-weight:800;margin-top:4px">5 entries</div></div>
  <div style="text-align:right"><div class="section">Total</div><div style="font-size:18px;font-weight:800;color:#00E5A0;margin-top:4px">{peso(450)}</div></div>
</div>
{f_rows}""" + tabs("owner", "history"))

# 9. Reports -----------------------------------------------------------------------------------------
rep_rows = "".join(f'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px">'
                   f'<span><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:{c};margin-right:8px"></span>{n}</span><b>{peso(v)}</b></div>'
                   for n, v, c in BY_PLAN)
stat = lambda k, v, c="#F1F5F9": f'<div><div class="section">{k}</div><div style="font-size:18px;font-weight:800;color:{c};margin-top:3px">{v}</div></div>'
SCREENS["reports"] = page(header("Reports", "Revenue summary to download or share") + f"""
<div class="seg" style="margin:0 16px 12px"><div>Daily</div><div>Weekly</div><div class="on">Monthly</div><div>Yearly</div></div>
<div class="card" style="margin:0 16px 10px;padding:16px 18px">
  <div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:16px;font-weight:700">September 2026</div><span class="pill ok">Complete</span></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
    {stat("Total revenue", peso(MONTH), "#00E5A0")}{stat("Entries", ENTRIES_MONTH)}
    {stat("Daily average", peso(round(MONTH / 30)))}{stat("Highest day", "Sep 30 · " + peso(2160))}
  </div>
</div>
<div class="card" style="margin:0 16px 12px;padding:12px 18px 6px"><div style="font-size:14px;font-weight:700;margin-bottom:4px">Revenue by plan</div>{rep_rows}</div>
<div style="display:flex;gap:8px;margin:0 16px">
  <div class="grad-btn" style="flex:1;padding:14px">⬇ Download PDF</div>
  <div style="flex:1;padding:14px;text-align:center;border:1px solid rgba(255,255,255,.15);border-radius:12px;font-weight:600;color:#CBD5E1">↗ Share</div>
</div>""" + tabs("owner", "reports"))

# 10. Rates (Settings) --------------------------------------------------------------------------------
rate_rows = [("Regular", "No Treadmill", 70, 350, 700), ("Regular", "With Treadmill", 90, 450, 900),
             ("Student/Senior", "No Treadmill", 60, 300, 600), ("Student/Senior", "With Treadmill", 80, 400, 800)]
box = lambda v: f'<div class="inp" style="font-size:16px;padding:9px 0;text-align:center;font-weight:700">{v}</div>'
r_html = "".join(f'<div class="card" style="margin:0 16px 8px;padding:14px 16px"><div style="font-size:15px;font-weight:700">{c} <span style="color:#94A3B8;font-weight:500">· {t}</span></div>'
                 f'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">'
                 f'<div><div class="lbl" style="font-size:11px">Daily</div>{box(d)}</div><div><div class="lbl" style="font-size:11px">Semi-monthly</div>{box(s)}</div>'
                 f'<div><div class="lbl" style="font-size:11px">Monthly</div>{box(m)}</div></div></div>' for c, t, d, s, m in rate_rows)
SCREENS["rates"] = page(f"""
<div class="hdr"><div style="color:#00E5A0;font-size:14px;font-weight:600;margin-bottom:8px">‹ Settings</div>
<div class="title">Official Rates</div><div class="sub">Every amount entered at the front desk is checked against these prices.</div></div>
{r_html}
<div class="grad-btn" style="margin:6px 16px 0;padding:15px">Save Changes</div>""" + tabs("owner", "settings"))

# 11. Staff accounts (Settings) -------------------------------------------------------------------------
s_cards = ""
for n, e, active, cnt in STAFF:
    ini = "".join(w[0] for w in n.split())
    tog = ('<div style="width:46px;height:26px;border-radius:13px;background:#00E5A0;position:relative"><div style="position:absolute;right:3px;top:3px;width:20px;height:20px;border-radius:10px;background:#0A0E1A"></div></div>'
           if active else
           '<div style="width:46px;height:26px;border-radius:13px;background:#334155;position:relative"><div style="position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:10px;background:#94A3B8"></div></div>')
    s_cards += (f'<div class="card" style="margin:0 16px 8px;padding:14px 16px;display:flex;align-items:center;gap:12px;{"" if active else "opacity:.6"}">'
                f'<div style="width:44px;height:44px;border-radius:14px;background:rgba(0,229,160,.14);color:#00E5A0;font-weight:800;display:flex;align-items:center;justify-content:center">{ini}</div>'
                f'<div style="flex:1"><div style="font-size:15px;font-weight:700">{n}</div><div style="font-size:12px;color:#94A3B8">{e}</div>'
                f'<div style="margin-top:5px"><span class="pill {"ok" if active else "off"}">{"Active" if active else "Disabled"}</span>'
                f'<span style="font-size:11px;color:#64748B;margin-left:8px">{cnt} entries this month</span></div></div>{tog}</div>')
SCREENS["staff"] = page(f"""
<div class="hdr"><div style="color:#00E5A0;font-size:14px;font-weight:600;margin-bottom:8px">‹ Settings</div>
<div class="title">Staff Accounts</div><div class="sub">Who can record entries at the front desk</div></div>
<div style="display:flex;gap:8px;margin:0 16px 12px">
  <div class="card" style="flex:1;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#00E5A0">2</div><div class="sub">Active</div></div>
  <div class="card" style="flex:1;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#F87171">1</div><div class="sub">Disabled</div></div>
  <div class="card" style="flex:1;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800">{ENTRIES_MONTH}</div><div class="sub">Entries (Sep)</div></div>
</div>
{s_cards}
<div class="grad-btn" style="margin:6px 16px 0;padding:15px">+ Add Staff Account</div>""" + tabs("owner", "settings"))

# 12. Optional: one-time import of past logbook pages (AI reading) ----------------------------------------
imp = [("Dimple", "70"), ("Ian", "450"), ("AJ", "60"), ("Rose", "90"), ("Nathalie", "70"), ("Lorraine", "75"), ("Matthew", "60"), ("Carlo", "350")]
i_rows = "".join(
    f'<div class="row" style="padding:8px 24px;{"background:rgba(251,191,36,.07)" if a == "75" else ""}"><span style="width:22px;font-size:11px;color:#475569">{i}</span>'
    f'<div class="inp" style="flex:1;font-size:15px;padding:8px 12px;margin-right:8px">{n}</div>'
    f'<div class="inp" style="width:78px;font-size:15px;padding:8px 12px;text-align:right;color:{"#FBBF24" if a == "75" else "#4ADE80"};border-color:{"rgba(251,191,36,.6)" if a == "75" else "rgba(74,222,128,.3)"}">{a}</div></div>'
    for i, (n, a) in enumerate(imp, 1))
SCREENS["import"] = page(f"""
<div style="padding:56px 24px 12px;border-bottom:1px solid rgba(255,255,255,.08)">
  <div style="color:#00E5A0;font-size:14px;font-weight:600;margin-bottom:8px">‹ Settings</div>
  <div style="display:flex;justify-content:space-between;align-items:center"><div class="title" style="font-size:22px">Import Past Logbook</div><span class="pill" style="background:rgba(139,92,246,.18);color:#A78BFA">Optional</span></div>
  <div class="sub">One-time import of old pages · AI reading · review before import</div>
</div>
<div style="margin:10px 24px 0;background:rgba(0,229,160,.12);border-radius:12px;padding:8px;text-align:center;color:#00E5A0;font-size:13px;font-weight:600">📅 Logbook page: August 15, 2026</div>
<div style="margin:8px 24px 6px;height:74px;border-radius:12px;overflow:hidden;opacity:.75;position:relative">
  <div class="paper" style="position:absolute;left:-10px;top:-36px;width:420px;height:190px;transform:rotate(-2.5deg)">
    <div class="ln hd">Aug 15</div><div class="ln"><b>1.</b>Dimple – 70</div><div class="ln"><b>2.</b>Ian – 450</div><div class="ln"><b>3.</b>AJ – 60</div>
  </div>
</div>
{i_rows}
<div style="position:absolute;left:0;right:0;bottom:0;background:#111827;border-top:1px solid rgba(255,255,255,.08);padding:18px 24px 30px;display:flex;align-items:center;justify-content:space-between">
  <div><div class="muted" style="font-size:12px">8 entries · 1 to check</div><div style="font-size:24px;font-weight:800;color:#4ADE80">₱1,225</div></div>
  <div class="grad-btn" style="padding:14px 26px">Import Entries</div>
</div>""")

# Cover image -----------------------------------------------------------------------------------------------
HERO = """<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Kalam:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:600px;height:540px;overflow:hidden;background:#0A0E1A}
body{font-family:Inter,'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;gap:24px;padding:30px 20px 0}
.paper{width:520px;background:repeating-linear-gradient(180deg,#F4EFE1 0 70px,#B9C7DD 70px 72px);padding:24px 40px 12px;border-radius:8px;transform:rotate(-3deg);box-shadow:0 24px 60px rgba(0,0,0,.55);font-family:Kalam,cursive;font-size:50px;color:#1D3A8A;white-space:nowrap}
.arrow{width:0;height:0;border-left:26px solid transparent;border-right:26px solid transparent;border-top:36px solid #00E5A0;position:relative;margin-top:22px}
.arrow:before{content:"";position:absolute;left:-9px;top:-78px;width:18px;height:44px;background:#00E5A0}
.card{width:540px;background:#131A2B;border:2px solid #00E5A0;border-radius:24px;padding:24px 36px;box-shadow:0 0 60px rgba(0,229,160,.25)}
.row{display:flex;justify-content:space-between;align-items:center}
.n{font-size:44px;font-weight:600;color:#EEF2F7}.a{font-size:52px;font-weight:800;color:#4ADE80}
.s{margin-top:8px;font-size:23px;color:#A9B4C8}
</style></head><body>
<div class="paper">Rose – 90</div>
<div class="arrow"></div>
<div class="card"><div class="row"><span class="n">Rose</span><span class="a">₱90</span></div>
<div class="s"><span style="color:#00E5A0">✔</span> Saved 8:21 AM · rate checked</div>
<div class="s" style="margin-top:4px">Today's revenue: <b style="color:#EEF2F7">₱740</b></div></div>
</body></html>"""


# Handwritten logbook page (Problem slide): the "name – amount" lines NeoFit writes today, with a wrong
# amount (75), a line written twice (Ian – 450) and a hand tally at the bottom.
LOG_LINES = [("Dimple", 70), ("Ian", 450), ("AJ", 60), ("Nathalie", 70), ("Rose", 90), ("Lorraine", 75),
             ("Matthew", 60), ("Carlo", 350), ("Ian", 450), ("Bea", 80)]
LOGBOOK = """<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:540px;height:660px;overflow:hidden;background:#F4F1E8}
.p{position:absolute;left:30px;top:24px;width:470px;height:600px;background:#F4EFE1;background-image:repeating-linear-gradient(180deg,transparent 0 45px,#B9C7DD 45px 47px);
border-radius:6px;box-shadow:0 18px 40px rgba(17,24,39,.35);transform:rotate(-2deg);font-family:Kalam,cursive;color:#1D3A8A;overflow:hidden}
.p:before{content:"";position:absolute;left:58px;top:0;bottom:0;width:2px;background:#E5A1A1}
.l{height:47px;line-height:56px;padding-left:20px;font-size:30px;white-space:nowrap}
.l b{display:inline-block;width:40px;font-weight:400;color:#475569}
.h{font-weight:700;color:#1E293B;padding-left:72px}
.t{padding-left:72px;font-weight:700;color:#B91C1C}
</style></head><body><div class="p"><div class="l h">Sept 30 · Wed</div>""" + "".join(
    f'<div class="l"><b>{i}.</b>{n} – {a}</div>' for i, (n, a) in enumerate(LOG_LINES, 1)) + """
<div class="l t">Total: 1,755 ?</div></div></body></html>"""
assert sum(a for _, a in LOG_LINES) == 1755


def render(html_path, png_path, w, h):
    """Screenshot one page. When Edge is already running (e.g. startup boost), the command returns at once
    and the screenshot is written a few seconds later, so wait for the file and for its size to settle."""
    png_path = Path(png_path).resolve()
    png_path.unlink(missing_ok=True)
    for _ in range(3):
        subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                        f"--window-size={w},{h}", "--virtual-time-budget=6000",
                        f"--screenshot={png_path}", html_path.resolve().as_uri()], capture_output=True, timeout=90)
        last = -1
        for _ in range(120):  # up to 60 s
            time.sleep(0.5)
            if png_path.exists():
                size = png_path.stat().st_size
                if size > 0 and size == last:
                    return
                last = size
    raise RuntimeError(f"Edge did not render {html_path.name}")


if __name__ == "__main__":
    import sys
    only = sys.argv[1:]
    for name in ("m.css", "neofit-logo.png"):
        (OUT / name).write_bytes((HERE / name).read_bytes())
    for name, html in SCREENS.items():
        if only and name not in only:
            continue
        f = OUT / f"{name}.html"; f.write_text(html, encoding="utf-8")
        render(f, PNG / f"{name}.png", 390, 844)
        print(name, (PNG / f"{name}.png").stat().st_size)
    if not only or "hero" in only:
        f = OUT / "hero.html"; f.write_text(HERO, encoding="utf-8")
        render(f, PNG / "cover-hero.png", 600, 540)
        print("hero done")
    if not only or "logbook" in only:
        f = OUT / "logbook.html"; f.write_text(LOGBOOK, encoding="utf-8")
        render(f, PNG / "logbook-page.png", 540, 660)
        print("logbook done")
