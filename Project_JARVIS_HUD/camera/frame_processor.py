"""Frame Processing & Multithreaded Capture Worker
Processes video frames and MediaPipe inference in a background QThread.
"""
import time
from typing import Optional, List
import cv2
import numpy as np
import psutil

from app.qt_compat import QThread, Signal, Slot, QImage
from app.state import CameraState, HandTrackingData, SystemTelemetry
from app.configuration import HUDConfiguration
from camera.camera_manager import CameraManager
from vision.hand_tracker import HandTracker


class CameraWorkerThread(QThread):
    """Dedicated background thread for camera frame capture and hand landmark inference."""

    # Signals emitted to the UI thread
    frame_ready = Signal(object, list, object)  # (QImage, List[HandTrackingData], SystemTelemetry)
    camera_status_changed = Signal(str)         # (CameraState value)
    camera_error = Signal(str)                  # Error message string

    def __init__(self, config: HUDConfiguration, parent=None):
        super().__init__(parent)
        self.config = config
        self._running = False
        self._camera_manager: Optional[CameraManager] = None
        self._tracker: Optional[HandTracker] = None
        self._current_state = CameraState.CAMERA_OFFLINE
        self._pending_camera_id: Optional[int] = None

    def _set_status(self, new_state: CameraState):
        if self._current_state != new_state:
            self._current_state = new_state
            self.camera_status_changed.emit(new_state.value)

    def run(self):
        """Worker loop running on the dedicated background thread."""
        self._running = True
        self._set_status(CameraState.CAMERA_CONNECTING)

        # Initialize hardware
        self._camera_manager = CameraManager(
            camera_id=self.config.camera_id,
            target_width=self.config.camera_width,
            target_height=self.config.camera_height,
            target_fps=self.config.target_camera_fps
        )

        if not self._camera_manager.open():
            self._set_status(CameraState.CAMERA_OFFLINE)
            self.camera_error.emit(f"Failed to open Camera #{self.config.camera_id}")
            return

        # Initialize MediaPipe Hand Tracker
        try:
            self._tracker = HandTracker(
                num_hands=self.config.max_hands,
                min_detection_confidence=self.config.min_detection_confidence,
                min_tracking_confidence=self.config.min_tracking_confidence
            )
            self._set_status(CameraState.CAMERA_READY)
        except Exception as e:
            self._set_status(CameraState.CAMERA_OFFLINE)
            self.camera_error.emit(f"MediaPipe initialization failed: {e}")
            self._camera_manager.release()
            return

        consecutive_failures = 0
        last_telemetry_time = time.perf_counter()
        cpu_usage = 0.0
        ram_usage = 0.0

        while self._running:
            loop_start = time.perf_counter()

            # Handle pending camera switch request safely between frames
            if self._pending_camera_id is not None and self._camera_manager:
                target_id = self._pending_camera_id
                self._pending_camera_id = None
                self._set_status(CameraState.CAMERA_CONNECTING)
                if self._camera_manager.switch_camera(target_id):
                    self._set_status(CameraState.CAMERA_READY)
                else:
                    self._set_status(CameraState.CAMERA_OFFLINE)

            ret, frame = self._camera_manager.read_frame()

            if not ret or frame is None:
                consecutive_failures += 1
                if consecutive_failures > 10:
                    self._set_status(CameraState.CAMERA_OFFLINE)
                    # Attempt reconnection
                    time.sleep(1.0)
                    if self._camera_manager.open():
                        consecutive_failures = 0
                        self._set_status(CameraState.CAMERA_READY)
                time.sleep(0.01)
                continue

            consecutive_failures = 0

            # Horizontal flip for intuitive selfie/mirror mode
            if self.config.mirror_camera:
                frame = cv2.flip(frame, 1)

            # Hand landmarker inference
            try:
                hands, inference_ms = self._tracker.process_frame(frame)
            except Exception as e:
                hands = []
                inference_ms = 0.0

            # State indicator update
            if len(hands) > 0:
                self._set_status(CameraState.HAND_TRACKED)
            else:
                self._set_status(CameraState.SEARCHING_FOR_HAND)

            # Query system stats periodically (~1 second)
            now = time.perf_counter()
            if now - last_telemetry_time > 1.0:
                try:
                    cpu_raw = psutil.cpu_percent()
                    if isinstance(cpu_raw, (int, float)):
                        cpu_usage = float(cpu_raw)
                    ram_usage = float(psutil.virtual_memory().percent)
                except Exception:
                    pass
                last_telemetry_time = now

            # Total loop latency
            total_latency_ms = (time.perf_counter() - loop_start) * 1000.0

            telemetry = SystemTelemetry(
                camera_fps=self._camera_manager.get_fps(),
                render_fps=0.0,  # Computed on UI thread
                inference_time_ms=inference_ms,
                total_frame_latency_ms=total_latency_ms,
                cpu_percent=cpu_usage,
                ram_percent=ram_usage,
                active_camera_name=f"Camera #{self.config.camera_id}",
                frame_width=frame.shape[1],
                frame_height=frame.shape[0],
                hands_detected=len(hands)
            )

            # Convert OpenCV frame to Qt QImage safely
            # Note: frame must be RGB and copied so memory isn't overwritten by next read
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w, ch = frame_rgb.shape
            bytes_per_line = ch * w
            # Copy bytes to ensure thread safety
            qimg = QImage(frame_rgb.data, w, h, bytes_per_line, QImage.Format.Format_RGB888).copy()

            # Emit to UI
            self.frame_ready.emit(qimg, hands, telemetry)

            # Throttle slightly if running faster than desired target
            elapsed = time.perf_counter() - loop_start
            target_period = 1.0 / max(1, self.config.target_camera_fps)
            if elapsed < target_period:
                time.sleep(target_period - elapsed)

        # Cleanup on exit
        if self._tracker:
            self._tracker.close()
            self._tracker = None
        if self._camera_manager:
            self._camera_manager.release()
            self._camera_manager = None
        self._set_status(CameraState.CAMERA_OFFLINE)

    def stop(self):
        """Stops the worker thread cleanly."""
        self._running = False
        self.wait(1500)

    def switch_camera(self, new_camera_id: int):
        """Schedules a camera switch to be safely executed on the capture thread."""
        self.config.camera_id = new_camera_id
        self._pending_camera_id = new_camera_id
