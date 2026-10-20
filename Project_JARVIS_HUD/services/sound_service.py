"""Audio Feedback Service
Plays sci-fi acoustic cues asynchronously using Windows native winsound.
"""
import os
import sys
from typing import Dict, Optional

# winsound is built-in on Windows standard library
try:
    import winsound
    HAS_WINSOUND = True
except ImportError:
    winsound = None
    HAS_WINSOUND = False


class SoundService:
    """Manages audio playback for HUD interaction cues."""

    def __init__(self, sounds_dir: Optional[str] = None, enabled: bool = True):
        self.enabled = enabled
        if sounds_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            sounds_dir = os.path.join(base_dir, "assets", "sounds")

        self.sounds_dir = sounds_dir
        self.sound_paths: Dict[str, str] = {
            "lock": os.path.join(sounds_dir, "lock.wav"),
            "spawn": os.path.join(sounds_dir, "spawn.wav"),
            "assemble": os.path.join(sounds_dir, "assemble.wav"),
            "explode": os.path.join(sounds_dir, "explode.wav")
        }

    def play(self, sound_name: str):
        """Asynchronously plays a registered sound effect."""
        if not self.enabled or winsound is None:
            return

        path = self.sound_paths.get(sound_name)
        if path and os.path.exists(path):
            try:
                winsound.PlaySound(path, winsound.SND_ASYNC | winsound.SND_FILENAME | winsound.SND_NODEFAULT)
            except Exception:
                pass
