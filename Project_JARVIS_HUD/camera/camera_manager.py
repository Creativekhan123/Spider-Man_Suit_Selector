"""Camera Device Management & Video Capture Loop
Handles device enumeration, connection recovery, resolution negotiation, and clean release.
"""
import time
from typing import List, Tuple, Optional, Dict, Any
import cv2
import numpy as np


def list_available_cameras(max_devices: int = 4) -> List[Dict[str, Any]]:
    """Scans for available video capture devices."""
    available = []
    for idx in range(max_devices):
        # On Windows, cv2.CAP_DSHOW provides fast enumeration and direct hardware access
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if not cap.isOpened():
            # Fall back to default backend
            cap = cv2.VideoCapture(idx)

        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                h, w = frame.shape[:2]
                available.append({
                    "id": idx,
                    "name": f"Camera Device #{idx}",
                    "width": w,
                    "height": h,
                    "default": (idx == 0)
                })
            cap.release()
    return available


class CameraManager:
    """Manages OpenCV VideoCapture with error recovery and performance tracking."""

    def __init__(
        self,
        camera_id: int = 0,
        target_width: int = 1280,
        target_height: int = 720,
        target_fps: int = 30
    ):
        self.camera_id = camera_id
        self.target_width = target_width
        self.target_height = target_height
        self.target_fps = target_fps

        self.cap: Optional[cv2.VideoCapture] = None
        self.actual_width: int = 0
        self.actual_height: int = 0
        self.is_connected: bool = False

        # FPS calculation
        self._frame_times: List[float] = []
        self._fps: float = 0.0

    def open(self) -> bool:
        """Opens and configures the camera device."""
        self.release()

        # Try DirectShow first on Windows for instant response and resolution control
        self.cap = cv2.VideoCapture(self.camera_id, cv2.CAP_DSHOW)
        if not self.cap or not self.cap.isOpened():
            self.cap = cv2.VideoCapture(self.camera_id)

        if not self.cap or not self.cap.isOpened():
            self.is_connected = False
            return False

        # Request desired resolution and FPS
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.target_width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.target_height)
        self.cap.set(cv2.CAP_PROP_FPS, self.target_fps)

        # Check actual negotiated resolution
        ret, test_frame = self.cap.read()
        if ret and test_frame is not None:
            self.actual_height, self.actual_width = test_frame.shape[:2]
            self.is_connected = True
            return True
        else:
            self.release()
            self.is_connected = False
            return False

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Reads a new BGR frame from the camera."""
        if not self.is_connected or self.cap is None:
            return False, None

        ret, frame = self.cap.read()
        if not ret or frame is None:
            self.is_connected = False
            return False, None

        # Update FPS estimation (moving average over last 20 frames)
        now = time.perf_counter()
        self._frame_times.append(now)
        if len(self._frame_times) > 20:
            self._frame_times.pop(0)

        if len(self._frame_times) > 1:
            duration = self._frame_times[-1] - self._frame_times[0]
            if duration > 0:
                self._fps = (len(self._frame_times) - 1) / duration

        return True, frame

    def get_fps(self) -> float:
        return self._fps

    def switch_camera(self, new_camera_id: int) -> bool:
        """Switches to a different camera device."""
        if new_camera_id == self.camera_id and self.is_connected:
            return True
        self.camera_id = new_camera_id
        return self.open()

    def release(self):
        """Cleanly releases the camera hardware."""
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        self.is_connected = False
        self._frame_times.clear()
        self._fps = 0.0
