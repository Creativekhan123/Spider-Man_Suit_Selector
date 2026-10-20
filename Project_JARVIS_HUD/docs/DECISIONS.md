# Project JARVIS HUD — Architectural & Technical Decisions

## Decision 1: MediaPipe Tasks API (`mediapipe.tasks.vision.HandLandmarker`)
- **Context:** MediaPipe 1.x deprecates legacy `mp.solutions.hands` in favor of the Tasks API using `.task` model bundles.
- **Decision:** Utilize `mediapipe.tasks.python.vision.HandLandmarker` in `RunningMode.VIDEO` mode with the locally stored `assets/models/hand_landmarker.task`.
- **Rationale:** Guarantees forward compatibility, high frame inference throughput on CPU/XNNPACK, and eliminates network dependencies at runtime.

## Decision 2: PySide6 (Qt) for Holographic GUI & Rendering
- **Context:** Need 60 FPS smooth rendering, cross-platform stability, native Windows window management, high-DPI scaling, and rich vector graphic capabilities.
- **Decision:** Use PySide6 with custom `QPainter` drawing, antialiased vectors, semi-transparent layers, and hardware-accelerated composition.
- **Rationale:** PySide6 provides robust multithreading via `QThread` and Qt Signals, crystal-clear typography, and zero overhead compared to heavy 3D game engines.

## Decision 3: Threading Model & Zero Frame Accumulation
- **Context:** Video capture (`cv2.VideoCapture`) and model inference can introduce variable latency (20-40ms). If running on the UI thread, the interface would drop below 30 FPS.
- **Decision:** A worker thread handles camera capture, landmarker inference, and tracking filter smoothing. The UI thread runs a 60 FPS animation timer that composites the latest available frame and updates animations.
- **Rationale:** Even under heavy computational load, the HUD animations, rings, and menus stay silky-smooth at 60 FPS without ever freezing the UI.

## Decision 4: Pinch Hysteresis for Selection
- **Context:** Single-threshold pinch distance causes rapid oscillating clicks ("chatter") when the finger hovers near the threshold.
- **Decision:** Implement a dual-threshold state machine:
  - Engage pinch when normalized thumb-to-index distance < `0.045`.
  - Release pinch only when distance > `0.065`.
  - Trigger one discrete `PINCH_DOWN` event on transition and `PINCH_UP` on release.
- **Rationale:** Completely eliminates unwanted double-clicks or accidental re-activations.
