# Project JARVIS HUD

Project JARVIS HUD is a high-performance Windows desktop holographic interface inspired by the futuristic holographic displays in Iron Man. It uses OpenCV and Google MediaPipe Tasks for real-time webcam hand tracking, coupled with a GPU-accelerated PySide6 rendering engine.

## Features
- **Live Multithreaded Webcam Tracking:** Real-time 30+ FPS hand landmark detection using MediaPipe Tasks HandLandmarker (`hand_landmarker.task`).
- **Cinematic Sci-Fi Hologram Interface:** Procedural rotating concentric rings, targeting reticles, radial progress arcs, glassmorphism panels, and scan sweeps rendered in cyan, electric-blue, and pure white highlights.
- **Natural Gesture Controls:**
  - **Point:** Directs the virtual holographic cursor smoothly across the interface.
  - **Pinch:** Selects and activates HUD interactive buttons with hysteresis anti-chatter.
  - **Open Palm:** Resets or re-centers active virtual elements.
  - **Fist:** Cancels temporary manipulations or locks the active HUD state.
  - **Swipe:** Navigates between HUD modes (Core, Object, Diagnostics, Settings).
  - **Two-Hand Pinch:** Scales and rotates 3D holographic objects.
- **Interactive Holographic Modules:**
  - **System Core:** Rotating reactor telemetry and primary status.
  - **3D Arc Reactor / Object:** Interactive wireframe object manipulable in 3D space with hand gestures.
  - **Diagnostics HUD:** Live frame rate, inference latency, camera resolution, CPU/RAM utilization.
  - **Settings Manager:** Camera device selection, preview mirroring, sensitivity tuning, audio toggles.
- **Audio Feedback System:** Integrated sci-fi sound effects for lock, spawn, assemble, and interaction feedback.

## Requirements
- Windows 10 or 11 (64-bit)
- Python 3.11+
- USB or integrated webcam
- Dependencies: `pip install -r requirements.txt`

## Quickstart

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python main.py
   ```

3. Run automated tests:
   ```bash
   pytest tests/ -v
   ```

## Controls & Keyboard Shortcuts
- **Webcam Hand Gestures:**
  - Move index finger to move the holographic cursor.
  - Pinch thumb and index to click buttons or grab 3D objects.
  - Move two hands closer or farther apart to scale the 3D model.
- **Keyboard Fallback Shortcuts:**
  - `C` / `[` / `]`: **Cycle camera input index** (e.g. Camera 0 -> 1 -> 2 -> 0).
  - `0`, `1`, `2`, `3`: **Direct camera selection** (Camera #0, #1, #2, #3).
  - `Space`: Cycle through HUD modes (Core -> Object -> Diagnostics -> Settings).
  - `M`: Toggle webcam background mirror.
  - `H`: Toggle camera background visibility.
  - `F11`: Toggle fullscreen mode.
  - `Esc` / `Q`: Graceful shutdown.
