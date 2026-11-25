// geometryUtils.js — Advanced Geometry Primitives for Voxel Retro-Futurism Characters
// Provides beveled boxes, tapered limbs, compound body shapes, and AO-enhanced materials.

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Beveled Box — BoxGeometry with chamfer edge strips on all 12 edges
// Creates a blocky shape with beveled corners for a polished voxel look.
// ─────────────────────────────────────────────────────────────────────────────
export function createBeveledBox(w, h, d, bevel = 0.012, material) {
  const group = new THREE.Group();

  // Core box slightly inset so bevels don't overlap
  const coreW = w - bevel * 2;
  const coreH = h - bevel * 2;
  const coreD = d - bevel * 2;

  // 3 intersecting slabs to create a rounded-edge effect
  // Slab XY (front-back coverage)
  const slabXY = new THREE.Mesh(new THREE.BoxGeometry(w, h, coreD), material);
  group.add(slabXY);

  // Slab XZ (top-bottom coverage)
  const slabXZ = new THREE.Mesh(new THREE.BoxGeometry(w, coreH, d), material);
  group.add(slabXZ);

  // Slab YZ (left-right coverage)
  const slabYZ = new THREE.Mesh(new THREE.BoxGeometry(coreW, h, d), material);
  group.add(slabYZ);

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Tapered Box — Trapezoid shape for torso/limbs (wider at top, narrower at bottom or vice versa)
// Uses custom BufferGeometry with 8 vertices for true trapezoidal shape.
// ─────────────────────────────────────────────────────────────────────────────
export function createTaperedBox(wTop, wBot, h, dTop, dBot, material) {
  const geometry = new THREE.BufferGeometry();

  const ht = h / 2;
  const wtH = wTop / 2;
  const wbH = wBot / 2;
  const dtH = (dTop || dBot) / 2;
  const dbH = (dBot || dTop) / 2;

  // 8 vertices: top 4, bottom 4
  const vertices = new Float32Array([
    // Top face (y = +h/2)
    -wtH,  ht, -dtH,  // 0: top-left-back
     wtH,  ht, -dtH,  // 1: top-right-back
     wtH,  ht,  dtH,  // 2: top-right-front
    -wtH,  ht,  dtH,  // 3: top-left-front
    // Bottom face (y = -h/2)
    -wbH, -ht, -dbH,  // 4: bot-left-back
     wbH, -ht, -dbH,  // 5: bot-right-back
     wbH, -ht,  dbH,  // 6: bot-right-front
    -wbH, -ht,  dbH,  // 7: bot-left-front
  ]);

  // 12 triangles (6 faces × 2 triangles)
  const indices = [
    // Top
    0, 2, 1,  0, 3, 2,
    // Bottom
    4, 5, 6,  4, 6, 7,
    // Front
    3, 7, 6,  3, 6, 2,
    // Back
    0, 1, 5,  0, 5, 4,
    // Left
    0, 4, 7,  0, 7, 3,
    // Right
    1, 2, 6,  1, 6, 5,
  ];

  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  return new THREE.Mesh(geometry, material);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Compound Body Part — Multi-mesh body section with bevels and AO strips
// ─────────────────────────────────────────────────────────────────────────────

// Head with jaw taper, ear bumps, and nose bridge
export function createDetailedHead(w, h, d, materials, skinMat, hairMat) {
  const group = new THREE.Group();

  // Main skull - beveled box
  const skull = createBeveledBox(w, h, d, 0.008, materials);
  group.add(skull);

  // Jaw taper (narrower at chin)
  const jawTaper = createTaperedBox(w, w * 0.85, h * 0.3, d, d * 0.9, skinMat);
  jawTaper.position.set(0, -h * 0.35, 0);
  group.add(jawTaper);

  // Chin definition
  const chin = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.5, h * 0.08, d * 0.3),
    skinMat
  );
  chin.position.set(0, -h * 0.52, d * 0.2);
  group.add(chin);

  // Ear bumps (subtle cylindrical protrusions)
  [-1, 1].forEach(side => {
    const ear = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.055, 0.035),
      skinMat
    );
    ear.position.set(side * (w / 2 + 0.008), -h * 0.08, -0.01);
    ear.rotation.y = side * 0.15;
    group.add(ear);

    // Ear inner cavity (darker)
    const earInner = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.035, 0.02),
      new THREE.MeshStandardMaterial({
        color: skinMat.color.clone().multiplyScalar(0.75),
        roughness: 0.8
      })
    );
    earInner.position.set(side * (w / 2 + 0.016), -h * 0.08, 0.002);
    group.add(earInner);
  });

  // Nose bridge (subtle protruding block)
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.05, 0.02),
    skinMat
  );
  nose.position.set(0, -h * 0.05, d / 2 + 0.008);
  group.add(nose);

  // Nose tip
  const noseTip = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.03, 0.015),
    skinMat
  );
  noseTip.position.set(0, -h * 0.14, d / 2 + 0.012);
  group.add(noseTip);

  // Brow ridge (adds shadow definition above eyes)
  const browRidge = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.85, 0.022, 0.025),
    skinMat
  );
  browRidge.position.set(0, h * 0.12, d / 2 + 0.005);
  group.add(browRidge);

  // Under-chin AO shadow strip
  const chinShadow = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.7, 0.008, d * 0.6),
    new THREE.MeshStandardMaterial({
      color: skinMat.color.clone().multiplyScalar(0.6),
      roughness: 0.9,
      metalness: 0
    })
  );
  chinShadow.position.set(0, -h * 0.5, 0);
  group.add(chinShadow);

  return group;
}

