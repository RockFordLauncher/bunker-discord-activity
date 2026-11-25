// meshPrimitives.js — Sculpted Polygonal BufferGeometry Builders & Atlas UV/Merge Utilities
// Zero primitive cuboid bricks: all shapes use superellipse lofts, beveled extrusions,
// contoured anatomical meshes, Bishop-frame curved strands, and smooth/creased normals.

import * as THREE from 'three';
import {
  mergeGeometries,
  toCreasedNormals,
  deinterleaveGeometry,
} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _mat4 = new THREE.Matrix4();

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. UV & Geometry Merge Normalization Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remaps all UVs of `geo` (assumed in [0, 1]^2) into a packed atlas region.
 * Supports either { u0, v0, u1, v1 } or raw pixel rect { x, y, w, h, atlasWidth, atlasHeight }.
 * Applies half-texel inset by default to prevent bilinear filtering bleed across padded slots.
 */
export function remapGeometryUVs(geo, region, options = {}) {
  const uv = geo?.attributes?.uv;
  if (!uv || !region) return geo;

  const atlasW = region.atlasWidth || options.atlasWidth || options.atlasSize || 512;
  const atlasH = region.atlasHeight || options.atlasHeight || options.atlasSize || 512;

  let u0;
  let v0;
  let u1;
  let v1;

  if (region.u0 !== undefined && region.v0 !== undefined && region.u1 !== undefined && region.v1 !== undefined) {
    ({ u0, v0, u1, v1 } = region);
  } else if (region.x !== undefined && region.y !== undefined && region.w !== undefined && region.h !== undefined) {
    u0 = region.x / atlasW;
    u1 = (region.x + region.w) / atlasW;
    v0 = 1 - (region.y + region.h) / atlasH;
    v1 = 1 - region.y / atlasH;
  } else {
    return geo;
  }

  const insetPx = options.insetPx ?? 0.5;
  const maxEpsU = Math.max(0, (u1 - u0) * 0.25);
  const maxEpsV = Math.max(0, (v1 - v0) * 0.25);
  const epsU = Math.min(insetPx / atlasW, maxEpsU);
  const epsV = Math.min(insetPx / atlasH, maxEpsV);

  const uA = u0 + epsU;
  const uB = u1 - epsU;
  const vA = v0 + epsV;
  const vB = v1 - epsV;
  const du = uB - uA;
  const dv = vB - vA;

  const doClamp = options.clamp !== false;
  const flipV = options.flipV === true;

  for (let i = 0; i < uv.count; i++) {
    let u = uv.getX(i);
    let v = uv.getY(i);
    if (!Number.isFinite(u)) u = 0.5;
    if (!Number.isFinite(v)) v = 0.5;
    if (doClamp) {
      u = clamp01(u);
      v = clamp01(v);
    }
    if (flipV) v = 1 - v;
    uv.setXY(i, uA + u * du, vA + v * dv);
  }

  uv.needsUpdate = true;
  return geo;
}

/**
 * Normalizes UVs in-place into [0, 1]^2 from geometry bounding box.
 * Critical for THREE.ExtrudeGeometry whose native UVs are in raw shape/world units.
 */
export function normalizeBoxProjectedUVs(geo, mode = 'triplanar') {
  const pos = geo?.attributes?.position;
  if (!pos || pos.count === 0) return geo;

  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const spanX = Math.max(bb.max.x - bb.min.x, 1e-5);
  const spanY = Math.max(bb.max.y - bb.min.y, 1e-5);
  const spanZ = Math.max(bb.max.z - bb.min.z, 1e-5);

  if (!geo.attributes.normal) {
    geo.computeVertexNormals();
  }
  const norm = geo.attributes.normal;

  let uv = geo.attributes.uv;
  if (!uv || uv.count !== pos.count || uv.isInterleavedBufferAttribute) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    geo.setAttribute('uv', uv);
  }

  for (let i = 0; i < pos.count; i++) {
    const x = (pos.getX(i) - bb.min.x) / spanX;
    const y = (pos.getY(i) - bb.min.y) / spanY;
    const z = (pos.getZ(i) - bb.min.z) / spanZ;

    let u = x;
    let v = y;

    if (mode === 'triplanar' && norm) {
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      const nz = Math.abs(norm.getZ(i));
      if (nz >= nx && nz >= ny) {
        u = x;
        v = y;
      } else if (nx >= ny && nx >= nz) {
        u = z;
        v = y;
      } else {
        u = x;
        v = z;
      }
    }

    // Keep slightly inside [0.02, 0.98] so beveled side walls stay cleanly within atlas padding
    uv.setXY(i, 0.02 + clamp01(u) * 0.96, 0.02 + clamp01(v) * 0.96);
  }

  uv.needsUpdate = true;
  return geo;
}

function toPlainFloat32Attribute(attr, itemSize, defaultFill = null) {
  const count = attr.count;
  const arr = new Float32Array(count * itemSize);
  if (defaultFill !== null) {
    arr.fill(defaultFill);
  } else {
    for (let i = 0; i < count; i++) {
      arr[i * itemSize] = attr.getX(i);
      if (itemSize >= 2) arr[i * itemSize + 1] = attr.getY(i);
      if (itemSize >= 3) arr[i * itemSize + 2] = attr.getZ(i);
    }
  }
  return new THREE.BufferAttribute(arr, itemSize, false);
}

/**
 * Normalizes any BufferGeometry for safe THREE.BufferGeometryUtils.mergeGeometries():
 * converts indexed -> non-indexed, deinterleaves, keeps strictly ['position', 'normal', 'uv'],
 * and clears morphAttributes.
 */
export function normalizeGeometryForMerge(geo) {
  if (!geo) return null;
  let g = geo.index ? geo.toNonIndexed() : geo.clone();

  // Check if any attribute is interleaved and deinterleave safely
  const hasInterleaved = Object.values(g.attributes).some(
    (attr) => attr && attr.isInterleavedBufferAttribute
  );
  if (hasInterleaved) {
    g = deinterleaveGeometry(g);
  }

  const posAttr = g.attributes.position;
  if (!posAttr || posAttr.count === 0) {
    g.dispose();
    return null;
  }

  if (posAttr.isInterleavedBufferAttribute || !(posAttr.array instanceof Float32Array) || posAttr.normalized) {
    g.setAttribute('position', toPlainFloat32Attribute(posAttr, 3));
  }

  if (!g.attributes.normal) {
    g.computeVertexNormals();
  }
  const normAttr = g.attributes.normal;
  if (
    !normAttr ||
    normAttr.isInterleavedBufferAttribute ||
    !(normAttr.array instanceof Float32Array) ||
    normAttr.normalized
  ) {
    g.setAttribute('normal', normAttr ? toPlainFloat32Attribute(normAttr, 3) : toPlainFloat32Attribute(posAttr, 3, 0));
  }

  const uvAttr = g.attributes.uv;
  if (!uvAttr) {
    g.setAttribute('uv', toPlainFloat32Attribute(posAttr, 2, 0.5));
  } else if (
    uvAttr.isInterleavedBufferAttribute ||
    !(uvAttr.array instanceof Float32Array) ||
    uvAttr.normalized
  ) {
    g.setAttribute('uv', toPlainFloat32Attribute(uvAttr, 2));
  }

  // Strip any extra attributes (tangent, uv1, color, etc.) so mergeGeometries never fails
  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal' && key !== 'uv') {
      g.deleteAttribute(key);
    }
  }

  g.morphAttributes = {};
  g.morphTargetsRelative = false;
  g.clearGroups();
  return g;
}

/**
 * Merges an array of BufferGeometries, THREE.Meshes, or { geometry, matrix } descriptors
 * into a single THREE.Mesh (single draw call per bone/material).
 */
