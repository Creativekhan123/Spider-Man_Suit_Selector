"""Unit tests for holographic cursor screen mapping and state updates."""
import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pytest
except ImportError:
    class ApproxVal:
        def __init__(self, target, abs_tol=1e-6):
            self.target = target
            self.abs_tol = abs_tol
        def __eq__(self, other):
            return abs(self.target - other) <= self.abs_tol

    class PytestFallback:
        @staticmethod
        def approx(val, abs=1e-6):
            return ApproxVal(val, abs_tol=abs)
    pytest = PytestFallback()

from app.state import Landmark3D, HandTrackingData, VirtualCursorState
from app.configuration import HUDConfiguration
from interaction.cursor_controller import CursorController


def create_hand_at(x: float, y: float) -> HandTrackingData:
    landmarks = [Landmark3D(0.5, 0.5, 0.0)] * 21
    landmarks[8] = Landmark3D(x, y, 0.0)
    return HandTrackingData(
        handedness="Right",
        landmarks=landmarks,
        confidence=0.9
    )


def test_cursor_center_mapping():
    controller = CursorController(HUDConfiguration(cursor_sensitivity=1.0))
    hand = create_hand_at(0.5, 0.5)

    state = controller.update(
        primary_hand=hand,
        viewport_width=1920,
        viewport_height=1080,
        is_pinching=False,
        pinch_just_engaged=False,
        pinch_just_released=False,
        timestamp=1.0
    )

    assert state.is_active
    assert pytest.approx(state.norm_x, abs=0.01) == 0.5
    assert pytest.approx(state.norm_y, abs=0.01) == 0.5
    assert pytest.approx(state.screen_x, abs=2.0) == 960.0
    assert pytest.approx(state.screen_y, abs=2.0) == 540.0


def test_cursor_boundary_clamping():
    controller = CursorController(HUDConfiguration(cursor_sensitivity=2.0))
    # Extreme coordinate beyond 1.0 with sensitivity
    hand = create_hand_at(0.9, 0.9)

    state = controller.update(
        primary_hand=hand,
        viewport_width=1000,
        viewport_height=1000,
        is_pinching=False,
        pinch_just_engaged=False,
        pinch_just_released=False,
        timestamp=1.0
    )

    assert 0.0 <= state.norm_x <= 1.0
    assert 0.0 <= state.norm_y <= 1.0
    assert state.screen_x <= 1000.0
    assert state.screen_y <= 1000.0


def test_cursor_click_events():
    controller = CursorController()
    hand = create_hand_at(0.5, 0.5)

    # Click down
    s1 = controller.update(hand, 1000, 1000, is_pinching=True, pinch_just_engaged=True, pinch_just_released=False, timestamp=1.0)
    assert s1.is_clicking
    assert s1.click_just_pressed
    assert not s1.click_just_released

    # Click held
    s2 = controller.update(hand, 1000, 1000, is_pinching=True, pinch_just_engaged=False, pinch_just_released=False, timestamp=1.033)
    assert s2.is_clicking
    assert not s2.click_just_pressed

    # Click released
    s3 = controller.update(hand, 1000, 1000, is_pinching=False, pinch_just_engaged=False, pinch_just_released=True, timestamp=1.066)
    assert not s3.is_clicking
    assert s3.click_just_released


if __name__ == "__main__":
    test_cursor_center_mapping()
    test_cursor_boundary_clamping()
    test_cursor_click_events()
    print("All cursor mapping tests passed successfully!")
