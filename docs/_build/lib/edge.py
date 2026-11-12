# -*- coding: utf-8 -*-
"""Headless Microsoft Edge screenshots that wait for the file.

When Edge is already running (for example with startup boost), the command returns at once and the
screenshot is written a few seconds later by the running instance. So: delete the old PNG, start Edge,
then wait until the new file exists and its size stops changing. Retry a few times before giving up."""
import subprocess, time
from pathlib import Path

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"


def screenshot(html_path, png_path, w, h, budget_ms=None, tries=3, wait_s=60):
    html_path, png_path = Path(html_path).resolve(), Path(png_path).resolve()
    png_path.unlink(missing_ok=True)
    args = [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
            f"--window-size={int(w)},{int(h)}"]
    if budget_ms:
        args.append(f"--virtual-time-budget={budget_ms}")
    args += [f"--screenshot={png_path}", html_path.as_uri()]
    for _ in range(tries):
        subprocess.run(args, capture_output=True, timeout=120)
        last = -1
        for _ in range(int(wait_s / 0.5)):
            time.sleep(0.5)
            if png_path.exists():
                size = png_path.stat().st_size
                if size > 0 and size == last:
                    return png_path
                last = size
    raise RuntimeError(f"Edge did not write {png_path.name}")