export function mergeBoneParts(parts, material, options = {}) {
  if (!Array.isArray(parts) || parts.length === 0) return null;

  const normalizedList = [];
  const inputsToDispose = [];

  for (const part of parts) {
    if (!part) continue;
    let workingGeo = null;

    if (part.isMesh) {
      if (!part.geometry) continue;
      part.updateMatrix();
      workingGeo = part.geometry.clone();
      if (!part.matrix.equals(_mat4.identity())) {
        workingGeo.applyMatrix4(part.matrix);
      }
      if (options.disposeInputs) inputsToDispose.push(part.geometry);
    } else if (part.isBufferGeometry) {
      workingGeo = part.clone();
      if (options.disposeInputs) inputsToDispose.push(part);
    } else if (part.geometry && part.geometry.isBufferGeometry) {
      workingGeo = part.geometry.clone();
      if (part.matrix) {
        workingGeo.applyMatrix4(part.matrix);
      }
      if (options.disposeInputs) inputsToDispose.push(part.geometry);
    } else {
      continue;
    }

    const normGeo = normalizeGeometryForMerge(workingGeo);
    workingGeo.dispose();
    if (normGeo) {
      normalizedList.push(normGeo);
    }
  }

  if (normalizedList.length === 0) {
    for (const g of inputsToDispose) g.dispose();
    return null;
  }

  const useGroups = options.useGroups === true;
  const merged = mergeGeometries(normalizedList, useGroups);

  for (const g of normalizedList) g.dispose();
  for (const g of inputsToDispose) g.dispose();

  if (!merged) {
    throw new Error('mergeBoneParts: BufferGeometryUtils.mergeGeometries returned null');
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  if (options.name) mesh.name = options.name;
  return mesh;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Smooth Seam-Welded Normal Helper
// ─────────────────────────────────────────────────────────────────────────────

function averageSeamNormals(geo, radialSegments, ringCount) {
  const norm = geo.attributes.normal;
  if (!norm) return;
  const stride = radialSegments + 1;
  for (let r = 0; r < ringCount; r++) {
    const i0 = r * stride;
    const iN = r * stride + radialSegments;
    const nx = norm.getX(i0) + norm.getX(iN);
    const ny = norm.getY(i0) + norm.getY(iN);
    const nz = norm.getZ(i0) + norm.getZ(iN);
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(iN, nx / len, ny / len, nz / len);
  }
  norm.needsUpdate = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Core Lofted Tube Builder (Torso, Limbs, Neck, Collars, Sleeves, Cuffs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates an anatomical or beveled lofted BufferGeometry from cross-section rings.
 * Each ring: { y, rx, rz, x=0, z=0, rotX=0, rotY=0, rotZ=0, superPower=2.0, flattenFront=0, flattenBack=0, crease=false, v }
 * or explicit { points: Array<[x,y,z] | Vector3>, crease=false, v }.
 */
export function createLoftedTube(rings, options = {}) {
  if (!Array.isArray(rings) || rings.length < 2) {
    throw new Error('createLoftedTube requires at least 2 rings');
  }

  const radialSegments = Math.max(4, options.radialSegments ?? 14);
  const capBottom = options.capBottom !== false;
  const capTop = options.capTop !== false;
  const bevelCap = options.bevelCap === true;
  const bevelRatio = options.bevelRatio ?? 0.22;
  const bevelHeight = options.bevelHeight ?? 0.008;
  const smooth = options.smooth !== false;
  const creaseAngle = options.creaseAngle ?? Math.PI / 3;
  const uMin = options.uMin ?? 0;
  const uMax = options.uMax ?? 1;
  const vMin = options.vMin ?? 0;
  const vMax = options.vMax ?? 1;

  // Build effective rings list (optionally inserting chamfered end bevel rings)
  const workingRings = rings.map((r) => ({ ...r }));

  if (bevelCap) {
    const first = workingRings[0];
    const last = workingRings[workingRings.length - 1];
    const dirY = (last.y ?? 0) >= (first.y ?? 0) ? 1 : -1;

    if (capBottom && !first.points) {
      workingRings.unshift({
        ...first,
        y: (first.y ?? 0) - dirY * bevelHeight,
        rx: Math.max(0.001, (first.rx ?? 0.05) * (1 - bevelRatio)),
        rz: Math.max(0.001, (first.rz ?? 0.05) * (1 - bevelRatio)),
        crease: true,
        v: undefined,
      });
    }
    if (capTop && !last.points) {
      workingRings.push({
        ...last,
        y: (last.y ?? 0) + dirY * bevelHeight,
        rx: Math.max(0.001, (last.rx ?? 0.05) * (1 - bevelRatio)),
        rz: Math.max(0.001, (last.rz ?? 0.05) * (1 - bevelRatio)),
        crease: true,
        v: undefined,
      });
    }
  }

  const ringCount = workingRings.length;
  const stride = radialSegments + 1;

  // Compute ring centers & cumulative arc-length for V coordinates
  const centers = [];
  const cumDist = [0];
  for (let r = 0; r < ringCount; r++) {
    const ring = workingRings[r];
    let cx = ring.x ?? 0;
    let cy = ring.y ?? 0;
    let cz = ring.z ?? 0;
    if (Array.isArray(ring.points) && ring.points.length > 0) {
      cx = 0;
      cy = 0;
      cz = 0;
      for (const p of ring.points) {
        const px = Array.isArray(p) ? p[0] : p.x;
        const py = Array.isArray(p) ? p[1] : p.y;
        const pz = Array.isArray(p) ? p[2] : p.z;
        cx += px;
        cy += py;
        cz += pz;
      }
      cx /= ring.points.length;
      cy /= ring.points.length;
      cz /= ring.points.length;
    }
    centers.push(new THREE.Vector3(cx, cy, cz));
    if (r > 0) {
      cumDist.push(cumDist[r - 1] + centers[r].distanceTo(centers[r - 1]));
    }
  }
  const totalLen = Math.max(cumDist[ringCount - 1], 1e-5);

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r < ringCount; r++) {
    const ring = workingRings[r];
    const tV = ring.v !== undefined ? ring.v : cumDist[r] / totalLen;
    const vCoord = vMin + tV * (vMax - vMin);

    if (Array.isArray(ring.points)) {
      const pts = ring.points;
      for (let s = 0; s <= radialSegments; s++) {
        const idx = s % pts.length;
        const p = pts[idx];
        const px = Array.isArray(p) ? p[0] : p.x;
        const py = Array.isArray(p) ? p[1] : p.y;
        const pz = Array.isArray(p) ? p[2] : p.z;
        positions.push(px, py, pz);
        uvs.push(uMin + (s / radialSegments) * (uMax - uMin), vCoord);
      }
    } else {
      const rx = Math.max(0.0005, ring.rx ?? 0.05);
      const rz = Math.max(0.0005, ring.rz ?? rx);
      const cx = ring.x ?? 0;
      const cy = ring.y ?? 0;
      const cz = ring.z ?? 0;
      const pwr = Math.max(1.2, ring.superPower ?? 2.0);
      const exp = 2 / pwr;
      const flatF = ring.flattenFront ?? 0;
      const flatB = ring.flattenBack ?? 0;
      const hasRot = (ring.rotX || ring.rotY || ring.rotZ) ? true : false;
      if (hasRot) {
        _euler.set(ring.rotX ?? 0, ring.rotY ?? 0, ring.rotZ ?? 0, 'YXZ');
        _quat.setFromEuler(_euler);
      }

      for (let s = 0; s <= radialSegments; s++) {
        const theta = (s / radialSegments) * Math.PI * 2;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        const sx = Math.sign(sinT) * Math.pow(Math.abs(sinT), exp);
        let sz = Math.sign(cosT) * Math.pow(Math.abs(cosT), exp);
        if (sz >= 0 && flatF !== 0) sz *= 1 - flatF;
        if (sz < 0 && flatB !== 0) sz *= 1 - flatB;

        _vecA.set(sx * rx, 0, sz * rz);
        if (hasRot) _vecA.applyQuaternion(_quat);
        positions.push(_vecA.x + cx, _vecA.y + cy, _vecA.z + cz);
        uvs.push(uMin + (s / radialSegments) * (uMax - uMin), vCoord);
      }
    }
  }

  // Determine spine winding direction by testing the first non-degenerate quad's outward radial dot product
  let flipWinding = false;
  for (let r = 0; r < ringCount - 1; r++) {
    const a = r * stride;
    const b = r * stride + 1;
    const c = (r + 1) * stride + 1;
    _vecA.set(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]);
    _vecB.set(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]);
    _vecC.set(positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2]);
    const e1 = _vecB.clone().sub(_vecA);
    const e2 = _vecC.clone().sub(_vecA);
    const triNormal = e1.cross(e2);
    const midCenter = centers[r].clone().lerp(centers[r + 1], 0.5);
    const radialOut = _vecA.clone().sub(midCenter);
    if (triNormal.lengthSq() > 1e-12 && radialOut.lengthSq() > 1e-12) {
      flipWinding = triNormal.dot(radialOut) < 0;
      break;
    }
  }

  for (let r = 0; r < ringCount - 1; r++) {
    for (let s = 0; s < radialSegments; s++) {
      const i00 = r * stride + s;
      const i10 = r * stride + (s + 1);
      const i11 = (r + 1) * stride + (s + 1);
      const i01 = (r + 1) * stride + s;
      if (!flipWinding) {
        indices.push(i00, i10, i11);
        indices.push(i00, i11, i01);
      } else {
        indices.push(i00, i11, i10);
        indices.push(i00, i01, i11);
      }
    }
  }

  // End caps (triangle fan to center pole with separate cap vertices for clean UV/normals)
  if (capBottom) {
    const c = centers[0];
    const ring0 = workingRings[0];
    const rx0 = Math.max(ring0.rx ?? 0.05, 1e-4);
    const rz0 = Math.max(ring0.rz ?? rx0, 1e-4);
    const baseIdx = positions.length / 3;
    positions.push(c.x, c.y, c.z);
    uvs.push(uMin + 0.5 * (uMax - uMin), vMin + 0.5 * (vMax - vMin));
    for (let s = 0; s <= radialSegments; s++) {
      const src = s * 3;
      const px = positions[src];
      const py = positions[src + 1];
      const pz = positions[src + 2];
      positions.push(px, py, pz);
      const cu = 0.5 + ((px - c.x) / (2 * rx0)) * 0.8;
      const cv = 0.5 + ((pz - c.z) / (2 * rz0)) * 0.8;
      uvs.push(uMin + clamp01(cu) * (uMax - uMin), vMin + clamp01(cv) * (vMax - vMin));
    }
    for (let s = 0; s < radialSegments; s++) {
      if (!flipWinding) {
        indices.push(baseIdx, baseIdx + 1 + s + 1, baseIdx + 1 + s);
      } else {
        indices.push(baseIdx, baseIdx + 1 + s, baseIdx + 1 + s + 1);
      }
    }
  }

  if (capTop) {
    const rLast = ringCount - 1;
    const c = centers[rLast];
    const ringL = workingRings[rLast];
    const rxL = Math.max(ringL.rx ?? 0.05, 1e-4);
    const rzL = Math.max(ringL.rz ?? rxL, 1e-4);
    const baseIdx = positions.length / 3;
    positions.push(c.x, c.y, c.z);
    uvs.push(uMin + 0.5 * (uMax - uMin), vMin + 0.5 * (vMax - vMin));
    for (let s = 0; s <= radialSegments; s++) {
      const src = (rLast * stride + s) * 3;
      const px = positions[src];
      const py = positions[src + 1];
      const pz = positions[src + 2];
      positions.push(px, py, pz);
      const cu = 0.5 + ((px - c.x) / (2 * rxL)) * 0.8;
      const cv = 0.5 + ((pz - c.z) / (2 * rzL)) * 0.8;
      uvs.push(uMin + clamp01(cu) * (uMax - uMin), vMin + clamp01(cv) * (vMax - vMin));
    }
    for (let s = 0; s < radialSegments; s++) {
      if (!flipWinding) {
        indices.push(baseIdx, baseIdx + 1 + s, baseIdx + 1 + s + 1);
      } else {
        indices.push(baseIdx, baseIdx + 1 + s + 1, baseIdx + 1 + s);
      }
    }
  }

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const hasCrease = !smooth || workingRings.some((r) => r.crease);
  if (hasCrease) {
    // Average seam first so smooth areas stay welded before creasing sharp edges
    averageSeamNormals(geo, radialSegments, ringCount);
    geo = toCreasedNormals(geo, creaseAngle);
  } else {
    averageSeamNormals(geo, radialSegments, ringCount);
  }

  if (options.uvRegion) {
    remapGeometryUVs(geo, options.uvRegion, options);
  }

  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Beveled Polygonal Extrude (Plates, Buckles, Soles, Collars, Blades)
// ─────────────────────────────────────────────────────────────────────────────

export function createBeveledExtrude(contour2D, depth = 0.02, bevelConfig = {}) {
  let shape;
  if (contour2D && contour2D.isShape) {
    shape = contour2D;
  } else if (Array.isArray(contour2D) && contour2D.length >= 3) {
    shape = new THREE.Shape();
    for (let i = 0; i < contour2D.length; i++) {
      const pt = contour2D[i];
      const px = Array.isArray(pt) ? pt[0] : pt.x;
      const py = Array.isArray(pt) ? pt[1] : pt.y;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();
  } else {
    throw new Error('createBeveledExtrude requires a THREE.Shape or contour array of >=3 points');
  }

  const bevelEnabled = bevelConfig.bevelEnabled !== false;
  const bevelThickness = bevelConfig.bevelThickness ?? 0.004;
  const bevelSize = bevelConfig.bevelSize ?? 0.004;
  const bevelSegments = bevelConfig.bevelSegments ?? 2;
  const curveSegments = bevelConfig.curveSegments ?? 8;
  const centerZ = bevelConfig.centerZ !== false;
  const centerXY = bevelConfig.centerXY === true;
  const creaseAngle = bevelConfig.creaseAngle ?? Math.PI / 4;

  let geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments,
  });

  geo.computeBoundingBox();
  if (centerZ || centerXY) {
    const bb = geo.boundingBox;
    const tx = centerXY ? -0.5 * (bb.min.x + bb.max.x) : 0;
    const ty = centerXY ? -0.5 * (bb.min.y + bb.max.y) : 0;
    const tz = centerZ ? -0.5 * (bb.min.z + bb.max.z) : 0;
    geo.translate(tx, ty, tz);
  }

  normalizeBoxProjectedUVs(geo, bevelConfig.uvMode || 'triplanar');
  geo = toCreasedNormals(geo, creaseAngle);

  if (bevelConfig.uvRegion) {
    remapGeometryUVs(geo, bevelConfig.uvRegion, bevelConfig);
  }

  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Sculpted Anatomical / Anime Head + Integrated Ears
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a contoured stylized/anime head with rounded cranium, cheek & jaw taper,
 * brow ridge, recessed orbital sockets, nose bridge & tip, lip/chin contour, and ears.
 * Front facial triangles map cleanly into `faceUVRegion`; back/cranium/ears map to `skinUVRegion`.
 */
export function createSculptedHead(params = {}) {
  const width = params.width ?? 0.228;
  const height = params.height ?? 0.252;
  const depth = params.depth ?? 0.218;
  const isFeminine = params.isFeminine === true;
  const jawTaper = params.jawTaper ?? (isFeminine ? 0.65 : 0.78);
  const chinWidth = params.chinWidth ?? (isFeminine ? 0.28 : 0.42);
  const browProminence = params.browProminence ?? (isFeminine ? 0.006 : 0.011);
  const noseLength = params.noseLength ?? (isFeminine ? 0.026 : 0.032);
  const noseBridge = params.noseBridge ?? (isFeminine ? 0.011 : 0.016);
  const eyeSocketDepth = params.eyeSocketDepth ?? 0.007;
  const latSegs = Math.max(12, params.latSegments ?? 20);
  const lonSegs = Math.max(16, params.lonSegments ?? 26);
  const includeEars = params.includeEars !== false;
  const faceUVRegion = params.faceUVRegion || null;
  const skinUVRegion = params.skinUVRegion || null;

  const rx = width * 0.5;
  const ry = height * 0.5;
  const rz = depth * 0.5;

  // Angular bounds for front facial projection (aligned with drawFaceRegion coordinates)
  // Eyes at (0.32, 0.46) & (0.68, 0.46) -> u=(0.32, 0.68), v=0.54
  const maxTheta = 1.05; // ~60 deg
  const maxPhi = 1.10;   // ~63 deg

  const stride = lonSegs + 1;
  const positions = [];
  const uvs = [];
  const thetas = [];
  const phis = [];
  const indices = [];

  const gaussian = (val, center, sigma) => {
    const d = (val - center) / sigma;
    return Math.exp(-0.5 * d * d);
  };

  for (let i = 0; i <= latSegs; i++) {
    const vNorm = i / latSegs; // 0 = chin (-PI/2), 1 = crown (+PI/2)
    const phi = (vNorm - 0.5) * Math.PI;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    for (let j = 0; j <= lonSegs; j++) {
      const uNorm = j / lonSegs; // 0 = -PI (back), 0.5 = 0 (+Z front), 1 = +PI (back)
      const theta = (uNorm - 0.5) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      // Unit sphere direction (+Z is front when theta = 0)
      const nx = cosPhi * sinTheta;
      const ny = sinPhi;
      const nz = cosPhi * cosTheta;

      let x = nx * rx;
      let y = ny * ry;
      let z = nz * rz;

      // 1. Cranium & occiput fullness
      if (ny > 0.05) {
        const craniumFactor = 1 + 0.065 * gaussian(ny, 0.42, 0.35);
        x *= craniumFactor;
        if (nz < -0.1) {
          z *= 1 + 0.09 * Math.abs(nz) * gaussian(ny, 0.28, 0.45);
        }
      }

      // 2. Cheek fullness & jawline / chin taper
      if (ny < 0.05) {
        const tDown = clamp01((0.05 - ny) / 1.05);
        const cheekBoost = 1 + (isFeminine ? 0.035 : 0.015) * gaussian(ny, -0.08, 0.16) * (nz > 0 ? 1 : 0.4);
        const jawMul =
          tDown < 0.65
            ? 1 - (1 - jawTaper) * Math.pow(tDown / 0.65, 1.35)
            : jawTaper - (jawTaper - chinWidth) * Math.pow((tDown - 0.65) / 0.35, 1.15);
        x *= jawMul * cheekBoost;
        // Pull chin forward slightly & soften bottom tip
        if (nz > 0) {
          z += (isFeminine ? 0.008 : 0.012) * gaussian(ny, -0.68, 0.25) * Math.pow(nz, 1.4);
        }
        // Subtle jawline compression from underneath
        if (ny < -0.55 && nz < 0.2) {
          z *= 1 - 0.14 * clamp01((-0.55 - ny) / 0.45);
        }
      }

      // 3. Facial plane flattening on front mask so anime/stylized eyes sit cleanly
      if (nz > 0.45) {
        const frontW = clamp01((nz - 0.45) / 0.55);
        z -= frontW * rz * 0.075 * gaussian(ny, 0.05, 0.55);
      }

      // 4. Brow ridge
      if (nz > 0.35) {
        const browW = gaussian(ny, 0.29, 0.11) * gaussian(nx, 0, 0.46) * clamp01((nz - 0.35) / 0.4);
        z += browProminence * browW;
      }

      // 5. Recessed orbital eye sockets (aligned to theta ≈ ±0.378, phi ≈ +0.088 -> ny ≈ 0.088)
      if (nz > 0.45) {
        const leftSock = gaussian(nx, -0.35, 0.16) * gaussian(ny, 0.09, 0.13);
        const rightSock = gaussian(nx, 0.35, 0.16) * gaussian(ny, 0.09, 0.13);
        const frontMask = clamp01((nz - 0.45) / 0.4);
        z -= eyeSocketDepth * (leftSock + rightSock) * frontMask;
      }

      // 6. Sculpted nose bridge & tip (nx ≈ 0, ny ∈ [-0.24, +0.16])
      if (nz > 0.55) {
        const bridgeW = gaussian(nx, 0, 0.095) * gaussian(ny, -0.05, 0.17) * clamp01((nz - 0.55) / 0.35);
        const tipW = gaussian(nx, 0, 0.075) * gaussian(ny, -0.17, 0.065) * clamp01((nz - 0.65) / 0.3);
        z += noseBridge * bridgeW + noseLength * 0.32 * tipW;
        y -= 0.004 * tipW;
      }

      // 7. Philtrum / lip swell / chin groove
      if (nz > 0.55) {
        const frontMask = clamp01((nz - 0.55) / 0.35);
        const lipSwell = gaussian(nx, 0, 0.18) * gaussian(ny, -0.45, 0.075);
        const chinGroove = gaussian(nx, 0, 0.16) * gaussian(ny, -0.58, 0.06);
        z += (0.0045 * lipSwell - 0.003 * chinGroove) * frontMask;
      }

      positions.push(x, y, z);
      thetas.push(theta);
      phis.push(phi);
      uvs.push(clamp01(0.5 + theta / (2 * maxTheta)), clamp01(0.5 + phi / (2 * maxPhi)));
    }
  }

  // Note: phi ascends (-PI/2 -> +PI/2) as i increases, theta ascends (-PI -> +PI) as j increases.
  // Verify outward CCW winding: at (theta=0, phi=0), +j is +X, +i is +Y, outward is +Z -> (i, j) -> (i, j+1) -> (i+1, j+1).
  for (let i = 0; i < latSegs; i++) {
    for (let j = 0; j < lonSegs; j++) {
      const i00 = i * stride + j;
      const i10 = i * stride + (j + 1);
      const i11 = (i + 1) * stride + (j + 1);
      const i01 = (i + 1) * stride + j;
      indices.push(i00, i10, i11);
      indices.push(i00, i11, i01);
    }
  }

  let headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  headGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  headGeo.setIndex(indices);
  headGeo.computeVertexNormals();
  averageSeamNormals(headGeo, lonSegs, latSegs + 1);

  // Split UVs cleanly per triangle into faceUVRegion vs skinUVRegion while preserving welded normals
  const nonIdxHead = headGeo.toNonIndexed();
  headGeo.dispose();

  const uvAttr = nonIdxHead.attributes.uv;
  const triCount = indices.length / 3;
  for (let t = 0; t < triCount; t++) {
    const idx0 = indices[t * 3];
    const idx1 = indices[t * 3 + 1];
    const idx2 = indices[t * 3 + 2];

    const avgTheta = (thetas[idx0] + thetas[idx1] + thetas[idx2]) / 3;
    const avgPhi = (phis[idx0] + phis[idx1] + phis[idx2]) / 3;
    const isFrontFace = Math.abs(avgTheta) <= maxTheta && Math.abs(avgPhi) <= maxPhi;

    const vBase = t * 3;
    if (isFrontFace) {
      const rawUVs = [idx0, idx1, idx2].map((vi) => [
        clamp01(0.5 + thetas[vi] / (2 * maxTheta)),
        clamp01(0.5 + phis[vi] / (2 * maxPhi)),
      ]);
      for (let k = 0; k < 3; k++) {
        uvAttr.setXY(vBase + k, rawUVs[k][0], rawUVs[k][1]);
      }
      if (faceUVRegion) {
        remapSliceUVs(uvAttr, vBase, 3, faceUVRegion);
      }
    } else {
      for (let k = 0; k < 3; k++) {
        const vi = indices[t * 3 + k];
        const su = 0.2 + clamp01((thetas[vi] + Math.PI) / (2 * Math.PI)) * 0.6;
        const sv = 0.2 + clamp01((phis[vi] + Math.PI / 2) / Math.PI) * 0.6;
        uvAttr.setXY(vBase + k, su, sv);
      }
      const targetRegion = skinUVRegion || faceUVRegion;
      if (targetRegion) {
        remapSliceUVs(uvAttr, vBase, 3, targetRegion);
      }
    }
  }
  uvAttr.needsUpdate = true;

  if (!includeEars) {
    nonIdxHead.computeBoundingBox();
    nonIdxHead.computeBoundingSphere();
    return nonIdxHead;
  }

  // Sculpted beveled ears merged into head
  const earShape = [
    [-0.008, -0.022],
    [0.007, -0.018],
    [0.013, 0.002],
    [0.010, 0.020],
    [-0.004, 0.024],
    [-0.011, 0.006],
  ];
  const earParts = [nonIdxHead];
  for (const side of [-1, 1]) {
    const earGeo = createBeveledExtrude(earShape, 0.008, {
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
      centerXY: true,
      uvRegion: skinUVRegion || faceUVRegion,
    });
    earGeo.rotateY(side * (Math.PI * 0.5 - 0.28));
    earGeo.rotateZ(side * -0.10);
    earGeo.translate(side * (rx * 0.97), -0.016, -0.014);
    earParts.push(earGeo);
  }

  const normalized = earParts.map((g) => normalizeGeometryForMerge(g));
  for (const g of earParts) g.dispose();
  const mergedHead = mergeGeometries(normalized, false);
  for (const g of normalized) g.dispose();
  mergedHead.computeBoundingBox();
  mergedHead.computeBoundingSphere();
  return mergedHead;
}

function remapSliceUVs(uvAttr, start, count, region, atlasSize = 512, insetPx = 0.5) {
  const atlasW = region.atlasWidth || atlasSize;
  const atlasH = region.atlasHeight || atlasSize;
  const u0 = region.u0 !== undefined ? region.u0 : region.x / atlasW;
  const u1 = region.u1 !== undefined ? region.u1 : (region.x + region.w) / atlasW;
  const v0 = region.v0 !== undefined ? region.v0 : 1 - (region.y + region.h) / atlasH;
  const v1 = region.v1 !== undefined ? region.v1 : 1 - region.y / atlasH;
  const epsU = Math.min(insetPx / atlasW, Math.max(0, (u1 - u0) * 0.25));
  const epsV = Math.min(insetPx / atlasH, Math.max(0, (v1 - v0) * 0.25));
  const uA = u0 + epsU;
  const uB = u1 - epsU;
  const vA = v0 + epsV;
  const vB = v1 - epsV;
  for (let i = start; i < start + count; i++) {
    const u = clamp01(uvAttr.getX(i));
    const v = clamp01(uvAttr.getY(i));
    uvAttr.setXY(i, uA + u * (uB - uA), vA + v * (vB - vA));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Anatomical Hand (Sculpted Palm + Thumb + 4 Fingers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds an anatomical hand extending from wrist (y = 0) down along -Y.
 * Palm faces inward (-side * X), back of hand faces outward (+side * X), thumb at +Z.
 */
export function createAnatomicalHand(params = {}) {
  const side = params.side ?? -1; // -1 = left (-X), +1 = right (+X)
  const width = params.width ?? 0.066;     // span along Z (index -> pinky)
  const length = params.length ?? 0.095;   // total wrist -> fingertip along -Y
  const thickness = params.thickness ?? 0.028; // X thickness
  const pose = params.pose || 'relaxed';   // 'relaxed' | 'table' | 'fist'
  const uvRegion = params.uvRegion || null;

  const inward = -side; // +1 for left hand (-X), -1 for right hand (+X)
  const palmLen = length * 0.56;
  const fingerBaseLen = length * 0.48;

  const parts = [];

  // 1. Sculpted Palm
  const palmGeo = createLoftedTube(
    [
      { y: 0.004, rx: thickness * 0.48, rz: width * 0.38, superPower: 2.6 },
      { y: -palmLen * 0.35, rx: thickness * 0.52, rz: width * 0.46, superPower: 2.8 },
      { y: -palmLen * 0.78, rx: thickness * 0.48, rz: width * 0.50, superPower: 2.9 },
      { y: -palmLen, rx: thickness * 0.40, rz: width * 0.47, superPower: 2.6 },
    ],
    { radialSegments: 10, bevelCap: true, bevelHeight: 0.004, bevelRatio: 0.25 }
  );
  parts.push(palmGeo);

  // 2. Angled Thumb on +Z edge
  const thumbCurl = pose === 'fist' ? 0.55 : pose === 'table' ? 0.22 : 0.28;
  const thumbLen = length * 0.42;
  const thumbGeo = createLoftedTube(
    [
      { x: inward * thickness * 0.15, y: -palmLen * 0.25, z: width * 0.36, rx: 0.0095, rz: 0.0105, superPower: 2.2 },
      { x: inward * thickness * 0.45, y: -palmLen * 0.25 - thumbLen * 0.45, z: width * 0.54, rx: 0.008, rz: 0.009, superPower: 2.2 },
      {
        x: inward * (thickness * 0.55 + Math.sin(thumbCurl) * thumbLen * 0.45),
        y: -palmLen * 0.25 - thumbLen * 0.92,
        z: width * 0.62,
        rx: 0.0065,
        rz: 0.0072,
        superPower: 2.0,
      },
    ],
    { radialSegments: 7, bevelCap: true, bevelHeight: 0.003 }
  );
  parts.push(thumbGeo);

  // 3. Four Individually Proportioned & Curled Fingers (index -> pinky along +Z -> -Z)
  const fingerSpecs = [
    { zFrac: 0.35, lenRatio: 0.92, r: 0.0072 }, // index
    { zFrac: 0.12, lenRatio: 1.00, r: 0.0076 }, // middle
    { zFrac: -0.11, lenRatio: 0.94, r: 0.0072 }, // ring
    { zFrac: -0.34, lenRatio: 0.76, r: 0.0064 }, // pinky
  ];

  const c1 = pose === 'fist' ? 0.95 : pose === 'table' ? 0.25 : 0.38;
  const c2 = pose === 'fist' ? 1.85 : pose === 'table' ? 0.48 : 0.72;

  for (const f of fingerSpecs) {
    const fLen = fingerBaseLen * f.lenRatio;
    const z0 = width * f.zFrac;
    const y0 = -palmLen * 0.95;

    const p1x = inward * Math.sin(c1) * (fLen * 0.52);
    const p1y = y0 - Math.cos(c1) * (fLen * 0.52);
    const p2x = p1x + inward * Math.sin(c2) * (fLen * 0.48);
    const p2y = p1y - Math.cos(c2) * (fLen * 0.48);

    const fGeo = createLoftedTube(
      [
        { x: 0, y: y0 + 0.005, z: z0, rx: f.r, rz: f.r, superPower: 2.2 },
        { x: p1x, y: p1y, z: z0, rx: f.r * 0.88, rz: f.r * 0.88, rotZ: inward * c1, superPower: 2.2 },
        { x: p2x, y: p2y, z: z0, rx: f.r * 0.70, rz: f.r * 0.70, rotZ: inward * c2, superPower: 2.0 },
      ],
      { radialSegments: 7, bevelCap: true, bevelHeight: 0.0025 }
    );
    parts.push(fGeo);
  }

  const normalized = parts.map((g) => normalizeGeometryForMerge(g));
  for (const g of parts) g.dispose();
  const merged = mergeGeometries(normalized, false);
  for (const g of normalized) g.dispose();

  if (uvRegion) remapGeometryUVs(merged, uvRegion, params);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Sculpted Boot / Shoe (Foot Last + Beveled Toe + Sole + Heel + Cuff)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a contoured 3D boot/shoe facing +Z.
 * By default sole bottom is at y = 0; pass `soleBottomY` (e.g., -ankleH) to align with ankle pivot.
 */
export function createSculptedBoot(params = {}) {
  const length = params.length ?? 0.225;
  const width = params.width ?? 0.098;
  const shaftHeight = params.shaftHeight ?? 0.145;
  const soleThickness = params.soleThickness ?? 0.020;
  const heelHeight = params.heelHeight ?? 0.016;
  const style = params.style || 'combat'; // 'combat' | 'swordsman' | 'maid' | 'asuna' | 'vault' | 'sneaker'
  const soleBottomY = params.soleBottomY ?? 0;
  const uvRegion = params.uvRegion || null;
  const soleUVRegion = params.soleUVRegion || uvRegion;

  const isDressShoe = style === 'maid';
  const isTallBoot = style === 'swordsman' || style === 'asuna';
  const actualShaft = isDressShoe ? Math.min(shaftHeight, 0.065) : isTallBoot ? Math.max(shaftHeight, 0.175) : shaftHeight;
  const actualHeel = style === 'asuna' || style === 'maid' ? Math.max(heelHeight, 0.022) : heelHeight;

  const heelZ = -length * 0.26;
  const toeZ = length * 0.74;
  const soleTopY = soleThickness;

  const upperParts = [];
  const soleParts = [];

  // 1. Sole contour (extruded along Y via X/Z contour rotated -PI/2 around X)
  const hw = width * 0.5;
  const archW = hw * 0.78;
  const heelW = hw * 0.86;
  const soleContour = [
    [-heelW * 0.75, heelZ],
    [heelW * 0.75, heelZ],
    [heelW, heelZ + length * 0.16],
    [archW, heelZ + length * 0.42],
    [hw, heelZ + length * 0.68],
    [hw * 0.82, toeZ - length * 0.10],
    [hw * 0.40, toeZ],
    [-hw * 0.40, toeZ],
    [-hw * 0.82, toeZ - length * 0.10],
    [-hw, heelZ + length * 0.68],
    [-archW, heelZ + length * 0.42],
    [-heelW, heelZ + length * 0.16],
  ];
  const soleGeo = createBeveledExtrude(soleContour, Math.max(0.008, soleThickness - 0.005), {
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    centerZ: false,
  });
  soleGeo.rotateX(Math.PI / 2);
  // Align sole bottom strictly to y = 0
  soleGeo.computeBoundingBox();
  soleGeo.translate(0, -soleGeo.boundingBox.min.y, 0);
  soleParts.push(soleGeo);

  // 2. Raised heel block (at rear heelZ..heelZ + 0.34*length)
  if (actualHeel > 0.004) {
    const heelContour = [
      [-heelW * 0.72, heelZ + 0.003],
      [heelW * 0.72, heelZ + 0.003],
      [heelW * 0.90, heelZ + length * 0.18],
      [archW * 0.94, heelZ + length * 0.33],
      [-archW * 0.94, heelZ + length * 0.33],
      [-heelW * 0.90, heelZ + length * 0.18],
    ];
    const heelGeo = createBeveledExtrude(heelContour, actualHeel, {
      bevelThickness: 0.0025,
      bevelSize: 0.0025,
      bevelSegments: 1,
      centerZ: false,
    });
    heelGeo.rotateX(Math.PI / 2);
    heelGeo.computeBoundingBox();
    heelGeo.translate(0, soleTopY * 0.5 - heelGeo.boundingBox.min.y, 0);
    soleParts.push(heelGeo);
  }

  // 3. Sculpted Foot Last + Beveled Toe Box (tilted loft rings along Z)
  const vampY = soleTopY + 0.028;
  const footLastGeo = createLoftedTube(
    [
      { x: 0, y: vampY + 0.008, z: heelZ + 0.008, rx: heelW * 0.88, rz: 0.026, rotX: Math.PI / 2, superPower: 2.4 },
      { x: 0, y: vampY + 0.010, z: heelZ + length * 0.25, rx: archW * 0.98, rz: 0.032, rotX: Math.PI / 2, superPower: 2.5 },
      { x: 0, y: vampY + 0.004, z: heelZ + length * 0.56, rx: hw * 0.96, rz: 0.027, rotX: Math.PI / 2, superPower: 2.4 },
      { x: 0, y: soleTopY + 0.022, z: toeZ - length * 0.16, rx: hw * 0.84, rz: 0.021, rotX: Math.PI / 2, superPower: 2.3 },
      { x: 0, y: soleTopY + 0.017, z: toeZ - 0.008, rx: hw * 0.52, rz: 0.013, rotX: Math.PI / 2, superPower: 2.0 },
    ],
    { radialSegments: 12, bevelCap: true, bevelHeight: 0.006, bevelRatio: 0.35 }
  );
  upperParts.push(footLastGeo);

  // 4. Ankle Shaft & Top Cuff Collar
  const shaftR = Math.max(width * 0.44, 0.042);
  const shaftTopY = soleTopY + actualShaft;
  const shaftGeo = createLoftedTube(
    [
      { x: 0, y: soleTopY + 0.016, z: 0.0, rx: shaftR * 1.04, rz: shaftR * 1.12, superPower: 2.3 },
      { x: 0, y: soleTopY + actualShaft * 0.45, z: 0.0, rx: shaftR * 0.96, rz: shaftR * 1.02, superPower: 2.2 },
      { x: 0, y: shaftTopY - 0.018, z: 0.0, rx: shaftR * 1.02, rz: shaftR * 1.06, superPower: 2.2 },
      {
        x: 0,
        y: shaftTopY,
        z: 0.0,
        rx: shaftR * (isTallBoot ? 1.14 : 1.08),
        rz: shaftR * (isTallBoot ? 1.16 : 1.10),
        superPower: 2.3,
        crease: true,
      },
    ],
    { radialSegments: 12, bevelCap: true, bevelHeight: 0.005, bevelRatio: 0.18 }
  );
  upperParts.push(shaftGeo);

  for (const g of upperParts) {
    if (uvRegion) remapGeometryUVs(g, uvRegion, params);
  }
  for (const g of soleParts) {
    if (soleUVRegion) remapGeometryUVs(g, soleUVRegion, params);
  }

  const allParts = [...soleParts, ...upperParts];
  const normalized = allParts.map((g) => normalizeGeometryForMerge(g));
  for (const g of allParts) g.dispose();

  const merged = mergeGeometries(normalized, false);
  for (const g of normalized) g.dispose();

  merged.computeBoundingBox();
  const dy = soleBottomY - merged.boundingBox.min.y;
  if (Math.abs(dy) > 1e-6) {
    merged.translate(0, dy, 0);
  }
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Bishop/Parallel-Transport Curved Strand (Hair Strands, Ribbons, Hoses)
// ─────────────────────────────────────────────────────────────────────────────

function evalProfile(profile, t) {
  if (typeof profile === 'function') return profile(t);
  if (Array.isArray(profile) && profile.length > 0) {
    if (profile.length === 1) return profile[0];
    const scaled = clamp01(t) * (profile.length - 1);
    const idx = Math.floor(scaled);
    const frac = scaled - idx;
    const a = profile[idx];
    const b = profile[Math.min(profile.length - 1, idx + 1)];
    return a + (b - a) * frac;
  }
  return typeof profile === 'number' ? profile : 0.02;
}

/**
 * Sweeps a tapered diamond/hex/ribbon cross-section along a 3D CatmullRomCurve3
 * using Parallel-Transport (Bishop) frames to eliminate Frenet inflection flips.
 */
export function createCurvedStrand(
  curvePoints,
  widthProfile = 0.024,
  thicknessProfile = 0.015,
  options = {}
) {
  if (!Array.isArray(curvePoints) || curvePoints.length < 2) {
    throw new Error('createCurvedStrand requires at least 2 curvePoints');
  }

  const pts = curvePoints.map((p) =>
    p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])
  );
  if (pts.length === 2) {
    pts.splice(1, 0, pts[0].clone().lerp(pts[1], 0.5));
  }

  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const segments = Math.max(3, options.segments ?? 10);
  const crossSection = options.crossSection || 'diamond'; // 'diamond' | 'hex' | 'ribbon'
  const twist = options.twist ?? 0;
  const sharpTip = options.sharpTip !== false;
  const capRoot = options.capRoot !== false;
  const creaseAngle = options.creaseAngle ?? Math.PI / 3;

  // Cross-section unit shape in (normal, binormal) plane
  let shapeVerts;
  if (crossSection === 'hex') {
    shapeVerts = [
      [0, 0.5],
      [0.44, 0.25],
      [0.44, -0.25],
      [0, -0.5],
      [-0.44, -0.25],
      [-0.44, 0.25],
    ];
  } else if (crossSection === 'ribbon') {
    shapeVerts = [
      [0.5, 0.28],
      [0.5, -0.28],
      [-0.5, -0.28],
      [-0.5, 0.28],
    ];
  } else {
    // 'diamond' (crisp stylized anime hair facet)
    shapeVerts = [
      [0, 0.5],
      [0.5, 0],
      [0, -0.5],
      [-0.5, 0],
    ];
  }

  const kCount = shapeVerts.length;
  const stride = kCount + 1;

  // Compute Parallel-Transport (Bishop) frames
  const tangents = [];
  const normals = [];
  const binormals = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const tan = curve.getTangent(t).normalize();
    tangents.push(tan);

    if (i === 0) {
      const up = Math.abs(tan.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const bin = new THREE.Vector3().crossVectors(tan, up).normalize();
      const norm = new THREE.Vector3().crossVectors(bin, tan).normalize();
      normals.push(norm);
      binormals.push(bin);
    } else {
      const q = new THREE.Quaternion().setFromUnitVectors(tangents[i - 1], tan);
      const norm = normals[i - 1].clone().applyQuaternion(q).normalize();
      const bin = new THREE.Vector3().crossVectors(tan, norm).normalize();
      normals.push(norm);
      binormals.push(bin);
    }
  }

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const center = curve.getPoint(t);
    let w = Math.max(0.0004, evalProfile(widthProfile, t));
    let th = Math.max(0.0004, evalProfile(thicknessProfile, t));
    if (sharpTip && i === segments) {
      w = 0.0004;
      th = 0.0004;
    }

    const angle = twist * t;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const nVec = normals[i];
    const bVec = binormals[i];

    for (let k = 0; k <= kCount; k++) {
      const sv = shapeVerts[k % kCount];
      const lx = sv[0] * w;
      const ly = sv[1] * th;
      const rx = lx * cosA - ly * sinA;
      const ry = lx * sinA + ly * cosA;

      const px = center.x + bVec.x * rx + nVec.x * ry;
      const py = center.y + bVec.y * rx + nVec.y * ry;
      const pz = center.z + bVec.z * rx + nVec.z * ry;
      positions.push(px, py, pz);
      uvs.push(k / kCount, 1 - t);
    }
  }

  // Verify outward winding on first segment
  let flipWinding = false;
  {
    const c0 = curve.getPoint(0);
    const a = 0;
    const b = 1;
    const c = stride + 1;
    _vecA.set(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]);
    _vecB.set(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]);
    _vecC.set(positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2]);
    const e1 = _vecB.clone().sub(_vecA);
    const e2 = _vecC.clone().sub(_vecA);
    const n = e1.cross(e2);
    const out = _vecA.clone().sub(c0);
    if (n.dot(out) < 0) flipWinding = true;
  }

  for (let i = 0; i < segments; i++) {
    for (let k = 0; k < kCount; k++) {
      const i00 = i * stride + k;
      const i10 = i * stride + (k + 1);
      const i11 = (i + 1) * stride + (k + 1);
      const i01 = (i + 1) * stride + k;
      if (!flipWinding) {
        indices.push(i00, i10, i11);
        indices.push(i00, i11, i01);
      } else {
        indices.push(i00, i11, i10);
        indices.push(i00, i01, i11);
      }
    }
  }

  if (capRoot) {
    const c = curve.getPoint(0);
    const baseIdx = positions.length / 3;
    positions.push(c.x, c.y, c.z);
    uvs.push(0.5, 1);
    for (let k = 0; k <= kCount; k++) {
      positions.push(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]);
      uvs.push(k / kCount, 1);
    }
    for (let k = 0; k < kCount; k++) {
      if (!flipWinding) indices.push(baseIdx, baseIdx + 1 + k + 1, baseIdx + 1 + k);
      else indices.push(baseIdx, baseIdx + 1 + k, baseIdx + 1 + k + 1);
    }
  }

  // Cap tip cleanly when not tapered to point
  if (!sharpTip) {
    const c = curve.getPoint(1);
    const baseIdx = positions.length / 3;
    const lastRow = segments * stride;
    positions.push(c.x, c.y, c.z);
    uvs.push(0.5, 0);
    for (let k = 0; k <= kCount; k++) {
      const src = (lastRow + k) * 3;
      positions.push(positions[src], positions[src + 1], positions[src + 2]);
      uvs.push(k / kCount, 0);
    }
    for (let k = 0; k < kCount; k++) {
      if (!flipWinding) indices.push(baseIdx, baseIdx + 1 + k, baseIdx + 1 + k + 1);
      else indices.push(baseIdx, baseIdx + 1 + k + 1, baseIdx + 1 + k);
    }
  }

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo = toCreasedNormals(geo, creaseAngle);

  if (options.uvRegion) {
    remapGeometryUVs(geo, options.uvRegion, options);
  }

  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Garment & Trim Primitives (for M2 Clothing & M3 Accessories)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Double-walled flared garment shell (skirts, coattails, capes, tunics) with optional pleats.
 * Eliminates paper-thin single-sided underside artifacts.
 */
