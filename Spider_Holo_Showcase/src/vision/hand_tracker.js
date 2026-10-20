import { soundFX } from '../audio/sound_fx.js';

export class HandTracker {
  constructor(options = {}) {
    this.videoElement = options.videoElement;
    this.bgCanvas = options.bgCanvas;
    this.pipCanvas = options.pipCanvas;
    this.onGestureUpdate = options.onGestureUpdate || (() => { });
    this.onDragStart = options.onDragStart || (() => { });
    this.onDragMove = options.onDragMove || (() => { });
    this.onDragEnd = options.onDragEnd || (() => { });
    this.onCenterRotate = options.onCenterRotate || (() => { });
    this.onCenterZoom = options.onCenterZoom || (() => { });

    this.bgCtx = this.bgCanvas ? this.bgCanvas.getContext('2d') : null;
    this.pipCtx = this.pipCanvas ? this.pipCanvas.getContext('2d') : null;

    // Gesture State
    this.isPinched = false;
    this.prevPinchPos = null;
    this.currentMode = 'IDLE'; // 'IDLE', 'DRAGGING_SUIT', 'MANIPULATING_CENTER'
    this.activeSuitTarget = null;
    this.lastHandDistance = null;

    this.hands = null;
    this.camera = null;
    this.currentStream = null;
    this.videoDevices = [];
    this.activeCameraIndex = 0;

    this.arPassthroughEnabled = true;
    this.trackedHandsData = [];
  }

