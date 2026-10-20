"""Unit tests for geometric gesture recognition and pinch hysteresis."""
import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pytest
except ImportError:
    pytest = None

from app.state import Landmark3D, HandTrackingData, GestureType
from app.configuration import HUDConfiguration
from vision.gesture_recognizer import GestureRecognizer


def create_synthetic_hand(pose: str, pinch_distance: float = 0.2) -> HandTrackingData:
    """Generates synthetic 21-landmark hand data representing specific poses."""
    # 0 is wrist
    landmarks = [Landmark3D(0.5, 0.8, 0.0)]

    if pose == "point":
        # Thumb relaxed
        landmarks.extend([Landmark3D(0.45, 0.7, 0.0), Landmark3D(0.42, 0.65, 0.0), Landmark3D(0.40, 0.62, 0.0), Landmark3D(0.38, 0.60, 0.0)])
        # Index straight up (extended)
        landmarks.extend([Landmark3D(0.48, 0.65, 0.0), Landmark3D(0.48, 0.50, 0.0), Landmark3D(0.48, 0.40, 0.0), Landmark3D(0.48, 0.25, 0.0)])
        # Middle curled
        landmarks.extend([Landmark3D(0.52, 0.65, 0.0), Landmark3D(0.52, 0.60, 0.0), Landmark3D(0.52, 0.68, 0.0), Landmark3D(0.52, 0.72, 0.0)])
        # Ring curled
        landmarks.extend([Landmark3D(0.55, 0.65, 0.0), Landmark3D(0.55, 0.60, 0.0), Landmark3D(0.55, 0.68, 0.0), Landmark3D(0.55, 0.72, 0.0)])
        # Pinky curled
        landmarks.extend([Landmark3D(0.58, 0.65, 0.0), Landmark3D(0.58, 0.60, 0.0), Landmark3D(0.58, 0.68, 0.0), Landmark3D(0.58, 0.72, 0.0)])

    elif pose == "open_palm":
        # All fingers extended up
        landmarks.extend([Landmark3D(0.40, 0.7, 0.0), Landmark3D(0.35, 0.6, 0.0), Landmark3D(0.30, 0.5, 0.0), Landmark3D(0.25, 0.4, 0.0)])
        landmarks.extend([Landmark3D(0.45, 0.6, 0.0), Landmark3D(0.45, 0.45, 0.0), Landmark3D(0.45, 0.35, 0.0), Landmark3D(0.45, 0.25, 0.0)])
        landmarks.extend([Landmark3D(0.50, 0.6, 0.0), Landmark3D(0.50, 0.45, 0.0), Landmark3D(0.50, 0.35, 0.0), Landmark3D(0.50, 0.22, 0.0)])
        landmarks.extend([Landmark3D(0.55, 0.6, 0.0), Landmark3D(0.55, 0.45, 0.0), Landmark3D(0.55, 0.35, 0.0), Landmark3D(0.55, 0.25, 0.0)])
        landmarks.extend([Landmark3D(0.60, 0.6, 0.0), Landmark3D(0.60, 0.45, 0.0), Landmark3D(0.60, 0.35, 0.0), Landmark3D(0.60, 0.28, 0.0)])

    elif pose == "fist":
        # All fingers curled
        landmarks.extend([Landmark3D(0.48, 0.75, 0.0), Landmark3D(0.48, 0.72, 0.0), Landmark3D(0.48, 0.75, 0.0), Landmark3D(0.48, 0.77, 0.0)])
        landmarks.extend([Landmark3D(0.47, 0.70, 0.0), Landmark3D(0.47, 0.65, 0.0), Landmark3D(0.47, 0.72, 0.0), Landmark3D(0.47, 0.76, 0.0)])
        landmarks.extend([Landmark3D(0.50, 0.70, 0.0), Landmark3D(0.50, 0.65, 0.0), Landmark3D(0.50, 0.72, 0.0), Landmark3D(0.50, 0.76, 0.0)])
        landmarks.extend([Landmark3D(0.53, 0.70, 0.0), Landmark3D(0.53, 0.65, 0.0), Landmark3D(0.53, 0.72, 0.0), Landmark3D(0.53, 0.76, 0.0)])
        landmarks.extend([Landmark3D(0.56, 0.70, 0.0), Landmark3D(0.56, 0.65, 0.0), Landmark3D(0.56, 0.72, 0.0), Landmark3D(0.56, 0.76, 0.0)])

    return HandTrackingData(
        handedness="Right",
        landmarks=landmarks,
        confidence=0.98,
        index_tip=(landmarks[8].x, landmarks[8].y, landmarks[8].z),
        thumb_tip=(landmarks[4].x, landmarks[4].y, landmarks[4].z),
        wrist=(landmarks[0].x, landmarks[0].y, landmarks[0].z),
        pinch_distance=pinch_distance,
        is_pinching=(pinch_distance < 0.05)
    )


def test_gesture_point():
    recognizer = GestureRecognizer()
    hand = create_synthetic_hand("point", pinch_distance=0.2)
    gesture = recognizer.recognize([hand])
    assert gesture == GestureType.POINTING


def test_gesture_open_palm():
    recognizer = GestureRecognizer()
    hand = create_synthetic_hand("open_palm", pinch_distance=0.25)
    gesture = recognizer.recognize([hand])
    assert gesture == GestureType.OPEN_PALM


def test_gesture_fist():
    recognizer = GestureRecognizer()
    hand = create_synthetic_hand("fist", pinch_distance=0.15)
    gesture = recognizer.recognize([hand])
    assert gesture == GestureType.FIST


def test_pinch_hysteresis():
    config = HUDConfiguration(pinch_engage_threshold=0.045, pinch_release_threshold=0.065)
    recognizer = GestureRecognizer(config)

    # 1. Approaching: distance 0.050 (above engage threshold -> not pinching)
    h1 = create_synthetic_hand("point", pinch_distance=0.050)
    g1 = recognizer.recognize([h1])
    assert g1 == GestureType.POINTING
    assert not recognizer.is_pinching

    # 2. Engage pinch: distance 0.035 (< 0.045 engage threshold)
    h2 = create_synthetic_hand("point", pinch_distance=0.035)
    g2 = recognizer.recognize([h2])
    assert g2 == GestureType.PINCHING
    assert recognizer.is_pinching
    assert recognizer.pinch_just_engaged

    # 3. Holding pinch with slight fluctuation: distance 0.055 (above engage, but below 0.065 release)
    h3 = create_synthetic_hand("point", pinch_distance=0.055)
    g3 = recognizer.recognize([h3])
    assert g3 == GestureType.PINCHING
    assert recognizer.is_pinching
    assert not recognizer.pinch_just_engaged  # Only triggers once!

    # 4. Release pinch: distance 0.075 (> 0.065 release threshold)
    h4 = create_synthetic_hand("point", pinch_distance=0.075)
    g4 = recognizer.recognize([h4])
    assert g4 != GestureType.PINCHING
    assert not recognizer.is_pinching
    assert recognizer.pinch_just_released


if __name__ == "__main__":
    test_gesture_point()
    test_gesture_open_palm()
    test_gesture_fist()
    test_pinch_hysteresis()
    print("All gesture tests passed successfully!")
