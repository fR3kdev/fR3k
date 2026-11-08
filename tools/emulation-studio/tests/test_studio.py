"""Evidence gate tests. Run: python3 -m unittest discover -s tests -v"""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("fr3k_studio", Path(__file__).resolve().parents[1] / "studio.py")
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)


class StudioTests(unittest.TestCase):
    def test_profile_ids_unique(self):
        self.assertEqual(len(studio.catalog()["profiles"]), len({p["id"] for p in studio.catalog()["profiles"]}))

    def test_not_real_guest_is_blocked(self):
        facts = studio.host()
        for p in studio.catalog()["profiles"]:
            if p["status"] != "ready":
                self.assertEqual("BLOCKED", studio.state(p, facts)[0])

    def test_tamper_evidence_detection(self):
        with tempfile.TemporaryDirectory() as directory:
            original = studio.EVIDENCE_DIR
            studio.EVIDENCE_DIR = Path(directory)
            try:
                p = studio.catalog()["profiles"][0]
                result = studio.record(p, studio.host(), "BLOCKED", "test", {"attempted": False})
                path = Path(directory) / (result["run_id"] + ".json")
                self.assertEqual(studio.verify(path)["integrity"], "VERIFIED")
                altered = json.loads(path.read_text())
                altered["status"] = "PASS"
                path.write_text(json.dumps(altered))
                self.assertEqual(studio.verify(path)["integrity"], "TAMPERED")
            finally:
                studio.EVIDENCE_DIR = original

    def test_unknown_runner_cannot_be_invoked(self):
        fake = {"id":"evil", "status":"ready", "engine":"native", "family":"Linux", "architecture":"host"}
        self.assertEqual("BLOCKED", studio.state(fake, studio.host())[0])


if __name__ == "__main__":
    unittest.main()
