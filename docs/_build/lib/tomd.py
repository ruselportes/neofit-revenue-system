# -*- coding: utf-8 -*-
"""Markdown export of a document built from docbuilder blocks."""
def to_markdown(title, system, info, blocks, tables, figures, fig_prefix=""):
    L = [f"# {title}", "", "*for*", "", f"**{system}**", ""]
    L += [f"- **{k}:** {v}" for k, v in info] + [""]
    h = [0, 0, 0, 0]
    def cell(v):
        return "<br>".join(v) if isinstance(v, list) else str(v)
    for kind, payload in blocks:
        if kind in ("h1", "h2", "h3", "h4"):
            lv = int(kind[1]) - 1; h[lv] += 1
            for j in range(lv + 1, 4): h[j] = 0
            num = ".".join(str(x) for x in h[:lv + 1]) + "."
            L.append("\n" + "#" * (lv + 2) + f" {num} {payload}\n")
        elif kind in ("p", "pk"):
            L.append(payload + "\n")
        elif kind == "bullets":
            for it in payload:
                if isinstance(it, tuple):
                    L.append(f"- {it[0]}"); L += [f"  - {s}" for s in it[1]]
                else:
                    L.append(f"- {it}")
            L.append("")
        elif kind == "arrows":
            for head, items in payload:
                L.append(f"- **{head}**"); L += [f"  - {i}" for i in items]
            L.append("")
        elif kind == "numbered":
            L += [f"{i}. {t}" for i, t in enumerate(payload, 1)] + [""]
        elif kind == "techlist":
            L += [f"- **{a}:** {b}" for a, b in payload] + [""]
        elif kind == "refs":
            L += [f"[{i}] {t}  " for i, t in enumerate(payload, 1)] + [""]
        elif kind == "figure":
            f = figures[payload]
            L.append(f"![{f['label']} {f['name']}]({fig_prefix}{f['path'].split('/')[-1]})\n\n*{f['label']} {f['name']}*\n")
        elif kind == "table":
            t = tables[payload]
            if t.get("meta"):
                L += [f"- **{a}:** {b}" for a, b in t["meta"]] + [""]
            header = t.get("header") or ["Item", "Details"]
            L.append("| " + " | ".join(header) + " |")
            L.append("|" + "---|" * len(header))
            for r in t["rows"]:
                L.append("| " + " | ".join(cell(v) for v in r) + " |")
            L.append(f"\n*{t['label']} {t['name']}*\n")
    return "\n".join(L) + "\n"
