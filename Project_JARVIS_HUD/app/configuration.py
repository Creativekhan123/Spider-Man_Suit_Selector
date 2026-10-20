"""Application Configuration Manager
Handles loading, validating, and persisting runtime user preferences.
"""
import os
import json
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, Optional


@dataclass
class HUDConfiguration:
    # Camera settings
    camera_id: int = 0
    mirror_camera: bool = True
    camera_width: int = 1280
    camera_height: int = 720
    target_camera_fps: int = 30

    # Hand Tracking & Gesture settings
    min_detection_confidence: float = 0.5
    min_tracking_confidence: float = 0.5
    max_hands: int = 2
    cursor_sensitivity: float = 1.3
    cursor_smoothing_alpha: float = 0.4
    pinch_engage_threshold: float = 0.048
    pinch_release_threshold: float = 0.070
    swipe_min_velocity: float = 0.35
    swipe_cooldown_seconds: float = 0.6

    # Visual HUD settings
    effect_intensity: str = "HIGH"  # "HIGH", "MEDIUM", "LOW"
    show_camera_feed: bool = True
    camera_feed_opacity: float = 0.45
    show_diagnostics: bool = True
    show_skeleton: bool = True
    color_scheme: str = "CYAN"  # "CYAN", "GOLD", "CRIMSON"
    ui_scale: float = 1.0
    fullscreen: bool = False

    # Audio Feedback
    audio_enabled: bool = True
    audio_volume: float = 0.8


class ConfigurationManager:
    """Manages reading and writing application configuration to disk."""

    def __init__(self, config_file: str = "config.json"):
        self.config_file = config_file
        self.config = self.load()

    def get(self) -> HUDConfiguration:
        return self.config

    def load(self) -> HUDConfiguration:
        if not os.path.exists(self.config_file):
            default_config = HUDConfiguration()
            self.save(default_config)
            return default_config

        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Create instance with known fields only
            valid_fields = {k: v for k, v in data.items() if hasattr(HUDConfiguration, k)}
            return HUDConfiguration(**valid_fields)
        except Exception as e:
            print(f"[ConfigManager] Error reading config: {e}. Falling back to default.")
            return HUDConfiguration()

    def save(self, config: Optional[HUDConfiguration] = None) -> bool:
        if config is not None:
            self.config = config
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(asdict(self.config), f, indent=4)
            return True
        except Exception as e:
            print(f"[ConfigManager] Error writing config: {e}")
            return False

    def update(self, **kwargs) -> HUDConfiguration:
        for k, v in kwargs.items():
            if hasattr(self.config, k):
                setattr(self.config, k, v)
        self.save()
        return self.config
