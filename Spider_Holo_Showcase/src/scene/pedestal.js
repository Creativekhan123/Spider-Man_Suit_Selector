import * as THREE from 'three';
import { generatePedestalTexture, generateSpiderEmblemTexture } from './shaders.js';

export class HologramPedestal {
  constructor(radius = 1.8) {
    this.group = new THREE.Group();
    this.radius = radius;
    this.shockwaves = [];

    this._buildFloorPlanes();
    this._buildCylinderBeam();
    this._buildRisingParticles();
  }

  _buildFloorPlanes() {
    const geo = new THREE.PlaneGeometry(this.radius * 2, this.radius * 2);
    const texture = generatePedestalTexture();

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.floorDisc = new THREE.Mesh(geo, mat);
    this.floorDisc.rotation.x = -Math.PI / 2;
    this.floorDisc.position.y = 0.01;
    this.group.add(this.floorDisc);

    // Center Arc-Reactor Spider Floor Projection
    const spiderGeo = new THREE.PlaneGeometry(this.radius * 1.5, this.radius * 1.5);
    const spiderTexture = generateSpiderEmblemTexture();
    const spiderMat = new THREE.MeshBasicMaterial({
      map: spiderTexture,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.spiderDisc = new THREE.Mesh(spiderGeo, spiderMat);
    this.spiderDisc.rotation.x = -Math.PI / 2;
    this.spiderDisc.position.y = 0.018;
    this.group.add(this.spiderDisc);

    // Counter-rotating inner ring
    const innerGeo = new THREE.RingGeometry(this.radius * 0.45, this.radius * 0.65, 64);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.innerRing = new THREE.Mesh(innerGeo, innerMat);
    this.innerRing.rotation.x = -Math.PI / 2;
    this.innerRing.position.y = 0.022;
    this.group.add(this.innerRing);

    // Glowing core glow circle
    const coreGeo = new THREE.CircleGeometry(this.radius * 0.35, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00a0ff,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.coreDisc = new THREE.Mesh(coreGeo, coreMat);
    this.coreDisc.rotation.x = -Math.PI / 2;
    this.coreDisc.position.y = 0.015;
    this.group.add(this.coreDisc);
  }

  _buildCylinderBeam() {
    // Disabled to prevent obscuring the 3D Spider-Man model textures and details
    this.beamCylinder = null;
  }

  _buildRisingParticles() {
    const particleCount = 120;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (this.radius * 0.85);
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = Math.random() * 3.5;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      velocities[i] = 0.008 + Math.random() * 0.015;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleVelocities = velocities;

    const material = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.035,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geometry, material);
    this.group.add(this.particles);
  }

  triggerShockwave() {
    const geo = new THREE.RingGeometry(0.1, 0.3, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const wave = new THREE.Mesh(geo, mat);
    wave.rotation.x = -Math.PI / 2;
    wave.position.y = 0.03;
    wave.scale.set(1, 1, 1);
    this.group.add(wave);

    this.shockwaves.push({
      mesh: wave,
      scale: 1,
      opacity: 1.0,
      maxScale: this.radius * 3.5
    });
  }

  highlight(active) {
    this.isHighlighted = active;
    if (this.spiderDisc) {
      this.spiderDisc.material.opacity = active ? 1.0 : 0.85;
      this.spiderDisc.scale.set(active ? 1.08 : 1.0, active ? 1.08 : 1.0, 1.0);
    }
    if (this.innerRing) {
      this.innerRing.material.opacity = active ? 0.9 : 0.4;
      this.innerRing.material.color.setHex(active ? 0x00ffff : 0x00f0ff);
      this.innerRing.scale.set(active ? 1.15 : 1.0, active ? 1.15 : 1.0, 1.0);
    }
    if (this.floorDisc) {
      this.floorDisc.material.opacity = active ? 1.0 : 0.85;
    }
  }

  update(delta, time) {
    const rotSpeed = this.isHighlighted ? 0.45 : 0.15;
    if (this.floorDisc) {
      this.floorDisc.rotation.z += delta * rotSpeed;
    }
    if (this.spiderDisc) {
      this.spiderDisc.rotation.z -= delta * (rotSpeed * 0.8);
      const pulse = Math.sin(time * 3.5) * 0.08 + (this.isHighlighted ? 0.92 : 0.82);
      this.spiderDisc.material.opacity = pulse;
    }
    if (this.innerRing) {
      this.innerRing.rotation.z -= delta * (rotSpeed * 1.8);
    }
    if (this.coreDisc) {
      const pulse = Math.sin(time * (this.isHighlighted ? 6.0 : 3.0)) * 0.1 + (this.isHighlighted ? 0.4 : 0.22);
      this.coreDisc.material.opacity = pulse;
    }


    // Upward particles update
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < this.particleVelocities.length; i++) {
        pos[i * 3 + 1] += this.particleVelocities[i];
        if (pos[i * 3 + 1] > 3.6) {
          pos[i * 3 + 1] = 0.05;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    // Shockwaves animation
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.scale += delta * 7.5;
      sw.opacity -= delta * 1.5;
      sw.mesh.scale.set(sw.scale, sw.scale, 1);
      sw.mesh.material.opacity = Math.max(0, sw.opacity);

      if (sw.opacity <= 0) {
        this.group.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        sw.mesh.material.dispose();
        this.shockwaves.splice(i, 1);
      }
    }
  }
}