export function createGarmentFlare(params = {}) {
  const topRx = params.topRx ?? 0.14;
  const topRz = params.topRz ?? 0.095;
  const bottomRx = params.bottomRx ?? 0.24;
  const bottomRz = params.bottomRz ?? 0.20;
  const height = params.height ?? 0.30;
  const radialSegs = Math.max(8, params.radialSegments ?? 24);
  const heightSegs = Math.max(2, params.heightSegments ?? 6);
  const pleatCount = params.pleatCount ?? 0;
  const pleatDepth = params.pleatDepth ?? 0.012;
  const hemWave = params.hemWave ?? 0;
  const wallThickness = Math.max(0.004, params.wallThickness ?? 0.010);
  const openFrontAngle = params.openFrontAngle ?? 0; // radians around +Z
  const uvRegion = params.uvRegion || null;

  const startTheta = openFrontAngle * 0.5;
  const endTheta = Math.PI * 2 - openFrontAngle * 0.5;
  const thetaSpan = endTheta - startTheta;

  // Profile cross-section loop: outer top -> outer bottom -> inner bottom -> inner top
  // Let's build a closed ring-of-rings along theta!
  const profilePoints = [];
  // Outer wall (top to bottom)
  for (let h = 0; h <= heightSegs; h++) {
    profilePoints.push({ wall: 0, t: h / heightSegs });
  }
  // Inner wall (bottom to top)
  for (let h = heightSegs; h >= 0; h--) {
    profilePoints.push({ wall: 1, t: h / heightSegs });
  }
  const pCount = profilePoints.length;
  const pStride = pCount + (openFrontAngle <= 0 ? 1 : 1);

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let s = 0; s <= radialSegs; s++) {
    const uFrac = s / radialSegs;
    const theta = startTheta + uFrac * thetaSpan;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const pleatMod = pleatCount > 0 ? Math.sin(theta * pleatCount) * pleatDepth : 0;
    const waveY = hemWave !== 0 ? Math.cos(theta * Math.max(2, pleatCount || 4)) * hemWave : 0;

    for (let p = 0; p < pCount; p++) {
      const spec = profilePoints[p];
      const t = spec.t; // 0 = top, 1 = bottom
      const flareT = Math.pow(t, 1.15);
      const rxBase = topRx + (bottomRx - topRx) * flareT + pleatMod * t;
      const rzBase = topRz + (bottomRz - topRz) * flareT + pleatMod * t;
      const inset = spec.wall === 1 ? wallThickness : 0;
      const rx = Math.max(0.01, rxBase - inset);
      const rz = Math.max(0.01, rzBase - inset);
      const y = -t * height + waveY * t;

      positions.push(sinT * rx, y, cosT * rz);
      uvs.push(uFrac, 1 - t);
    }
  }

  for (let s = 0; s < radialSegs; s++) {
    for (let p = 0; p < pCount; p++) {
      const pNext = (p + 1) % pCount;
      const i00 = s * pCount + p;
      const i10 = (s + 1) * pCount + p;
      const i11 = (s + 1) * pCount + pNext;
      const i01 = s * pCount + pNext;
      // Outer wall goes top->bottom as p increases, theta increases around +Y -> outward is (i00, i01, i11)
      indices.push(i00, i01, i11);
      indices.push(i00, i11, i10);
    }
  }

  // If open front coat, cap the two vertical front edges (s=0 and s=radialSegs)
  if (openFrontAngle > 1e-4) {
    for (const endS of [0, radialSegs]) {
      const isStart = endS === 0;
      for (let h = 0; h < heightSegs; h++) {
        const oTop = endS * pCount + h;
        const oBot = endS * pCount + (h + 1);
        const iBot = endS * pCount + (pCount - 1 - (h + 1));
        const iTop = endS * pCount + (pCount - 1 - h);
        if (isStart) {
          indices.push(oTop, iTop, iBot);
          indices.push(oTop, iBot, oBot);
        } else {
          indices.push(oTop, iBot, iTop);
          indices.push(oTop, oBot, iBot);
        }
      }
    }
  }

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo = toCreasedNormals(geo, params.creaseAngle ?? Math.PI / 3);

  if (uvRegion) remapGeometryUVs(geo, uvRegion, params);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Swept beveled U-arc collar around neck with outer flare.
 */
