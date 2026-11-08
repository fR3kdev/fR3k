"""Android release gate pure-state tests; no device or APK required."""
from importlib import util
from pathlib import Path
import unittest

spec = util.spec_from_file_location("fr3k_android_gate", Path(__file__).resolve().parents[1] / "android_gate.py")
gate = util.module_from_spec(spec)
spec.loader.exec_module(gate)

P = "dev.fr3k.overlay.full.lab"
F = "mCurrentFocus=Window{11 u0 dev.fr3k.overlay.full.lab/dev.fr3k.overlay.MainActivity}"


class TestAndroidGate(unittest.TestCase):
    def verdict(self, focus=F, ui='<hierarchy/>', launch=0, pid=True, png=True, crash=False, anr=False):
        return gate.classify_visual(P, focus, ui, launch, pid, png, crash, anr)

    def test_process_alive_but_permission_dialog_is_not_pass(self):
        self.assertEqual(self.verdict(focus="mCurrentFocus=Window{u0 com.google.android.permissioncontroller/...}"),
                         "NEEDS_REVIEW")

    def test_anr_is_fail_even_with_screenshot(self):
        self.assertEqual(self.verdict(focus="mCurrentFocus=Application Not Responding: com.android.systemui",
                                      anr=True), "FAIL")

    def test_walkthrough_requires_human_review(self):
        self.assertEqual(self.verdict(ui='<node text="APP WALKTHROUGH 1/14"/>'), "NEEDS_REVIEW")

    def test_missing_ui_dump_is_not_a_pass(self):
        self.assertEqual(self.verdict(ui=""), "NEEDS_REVIEW")

    def test_process_absent_is_fail(self):
        self.assertEqual(self.verdict(pid=False), "FAIL")

    def test_normal_foreground_app_can_pass_narrow_ui_smoke(self):
        self.assertEqual(self.verdict(), "PASS")

    def test_physical_serial_restriction(self):
        self.assertTrue(__import__("re").fullmatch(r"emulator-[0-9]{4,5}", "emulator-5580"))
        self.assertFalse(__import__("re").fullmatch(r"emulator-[0-9]{4,5}", "100.109.79.68"))


if __name__ == "__main__":
    unittest.main()
