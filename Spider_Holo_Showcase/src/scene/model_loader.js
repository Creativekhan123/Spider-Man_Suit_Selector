import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { createStarkHoloMaterial } from './shaders.js';

const TEXTURE_LOADER = new THREE.TextureLoader();

function loadSuitTexture(url) {
  const tex = TEXTURE_LOADER.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Preloaded diffuse maps for suits that need manual binding
const SPIDERMAN6_MAPS = {
  head: loadSuitTexture('/models/spider-man6/source/T_1036802_Head_D.png'),
  equip1: loadSuitTexture('/models/spider-man6/source/T_1036802_Equip_01_D.png'),
  equip2: loadSuitTexture('/models/spider-man6/source/T_1036802_Equip_02_D.png'),
  body: loadSuitTexture('/models/spider-man6/source/T_1036802_Body_D.png')
};

const SPIDERMAN8_MAPS = {
  equip1: loadSuitTexture('/models/spider-man8/source/T_1036510_Equip_01_D.png'),
  equip2: loadSuitTexture('/models/spider-man8/source/T_1036510_Equip_02_D.png'),
  equip3: loadSuitTexture('/models/spider-man8/source/T_1036510_Equip_03_D.png'),
  head: loadSuitTexture('/models/spider-man8/source/T_1036510_Head_D.png'),
  eyes: loadSuitTexture('/models/spider-man8/source/T_1036510_Eyes_D.png'),
  hair: loadSuitTexture('/models/spider-man8/source/T_1036510_Hair_01_D.png')
};

export const SUITS_DATABASE = [
  {
    id: 'spiderman2',
    name: 'ADVANCED SUIT 2.0',
    designation: 'EARTH-1048 // MARVELS SPIDER-MAN 2',
    format: 'fbx',
    url: '/models/spider man2/source/source/spiderman2.fbx',
    icon: '🕷️',
    stats: { armor: 94, mobility: 98, nanotech: 86, fluid: 100 },
    abilities: ['WHITE SPIDER NANO-CHEST', 'SURGE PROTOCOL', 'WEB BURST MK-II'],
    targetHeight: 2.7,
    rotationOffset: [0, Math.PI / 2, 0]
  },

  {
    id: 'spiderman3',
    name: 'WEBBED RAIMI SUIT',
    designation: 'EARTH-96283 // SAM RAIMI TRILOGY',
    format: 'fbx',
    url: '/models/spider-man3/source/SPIDERMAN 3.fbx',
    icon: '🕸️',
    stats: { armor: 88, mobility: 95, nanotech: 72, fluid: 100 },
    abilities: ['RAISED SILVER WEBBING', 'SYMBIOTE RESIST', 'ORGANIC WEB FLUID'],
    targetHeight: 2.7,
    rotationOffset: [-Math.PI / 2, 0, 0]
  },
  {
    id: 'spiderman4',
    name: 'STEALTH "NIGHT MONKEY"',
    designation: 'EARTH-199999 // SHIELD BLACK-OPS',
    format: 'gltf',
    url: '/models/spider-man4/spiderman4.gltf',
    icon: '🥷',
    stats: { armor: 82, mobility: 100, nanotech: 65, fluid: 90 },
    abilities: ['OPTICAL CAMOUFLAGE', 'ACOUSTIC DAMPENER', 'FLIP GOGGLES'],
    targetHeight: 2.7
  },
  {
    id: 'spiderman5',
    name: 'STARK ENHANCED SUIT',
    designation: 'EARTH-199999 // STARK TECH HOMECOMING',
    format: 'obj',
    url: '/models/spider-man5/source/spiderman5.obj',
    mtlUrl: '/models/spider-man5/source/M-CoC_iOS_HERO_Peter_Parker_Spider-Man_Stark_Enhanced.mtl',
    icon: '🤖',
    stats: { armor: 91, mobility: 94, nanotech: 90, fluid: 100 },
    abilities: ['KAREN A.I. INTEGRATION', '576 WEB COMBOS', 'WEB WINGS'],
    targetHeight: 2.7
  },
  {
    id: 'spiderman6',
    name: 'IRON SPIDER (MK-I)',
    designation: 'EARTH-199999 // AVENGERS TITAN SPEC',
    format: 'fbx',
    url: '/models/spider-man6/source/spiderman6.fbx',
    icon: '🦾',
    stats: { armor: 99, mobility: 92, nanotech: 99, fluid: 98 },
    abilities: ['4 TACHYON WALDO ARMS', 'TITANIUM LIQUID MESH', 'DEEP SPACE LIFE SUPPORT'],
    targetHeight: 2.7
  },
  {
    id: 'spiderman7',
    name: 'VINTAGE COMIC SUIT',
    designation: 'EARTH-616 // ORIGINAL DITKO CLASSIC',
    format: 'fbx',
    url: '/models/spider-man7/source/Spider-Man.fbx',
    icon: '🎨',
    stats: { armor: 80, mobility: 99, nanotech: 50, fluid: 95 },
    abilities: ['SPIDER-SENSE MK-IV', 'CEL-SHADED RETRO', 'ACROBATIC MASTERY'],
    targetHeight: 2.7
  },
  {
    id: 'spiderman8',
    name: 'INTEGRATED NANOTECH',
    designation: 'EARTH-199999 // NO WAY HOME FINAL',
    format: 'fbx',
    url: '/models/spider-man8/source/spiderman8.fbx',
    icon: '⚡',
    stats: { armor: 96, mobility: 97, nanotech: 95, fluid: 100 },
    abilities: ['GOLDEN EMBLEM INFUSION', 'MYSTIC RESIST', 'NANOTECH FABRIC RE-LINK'],
    targetHeight: 2.7
  }
];

export class ModelLoader {
  constructor() {
    this.fbxLoader = new FBXLoader();
    this.gltfLoader = new GLTFLoader();
    this.objLoader = new OBJLoader();
    this.mtlLoader = new MTLLoader();
    this.cache = new Map();
  }

  async loadSuit(suitConfig) {
    if (this.cache.has(suitConfig.id)) {
      return this.cache.get(suitConfig.id);
    }

    let rootObject;
    try {
      if (suitConfig.format === 'fbx') {
        rootObject = await this._loadFBX(suitConfig.url);
      } else if (suitConfig.format === 'gltf' || suitConfig.format === 'glb') {
        rootObject = await this._loadGLTF(suitConfig.url);
      } else if (suitConfig.format === 'obj') {
        rootObject = await this._loadOBJ(suitConfig.url, suitConfig.mtlUrl);
      } else {
        rootObject = this._createProceduralSuit(suitConfig.name);
      }
    } catch (err) {
      console.warn(`[ModelLoader] Error loading ${suitConfig.name} from ${suitConfig.url}:`, err);
      rootObject = this._createProceduralSuit(suitConfig.name);
    }

    const wrapper = this._wrapAndNormalize(rootObject, suitConfig, suitConfig.targetHeight || 2.4);
    this._setupMaterials(wrapper, suitConfig);

    this.cache.set(suitConfig.id, wrapper);
    return wrapper;
  }

  _wrapAndNormalize(object, suitConfig = {}, targetHeight = 2.4) {
    const wrapper = new THREE.Group();
    wrapper.add(object);

    if (suitConfig.rotationOffset) {
      object.rotation.set(...suitConfig.rotationOffset);
    }
    object.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim > 0.001) {
      const scale = targetHeight / maxDim;
      object.scale.set(scale, scale, scale);
    }

    box.setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);

    object.position.x = -center.x;
    object.position.y = -box.min.y; // Feet at ground y = 0
    object.position.z = -center.z;

    return wrapper;
  }


  _loadFBX(url) {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(url, resolve, undefined, reject);
    });
  }

  _loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, (gltf) => resolve(gltf.scene || gltf.scenes[0]), undefined, reject);
    });
  }

  _loadOBJ(url, mtlUrl) {
    return new Promise((resolve, reject) => {
      if (mtlUrl) {
        this.mtlLoader.load(mtlUrl, (materials) => {
          materials.preload();
          this.objLoader.setMaterials(materials);
          this.objLoader.load(url, resolve, undefined, reject);
        }, undefined, () => {
          this.objLoader.load(url, resolve, undefined, reject);
        });
      } else {
        this.objLoader.load(url, resolve, undefined, reject);
      }
    });
  }

  _setupMaterials(object, suitConfig = {}) {
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // 1. Assign textures for spiderman6 if missing
        if (suitConfig.id === 'spiderman6') {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m, idx) => {
            const name = (m.name || '').toLowerCase();
            if (name.includes('head') || idx === 1) m.map = SPIDERMAN6_MAPS.head;
            else if (name.includes('equip_01') || idx === 2) m.map = SPIDERMAN6_MAPS.equip1;
            else if (name.includes('equip_02') || idx === 3) m.map = SPIDERMAN6_MAPS.equip2;
            else if (name.includes('body') || idx === 4) m.map = SPIDERMAN6_MAPS.body;
            if (m.map) {
              m.map.colorSpace = THREE.SRGBColorSpace;
              m.needsUpdate = true;
            }
          });
        }

        // 2. Assign textures for spiderman8 if missing
        if (suitConfig.id === 'spiderman8') {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m, idx) => {
            const name = (m.name || '').toLowerCase();
            if (name.includes('equip_01') || idx === 1) m.map = SPIDERMAN8_MAPS.equip1;
            else if (name.includes('equip_02') || idx === 0) m.map = SPIDERMAN8_MAPS.equip2;
            else if (name.includes('equip_03') || idx === 2) m.map = SPIDERMAN8_MAPS.equip3;
            else if (name.includes('head') || idx === 6) m.map = SPIDERMAN8_MAPS.head;
            else if (name.includes('eyes') || idx === 3 || idx === 8) m.map = SPIDERMAN8_MAPS.eyes;
            else if (name.includes('hair') || idx === 4 || idx === 5) m.map = SPIDERMAN8_MAPS.hair;
            if (m.map) {
              m.map.colorSpace = THREE.SRGBColorSpace;
              m.needsUpdate = true;
            }
          });
        }

        // Save original material reference
        child.userData.originalMaterial = child.material;

        // Build Stark Hologram materials (handling arrays of materials)
        const buildHoloMat = (mat) => {
          return createStarkHoloMaterial(mat, {
            rimColor: 0x00f0ff,
            opacity: 0.98
          });
        };

        const buildWireMat = (mat) => {
          return new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            wireframe: true,
            emissive: 0x0088cc,
            emissiveIntensity: 0.7,
            transparent: true,
            opacity: 0.85
          });
        };

        if (Array.isArray(child.material)) {
          child.userData.hologramMaterial = child.material.map(m => buildHoloMat(m));
          child.userData.wireframeMaterial = child.material.map(m => buildWireMat(m));
        } else {
          child.userData.hologramMaterial = buildHoloMat(child.material);
          child.userData.wireframeMaterial = buildWireMat(child.material);
        }

        child.material = child.userData.hologramMaterial;
      }
    });
  }

  applyRenderMode(object, mode = 'hologram') {
    object.traverse((child) => {
      if (child.isMesh && child.userData) {
        if (mode === 'hologram' && child.userData.hologramMaterial) {
          child.material = child.userData.hologramMaterial;
        } else if (mode === 'textured' && child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial;
        } else if (mode === 'wireframe' && child.userData.wireframeMaterial) {
          child.material = child.userData.wireframeMaterial;
        }
      }
    });
  }

  updateShaders(object, delta, time) {
    object.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (mat.userData && mat.userData.uTime) {
            mat.userData.uTime.value = time;
          }
          if (mat.uniforms && mat.uniforms.uTime) {
            mat.uniforms.uTime.value = time;
          }
        });
      }
    });
  }


  _createProceduralSuit(name) {
    const group = new THREE.Group();
    // Torso
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.25, 0.9, 16);
    const torsoMesh = new THREE.Mesh(torsoGeo);
    torsoMesh.position.y = 1.45;
    group.add(torsoMesh);

    // Head
    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    headGeo.scale(1, 1.25, 1);
    const headMesh = new THREE.Mesh(headGeo);
    headMesh.position.y = 2.15;
    group.add(headMesh);

    // Limbs
    const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.8, 12);
    const leftArm = new THREE.Mesh(armGeo);
    leftArm.position.set(-0.5, 1.35, 0);
    leftArm.rotation.z = 0.15;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo);
    rightArm.position.set(0.5, 1.35, 0);
    rightArm.rotation.z = -0.15;
    group.add(rightArm);

    const legGeo = new THREE.CylinderGeometry(0.12, 0.09, 1.0, 12);
    const leftLeg = new THREE.Mesh(legGeo);
    leftLeg.position.set(-0.2, 0.5, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo);
    rightLeg.position.set(0.2, 0.5, 0);
    group.add(rightLeg);

    return group;
  }
}
