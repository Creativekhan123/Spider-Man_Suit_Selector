"""Gesture Routing & Interactive Dispatch Engine
Dispatches detected gestures to HUD interactive elements, panel navigation,
and 3D object manipulations with anti-repetition protection.
"""
from typing import List, Optional, Callable, Dict
import time

from app.state import (
    HandTrackingData, GestureType, HUDMode, VirtualCursorState,
    VirtualObjectState
)
from app.configuration import HUDConfiguration


class GestureRouter:
    """Coordinates gesture inputs with interactive HUD components and virtual objects."""

    def __init__(self, config: Optional[HUDConfiguration] = None):
        self.config = config or HUDConfiguration()
        self.current_mode = HUDMode.CORE
        self.virtual_object = VirtualObjectState()

        # Drag tracking
        self.is_dragging_object: bool = False
        self._last_cursor_x: float = 0.0
        self._last_cursor_y: float = 0.0
        self._last_two_hand_dist: Optional[float] = None

        # Mode list for cyclic swipe navigation
        self.mode_order = [
            HUDMode.CORE,
            HUDMode.OBJECT_3D,
            HUDMode.DIAGNOSTICS,
            HUDMode.SETTINGS
        ]

        # Callbacks
        self.on_mode_changed: Optional[Callable[[HUDMode], None]] = None
        self.on_sound_requested: Optional[Callable[[str], None]] = None

    def cycle_mode(self, direction: int = 1):
        """Cycles between HUD modes (direction: +1 forward, -1 backward)."""
        idx = self.mode_order.index(self.current_mode)
        new_idx = (idx + direction) % len(self.mode_order)
        self.set_mode(self.mode_order[new_idx])

    def set_mode(self, mode: HUDMode):
        """Switches active HUD mode."""
        if self.current_mode != mode:
            self.current_mode = mode
            if self.on_sound_requested:
                self.on_sound_requested("assemble")
            if self.on_mode_changed:
                self.on_mode_changed(self.current_mode)

    def reset_virtual_object(self):
        """Resets the 3D holographic object transform."""
        self.virtual_object = VirtualObjectState()
        if self.on_sound_requested:
            self.on_sound_requested("spawn")

    def process(
        self,
        gesture: GestureType,
        cursor: VirtualCursorState,
        hands: List[HandTrackingData],
        viewport_w: int,
        viewport_h: int
    ):
        """Processes active gestures and updates interaction state."""
        # 1. Handle tracking loss
        if not cursor.is_active:
            self.is_dragging_object = False
            self.virtual_object.is_grabbed = False
            self._last_two_hand_dist = None
            return

        # 2. Swipe Navigation
        if gesture == GestureType.SWIPING_LEFT:
            self.cycle_mode(direction=1)
            return
        elif gesture == GestureType.SWIPING_RIGHT:
            self.cycle_mode(direction=-1)
            return

        # 3. Open Palm (Recenter / Home)
        if gesture == GestureType.OPEN_PALM:
            if self.current_mode == HUDMode.OBJECT_3D:
                self.reset_virtual_object()

        # 4. Fist (Cancel manipulation)
        if gesture == GestureType.FIST:
            self.is_dragging_object = False
            self.virtual_object.is_grabbed = False

        # 5. Two-Hand Pinch (Scale 3D object)
        if gesture == GestureType.TWO_HAND_PINCH and len(hands) >= 2:
            p1 = hands[0].index_tip
            p2 = hands[1].index_tip
            dx = p1[0] - p2[0]
            dy = p1[1] - p2[1]
            dist = (dx * dx + dy * dy) ** 0.5

            if self._last_two_hand_dist is not None:
                delta_scale = (dist - self._last_two_hand_dist) * 2.5
                self.virtual_object.scale = max(0.4, min(3.0, self.virtual_object.scale + delta_scale))

            self._last_two_hand_dist = dist
            return
        else:
            self._last_two_hand_dist = None

        # 6. Object Dragging / Rotation in 3D Mode
        if self.current_mode == HUDMode.OBJECT_3D:
            if cursor.click_just_pressed:
                # Check if cursor is in center interactive area
                cx = viewport_w * 0.5
                cy = viewport_h * 0.5
                dist_to_center = ((cursor.screen_x - cx) ** 2 + (cursor.screen_y - cy) ** 2) ** 0.5
                if dist_to_center < 300:
                    self.is_dragging_object = True
                    self.virtual_object.is_grabbed = True
                    self._last_cursor_x = cursor.screen_x
                    self._last_cursor_y = cursor.screen_y
                    if self.on_sound_requested:
                        self.on_sound_requested("lock")

            elif cursor.is_clicking and self.is_dragging_object:
                dx = cursor.screen_x - self._last_cursor_x
                dy = cursor.screen_y - self._last_cursor_y

                # Rotate object based on hand movement
                self.virtual_object.rotation_y += dx * 0.6
                self.virtual_object.rotation_x -= dy * 0.6

                self._last_cursor_x = cursor.screen_x
                self._last_cursor_y = cursor.screen_y

            elif cursor.click_just_released:
                self.is_dragging_object = False
                self.virtual_object.is_grabbed = False
