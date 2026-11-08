"""Pure Android overlay checker state tests; no emulator required."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import unittest

spec = spec_from_file_location("fr3k_overlay_check", Path(__file__).resolve().parents[1] / "android_overlay_check.py")
module = module_from_spec(spec)
spec.loader.exec_module(module)

SAMPLE = """
  Window #6 Window{fake u0 dev.fr3k.overlay.full.lab}:
    mOwnerUid=10209 showForAllUsers=false package=dev.fr3k.overlay.full.lab appop=SYSTEM_ALERT_WINDOW
    mAttrs={(0,100)(320xwrap) ty=APPLICATION_OVERLAY fmt=TRANSLUCENT
    Surface: shown=true
    isOnScreen=true
    isVisible=true
  Window #7 Window{fake u0 com.android.systemui}:
    mOwnerUid=10181 package=com.android.systemui appop=SYSTEM_ALERT_WINDOW
    mAttrs={(0,0)(fillxfill) ty=APPLICATION_OVERLAY fmt=TRANSLUCENT
    Surface: shown=false
    isOnScreen=false
    isVisible=false
"""


class Tests(unittest.TestCase):
    def test_scopes_to_fr3k_owned_window(self):
        rows = module.windows_for_package(SAMPLE, "dev.fr3k.overlay.full.lab")
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["visible"])
        self.assertTrue(rows[0]["on_screen"])

    def test_running_over_launcher_is_pass(self):
        self.assertEqual(module.decision(True, True, module.windows_for_package(SAMPLE, "dev.fr3k.overlay.full.lab")),
                         ("PASS", "WINDOW_MANAGER_OVERLAY_VISIBLE"))

    def test_stopped_show_is_not_a_pass(self):
        self.assertEqual(module.decision(True, True, []), ("FAIL", "NO_APP_OWNED_OVERLAY_WINDOW"))

    def test_permission_required(self):
        self.assertEqual(module.decision(False, True, []), ("BLOCKED", "OVERLAY_PERMISSION_NOT_GRANTED"))

    def test_home_required(self):
        self.assertEqual(module.decision(True, False, []), ("BLOCKED", "HOME_NOT_FOREGROUND"))

    def test_lookalike_systemui_window_is_excluded(self):
        self.assertEqual(module.windows_for_package(SAMPLE, "dev.fr3k.nonexistent"), [])


if __name__ == "__main__":
    unittest.main()
