# Revenue Collection and Monitoring System with AI-Integrated Logbook Scanning for NeoFit Fitness Gym

Capstone project (IT 428), College of Computer Studies, Trinidad Municipal College. The panel approved this title (Option B) in October 2026.

- **Project folder:** `C:\projects\neofit-revenue-system`
- **GitHub repository:** `neofit-revenue-system`, to be created when development starts

## Team

| Name | Role |
| --- | --- |
| Jay Mark A. Reños | Project Manager |
| Liza Mae C. Sugala | Systems Analyst |
| Rusel R. Portes | Team Leader & Lead Developer |
| Efren S. Cabudbud Jr. | Database & QA Lead |
| Carl Vey P. Sente | UI/UX Designer |
| Rayla G. Lanaza | Documentation Lead |

- **Technical Adviser:** Eric Bulala
- **Subject Adviser:** Clark Kevin V. Villamor, MIT, Head, College of Computer Studies
- **Client:** NeoFit Fitness Gym

## Status

| Item | Status | Where |
| --- | --- | --- |
| Project Title Approval Form | Done | `docs/presentation/option-b/Project-Title-Approval-Form-Option-B.docx` |
| Title hearing presentation (12 slides) | Done, chosen by the panel | `docs/presentation/option-b/Title-Presentation-Option-B.pptx` |
| Presentation script | Done | `docs/presentation/option-b/Presentation-Script-Option-B.docx` |
| Software Project Management Plan (SPMP) | Updated to the approved title and member access | `docs/SPMP.docx` (Markdown copy: `docs/SPMP.md`) |
| Software Requirements Specification (SRS) | Updated to the approved title and member access | `docs/SRS.docx` (Markdown copy: `docs/SRS.md`) |
| Software Design Description (SDD) | Updated to the approved title and member access | `docs/SDD.docx` (Markdown copy: `docs/SDD.md`) |
| SDD without Section 5 (Human Interface Design) | Same SDD, for submission while the system is not built yet | `docs/SDD-without-Interface-Design.docx` (Markdown copy: `docs/SDD-without-Interface-Design.md`) |
| Software Test Document (STD) | Next | `docs/` |
| Source code | Later | Development starts after the documents are approved; the code will live in this repository |

The approved scope has no attendance module and no online payment. The desktop app covers members, payments, rates, announcements, revenue and the logbook. Invited members get their own screens in the mobile app (membership, payments and receipts, rates and announcements, renewal reminders); the adviser approved this on 2026-10-24.

## Folder layout

```
docs/
  SPMP.docx, SPMP.md                     Software Project Management Plan (school template, Tahoma)
  SRS.docx, SRS.md                       Software Requirements Specification (14 use cases)
  SDD.docx, SDD.md                       Software Design Description (architecture, class diagrams, ERDs, sequence diagrams, screens)
  SDD-without-Interface-Design.docx/.md  the same SDD without Section 5 (Human Interface Design)
  assets/spmp/, assets/srs/, assets/sdd/ figures used in the documents
  _build/                                scripts that generate the documents (see below)
  presentation/
    option-b/                            the approved title: deck, script and title form
    prototype-screens/                   screens of the approved system (mobile/, desktop/, cover-hero.png)
    mockup-source/                       HTML sources for those screens
    screens/, mockups/                   screens of Option A (not chosen)
    Title-Presentation.pptx, Presentation-Script.docx   Option A deck and script (not chosen)
    archive-sulatsync/                   the first deck and script, before the title was revised
```

## Prototype screens

The screens are the interface designs of the system, made as HTML pages with **sample data**. To regenerate them after a change:
1. Edit the HTML in `docs/presentation/mockup-source/`.
2. Run the build below.
3. Copy the PNGs from `mockup-source/png/` to `prototype-screens/mobile/` and `prototype-screens/desktop/`.

```bash
python docs/presentation/mockup-source/build.py
```

The script needs Microsoft Edge. It writes the pages to `mockup-source/out/` and the PNGs to `mockup-source/png/`.

## Regenerating the presentation

The approved deck was made by editing the earlier deck, so its design stays the same:

```bash
cd docs/_build/presentation
python edit_option_b.py "<path to the earlier deck, SulatSync-Title-Presentation.pptx>"
python build_script_b.py
```

`edit_option_b.py` writes `docs/presentation/option-b/Title-Presentation-Option-B.pptx` with the screens from `prototype-screens/`. It uses only Tahoma and Trebuchet MS, so the deck opens correctly in WPS. `build_script_b.py` writes the script.

## Regenerating the SRS

The SRS text is in `docs/_build/srs/content_srs.py`, and the use cases (diagrams and description tables) are in `docs/_build/srs/usecases.py`. The shared layout code is in `docs/_build/lib/`.

```bash
cd docs/_build/srs
python make_figures.py
python build_srs.py
```

`make_figures.py` redraws the use case diagrams, the system overview and the prototype figures (it needs Microsoft Edge). `build_srs.py` builds the document in two passes for the page numbers and copies it to `docs/SRS.docx`.

## Regenerating the SDD

The SDD text is in `docs/_build/sdd/content_sdd.py`, and the diagram definitions (architecture, class diagrams, ER diagrams, sequence diagrams and the screen figures) are in `docs/_build/sdd/figures_sdd.py`. The diagrams are drawn by `docs/_build/lib/diagrams.py`.

```bash
cd docs/_build/sdd
python figures_sdd.py
python build_sdd.py
```

`figures_sdd.py` redraws all figures (it needs Microsoft Edge). Pass names to redraw only some, for example `python figures_sdd.py cd-ocr sd-save`. `build_sdd.py` builds the document in two passes for the page numbers and writes `docs/SDD.docx`, `docs/SDD.md` and `docs/assets/sdd/`. `python build_sdd.py --no-interface` builds the version without Section 5 (Human Interface Design) as `docs/SDD-without-Interface-Design.docx` and `.md`; it also adjusts the three sentences in Section 1 that mention the screens.

## Regenerating the SPMP

The text of the SPMP lives in `docs/_build/spmp/content.py`, and `build_spmp.py` lays it onto the school's SPMP template. The list of figures and tables needs real page numbers, so the build runs in two passes:

```bash
cd docs/_build/spmp
python build_spmp.py
powershell -File render.ps1 -dir "%CD%"
python pages.py
python build_spmp.py --final
```

The first pass renders the document to PDF through Word (or WPS), and `pages.py` records the page of every figure and table. The second pass writes those numbers into the lists. Copy the resulting `SPMP-build.docx` to `docs/SPMP.docx`. Editing the `.docx` by hand also works, but then the two copies drift apart.

## Markdown copies

```bash
python docs/_build/export_md.py
```

It rewrites `docs/SPMP.md` and `docs/SRS.md` from the content files and refreshes `docs/assets/srs/`. `docs/SDD.md` is written by `build_sdd.py`.

Screenshots are taken with headless Microsoft Edge through `docs/_build/lib/edge.py`, which waits until Edge has written each file.
