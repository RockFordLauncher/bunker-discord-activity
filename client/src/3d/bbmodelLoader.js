// bbmodelLoader.js — Universal Native Blockbench (.bbmodel) 3D Model Loader for Three.js
// Supports:
// 1. All Blockbench formats: Bedrock, Free Model, Generic Model, Modded Entity, Box UV & Free UV.
// 2. Embedded Base64 textures, multi-texture models, per-face UV rotation & mapping.
// 3. Hierarchical bone structures (outliner & groups), nested pivots and local Euler rotations ('ZYX').
// 4. Polygon mesh elements (arbitrary vertices/quads/triangles) and cube elements.
// 5. Dual Posing Engine:
//    - 'standing': Full-body upright standing pose for Customization Studio & 3D turntable preview.
//    - 'seated': Natural bunker table chair pose (hip bend, knee bend, arm desk resting, pelvis offset).
// 6. Seamless integration with BunkerScene animation loop (breathing, head gaze, arm subtle movements).

import * as THREE from 'three';

// Cache loaded textures to avoid duplicate GPU allocations
const bbTextureCache = new Map();

/**
 * Parses raw .bbmodel input into a JavaScript object.
 * @param {string|object} input 
 * @returns {object}
 */
export function parseBBModel(input) {
  if (!input) throw new Error('BBModel data is empty');
  if (typeof input === 'string') {
    return JSON.parse(input);
  }
  return input;
}

/**
 * Optimizes a .bbmodel object by removing Blockbench editor metadata,
 * preserving only 3D geometry, hierarchy, and texture assets.
 */
export function optimizeBBModel(raw) {
  if (!raw) return null;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    name: data.name || data.model_identifier || 'custom_model',
    resolution: data.resolution || { width: 256, height: 256 },
    textures: (data.textures || []).map(t => ({
      id: t.id,
      name: t.name,
      source: t.source || t.data,
      uuid: t.uuid,
    })),
    texture: data.texture,
    elements: (data.elements || []).map(e => ({
      name: e.name,
      from: e.from,
      to: e.to,
      origin: e.origin,
      rotation: e.rotation,
      faces: e.faces,
      box_uv: e.box_uv,
      uv_offset: e.uv_offset,
      type: e.type,
      vertices: e.vertices,
      uuid: e.uuid,
    })),
    outliner: data.outliner || [],
    groups: (data.groups || []).map(g => (typeof g === 'object' && g ? {
      name: g.name,
      uuid: g.uuid,
      origin: g.origin,
      rotation: g.rotation,
      children: g.children,
    } : g)),
  };
}

/**
 * Extracts human-readable statistics for the .bbmodel inspector UI.
 */
export function getBBModelStats(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const elemCount = (data.elements || []).length;
    const texCount = (data.textures || []).length + (data.texture ? 1 : 0);
    const res = data.resolution || { width: 256, height: 256 };
    const groupCount = (data.groups || []).length || (data.outliner || []).length;
    return {
      name: data.name || data.model_identifier || 'Blockbench Модель',
      elements: elemCount,
      textures: texCount,
      resolution: `${res.width}x${res.height}`,
      groups: groupCount,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Creates or retrieves a cached Three.js Texture from an image source (data URL or URL).
 */
export function getOrCreateBBTexture(source, name = 'bb_texture') {
  if (!source) return null;
  if (bbTextureCache.has(source)) {
    return bbTextureCache.get(source);
  }

  if (typeof Image === 'undefined') {
    // SSR / Node environment fallback
    return null;
  }

  const img = new Image();
  img.src = source;
  const tex = new THREE.Texture(img);
  tex.name = name;
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

  bbTextureCache.set(source, tex);
  return tex;
}

/**
 * Builds standard PBR materials for all textures in the .bbmodel.
 */
function buildMaterialMap(bbData) {
  const materials = new Map();
  const textures = bbData.textures || [];

  // Default fallback material
  const fallbackMat = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    roughness: 0.8,
    metalness: 0.15,
    side: THREE.DoubleSide,
  });
  materials.set('default', fallbackMat);

  // Check if root has single texture (older export style)
  if (bbData.texture && typeof bbData.texture === 'string') {
    const tex = getOrCreateBBTexture(bbData.texture, 'root_texture');
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.85,
      metalness: 0.15,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
    });
    materials.set('root', mat);
    materials.set(0, mat);
    materials.set('0', mat);
  }

  // Process textures array
  textures.forEach((t, idx) => {
    const src = t.source || t.data || t.path;
    if (src) {
      const tex = getOrCreateBBTexture(src, t.name || `tex_${idx}`);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0.15,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
      });

      materials.set(idx, mat);
      materials.set(String(idx), mat);
      if (t.id !== undefined) materials.set(t.id, mat);
      if (t.uuid) materials.set(t.uuid, mat);
      if (t.name) materials.set(t.name, mat);

      if (!materials.has('primary')) {
        materials.set('primary', mat);
      }
    }
  });

  if (!materials.has('primary')) {
    materials.set('primary', materials.get('root') || fallbackMat);
  }

  return materials;
}

