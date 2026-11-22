"""Fail-closed REDMAGIC Geode pack staging tests. No ADB or hardware needed."""
import json
import os
import pathlib
import subprocess
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "deploy-redmagic.sh"
SOURCE = "wangzhang/Qwen3.6-35B-A3B-abliterated-v2"
REV = "a" * 40
BASE = "b" * 40


class RedmagicStagingGate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        (self.root / "dense.bin").write_bytes(b"Q4!!")
        self.manifest = {
            "format": "geode-pack", "version": 1, "arch": "qwen35moe",
            "source": f"{SOURCE}@{REV}",
            "fr3k_provenance": {
                "source_repo": SOURCE, "source_revision": REV,
                "base_revision": BASE,
                "status": "CONVERSION_OUTPUT_UNVERIFIED_ON_DEVICE"
            },
            "files": [{"name": "dense.bin", "size": 4, "sha256": "f" * 64}]
        }
        self.journal = {
            "completed_layers": list(range(40)),
            "source_revision": REV,
            "base_revision": BASE
        }
        self.save()

    def save(self):
        (self.root / "geode.json").write_text(json.dumps(self.manifest))
        (self.root / "fr3k-progress.json").write_text(json.dumps(self.journal))

    def preflight(self):
        env = dict(os.environ, GEODE_PACK_DIR=str(self.root), ADB_SERIAL="")
        return subprocess.run(["bash", str(SCRIPT), "preflight"],
                              env=env, capture_output=True, text=True, timeout=10)

    def test_accepts_complete_source_pinned_manifest_for_metadata_preflight(self):
        result = self.preflight()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PREFLIGHT_FILES_OK", result.stdout)

    def test_refuses_incomplete_marker(self):
        (self.root / "INCOMPLETE").write_text("Not ready")
        self.assertNotEqual(self.preflight().returncode, 0)

    def test_refuses_partial_journal(self):
        self.journal["completed_layers"] = list(range(39))
        self.save()
        self.assertNotEqual(self.preflight().returncode, 0)

    def test_refuses_missing_journal(self):
        (self.root / "fr3k-progress.json").unlink()
        self.assertNotEqual(self.preflight().returncode, 0)

    def test_refuses_revision_mismatch(self):
        self.manifest["fr3k_provenance"]["source_revision"] = "c" * 40
        self.save()
        self.assertNotEqual(self.preflight().returncode, 0)

    def test_refuses_non_abliterated_or_mislabeled_source(self):
        self.manifest["fr3k_provenance"]["source_repo"] = "Qwen/Qwen3.6-35B-A3B"
        self.save()
        self.assertNotEqual(self.preflight().returncode, 0)

    def test_refuses_wrong_lifecycle_status(self):
        self.manifest["fr3k_provenance"]["status"] = "UNKNOWN"
        self.save()
        self.assertNotEqual(self.preflight().returncode, 0)


if __name__ == "__main__":
    unittest.main()
