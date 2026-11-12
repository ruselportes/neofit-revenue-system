# -*- coding: utf-8 -*-
"""Regenerates the Markdown copies docs/SPMP.md and docs/SRS.md from the content files, and refreshes
docs/assets/srs/. (docs/SDD.md is written by sdd/build_sdd.py.) Run: python export_md.py"""
import importlib.util, shutil, sys
from pathlib import Path

HERE = Path(__file__).parent
DOCS = HERE.parent
sys.path.insert(0, str(HERE / "lib"))
from tomd import to_markdown


def load(path, name):
    sys.path.insert(0, str(path.parent))
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


# ---------------- SRS ----------------
S = load(HERE / "srs" / "content_srs.py", "content_srs")
(DOCS / "SRS.md").write_text(to_markdown(S.DOC_TITLE, S.SYSTEM, [], S.DOC, S.TABLES, S.FIGURES, fig_prefix="assets/srs/"), encoding="utf-8")
assets = DOCS / "assets" / "srs"
for old in assets.glob("*.png"):
    old.unlink()
for f in S.FIGURES.values():
    shutil.copy(HERE / "srs" / f["path"], assets / Path(f["path"]).name)
print("SRS.md and assets/srs written")

# ---------------- SPMP ----------------
P = load(HERE / "spmp" / "content.py", "content")
tables = {k: dict(label=v[0], name=v[1], header=v[3], rows=v[4]) for k, v in P.TABLES.items()}
wp = []
for no, name, sched, tasks in P.WORKPLAN:
    wp.append([f"**{no}**", f"**{name}**", f"**{sched}**"])
    wp += [[tno, tname, tsched] for tno, tname, tsched in tasks]
tables["workplan"] = dict(label="Table 5.0", name="Work Plan", header=["No.", "Project Task", "Estimated Schedule"], rows=wp)
act = []
for no, name, tasks in P.ACTIVITIES:
    act.append([f"**{no}**", f"**{name}**", "", f"**{sum(h for _, _, acts in tasks for _, _, h in acts)} hrs**"])
    for tno, tname, acts in tasks:
        act.append([tno, f"**{tname}**", "", f"{sum(h for _, _, h in acts)} hrs"])
        act += [["", aname, role, f"{h} hrs"] for aname, role, h in acts]
act.append(["", "**Total**", "", f"**{sum(P.iteration_hours())} hrs**"])
tables["activities"] = dict(label="Table 6.0", name="Work Activities", header=["No.", "Project Task / Activity", "Role", "Labor Hours"], rows=act)
figures = {k: dict(label=v[0], name=v[1], path=v[2]) for k, v in P.FIGURES.items()}
hrs = P.iteration_hours()
res_alloc = ("The development team has a fixed amount of time available for the project. Based on the estimated labor hours in the work activities, "
             "the team is allocated approximately {} labor hours for Iteration 1, {} labor hours for Iteration 2, {} labor hours for Iteration 3, and {} labor hours "
             "for the Final Testing, Defense and Deployment phase, for a total of {} labor hours.").format(*hrs, sum(hrs))
blocks = [(k, res_alloc if (k == "p" and v == "RESOURCE_ALLOCATION") else v) for k, v in P.DOC]
(DOCS / "SPMP.md").write_text(to_markdown("Software Project Management Plan", P.SYSTEM, [], blocks, tables, figures, fig_prefix="assets/spmp/"), encoding="utf-8")
print("SPMP.md written")