/**
 * Rotates UV coordinate quad according to Blockbench face rotation (0, 90, 180, 270 deg).
 */
function rotateUVQuad(u1, v1, u2, v2, rot = 0) {
  const p0 = [u1, v1]; // top-left
  const p1 = [u2, v1]; // top-right
  const p2 = [u1, v2]; // bottom-left
  const p3 = [u2, v2]; // bottom-right

  switch (rot) {
    case 90:
      return [p2, p0, p3, p1];
    case 180:
      return [p3, p2, p1, p0];
    case 270:
      return [p1, p3, p0, p2];
    default:
      return [p0, p1, p2, p3];
  }
}

/**
 * Builds a Three.js Mesh for a single cube element.
 */
function createCubeMesh(el, texW, texH, materialMap) {
  const from = el.from || [0, 0, 0];
  const to = el.to || [1, 1, 1];

  const minX = Math.min(from[0], to[0]);
  const maxX = Math.max(from[0], to[0]);
  const minY = Math.min(from[1], to[1]);
  const maxY = Math.max(from[1], to[1]);
  const minZ = Math.min(from[2], to[2]);
  const maxZ = Math.max(from[2], to[2]);

  const w = Math.max(0.001, maxX - minX);
  const h = Math.max(0.001, maxY - minY);
  const d = Math.max(0.001, maxZ - minZ);

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const geo = new THREE.BoxGeometry(w, h, d);
  const uvAttr = geo.attributes.uv;

  // Face order in Three.js BoxGeometry:
  // 0: +X (east)
  // 1: -X (west)
  // 2: +Y (up)
  // 3: -Y (down)
  // 4: +Z (south)
  // 5: -Z (north)
  const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];
  const faceMaterials = [];
  let hasMultiMaterial = false;

  // Pre-calculate Box UV if element uses box_uv mode
  let boxUvMap = null;
  if (el.box_uv && el.uv_offset) {
    const [u, v] = el.uv_offset;
    const dx = Math.round(w);
    const dy = Math.round(h);
    const dz = Math.round(d);
    boxUvMap = {
      north: [u + dz, v + dz, u + dz + dx, v + dz + dy],
      south: [u + dz + dx + dz, v + dz, u + dz + dx + dz + dx, v + dz + dy],
      west:  [u, v + dz, u + dz, v + dz + dy],
      east:  [u + dz + dx, v + dz, u + dz + dx + dz, v + dz + dy],
      up:    [u + dz, v, u + dz + dx, v + dz],
      down:  [u + dz + dx, v, u + dz + dx + dx, v + dz],
    };
  }

  for (let fIdx = 0; fIdx < 6; fIdx++) {
    const fName = faceOrder[fIdx];
    const fData = el.faces && el.faces[fName];
    const off = fIdx * 4;

    let uvCoords = null;
    let rot = 0;
    let matKey = null;

    if (fData) {
      uvCoords = fData.uv;
      rot = fData.rotation || 0;
      matKey = fData.texture;
    } else if (boxUvMap && boxUvMap[fName]) {
      uvCoords = boxUvMap[fName];
    }

    // Material resolution for this face
    let faceMat = null;
    if (matKey !== null && matKey !== undefined && materialMap.has(matKey)) {
      faceMat = materialMap.get(matKey);
    } else {
      faceMat = materialMap.get('primary');
    }
    faceMaterials.push(faceMat);
    if (faceMat !== faceMaterials[0]) {
      hasMultiMaterial = true;
    }

    if (!uvCoords || uvCoords.length < 4) {
      for (let v = 0; v < 4; v++) uvAttr.setXY(off + v, 0, 0);
      continue;
    }

    const [u1, v1, u2, v2] = uvCoords;
    const quad = rotateUVQuad(u1, v1, u2, v2, rot);

    for (let v = 0; v < 4; v++) {
      const u = quad[v][0] / texW;
      const valV = 1 - quad[v][1] / texH;
      uvAttr.setXY(off + v, u, valV);
    }
  }
  uvAttr.needsUpdate = true;

  const meshMat = hasMultiMaterial ? faceMaterials : faceMaterials[0];
  const mesh = new THREE.Mesh(geo, meshMat);
  mesh.name = el.name || 'cube';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.element = el;

  return { mesh, cx, cy, cz };
}