export function createFoldedCollar(params = {}) {
  const radiusX = params.radiusX ?? 0.075;
  const radiusZ = params.radiusZ ?? 0.068;
  const height = params.height ?? 0.055;
  const thickness = params.thickness ?? 0.015;
  const openAngle = params.openAngle ?? 0.72;
  const flareAngle = params.flareAngle ?? 0.25;
  const radialSegs = Math.max(8, params.radialSegments ?? 16);
  const uvRegion = params.uvRegion || null;

  const startTheta = openAngle * 0.5;
  const endTheta = Math.PI * 2 - openAngle * 0.5;
  const flareOut = Math.sin(flareAngle) * height;

  const positions = [];
  const uvs = [];
  const indices = [];

  // 4-point cross-section (inner bottom -> outer bottom -> outer top -> inner top)
  for (let s = 0; s <= radialSegs; s++) {
    const u = s / radialSegs;
    const theta = startTheta + u * (endTheta - startTheta);
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    const pts = [
      [sinT * radiusX, 0, cosT * radiusZ],
      [sinT * (radiusX + thickness), 0, cosT * (radiusZ + thickness)],
      [sinT * (radiusX + thickness + flareOut), height, cosT * (radiusZ + thickness + flareOut)],
      [sinT * (radiusX + flareOut * 0.75), height, cosT * (radiusZ + flareOut * 0.75)],
    ];
    for (let k = 0; k < 4; k++) {
      positions.push(pts[k][0], pts[k][1], pts[k][2]);
      uvs.push(u, k / 3);
    }
  }

  for (let s = 0; s < radialSegs; s++) {
    for (let k = 0; k < 4; k++) {
      const kNext = (k + 1) % 4;
      const i00 = s * 4 + k;
      const i10 = (s + 1) * 4 + k;
      const i11 = (s + 1) * 4 + kNext;
      const i01 = s * 4 + kNext;
      indices.push(i00, i10, i11);
      indices.push(i00, i11, i01);
    }
  }

  // Front lapel end caps
  indices.push(0, 2, 1, 0, 3, 2);
  const last = radialSegs * 4;
  indices.push(last, last + 1, last + 2, last, last + 2, last + 3);

  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo = toCreasedNormals(geo, Math.PI / 4);

  if (uvRegion) remapGeometryUVs(geo, uvRegion, params);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Contoured belt + keeper loops + beveled metallic buckle frame.
 * Returns { beltGeo, buckleGeo }.
 */
export function createBeltAndBuckle(params = {}) {
  const rx = params.rx ?? 0.155;
  const rz = params.rz ?? 0.095;
  const height = params.height ?? 0.042;
  const thickness = params.thickness ?? 0.012;
  const buckleW = params.buckleW ?? 0.064;
  const buckleH = params.buckleH ?? 0.050;
  const loopCount = params.loopCount ?? 4;
  const beltUVRegion = params.beltUVRegion || null;
  const buckleUVRegion = params.buckleUVRegion || null;

  // Belt strap (chamfered hollow band built as flared double-walled ring)
  const beltParts = [];
  const strapGeo = createGarmentFlare({
    topRx: rx + thickness,
    topRz: rz + thickness,
    bottomRx: rx + thickness,
    bottomRz: rz + thickness,
    height,
    heightSegments: 2,
    radialSegments: 22,
    wallThickness: thickness,
    uvRegion: beltUVRegion,
  });
  strapGeo.translate(0, height * 0.5, 0);
  beltParts.push(strapGeo);

  // Keeper loops around the belt
  if (loopCount > 0) {
    const loopContour = [
      [-0.008, -height * 0.62],
      [0.008, -height * 0.62],
      [0.008, height * 0.62],
      [-0.008, height * 0.62],
    ];
    for (let i = 0; i < loopCount; i++) {
      const ang = ((i + 0.5) / loopCount) * Math.PI * 2;
      const lx = Math.sin(ang) * (rx + thickness * 0.85);
      const lz = Math.cos(ang) * (rz + thickness * 0.85);
      const loopGeo = createBeveledExtrude(loopContour, 0.012, {
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 1,
        uvRegion: beltUVRegion,
      });
      loopGeo.rotateY(ang);
      loopGeo.translate(lx, 0, lz);
      beltParts.push(loopGeo);
    }
  }

  const normBelt = beltParts.map((g) => normalizeGeometryForMerge(g));
  for (const g of beltParts) g.dispose();
  const beltGeo = mergeGeometries(normBelt, false);
  for (const g of normBelt) g.dispose();
  beltGeo.computeBoundingBox();
  beltGeo.computeBoundingSphere();

  // Beveled front buckle frame + center prong
  const outer = new THREE.Shape();
  const hw = buckleW * 0.5;
  const hh = buckleH * 0.5;
  const r = 0.006;
  outer.moveTo(-hw + r, -hh);
  outer.lineTo(hw - r, -hh);
  outer.lineTo(hw, -hh + r);
  outer.lineTo(hw, hh - r);
  outer.lineTo(hw - r, hh);
  outer.lineTo(-hw + r, hh);
  outer.lineTo(-hw, hh - r);
  outer.lineTo(-hw, -hh + r);
  outer.closePath();

  const hole = new THREE.Path();
  const ihw = hw * 0.62;
  const ihh = hh * 0.58;
  hole.moveTo(-ihw, -ihh);
  hole.lineTo(ihw, -ihh);
  hole.lineTo(ihw, ihh);
  hole.lineTo(-ihw, ihh);
  hole.closePath();
  outer.holes.push(hole);

  const frameGeo = createBeveledExtrude(outer, 0.010, {
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    uvRegion: buckleUVRegion,
  });
  const prongGeo = createBeveledExtrude(
    [
      [-0.004, -0.004],
      [0.018, -0.003],
      [0.018, 0.003],
      [-0.004, 0.004],
    ],
    0.006,
    { bevelThickness: 0.0015, bevelSize: 0.0015, uvRegion: buckleUVRegion }
  );
  prongGeo.translate(0, 0, 0.003);

  const normBuckle = [normalizeGeometryForMerge(frameGeo), normalizeGeometryForMerge(prongGeo)];
  frameGeo.dispose();
  prongGeo.dispose();
  const buckleGeo = mergeGeometries(normBuckle, false);
  for (const g of normBuckle) g.dispose();
  buckleGeo.translate(0, 0, rz + thickness + 0.005);
  buckleGeo.computeBoundingBox();
  buckleGeo.computeBoundingSphere();

  return { beltGeo, buckleGeo };
}

/**
 * Chamfered 3D cargo pocket / tactical pouch with overhanging beveled flap & tab.
 */
export function createPocketOrPouch(params = {}) {
  const width = params.width ?? 0.072;
  const height = params.height ?? 0.062;
  const depth = params.depth ?? 0.030;
  const flapHeight = params.flapHeight ?? 0.022;
  const bevel = params.bevel ?? 0.004;
  const uvRegion = params.uvRegion || null;

  const hw = width * 0.5;
  const hh = height * 0.5;
  const c = Math.min(bevel * 1.4, hw * 0.25);

  const bodyContour = [
    [-hw + c, -hh],
    [hw - c, -hh],
    [hw, -hh + c],
    [hw, hh],
    [-hw, hh],
    [-hw, -hh + c],
  ];
  const bodyGeo = createBeveledExtrude(bodyContour, depth, {
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    uvRegion,
  });

  const flapContour = [
    [-hw * 1.04, -flapHeight * 0.5],
    [0, -flapHeight * 0.65],
    [hw * 1.04, -flapHeight * 0.5],
    [hw * 1.04, flapHeight * 0.5],
    [-hw * 1.04, flapHeight * 0.5],
  ];
  const flapGeo = createBeveledExtrude(flapContour, depth + 0.006, {
    bevelThickness: bevel * 0.85,
    bevelSize: bevel * 0.85,
    bevelSegments: 2,
    uvRegion,
  });
  flapGeo.rotateX(-0.08);
  flapGeo.translate(0, hh - flapHeight * 0.15, 0.004);

  const tabGeo = createBeveledExtrude(
    [
      [-0.008, -0.010],
      [0.008, -0.010],
      [0.008, 0.010],
      [-0.008, 0.010],
    ],
    0.006,
    { bevelThickness: 0.002, bevelSize: 0.002, uvRegion }
  );
  tabGeo.translate(0, hh - flapHeight * 0.55, depth * 0.5 + bevel + 0.005);

  const parts = [bodyGeo, flapGeo, tabGeo];
  const norm = parts.map((g) => normalizeGeometryForMerge(g));
  for (const g of parts) g.dispose();
  const merged = mergeGeometries(norm, false);
  for (const g of norm) g.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Curved cloth fold / ribbon / strap / hose built via Bishop frames.
 */
export function createClothFoldStrip(curvePoints, width = 0.022, thickness = 0.008, options = {}) {
  return createCurvedStrand(curvePoints, width, thickness, {
    crossSection: options.crossSection || 'ribbon',
    sharpTip: options.sharpTip ?? false,
    capRoot: options.capRoot ?? true,
    segments: options.segments ?? 10,
    ...options,
  });
}
