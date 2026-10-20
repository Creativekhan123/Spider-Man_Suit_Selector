"""Unit tests for gesture routing and interaction state."""
import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pytest
except ImportError:
    pytest = None

from app.state import HUDMode, GestureType, VirtualCursorState, HandTrackingData, Landmark3D
from app.configuration import HUDConfiguration
from interaction.gesture_router import GestureRouter


def test_mode_cycling():
    router = GestureRouter()
    assert router.current_mode == HUDMode.CORE

    # Cycle forward
    router.cycle_mode(1)
    assert router.current_mode == HUDMode.OBJECT_3D

    router.cycle_mode(1)
    assert router.current_mode == HUDMode.DIAGNOSTICS

    router.cycle_mode(1)
    assert router.current_mode == HUDMode.SETTINGS

    # Wraps around
    router.cycle_mode(1)
    assert router.current_mode == HUDMode.CORE


def test_swipe_triggers_mode_switch():
    router = GestureRouter()
    cursor = VirtualCursorState(is_active=True)

    # Process SWIPE_LEFT
    router.process(GestureType.SWIPING_LEFT, cursor, [], 1000, 1000)
    assert router.current_mode == HUDMode.OBJECT_3D

    # Process SWIPE_RIGHT
    router.process(GestureType.SWIPING_RIGHT, cursor, [], 1000, 1000)
    assert router.current_mode == HUDMode.CORE


def test_3d_object_manipulation():
    router = GestureRouter()
    router.set_mode(HUDMode.OBJECT_3D)

    # Click in center
    cursor_press = VirtualCursorState(is_active=True, screen_x=500, screen_y=500, is_clicking=True, click_just_pressed=True)
    router.process(GestureType.PINCHING, cursor_press, [], 1000, 1000)
    assert router.is_dragging_object
    assert router.virtual_object.is_grabbed

    # Drag cursor
    cursor_drag = VirtualCursorState(is_active=True, screen_x=520, screen_y=490, is_clicking=True)
    router.process(GestureType.PINCHING, cursor_drag, [], 1000, 1000)
    # Rotation should update
    assert router.virtual_object.rotation_y != 30.0
    assert router.virtual_object.rotation_x != 20.0

    # Release
    cursor_release = VirtualCursorState(is_active=True, screen_x=520, screen_y=490, is_clicking=False, click_just_released=True)
    router.process(GestureType.IDLE, cursor_release, [], 1000, 1000)
    assert not router.is_dragging_object
    assert not router.virtual_object.is_grabbed


def test_open_palm_resets_object():
    router = GestureRouter()
    router.set_mode(HUDMode.OBJECT_3D)
    router.virtual_object.rotation_x = 99.0
    router.virtual_object.scale = 2.5

    cursor = VirtualCursorState(is_active=True)
    router.process(GestureType.OPEN_PALM, cursor, [], 1000, 1000)

    # Object should be reset
    assert router.virtual_object.rotation_x == 20.0
    assert router.virtual_object.scale == 1.0


def test_tracking_loss_clears_drag():
    router = GestureRouter()
    router.set_mode(HUDMode.OBJECT_3D)
    router.is_dragging_object = True
    router.virtual_object.is_grabbed = True

    # Cursor becomes inactive
    inactive_cursor = VirtualCursorState(is_active=False)
    router.process(GestureType.IDLE, inactive_cursor, [], 1000, 1000)

    assert not router.is_dragging_object
    assert not router.virtual_object.is_grabbed


if __name__ == "__main__":
    test_mode_cycling()
    test_swipe_triggers_mode_switch()
    test_3d_object_manipulation()
    test_open_palm_resets_object()
    test_tracking_loss_clears_drag()
    print("All interaction tests passed successfully!")
