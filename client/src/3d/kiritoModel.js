import * as THREE from 'three';
import { KIRITO_BBMODEL_DATA } from './kiritoModelData.js';
import { getDefaultCustomization } from './characterCustomizationData.js';

// Cached texture & material
let cachedKiritoTexture = null;
let cachedKiritoMaterial = null;

export function getKiritoTexture() {
  if (!cachedKiritoTexture && typeof Image !== 'undefined') {
    const img = new Image();
    img.src = KIRITO_BBMODEL_DATA.texture;
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
    cachedKiritoTexture = tex;
  }
  return cachedKiritoTexture;
}

export function getKiritoMaterial() {
  if (!cachedKiritoMaterial) {
    const texture = getKiritoTexture();
    cachedKiritoMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.15,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
    });
  }
  return cachedKiritoMaterial;
}

function createBoxGeo(el, texW = 512, texH = 512) {
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
  const geo = createBoxGeo(el, KIRITO_BBMODEL_DATA.resolution.width || 512, KIRITO_BBMODEL_DATA.resolution.height || 512);
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
 * Builds the high-detail Kirito (Sword Art Online) 3D character model directly from the Blockbench model specification.
 * Includes dual swords (Elucidator & Dark Repulser), multi-layered shaggy hair, duster coat tails, silver buckles,
 * leather boots and high-fidelity textures.
 * Supports both 'standing' (Customization Studio) and 'seated' (Bunker Table) modes.
 */
export function buildKiritoModel(cust = {}, opts = {}) {
  const config = { ...getDefaultCustomization(), ...(cust || {}) };
  const mode = opts.mode || 'standing';
  const isSeated = mode === 'seated';

  const group = new THREE.Group();
  group.userData = { config, mode };

  const material = getKiritoMaterial();
  const elemMap = new Map(KIRITO_BBMODEL_DATA.elements.map(e => [e.name, e]));

  // Model root: 1 Blockbench unit = 0.0625m (1/16m)
  // Rotating Math.PI around Y aligns Blockbench North (-Z) with Three.js forward (+Z)
  const root = new THREE.Group();
  root.scale.set(0.0625, 0.0625, 0.0625);
  root.rotation.y = Math.PI;
  group.add(root);

  // Categorization helpers
  const isHeadElement = el =>
    el.name.startsWith('head_') ||
    el.name.startsWith('anime_') ||
    el.name.startsWith('hair_') ||
    el.name.startsWith('bang_') ||
    el.name.startsWith('sideburn_');

  const isLArmElement = el =>
    el.name.startsWith('shoulder_cap_l') ||
    el.name.startsWith('upper_arm_l') ||
    el.name === 'sao_crest_plate_l' ||
    el.name.startsWith('forearm_l') ||
    el.name.startsWith('forearm_strap_l') ||
    el.name.startsWith('wrist_cuff_ring_l') ||
    el.name.startsWith('glove_hand_l') ||
    el.name === 'thumb_l';

  const isRArmElement = el =>
    el.name.startsWith('shoulder_cap_r') ||
    el.name.startsWith('upper_arm_r') ||
    el.name.startsWith('forearm_r') ||
    el.name.startsWith('forearm_strap_r') ||
    el.name.startsWith('wrist_cuff_ring_r') ||
    el.name.startsWith('glove_hand_r') ||
    el.name === 'thumb_r';

  const isLLegElement = el =>
    el.name.startsWith('thigh_l') ||
    el.name.startsWith('knee_accent_l') ||
    el.name.startsWith('knee_plate_l') ||
    el.name.startsWith('boot_shin_l') ||
    el.name.startsWith('boot_cuff_ring_l') ||
    el.name.startsWith('boot_foot_l') ||
    el.name.startsWith('boot_heel_l') ||
    el.name.startsWith('boot_tread_l');

  const isRLegElement = el =>
    el.name.startsWith('thigh_r') ||
    el.name.startsWith('knee_accent_r') ||
    el.name.startsWith('knee_plate_r') ||
    el.name.startsWith('boot_shin_r') ||
    el.name.startsWith('boot_cuff_ring_r') ||
    el.name.startsWith('boot_foot_r') ||
    el.name.startsWith('boot_heel_r') ||
    el.name.startsWith('boot_tread_r');

  if (!isSeated) {
    // ═════════════════════════════════════════════════════════════════════════
    // STANDING MODE (Customization Studio / Full Body Showcase)
    // ═════════════════════════════════════════════════════════════════════════
    const torsoGroup = new THREE.Group();
    torsoGroup.name = 'kirito_torso';
    torsoGroup.position.set(0, 12, 0);
    root.add(torsoGroup);
    group.userData.torso = torsoGroup;

    const headGroup = new THREE.Group();
    headGroup.name = 'kirito_head';
    headGroup.position.set(0, 21.0, 0);
    root.add(headGroup);
    group.userData.head = headGroup;

    const lArmGroup = new THREE.Group();
    lArmGroup.name = 'kirito_lArm';
    lArmGroup.position.set(-3.8, 19.0, 0);
    root.add(lArmGroup);

    const rArmGroup = new THREE.Group();
    rArmGroup.name = 'kirito_rArm';
    rArmGroup.position.set(3.8, 19.0, 0);
    root.add(rArmGroup);

    const lLegGroup = new THREE.Group();
    lLegGroup.name = 'kirito_lLeg';
    lLegGroup.position.set(-1.4, 12.0, 0);
    root.add(lLegGroup);

    const rLegGroup = new THREE.Group();
    rLegGroup.name = 'kirito_rLeg';
    rLegGroup.position.set(1.4, 12.0, 0);
    root.add(rLegGroup);

    KIRITO_BBMODEL_DATA.elements.forEach(el => {
      if (isHeadElement(el)) {
        headGroup.add(createElementNode(el, [0, 21.0, 0], material));
      } else if (isLArmElement(el)) {
        lArmGroup.add(createElementNode(el, [-3.8, 19.0, 0], material));
      } else if (isRArmElement(el)) {
        rArmGroup.add(createElementNode(el, [3.8, 19.0, 0], material));
      } else if (isLLegElement(el)) {
        lLegGroup.add(createElementNode(el, [-1.4, 12.0, 0], material));
      } else if (isRLegElement(el)) {
        rLegGroup.add(createElementNode(el, [1.4, 12.0, 0], material));
      } else {
        torsoGroup.add(createElementNode(el, [0, 12.0, 0], material));
      }
    });
  } else {
    // ═════════════════════════════════════════════════════════════════════════
    // SEATED MODE (Bunker Game Table)
    // ═════════════════════════════════════════════════════════════════════════
    // Chair seat cushion is at y = 0.52m in BunkerScene -> 8.32 BB units
    const pelvisY = 8.32;

    const torsoGroup = new THREE.Group();
    torsoGroup.name = 'kirito_torso';
    torsoGroup.position.set(0, pelvisY, 0);
    root.add(torsoGroup);
    group.userData.torso = torsoGroup;

    // Head neck pivot is 9.0 BB units above pelvis
    const headGroup = new THREE.Group();
    headGroup.name = 'kirito_head';
    headGroup.position.set(0, pelvisY + 9.0, 0);
    root.add(headGroup);
    group.userData.head = headGroup;

    // Add head and torso elements
    KIRITO_BBMODEL_DATA.elements.forEach(el => {
      if (isHeadElement(el)) {
        headGroup.add(createElementNode(el, [0, 21.0, 0], material));
      } else if (
        el.name.startsWith('neck_') ||
        el.name.startsWith('collar_') ||
        el.name.startsWith('torso_') ||
        el.name.startsWith('coat_lapel_') ||
        el.name.startsWith('epaulet_') ||
        el.name.startsWith('harness_') ||
        el.name.startsWith('sword_') ||
        el.name.startsWith('elucidator_') ||
        el.name.startsWith('repulser_')
      ) {
        torsoGroup.add(createElementNode(el, [0, 12.0, 0], material));
      } else if (el.name.startsWith('coat_tail_') || el.name.startsWith('coat_flare_tip_')) {
        let overrides = {};
        const isLeft = el.name.endsWith('_l') || el.name.endsWith('_fl') || el.name.endsWith('_sl') || el.name.endsWith('_bl');
        const sideMult = isLeft ? -1 : 1;

        if (el.name.includes('_front_') || el.name.includes('_fl') || el.name.includes('_fr')) {
          // Front coat tails drape forward over thighs
          overrides = { rx: -75 };
        } else if (el.name.includes('_back_') || el.name.includes('_bl') || el.name.includes('_br')) {
          // Back coat tails flare back/outward around chair cushion
          overrides = { rx: 30, rz: sideMult * 15 };
        } else if (el.name.includes('_side_') || el.name.includes('_sl') || el.name.includes('_sr')) {
          overrides = { rz: sideMult * 12 };
        }
        torsoGroup.add(createElementNode(el, [0, 12.0, 0], material, overrides));
      }
    });

    // Seated Legs (Thighs rotated forward 90°, Lower legs hanging down to floor)
    [-1, 1].forEach(sideMult => {
      const isLeft = sideMult === -1;
      const hipX = sideMult * 1.4;
      const suffix = isLeft ? '_l' : '_r';

      // Hip pivot
      const hipGroup = new THREE.Group();
      hipGroup.position.set(hipX, pelvisY, 0);
      root.add(hipGroup);

      // Thigh rotated 90° forward around X (towards -Z in BB coordinates)
      const thighGroup = new THREE.Group();
      thighGroup.rotation.x = -Math.PI / 2;
      hipGroup.add(thighGroup);

      const thighEl = elemMap.get('thigh' + suffix);
      const kneeAccentEl = elemMap.get('knee_accent' + suffix);
      if (thighEl) thighGroup.add(createElementNode(thighEl, [hipX, 12.0, 0], material));
      if (kneeAccentEl) thighGroup.add(createElementNode(kneeAccentEl, [hipX, 12.0, 0], material));

      // Knee pivot at [hipX, pelvisY, -5.0]
      const lowerLegGroup = new THREE.Group();
      lowerLegGroup.position.set(hipX, pelvisY, -5.0);
      root.add(lowerLegGroup);

      // Lower leg hangs vertically down to bunker floor
      ['knee_plate', 'boot_shin', 'boot_cuff_ring', 'boot_foot', 'boot_heel', 'boot_tread'].forEach(part => {
        const el = elemMap.get(part + suffix);
        if (el) lowerLegGroup.add(createElementNode(el, [hipX, 6.2, 0], material));
      });
    });

    // Seated Arms (Forearms resting forward on bunker table)
    [-1, 1].forEach(sideMult => {
      const isLeft = sideMult === -1;
      const shoulderX = sideMult * 3.8;
      const shoulderY = pelvisY + 7.0;
      const suffix = isLeft ? '_l' : '_r';

      const shoulderGroup = new THREE.Group();
      shoulderGroup.position.set(shoulderX, shoulderY, 0);
      root.add(shoulderGroup);

      // Upper arm tilts forward towards table
      const upperArmGroup = new THREE.Group();
      upperArmGroup.rotation.x = -0.55;
      shoulderGroup.add(upperArmGroup);

      const capEl = elemMap.get('shoulder_cap' + suffix);
      const upperEl = elemMap.get('upper_arm' + suffix);
      const plateEl = isLeft ? elemMap.get('sao_crest_plate_l') : null;
      if (capEl) upperArmGroup.add(createElementNode(capEl, [shoulderX, 19.0, 0], material));
      if (upperEl) upperArmGroup.add(createElementNode(upperEl, [shoulderX, 19.0, 0], material));
      if (plateEl) upperArmGroup.add(createElementNode(plateEl, [shoulderX, 19.0, 0], material));

      // Forearm group at elbow: extends forward resting on table
      const forearmGroup = new THREE.Group();
      forearmGroup.position.set(0, -4.5, 0);
      forearmGroup.rotation.x = -0.72;
      forearmGroup.rotation.y = sideMult * 0.15;
      upperArmGroup.add(forearmGroup);

      ['forearm', 'forearm_strap', 'wrist_cuff_ring', 'glove_hand', 'thumb'].forEach(part => {
        const el = elemMap.get(part + suffix);
        if (el) forearmGroup.add(createElementNode(el, [shoulderX, 14.0, 0], material));
      });
    });
  }

  return group;
}