/**
 * Builds a Three.js Mesh for an arbitrary polygon mesh element.
 */
function createPolyMesh(el, texW, texH, materialMap) {
  const geo = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];
  const vertices = el.vertices || {};

  const faces = el.faces || {};
  let matKey = null;

  Object.values(faces).forEach(face => {
    if (!face.vertices || face.vertices.length < 3) return;
    if (matKey === null && face.texture !== undefined) matKey = face.texture;

    const fVerts = face.vertices;
    const fUv = face.uv || {};

    // Fan triangulation for quads and polygons
    for (let i = 1; i < fVerts.length - 1; i++) {
      const vIndices = [fVerts[0], fVerts[i], fVerts[i + 1]];
      vIndices.forEach(vKey => {
        const pos = vertices[vKey] || [0, 0, 0];
        positions.push(pos[0], pos[1], pos[2]);

        const uv = fUv[vKey] || [0, 0];
        uvs.push(uv[0] / texW, 1 - uv[1] / texH);
      });
    }
  });

  if (positions.length === 0) return null;

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();

  const mat = (matKey !== null && materialMap.get(matKey)) || materialMap.get('primary');
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = el.name || 'mesh';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.element = el;

  // Origin / center
  const origin = el.origin || [0, 0, 0];
  return { mesh, cx: origin[0], cy: origin[1], cz: origin[2] };
}

/**
 * Builds an element node with proper pivot positioning and rotation.
 */
