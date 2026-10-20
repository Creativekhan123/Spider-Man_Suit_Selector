# Spider-Man_Suit_Selector
### 🕷️ STARK INDUSTRIES // HOLOTABLE MK-85 ARMORY PROTOCOL
**Next-Generation Holographic AR 3D Spider-Man Suit Selector with Air-Touch Hand Gesture Tracking & J.A.R.V.I.S. A.I. Speech**

---

## ⚡ Overview
**Spider-Man Suit Selector** is an interactive, browser-based 3D holographic armory experience inspired by Tony Stark's Holotable from *Avengers: Endgame* and *Spider-Man: Homecoming*. 

Using your computer webcam and machine learning computer vision (MediaPipe Hands), you can control and select 3D Spider-Man suits in mid-air using hand gestures:
- **Index Finger Laser Lock-On:** Point at any 3D Spider-Man suit on the bottom deck to lock on with a holographic electric laser tether and Stark targeting brackets.
- **Air-Touch Pinch & Drag:** Pinch your thumb and index finger together to grab any suit and drag it to the center holographic stage.
- **360° Free Hologram Inspection:** Rotate the center Spider-Man suit 360° horizontally and vertically with your hand.
- **Two-Hand Pinch-to-Zoom:** Zoom in to inspect micro-webbing and suit textures or zoom out for a full silhouette view.
- **Rotating Arc-Reactor Spider Floor Projector:** Counter-rotating Stark Spider-Man emblem projected onto the floor pedestal.
- **J.A.R.V.I.S. / Karen A.I. Voice Announcements:** Real-time tactical voice confirmations upon suit deployment.
- **Cinematic AR Room Passthrough:** Blend the 3D hologram directly into your physical room with projected ground LiDAR perspective grids and an enlarged Operator Camera feed.

---

## 🎮 Hand Gesture Controls

| Gesture | Action | Visual HUD Feedback |
|---|---|---|
| 👆 **Hover / Point** | Target Bottom Suit | Holographic Laser Tether + Stark Corner Lock `[- -]` |
| 🤏 **Pinch (Thumb + Index)** | Grab & Drag Suit | Electric Plasma Beam + Center Deployment Reticle |
| ✊ **Pinch & Move (Center Stage)** | 360° Free Rotation | Center Holographic Ring Spin |
| 👐 **Two Hands Pinch & Spread** | Zoom In / Out | Telemetry Zoom Readout |
| 🖱️ **Mouse Fallback** | Click / Drag / Scroll | Full desktop mouse controls supported |

---

## 🕷️ Available Spider-Man 3D Suits

1. **Advanced Suit 2.0 (MK-01)** – *Marvel's Spider-Man 2 (Earth-1048)*
2. **Webbed Raimi Suit (MK-02)** – *Spider-Man 2002 (Classic Webbing)*
3. **Stealth "Night Monkey" Suit (MK-03)** – *Spider-Man: Far From Home*
4. **Stark Enhanced Suit (MK-04)** – *Spider-Man: Homecoming (Karen Protocol)*
5. **Iron Spider MK-I (MK-05)** – *Avengers: Infinity War (Waldo Arms Ready)*
6. **Vintage Ditko Comic Suit (MK-06)** – *Earth-616 Classic Cel-Shading*
7. **Integrated Nanotech Suit (MK-07)** – *Spider-Man: No Way Home (Gold Infiltration)*

---

## 🚀 Quick Start Guide

### Option 1: One-Click Run (Windows)
Double-click `run_showcase.bat` in the root folder. It will automatically start the local server and open the showcase in your default browser.

### Option 2: Manual Start
```bash
# Navigate to the showcase web application
cd Spider_Holo_Showcase

# Install dependencies
npm install

# Start development server
npm run dev
```
Open **`http://localhost:5173/`** in Chrome, Edge, or any WebGL2-enabled browser.

---

## 🛠️ Tech Stack
- **3D Graphics Engine:** Three.js (WebGL, ACESFilmicToneMapping, UnrealBloomPass)
- **Computer Vision & Tracking:** MediaPipe Hands 0.4, MediaPipe Camera Utils
- **Frontend & Bundling:** Vite, Vanilla ES Modules, Vanilla CSS (Glassmorphism & Sci-Fi HUD)
- **Audio Synthesizer:** Web Audio API (procedural UI sound effects)
- **A.I. Voice Engine:** Web Speech API (`SpeechSynthesis`)

---

## 📜 License
Personal and showcase portfolio project. Spider-Man and Stark Industries are trademarks of Marvel Entertainment, LLC & Sony Interactive Entertainment.
