"""Unit tests for camera switcher and index cycling."""
import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pytest
except ImportError:
    pytest = None

from app.configuration import HUDConfiguration, ConfigurationManager
from services.command_service import CommandService


def test_camera_cycle_logic():
    available_cameras = [0, 1, 2]
    current_cam = 0

    # Cycle forward
    next_cam = available_cameras[(available_cameras.index(current_cam) + 1) % len(available_cameras)]
    assert next_cam == 1

    next_cam = available_cameras[(available_cameras.index(next_cam) + 1) % len(available_cameras)]
    assert next_cam == 2

    # Wrap around
    next_cam = available_cameras[(available_cameras.index(next_cam) + 1) % len(available_cameras)]
    assert next_cam == 0


def test_camera_cycle_backward():
    available_cameras = [0, 1, 2]
    current_cam = 0

    # Cycle backward
    prev_cam = available_cameras[(available_cameras.index(current_cam) - 1) % len(available_cameras)]
    assert prev_cam == 2


def test_command_switch_camera():
    cmd_service = CommandService()
    active_cam = {"id": 0}

    cmd_service.register("switch_camera", lambda id: active_cam.update({"id": int(id)}))
    cmd_service.register("cycle_camera", lambda: active_cam.update({"id": (active_cam["id"] + 1) % 3}))

    # Direct switch
    ok, _ = cmd_service.execute("switch_camera", id=2)
    assert ok
    assert active_cam["id"] == 2

    # Cycle
    ok2, _ = cmd_service.execute("cycle_camera")
    assert ok2
    assert active_cam["id"] == 0


if __name__ == "__main__":
    test_camera_cycle_logic()
    test_camera_cycle_backward()
    test_command_switch_camera()
    print("All camera switcher tests passed successfully!")
