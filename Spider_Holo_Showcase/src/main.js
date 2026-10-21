import { HoloScene } from './scene/holo_scene.js';
import { HandTracker } from './vision/hand_tracker.js';
import { OverlayRenderer } from './hud/overlay_renderer.js';
import { soundFX } from './audio/sound_fx.js';
import { SUITS_DATABASE } from './scene/model_loader.js';

class HolographicApp {
  constructor() {
    this.threeCanvas = document.getElementById('three-canvas');
    this.bgCanvas = document.getElementById('bg-canvas');
    this.hudCanvas = document.getElementById('hud-canvas');
    this.pipCanvas = document.getElementById('operator-pip-canvas');
    this.videoElement = document.getElementById('webcam');

    this.activeSuitIndex = 0;
    this.draggedSuitCard = null;
    this.draggedSuitConfig = null;

    // Components
    this.holoScene = new HoloScene(this.threeCanvas);
    this.overlayRenderer = new OverlayRenderer(this.hudCanvas);

    this.handTracker = new HandTracker({
      videoElement: this.videoElement,
      bgCanvas: this.bgCanvas,
      pipCanvas: this.pipCanvas,
      onGestureUpdate: (state) => this._onGestureUpdate(state),
      onDragStart: (pos) => this._onHandDragStart(pos),
      onDragMove: (pos, dx, dy) => this._onHandDragMove(pos, dx, dy),
      onDragEnd: (overCenter, pos, isAirClick) => this._onHandDragEnd(overCenter, pos, isAirClick),
      onCenterRotate: (dx, dy) => this._onCenterRotate(dx, dy),
      onCenterZoom: (delta) => this._onCenterZoom(delta)
    });

    this.lastFpsUpdate = performance.now();
    this.frameCount = 0;
    this.currentGestureState = { hands: [], isPinched: false, mode: 'IDLE' };

    this._initUI();
    this._initSuitsRack();
    this._initClock();
    this._startApp();
  }

  async _startApp() {
    // 1. Start Three.js Animation Loop immediately
    this._animationLoop();

    // 2. Start Camera and Hand Tracker FIRST so browser requests permission immediately
    const statusLabel = document.getElementById('gesture-label');
    const camBanner = document.getElementById('cam-permission-banner');

    const urlParams = new URLSearchParams(window.location.search);
    const initialCamIdx = parseInt(urlParams.get('cam') || urlParams.get('camera') || '0', 10);

    const activateCamera = async () => {
      try {
        if (statusLabel) statusLabel.textContent = 'NEURAL TRACKING: INITIALIZING...';
        const cameraOk = await this.handTracker.start(initialCamIdx);
        if (cameraOk) {
          if (statusLabel) statusLabel.textContent = 'NEURAL TRACKING: ACTIVE';
          if (camBanner) camBanner.classList.add('hidden');
          soundFX.playBoot();
          this._updateCameraUI();
          return true;
        } else {
          if (statusLabel) statusLabel.textContent = 'CLICK BANNER TO ALLOW CAMERA';
          return false;
        }
      } catch (err) {
        console.warn('Camera initialization notice:', err);
        if (statusLabel) statusLabel.textContent = 'CLICK BANNER TO ALLOW CAMERA';
        return false;
      }
    };

    if (camBanner) {
      camBanner.addEventListener('click', () => activateCamera());
    }

    await activateCamera();

    // 3. Load Initial Suit (Advanced Suit 2.0)
    try {
      const initialSuit = SUITS_DATABASE[0];
      await this.selectSuit(initialSuit, false);
    } catch (err) {
      console.error('Failed to load initial suit:', err);
    }
  }

