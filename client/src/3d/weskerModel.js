import * as THREE from 'three';
import { WESKER_BBMODEL_DATA } from './weskerModelData.js';
import { getDefaultCustomization } from './characterCustomizationData.js';

// Cached texture & material
let cachedWeskerTexture = null;
let cachedWeskerMaterial = null;

export function getWeskerTexture() {
  if (!cachedWeskerTexture && typeof Image !== 'undefined') {
    const img = new Image();
    img.src = WESKER_BBMODEL_DATA.texture;
    const tex = new THREE.Texture(img);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    if (img.complete) {
      tex.needsUpdate = true;
    } else {
      img.onload = () => {
        tex.needsUpdate = true;
      };
    }
    cachedWeskerTexture = tex;
  }
  return cachedWeskerTexture;
}

export function getWeskerMaterial() {
  if (!cachedWeskerMaterial) {
    const texture = getWeskerTexture();
    cachedWeskerMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.15,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
    });
  }
  return cachedWeskerMaterial;
}

function createBoxGeo(el, texW = 256, texH = 256) {
  const w = el.to[0] - el.from[0];
  const h = el.to[1] - el.from[1];
  const d = el.to[2] - el.from[2];
  const geo = new THREE.BoxGeometry(w, h, d);
  const uvAttr = geo.attributes.uv;
  // Three.js BoxGeometry face order: 0:+X, 1:-X, 2:+Y, 3:-Y, 4:+Z, 5:-Z
  const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];

  for (let fIdx = 0; fIdx < 6; fIdx++) {
    const fName = faceOrder[fIdx];
    const fData = el.faces && el.faces[fName];
    const off = fIdx * 4;
    if (!fData || !fData.uv) {
      for (let v = 0; v < 4; v++) uvAttr.setXY(off + v, 0, 0);
      continue;
    }
    const [u1, v1, u2, v2] = fData.uv;
    uvAttr.setXY(off + 0, u1 / texW, 1 - v1 / texH);
    uvAttr.setXY(off + 1, u2 / texW, 1 - v1 / texH);
    uvAttr.setXY(off + 2, u1 / texW, 1 - v2 / texH);
    uvAttr.setXY(off + 3, u2 / texW, 1 - v2 / texH);
  }
  uvAttr.needsUpdate = true;
  return geo;
}

function createElementNode(el, parentOrigin, material, overrides = {}) {
  const geo = createBoxGeo(el);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = el.name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const cx = (el.from[0] + el.to[0]) / 2;
  const cy = (el.from[1] + el.to[1]) / 2;
  const cz = (el.from[2] + el.to[2]) / 2;

  const rx = overrides.rx !== undefined ? overrides.rx : (el.rotation ? el.rotation[0] : 0);
  const ry = overrides.ry !== undefined ? overrides.ry : (el.rotation ? el.rotation[1] : 0);
  const rz = overrides.rz !== undefined ? overrides.rz : (el.rotation ? el.rotation[2] : 0);

  const hasRot = rx !== 0 || ry !== 0 || rz !== 0;
  const ox = overrides.ox !== undefined ? overrides.ox : (el.origin ? el.origin[0] : cx);
  const oy = overrides.oy !== undefined ? overrides.oy : (el.origin ? el.origin[1] : cy);
  const oz = overrides.oz !== undefined ? overrides.oz : (el.origin ? el.origin[2] : cz);

  if (hasRot) {
    const pivot = new THREE.Group();
    pivot.name = el.name + '_pivot';
    pivot.position.set(ox - parentOrigin[0], oy - parentOrigin[1], oz - parentOrigin[2]);
    pivot.rotation.set(
      THREE.MathUtils.degToRad(rx),
      THREE.MathUtils.degToRad(ry),
      THREE.MathUtils.degToRad(rz),
      'ZYX'
    );
    mesh.position.set(cx - ox, cy - oy, cz - oz);
    pivot.add(mesh);
    return pivot;
  } else {
    mesh.position.set(cx - parentOrigin[0], cy - parentOrigin[1], cz - parentOrigin[2]);
    return mesh;
  }
}

/**
 * Builds the Albert Wesker 3D character model directly from the Blockbench voxel specification.
 * Supports both 'standing' (Customization Studio) and 'seated' (Bunker Table) modes.
 */