// Torso with V-taper for male, hourglass for female
export function createDetailedTorso(w, h, d, baseMat, isFeminine = false) {
  const group = new THREE.Group();

  if (isFeminine) {
    // Upper chest (wider)
    const chestH = h * 0.55;
    const waistH = h * 0.45;
    const chest = createBeveledBox(w, chestH, d, 0.008, baseMat);
    chest.position.set(0, waistH / 2, 0);
    group.add(chest);

    // Waist (pinched)
    const waist = createTaperedBox(w, w * 0.85, waistH, d, d * 0.9, baseMat);
    waist.position.set(0, -chestH / 2, 0);
    group.add(waist);
  } else {
    // Male: V-taper — shoulders wider than waist
    const upperH = h * 0.5;
    const lowerH = h * 0.5;

    // Upper chest (wider)
    const upperChest = createBeveledBox(w, upperH, d, 0.01, baseMat);
    upperChest.position.set(0, lowerH / 2, 0);
    group.add(upperChest);

    // Lower torso (tapered)
    const lowerTorso = createTaperedBox(w, w * 0.88, lowerH, d, d * 0.92, baseMat);
    lowerTorso.position.set(0, -upperH / 2, 0);
    group.add(lowerTorso);

    // Spine channel (subtle groove on back)
    const spineGroove = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, h * 0.85, 0.008),
      new THREE.MeshStandardMaterial({
        color: baseMat.color.clone().multiplyScalar(0.8),
        roughness: 0.85
      })
    );
    spineGroove.position.set(0, 0, -d / 2 - 0.002);
    group.add(spineGroove);
  }

  // Shoulder ridge bevels
  [-1, 1].forEach(side => {
    const shoulderBevel = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.025, d * 0.9),
      baseMat
    );
    shoulderBevel.position.set(side * (w / 2 + 0.01), h / 2 - 0.01, 0);
    shoulderBevel.rotation.z = side * 0.4;
    group.add(shoulderBevel);
  });

  // Under-arm AO strips
  [-1, 1].forEach(side => {
    const aoStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, h * 0.3, d * 0.4),
      new THREE.MeshStandardMaterial({
        color: baseMat.color.clone().multiplyScalar(0.65),
        roughness: 0.9
      })
    );
    aoStrip.position.set(side * (w / 2 - 0.005), h * 0.15, 0);
    group.add(aoStrip);
  });

  return group;
}

// Pelvis with bevels
export function createDetailedPelvis(w, h, d, mat) {
  const group = new THREE.Group();

  // Main pelvis body
  const main = createBeveledBox(w, h, d, 0.008, mat);
  group.add(main);

  // Hip bevels
  [-1, 1].forEach(side => {
    const hipBevel = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, h * 0.6, d * 0.8),
      mat
    );
    hipBevel.position.set(side * (w / 2 + 0.006), 0, 0);
    hipBevel.rotation.z = side * 0.3;
    group.add(hipBevel);
  });

  return group;
}

// Leg segment with taper and muscle definition
export function createDetailedLeg(w, h, d, mat, isThigh = true) {
  const group = new THREE.Group();

  if (isThigh) {
    // Thigh: wider at top, narrower at knee
    const thigh = createTaperedBox(w * 1.05, w * 0.92, h, d * 1.03, d * 0.95, mat);
    group.add(thigh);

    // Inner thigh AO
    const aoInner = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, h * 0.6, d * 0.5),
      new THREE.MeshStandardMaterial({
        color: mat.color.clone().multiplyScalar(0.7),
        roughness: 0.9
      })
    );
    aoInner.position.set(-w * 0.42, 0, 0);
    group.add(aoInner);
  } else {
    // Shin: slight calf bulge at top
    const shin = createTaperedBox(w * 0.95, w * 0.88, h, d * 1.0, d * 0.9, mat);
    group.add(shin);
  }

  // Edge highlight strips on front seam
  const seamStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, h * 0.8, 0.006),
    new THREE.MeshStandardMaterial({
      color: mat.color.clone().multiplyScalar(1.15),
      roughness: 0.5,
      metalness: 0.1
    })
  );
  seamStrip.position.set(0, 0, d / 2 + 0.002);
  group.add(seamStrip);

  return group;
}

