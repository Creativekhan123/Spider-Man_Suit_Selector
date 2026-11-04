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
    this._buildVerticalScanner();
    this._buildDiagnosticOrbitRings();
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

  _buildVerticalScanner() {
    this.scannerGroup = new THREE.Group();

    // 1. Glowing neon-cyan scan torus ring
    const ringGeo = new THREE.TorusGeometry(1.22, 0.012, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.scanRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.scanRingMesh.rotation.x = Math.PI / 2;
    this.scannerGroup.add(this.scanRingMesh);

    // 2. Faint laser plane disc inside the ring
    const discGeo = new THREE.RingGeometry(0.05, 1.22, 48);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.scanDiscMesh = new THREE.Mesh(discGeo, discMat);
    this.scanDiscMesh.rotation.x = Math.PI / 2;
    this.scannerGroup.add(this.scanDiscMesh);

    // 3. 4 Cardinal Projector Emitter Beams rising from floor perimeter
    this.emitters = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const ex = Math.cos(angle) * (this.radius * 0.92);
      const ez = Math.sin(angle) * (this.radius * 0.92);

      const dotGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.025, 16);
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        blending: THREE.AdditiveBlending
      });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(ex, 0.02, ez);
      this.group.add(dot);

      // Angled laser beam line from emitter to scanner ring
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ex, 0.02, ez),
        new THREE.Vector3(ex * 0.85, 1.35, ez * 0.85)
      ]);
      const beamLine = new THREE.Line(lineGeo, lineMat);
      this.group.add(beamLine);
      this.emitters.push({ line: beamLine, basePos: new THREE.Vector3(ex, 0.02, ez) });
    }

    this.group.add(this.scannerGroup);
  }

  _buildDiagnosticOrbitRings() {
    this.orbitGroup = new THREE.Group();
    this.orbitGroup.position.y = 1.35; // Torso level

    // Ring 1: Primary chest orbit ring
    const ring1Geo = new THREE.RingGeometry(1.32, 1.34, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.orbitRing1 = new THREE.Mesh(ring1Geo, ring1Mat);
    this.orbitRing1.rotation.x = Math.PI / 2 + 0.18;
    this.orbitGroup.add(this.orbitRing1);

    // Ring 2: Outer counter-rotating diagnostic ring
    const ring2Geo = new THREE.RingGeometry(1.48, 1.50, 48);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0x00a0ff,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.orbitRing2 = new THREE.Mesh(ring2Geo, ring2Mat);
    this.orbitRing2.rotation.x = Math.PI / 2 - 0.14;
    this.orbitGroup.add(this.orbitRing2);

    // Technical coordinate tick markers
    for (let i = 0; i < 4; i++) {
      const markerGeo = new THREE.PlaneGeometry(0.10, 0.025);
      const markerMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      const angle = (i * Math.PI) / 2;
      marker.position.set(Math.cos(angle) * 1.33, 0, Math.sin(angle) * 1.33);
      this.orbitRing1.add(marker);
    }

    this.group.add(this.orbitGroup);
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

    // Vertical Holographic Laser Scanner animation (sweeping feet to head)
    if (this.scannerGroup) {
      const scanY = 1.35 + Math.sin(time * 1.6) * 1.15;
      this.scannerGroup.position.y = scanY;

      if (this.scanDiscMesh) {
        this.scanDiscMesh.material.opacity = 0.08 + Math.abs(Math.cos(time * 3.2)) * 0.08;
      }

      if (this.emitters) {
        for (const em of this.emitters) {
          const positions = em.line.geometry.attributes.position.array;
          positions[3] = em.basePos.x * 0.85;
          positions[4] = scanY;
          positions[5] = em.basePos.z * 0.85;
          em.line.geometry.attributes.position.needsUpdate = true;
        }
      }
    }

    // Diagnostic Orbit Rings Rotation
    if (this.orbitRing1) {
      this.orbitRing1.rotation.z += delta * 0.45;
    }
    if (this.orbitRing2) {
      this.orbitRing2.rotation.z -= delta * 0.35;
    }
    if (this.orbitGroup) {
      this.orbitGroup.position.y = 1.35 + Math.sin(time * 1.2) * 0.035;
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
