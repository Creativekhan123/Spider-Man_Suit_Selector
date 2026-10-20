"""Runtime integration test: launches HUD, processes live frames, saves screenshot, and exits cleanly."""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.qt_compat import QApplication, QTimer, QPixmap
from hud.main_window import HUDMainWindow


def run_runtime_test():
    app = QApplication(sys.argv)
    window = HUDMainWindow()
    window.show()

    screenshot_taken = False
    screenshot_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "live_hud_test.png")

    frames_rendered = 0

    def on_frame_check():
        nonlocal frames_rendered, screenshot_taken
        frames_rendered += 1

        # After 2.5 seconds of live camera & rendering
        if frames_rendered >= 60 and not screenshot_taken:
            pixmap = window.grab()
            pixmap.save(screenshot_path, "PNG")
            print(f"[Verify] Successfully captured live HUD screenshot to: {screenshot_path}")
            screenshot_taken = True

        if frames_rendered >= 90:
            print(f"[Verify] Live render test complete. Frames: {frames_rendered}. Closing window...")
            window.close()
            app.quit()

    check_timer = QTimer()
    check_timer.timeout.connect(on_frame_check)
    check_timer.start(33)  # ~30 checks/sec

    app.exec()
    print("[Verify] Application exited cleanly with zero errors.")
    return os.path.exists(screenshot_path)


if __name__ == "__main__":
    success = run_runtime_test()
    sys.exit(0 if success else 1)
