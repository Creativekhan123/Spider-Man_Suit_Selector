import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { HologramPedestal } from './pedestal.js';
import { ModelLoader, SUITS_DATABASE } from './model_loader.js';
import { SuitRack3D } from './suit_rack_3d.js';
import { soundFX } from '../audio/sound_fx.js';

window.THREE = THREE;

export class HoloScene {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.modelLoader = new ModelLoader();

    this.renderMode = 'hologram'; // 'hologram', 'textured', 'wireframe'
    this.autoRotate = true;

    // 3D Objects
    this.centerStageGroup = new THREE.Group();
    this.activeSuit = null;
    this.outgoingSuit = null;
    this.draggedSuitMesh = null;
    this.draggedSuitConfig = null;

    // Smooth transform targets
    this.targetRotationY = 0;
    this.currentRotationY = 0;
    this.targetRotationX = 0;
    this.currentRotationX = 0;
    this.targetZoom = 1.0;
    this.currentZoom = 1.0;

    this.clock = new THREE.Clock();

    this._initThree();
    this._initLighting();
    this._initEnvironment();
    this._initPostprocessing();

    window.addEventListener('resize', () => this._onResize());
    this._onResize();
  }

  _initThree() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true, // Transparent for AR camera pass-through!
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.scene = new THREE.Scene();
    // Subtle sci-fi lab fog
    this.scene.fog = new THREE.FogExp2(0x020814, 0.04);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0.1, 1.45, 5.0);
    this.camera.lookAt(0.15, 1.25, 0);

    // Main 3D Hologram Stage shifted to Center-Right
    this.centerStageGroup.position.set(1.15, 0, 0);
    this.scene.add(this.centerStageGroup);

    // Add Center Pedestal
    this.pedestal = new HologramPedestal(1.6);
    this.centerStageGroup.add(this.pedestal.group);

    // Add 3D Spider-Man Armory Vault Rack (Horizontal Bottom Dock)
    this.suitRack = new SuitRack3D(this.scene, this.camera, this.modelLoader);
  }


  _initLighting() {
    // Ambient cybernetic glow
    const ambientLight = new THREE.AmbientLight(0x102540, 1.4);
    this.scene.add(ambientLight);

    // Front key light (cool white to keep suit textures & webbing crisp and natural)
    const keyLight = new THREE.DirectionalLight(0xf2f7ff, 2.2);
    keyLight.position.set(1.5, 3.8, 4.0);
    this.scene.add(keyLight);

    // Electric cyan rim backlight (contours the silhouette like Image 2)
    const rimLight = new THREE.DirectionalLight(0x00f0ff, 2.8);
    rimLight.position.set(-2.5, 3.0, -1.8);
    this.scene.add(rimLight);

    // Deep blue side fill
    const fillLight = new THREE.DirectionalLight(0x0066cc, 1.6);
    fillLight.position.set(3.0, 2.0, -1.0);
    this.scene.add(fillLight);

    // Floor pedestal up-light
    const floorLight = new THREE.PointLight(0x00f0ff, 1.5, 6);
    floorLight.position.set(1.15, 0.1, 0);
    this.scene.add(floorLight);
  }

  _initEnvironment() {
    // High-tech floor grid plane
    const gridHelper = new THREE.GridHelper(20, 40, 0x00f0ff, 0x003366);
    gridHelper.position.y = 0;
    gridHelper.material.opacity = 0.35;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);

    // Dark reflective ground plane
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    this.floorMat = new THREE.MeshBasicMaterial({
      color: 0x01050d,
      transparent: true,
      opacity: 0.35 // Crisp visibility of real room in AR passthrough!
    });
    const floor = new THREE.Mesh(floorGeo, this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    this.scene.add(floor);
  }

  setARMode(isAr) {
    if (this.floorMat) {
      this.floorMat.opacity = isAr ? 0.30 : 0.85;
    }
  }

  _initPostprocessing() {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Cinematic UnrealBloom tuned to bloom glowing eyes, emblem & floor rings without blurring suit textures
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.35, // bloom strength (was 0.55)
      0.25, // bloom radius (was 0.35)
      0.82  // bloom threshold (was 0.65 - prevents overblown silhouettes!)
    );
    this.composer.addPass(this.bloomPass);
  }

  async setCenterSuit(suitConfig, animate = true) {
    if (this.activeSuit && this.activeSuit.userData.suitId === suitConfig.id) {
      return; // Already active
    }

    if (animate) {
      soundFX.playDock();
      this.pedestal.triggerShockwave();
    }

    // Outgoing animation: shrink and glide back
    if (this.activeSuit && animate) {
      this.outgoingSuit = this.activeSuit;
      this.outgoingSuitAnimTime = 0;
      this.outgoingSuitStartPos = this.outgoingSuit.position.clone();
      this.outgoingSuitStartScale = this.outgoingSuit.scale.clone();
    } else if (this.activeSuit) {
      this.centerStageGroup.remove(this.activeSuit);
      this.activeSuit = null;
    }

    // Load new model
    const newModel = await this.modelLoader.loadSuit(suitConfig);
    newModel.userData.suitId = suitConfig.id;
    newModel.userData.suitConfig = suitConfig;

    // Apply current render mode
    this.modelLoader.applyRenderMode(newModel, this.renderMode);

    newModel.position.set(0, 0, 0);
    if (animate) {
      newModel.scale.set(0.1, 0.1, 0.1);
      this.activeSuitEntranceTime = 0;
    } else {
      newModel.scale.set(this.currentZoom, this.currentZoom, this.currentZoom);
      this.activeSuitEntranceTime = 1.0;
    }
    this.centerStageGroup.add(newModel);

    this.activeSuit = newModel;

    // Reset rotation target to front
    this.targetRotationY = 0;
    this.targetRotationX = 0;

    // Highlight in 3D Armory Rack
    if (this.suitRack) {
      this.suitRack.setActiveSuit(suitConfig.id);
    }
  }

  /**
   * Called when hand starts dragging a suit (from 3D rack or UI)
   */
  async startSuitDrag(suitConfig) {
    if (this.draggedSuitMesh) {
      this.scene.remove(this.draggedSuitMesh);
      this.draggedSuitMesh = null;
    }

    this.draggedSuitConfig = suitConfig;

    try {
      const baseModel = await this.modelLoader.loadSuit(suitConfig);
      const dragClone = skeletonClone(baseModel);
      dragClone.scale.set(0.22, 0.22, 0.22);
      this.scene.add(dragClone);
      this.draggedSuitMesh = dragClone;
    } catch (err) {
      const geo = new THREE.IcosahedronGeometry(0.35, 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      this.draggedSuitMesh = new THREE.Mesh(geo, mat);
      this.scene.add(this.draggedSuitMesh);
    }
  }

  /**
   * Updates 3D position of dragged suit using 2D screen coordinates (normalized 0 to 1)
   */
  updateSuitDrag(normX, normY) {
    if (!this.draggedSuitMesh) return;

    // Unproject to 3D plane at z = 0.5
    const ndcX = normX * 2 - 1;
    const ndcY = -(normY * 2 - 1);
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
    vector.unproject(this.camera);
    const dir = vector.sub(this.camera.position).normalize();
    const targetZ = 0.5;
    const distance = (targetZ - this.camera.position.z) / dir.z;
    const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));

    this.draggedSuitMesh.position.copy(pos);

    // Dynamic scale: expands from mini (0.22) at dock to full (1.0) near center-right stage (x ~ 1.15, y ~ 0.8)
    const stagePos = new THREE.Vector3(1.15, 0.8, 0);
    const distToStage = Math.min(1.0, pos.distanceTo(stagePos) / 2.0);
    const currentScale = THREE.MathUtils.lerp(1.0, 0.22, distToStage);
    this.draggedSuitMesh.scale.set(currentScale, currentScale, currentScale);

    // Dynamic yaw rotation towards user as it arrives near stage
    this.draggedSuitMesh.rotation.y = ((pos.x - 1.15) / 2.0) * (Math.PI / 3);

    // Check proximity to center-right pedestal
    const isNearPedestal = Math.abs(pos.x - 1.15) < 1.1 && Math.abs(pos.y - 0.5) < 1.3;
    this.pedestal.highlight(isNearPedestal);
  }

  /**
   * Called when drag is released
   */
  finishSuitDrag(isOverCenter) {
    this.pedestal.highlight(false);
    if (this.draggedSuitMesh) {
      this.scene.remove(this.draggedSuitMesh);
      this.draggedSuitMesh = null;
    }
    this.draggedSuitConfig = null;
  }


  /**
   * Rotate active suit with hand movement
   */
  rotateSuit(deltaX, deltaY) {
    this.targetRotationY += deltaX * 3.5;
    this.targetRotationX += deltaY * 2.0;
    // Limit vertical pitch tilt
    this.targetRotationX = Math.max(-0.4, Math.min(0.4, this.targetRotationX));
  }

  /**
   * Zoom suit with hand distance / pinch
   */
  zoomSuit(deltaZoom) {
    this.targetZoom = Math.max(0.65, Math.min(1.85, this.targetZoom + deltaZoom));
  }

  resetTransform() {
    this.targetRotationY = 0;
    this.targetRotationX = 0;
    this.targetZoom = 1.0;
  }

  setRenderMode(mode) {
    this.renderMode = mode;
    if (this.activeSuit) {
      this.modelLoader.applyRenderMode(this.activeSuit, mode);
    }
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    this.camera.aspect = aspect;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && window.screen.height < 1050)
      || (w < 1150 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

    if (aspect < 1.0) {
      // Portrait mode (phone held vertically)
      this.camera.fov = 56;
      this.camera.position.set(0, 1.40, 6.2);
      this.centerStageGroup.position.set(0, 0.45, 0);
      if (this.suitRack) {
        this.suitRack.repositionSlots(-1.35, 1.35, 0.16);
      }
    } else if (h <= 680 || w <= 1150) {
      // Mobile landscape / Phone in Desktop site mode / Small screens
      this.camera.fov = 42;
      this.camera.position.set(0.18, 1.35, 4.8);
      this.centerStageGroup.position.set(1.10, 0, 0);
      if (this.suitRack) {
        this.suitRack.repositionSlots(-0.85, 2.25, 0.18);
      }
    } else {
      // Desktop / Large screen landscape
      this.camera.fov = 45;
      this.camera.position.set(0.1, 1.45, 5.0);
      this.centerStageGroup.position.set(1.20, 0, 0);
      if (this.suitRack) {
        this.suitRack.repositionSlots(-1.75, 2.15, 0.22);
      }
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
  }

  render() {
    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // Update pedestal animations
    this.pedestal.update(delta, time);

    // Smooth lerp for rotations
    this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.12;
    this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.12;
    this.currentZoom += (this.targetZoom - this.currentZoom) * 0.12;

    // Auto-spin if idle & enabled
    if (this.autoRotate && !this.isInteracting) {
      this.targetRotationY += delta * 0.35;
    }

    // Active Suit updates
    if (this.activeSuit) {
      // Entrance scaling animation
      if (this.activeSuitEntranceTime !== undefined && this.activeSuitEntranceTime < 1.0) {
        this.activeSuitEntranceTime += delta * 2.2;
        const progress = Math.min(1.0, this.activeSuitEntranceTime);
        const easeScale = Math.sin((progress * Math.PI) / 2) * this.currentZoom;
        this.activeSuit.scale.set(easeScale, easeScale, easeScale);
      } else {
        this.activeSuit.scale.set(this.currentZoom, this.currentZoom, this.currentZoom);
      }

      this.activeSuit.rotation.y = this.currentRotationY;
      this.activeSuit.rotation.x = this.currentRotationX;

      // Update holographic shaders
      this.modelLoader.updateShaders(this.activeSuit, delta, time);
    }

    // Outgoing suit animation (shrinking & gliding away)
    if (this.outgoingSuit) {
      this.outgoingSuitAnimTime += delta * 2.5;
      const progress = Math.min(1.0, this.outgoingSuitAnimTime);
      const ease = progress * progress;

      // Move towards right dock
      this.outgoingSuit.position.x = THREE.MathUtils.lerp(this.outgoingSuitStartPos.x, 3.5, ease);
      this.outgoingSuit.position.y = THREE.MathUtils.lerp(this.outgoingSuitStartPos.y, 1.2, ease);
      this.outgoingSuit.position.z = THREE.MathUtils.lerp(this.outgoingSuitStartPos.z, -1.0, ease);

      const s = THREE.MathUtils.lerp(1.0, 0.01, ease);
      this.outgoingSuit.scale.set(s, s, s);

      if (progress >= 1.0) {
        this.centerStageGroup.remove(this.outgoingSuit);
        this.outgoingSuit = null;
      }
    }

    // 3D Mini Armory Rack animations
    if (this.suitRack) {
      this.suitRack.update(delta, time);
    }

    // Dragged suit shader animation
    if (this.draggedSuitMesh) {
      this.modelLoader.updateShaders(this.draggedSuitMesh, delta, time);
    }

    // Render postprocessed scene

    this.composer.render();
  }
}
