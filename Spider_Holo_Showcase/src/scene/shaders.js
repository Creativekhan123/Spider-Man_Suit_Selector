import * as THREE from 'three';

/**
 * Creates the authentic Marvel / Stark Holographic Material (matching Image 2).
 * Preserves the suit's authentic textures (webbing, colors, spider emblem, mask eyes)
 * while layering deep cybernetic blue ambient tones, electric cyan Fresnel rim contour,
 * glowing eye lenses, and subtle holographic scanlines.
 */
export function createStarkHoloMaterial(originalMaterial = null, options = {}) {
  const map = (originalMaterial && originalMaterial.map) ? originalMaterial.map : null;
  const normalMap = (originalMaterial && originalMaterial.normalMap) ? originalMaterial.normalMap : null;

  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }

  const mat = new THREE.MeshStandardMaterial({
    map: map,
    normalMap: normalMap,
    color: map ? new THREE.Color(0xdceaff) : new THREE.Color(0x0055aa),
    roughness: 0.32,
    metalness: 0.25,
    transparent: true,
    opacity: options.opacity !== undefined ? options.opacity : 0.98,
    side: THREE.DoubleSide
  });

  mat.userData.uTime = { value: 0 };
  mat.userData.uRimColor = { value: new THREE.Color(options.rimColor || 0x00f0ff) };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = mat.userData.uTime;
    shader.uniforms.uRimColor = mat.userData.uRimColor;

    shader.fragmentShader = `
      uniform float uTime;
      uniform vec3 uRimColor;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>

      // 1. Fresnel Rim Highlight (Electric cyan silhouette edges like Image 2)
      vec3 vDir = normalize(vViewPosition);
      vec3 nDir = normalize(vNormal);
      float fresnel = 1.0 - max(dot(vDir, nDir), 0.0);
      float rim = pow(fresnel, 2.4);

      // 2. Detect bright features (white mask eyes, white spider chest logo)
      float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
      float isBrightFeature = smoothstep(0.55, 0.92, lum);

      // 3. Cybernetic contrast: enrich shadows with deep electric navy/cyan, while keeping suit textures vivid
      vec3 cyberTint = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.68, 0.88, 1.15), 0.42);

      // 4. Electric cyan contour glow
      vec3 rimGlow = uRimColor * rim * 1.5;

      // 5. Glowing eye lenses & bright spider emblem (instant Spider-Man recognition!)
      vec3 eyeGlow = vec3(0.4, 0.95, 1.0) * isBrightFeature * 1.8;

      // 6. Subtle animated holographic scanlines (delicate 7% modulation)
      float scan = sin(gl_FragCoord.y * 0.12 + uTime * 3.5) * 0.5 + 0.5;
      float scanMult = 0.94 + scan * 0.12;

      gl_FragColor.rgb = (cyberTint + rimGlow + eyeGlow) * scanMult;
      `
    );
  };

  return mat;
}

// Backward-compatible aliases
export const createHologramMaterial = createStarkHoloMaterial;
export const createSkinnedHologramMaterial = (opts) => createStarkHoloMaterial(null, opts);



/**
 * Creates texture for procedural high-tech holographic circular pedestals.
 */
export function generatePedestalTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Concentric Rings
  const rings = [
    { r: 480, w: 2, alpha: 0.4, dash: [4, 8] },
    { r: 460, w: 4, alpha: 0.8, dash: [20, 10] },
    { r: 430, w: 1.5, alpha: 0.35, dash: [] },
    { r: 400, w: 3, alpha: 0.7, dash: [40, 15, 10, 15] },
    { r: 350, w: 2, alpha: 0.5, dash: [10, 20] },
    { r: 280, w: 5, alpha: 0.9, dash: [] },
    { r: 240, w: 2, alpha: 0.6, dash: [8, 8] },
    { r: 180, w: 3, alpha: 0.75, dash: [30, 15] },
    { r: 120, w: 2, alpha: 0.5, dash: [] }
  ];

  rings.forEach(({ r, w, alpha, dash }) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = w;
    ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
    ctx.setLineDash(dash);
    ctx.stroke();
  });

  // Radial Tick Marks (Stark Arc Reactor style)
  ctx.setLineDash([]);
  const ticks = 72;
  for (let i = 0; i < ticks; i++) {
    const angle = (i / ticks) * Math.PI * 2;
    const isMajor = i % 6 === 0;
    const len = isMajor ? 35 : 18;
    const rStart = 430;
    const rEnd = rStart + len;

    const x1 = cx + Math.cos(angle) * rStart;
    const y1 = cy + Math.sin(angle) * rStart;
    const x2 = cx + Math.cos(angle) * rEnd;
    const y2 = cy + Math.sin(angle) * rEnd;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = isMajor ? 3 : 1.5;
    ctx.strokeStyle = isMajor ? 'rgba(0, 255, 255, 0.9)' : 'rgba(0, 200, 255, 0.45)';
    ctx.stroke();
  }

  // Inner spider glyph / geometric chevron markers
  for (let j = 0; j < 8; j++) {
    const angle = (j / 8) * Math.PI * 2;
    const r = 210;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-10, 8);
    ctx.lineTo(0, -8);
    ctx.lineTo(10, 8);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#00ffff';
    ctx.stroke();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural Stark Arc-Reactor Spider Floor Projector Disc
 * Projects an iconic glowing Spider-Man Arc-Reactor emblem onto the floor pedestal.
 */
