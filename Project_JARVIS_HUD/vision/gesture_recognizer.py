"""Geometric Hand Gesture Recognizer with Temporal Hysteresis
Classifies normalized hand landmarks into distinct gestures:
POINT, PINCH, OPEN_PALM, FIST, SWIPE_LEFT, SWIPE_RIGHT, TWO_HAND_PINCH.
"""
import math
import time
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass

from app.state import Landmark3D, HandTrackingData, GestureType
from app.configuration import HUDConfiguration


def euclidean_dist(p1: Landmark3D, p2: Landmark3D) -> float:
    """Calculates 3D Euclidean distance between two landmarks."""
    dx = p1.x - p2.x
    dy = p1.y - p2.y
    dz = p1.z - p2.z
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def is_finger_extended(wrist: Landmark3D, mcp: Landmark3D, pip: Landmark3D, tip: Landmark3D) -> bool:
    """Determines whether a finger is extended based on relative radial distance from wrist."""
    dist_tip = euclidean_dist(wrist, tip)
    dist_pip = euclidean_dist(wrist, pip)
    dist_mcp = euclidean_dist(wrist, mcp)
    return (dist_tip > dist_pip * 1.12) and (dist_pip > dist_mcp)


class GestureRecognizer:
    """Classifies hand poses and manages pinch/swipe state machines."""

    def __init__(self, config: Optional[HUDConfiguration] = None):
        self.config = config or HUDConfiguration()
        # Pinch hysteresis state
        self.is_pinching: bool = False
        self.pinch_just_engaged: bool = False
        self.pinch_just_released: bool = False

        # Swipe tracking state
        self._swipe_history: List[Tuple[float, float]] = []  # (x, timestamp)
        self._last_swipe_time: float = 0.0

        # Two-hand initial distance
        self._prev_two_hand_dist: Optional[float] = None

    def reset(self):
        """Resets tracking state."""
        self.is_pinching = False
        self.pinch_just_engaged = False
        self.pinch_just_released = False
        self._swipe_history.clear()
        self._prev_two_hand_dist = None

    def recognize(self, hands: List[HandTrackingData], timestamp: Optional[float] = None) -> GestureType:
        """Classifies the primary active gesture from detected hand landmarks."""
        now = timestamp if timestamp is not None else time.time()
        self.pinch_just_engaged = False
        self.pinch_just_released = False

        if not hands or len(hands) == 0:
            self.reset()
            return GestureType.IDLE

        # Check for Two-Hand Manipulation first if 2 hands are present
        if len(hands) >= 2:
            h1, h2 = hands[0], hands[1]
            if len(h1.landmarks) >= 21 and len(h2.landmarks) >= 21:
                # Distance between two index tips
                p1 = h1.landmarks[8]
                p2 = h2.landmarks[8]
                dist = euclidean_dist(p1, p2)

                # Check if both hands are pinching or both pointing
                if h1.pinch_distance < self.config.pinch_engage_threshold and \
                   h2.pinch_distance < self.config.pinch_engage_threshold:
                    return GestureType.TWO_HAND_PINCH

        # Primary hand interaction (use first detected hand)
        primary_hand = hands[0]
        if len(primary_hand.landmarks) < 21:
            return GestureType.IDLE

        lm = primary_hand.landmarks
        wrist = lm[0]

        # Finger extension states
        thumb_ext = euclidean_dist(wrist, lm[4]) > euclidean_dist(wrist, lm[2]) * 1.15
        index_ext = is_finger_extended(wrist, lm[5], lm[6], lm[8])
        middle_ext = is_finger_extended(wrist, lm[9], lm[10], lm[12])
        ring_ext = is_finger_extended(wrist, lm[13], lm[14], lm[16])
        pinky_ext = is_finger_extended(wrist, lm[17], lm[18], lm[20])

        # Pinch distance between Thumb tip (4) and Index tip (8)
        pinch_dist = primary_hand.pinch_distance

        # Pinch Hysteresis State Machine
        if not self.is_pinching:
            if pinch_dist < self.config.pinch_engage_threshold:
                self.is_pinching = True
                self.pinch_just_engaged = True
        else:
            if pinch_dist > self.config.pinch_release_threshold:
                self.is_pinching = False
                self.pinch_just_released = True

        # Check Swipe Gestures (active horizontal movement of index tip)
        index_x = lm[8].x
        self._swipe_history.append((index_x, now))
        # Keep 0.3s sliding window
        self._swipe_history = [(x, t) for (x, t) in self._swipe_history if (now - t) <= 0.35]

        detected_swipe = None
        if (now - self._last_swipe_time) > self.config.swipe_cooldown_seconds and len(self._swipe_history) >= 4:
            dx = self._swipe_history[-1][0] - self._swipe_history[0][0]
            dt = self._swipe_history[-1][1] - self._swipe_history[0][1]
            if dt > 0.05:
                velocity = abs(dx) / dt
                if velocity > self.config.swipe_min_velocity and abs(dx) > 0.12:
                    if dx < -0.12:  # Leftward motion in mirrored frame
                        detected_swipe = GestureType.SWIPING_LEFT
                        self._last_swipe_time = now
                        self._swipe_history.clear()
                    elif dx > 0.12:  # Rightward motion
                        detected_swipe = GestureType.SWIPING_RIGHT
                        self._last_swipe_time = now
                        self._swipe_history.clear()

        if detected_swipe is not None:
            return detected_swipe

        # 1. PINCH Gesture
        if self.is_pinching:
            return GestureType.PINCHING

        # 2. OPEN PALM (All 5 extended)
        if index_ext and middle_ext and ring_ext and pinky_ext:
            return GestureType.OPEN_PALM

        # 3. FIST (All curled)
        if (not index_ext) and (not middle_ext) and (not ring_ext) and (not pinky_ext):
            return GestureType.FIST

        # 4. POINT (Index extended, middle/ring/pinky curled)
        if index_ext and (not middle_ext) and (not ring_ext) and (not pinky_ext):
            return GestureType.POINTING

        return GestureType.IDLE