// Boot with shaped toe and heel
export function createDetailedBoot(w, h, d, mat, blackMat) {
  const group = new THREE.Group();

  // Main boot body - beveled
  const body = createBeveledBox(w, h, d * 0.85, 0.006, mat);
  group.add(body);

  // Toe cap (protruding front)
  const toeCap = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.95, h * 0.65, d * 0.2),
    mat
  );
  toeCap.position.set(0, -h * 0.1, d * 0.42);
  group.add(toeCap);

  // Heel (raised back)
  const heel = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.75, h * 0.3, d * 0.2),
    blackMat
  );
  heel.position.set(0, -h * 0.35, -d * 0.3);
  group.add(heel);

  // Sole (wider, slightly protruding)
  const sole = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.01, h * 0.15, d + 0.015),
    blackMat
  );
  sole.position.set(0, -h * 0.45, 0.005);
  group.add(sole);

  // Boot top rim
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.008, h * 0.08, d * 0.9 + 0.008),
    mat
  );
  rim.position.set(0, h * 0.46, 0);
  group.add(rim);

  // Lace detail strip (front)
  const laceStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, h * 0.6, 0.008),
    blackMat
  );
  laceStrip.position.set(0, h * 0.1, d * 0.4);
  group.add(laceStrip);

  // Lace eyelets
  for (let i = 0; i < 3; i++) {
    [-1, 1].forEach(side => {
      const eyelet = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, 0.008, 0.005),
        new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.2 })
      );
      eyelet.position.set(side * 0.012, h * 0.3 - i * h * 0.2, d * 0.42);
      group.add(eyelet);
    });
  }

  return group;
}

// Hand with finger separation
export function createDetailedHand(w, h, d, mat) {
  const group = new THREE.Group();

  // Palm
  const palm = new THREE.Mesh(
    new THREE.BoxGeometry(w, h * 0.55, d),
    mat
  );
  group.add(palm);

  // 4 Fingers
  const fingerW = w * 0.2;
  const fingerH = h * 0.5;
  const fingerD = d * 0.7;
  for (let i = 0; i < 4; i++) {
    const fx = -w * 0.35 + i * w * 0.23;
    const fh = fingerH * (1 - Math.abs(i - 1.5) * 0.08);
    const finger = new THREE.Mesh(
      new THREE.BoxGeometry(fingerW, fh, fingerD),
      mat
    );
    finger.position.set(fx, -h * 0.3 - fh * 0.3, 0);
    group.add(finger);
  }

  // Thumb
  const thumb = new THREE.Mesh(
    new THREE.BoxGeometry(fingerW * 1.2, fingerH * 0.6, fingerD * 0.9),
    mat
  );
  thumb.position.set(w * 0.4, -h * 0.1, d * 0.25);
  thumb.rotation.z = -0.5;
  group.add(thumb);

  return group;
}

// Arm segment with taper
export function createDetailedArm(w, h, d, mat, isUpper = true) {
  const group = new THREE.Group();

  if (isUpper) {
    // Shoulder cap (wider at top)
    const shoulderCap = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.15, h * 0.2, d * 1.15),
      mat
    );
    shoulderCap.position.set(0, h * 0.4, 0);
    group.add(shoulderCap);

    // Upper arm - slight taper
    const arm = createTaperedBox(w * 1.05, w * 0.95, h * 0.8, d * 1.03, d * 0.95, mat);
    arm.position.set(0, -h * 0.1, 0);
    group.add(arm);
  } else {
    // Forearm - slight taper
    const arm = createTaperedBox(w, w * 0.88, h, d, d * 0.9, mat);
    group.add(arm);
  }

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AO & Edge Highlight Material Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Create a darkened version of a material for AO shadow areas
export function createAOMaterial(baseMat, darkenFactor = 0.65) {
  return new THREE.MeshStandardMaterial({
    color: baseMat.color.clone().multiplyScalar(darkenFactor),
    roughness: Math.min(baseMat.roughness + 0.15, 1.0),
    metalness: Math.max(baseMat.metalness - 0.05, 0),
  });
}

// Create a lightened version for edge highlights
export function createEdgeHighlightMaterial(baseMat, brightenFactor = 1.2) {
  return new THREE.MeshStandardMaterial({
    color: baseMat.color.clone().multiplyScalar(brightenFactor),
    roughness: Math.max(baseMat.roughness - 0.1, 0.1),
    metalness: baseMat.metalness + 0.05,
  });
}

// Add AO shadow strip under a part (simulates ambient occlusion contact shadow)
export function addAOShadow(parent, w, d, y, baseMat) {
  const aoMat = createAOMaterial(baseMat, 0.5);
  const shadow = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.9, 0.006, d * 0.9),
    aoMat
  );
  shadow.position.set(0, y, 0);
  parent.add(shadow);
  return shadow;
}

// Add clothing seam edge highlight
export function addSeamHighlight(parent, length, axis, pos, baseMat) {
  const hlMat = createEdgeHighlightMaterial(baseMat);
  let geo;
  if (axis === 'x') {
    geo = new THREE.BoxGeometry(length, 0.005, 0.005);
  } else if (axis === 'y') {
    geo = new THREE.BoxGeometry(0.005, length, 0.005);
  } else {
    geo = new THREE.BoxGeometry(0.005, 0.005, length);
  }
  const seam = new THREE.Mesh(geo, hlMat);
  seam.position.copy(pos);
  parent.add(seam);
  return seam;
}