export function generateSpiderEmblemTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const cx = 512;
  const cy = 512;

  ctx.clearRect(0, 0, 1024, 1024);

  // Outer segmented rings
  const rings = [
    { r: 470, w: 3, alpha: 0.7, dash: [40, 20] },
    { r: 440, w: 1.5, alpha: 0.4, dash: [] },
    { r: 380, w: 2.5, alpha: 0.8, dash: [25, 15, 10, 15] },
    { r: 320, w: 2, alpha: 0.5, dash: [8, 8] },
    { r: 240, w: 3, alpha: 0.85, dash: [] },
    { r: 160, w: 2, alpha: 0.6, dash: [15, 15] }
  ];

  rings.forEach(({ r, w, alpha, dash }) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = w;
    ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
    ctx.setLineDash(dash);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Arc-reactor radial spokes
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const isMajor = i % 3 === 0;
    const r1 = 250;
    const r2 = isMajor ? 380 : 320;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
    ctx.lineWidth = isMajor ? 2.5 : 1;
    ctx.strokeStyle = isMajor ? 'rgba(0, 255, 255, 0.75)' : 'rgba(0, 200, 255, 0.35)';
    ctx.stroke();
  }

  // Draw 8 Iconic Angular Cybernetic Spider Legs
  ctx.save();
  ctx.strokeStyle = '#00ffff';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';

  // 4 Upper & Lower Legs (Left & Right)
  const drawSpiderLegs = (sign) => {
    // Upper Outer Leg
    ctx.beginPath();
    ctx.moveTo(cx + sign * 25, cy - 20);
    ctx.lineTo(cx + sign * 90, cy - 120);
    ctx.lineTo(cx + sign * 180, cy - 260);
    ctx.lineTo(cx + sign * 240, cy - 230);
    ctx.stroke();

    // Upper Inner Leg
    ctx.beginPath();
    ctx.moveTo(cx + sign * 20, cy - 5);
    ctx.lineTo(cx + sign * 120, cy - 60);
    ctx.lineTo(cx + sign * 220, cy - 140);
    ctx.lineTo(cx + sign * 260, cy - 90);
    ctx.stroke();

    // Lower Upper Leg
    ctx.beginPath();
    ctx.moveTo(cx + sign * 22, cy + 20);
    ctx.lineTo(cx + sign * 125, cy + 40);
    ctx.lineTo(cx + sign * 220, cy + 130);
    ctx.lineTo(cx + sign * 250, cy + 180);
    ctx.stroke();

    // Lower Bottom Leg
    ctx.beginPath();
    ctx.moveTo(cx + sign * 18, cy + 35);
    ctx.lineTo(cx + sign * 90, cy + 140);
    ctx.lineTo(cx + sign * 160, cy + 260);
    ctx.lineTo(cx + sign * 180, cy + 300);
    ctx.stroke();
  };

  drawSpiderLegs(1);  // Right side
  drawSpiderLegs(-1); // Left side

  // Center Spider Body & Head
  // Thorax / Head
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 95);
  ctx.lineTo(cx + 28, cy - 45);
  ctx.lineTo(cx, cy - 20);
  ctx.lineTo(cx - 28, cy - 45);
  ctx.closePath();
  ctx.fill();

  // Abdomen (Geometric angular Stark spider abdomen)
  ctx.beginPath();
  ctx.moveTo(cx, cy - 15);
  ctx.lineTo(cx + 36, cy + 25);
  ctx.lineTo(cx + 25, cy + 85);
  ctx.lineTo(cx, cy + 140);
  ctx.lineTo(cx - 25, cy + 85);
  ctx.lineTo(cx - 36, cy + 25);
  ctx.closePath();
  ctx.fillStyle = '#00ffff';
  ctx.fill();

  // White Arc Core Center
  ctx.beginPath();
  ctx.arc(cx, cy + 20, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 18;
  ctx.fill();

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
