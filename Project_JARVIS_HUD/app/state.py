"""Thread-Safe Application State Definitions
Data structures and tracking state representations for Project JARVIS HUD.
"""
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import List, Tuple, Optional, Dict, Any
import time


class CameraState(str, Enum):
    CAMERA_OFFLINE = "CAMERA OFFLINE"
    CAMERA_CONNECTING = "CAMERA CONNECTING"
    CAMERA_READY = "CAMERA READY"
    SEARCHING_FOR_HAND = "SEARCHING FOR HAND"
    HAND_TRACKED = "HAND TRACKED"
    TRACKING_UNSTABLE = "TRACKING UNSTABLE"


class GestureType(str, Enum):
    IDLE = "IDLE"
    POINTING = "POINTING"
    PINCHING = "PINCHING"
    OPEN_PALM = "OPEN PALM"
    FIST = "FIST"
    SWIPING_LEFT = "SWIPE LEFT"
    SWIPING_RIGHT = "SWIPE RIGHT"
    TWO_HAND_PINCH = "TWO HAND PINCH"


class HUDMode(str, Enum):
    CORE = "SYSTEM CORE"
    OBJECT_3D = "VIRTUAL OBJECT"
    DIAGNOSTICS = "DIAGNOSTICS"
    SETTINGS = "SETTINGS"


@dataclass
class Landmark3D:
    x: float
    y: float
    z: float


@dataclass
class HandTrackingData:
    handedness: str  # "Left" or "Right"
    landmarks: List[Landmark3D] = field(default_factory=list)
    confidence: float = 0.0
    index_tip: Tuple[float, float, float] = (0.5, 0.5, 0.0)
    thumb_tip: Tuple[float, float, float] = (0.5, 0.5, 0.0)
    wrist: Tuple[float, float, float] = (0.5, 0.5, 0.0)
    pinch_distance: float = 1.0
    is_pinching: bool = False
    gesture: GestureType = GestureType.IDLE


@dataclass
class VirtualObjectState:
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    rotation_x: float = 20.0
    rotation_y: float = 30.0
    rotation_z: float = 0.0
    scale: float = 1.0
    is_grabbed: bool = False
    core_glow_pulse: float = 1.0


@dataclass
class SystemTelemetry:
    camera_fps: float = 0.0
    render_fps: float = 0.0
    inference_time_ms: float = 0.0
    total_frame_latency_ms: float = 0.0
    cpu_percent: float = 0.0
    ram_percent: float = 0.0
    active_camera_name: str = "Default Camera"
    frame_width: int = 1280
    frame_height: int = 720
    hands_detected: int = 0
    timestamp: float = field(default_factory=time.time)


@dataclass
class VirtualCursorState:
    norm_x: float = 0.5
    norm_y: float = 0.5
    screen_x: float = 0.0
    screen_y: float = 0.0
    is_active: bool = False
    is_clicking: bool = False
    click_just_pressed: bool = False
    click_just_released: bool = False
