/**
 * High-Speed 60 FPS Holographic HUD 2D Overlay Renderer
 * Draws Stark reticles, fingertip lasers, pinch sparks, and energy tethers.
 */
export class OverlayRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.time = 0;
    this.sparks = [];

    window.addEventListener('resize', () => this._onResize());
    this._onResize();
  }

  _onResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  render(gestureState, dragTargetPos, centerTargetPos, hoverTarget) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);
    this.time += 0.03;

    const { hands, isPinched, pinchPos, mode } = gestureState;

    // 1. Draw Hand Skeleton Overlays
    if (hands && hands.length > 0) {
      for (const hand of hands) {
        this._drawHandSkeleton(hand, w, h);
        this._drawFingertipReticle(hand, w, h, isPinched);
      }
    }

    // 2. Draw Pinch Sparks & Electric Arcs
    if (isPinched && pinchPos) {
      const px = pinchPos.x * w;
      const py = pinchPos.y * h;
      this._emitPinchSparks(px, py);
    }
    this._updateAndDrawSparks();

    // 3. Draw Laser Targeting Tether & Lock Reticle when hovering over a 3D Armory suit
    if (hoverTarget && mode !== 'DRAGGING_SUIT') {
      if (hands && hands.length > 0) {
        const primaryHand = hands[0];
        const indexTip = primaryHand[8];
        const ix = indexTip.x * w;
        const iy = indexTip.y * h;
        // Draw Stark laser tether from index fingertip to 3D suit pedestal
        this._drawLaserTether(ix, iy, hoverTarget.x, hoverTarget.y, '#00ffff');
      }
      // Draw Stark lock-on bracket & HUD telemetry on the targeted suit
      this._drawTargetLock(hoverTarget.x, hoverTarget.y, hoverTarget);
    }

    // 4. Draw Dragging Hologram Energy Tether from pinch to target
    if (mode === 'DRAGGING_SUIT' && pinchPos) {
      const startX = pinchPos.x * w;
      const startY = pinchPos.y * h;
      const destX = centerTargetPos ? centerTargetPos.x : (dragTargetPos ? dragTargetPos.x : startX);
      const destY = centerTargetPos ? centerTargetPos.y : (dragTargetPos ? dragTargetPos.y : startY);
      this._drawEnergyTether(startX, startY, destX, destY);

      if (centerTargetPos) {
        this._drawDeploymentReticle(centerTargetPos.x, centerTargetPos.y);
      }
    }
  }

  _drawHandSkeleton(hand, w, h) {
    // Landmark pairs
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [0, 13], [13, 14], [14, 15], [15, 16],// Ring
      [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
      [5, 9], [9, 13], [13, 17]             // Palm
    ];

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
    this.ctx.lineWidth = 1.5;

    for (const [i, j] of connections) {
      const p1 = hand[i];
      const p2 = hand[j];
      if (!p1 || !p2) continue;
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x * w, p1.y * h);
      this.ctx.lineTo(p2.x * w, p2.y * h);
      this.ctx.stroke();
    }

    // Joint Nodes
    for (const lm of hand) {
      this.ctx.beginPath();
      this.ctx.arc(lm.x * w, lm.y * h, 2, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  _drawFingertipReticle(hand, w, h, isPinched) {
    const thumb = hand[4];
    const index = hand[8];
    if (!thumb || !index) return;

    const tx = thumb.x * w;
    const ty = thumb.y * h;
    const ix = index.x * w;
    const iy = index.y * h;

    const cx = (tx + ix) / 2;
    const cy = (ty + iy) / 2;

    this.ctx.save();

    // Line connecting thumb & index tips
    this.ctx.beginPath();
    this.ctx.moveTo(tx, ty);
    this.ctx.lineTo(ix, iy);
    this.ctx.strokeStyle = isPinched ? '#00ffff' : 'rgba(0, 240, 255, 0.4)';
    this.ctx.lineWidth = isPinched ? 2.5 : 1;
    this.ctx.setLineDash(isPinched ? [] : [3, 3]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Rotating Stark Targeting Reticle at pinch center
    const radius = isPinched ? 14 : 22;
    this.ctx.translate(cx, cy);

    // Outer rotating bracket
    this.ctx.save();
    this.ctx.rotate(this.time * 2.5);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 0.4);
    this.ctx.arc(0, 0, radius, Math.PI, Math.PI * 1.4);
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = isPinched ? '#ffffff' : '#00f0ff';
    this.ctx.stroke();
    this.ctx.restore();

    // Inner counter-rotating ring
    this.ctx.save();
    this.ctx.rotate(-this.time * 3.5);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius * 0.65, 0, Math.PI * 1.5);
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    this.ctx.stroke();
    this.ctx.restore();

    // Center Core Dot
    this.ctx.beginPath();
    this.ctx.arc(0, 0, isPinched ? 5 : 3, 0, Math.PI * 2);
    this.ctx.fillStyle = isPinched ? '#ffffff' : '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 10;
    this.ctx.fill();

    // Tech Coordinates readout
    this.ctx.font = '10px "Share Tech Mono", monospace';
    this.ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
    this.ctx.fillText(`X:${Math.round(cx)} Y:${Math.round(cy)}`, 20, -10);
    if (isPinched) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(`[PINCH ACTIVE]`, 20, 4);
    }

    this.ctx.restore();
  }

  _emitPinchSparks(x, y) {
    if (Math.random() < 0.4) {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        this.sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          size: 1.5 + Math.random() * 2.5
        });
      }
    }
  }

  _updateAndDrawSparks() {
    this.ctx.save();
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.05;

      if (s.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 255, 255, ${s.life})`;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 8;
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  _drawEnergyTether(x1, y1, x2, y2) {
    this.ctx.save();
    // Glowing Laser Beam
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);

    // Add energetic lightning jitter
    const segments = 16;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const lx = x1 + (x2 - x1) * t;
      const ly = y1 + (y2 - y1) * t;
      const jitter = (Math.random() - 0.5) * 16 * (1 - Math.abs(t - 0.5) * 2);
      this.ctx.lineTo(lx + jitter, ly + jitter);
    }
    this.ctx.lineTo(x2, y2);

    this.ctx.strokeStyle = '#00ffff';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#00ffff';
    this.ctx.shadowBlur = 15;
    this.ctx.stroke();

    // Pulse core
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.restore();
  }

  _drawLaserTether(x1, y1, x2, y2, color = '#00ffff') {
    this.ctx.save();
    // 1. Core guidance beam line
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 6]);
    this.ctx.lineDashOffset = -this.time * 20;
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 2. High-intensity electric arc lightning tether
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    const segments = 18;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const lx = x1 + (x2 - x1) * t;
      const ly = y1 + (y2 - y1) * t;
      const envelope = Math.sin(t * Math.PI);
      const jitterX = (Math.random() - 0.5) * 14 * envelope;
      const jitterY = (Math.random() - 0.5) * 14 * envelope;
      this.ctx.lineTo(lx + jitterX, ly + jitterY);
    }
    this.ctx.lineTo(x2, y2);

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2.0;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 12;
    this.ctx.stroke();

    // 3. Bright white central laser core
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.0;
    this.ctx.stroke();

    // 4. Moving energy photon packets along the beam
    const pulseT = (this.time * 1.5) % 1.0;
    const px = x1 + (x2 - x1) * pulseT;
    const py = y1 + (y2 - y1) * pulseT;
    this.ctx.beginPath();
    this.ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 10;
    this.ctx.fill();

    this.ctx.restore();
  }

  _drawTargetLock(x, y, target) {
    this.ctx.save();
    this.ctx.translate(x, y);

    const boxSize = 42;
    const bracketLen = 12;

    // 1. Four Corner L-Brackets
    this.ctx.strokeStyle = '#00ffff';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#00ffff';
    this.ctx.shadowBlur = 10;

    // Top-Left
    this.ctx.beginPath();
    this.ctx.moveTo(-boxSize, -boxSize + bracketLen);
    this.ctx.lineTo(-boxSize, -boxSize);
    this.ctx.lineTo(-boxSize + bracketLen, -boxSize);
    this.ctx.stroke();

    // Top-Right
    this.ctx.beginPath();
    this.ctx.moveTo(boxSize - bracketLen, -boxSize);
    this.ctx.lineTo(boxSize, -boxSize);
    this.ctx.lineTo(boxSize, -boxSize + bracketLen);
    this.ctx.stroke();

    // Bottom-Left
    this.ctx.beginPath();
    this.ctx.moveTo(-boxSize, boxSize - bracketLen);
    this.ctx.lineTo(-boxSize, boxSize);
    this.ctx.lineTo(-boxSize + bracketLen, boxSize);
    this.ctx.stroke();

    // Bottom-Right
    this.ctx.beginPath();
    this.ctx.moveTo(boxSize - bracketLen, boxSize);
    this.ctx.lineTo(boxSize, boxSize);
    this.ctx.lineTo(boxSize, boxSize - bracketLen);
    this.ctx.stroke();

    // 2. Rotating target lock reticle ring
    this.ctx.save();
    this.ctx.rotate(this.time * 2.0);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 26, 0, Math.PI * 0.5);
    this.ctx.arc(0, 0, 26, Math.PI, Math.PI * 1.5);
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
    this.ctx.stroke();
    this.ctx.restore();

    // 3. Central pulsing target pip
    const pipScale = Math.sin(this.time * 6.0) * 0.15 + 1.0;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 4 * pipScale, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();

    // 4. Tactical Readout Callout Tag
    this.ctx.font = 'bold 11px "Share Tech Mono", monospace';
    this.ctx.fillStyle = '#00ffff';
    this.ctx.fillText(`[LOCKED: ${target.designation || 'SUIT'}]`, boxSize + 12, -10);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '10px "Inter", sans-serif';
    this.ctx.fillText(target.name ? target.name.toUpperCase() : 'SPIDER-MAN', boxSize + 12, 6);
    this.ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    this.ctx.font = '9px "Share Tech Mono", monospace';
    this.ctx.fillText('PINCH & DRAG TO DEPLOY', boxSize + 12, 20);

    // Connecting callout leader line
    this.ctx.beginPath();
    this.ctx.moveTo(boxSize, 0);
    this.ctx.lineTo(boxSize + 8, -6);
    this.ctx.lineTo(boxSize + 80, -6);
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.restore();
  }

  _drawDeploymentReticle(x, y) {
    this.ctx.save();
    this.ctx.translate(x, y);

    // Rotating deployment dock rings
    this.ctx.save();
    this.ctx.rotate(-this.time * 1.8);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 50, 0, Math.PI * 1.8);
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#00ffff';
    this.ctx.setLineDash([12, 6]);
    this.ctx.stroke();
    this.ctx.restore();

    // Outer bracket ring
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 68, 0, Math.PI * 2);
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    this.ctx.stroke();

    // Center Drop Zone Text
    this.ctx.font = 'bold 10px "Share Tech Mono", monospace';
    this.ctx.fillStyle = '#00ffff';
    this.ctx.textAlign = 'center';
    this.ctx.shadowColor = '#00ffff';
    this.ctx.shadowBlur = 8;
    this.ctx.fillText('RELEASE PINCH TO DEPLOY', 0, 90);

    this.ctx.restore();
  }
}
