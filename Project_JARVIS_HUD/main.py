"""Project JARVIS HUD — Main Application Entry Point
"""
import sys
import os
import argparse

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.qt_compat import QApplication
from app.configuration import ConfigurationManager
from hud.main_window import HUDMainWindow


def parse_args():
    parser = argparse.ArgumentParser(description="Project JARVIS HUD: Tactical Holographic Interface")
    parser.add_argument("--camera-id", type=int, default=None, help="Force camera index (e.g., 0, 1, 2)")
    parser.add_argument("--fullscreen", action="store_true", help="Launch in fullscreen mode")
    parser.add_argument("--no-audio", action="store_true", help="Disable sound effects")
    parser.add_argument("--no-feed", action="store_true", help="Disable camera background feed")
    return parser.parse_args()


def main():
    args = parse_args()

    # Load configuration
    config_mgr = ConfigurationManager(config_file=os.path.join(os.path.dirname(__file__), "config.json"))
    cfg = config_mgr.get()

    if args.camera_id is not None:
        cfg.camera_id = args.camera_id
    if args.fullscreen:
        cfg.fullscreen = True
    if args.no_audio:
        cfg.audio_enabled = False
    if args.no_feed:
        cfg.show_camera_feed = False

    app = QApplication(sys.argv)
    app.setApplicationName("Project JARVIS HUD")

    window = HUDMainWindow(config_manager=config_mgr)

    if cfg.fullscreen:
        window.showFullScreen()
    else:
        window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
