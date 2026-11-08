#!/usr/bin/env python3
"""Offline, private read-only FR3K Emulation Studio dashboard; no HTTP listener."""
import argparse
from datetime import datetime, timezone
from html import escape
import json
from pathlib import Path
from studio import EVIDENCE_DIR, catalog, host, state, verify


def render():
    facts = host()
    profiles = catalog()["profiles"]
    latest = {}
    evidence_problem = False
    if EVIDENCE_DIR.is_dir():
        for path in sorted(EVIDENCE_DIR.glob("*.json"), reverse=True):
            try:
                summary = verify(path)
                document = json.loads(path.read_text())
                key = document.get("profile_id")
                if summary["integrity"] != "VERIFIED":
                    evidence_problem = True
                    latest.setdefault(key, "EVIDENCE_TAMPERED")
                elif key not in latest:
                    latest[key] = document.get("status", "UNKNOWN")
            except (OSError, ValueError, KeyError):
                evidence_problem = True
    observed = [state(p, facts)[0] for p in profiles]
    ready = sum(s == "READY" for s in observed)
    blocked = len(profiles) - ready
    passing = sum(latest.get(p["id"]) == "PASS" for p in profiles)
    rows = []
    for p in profiles:
        availability, reason = state(p, facts)
        test = latest.get(p["id"], "NOT_TESTED")
        cells = [p["id"], p["family"], p["architecture"], p["engine"], availability, test, reason]
        rows.append("<tr>" + "".join("<td>" + escape(str(v)) + "</td>" for v in cells) + "</tr>")
    body = "\n".join(rows)
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    integrity = "CHECK EVIDENCE" if evidence_problem else "No integrity mismatch detected"
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FR3K // Emulation Studio</title>
<style>
:root {{background:#06111b;color:#dce8ed;font:15px ui-monospace,Consolas,monospace}}
* {{box-sizing:border-box}} body {{margin:0 auto;max-width:1400px;padding:2.5rem 1.5rem}}
header {{border-bottom:1px solid #284b56;padding-bottom:1.5rem}}
h1 {{color:#5be7ff;font-size:2.3rem;margin:0;letter-spacing:.04em}}
h2 {{color:#d8c5ff;font-size:1rem;text-transform:uppercase;letter-spacing:.16em}}
small,.muted {{color:#93aab7}} .stripe {{color:#ff9c4b;font-size:.8rem;letter-spacing:.25em}}
.stats {{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1rem;margin:2rem 0}}
.stat {{border:1px solid #23546a;padding:1rem;background:#0a1b28}}
.stat strong {{display:block;color:#5be7ff;font-size:2rem}} .danger {{color:#ffab78}}
table {{width:100%;border-collapse:collapse;font-size:.86rem}}
td,th {{padding:.75rem;text-align:left;border-bottom:1px solid #1c3545;vertical-align:top}}
th {{position:sticky;top:0;background:#0c2735;color:#a4f1ff}} tr:hover {{background:#123041}}
.scroll {{overflow-x:auto}} footer {{padding-top:2rem;color:#93aab7;font-size:.82rem}}
</style></head><body>
<header><div class="stripe">FIELD LAB // PRE-RELEASE VALIDATION</div>
<h1>FR3K / EMULATION STUDIO</h1>
<p class="muted">Host capability &amp; test receipts · {escape(date)}</p>
<p class="danger"><b>RELEASE GATE: NOT CLEARED</b> — infrastructure smoke checks are not artifact-specific release validation.</p></header>
<section class="stats"><div class="stat">Profiles<strong>{len(profiles)}</strong></div>
<div class="stat">Ready engines<strong>{ready}</strong></div>
<div class="stat">Blocked engines<strong>{blocked}</strong></div>
<div class="stat">Latest passes<strong>{passing}</strong></div></section>
<h2>Architecture / OS compatibility matrix</h2>
<p class="muted">READY means a runner can execute; PASS means a test receipt was recorded. Neither proves real hardware behavior.</p>
<div class="scroll"><table><thead><tr><th>Profile</th><th>OS</th><th>Architecture</th><th>Engine</th>
<th>Availability</th><th>Latest test</th><th>Basis</th></tr></thead><tbody>{body}</tbody></table></div>
<footer>Evidence: {escape(str(EVIDENCE_DIR))}<br>Integrity: {escape(integrity)}<br>
Read-only static HTML, no external assets, no JavaScript, no listening port. Contabo service user scope; do not publish raw host evidence.</footer>
</body></html>"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path,
                        default=Path.home() / ".local/share/fr3k-emulation-studio/dashboard.html")
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with args.output.open("w", encoding="utf-8") as f:
        f.write(render())
    args.output.chmod(0o600)
    print(json.dumps({"dashboard": str(args.output), "bytes": args.output.stat().st_size,
                      "network_listener": False, "release_gate": "NOT_CLEARED"}))


if __name__ == "__main__":
    main()