function createElementObject(el, parentOrigin, texW, texH, materialMap, overrides = {}) {
  let built = null;
  if (el.type === 'mesh') {
    built = createPolyMesh(el, texW, texH, materialMap);
  } else {
    built = createCubeMesh(el, texW, texH, materialMap);
  }

  if (!built) return null;
  const { mesh, cx, cy, cz } = built;

  const rx = overrides.rx !== undefined ? overrides.rx : (el.rotation ? el.rotation[0] : 0);
  const ry = overrides.ry !== undefined ? overrides.ry : (el.rotation ? el.rotation[1] : 0);
  const rz = overrides.rz !== undefined ? overrides.rz : (el.rotation ? el.rotation[2] : 0);

  const hasRot = rx !== 0 || ry !== 0 || rz !== 0;
  const ox = overrides.ox !== undefined ? overrides.ox : (el.origin ? el.origin[0] : cx);
  const oy = overrides.oy !== undefined ? overrides.oy : (el.origin ? el.origin[1] : cy);
  const oz = overrides.oz !== undefined ? overrides.oz : (el.origin ? el.origin[2] : cz);

  if (hasRot) {
    const pivot = new THREE.Group();
    pivot.name = (el.name || 'elem') + '_pivot';
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
 * Recursively builds hierarchical groups from Blockbench outliner and groups arrays.
 */
function buildOutlinerTree(
  outlinerNodes,
  groupByUuid,
  elemByUuid,
  parentOrigin,
  texW,
  texH,
  materialMap,
  consumedElemUuids
) {
  const container = new THREE.Group();

  outlinerNodes.forEach(item => {
    let groupData = null;
    let elemData = null;

    if (typeof item === 'string') {
      // String UUID
      if (groupByUuid.has(item)) {
        groupData = groupByUuid.get(item);
      } else if (elemByUuid.has(item)) {
        elemData = elemByUuid.get(item);
      }
    } else if (typeof item === 'object' && item !== null) {
      if (item.uuid && groupByUuid.has(item.uuid)) {
        groupData = { ...groupByUuid.get(item.uuid), ...item };
      } else if (item.children !== undefined || item.name !== undefined) {
        groupData = item;
      } else if (item.uuid && elemByUuid.has(item.uuid)) {
        elemData = elemByUuid.get(item.uuid);
      }
    }

    if (groupData) {
      const gOrigin = groupData.origin || parentOrigin;
      const gRot = groupData.rotation || [0, 0, 0];

      const grp = new THREE.Group();
      grp.name = groupData.name || 'group';
      grp.userData = { origin: gOrigin, rotation: gRot, uuid: groupData.uuid };

      grp.position.set(
        gOrigin[0] - parentOrigin[0],
        gOrigin[1] - parentOrigin[1],
        gOrigin[2] - parentOrigin[2]
      );

      if (gRot[0] !== 0 || gRot[1] !== 0 || gRot[2] !== 0) {
        grp.rotation.set(
          THREE.MathUtils.degToRad(gRot[0]),
          THREE.MathUtils.degToRad(gRot[1]),
          THREE.MathUtils.degToRad(gRot[2]),
          'ZYX'
        );
      }

      const children = groupData.children || [];
      const childGroup = buildOutlinerTree(
        children,
        groupByUuid,
        elemByUuid,
        gOrigin,
        texW,
        texH,
        materialMap,
        consumedElemUuids
      );
      grp.add(childGroup);
      container.add(grp);
    } else if (elemData) {
      consumedElemUuids.add(elemData.uuid);
      const elemObj = createElementObject(elemData, parentOrigin, texW, texH, materialMap);
      if (elemObj) container.add(elemObj);
    }
  });

  return container;
}

/**
 * Searches the 3D scene hierarchy for standard humanoid bones and parts.
 */
function findHumanoidBones(root) {
  const bones = {
    head: null,
    torso: null,
    leftArm: null,
    rightArm: null,
    leftLeg: null,
    rightLeg: null,
    leftForearm: null,
    rightForearm: null,
  };

  root.traverse(node => {
    if (!node.isGroup) return;
    const name = (node.name || '').toLowerCase();
    if (/buckle|strap|pivot|rivet|badge|crest|button|lace/.test(name)) return;

    if (!bones.head && (/head/i.test(name) || /skull/i.test(name) || /face/i.test(name))) {
      bones.head = node;
    } else if (!bones.torso && (/torso/i.test(name) || /body/i.test(name) || /chest/i.test(name) || /spine/i.test(name))) {
      bones.torso = node;
    } else if (!bones.leftArm && (/(^|[_\s-])(left|l)[_\s-]*arm($|[_\s-])/i.test(name) || /(^|[_\s-])arm[_\s-]*(left|l)($|[_\s-])/i.test(name))) {
      bones.leftArm = node;
    } else if (!bones.rightArm && (/(^|[_\s-])(right|r)[_\s-]*arm($|[_\s-])/i.test(name) || /(^|[_\s-])arm[_\s-]*(right|r)($|[_\s-])/i.test(name))) {
      bones.rightArm = node;
    } else if (!bones.leftLeg && (/(^|[_\s-])(left|l)[_\s-]*leg($|[_\s-])/i.test(name) || /(^|[_\s-])leg[_\s-]*(left|l)($|[_\s-])/i.test(name))) {
      bones.leftLeg = node;
    } else if (!bones.rightLeg && (/(^|[_\s-])(right|r)[_\s-]*leg($|[_\s-])/i.test(name) || /(^|[_\s-])leg[_\s-]*(right|r)($|[_\s-])/i.test(name))) {
      bones.rightLeg = node;
    } else if (!bones.leftForearm && (/left.*forearm/i.test(name) || /l.*forearm/i.test(name) || /left.*hand/i.test(name) || /l.*hand/i.test(name))) {
      bones.leftForearm = node;
    } else if (!bones.rightForearm && (/right.*forearm/i.test(name) || /r.*forearm/i.test(name) || /right.*hand/i.test(name) || /r.*hand/i.test(name))) {
      bones.rightForearm = node;
    }
  });

  return bones;
}

/**
 * Poses a model for the Bunker Table seated position:
 * - Chair cushion height is 0.52m (8.32 BB units)
 * - Legs bend forward ~85°, knees bend down ~85°
 * - Arms tilt forward resting on the table/lap
 * - Coat tails and skirts drape over legs or flare around chair
 */
function isDescendantOf(node, parent) {
  let p = node?.parent;
  while (p) {
    if (p === parent) return true;
    p = p.parent;
  }
  return false;
}

/**
 * Poses a model for the Bunker Table seated position:
 * - Chair cushion height is 0.52m (8.32 BB units)
 * - Upper body (torso, head, arms) shifts down in UNISON (zero gaps, zero detached heads or floating arms!)
 * - Legs bend naturally at hips (thighs forward) and knees (calves down to floor)
 * - Arms tilt forward resting on the table/lap
 * - Coat tails and skirts drape over legs or flare around chair
 */
function applySeatedPose(root, bones, elements) {
  // Chair cushion top is at 0.555m (8.88 BB units); 9.15 BB units (~0.572m) sits cleanly on top
  const pelvisY = 9.15;

  // 1. Determine standing hip height in Blockbench units
  let hipY = 12.0;
  if (bones.torso && bones.torso.userData.origin && bones.torso.userData.origin[1] > 0) {
    hipY = bones.torso.userData.origin[1];
  } else if (bones.leftLeg && bones.leftLeg.userData.origin && bones.leftLeg.userData.origin[1] > 0) {
    hipY = bones.leftLeg.userData.origin[1];
  } else if (bones.torso && bones.torso.position.y > 0) {
    hipY = bones.torso.position.y;
  }

  // Vertical delta needed to place hips on top of chair cushion
  const deltaY = pelvisY - hipY;

  // 2. UNIFIED UPPER BODY & HIP SHIFT:
  // Shift torso first, then any sibling bones not parented under torso so nothing double-shifts or detaches.
  if (bones.torso) {
    bones.torso.position.y += deltaY;
  }
  if (bones.head && !isDescendantOf(bones.head, bones.torso)) {
    bones.head.position.y += deltaY;
  }
  if (bones.leftArm && !isDescendantOf(bones.leftArm, bones.torso)) {
    bones.leftArm.position.y += deltaY;
  }
  if (bones.rightArm && !isDescendantOf(bones.rightArm, bones.torso)) {
    bones.rightArm.position.y += deltaY;
  }

  // 3. Pose Arms:
  // Note: root.rotation.y = Math.PI, so in local root space forward is -Z and limbs hang along -Y.
  // By Three.js right-hand rule around +X, POSITIVE rotation.x swings a -Y limb FORWARD toward -Z.
  if (bones.leftArm) {
    bones.leftArm.rotation.x = 0.72;
    bones.leftArm.rotation.y = -0.10;
  }
  if (bones.rightArm) {
    bones.rightArm.rotation.x = 0.72;
    bones.rightArm.rotation.y = 0.10;
  }

  // Only bend forearm separately if it owns its hand (not when hand is a sibling group)
  const hasDescendantNamed = (node, rx) => {
    let found = false;
    if (node) node.traverse(c => { if (c !== node && rx.test(c.name || '')) found = true; });
    return found;
  };
  if (bones.leftForearm && hasDescendantNamed(bones.leftForearm, /hand/i)) {
    bones.leftForearm.rotation.x = 0.35;
  }
  if (bones.rightForearm && hasDescendantNamed(bones.rightForearm, /hand/i)) {
    bones.rightForearm.rotation.x = 0.35;
  }

  // 4. Pose Legs: Positive rotation.x (+1.42 rad) bends thighs forward toward -Z; shins hang down in front of chair
  const thighAngle = 1.42;
  [bones.leftLeg, bones.rightLeg].forEach((leg) => {
    if (!leg) return;

    if (!isDescendantOf(leg, bones.torso)) {
      leg.position.y += deltaY;
    }

    // Unwrap anonymous outliner container group if present
    const legRoot = (leg.children.length === 1 && !leg.children[0].isMesh && !leg.children[0].name)
      ? leg.children[0]
      : leg;

    // Case A: Nested thigh -> shin/knee hierarchy (shin is a child of thigh)
    let nestedThigh = null;
    let nestedShin = null;
    legRoot.children.forEach(c => {
      if (c.isGroup && /thigh|upper/i.test(c.name || '')) {
        const innerShin = c.children.find(sc => /knee|calf|shin/i.test(sc.name || ''));
        if (innerShin) {
          nestedThigh = c;
          nestedShin = innerShin;
        }
      }
    });

    if (nestedThigh && nestedShin) {
      nestedThigh.rotation.x = thighAngle;
      nestedShin.rotation.x = -thighAngle;
      return;
    }

    // Case B: Sibling child groups (thigh, knee, boot, foot) or direct meshes
    const legParts = [...legRoot.children];
    if (legParts.length > 1) {
      const legHipY = leg.userData?.origin?.[1] || hipY;
      const thighLen = legHipY * 0.46;

      const thighGroup = new THREE.Group();
      thighGroup.name = leg.name + '_thigh';
      thighGroup.rotation.x = thighAngle;

      const lowerLegGroup = new THREE.Group();
      lowerLegGroup.name = leg.name + '_lower';
      // Keep knee joint aligned with the distal end of the forward-rotated thigh
      lowerLegGroup.position.set(
        0,
        thighLen * (1 - Math.cos(thighAngle)),
        -thighLen * Math.sin(thighAngle)
      );
      lowerLegGroup.rotation.x = 0.05;

      legParts.forEach(part => {
        legRoot.remove(part);
        const pName = (part.name || '').toLowerCase();
        if (/knee|shin|calf|boot|foot|shoe|sole|lace|strap|buckle|heel|toe/i.test(pName)) {
          lowerLegGroup.add(part);
        } else if (/thigh|upper|pants|stocking/i.test(pName)) {
          thighGroup.add(part);
        } else {
          const el = part.userData?.element;
          const cy = el?.origin ? el.origin[1] : (el?.from && el?.to ? (el.from[1] + el.to[1]) / 2 : legHipY + part.position.y);
          if (cy > legHipY * 0.58) {
            thighGroup.add(part);
          } else {
            lowerLegGroup.add(part);
          }
        }
      });

      if (thighGroup.children.length > 0 && lowerLegGroup.children.length > 0) {
        legRoot.add(thighGroup);
        legRoot.add(lowerLegGroup);
      } else {
        // Fallback if all parts landed in one group
        [...thighGroup.children, ...lowerLegGroup.children].forEach(p => legRoot.add(p));
        leg.rotation.x = 1.25;
      }
    } else {
      // Single monolithic leg mesh: forward bend
      leg.rotation.x = 1.25;
    }
  });

  // 5. Coat tails / skirt / apron drape (+X forward over thighs, compressed Y & shifted -Z so they don't clip through chair)
  root.traverse(child => {
    const cName = (child.name || '').toLowerCase();
    if (!child.isMesh && !/_pivot$/i.test(cName)) return;
    if (/coat_tail|coat_flare|skirt|petticoat/i.test(cName)) {
      if (/(?:^|_)back(?:$|_)|_b$/i.test(cName)) {
        child.rotation.x = -0.45;
      } else if (/(?:^|_)side(?:$|_)|_s$/i.test(cName)) {
        child.rotation.z = cName.includes('r') ? -0.3 : 0.3;
      } else {
        child.rotation.x = 1.15;
        child.scale.y = 0.65;
        child.position.z -= 0.45;
      }
    } else if (/apron_front/i.test(cName)) {
      child.rotation.x = 0.95;
      child.scale.y = 0.65;
      child.position.y += 1.2;
      child.position.z -= 1.6;
    }
  });

  // 6. Parent arms under torso so upper body & shoulders rotate together seamlessly (no detached arms!)
  if (bones.torso) {
    root.updateMatrixWorld(true);
    if (bones.leftArm && !isDescendantOf(bones.leftArm, bones.torso)) {
      bones.torso.attach(bones.leftArm);
    }
    if (bones.rightArm && !isDescendantOf(bones.rightArm, bones.torso)) {
      bones.torso.attach(bones.rightArm);
    }
  }
}

/**
 * Builds a complete Three.js character model directly from Blockbench (.bbmodel) data.
 * @param {string|object} bbData Raw JSON string or parsed object of .bbmodel
 * @param {object} opts Options: { mode: 'standing' | 'seated', scaleMultiplier: 1.0, cust: {}, headScale: 1.0 }
 * @returns {THREE.Group} Fully sculpted, posed, and animated Three.js Group
 */
export function buildBBModel(bbData, opts = {}) {
  const data = parseBBModel(bbData);
  const mode = opts.mode || 'standing';
  const isSeated = mode === 'seated';

  const group = new THREE.Group();
  group.userData = {
    bbmodel: true,
    modelName: data.name || data.model_identifier || 'bbmodel_character',
    mode,
    raw: data,
  };

  const res = data.resolution || {};
  const texW = res.width || 256;
  const texH = res.height || 256;

  // Build materials
  const materialMap = buildMaterialMap(data);

  // Group definitions map
  const groupByUuid = new Map();
  (data.groups || []).forEach(g => {
    if (g && g.uuid) groupByUuid.set(g.uuid, g);
  });

  // Elements map
  const elements = data.elements || [];
  const elemByUuid = new Map(elements.map(e => [e.uuid, e]));
  const consumedElemUuids = new Set();

  // Model root: 1 Blockbench unit = 0.0625m (1/16m)
  // Rotating Math.PI around Y aligns Blockbench North (-Z) with Three.js forward (+Z)
  const root = new THREE.Group();
  root.name = 'bbmodel_root';
  const baseScale = 0.0625 * (opts.scaleMultiplier || 1.0);
  root.scale.set(baseScale, baseScale, baseScale);
  root.rotation.y = Math.PI;
  group.add(root);

  // Build hierarchy from outliner
  const outliner = data.outliner || [];
  if (outliner.length > 0) {
    const outlinerGroup = buildOutlinerTree(
      outliner,
      groupByUuid,
      elemByUuid,
      [0, 0, 0],
      texW,
      texH,
      materialMap,
      consumedElemUuids
    );
    root.add(outlinerGroup);
  }

  // Any leftover elements not consumed in outliner (flat models or unparented elements)
  elements.forEach(el => {
    if (!consumedElemUuids.has(el.uuid)) {
      const elemObj = createElementObject(el, [0, 0, 0], texW, texH, materialMap);
      if (elemObj) root.add(elemObj);
    }
  });

  // Humanoid bone identification & animation binding
  const bones = findHumanoidBones(root);

  // Bind key animated bones into userData for BunkerScene / PreviewScene loop
  if (bones.head) group.userData.head = bones.head;
  if (bones.torso) group.userData.torso = bones.torso;
  if (bones.leftArm) group.userData.leftArm = bones.leftArm;
  if (bones.rightArm) group.userData.rightArm = bones.rightArm;
  if (bones.leftForearm) group.userData.lForearm = bones.leftForearm;
  if (bones.rightForearm) group.userData.rForearm = bones.rightForearm;

  // First-person mode helper: hides ONLY head & neck meshes so torso, arms, hands, and legs remain visible
  group.userData.setFirstPersonMode = (enabled) => {
    const visible = !enabled;
    if (bones.head) {
      bones.head.visible = visible;
    }
    root.traverse((node) => {
      const n = (node.name || '').toLowerCase();
      if (
        /^(head|neck|face|skull|hair|helmet|gasmask|sunglasses|headdress)/.test(n) ||
        /_(head|neck)$/.test(n)
      ) {
        node.visible = visible;
      }
    });
  };

  // Apply Seated or Standing Poses
  if (isSeated) {
    applySeatedPose(root, bones, elements);
    const snap = (node) => node ? {
      pos: { x: node.position.x, y: node.position.y, z: node.position.z },
      rot: { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z },
      scale: { x: node.scale.x, y: node.scale.y, z: node.scale.z },
    } : null;
    group.userData.seatedBase = {
      torso: snap(bones.torso),
      head: snap(bones.head),
      leftArm: snap(bones.leftArm),
      rightArm: snap(bones.rightArm),
      leftForearm: snap(bones.leftForearm),
      rightForearm: snap(bones.rightForearm),
    };
  }

  // Head scale adjustment (supports slider in customization)
  const headScale = (opts.cust && opts.cust.headScale !== undefined)
    ? opts.cust.headScale
    : (opts.headScale !== undefined ? opts.headScale : (data.headScale || 1.0));

  if (bones.head && headScale !== 1.0) {
    // If head group pivot was at [0,0,0], find neck height so scaling happens from neck upward
    const headOriginY = bones.head.userData?.origin ? bones.head.userData.origin[1] : bones.head.position.y;
    if (headOriginY === 0) {
      const headElems = elements.filter(e => /head|hair|face|chin|sunglasses|eye|mouth|ear/i.test(e.name));
      if (headElems.length > 0) {
        const neckY = Math.min(...headElems.map(e => Math.min(e.from[1], e.to[1])));
        if (neckY > 15) {
          bones.head.position.y += neckY;
          bones.head.children.forEach(c => {
            c.position.y -= neckY;
          });
        }
      }
    }
    bones.head.scale.set(headScale, headScale, headScale);
  }

  // Bounding box validation & auto-grounding for standing mode
  if (!isSeated) {
    const box = new THREE.Box3().setFromObject(group);
    if (box.min.y < -0.01) {
      // Offset root if any elements are below y = 0 ground level
      root.position.y += Math.abs(box.min.y);
    }
  }

  return group;
}
