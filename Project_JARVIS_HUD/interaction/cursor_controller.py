"""Holographic Cursor Controller & Screen Space Mapping
Maps normalized hand coordinates to UI viewport coordinates with deadzone,
sensitivity amplification, and adaptive temporal smoothing.
"""
import time
from typing import Tuple, Optional
from dataclasses import dataclass

from app.state import VirtualCursorState, HandTrackingData, GestureType
from app.configuration import HUDConfiguration
from vision.tracking_filter import PointSmoother2D


class CursorController:
    """Controls the virtual holographic cursor positioning and clicking state."""

    def __init__(self, config: Optional[HUDConfiguration] = None):
        self.config = config or HUDConfiguration()
        self.smoother = PointSmoother2D(min_cutoff=1.5, beta=0.04)
        self.cursor_state = VirtualCursorState()
        self._last_raw_x: float = 0.5
        self._last_raw_y: float = 0.5

    def reset(self):
        """Resets cursor position and smoother."""
        self.smoother.reset()
        self.cursor_state = VirtualCursorState()

    def update(
        self,
        primary_hand: Optional[HandTrackingData],
        viewport_width: int,
        viewport_height: int,
        is_pinching: bool,
        pinch_just_engaged: bool,
        pinch_just_released: bool,
        timestamp: Optional[float] = None
    ) -> VirtualCursorState:
        """Updates virtual cursor coordinates and click trigger states."""
        now = timestamp if timestamp is not None else time.time()

        if primary_hand is None or len(primary_hand.landmarks) < 9:
            self.cursor_state.is_active = False
            self.cursor_state.is_clicking = False
            self.cursor_state.click_just_pressed = False
            self.cursor_state.click_just_released = False
            return self.cursor_state

        self.cursor_state.is_active = True

        # Index fingertip is landmark 8
        raw_x = primary_hand.landmarks[8].x
        raw_y = primary_hand.landmarks[8].y

        # Apply sensitivity scaling around center (0.5, 0.5)
        # Margin scaling allows the user to reach screen corners easily
        sens = self.config.cursor_sensitivity
        amplified_x = (raw_x - 0.5) * sens + 0.5
        amplified_y = (raw_y - 0.5) * sens + 0.5

        # Clamp to [0.0, 1.0] viewport bounds
        clamped_x = max(0.0, min(1.0, amplified_x))
        clamped_y = max(0.0, min(1.0, amplified_y))

        # Temporal smoothing with One-Euro filter
        smooth_x, smooth_y = self.smoother.smooth(clamped_x, clamped_y, timestamp=now)

        self.cursor_state.norm_x = smooth_x
        self.cursor_state.norm_y = smooth_y
        self.cursor_state.screen_x = smooth_x * viewport_width
        self.cursor_state.screen_y = smooth_y * viewport_height

        # Click state
        self.cursor_state.is_clicking = is_pinching
        self.cursor_state.click_just_pressed = pinch_just_engaged
        self.cursor_state.click_just_released = pinch_just_released

        return self.cursor_state