export function buildWeskerModel(cust = {}, opts = {}) {
  const config = { ...getDefaultCustomization(), ...(cust || {}) };
  const mode = opts.mode || 'standing';
  const isSeated = mode === 'seated';

  const group = new THREE.Group();
  group.userData = { config, mode };

  const material = getWeskerMaterial();
  const elemMap = new Map(WESKER_BBMODEL_DATA.elements.map(e => [e.name, e]));

  // Model root: 1 Blockbench unit = 0.0625m (1/16m)
  // Rotating Math.PI around Y aligns Blockbench North (-Z) with Three.js forward (+Z)
  const root = new THREE.Group();
  root.scale.set(0.0625, 0.0625, 0.0625);
  root.rotation.y = Math.PI;
  group.add(root);

  if (!isSeated) {
    // ═════════════════════════════════════════════════════════════════════════
    // STANDING MODE (Customization Studio / Full Body Showcase)
    // ═════════════════════════════════════════════════════════════════════════
    const torsoGroup = new THREE.Group();
    torsoGroup.name = 'wesker_torso';
    torsoGroup.position.set(0, 12, 0);
    root.add(torsoGroup);
    group.userData.torso = torsoGroup;

    const headGroup = new THREE.Group();
    headGroup.name = 'wesker_head';
    headGroup.position.set(0, 21.5, 0);
    root.add(headGroup);
    group.userData.head = headGroup;

    const lArmGroup = new THREE.Group();
    lArmGroup.name = 'wesker_lArm';
    lArmGroup.position.set(3.8, 18.5, 0);
    root.add(lArmGroup);

    const rArmGroup = new THREE.Group();
    rArmGroup.name = 'wesker_rArm';
    rArmGroup.position.set(-3.8, 18.5, 0);
    root.add(rArmGroup);

    const lLegGroup = new THREE.Group();
    lLegGroup.name = 'wesker_lLeg';
    lLegGroup.position.set(1.45, 12, 0);
    root.add(lLegGroup);

    const rLegGroup = new THREE.Group();
    rLegGroup.name = 'wesker_rLeg';
    rLegGroup.position.set(-1.45, 12, 0);
    root.add(rLegGroup);

    // Populate all 60 elements into their canonical bones
    WESKER_BBMODEL_DATA.elements.forEach(el => {
      if (
        el.name.startsWith('head_') ||
        el.name.startsWith('hair_') ||
        el.name.startsWith('sunglasses_') ||
        el.name.startsWith('chin_') ||
        el.name.startsWith('jaw_') ||
        el.name.startsWith('ear_')
      ) {
        headGroup.add(createElementNode(el, [0, 21.5, 0], material));
      } else if (
        el.name.startsWith('l_arm_') ||
        el.name.startsWith('l_upper_') ||
        el.name.startsWith('l_forearm_') ||
        el.name.startsWith('l_cuff_') ||
        el.name.startsWith('l_glove_')
      ) {
        lArmGroup.add(createElementNode(el, [3.8, 18.5, 0], material));
      } else if (
        el.name.startsWith('r_arm_') ||
        el.name.startsWith('r_upper_') ||
        el.name.startsWith('r_forearm_') ||
        el.name.startsWith('r_cuff_') ||
        el.name.startsWith('r_glove_')
      ) {
        rArmGroup.add(createElementNode(el, [-3.8, 18.5, 0], material));
      } else if (
        el.name.startsWith('l_thigh_') ||
        el.name.startsWith('l_knee_') ||
        el.name.startsWith('l_calf_') ||
        el.name.startsWith('l_boot_')
      ) {
        lLegGroup.add(createElementNode(el, [1.45, 12, 0], material));
      } else if (
        el.name.startsWith('r_thigh_') ||
        el.name.startsWith('r_knee_') ||
        el.name.startsWith('r_calf_') ||
        el.name.startsWith('r_boot_')
      ) {
        rLegGroup.add(createElementNode(el, [-1.45, 12, 0], material));
      } else {
        torsoGroup.add(createElementNode(el, [0, 12, 0], material));
      }
    });
  } else {
    // ═════════════════════════════════════════════════════════════════════════
    // SEATED MODE (Bunker Game Table)
    // ═════════════════════════════════════════════════════════════════════════
    // Chair seat cushion is at y = 0.52m in BunkerScene -> 8.32 BB units
    const pelvisY = 8.32;

    const torsoGroup = new THREE.Group();
    torsoGroup.name = 'wesker_torso';
    torsoGroup.position.set(0, pelvisY, 0);
    root.add(torsoGroup);
    group.userData.torso = torsoGroup;

    // Head is 9.5 BB units above pelvis (neck pivot)
    const headGroup = new THREE.Group();
    headGroup.name = 'wesker_head';
    headGroup.position.set(0, pelvisY + 9.5, 0);
    root.add(headGroup);
    group.userData.head = headGroup;

    // Head & Torso Elements
    WESKER_BBMODEL_DATA.elements.forEach(el => {
      if (
        el.name.startsWith('head_') ||
        el.name.startsWith('hair_') ||
        el.name.startsWith('sunglasses_') ||
        el.name.startsWith('chin_') ||
        el.name.startsWith('jaw_') ||
        el.name.startsWith('ear_')
      ) {
        headGroup.add(createElementNode(el, [0, 21.5, 0], material));
      } else if (
        el.name.startsWith('collar_') ||
        el.name.startsWith('neck_') ||
        el.name.startsWith('chest_') ||
        el.name.startsWith('shoulder_pad_') ||
        el.name.startsWith('lapel_') ||
        el.name.startsWith('waist_') ||
        el.name.startsWith('tactical_belt') ||
        el.name.startsWith('belt_holster_')
      ) {
        torsoGroup.add(createElementNode(el, [0, 12, 0], material));
      } else if (el.name.startsWith('coat_tail_')) {
        let overrides = {};
        if (el.name.includes('_f')) {
          // Front coat tails drape forward over thighs
          overrides = { rx: -75 };
        } else if (el.name.includes('_b')) {
          // Back coat tails flare back/outward around chair cushion
          const side = el.name.endsWith('r') ? 1 : -1;
          overrides = { rx: 30, rz: side * 15 };
        } else if (el.name.includes('_s')) {
          const side = el.name.endsWith('r') ? 1 : -1;
          overrides = { rz: side * 12 };
        }
        torsoGroup.add(createElementNode(el, [0, 12, 0], material, overrides));
      }
    });

    // Seated Legs (Thighs forward, Lower legs down to floor)
    [-1, 1].forEach(sideMult => {
      const hipX = sideMult * 1.45;
      const legPrefix = sideMult === 1 ? 'l_' : 'r_';

      // Hip pivot
      const hipGroup = new THREE.Group();
      hipGroup.position.set(hipX, pelvisY, 0);
      root.add(hipGroup);

      // Thigh rotated 90° forward around X (towards -Z in BB coordinates)
      const thighGroup = new THREE.Group();
      thighGroup.rotation.x = -Math.PI / 2;
      hipGroup.add(thighGroup);

      const thighEl = elemMap.get(legPrefix + 'thigh_pants');
      const kneePadEl = elemMap.get(legPrefix + 'knee_pad');
      if (thighEl) thighGroup.add(createElementNode(thighEl, [hipX, 12, 0], material));
      if (kneePadEl) thighGroup.add(createElementNode(kneePadEl, [hipX, 12, 0], material));

      // Knee pivot at [hipX, pelvisY, -4.8]
      const lowerLegGroup = new THREE.Group();
      lowerLegGroup.position.set(hipX, pelvisY, -4.8);
      root.add(lowerLegGroup);

      // Lower leg hangs vertically down to y = 0.0m (bunker floor)
      ['calf_boot', 'boot_foot', 'boot_toe', 'boot_sole', 'boot_heel'].forEach(part => {
        const el = elemMap.get(legPrefix + part);
        if (el) lowerLegGroup.add(createElementNode(el, [hipX, 7.2, 0], material));
      });
    });

    // Seated Arms (Forearms resting forward on bunker table)
    [-1, 1].forEach(sideMult => {
      const armPrefix = sideMult === 1 ? 'l_' : 'r_';
      const shoulderX = sideMult * 3.8;
      const shoulderY = pelvisY + 6.5; // Shoulder is 6.5 units above pelvis

      const shoulderGroup = new THREE.Group();
      shoulderGroup.position.set(shoulderX, shoulderY, 0);
      root.add(shoulderGroup);

      // Upper arm tilts forward towards table
      const upperArmGroup = new THREE.Group();
      upperArmGroup.rotation.x = -0.55;
      shoulderGroup.add(upperArmGroup);

      const jointEl = elemMap.get(armPrefix + 'arm_shoulder_joint');
      const upperSleeveEl = elemMap.get(armPrefix + 'upper_sleeve');
      if (jointEl) upperArmGroup.add(createElementNode(jointEl, [shoulderX, 18.5, 0], material));
      if (upperSleeveEl) upperArmGroup.add(createElementNode(upperSleeveEl, [shoulderX, 18.5, 0], material));

      // Forearm group at elbow: extends forward resting on table
      const forearmGroup = new THREE.Group();
      forearmGroup.position.set(0, -4.5, 0);
      forearmGroup.rotation.x = -0.72;
      forearmGroup.rotation.y = sideMult * 0.15;
      upperArmGroup.add(forearmGroup);

      ['forearm_sleeve', 'cuff_strap', 'glove_hand', 'glove_thumb'].forEach(part => {
        const el = elemMap.get(armPrefix + part);
        if (el) forearmGroup.add(createElementNode(el, [shoulderX, 14.0, 0], material));
      });
    });
  }

  return group;
}
