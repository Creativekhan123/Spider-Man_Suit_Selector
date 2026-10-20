"""PyInstaller Packaging Script for Project JARVIS HUD
Builds a standalone Windows distribution including model assets and sounds.
"""
import os
import sys
import subprocess
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MAIN_SCRIPT = os.path.join(BASE_DIR, "main.py")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
DIST_DIR = os.path.join(BASE_DIR, "dist")
BUILD_DIR = os.path.join(BASE_DIR, "build")


def build():
    print("=== Building Project JARVIS HUD for Windows ===")

    # Verify model asset
    model_file = os.path.join(ASSETS_DIR, "models", "hand_landmarker.task")
    if not os.path.exists(model_file):
        raise FileNotFoundError(f"Missing required model asset: {model_file}")

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "Project_JARVIS_HUD",
        "--onedir",
        "--noconfirm",
        "--clean",
        "--windowed",
        f"--add-data={os.path.join(ASSETS_DIR, 'models', 'hand_landmarker.task')};assets/models",
        f"--add-data={os.path.join(ASSETS_DIR, 'sounds')};assets/sounds",
        "--hidden-import=mediapipe",
        "--hidden-import=mediapipe.tasks",
        "--hidden-import=mediapipe.tasks.python",
        "--hidden-import=mediapipe.tasks.python.vision",
        "--hidden-import=psutil",
        MAIN_SCRIPT
    ]

    print("Running command:", " ".join(cmd))
    result = subprocess.run(cmd, cwd=BASE_DIR)

    if result.returncode == 0:
        print("\n=== Build Completed Successfully! ===")
        print(f"Output folder: {os.path.join(DIST_DIR, 'Project_JARVIS_HUD')}")
        print(f"Executable: {os.path.join(DIST_DIR, 'Project_JARVIS_HUD', 'Project_JARVIS_HUD.exe')}")
    else:
        print(f"\nBuild failed with exit code: {result.returncode}")
        sys.exit(result.returncode)


if __name__ == "__main__":
    build()
