"""MediaPipe Hand Tracking Pipeline
Encapsulates MediaPipe Tasks HandLandmarker in VIDEO running mode.
"""
import os
import time
import math
from typing import List, Tuple, Optional, Any
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from app.state import Landmark3D, HandTrackingData, GestureType

# Standard 21-landmark topological connections for hand skeleton rendering
HAND_CONNECTIONS: List[Tuple[int, int]] = [
    # Thumb
    (0, 1), (1, 2), (2, 3), (3, 4),
    # Index finger
    (0, 5), (5, 6), (6, 7), (7, 8),
    # Middle finger
    (5, 9), (9, 10), (10, 11), (11, 12),
    # Ring finger
    (9, 13), (13, 14), (14, 15), (15, 16),
    # Pinky & Palm base
    (13, 17), (17, 18), (18, 19), (19, 20), (0, 17)
]


class HandTracker:
    """Detects and tracks hand landmarks using MediaPipe Hand Landmarker."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        num_hands: int = 2,
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5
    ):
        if model_path is None:
            # Resolve relative to project assets
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_path = os.path.join(base_dir, "assets", "models", "hand_landmarker.task")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Hand landmarker model not found at: {model_path}")

        self.model_path = model_path
        self.num_hands = num_hands
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence
        self.detector: Optional[Any] = None
        self._last_timestamp_ms: int = 0
        self._initialize_detector()

    def _initialize_detector(self):
        """Initializes the MediaPipe Tasks Landmarker."""
        base_options = python.BaseOptions(model_asset_path=self.model_path)
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=self.num_hands,
            min_hand_detection_confidence=self.min_detection_confidence,
            min_hand_presence_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
            running_mode=vision.RunningMode.VIDEO
        )
        self.detector = vision.HandLandmarker.create_from_options(options)

    def process_frame(self, frame_bgr: np.ndarray, timestamp_ms: Optional[int] = None) -> Tuple[List[HandTrackingData], float]:
        """Processes an OpenCV BGR frame and returns detected hands and inference latency (ms)."""
        if self.detector is None:
            return [], 0.0

        if timestamp_ms is None:
            curr_ms = int(time.time() * 1000)
            if curr_ms <= self._last_timestamp_ms:
                curr_ms = self._last_timestamp_ms + 1
            timestamp_ms = curr_ms
        self._last_timestamp_ms = timestamp_ms

        # Convert OpenCV BGR to RGB
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

        t_start = time.perf_counter()
        detection_result = self.detector.detect_for_video(mp_image, timestamp_ms)
        latency_ms = (time.perf_counter() - t_start) * 1000.0

        hands_data: List[HandTrackingData] = []

        if not detection_result.hand_landmarks:
            return hands_data, latency_ms

        for idx, landmarks in enumerate(detection_result.hand_landmarks):
            handedness_str = "Right"
            score = 0.95
            if detection_result.handedness and idx < len(detection_result.handedness):
                categories = detection_result.handedness[idx]
                if categories:
                    handedness_str = categories[0].category_name
                    score = categories[0].score

            # Parse 21 landmarks
            parsed_landmarks: List[Landmark3D] = []
            for lm in landmarks:
                parsed_landmarks.append(Landmark3D(x=lm.x, y=lm.y, z=lm.z))

            # Extract key landmarks
            wrist = (parsed_landmarks[0].x, parsed_landmarks[0].y, parsed_landmarks[0].z)
            thumb_tip = (parsed_landmarks[4].x, parsed_landmarks[4].y, parsed_landmarks[4].z)
            index_tip = (parsed_landmarks[8].x, parsed_landmarks[8].y, parsed_landmarks[8].z)

            # Euclidean distance between Thumb Tip and Index Tip
            dx = thumb_tip[0] - index_tip[0]
            dy = thumb_tip[1] - index_tip[1]
            dz = thumb_tip[2] - index_tip[2]
            pinch_dist = math.sqrt(dx * dx + dy * dy + dz * dz)

            hand = HandTrackingData(
                handedness=handedness_str,
                landmarks=parsed_landmarks,
                confidence=score,
                index_tip=index_tip,
                thumb_tip=thumb_tip,
                wrist=wrist,
                pinch_distance=pinch_dist,
                is_pinching=(pinch_dist < 0.05),
                gesture=GestureType.IDLE
            )
            hands_data.append(hand)

        return hands_data, latency_ms

    def close(self):
        """Releases the MediaPipe Landmarker resources."""
        if self.detector is not None:
            try:
                self.detector.close()
            except Exception:
                pass
            self.detector = None