  async getAvailableCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter(d => d.kind === 'videoinput');
      return this.videoDevices;
    } catch (e) {
      console.warn('[HandTracker] Failed to enumerate devices:', e);
      return [];
    }
  }

  async start(preferredIndex = 0) {
    try {
      // 1. Initialize MediaPipe Hands
      const HandsClass = window.Hands || (await import('@mediapipe/hands')).Hands;
      this.hands = new HandsClass({
        locateFile: (file) => `/mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65
      });

      this.hands.onResults((results) => this._onResults(results));

      // 2. Discover available cameras
      await this.getAvailableCameras();

      // 3. Start Stream
      await this.switchCamera(preferredIndex);

      return true;
    } catch (err) {
      console.error('[HandTracker] Failed to start camera / MediaPipe:', err);
      return false;
    }
  }

  async switchCamera(indexOrDeviceId) {
    try {
      await this.getAvailableCameras();
      const count = this.videoDevices.length;

      let targetDevice = null;
      let targetIndex = 0;

      if (count > 0) {
        if (typeof indexOrDeviceId === 'number') {
          targetIndex = ((indexOrDeviceId % count) + count) % count;
          targetDevice = this.videoDevices[targetIndex];
        } else if (typeof indexOrDeviceId === 'string') {
          const foundIdx = this.videoDevices.findIndex(d => d.deviceId === indexOrDeviceId);
          if (foundIdx !== -1) {
            targetIndex = foundIdx;
            targetDevice = this.videoDevices[foundIdx];
          } else {
            targetIndex = 0;
            targetDevice = this.videoDevices[0];
          }
        }
      }

      this.activeCameraIndex = targetIndex;
      const deviceId = targetDevice ? targetDevice.deviceId : null;

      // Stop existing tracks cleanly
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(t => t.stop());
        this.currentStream = null;
      }
      if (this.camera && this.camera.stop) {
        try { await this.camera.stop(); } catch (e) { }
      }

      const videoConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };
      if (deviceId) {
        videoConstraints.deviceId = { exact: deviceId };
      } else {
        videoConstraints.facingMode = 'user';
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });

      this.currentStream = stream;
      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      // Refresh camera devices list after permission granted (gives real device labels)
      await this.getAvailableCameras();

      // Start/Restart MediaPipe Camera utility loop
      const CameraClass = window.Camera || (await import('@mediapipe/camera_utils')).Camera;
      this.camera = new CameraClass(this.videoElement, {
        onFrame: async () => {
          if (this.hands) {
            await this.hands.send({ image: this.videoElement });
          }
        },
        width: 1280,
        height: 720
      });
      await this.camera.start();

      const label = (this.videoDevices[targetIndex] && this.videoDevices[targetIndex].label) || `Camera ${targetIndex + 1}`;
      console.log(`[HandTracker] Active Camera Index: ${targetIndex} (${label})`);

      return {
        index: targetIndex,
        total: Math.max(1, this.videoDevices.length),
        label: label,
        deviceId: deviceId
      };
    } catch (err) {
      console.error('[HandTracker] Failed to switch camera stream:', err);
      return null;
    }
  }

  async cycleCamera() {
    await this.getAvailableCameras();
    const count = Math.max(1, this.videoDevices.length);
    const nextIdx = (this.activeCameraIndex + 1) % count;
    return await this.switchCamera(nextIdx);
  }

  _onResults(results) {
    // 1. Draw Live AR Camera Feed onto bg-canvas
    this._renderARCameraBackdrop(results.image);

    // 2. Draw Operator PiP Module
    this._renderOperatorPiP(results.image);

    // 3. Process Hand Landmarks & Gestures
    this.trackedHandsData = [];
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        // Mirror coordinates for intuitive interaction
        const mirroredLandmarks = landmarks.map(lm => ({
          x: 1.0 - lm.x, // Invert X for mirrored interaction
          y: lm.y,
          z: lm.z
        }));
        this.trackedHandsData.push(mirroredLandmarks);
      }

      this._processGestures(this.trackedHandsData);
    } else {
      if (this.isPinched) {
        this._endPinch();
      }
      this.onGestureUpdate({
        hands: [],
        isPinched: false,
        pinchPos: null,
        mode: this.currentMode
      });
    }
  }

  _processGestures(hands) {
    const primaryHand = hands[0];
    const thumbTip = primaryHand[4];
    const indexTip = primaryHand[8];
    const wrist = primaryHand[0];

    // Calculate pinch distance between Thumb tip & Index tip
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = thumbTip.z - indexTip.z;
    const pinchDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const pinchThreshold = 0.058;
    const isNowPinched = pinchDist < pinchThreshold;

    const pinchCenter = {
      x: (thumbTip.x + indexTip.x) / 2,
      y: (thumbTip.y + indexTip.y) / 2
    };

    // Zoom calculation:
    // Option A: Two-hand pinch-to-zoom (both hands visible)
    if (hands.length >= 2) {
      const hand1 = hands[0][8]; // index tip 1
      const hand2 = hands[1][8]; // index tip 2
      const twoHandDist = Math.hypot(hand1.x - hand2.x, hand1.y - hand2.y);
      if (this.lastTwoHandDist !== null) {
        const deltaDist = twoHandDist - this.lastTwoHandDist;
        if (Math.abs(deltaDist) > 0.008) {
          this.onCenterZoom(deltaDist * 3.2);
        }
      }
      this.lastTwoHandDist = twoHandDist;
    } else {
      this.lastTwoHandDist = null;
      // Option B: Single-hand depth zoom when manipulating center
      const handSpan = Math.hypot(wrist.x - indexTip.x, wrist.y - indexTip.y);
      if (this.lastHandDistance !== null && isNowPinched && this.currentMode === 'MANIPULATING_CENTER') {
        const deltaSpan = handSpan - this.lastHandDistance;
        if (Math.abs(deltaSpan) > 0.012) {
          this.onCenterZoom(deltaSpan * 2.8);
        }
      }
      this.lastHandDistance = handSpan;
    }

    // Transition Pinch State
    if (isNowPinched && !this.isPinched) {
      this._startPinch(pinchCenter);
    } else if (isNowPinched && this.isPinched) {
      this._movePinch(pinchCenter);
    } else if (!isNowPinched && this.isPinched) {
      this._endPinch();
    }

    this.onGestureUpdate({
      hands,
      isPinched: this.isPinched,
      pinchPos: this.isPinched ? pinchCenter : { x: indexTip.x, y: indexTip.y },
      pinchProgress: Math.min(1.0, (pinchThreshold * 1.8) / (pinchDist + 0.001)),
      mode: this.currentMode,
      activeSuitTarget: this.activeSuitTarget
    });
  }

  _startPinch(pos) {
    this.isPinched = true;
    this.prevPinchPos = { ...pos };
    this.pinchStartPos = { ...pos };
    this.pinchStartTime = performance.now();
    soundFX.playPinch();

    // Check if pinch started over the bottom suit lineup (Y > 0.48 or left half X < 0.32)
    if (pos.y > 0.48 || pos.x < 0.32) {
      this.currentMode = 'DRAGGING_SUIT';
      this.onDragStart(pos);
    } else {
      // Pinch started in center-right inspection stage -> Rotate 360°
      this.currentMode = 'MANIPULATING_CENTER';
    }
  }

  _movePinch(pos) {
    if (!this.prevPinchPos) {
      this.prevPinchPos = { ...pos };
      return;
    }

    const deltaX = pos.x - this.prevPinchPos.x;
    const deltaY = pos.y - this.prevPinchPos.y;

    if (this.currentMode === 'DRAGGING_SUIT') {
      this.onDragMove(pos, deltaX, deltaY);
    } else if (this.currentMode === 'MANIPULATING_CENTER') {
      this.onCenterRotate(deltaX, deltaY);
    }

    this.prevPinchPos = { ...pos };
  }

  _endPinch() {
    this.isPinched = false;
    soundFX.playRelease();

    if (this.currentMode === 'DRAGGING_SUIT') {
      const now = performance.now();
      const pinchDuration = now - (this.pinchStartTime || now);
      const moveDist = this.pinchStartPos ? Math.hypot(this.prevPinchPos.x - this.pinchStartPos.x, this.prevPinchPos.y - this.pinchStartPos.y) : 0;

      // Air-click / Tap on suit: quick pinch (< 750ms) without large drag (< 0.12)
      const isAirClick = (pinchDuration < 750 && moveDist < 0.12);

      // Or dragged towards center stage or pulled upward
      const wasOverCenter = (this.prevPinchPos && (
        (this.prevPinchPos.x >= 0.35 && this.prevPinchPos.y < 0.78) ||
        this.prevPinchPos.y < 0.68
      ));

      this.onDragEnd(wasOverCenter || isAirClick, this.prevPinchPos, isAirClick);
    }

    this.currentMode = 'IDLE';
    this.prevPinchPos = null;
    this.pinchStartPos = null;
  }

  _renderARCameraBackdrop(image) {
    if (!this.bgCanvas || !this.bgCtx) return;

    const w = this.bgCanvas.width = window.innerWidth;
    const h = this.bgCanvas.height = window.innerHeight;

    if (!this.arPassthroughEnabled) {
      // Pure dark sci-fi lab mode
      this.bgCtx.fillStyle = '#020610';
      this.bgCtx.fillRect(0, 0, w, h);
      return;
    }

    this.bgCtx.save();
    // Mirror camera feed
    this.bgCtx.translate(w, 0);
    this.bgCtx.scale(-1, 1);

    // Draw camera image with cover aspect ratio
    const videoAspect = image.width / image.height;
    const screenAspect = w / h;
    let drawW = w;
    let drawH = h;
    let offsetX = 0;
    let offsetY = 0;

    if (screenAspect > videoAspect) {
      drawH = w / videoAspect;
      offsetY = (h - drawH) / 2;
    } else {
      drawW = h * videoAspect;
      offsetX = (w - drawW) / 2;
    }

    this.bgCtx.drawImage(image, offsetX, offsetY, drawW, drawH);
    this.bgCtx.restore();

    // Cinematic Stark Post-Color Grade
    // 1. Dark Vignette & Sci-Fi Tint
    const gradient = this.bgCtx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.85);
    gradient.addColorStop(0, 'rgba(2, 8, 20, 0.40)');
    gradient.addColorStop(0.65, 'rgba(2, 8, 20, 0.68)');
    gradient.addColorStop(1, 'rgba(1, 4, 10, 0.92)');

    this.bgCtx.fillStyle = gradient;
    this.bgCtx.fillRect(0, 0, w, h);

    // 2. AR Ground Perspective Grid Projection (Blends real room floor with 3D Holograms)
    this.bgCtx.save();
    const horizonY = h * 0.54;
    const vpX = w * 0.5;

    // Horizon line
    this.bgCtx.beginPath();
    this.bgCtx.moveTo(w * 0.15, horizonY);
    this.bgCtx.lineTo(w * 0.85, horizonY);
    this.bgCtx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
    this.bgCtx.lineWidth = 1;
    this.bgCtx.setLineDash([12, 10]);
    this.bgCtx.stroke();
    this.bgCtx.setLineDash([]);

    // Perspective floor rays spreading outward
    const rayCount = 14;
    this.bgCtx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    this.bgCtx.lineWidth = 1;
    for (let i = 0; i <= rayCount; i++) {
      const bottomX = (w * (i / rayCount) - vpX) * 2.2 + vpX;
      this.bgCtx.beginPath();
      this.bgCtx.moveTo(vpX + (bottomX - vpX) * 0.15, horizonY);
      this.bgCtx.lineTo(bottomX, h);
      this.bgCtx.stroke();
    }

    // Horizontal floor depth crossbars
    const depths = [0.15, 0.32, 0.52, 0.74, 1.0];
    for (const d of depths) {
      const y = horizonY + (h - horizonY) * (d * d);
      this.bgCtx.beginPath();
      this.bgCtx.moveTo(0, y);
      this.bgCtx.lineTo(w, y);
      this.bgCtx.strokeStyle = `rgba(0, 240, 255, ${0.06 + d * 0.14})`;
      this.bgCtx.stroke();
    }
    this.bgCtx.restore();

    // 3. Holographic Room LiDAR Scanner Sweep
    const now = performance.now();
    const scanProgress = (now / 4000) % 1.0;
    const scanY = h * scanProgress;
    const scanGrad = this.bgCtx.createLinearGradient(0, scanY - 35, 0, scanY + 10);
    scanGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
    scanGrad.addColorStop(0.85, 'rgba(0, 240, 255, 0.08)');
    scanGrad.addColorStop(1, 'rgba(0, 240, 255, 0.28)');
    this.bgCtx.fillStyle = scanGrad;
    this.bgCtx.fillRect(0, scanY - 35, w, 45);

    // 4. Subtle Micro Scanlines
    this.bgCtx.fillStyle = 'rgba(0, 240, 255, 0.022)';
    for (let y = 0; y < h; y += 4) {
      this.bgCtx.fillRect(0, y, w, 1);
    }
  }

  _renderOperatorPiP(image) {
    if (!this.pipCanvas || !this.pipCtx) return;
    const pw = this.pipCanvas.width = 640;
    const ph = this.pipCanvas.height = 360;

    this.pipCtx.save();
    // Draw mirrored crop
    this.pipCtx.translate(pw, 0);
    this.pipCtx.scale(-1, 1);
    this.pipCtx.drawImage(image, 0, 0, pw, ph);
    this.pipCtx.restore();

    // High-tech blue scan tint on PiP
    this.pipCtx.fillStyle = 'rgba(0, 160, 255, 0.12)';
    this.pipCtx.fillRect(0, 0, pw, ph);

    // Operator PiP Cybernetic HUD Overlays
    this.pipCtx.save();
    // Tactical Corner L-Brackets
    const margin = 14;
    const bracket = 20;
    this.pipCtx.strokeStyle = '#00f0ff';
    this.pipCtx.lineWidth = 2;

    // Top-Left
    this.pipCtx.beginPath();
    this.pipCtx.moveTo(margin, margin + bracket);
    this.pipCtx.lineTo(margin, margin);
    this.pipCtx.lineTo(margin + bracket, margin);
    this.pipCtx.stroke();

    // Top-Right
    this.pipCtx.beginPath();
    this.pipCtx.moveTo(pw - margin - bracket, margin);
    this.pipCtx.lineTo(pw - margin, margin);
    this.pipCtx.lineTo(pw - margin, margin + bracket);
    this.pipCtx.stroke();

    // Bottom-Left
    this.pipCtx.beginPath();
    this.pipCtx.moveTo(margin, ph - margin - bracket);
    this.pipCtx.lineTo(margin, ph - margin);
    this.pipCtx.lineTo(margin + bracket, ph - margin);
    this.pipCtx.stroke();

    // Bottom-Right
    this.pipCtx.beginPath();
    this.pipCtx.moveTo(pw - margin - bracket, ph - margin);
    this.pipCtx.lineTo(pw - margin, ph - margin);
    this.pipCtx.lineTo(pw - margin, ph - margin - bracket);
    this.pipCtx.stroke();

    // Live Feed Tag & Blinking Rec Dot
    const blink = Math.sin(performance.now() / 250) > 0;
    this.pipCtx.beginPath();
    this.pipCtx.arc(margin + 12, margin + 14, 4.5, 0, Math.PI * 2);
    this.pipCtx.fillStyle = blink ? '#ff2244' : '#660011';
    this.pipCtx.fill();

    this.pipCtx.font = 'bold 11px "Share Tech Mono", monospace';
    this.pipCtx.fillStyle = '#00f0ff';
    this.pipCtx.fillText('LIVE OPERATOR CAM // AR SYNCED', margin + 24, margin + 18);

    // Bottom tracking confidence telemetry
    this.pipCtx.font = '10px "Share Tech Mono", monospace';
    this.pipCtx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    this.pipCtx.fillText('GESTURE TRACKING: 60 FPS // CALIBRATED', margin + 4, ph - margin - 6);

    this.pipCtx.restore();
  }

  toggleARMode(force) {
    this.arPassthroughEnabled = force !== undefined ? force : !this.arPassthroughEnabled;
    return this.arPassthroughEnabled;
  }
}
