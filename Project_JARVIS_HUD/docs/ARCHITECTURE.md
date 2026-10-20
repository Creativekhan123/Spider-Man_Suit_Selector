# Project JARVIS HUD — Architecture Specification

## 1. System Overview
Project JARVIS HUD is a high-performance Windows desktop application delivering a real-time, gesture-controlled holographic HUD interface inspired by Iron Man.

The architecture strictly decouples:
- **Vision & Hardware Capture**: Multithreaded OpenCV camera capture and MediaPipe Tasks Hand Landmarker inference.
- **Signal Processing & Interaction Engine**: Temporal smoothing (EMA / 1-Euro filter), geometric gesture classification, hysteresis state transitions, and virtual cursor mapping.
- **Rendering & UI Presentation**: PySide6 (Qt) high-framerate custom rendering engine using double-buffered QPainter, hardware-accelerated canvas, procedural sci-fi vectors, concentric rings, diagnostics, and interactive holographic panels.

## 2. Directory Layout & Module Responsibilities

```text
Project_JARVIS_HUD/
├── main.py                     # Entry point, CLI flags, runtime orchestration
├── requirements.txt            # Pinned dependency definitions
├── README.md                   # Quickstart, setup, usage instructions
├── assets/
│   ├── models/                 # MediaPipe task models (hand_landmarker.task)
│   ├── sounds/                 # UI feedback audio cues (wav)
│   ├── icons/                  # Vector / HUD iconography
│   └── fonts/                  # Custom sci-fi HUD typography
├── app/
│   ├── application.py          # Application lifecycle and Qt QApplication setup
│   ├── configuration.py        # Settings management, JSON persistence, validation
│   └── state.py                # Thread-safe global application state
├── camera/
│   ├── camera_manager.py       # Camera device detection, enumeration, fallback, capture loop
│   └── frame_processor.py      # OpenCV to Qt QImage conversion, mirroring, timestamping
├── vision/
│   ├── hand_tracker.py         # MediaPipe Tasks HandLandmarker wrapper (VIDEO running mode)
│   ├── gesture_recognizer.py   # Normalized geometric gesture classification & hysteresis
│   └── tracking_filter.py      # Exponential Moving Average (EMA) and 1-Euro temporal smoothing
├── interaction/
│   ├── cursor_controller.py    # Screen coordinate mapping, sensitivity, deadband & bounds
│   ├── gesture_router.py       # Gesture event dispatch to UI interactive controls
│   └── interaction_state.py    # Finite State Machine (IDLE, POINTING, PINCHING, etc.)
├── hud/
│   ├── main_window.py          # PySide6 main HUD window, overlay layout, window controls
│   ├── hud_renderer.py         # Procedural holographic graphics (concentric rings, reticles)
│   ├── panel_manager.py        # Holographic modules (Core, Diagnostics, Object, Settings)
│   └── effects.py              # Glow, scanline, radial sweep, audio feedback triggers
├── services/
│   ├── command_service.py      # Allowlisted command execution registry
│   └── voice_service.py        # Optional speech/voice command interface
├── tests/
│   ├── test_gestures.py        # Synthetic landmark gesture classification tests
│   ├── test_tracking_filter.py # Filter smoothing and jitter rejection tests
│   ├── test_cursor_mapping.py  # Coordinate mapping and boundary tests
│   ├── test_interaction.py     # State machine transition and click triggering tests
│   └── test_state.py           # Configuration and state integrity tests
└── docs/
    ├── ARCHITECTURE.md
    ├── IMPLEMENTATION_PLAN.md
    ├── TESTING.md
    └── DECISIONS.md
```

## 3. Data Flow Pipeline

```
[Webcam (OpenCV Thread)]
        │ (Raw BGR frame, timestamp_ms)
        ▼
[CameraWorker Thread] ──► [MediaPipe HandLandmarker (VIDEO mode)]
        │                                  │
        │ (QImage / Frame)                 ▼ (Raw Normalized Landmarks)
        │                         [TrackingFilter (EMA/1-Euro)]
        │                                  │
        │                                  ▼ (Smoothed 3D Landmarks)
        │                         [GestureRecognizer]
        │                                  │
        │                                  ▼ (Gesture & Confidence)
        │                         [InteractionStateMachine]
        │                                  │
        ▼ (Qt Signal: Frame + InteractionPayload)
[Main UI Thread (PySide6)]
        │
        ├─► [CursorController] ──► Updates virtual cursor (x, y)
        ├─► [PanelManager]     ──► Handles hit-testing, clicks, drags
        └─► [HUDRenderer]      ──► Renders composite holographic display @ 60 FPS
```

## 4. Concurrency & Thread Safety
- **Zero UI-Thread Blocking**: Camera I/O (`cv2.VideoCapture.read()`) and model inference (`detect_for_video()`) execute entirely in a dedicated `QThread` (`CameraWorker`).
- **Backlog Dropping**: To prevent latency accumulation, if the UI thread or tracker falls behind, stale frames are discarded, guaranteeing <100ms real-time latency.
- **Thread Communication**: All data handoffs from the worker thread to the UI thread occur strictly via Qt Signals (`pyqtSignal` / `Signal`) passing immutable dataclass copies (`FrameData`, `TrackingResult`).
