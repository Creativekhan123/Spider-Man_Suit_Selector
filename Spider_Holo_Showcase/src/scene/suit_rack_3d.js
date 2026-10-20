import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { SUITS_DATABASE } from './model_loader.js';

/**
 * Manages the 3D Spider-Man Armory Floor Lineup across the bottom deck.
 * Displays all 7 Spider-Man suits in authentic standing poses facing forward
 * on glowing circular holographic energy rings, ready to be pinched & dragged to center stage.
 * Matches Image 2 reference layout.
 */
export class SuitRack3D {
  constructor(scene, camera, modelLoader) {
    this.scene = scene;
    this.camera = camera;
    this.modelLoader = modelLoader;

    this.group = new THREE.Group();
    this.group.name = 'SuitRack3D';
    this.scene.add(this.group);

    this.slots = [];
    this.activeSuitId = null;
    this.hoveredSuitId = null;

    // Lineup layout geometry (shifted inward so slot 0 & 1 aren't jammed against the left screen edge)
    this.startX = -1.75;
    this.endX = 2.15;
    this.floorZ = 1.85;
    this.miniScale = 0.22;

    // Raycasting for interactive picking
    this.raycaster = new THREE.Raycaster();

    this._initSlots();
  }

  _initSlots() {
    const count = SUITS_DATABASE.length;
    const stepX = (this.endX - this.startX) / (count - 1);

    SUITS_DATABASE.forEach((suitConfig, index) => {
      const slotGroup = new THREE.Group();
      slotGroup.name = `Slot_${suitConfig.id}`;

      const posX = this.startX + index * stepX;
      const posY = 0.02;
      // Gentle cinematic curved arc along the floor deck
      const posZ = this.floorZ - Math.abs(posX) * 0.08;
      slotGroup.position.set(posX, posY, posZ);

      // --- Glowing Circular Holographic Energy Pad (Image 2 style) ---
      const pedestalGroup = new THREE.Group();

      // 1. Outer Neon Ring
      const outerRingGeo = new THREE.RingGeometry(0.16, 0.23, 48);
      outerRingGeo.rotateX(-Math.PI / 2);
      const outerRingMat = new THREE.MeshBasicMaterial({
        color: 0x0088ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
      pedestalGroup.add(outerRing);

      // 2. Inner Concentric Energy Ring
      const innerRingGeo = new THREE.RingGeometry(0.06, 0.13, 36);
      innerRingGeo.rotateX(-Math.PI / 2);
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      pedestalGroup.add(innerRing);

      // 3. Ground Core Glow Disc
      const discGeo = new THREE.CircleGeometry(0.24, 36);
      discGeo.rotateX(-Math.PI / 2);
      const discMat = new THREE.MeshBasicMaterial({
        color: 0x002244,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      pedestalGroup.add(disc);

      slotGroup.add(pedestalGroup);

      // Temporary holographic proxy crystal while model loads
      const proxyGeo = new THREE.OctahedronGeometry(0.12, 0);
      const proxyMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      });
      const proxyMesh = new THREE.Mesh(proxyGeo, proxyMat);
      proxyMesh.position.y = 0.25;
      slotGroup.add(proxyMesh);

      // Invisible Bounding Box Hit Mesh for responsive raycasting & touch picking
      const hitGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.65, 16);
      const hitMat = new THREE.MeshBasicMaterial({
        visible: false
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.y = 0.32;
      hitMesh.userData = { suitConfig, index };
      slotGroup.add(hitMesh);

      this.group.add(slotGroup);

      const slot = {
        index,
        suitConfig,
        slotGroup,
        pedestalGroup,
        outerRing,
        innerRing,
        disc,
        proxyMesh,
        hitMesh,
        miniModel: null,
        isLoaded: false
      };

      this.slots.push(slot);

      // Asynchronously load the 3D Spider-Man model
      this._loadModelForSlot(slot);
    });
  }

  async _loadModelForSlot(slot) {
    try {
      const baseModel = await this.modelLoader.loadSuit(slot.suitConfig);
      const miniModel = skeletonClone(baseModel);

      miniModel.scale.set(this.miniScale, this.miniScale, this.miniScale);
      miniModel.position.set(0, 0, 0);

      // Forward-facing upright stance (no auto-rotation)
      const forwardAngle = (slot.suitConfig.rotationOffset && slot.suitConfig.rotationOffset[1]) || 0;
      miniModel.rotation.set(0, forwardAngle, 0);

      // Remove loading proxy
      if (slot.proxyMesh) {
        slot.slotGroup.remove(slot.proxyMesh);
        slot.proxyMesh.geometry.dispose();
        slot.proxyMesh.material.dispose();
        slot.proxyMesh = null;
      }

      slot.slotGroup.add(miniModel);
      slot.miniModel = miniModel;
      slot.isLoaded = true;

      // Update initial shaders
      this.modelLoader.updateShaders(miniModel, 0, 0);
    } catch (err) {
      console.warn(`[SuitRack3D] Failed to load model for ${slot.suitConfig.name}:`, err);
    }
  }

  setActiveSuit(suitId) {
    this.activeSuitId = suitId;
    this.slots.forEach(slot => {
      const isActive = slot.suitConfig.id === suitId;

      if (slot.outerRing) {
        slot.outerRing.material.color.setHex(isActive ? 0xffffff : 0x0088ff);
        slot.outerRing.material.opacity = isActive ? 1.0 : 0.65;
        slot.outerRing.scale.set(isActive ? 1.25 : 1.0, 1.0, isActive ? 1.25 : 1.0);
      }
      if (slot.innerRing) {
        slot.innerRing.material.color.setHex(isActive ? 0x00ffff : 0x00a8ff);
        slot.innerRing.material.opacity = isActive ? 1.0 : 0.75;
      }
      if (slot.disc) {
        slot.disc.material.color.setHex(isActive ? 0x00a8ff : 0x002244);
        slot.disc.material.opacity = isActive ? 0.55 : 0.25;
      }
      if (slot.miniModel) {
        slot.miniModel.traverse(c => {
          if (c.isMesh && c.material) {
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            mats.forEach(m => {
              m.opacity = isActive ? 0.65 : 0.98;
            });
          }
        });
      }
    });
  }

  setHoveredSuit(suitId) {
    this.hoveredSuitId = suitId;
    this.slots.forEach(slot => {
      const isHovered = slot.suitConfig.id === suitId;
      const isActive = slot.suitConfig.id === this.activeSuitId;

      if (!isActive && slot.outerRing) {
        slot.outerRing.material.color.setHex(isHovered ? 0x00f0ff : 0x0088ff);
        slot.outerRing.scale.set(isHovered ? 1.15 : 1.0, 1.0, isHovered ? 1.15 : 1.0);
      }
      if (!isActive && slot.innerRing) {
        slot.innerRing.scale.set(isHovered ? 1.25 : 1.0, 1.0, isHovered ? 1.25 : 1.0);
      }
    });
  }

  /**
   * Raycasts from normalized screen coords [0..1, 0..1] to find if hand or mouse is over or pointing to a suit
   */
  pickSlot(normX, normY) {
    const ndcX = normX * 2 - 1;
    const ndcY = -(normY * 2 - 1);

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hitMeshes = this.slots.map(s => s.hitMesh).filter(Boolean);
    const intersects = this.raycaster.intersectObjects(hitMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      return hit.userData ? hit.userData.suitConfig : null;
    }

    // Responsive targeting column cone across the bottom lineup
    if (normY > 0.45 || normX < 0.28) {
      let closestSuit = null;
      let minScore = Infinity;
      this.slots.forEach(slot => {
        const p = this.getSlotScreenPosition(slot.suitConfig.id);
        if (!p) return;
        const sx = p.x / window.innerWidth;
        const sy = p.y / window.innerHeight;

        const dx = Math.abs(normX - sx);
        const dy = Math.max(0, (sy - normY) * 0.30);
        const score = Math.hypot(dx, dy);

        if (dx < 0.13 && score < minScore) {
          minScore = score;
          closestSuit = slot.suitConfig;
        }
      });

      // Dedicated left-edge guard: whenever hand is on the left (normX <= 0.33), lock directly to suit 0 or 1
      if (!closestSuit && normX <= 0.33 && this.slots.length >= 2) {
        closestSuit = normX < 0.22 ? this.slots[0].suitConfig : this.slots[1].suitConfig;
      }

      return closestSuit;
    }

    return null;
  }

  getSlotWorldPosition(suitId) {
    const slot = this.slots.find(s => s.suitConfig.id === suitId);
    if (!slot) return null;
    const pos = new THREE.Vector3();
    slot.slotGroup.getWorldPosition(pos);
    return pos;
  }

  getSlotScreenPosition(suitId) {
    const slot = this.slots.find(s => s.suitConfig.id === suitId);
    if (!slot) return null;
    const pos = new THREE.Vector3();
    slot.slotGroup.getWorldPosition(pos);
    pos.y += 0.22; // Center of mini 3D model
    const proj = pos.project(this.camera);
    return {
      x: (proj.x + 1) * window.innerWidth / 2,
      y: (-proj.y + 1) * window.innerHeight / 2,
      suitConfig: slot.suitConfig
    };
  }

  update(delta, time) {
    this.slots.forEach(slot => {
      const isActive = slot.suitConfig.id === this.activeSuitId;

      // Rotate circular floor energy rings
      if (slot.outerRing) {
        slot.outerRing.rotation.z += delta * (isActive ? 0.35 : 0.12);
      }
      if (slot.innerRing) {
        slot.innerRing.rotation.z -= delta * (isActive ? 0.6 : 0.22);
      }
      if (slot.disc && isActive) {
        const pulse = Math.sin(time * 4.0) * 0.1 + 0.45;
        slot.disc.material.opacity = pulse;
      }

      // Keep model facing forward proudly (no rotation)
      if (slot.miniModel) {
        const forwardAngle = (slot.suitConfig.rotationOffset && slot.suitConfig.rotationOffset[1]) || 0;
        slot.miniModel.rotation.set(0, forwardAngle, 0);
        this.modelLoader.updateShaders(slot.miniModel, delta, time);
      }
    });
  }
}