  _initUI() {
    // Buttons
    const btnAr = document.getElementById('btn-ar-mode');
    if (btnAr) {
      btnAr.addEventListener('click', () => {
        const isAr = this.handTracker.toggleARMode();
        this.holoScene.setARMode(isAr);
        btnAr.classList.toggle('active', isAr);
        const modeLabel = document.getElementById('ar-mode-label');
        if (modeLabel) modeLabel.textContent = isAr ? 'PASSTHROUGH' : 'LAB WORKSHOP';
        const span = btnAr.querySelector('span:last-child');
        if (span) span.textContent = isAr ? 'CAMERA: AR PASSTHROUGH' : 'CAMERA: LAB WORKSHOP';
        else btnAr.textContent = isAr ? '👁️ AR VIEW' : '🏙️ LAB VIEW';
        soundFX.playHover();
      });
    }

    const btnRender = document.getElementById('btn-render-mode');
    if (btnRender) {
      const modes = ['hologram', 'textured', 'wireframe'];
      let modeIdx = 0;
      btnRender.addEventListener('click', () => {
        modeIdx = (modeIdx + 1) % modes.length;
        const currentMode = modes[modeIdx];
        this.holoScene.setRenderMode(currentMode);
        const span = btnRender.querySelector('span:last-child');
        if (span) span.textContent = `SHADING: ${currentMode.toUpperCase()}`;
        else btnRender.textContent = `✨ ${currentMode.toUpperCase()}`;
        soundFX.playHover();
      });
    }

    const btnAutoRotate = document.getElementById('btn-auto-rotate');
    if (btnAutoRotate) {
      btnAutoRotate.addEventListener('click', () => {
        this.holoScene.autoRotate = !this.holoScene.autoRotate;
        btnAutoRotate.classList.toggle('active', this.holoScene.autoRotate);
        soundFX.playHover();
      });
    }

    const btnReset = document.getElementById('btn-reset-view');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.holoScene.resetTransform();
        soundFX.playWhoosh(0.7);
      });
    }

    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const enabled = soundFX.toggle();
        btnAudio.classList.toggle('active', enabled);
        const span = btnAudio.querySelector('span:last-child');
        if (span) span.textContent = `SOUND FX: ${enabled ? 'ON' : 'OFF'}`;
        else btnAudio.textContent = enabled ? '🔊 AUDIO: ON' : '🔇 AUDIO: OFF';
        if (enabled) soundFX.playHover();
      });
    }

    const btnSwitchCam = document.getElementById('btn-switch-cam');
    if (btnSwitchCam) {
      btnSwitchCam.addEventListener('click', async () => {
        soundFX.playClick();
        const res = await this.handTracker.cycleCamera();
        this._updateCameraUI(res);
      });
    }

    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Modal
    const modalHelp = document.getElementById('modal-help');
    const btnHelp = document.getElementById('btn-help-modal');
    const btnModalClose = document.getElementById('btn-modal-close');
    const btnModalOk = document.getElementById('btn-modal-ok');

    if (btnHelp && modalHelp) {
      btnHelp.addEventListener('click', () => modalHelp.classList.add('open'));
    }
    const closeModal = () => modalHelp && modalHelp.classList.remove('open');
    if (btnModalClose) btnModalClose.addEventListener('click', closeModal);
    if (btnModalOk) btnModalOk.addEventListener('click', closeModal);

    // Mobile / Touch optimizations
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const hintText = document.querySelector('#interaction-hint .hint-text');
    if (hintText && isTouch) {
      hintText.textContent = 'TAP or DRAG suit to swap | SWIPE to rotate 360°';
    }

    const operatorBox = document.getElementById('operator-box');
    const operatorHeader = operatorBox ? operatorBox.querySelector('.box-header') : null;
    if (operatorHeader) {
      operatorHeader.style.cursor = 'pointer';
      operatorHeader.title = 'Click to expand/collapse camera view';
      operatorHeader.addEventListener('click', (e) => {
        if (e.target.closest('#btn-switch-cam')) return;
        operatorBox.classList.toggle('collapsed');
      });
    }
  }

  _updateCameraUI(res) {
    const btn = document.getElementById('btn-switch-cam');
    if (!btn) return;
    const activeIdx = this.handTracker.activeCameraIndex;
    const total = Math.max(1, this.handTracker.videoDevices.length);
    btn.textContent = `📷 CAM [${activeIdx + 1}/${total}]`;
    if (res && res.label) {
      btn.title = `Current Camera: ${res.label} (Click to switch)`;
      const statusLabel = document.getElementById('gesture-label');
      if (statusLabel) {
        statusLabel.textContent = `CAM: ${res.label.substring(0, 24).toUpperCase()}`;
      }
    }
  }

  async switchCamera(index) {
    const res = await this.handTracker.switchCamera(index);
    this._updateCameraUI(res);
    return res;
  }

  async listCameras() {
    return await this.handTracker.getAvailableCameras();
  }

  _initSuitsRack() {
    const container = document.getElementById('lineup-labels-container');
    if (!container) return;
    container.innerHTML = '';

    SUITS_DATABASE.forEach((suit, index) => {
      const item = document.createElement('div');
      const isActive = index === this.activeSuitIndex;
      item.className = `lineup-label-item ${isActive ? 'active-item' : ''}`;
      item.dataset.suitId = suit.id;
      item.dataset.index = index;

      item.innerHTML = `
        <span class="lineup-mk-tag">MK-0${index + 1}</span>
        <span class="lineup-suit-title full-title">${suit.name}</span>
        <span class="lineup-suit-title short-title">${suit.shortName || suit.name}</span>
        <div class="lineup-indicator-bar"></div>
      `;

      item.addEventListener('mouseenter', () => {
        soundFX.playHover();
        if (this.holoScene.suitRack) {
          this.holoScene.suitRack.setHoveredSuit(suit.id);
        }
      });

      item.addEventListener('mouseleave', () => {
        if (this.holoScene.suitRack) {
          this.holoScene.suitRack.setHoveredSuit(null);
        }
      });

      item.addEventListener('click', () => {
        this.selectSuit(suit);
      });

      item.addEventListener('mousedown', (e) => {
        this._startMouseDrag(suit, item, e);
      });

      container.appendChild(item);
    });

    // Also enable direct canvas clicking & dragging on 3D floor models
    this._initCanvasInteraction();
  }

  _initCanvasInteraction() {
    let isMouseDown = false;
    let startX = 0;
    let startY = 0;
    let clickedSuit = null;
    let isDraggingModel = false;
    let isRotatingCenter = false;

    window.addEventListener('pointerdown', (e) => {
      // Ignore if clicking UI buttons/panels
      if (e.target.closest('#hud-overlay button, .panel-box, .lineup-label-item, .hud-header')) {
        return;
      }

      isMouseDown = true;
      startX = e.clientX;
      startY = e.clientY;
      const normX = e.clientX / window.innerWidth;
      const normY = e.clientY / window.innerHeight;

      // Check if clicking a bottom 3D suit on the floor
      const hitSuit = this.holoScene.suitRack ? this.holoScene.suitRack.pickSlot(normX, normY) : null;
      if (hitSuit && normY > 0.60) {
        clickedSuit = hitSuit;
        isDraggingModel = false;
        return;
      }

      // Check if clicking center stage area (to rotate)
      if (normX >= 0.28 && normY < 0.75) {
        isRotatingCenter = true;
      }
    });

    window.addEventListener('pointermove', (e) => {
      const normX = e.clientX / window.innerWidth;
      const normY = e.clientY / window.innerHeight;

      // Hover feedback on bottom 3D suits
      if (!isMouseDown && normY > 0.60 && this.holoScene.suitRack) {
        const hoverSuit = this.holoScene.suitRack.pickSlot(normX, normY);
        this.holoScene.suitRack.setHoveredSuit(hoverSuit ? hoverSuit.id : null);
      }

      if (!isMouseDown) return;

      const dx = (e.clientX - startX) / window.innerWidth;
      const dy = (e.clientY - startY) / window.innerHeight;
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);

      if (clickedSuit && dist > 10 && !isDraggingModel) {
        isDraggingModel = true;
        const item = document.querySelector(`.lineup-label-item[data-suit-id="${clickedSuit.id}"]`);
        this._startMouseDrag(clickedSuit, item, e);
        clickedSuit = null;
      }

      if (isRotatingCenter && !isDraggingModel) {
        this.holoScene.rotateSuit(dx * 4.0, dy * 2.0);
        startX = e.clientX;
        startY = e.clientY;
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (isMouseDown && clickedSuit && !isDraggingModel) {
        // Direct click without drag: immediately deploy suit
        this.selectSuit(clickedSuit);
      }

      isMouseDown = false;
      clickedSuit = null;
      isDraggingModel = false;
      isRotatingCenter = false;
    });

    window.addEventListener('pointercancel', () => {
      isMouseDown = false;
      clickedSuit = null;
      isDraggingModel = false;
      isRotatingCenter = false;
    });
  }

  async selectSuit(suitConfig, playSound = true) {
    this.activeSuitIndex = SUITS_DATABASE.findIndex(s => s.id === suitConfig.id);
    const items = document.querySelectorAll('.lineup-label-item, .dock-slot-card, .suit-card');
    items.forEach(c => {
      const isActive = c.dataset.suitId === suitConfig.id;
      c.classList.toggle('active-item', isActive);
      c.classList.toggle('active-slot', isActive);
      c.classList.toggle('active-suit', isActive);
    });

    this._updateTelemetryUI(suitConfig);
    if (playSound) {
      soundFX.speakSuitDeployment(suitConfig);
    }
    await this.holoScene.setCenterSuit(suitConfig, playSound);
  }

  _updateTelemetryUI(suit) {
    const nameEl = document.getElementById('active-suit-name');
    const desigEl = document.getElementById('active-suit-designation');
    if (nameEl) nameEl.textContent = suit.name;
    if (desigEl) desigEl.textContent = suit.designation;

    // Progress Bars
    const stats = suit.stats || { armor: 90, mobility: 90, nanotech: 80, fluid: 100 };
    this._setBar('bar-armor', 'stat-armor', stats.armor);
    this._setBar('bar-mobility', 'stat-mobility', stats.mobility);
    this._setBar('bar-nanotech', 'stat-nanotech', stats.nanotech);
    this._setBar('bar-fluid', 'stat-fluid', stats.fluid);

    // Abilities
    const abilities = suit.abilities || [];
    for (let i = 0; i < 3; i++) {
      const abEl = document.getElementById(`ability-${i + 1}`);
      if (abEl) {
        abEl.textContent = abilities[i] ? `◈ ${abilities[i]}` : '';
        abEl.style.display = abilities[i] ? 'inline-block' : 'none';
      }
    }
  }

  _setBar(barId, labelId, value) {
    const bar = document.getElementById(barId);
    const label = document.getElementById(labelId);
    if (bar) bar.style.width = `${value}%`;
    if (label) label.textContent = `${value}%`;
  }

  // Hand Tracking Callbacks
  _onGestureUpdate(state) {
    this.currentGestureState = state;
    this.holoScene.isInteracting = state.isPinched;

    const gestureBadge = document.getElementById('gesture-label');
    if (gestureBadge) {
      if (state.hands.length === 0) {
        gestureBadge.textContent = 'TRACKING: SEARCHING';
      } else if (state.mode === 'DRAGGING_SUIT') {
        gestureBadge.textContent = 'STATUS: DRAGGING 3D SUIT';
      } else if (state.mode === 'MANIPULATING_CENTER') {
        gestureBadge.textContent = 'STATUS: 360° INSPECTION';
      } else if (state.isPinched) {
        gestureBadge.textContent = 'STATUS: AIR PINCH ACTIVE';
      } else {
        gestureBadge.textContent = 'STATUS: HAND DETECTED';
      }
    }
  }

  _onHandDragStart(pos) {
    // 0. Priority: If user was already locking onto a suit with the laser tether, grab that suit!
    let targetSuit = null;
    if (this.holoScene.suitRack && this.holoScene.suitRack.hoveredSuitId) {
      targetSuit = SUITS_DATABASE.find(s => s.id === this.holoScene.suitRack.hoveredSuitId);
    }

    // 1. Raycast 3D floor models & screen coordinates
    if (!targetSuit) {
      targetSuit = this.holoScene.suitRack ? this.holoScene.suitRack.pickSlot(pos.x, pos.y) : null;
    }

    // 2. Check minimal lineup labels under hand
    if (!targetSuit) {
      const items = Array.from(document.querySelectorAll('.lineup-label-item'));
      const screenX = pos.x * window.innerWidth;
      const screenY = pos.y * window.innerHeight;
      items.forEach(item => {
        const rect = item.getBoundingClientRect();
        // Allow pinching on label or 200px above it where the 3D model stands
        if (screenX >= (rect.left - 40) && screenX <= (rect.right + 40) && screenY >= (rect.top - 200) && screenY <= rect.bottom + 40) {
          targetSuit = SUITS_DATABASE[parseInt(item.dataset.index, 10)];
        }
      });
    }

    // 3. Fallback based on X when hand is at the bottom or left edge
    if (!targetSuit && SUITS_DATABASE.length > 0) {
      if (pos.x <= 0.22) {
        targetSuit = SUITS_DATABASE[0]; // Advanced Suit 2.0
      } else if (pos.x <= 0.33) {
        targetSuit = SUITS_DATABASE[1]; // Webbed Raimi Suit
      } else if (pos.y > 0.45) {
        const idx = Math.max(0, Math.min(SUITS_DATABASE.length - 1, Math.floor(pos.x * SUITS_DATABASE.length)));
        targetSuit = SUITS_DATABASE[idx];
      }
    }

    if (targetSuit) {
      this.draggedSuitConfig = targetSuit;
      const item = document.querySelector(`.lineup-label-item[data-suit-id="${targetSuit.id}"]`);
      this.draggedSuitCard = item;
      if (item) item.classList.add('dragging');

      soundFX.playPinch();
      this.holoScene.startSuitDrag(targetSuit);

      const dropZone = document.getElementById('pedestal-drop-zone');
      if (dropZone) dropZone.classList.add('active-drag');
    }
  }

  _onHandDragMove(pos, dx, dy) {
    if (this.draggedSuitConfig) {
      this.holoScene.updateSuitDrag(pos.x, pos.y);
    }
  }

  _onHandDragEnd(overCenter, pos, isAirClick) {
    const dropZone = document.getElementById('pedestal-drop-zone');
    if (dropZone) dropZone.classList.remove('active-drag');

    if (this.draggedSuitCard) {
      this.draggedSuitCard.classList.remove('dragging');
    }

    // Should deploy if dropped over center, over stage, pulled upward, or was a direct air-click!
    const shouldDeploy = overCenter || isAirClick || (pos && (pos.y < 0.70 || (pos.x >= 0.35 && pos.y < 0.78)));

    if (shouldDeploy && this.draggedSuitConfig) {
      this.selectSuit(this.draggedSuitConfig);
    }

    this.holoScene.finishSuitDrag(shouldDeploy);
    this.draggedSuitConfig = null;
    this.draggedSuitCard = null;
  }

  _onCenterRotate(dx, dy) {
    this.holoScene.rotateSuit(dx, dy);
  }

  _onCenterZoom(delta) {
    this.holoScene.zoomSuit(delta);
  }

  // Mouse Drag Fallback
  _startMouseDrag(suit, card, startEvent) {
    this.draggedSuitConfig = suit;
    this.draggedSuitCard = card;
    card.classList.add('dragging');
    this.holoScene.startSuitDrag(suit);

    const dropZone = document.getElementById('pedestal-drop-zone');
    if (dropZone) dropZone.classList.add('active-drag');

    const onMouseMove = (e) => {
      const normX = e.clientX / window.innerWidth;
      const normY = e.clientY / window.innerHeight;
      this.holoScene.updateSuitDrag(normX, normY);
    };

    const onMouseUp = (e) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const normX = e.clientX / window.innerWidth;
      const normY = e.clientY / window.innerHeight;
      const overStage = normX >= 0.32 && normY < 0.78;
      if (dropZone) dropZone.classList.remove('active-drag');
      card.classList.remove('dragging');

      if (overStage) {
        this.selectSuit(suit);
      }
      this.holoScene.finishSuitDrag(overStage);
      this.draggedSuitConfig = null;
      this.draggedSuitCard = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  _initClock() {
    const clockEl = document.getElementById('hud-clock');
    const update = () => {
      const d = new Date();
      if (clockEl) {
        clockEl.textContent = d.toTimeString().split(' ')[0];
      }
    };
    setInterval(update, 1000);
    update();
  }

  _animationLoop() {
    requestAnimationFrame(() => this._animationLoop());

    // FPS Counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      const fpsEl = document.getElementById('fps-badge');
      if (fpsEl) fpsEl.querySelector('.badge-text').textContent = `${fps} FPS`;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    // 1. Render 3D Scene
    this.holoScene.render();

    // 2. Render 2D Overlay Reticles & Sparks
    const centerZone = document.getElementById('pedestal-drop-zone');
    const centerRect = centerZone ? centerZone.getBoundingClientRect() : null;
    const centerPos = centerRect ? {
      x: centerRect.left + centerRect.width / 2,
      y: centerRect.top + centerRect.height / 2
    } : null;

    let targetCardPos = null;
    if (this.holoScene.draggedSuitMesh) {
      const p = this.holoScene.draggedSuitMesh.position.clone().project(this.holoScene.camera);
      targetCardPos = {
        x: (p.x + 1) * window.innerWidth / 2,
        y: (-p.y + 1) * window.innerHeight / 2
      };
    } else if (this.draggedSuitCard) {
      const r = this.draggedSuitCard.getBoundingClientRect();
      targetCardPos = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    // 3. Compute Hover Target for Laser Lock-On
    let hoverTarget = null;
    if (this.currentGestureState.hands && this.currentGestureState.hands.length > 0) {
      const primaryHand = this.currentGestureState.hands[0];
      const indexTip = primaryHand[8]; // normalized [0..1, 0..1]
      if (this.holoScene.suitRack && indexTip) {
        const hoveredSuit = this.holoScene.suitRack.pickSlot(indexTip.x, indexTip.y);
        if (hoveredSuit) {
          this.holoScene.suitRack.setHoveredSuit(hoveredSuit.id);
          const screenPos = this.holoScene.suitRack.getSlotScreenPosition(hoveredSuit.id);
          if (screenPos) {
            hoverTarget = {
              x: screenPos.x,
              y: screenPos.y,
              name: hoveredSuit.name,
              designation: hoveredSuit.designation,
              id: hoveredSuit.id
            };
          }
        } else {
          this.holoScene.suitRack.setHoveredSuit(null);
        }
      }
    } else if (this.holoScene.suitRack && this.holoScene.suitRack.hoveredSuitId) {
      const hoveredSuit = SUITS_DATABASE.find(s => s.id === this.holoScene.suitRack.hoveredSuitId);
      const screenPos = this.holoScene.suitRack.getSlotScreenPosition(this.holoScene.suitRack.hoveredSuitId);
      if (hoveredSuit && screenPos) {
        hoverTarget = {
          x: screenPos.x,
          y: screenPos.y,
          name: hoveredSuit.name,
          designation: hoveredSuit.designation,
          id: hoveredSuit.id
        };
      }
    }

    this.overlayRenderer.render(this.currentGestureState, targetCardPos, centerPos, hoverTarget);

  }
}

// Bootstrap on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new HolographicApp();
});
