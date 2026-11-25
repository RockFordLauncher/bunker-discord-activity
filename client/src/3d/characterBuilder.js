// characterBuilder.js — Ultra-Detailed Thematic 3D Character Generator
// Generates fully sculpted, multi-layered 3D avatars for the Bunker Table (seated) and Customization Studio (standing).
// Strict Voxel/Blocky Retro-Futurism Aesthetic: 3-5x Geometry Density, Zero Bald Spots, Deep Multi-Layer Geometry.

import * as THREE from 'three';
import {
  HAIR_COLORS,
  SKIN_TONES,
  getDefaultCustomization,
} from './characterCustomizationData.js';
import { buildWeskerModel } from './weskerModel.js';
import { buildKiritoModel } from './kiritoModel.js';
import { buildBBModel } from './bbmodelLoader.js';
import { BUILTIN_BBMODELS } from './builtinBBModels.js';
import {
  createBeveledBox,
  createTaperedBox,
  createDetailedHead,
  createDetailedTorso,
  createDetailedPelvis,
  createDetailedLeg,
  createDetailedBoot,
  createDetailedHand,
  createDetailedArm,
  createAOMaterial,
  createEdgeHighlightMaterial,
  addAOShadow,
  addSeamHighlight,
} from './geometryUtils.js';

export { buildWeskerModel, buildKiritoModel, buildBBModel };

// Cache canvas textures to prevent memory leaks
const textureCache = new Map();

function getCanvasTexture(key, drawFn, width = 512, height = 512) {
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Procedural High-Detail Face & Makeup Textures
// ─────────────────────────────────────────────────────────────────────────────

function createFaceTexture(config, skinColorHex, hairColorHex) {
  const key = `face_v5_${config.preset || 'custom'}_${config.hairStyle}_${config.faceFeature}_${config.headwear}_${skinColorHex}_${hairColorHex}`;
  return getCanvasTexture(key, (ctx, w, h) => {
    // 1. Base Skin Tone
    ctx.fillStyle = skinColorHex;
    ctx.fillRect(0, 0, w, h);

    const isRem = config.hairStyle === 'rem_bob' || config.topType === 'maid_dress' || config.preset === 'rem';
    const isLeon = config.hairStyle === 'leon_bangs' || config.topType === 'rpd_vest' || config.preset === 'leon';
    const isKirito = config.hairStyle === 'kirito' || config.topType === 'kirito_coat' || config.preset === 'kirito';
    const isWesker = config.headwear === 'sunglasses_wesker' || config.hairStyle === 'sleek_back' || config.preset === 'wesker';
    const isSubaru = config.topType === 'subaru_jacket' || config.hairStyle === 'spiky' || config.preset === 'subaru';
    const isHunk = config.headwear === 'gasmask_hunk' || config.topType === 'combat_rig' || config.preset === 'hunk';
    const isCyborg = config.faceFeature === 'cyber_eye' || config.skinTone === 'cyber' || config.topType === 'cyber_jacket' || config.preset === 'cyborg';
    const isRaider = config.faceFeature === 'eyepatch' || config.topType === 'raider_vest' || config.hairStyle === 'mohawk' || config.preset === 'raider';
    const isAsuna = config.hairStyle === 'asuna_long' || config.topType === 'asuna_tunic' || config.preset === 'asuna';
    const isVault = config.topType === 'vault_suit' || config.preset === 'vault101';

    // If HUNK: Gas mask covers the whole face, draw dark rubber balaclava background
    if (isHunk) {
      ctx.fillStyle = '#0f1013';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    // ── CHARACTER-SPECIFIC DEDICATED FACIAL RENDERING ──
    if (isLeon) {
      drawLeonFace(ctx, w, h, skinColorHex, hairColorHex);
    } else if (isWesker) {
      drawWeskerFace(ctx, w, h, skinColorHex, hairColorHex);
    } else if (isRem) {
      drawRemFace(ctx, w, h, skinColorHex, hairColorHex);
    } else if (isKirito) {
      drawKiritoFace(ctx, w, h, skinColorHex, hairColorHex);
    } else if (isSubaru) {
      drawSubaruFace(ctx, w, h, skinColorHex, hairColorHex);
    } else if (isAsuna) {
      drawAsunaFace(ctx, w, h, skinColorHex, hairColorHex);
    } else if (isRaider) {
      drawRaiderFace(ctx, w, h, skinColorHex, hairColorHex);
    } else if (isCyborg) {
      drawCyborgFace(ctx, w, h, skinColorHex, hairColorHex);
    } else if (isVault) {
      drawVaultFace(ctx, w, h, skinColorHex, hairColorHex);
    } else {
      drawCustomFace(ctx, w, h, config, skinColorHex, hairColorHex);
    }
  }, 512, 512);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedicated Archetype Face Renderers
// ─────────────────────────────────────────────────────────────────────────────

function drawLeonFace(ctx, w, h, skinColorHex, hairColorHex) {
  // 1. Subtle masculine jawline shading & light 5-o'clock shadow
  ctx.fillStyle = 'rgba(50, 40, 30, 0.08)';
  ctx.beginPath();
  ctx.ellipse(w * 0.50, h * 0.78, w * 0.32, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Chin cleft / jaw definition shadow
  ctx.fillStyle = 'rgba(40, 25, 20, 0.12)';
  ctx.beginPath();
  ctx.arc(w * 0.50, h * 0.81, 10, 0, Math.PI);
  ctx.fill();

  // 2. Realistic focused masculine eyes: narrower almond / hooded shape (w ~38, h ~28)
  const eyeY = h * 0.46;
  [-1, 1].forEach((side) => {
    const cx = side === -1 ? w * 0.32 : w * 0.68;
    const rx = 36;
    const ry = 22;

    // Brow ridge shadow over eye socket
    const socketGrad = ctx.createRadialGradient(cx, eyeY - 8, 4, cx, eyeY, rx * 1.2);
    socketGrad.addColorStop(0, 'rgba(40, 25, 15, 0.18)');
    socketGrad.addColorStop(1, 'rgba(40, 25, 15, 0)');
    ctx.fillStyle = socketGrad;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY - 4, rx * 1.2, ry * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sclera (white of eye)
    ctx.fillStyle = '#f2f4f8';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, rx, ry, side * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Upper eyelid shadow on sclera
    const topShadow = ctx.createLinearGradient(cx, eyeY - ry, cx, eyeY + ry * 0.5);
    topShadow.addColorStop(0, 'rgba(20, 25, 35, 0.35)');
    topShadow.addColorStop(1, 'rgba(20, 25, 35, 0)');
    ctx.fillStyle = topShadow;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, rx, ry, side * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Slate grey-blue iris
    const irisR = 19;
    const irisGrad = ctx.createRadialGradient(cx, eyeY - 3, 2, cx, eyeY, irisR);
    irisGrad.addColorStop(0, '#5a829e');
    irisGrad.addColorStop(0.5, '#426882');
    irisGrad.addColorStop(0.85, '#263e4f');
    irisGrad.addColorStop(1, '#121e28');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, eyeY + 1, irisR, 0, Math.PI * 2);
    ctx.fill();

    // Dark pupil
    ctx.fillStyle = '#080d12';
    ctx.beginPath();
    ctx.arc(cx, eyeY + 1, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // Subtle realistic corneal glint (NO giant cute sparkles!)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(cx - 5, eyeY - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Sharp masculine upper lash line & hooded fold
    ctx.strokeStyle = '#181e26';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY - ry * 0.6, rx * 1.05, ry * 0.55, side * 0.05, Math.PI * 0.95, Math.PI * 2.05);
    ctx.stroke();

    // Hooded upper lid crease line
    ctx.strokeStyle = 'rgba(45, 30, 20, 0.40)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY - ry - 4, rx * 0.95, 8, side * 0.05, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Fine lower lid line
    ctx.strokeStyle = 'rgba(45, 30, 20, 0.32)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY + ry * 0.6, rx * 0.90, ry * 0.40, side * 0.05, 0, Math.PI);
    ctx.stroke();
  });

  // 3. Strong straight masculine eyebrows with brow-bone ridge shading
  const browY = h * 0.36;
  // Shadow under brow bone
  ctx.fillStyle = 'rgba(40, 25, 15, 0.16)';
  ctx.fillRect(w * 0.18, browY - 4, w * 0.28, 16);
  ctx.fillRect(w * 0.54, browY - 4, w * 0.28, 16);

  ctx.fillStyle = '#3a2e22'; // masculine dark ash brown/blonde tone
  // Left brow (flat, firm, thick straight)
  ctx.beginPath();
  ctx.moveTo(w * 0.18, browY + 4);
  ctx.lineTo(w * 0.44, browY + 1);
  ctx.lineTo(w * 0.44, browY - 9);
  ctx.lineTo(w * 0.20, browY - 6);
  ctx.closePath();
  ctx.fill();

  // Right brow (flat, firm, thick straight)
  ctx.beginPath();
  ctx.moveTo(w * 0.56, browY + 1);
  ctx.lineTo(w * 0.82, browY + 4);
  ctx.lineTo(w * 0.80, browY - 6);
  ctx.lineTo(w * 0.56, browY - 9);
  ctx.closePath();
  ctx.fill();

  // 4. Realistic nose bridge shading with subtle nostrils
  const noseGrad = ctx.createLinearGradient(w * 0.47, h * 0.42, w * 0.51, h * 0.42);
  noseGrad.addColorStop(0, 'rgba(40, 25, 20, 0.20)');
  noseGrad.addColorStop(1, 'rgba(40, 25, 20, 0)');
  ctx.fillStyle = noseGrad;
  ctx.fillRect(w * 0.47, h * 0.42, 14, 80);

  // Nose tip & nostrils
  ctx.fillStyle = 'rgba(45, 25, 18, 0.30)';
  ctx.beginPath();
  ctx.ellipse(w * 0.50, h * 0.60, 16, 7, 0, 0, Math.PI);
  ctx.fill();

  ctx.fillStyle = 'rgba(30, 15, 10, 0.45)';
  ctx.beginPath();
  ctx.arc(w * 0.46, h * 0.60, 3.5, 0, Math.PI * 2);
  ctx.arc(w * 0.54, h * 0.60, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // 5. Defined masculine lips with shadow under lower lip
  // Upper lip contour
  ctx.strokeStyle = '#5a3828';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.41, h * 0.725);
  ctx.lineTo(w * 0.47, h * 0.718);
  ctx.lineTo(w * 0.50, h * 0.722);
  ctx.lineTo(w * 0.53, h * 0.718);
  ctx.lineTo(w * 0.59, h * 0.725);
  ctx.stroke();

  // Lower lip shadow
  ctx.fillStyle = 'rgba(45, 25, 18, 0.22)';
  ctx.beginPath();
  ctx.ellipse(w * 0.50, h * 0.755, 18, 5, 0, 0, Math.PI);
  ctx.fill();
}

function drawKiritoFace(ctx, w, h, skinColorHex, hairColorHex) {
  const eyeY = h * 0.46;
  [-1, 1].forEach((side) => {
    const cx = side === -1 ? w * 0.32 : w * 0.68;
    const rx = 40;
    const ry = 48;

    // Sclera
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark charcoal anime iris
    const irisGrad = ctx.createRadialGradient(cx, eyeY - 6, 4, cx, eyeY + 4, ry * 0.85);
    irisGrad.addColorStop(0, '#424a56');
    irisGrad.addColorStop(0.3, '#2a303c');
    irisGrad.addColorStop(0.85, '#151920');
    irisGrad.addColorStop(1, '#090b0e');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY + 2, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#05070a';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY + 4, rx * 0.42, ry * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dual anime glints
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.30, eyeY - ry * 0.30, rx * 0.26, ry * 0.28, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + rx * 0.30, eyeY + ry * 0.30, rx * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // Sharp angled anime top lash line
    ctx.strokeStyle = '#0d1015';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.1, eyeY - ry * 0.2);
    ctx.lineTo(cx, eyeY - ry * 0.8);
    ctx.lineTo(cx + rx * 1.15, eyeY - ry * 0.6);
    ctx.stroke();
  });

  // Determined angled anime brows
  ctx.strokeStyle = hairColorHex || '#111318';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.20, h * 0.34);
  ctx.lineTo(w * 0.42, h * 0.38);
  ctx.moveTo(w * 0.58, h * 0.38);
  ctx.lineTo(w * 0.80, h * 0.34);
  ctx.stroke();

  // Anime nose dash
  ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
  ctx.fillRect(w * 0.49, h * 0.60, 4, 14);

  // Confident hero smirk
  ctx.strokeStyle = '#3a2016';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.73);
  ctx.lineTo(w * 0.58, h * 0.71);
  ctx.stroke();
}

function drawSubaruFace(ctx, w, h, skinColorHex, hairColorHex) {
  const eyeY = h * 0.46;
  [-1, 1].forEach((side) => {
    const cx = side === -1 ? w * 0.32 : w * 0.68;
    const rx = 38;
    const ry = 42;

    // Sclera
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sanpaku eyes: smaller iris shifted UP so lower sclera is clearly visible underneath!
    const irisY = eyeY - 6;
    const irisR = 19;
    const irisGrad = ctx.createRadialGradient(cx, irisY - 4, 2, cx, irisY + 2, irisR);
    irisGrad.addColorStop(0, '#9e622b');
    irisGrad.addColorStop(0.35, '#6d3f18');
    irisGrad.addColorStop(0.85, '#351b08');
    irisGrad.addColorStop(1, '#180a02');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, irisY, irisR, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#0a0401';
    ctx.beginPath();
    ctx.arc(cx, irisY + 2, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // Crisp high-intensity glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 6, irisY - 6, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Intense sharp top lash line
    ctx.strokeStyle = '#120803';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.1, eyeY - ry * 0.4);
    ctx.lineTo(cx, eyeY - ry * 0.85);
    ctx.lineTo(cx + rx * 1.1, eyeY - ry * 0.5);
    ctx.stroke();

    // Lower eyelid accentuating sanpaku gap
    ctx.strokeStyle = 'rgba(60, 30, 15, 0.40)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.8, eyeY + ry * 0.75);
    ctx.lineTo(cx + rx * 0.8, eyeY + ry * 0.75);
    ctx.stroke();
  });

  // Sharp, expressive angled brows sloping downwards toward center (intense Subaru look)
  ctx.strokeStyle = '#22150c';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.31);
  ctx.lineTo(w * 0.43, h * 0.38);
  ctx.moveTo(w * 0.57, h * 0.38);
  ctx.lineTo(w * 0.82, h * 0.31);
  ctx.stroke();

  // Nose
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(w * 0.49, h * 0.59, 4, 15);

  // Intense resolute grit mouth
  ctx.strokeStyle = '#442216';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w * 0.40, h * 0.73);
  ctx.lineTo(w * 0.60, h * 0.73);
  ctx.stroke();
}

function drawWeskerFace(ctx, w, h, skinColorHex, hairColorHex) {
  // Chiseled jawline contour
  ctx.fillStyle = 'rgba(40, 25, 20, 0.14)';
  ctx.beginPath();
  ctx.moveTo(w * 0.20, h * 0.72);
  ctx.lineTo(w * 0.50, h * 0.84);
  ctx.lineTo(w * 0.80, h * 0.72);
  ctx.stroke();

  // Polarized designer sunglasses
  drawSunglasses(ctx, w, h);

  // Stern ruthless lips
  ctx.strokeStyle = '#3a2016';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w * 0.41, h * 0.72);
  ctx.lineTo(w * 0.59, h * 0.72);
  ctx.stroke();

  // Lower lip shadow
  ctx.fillStyle = 'rgba(40, 20, 15, 0.20)';
  ctx.beginPath();
  ctx.ellipse(w * 0.50, h * 0.75, 16, 4, 0, 0, Math.PI);
  ctx.fill();
}

function drawRemFace(ctx, w, h, skinColorHex, hairColorHex) {
  // Soft pink blush on cheeks
  ctx.fillStyle = 'rgba(255, 115, 145, 0.46)';
  ctx.beginPath();
  ctx.ellipse(w * 0.28, h * 0.58, 38, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.72, h * 0.58, 38, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyeY = h * 0.46;
  const rx = 44;
  const ry = 56;

  // Render both eyes so face is anatomically complete and expressive from all angles
  [-1, 1].forEach((side) => {
    const cx = side === -1 ? w * 0.32 : w * 0.68;
    const outerDir = side === -1 ? -1 : 1;

    // Sclera
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sky-blue anime gradient iris
    const irisGrad = ctx.createRadialGradient(cx, eyeY - 8, 4, cx, eyeY + 4, ry * 0.85);
    irisGrad.addColorStop(0, '#d8f0ff');
    irisGrad.addColorStop(0.3, '#3a88e9');
    irisGrad.addColorStop(0.75, '#154a8e');
    irisGrad.addColorStop(1, '#082046');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY + 2, rx * 0.85, ry * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#041026';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY + 6, rx * 0.42, ry * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Large sweet anime sparkles
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.32, eyeY - ry * 0.28, rx * 0.28, ry * 0.30, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + rx * 0.35, eyeY + ry * 0.32, rx * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Delicate curved anime upper lash with outer wing
    ctx.fillStyle = '#0a101d';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY - ry + 4, rx * 1.08, 12, 0, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.85 * outerDir, eyeY - ry + 4);
    ctx.lineTo(cx + rx * 1.30 * outerDir, eyeY - ry - 8);
    ctx.lineTo(cx + rx * 0.80 * outerDir, eyeY - ry + 12);
    ctx.fill();
  });

  // Delicate arched anime brows for both eyes (matching Rem's sky blue hair)
  ctx.strokeStyle = '#1d487f';
  drawBrow(ctx, w * 0.22, h * 0.34, w * 0.42, h * 0.32, 8);
  drawBrow(ctx, w * 0.78, h * 0.34, w * 0.58, h * 0.32, 8);

  // Tiny anime nose dot
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.arc(w * 0.50, h * 0.60, 3, 0, Math.PI * 2);
  ctx.fill();

  // Sweet gentle smile
  ctx.strokeStyle = '#c84458';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(w * 0.50, h * 0.72, 16, 0.1, Math.PI - 0.1);
  ctx.stroke();
}

function drawAsunaFace(ctx, w, h, skinColorHex, hairColorHex) {
  // Soft coral blush
  ctx.fillStyle = 'rgba(255, 135, 120, 0.38)';
  ctx.beginPath();
  ctx.ellipse(w * 0.28, h * 0.58, 36, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.72, h * 0.58, 36, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyeY = h * 0.46;
  [-1, 1].forEach((side) => {
    const cx = side === -1 ? w * 0.32 : w * 0.68;
    const rx = 42;
    const ry = 52;

    // Sclera
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Warm hazel / chestnut anime iris
    const irisGrad = ctx.createRadialGradient(cx, eyeY - 6, 4, cx, eyeY + 4, ry * 0.85);
    irisGrad.addColorStop(0, '#f2a968');
    irisGrad.addColorStop(0.3, '#b85e28');
    irisGrad.addColorStop(0.75, '#6a2a0c');
    irisGrad.addColorStop(1, '#2a0e04');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY + 2, rx * 0.84, ry * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#100502';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY + 5, rx * 0.40, ry * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    // Elegant sparkles
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.30, eyeY - ry * 0.26, rx * 0.26, ry * 0.28, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + rx * 0.34, eyeY + ry * 0.30, rx * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Refined double upper lashes with flared outer wings
    ctx.fillStyle = '#1c0c06';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY - ry + 4, rx * 1.08, 12, 0, 0, Math.PI);
    ctx.fill();

    // Dual winged outer lashes
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.9, eyeY - ry + 4);
    ctx.lineTo(cx + rx * 1.30, eyeY - ry - 6);
    ctx.lineTo(cx + rx * 0.85, eyeY - ry + 12);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.7, eyeY - ry + 8);
    ctx.lineTo(cx + rx * 1.20, eyeY - ry + 2);
    ctx.lineTo(cx + rx * 0.80, eyeY - ry + 14);
    ctx.fill();
  });

  // Elegant arched anime brows
  ctx.strokeStyle = '#6a3212';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.34);
  ctx.lineTo(w * 0.42, h * 0.33);
  ctx.moveTo(w * 0.58, h * 0.33);
  ctx.lineTo(w * 0.78, h * 0.34);
  ctx.stroke();

  // Delicate nose dot
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.beginPath();
  ctx.arc(w * 0.50, h * 0.60, 3, 0, Math.PI * 2);
  ctx.fill();

  // Warm confident anime smile
  ctx.strokeStyle = '#c44248';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(w * 0.50, h * 0.72, 16, 0.15, Math.PI - 0.15);
  ctx.stroke();
}

function drawRaiderFace(ctx, w, h, skinColorHex, hairColorHex) {
  // 1. Gritty dark crimson / rust warpaint across cheeks and bridge
  ctx.fillStyle = 'rgba(140, 25, 12, 0.65)';
  ctx.beginPath();
  ctx.moveTo(w * 0.10, h * 0.38);
  ctx.lineTo(w * 0.48, h * 0.58);
  ctx.lineTo(w * 0.42, h * 0.66);
  ctx.lineTo(w * 0.08, h * 0.48);
  ctx.closePath();
  ctx.fill();

  // Jagged knife scar on left cheek
  ctx.strokeStyle = 'rgba(90, 18, 12, 0.85)';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.50);
  ctx.lineTo(w * 0.28, h * 0.58);
  ctx.lineTo(w * 0.36, h * 0.66);
  ctx.stroke();

  // Heavy 5-o'clock stubble on chin and cheeks
  ctx.fillStyle = 'rgba(35, 25, 20, 0.22)';
  ctx.beginPath();
  ctx.ellipse(w * 0.50, h * 0.78, w * 0.35, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyeY = h * 0.46;
  // Fierce squinting left eye
  const cx = w * 0.32;
  const rx = 36;
  const ry = 22;
  ctx.fillStyle = '#f0f0f4';
  ctx.beginPath();
  ctx.ellipse(cx, eyeY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const irisGrad = ctx.createRadialGradient(cx, eyeY, 2, cx, eyeY, 18);
  irisGrad.addColorStop(0, '#8c5838');
  irisGrad.addColorStop(0.7, '#4c2e1a');
  irisGrad.addColorStop(1, '#1a0e06');
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, eyeY, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#060302';
  ctx.beginPath();
  ctx.arc(cx, eyeY, 7, 0, Math.PI * 2);
  ctx.fill();

  // Heavy rugged top lash
  ctx.strokeStyle = '#140c06';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(cx, eyeY - ry * 0.5, rx * 1.05, ry * 0.55, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Right eye: worn leather eyepatch with steel buckles
  drawEyepatch(ctx, w * 0.68, eyeY, 52, skinColorHex);

  // Heavy aggressive tilted brow
  ctx.strokeStyle = '#22150d';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.32);
  ctx.lineTo(w * 0.44, h * 0.36);
  ctx.stroke();

  // Nose
  ctx.fillStyle = 'rgba(30, 15, 10, 0.40)';
  ctx.fillRect(w * 0.48, h * 0.58, 6, 18);

  // Tough gritty sneer
  ctx.strokeStyle = '#2a140c';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(w * 0.38, h * 0.74);
  ctx.lineTo(w * 0.52, h * 0.71);
  ctx.lineTo(w * 0.62, h * 0.74);
  ctx.stroke();
}

function drawCyborgFace(ctx, w, h, skinColorHex, hairColorHex) {
  const eyeY = h * 0.46;

  // Left eye: focused human eye
  const cx = w * 0.32;
  const rx = 38;
  const ry = 30;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, eyeY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const irisGrad = ctx.createRadialGradient(cx, eyeY, 2, cx, eyeY, 18);
  irisGrad.addColorStop(0, '#5a82a0');
  irisGrad.addColorStop(0.6, '#284860');
  irisGrad.addColorStop(1, '#0c1a24');
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.arc(cx, eyeY, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#050c12';
  ctx.beginPath();
  ctx.arc(cx, eyeY, 7.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 5, eyeY - 5, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#101820';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx, eyeY - ry * 0.5, rx * 1.05, ry * 0.55, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Right eye: Glowing high-tech cybernetic optic with targeting HUD
  drawCyberOptic(ctx, w * 0.68, eyeY, 48);

  // Facial cyber-seam line panel traces
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.54, h * 0.34);
  ctx.lineTo(w * 0.68, h * 0.30);
  ctx.lineTo(w * 0.88, h * 0.30);
  ctx.moveTo(w * 0.68, h * 0.60);
  ctx.lineTo(w * 0.86, h * 0.60);
  ctx.lineTo(w * 0.90, h * 0.75);
  ctx.stroke();

  // Eyebrow over left human eye
  drawBrow(ctx, w * 0.20, h * 0.34, w * 0.42, h * 0.35, 12);

  // Metallic cyber-panel over right brow
  ctx.fillStyle = '#222830';
  ctx.fillRect(w * 0.56, h * 0.32, w * 0.26, 12);
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(w * 0.58, h * 0.34, 16, 4);

  // Nose & mouth
  ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
  ctx.fillRect(w * 0.49, h * 0.59, 4, 16);

  ctx.strokeStyle = '#222a36';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.73);
  ctx.lineTo(w * 0.58, h * 0.73);
  ctx.stroke();
}

function drawVaultFace(ctx, w, h, skinColorHex, hairColorHex) {
  const eyeY = h * 0.46;
  [-1, 1].forEach((side) => {
    const cx = side === -1 ? w * 0.32 : w * 0.68;
    const rx = 38;
    const ry = 42;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, eyeY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    const irisGrad = ctx.createRadialGradient(cx, eyeY - 4, 2, cx, eyeY + 2, 20);
    irisGrad.addColorStop(0, '#6aa2d4');
    irisGrad.addColorStop(0.4, '#356aa0');
    irisGrad.addColorStop(0.85, '#153556');
    irisGrad.addColorStop(1, '#081524');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, eyeY + 1, 19, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#060d16';
    ctx.beginPath();
    ctx.arc(cx, eyeY + 2, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 6, eyeY - 6, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#121820';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.ellipse(cx, eyeY - ry * 0.5, rx * 1.05, ry * 0.55, side * 0.04, Math.PI, Math.PI * 2);
    ctx.stroke();
  });

  // Classic neat Vault eyebrows
  ctx.strokeStyle = hairColorHex || '#4a321a';
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.20, h * 0.34);
  ctx.lineTo(w * 0.42, h * 0.35);
  ctx.moveTo(w * 0.58, h * 0.35);
  ctx.lineTo(w * 0.80, h * 0.33); // playful confident raised right brow
  ctx.stroke();

  // Stylized retro nose
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(w * 0.49, h * 0.59, 4, 15);

  // Iconic confident Vault-Boy-style half-smile / smirk!
  ctx.strokeStyle = '#382014';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.73);
  ctx.lineTo(w * 0.52, h * 0.73);
  ctx.lineTo(w * 0.60, h * 0.69); // playful upward smirk
  ctx.stroke();
}

function drawCustomFace(ctx, w, h, config, skinColorHex, hairColorHex) {
  // Customizable face features
  if (config.faceFeature === 'camo') {
    ctx.fillStyle = 'rgba(30, 60, 20, 0.45)';
    ctx.fillRect(w * 0.15, h * 0.40, w * 0.70, 24);
  } else if (config.faceFeature === 'dirt') {
    ctx.fillStyle = 'rgba(25, 20, 15, 0.35)';
    ctx.fillRect(w * 0.18, h * 0.66, w * 0.64, 16);
  }

  const eyeY = h * 0.46;
  const irisColor = '#3a6690';
  drawAnimeEye(ctx, w * 0.32, eyeY, 40, 48, irisColor, false);
  drawAnimeEye(ctx, w * 0.68, eyeY, 40, 48, irisColor, false);

  drawBrow(ctx, w * 0.22, h * 0.34, w * 0.42, h * 0.36, 11);
  drawBrow(ctx, w * 0.58, h * 0.36, w * 0.78, h * 0.34, 11);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(w * 0.49, h * 0.59, 4, 15);

  ctx.strokeStyle = '#553322';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.44, h * 0.73);
  ctx.lineTo(w * 0.56, h * 0.73);
  ctx.stroke();
}

function drawBrow(ctx, x1, y1, x2, y2, thickness) {
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawAnimeEye(ctx, cx, cy, rx, ry, irisColor, isFemale = false) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const shadowGrad = ctx.createLinearGradient(cx, cy - ry, cx, cy);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.22)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const irisGrad = ctx.createRadialGradient(cx, cy - 8, 4, cx, cy + 4, ry * 0.85);
  irisGrad.addColorStop(0, '#ffffff');
  irisGrad.addColorStop(0.25, irisColor);
  irisGrad.addColorStop(0.85, '#0a1018');
  irisGrad.addColorStop(1, '#020408');

  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, rx * 0.82, ry * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#020408';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, rx * 0.42, ry * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.32, cy - ry * 0.28, rx * 0.28, ry * 0.30, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx + rx * 0.35, cy + ry * 0.32, rx * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0c0e12';
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry + 4, rx * 1.08, 12, 0, 0, Math.PI);
  ctx.fill();

  if (isFemale) {
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.9, cy - ry + 4);
    ctx.lineTo(cx + rx * 1.25, cy - ry - 6);
    ctx.lineTo(cx + rx * 0.8, cy - ry + 12);
    ctx.fill();
  }
}

function drawSunglasses(ctx, w, h) {
  const cy = h * 0.46;
  ctx.strokeStyle = '#d0d8e2';
  ctx.lineWidth = 6;
  ctx.fillStyle = '#0a0b0e';

  // Left Lens
  ctx.beginPath();
  ctx.roundRect(w * 0.16, cy - 36, w * 0.30, 68, 12);
  ctx.fill();
  ctx.stroke();

  // Right Lens
  ctx.beginPath();
  ctx.roundRect(w * 0.54, cy - 36, w * 0.30, 68, 12);
  ctx.fill();
  ctx.stroke();

  // Bridge
  ctx.beginPath();
  ctx.moveTo(w * 0.46, cy - 14);
  ctx.lineTo(w * 0.54, cy - 14);
  ctx.stroke();

  // Specular streaks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
  ctx.beginPath();
  ctx.moveTo(w * 0.20, cy - 30);
  ctx.lineTo(w * 0.26, cy - 30);
  ctx.lineTo(w * 0.22, cy + 24);
  ctx.lineTo(w * 0.16, cy + 24);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w * 0.58, cy - 30);
  ctx.lineTo(w * 0.64, cy - 30);
  ctx.lineTo(w * 0.60, cy + 24);
  ctx.lineTo(w * 0.54, cy + 24);
  ctx.closePath();
  ctx.fill();
}

function drawCyberOptic(ctx, cx, cy, rad) {
  ctx.fillStyle = '#0b0f14';
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 6;
  ctx.stroke();

  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, rad * 0.8);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.4, '#00e5ff');
  grad.addColorStop(1, '#004466');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - rad, cy);
  ctx.lineTo(cx + rad, cy);
  ctx.moveTo(cx, cy - rad);
  ctx.lineTo(cx, cy + rad);
  ctx.stroke();
}

function drawEyepatch(ctx, cx, cy, rad, skinColorHex) {
  ctx.strokeStyle = '#18120e';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(0, cy - 80);
  ctx.lineTo(512, cy + 100);
  ctx.stroke();

  ctx.fillStyle = '#1c1612';
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#32251a';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = '#a6b0bc';
  ctx.beginPath();
  ctx.arc(cx - rad * 0.6, cy - rad * 0.4, 4, 0, Math.PI * 2);
  ctx.arc(cx + rad * 0.6, cy - rad * 0.4, 4, 0, Math.PI * 2);
  ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Procedural High-Density Textures & Emblems
// ─────────────────────────────────────────────────────────────────────────────

function createRpdVestTexture() {
  return getCanvasTexture('rpd_chest_vest_v4', (ctx, w, h) => {
    ctx.fillStyle = '#161a22';
    ctx.fillRect(0, 0, w, h);

    // Ballistic Weave Texture Grid
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 2);
    }
    for (let x = 0; x < w; x += 4) {
      ctx.fillRect(x, 0, 2, h);
    }

    // MOLLE Webbing Straps (horizontal lines with bar-tacks)
    ctx.fillStyle = '#101318';
    for (let my = 120; my < 440; my += 50) {
      ctx.fillRect(w * 0.08, my, w * 0.84, 18);
      ctx.fillStyle = '#222832';
      for (let bx = w * 0.12; bx < w * 0.85; bx += 40) {
        ctx.fillRect(bx, my, 4, 18);
      }
      ctx.fillStyle = '#101318';
    }

    // Bold White R.P.D. Block Stencil Lettering
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 86px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 12;
    ctx.fillText('R.P.D.', w * 0.5, h * 0.28);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#cad6e4';
    ctx.fillText('SPECIAL TACTICS // S.T.A.R.S.', w * 0.5, h * 0.46);

    // Silver Police Shield Badge on Left Chest
    ctx.fillStyle = '#c5d2e0';
    ctx.beginPath();
    ctx.moveTo(w * 0.20, h * 0.20);
    ctx.lineTo(w * 0.32, h * 0.20);
    ctx.lineTo(w * 0.30, h * 0.38);
    ctx.lineTo(w * 0.26, h * 0.46);
    ctx.lineTo(w * 0.22, h * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a1f26';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Star inside badge
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.arc(w * 0.26, h * 0.28, 8, 0, Math.PI * 2);
    ctx.fill();
  }, 512, 512);
}

function createVault101BackTexture() {
  return getCanvasTexture('vault_back_101_v4', (ctx, w, h) => {
    ctx.fillStyle = '#14325a';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;

    // Industrial Cog Teeth Outer Ring
    ctx.fillStyle = '#e6a817';
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      const r = i % 2 === 0 ? 195 : 155;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Rivets on each tooth
    ctx.fillStyle = '#7a5405';
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const rx = cx + Math.cos(a) * 175;
      const ry = cy + Math.sin(a) * 175;
      ctx.beginPath();
      ctx.arc(rx, ry, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Inner Navy Core
    ctx.fillStyle = '#14325a';
    ctx.beginPath();
    ctx.arc(cx, cy, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e6a817';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Bold 101 Stencil
    ctx.fillStyle = '#e6a817';
    ctx.font = '900 120px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('101', cx, cy - 8);

    ctx.font = 'bold 22px monospace';
    ctx.fillText('VAULT-TEC', cx, cy + 62);
  }, 512, 512);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Main 3D Builder Function — 3-5x Geometry & Detail Overhaul
// ─────────────────────────────────────────────────────────────────────────────

export function buildCharacterModel(cust = {}, opts = {}) {
  const config = { ...getDefaultCustomization(), ...(cust || {}) };
  const mode = opts.mode || 'standing';
  const isSeated = mode === 'seated';

  // 1. Direct user-uploaded / dropped Blockbench (.bbmodel) file
  if (config.customBBModel) {
    try {
      return buildBBModel(config.customBBModel, { ...opts, cust: config });
    } catch (err) {
      console.error('Failed to build custom BBModel:', err);
    }
  }

  // 2. Named BBModel preset
  if (config.bbmodelPreset && BUILTIN_BBMODELS[config.bbmodelPreset]) {
    return buildBBModel(BUILTIN_BBMODELS[config.bbmodelPreset], { ...opts, cust: config });
  }

  // 3. Built-in high-detail BBModels (all 10 presets)
  if (config.preset && BUILTIN_BBMODELS[config.preset]) {
    return buildBBModel(BUILTIN_BBMODELS[config.preset], { ...opts, cust: config });
  }

  const isWeskerTarget = config.preset === 'wesker' || (config.headwear === 'sunglasses_wesker' && (config.topType === 'trench_coat' || config.hairStyle === 'sleek_back')) || (config.topType === 'trench_coat' && config.hairStyle === 'sleek_back');
  if (isWeskerTarget) {
    return buildWeskerModel(cust, opts);
  }

  const isKiritoTarget =
    config.preset === 'kirito' ||
    (config.topType === 'kirito_coat' && config.hairStyle === 'kirito') ||
    (config.topType === 'kirito_coat' && config.backAccessory === 'dual_swords') ||
    config.topType === 'kirito_coat' ||
    config.hairStyle === 'kirito';
  if (isKiritoTarget) {
    return buildKiritoModel(cust, opts);
  }

  const group = new THREE.Group();
  group.userData = { config, mode };

  // Palette resolution
  const skinEntry = SKIN_TONES.find(s => s.id === config.skinTone) || SKIN_TONES[1];
  const hairEntry = HAIR_COLORS.find(h => h.id === config.hairColor) || HAIR_COLORS[0];

  const skinColor = new THREE.Color(skinEntry.hex);
  const hairColor = new THREE.Color(hairEntry.hex);
  const topColor = new THREE.Color(config.topColor || '#1a273b');
  const accentColor = new THREE.Color(config.accentColor || '#3a5376');
  const pantsColor = new THREE.Color(config.pantsColor || '#161e2b');
  const bootsColor = new THREE.Color(config.bootsColor || '#121212');

  // Tuned PBR Materials with High Specular Definition & AO-ready Contrast
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.58, metalness: 0.03 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.48, metalness: 0.14 });
  const topMat = new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.60, metalness: 0.14 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.42, metalness: 0.28 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.72, metalness: 0.10 });
  const bootsMat = new THREE.MeshStandardMaterial({ color: bootsColor, roughness: 0.40, metalness: 0.28 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.92, roughness: 0.18 });
  const chromeMetalMat = new THREE.MeshStandardMaterial({ color: 0xd2d9e3, metalness: 0.98, roughness: 0.10 });
  const rustMetalMat = new THREE.MeshStandardMaterial({ color: 0x5e4230, metalness: 0.75, roughness: 0.65 });
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0xb5bec8, metalness: 0.94, roughness: 0.20 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe6a817, metalness: 0.88, roughness: 0.20 });
  const blackLeatherMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.38, metalness: 0.22 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf6f8fc, roughness: 0.48, metalness: 0.04 });
  const rubyGlassMat = new THREE.MeshStandardMaterial({
    color: 0xff0022,
    emissive: 0xff0033,
    emissiveIntensity: 1.6,
    roughness: 0.1,
    metalness: 0.9,
  });
  const neonCyanMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const subaruOrangeMat = new THREE.MeshStandardMaterial({ color: 0xee6618, roughness: 0.55 });
  const tunicRedMat = new THREE.MeshStandardMaterial({ color: 0xcc1818, roughness: 0.45 });

  const isRem = config.hairStyle === 'rem_bob' || config.topType === 'maid_dress' || config.preset === 'rem';
  const isLeon = config.hairStyle === 'leon_bangs' || config.topType === 'rpd_vest' || config.preset === 'leon';
  const isKirito = config.hairStyle === 'kirito' || config.topType === 'kirito_coat' || config.preset === 'kirito';
  const isWesker = config.headwear === 'sunglasses_wesker' || config.hairStyle === 'sleek_back' || config.preset === 'wesker';
  const isHunk = config.headwear === 'gasmask_hunk' || config.topType === 'combat_rig' || config.preset === 'hunk';
  const isAsuna = config.hairStyle === 'asuna_long' || config.topType === 'asuna_tunic' || config.preset === 'asuna';
  const isSubaru = config.topType === 'subaru_jacket' || config.hairStyle === 'spiky' || config.preset === 'subaru';
  const isCyborg = config.topType === 'cyber_jacket' || config.preset === 'cyborg' || config.faceFeature === 'cyber_eye' || config.wristDevice === 'cyber_arm';
  const isRaider = config.topType === 'raider_vest' || config.hairStyle === 'mohawk' || config.preset === 'raider';
  const isVault = config.topType === 'vault_suit' || config.preset === 'vault101';

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. LOWER BODY: Pelvis, Legs, Belts, Holster, Skirt, Boots
  // ═══════════════════════════════════════════════════════════════════════════
  const lowerBody = new THREE.Group();
  group.add(lowerBody);

  const pelvisY = isSeated ? 0.52 : 0.86;
  const pelvisW = isRem || isAsuna ? 0.32 : 0.36;
  const pelvisD = isRem || isAsuna ? 0.18 : 0.20;

  const pelvisMat = isRem ? blackLeatherMat : (isAsuna ? whiteMat : pantsMat);
  const pelvisGroup = createDetailedPelvis(pelvisW, 0.12, pelvisD, pelvisMat);
  pelvisGroup.position.set(0, pelvisY, 0);
  lowerBody.add(pelvisGroup);
  addAOShadow(pelvisGroup, pelvisW, pelvisD, -0.065, pelvisMat);

  // ── DETAILED DUTY BELTS & POUCHES (3-5x Density) ──
  if (!isRem && !isAsuna) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(pelvisW + 0.02, 0.05, pelvisD + 0.02), blackLeatherMat);
    belt.position.set(0, pelvisY + 0.04, 0);
    lowerBody.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), isLeon ? metalMat : (isRaider ? rustMetalMat : goldMat));
    buckle.position.set(0, pelvisY + 0.04, pelvisD / 2 + 0.015);
    lowerBody.add(buckle);

    // Rear Utility Equipment: Canteen / Handcuff case
    const canteen = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.05), isRaider ? rustMetalMat : (isLeon ? blackLeatherMat : metalMat));
    canteen.position.set(-0.10, pelvisY + 0.04, -pelvisD / 2 - 0.03);
    lowerBody.add(canteen);

    const medPouch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.04), blackLeatherMat);
    medPouch.position.set(0.10, pelvisY + 0.04, -pelvisD / 2 - 0.025);
    lowerBody.add(medPouch);
  }

  // ── REM'S 4-TIERED GEOMETRIC MAID SKIRT & 3D APRON ──
  if (isRem) {
    const skirtGroup = new THREE.Group();
    skirtGroup.position.set(0, pelvisY, 0);
    lowerBody.add(skirtGroup);

    // Tier 1: Waistband & upper black flounce
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.22), blackLeatherMat);
    t1.position.y = -0.04;
    skirtGroup.add(t1);

    // Tier 2: 4 Angled Pleated Skirt Flounces (Front, Back, Left, Right)
    const fFlounce = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.04), blackLeatherMat);
    fFlounce.position.set(0, -0.12, 0.12);
    fFlounce.rotation.x = 0.35;
    skirtGroup.add(fFlounce);

    const bFlounce = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.04), blackLeatherMat);
    bFlounce.position.set(0, -0.12, -0.12);
    bFlounce.rotation.x = -0.35;
    skirtGroup.add(bFlounce);

    const lFlounce = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.26), blackLeatherMat);
    lFlounce.position.set(-0.19, -0.12, 0);
    lFlounce.rotation.z = 0.35;
    skirtGroup.add(lFlounce);

    const rFlounce = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.26), blackLeatherMat);
    rFlounce.position.set(0.19, -0.12, 0);
    rFlounce.rotation.z = -0.35;
    skirtGroup.add(rFlounce);

    // Tier 3: Flared Bottom Pleat Frame
    const baseBorder = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.30), blackLeatherMat);
    baseBorder.position.y = -0.18;
    skirtGroup.add(baseBorder);

    // Tier 4: Scalloped White Lace Petticoat Hem Peeking Underneath
    const petticoat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.32), whiteMat);
    petticoat.position.y = -0.22;
    skirtGroup.add(petticoat);

    // 3D White Apron Overlay on Front with ruffles
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.20, 0.02), whiteMat);
    apron.position.set(0, -0.11, 0.145);
    apron.rotation.x = 0.22;
    skirtGroup.add(apron);

    const apronRuffle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.025), whiteMat);
    apronRuffle.position.set(0, -0.20, 0.165);
    skirtGroup.add(apronRuffle);

    // Large 3D Tied Satin Butterfly Bow at small of back with dual loops & streamers
    const bowCenter = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), whiteMat);
    bowCenter.position.set(0, 0.02, -0.13);
    skirtGroup.add(bowCenter);

    const bowL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), whiteMat);
    bowL.position.set(-0.09, 0.03, -0.14);
    bowL.rotation.z = 0.35;
    skirtGroup.add(bowL);

    const bowR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), whiteMat);
    bowR.position.set(0.09, 0.03, -0.14);
    bowR.rotation.z = -0.35;
    skirtGroup.add(bowR);

    const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.26, 0.015), whiteMat);
    ribL.position.set(-0.05, -0.13, -0.14);
    ribL.rotation.z = 0.18;
    skirtGroup.add(ribL);

    const ribR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.26, 0.015), whiteMat);
    ribR.position.set(0.05, -0.13, -0.14);
    ribR.rotation.z = -0.18;
    skirtGroup.add(ribR);
  }

  // ── ASUNA'S KNIGHT SKIRT WITH SCARLET TRIM ──
  if (isAsuna) {
    const skirtGroup = new THREE.Group();
    skirtGroup.position.set(0, pelvisY, 0);
    lowerBody.add(skirtGroup);

    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.22), whiteMat);
    t1.position.y = -0.04;
    skirtGroup.add(t1);

    const skirtFlare = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.16, 0.28), whiteMat);
    skirtFlare.position.y = -0.12;
    skirtGroup.add(skirtFlare);

    const redBorder = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.30), tunicRedMat);
    redBorder.position.y = -0.21;
    skirtGroup.add(redBorder);

    // Gold belt clasps on hips
    const claspL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.04), goldMat);
    claspL.position.set(-0.18, -0.04, 0);
    skirtGroup.add(claspL);

    const claspR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.04), goldMat);
    claspR.position.set(0.18, -0.04, 0);
    skirtGroup.add(claspR);
  }

  // ── LEGS & BOOTS (Ultra-Detailed with Kneepads, Laces, Soles) ──
  const legW = isRem || isAsuna ? 0.10 : 0.13;
  const legD = isRem || isAsuna ? 0.12 : 0.13;
  const legSpacing = isRem || isAsuna ? 0.08 : 0.11;
  const thighMat = isRem ? skinMat : (isAsuna ? whiteMat : pantsMat);
  const shinMat = isRem ? whiteMat : (isAsuna ? whiteMat : pantsMat);

  if (isSeated) {
    // SEATED: Thighs forward (+Z), Shins down (-Y)
    const lThigh = createDetailedLeg(legW, 0.34, legW, thighMat, true);
    lThigh.position.set(-legSpacing, 0.50, 0.16);
    lThigh.rotation.x = Math.PI / 2;
    lowerBody.add(lThigh);

    const rThigh = createDetailedLeg(legW, 0.34, legW, thighMat, true);
    rThigh.position.set(legSpacing, 0.50, 0.16);
    rThigh.rotation.x = Math.PI / 2;
    lowerBody.add(rThigh);

    // Rem: Black garter clips on thighs
    if (isRem) {
      const garterL = new THREE.Mesh(new THREE.BoxGeometry(legW + 0.015, 0.02, 0.08), blackLeatherMat);
      garterL.position.set(-legSpacing, 0.51, 0.06);
      lowerBody.add(garterL);

      const garterR = new THREE.Mesh(new THREE.BoxGeometry(legW + 0.015, 0.02, 0.08), blackLeatherMat);
      garterR.position.set(legSpacing, 0.51, 0.06);
      lowerBody.add(garterR);
    }

    // Leon: 3D Tactical Holster on right thigh with VP70 pistol
    if (isLeon) {
      addTacticalHolster(lowerBody, legSpacing, 0.52, 0.16, true, metalMat, blackLeatherMat);
    }

    const lShin = createDetailedLeg(legW, 0.36, legD, shinMat, false);
    lShin.position.set(-legSpacing, 0.24, 0.32);
    lowerBody.add(lShin);

    const rShin = createDetailedLeg(legW, 0.36, legD, shinMat, false);
    rShin.position.set(legSpacing, 0.24, 0.32);
    lowerBody.add(rShin);

    // Knee guards for combat/Leon/Hunk/Raider
    if (!isRem && !isAsuna) {
      const kGeo = new THREE.BoxGeometry(legW + 0.01, 0.08, 0.03);
      const lKnee = new THREE.Mesh(kGeo, isRaider ? rustMetalMat : (isLeon ? blackLeatherMat : metalMat));
      lKnee.position.set(-legSpacing, 0.50, 0.34);
      lowerBody.add(lKnee);

      const rKnee = new THREE.Mesh(kGeo, isRaider ? rustMetalMat : (isLeon ? blackLeatherMat : metalMat));
      rKnee.position.set(legSpacing, 0.50, 0.34);
      lowerBody.add(rKnee);

      // Raider: Sharp spikes on left knee
      if (isRaider) {
        const kSpike = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06, 4), spikeMat);
        kSpike.rotation.x = Math.PI / 2;
        kSpike.position.set(-legSpacing, 0.50, 0.38);
        lowerBody.add(kSpike);
      }
    }

    // Boots (detailed with toe cap, heel, laces)
    const seatedBootMat = isAsuna ? whiteMat : (isRem ? blackLeatherMat : bootsMat);
    const lBoot = createDetailedBoot(legW + 0.01, 0.09, 0.22, seatedBootMat, blackLeatherMat);
    lBoot.position.set(-legSpacing, 0.045, 0.37);
    lowerBody.add(lBoot);

    const rBoot = createDetailedBoot(legW + 0.01, 0.09, 0.22, seatedBootMat, blackLeatherMat);
    rBoot.position.set(legSpacing, 0.045, 0.37);
    lowerBody.add(rBoot);
  } else {
    // STANDING: Upright legs (tapered geometry)
    const lThigh = createDetailedLeg(legW, 0.42, legD, thighMat, true);
    lThigh.position.set(-legSpacing, 0.62, 0);
    lowerBody.add(lThigh);

    const rThigh = createDetailedLeg(legW, 0.42, legD, thighMat, true);
    rThigh.position.set(legSpacing, 0.62, 0);
    lowerBody.add(rThigh);

    // Rem: Garter straps
    if (isRem) {
      const garterL = new THREE.Mesh(new THREE.BoxGeometry(legW + 0.015, 0.02, legD + 0.015), blackLeatherMat);
      garterL.position.set(-legSpacing, 0.76, 0);
      lowerBody.add(garterL);

      const garterR = new THREE.Mesh(new THREE.BoxGeometry(legW + 0.015, 0.02, legD + 0.015), blackLeatherMat);
      garterR.position.set(legSpacing, 0.76, 0);
      lowerBody.add(garterR);
    }

    // Subaru: Dual White and Orange Racing Stripes down outer legs
    if (isSubaru) {
      const stripeGeo = new THREE.BoxGeometry(0.015, 0.74, 0.03);
      const lStripe = new THREE.Mesh(stripeGeo, subaruOrangeMat);
      lStripe.position.set(-legSpacing - legW / 2 - 0.005, 0.44, 0);
      lowerBody.add(lStripe);

      const rStripe = new THREE.Mesh(stripeGeo, subaruOrangeMat);
      rStripe.position.set(legSpacing + legW / 2 + 0.005, 0.44, 0);
      lowerBody.add(rStripe);
    }

    // Leon: 3D Tactical Holster on right thigh with VP70 pistol
    if (isLeon) {
      addTacticalHolster(lowerBody, legSpacing, 0.62, 0, false, metalMat, blackLeatherMat);

      // Left Thigh Mag Pouch
      const magPouch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.08), blackLeatherMat);
      magPouch.position.set(-legSpacing - 0.07, 0.62, 0);
      lowerBody.add(magPouch);
    }

    const lShin = createDetailedLeg(legW, 0.34, legD, shinMat, false);
    lShin.position.set(-legSpacing, 0.24, 0);
    lowerBody.add(lShin);

    const rShin = createDetailedLeg(legW, 0.34, legD, shinMat, false);
    rShin.position.set(legSpacing, 0.24, 0);
    lowerBody.add(rShin);

    // Knee guards
    if (!isRem && !isAsuna) {
      const kGeo = new THREE.BoxGeometry(legW + 0.01, 0.08, 0.03);
      const lKnee = new THREE.Mesh(kGeo, isRaider ? rustMetalMat : (isLeon ? blackLeatherMat : metalMat));
      lKnee.position.set(-legSpacing, 0.43, legD / 2 + 0.01);
      lowerBody.add(lKnee);

      const rKnee = new THREE.Mesh(kGeo, isRaider ? rustMetalMat : (isLeon ? blackLeatherMat : metalMat));
      rKnee.position.set(legSpacing, 0.43, legD / 2 + 0.01);
      lowerBody.add(rKnee);

      // Raider: Sharp spikes on left knee
      if (isRaider) {
        const kSpike = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06, 4), spikeMat);
        kSpike.rotation.x = Math.PI / 2;
        kSpike.position.set(-legSpacing, 0.43, legD / 2 + 0.05);
        lowerBody.add(kSpike);
      }
    }

    // Boots (detailed with toe cap, heel, laces)
    const standBootMat = isAsuna ? whiteMat : (isRem ? blackLeatherMat : bootsMat);
    const lBoot = createDetailedBoot(legW + 0.01, 0.10, 0.22, standBootMat, blackLeatherMat);
    lBoot.position.set(-legSpacing, 0.05, 0.03);
    lowerBody.add(lBoot);

    const rBoot = createDetailedBoot(legW + 0.01, 0.10, 0.22, standBootMat, blackLeatherMat);
    rBoot.position.set(legSpacing, 0.05, 0.03);
    lowerBody.add(rBoot);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. TORSO, ARMOR & MULTI-LAYER OUTFITS (Anatomical Stylized 3D)
  // ═══════════════════════════════════════════════════════════════════════════
  const torsoY = isSeated ? 0.78 : 1.12;
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, torsoY, 0);
  group.add(torsoGroup);
  group.userData.torso = torsoGroup;

  const torsoW = isRem || isAsuna ? 0.30 : 0.38;
  const torsoH = isRem || isAsuna ? 0.42 : 0.46;
  const torsoD = isRem || isAsuna ? 0.17 : 0.20;

  // Base Anatomical Torso: Articulated Upper Chest + Slender Tapered Waist (Matching 2nd Screenshot)
  const baseMat = isRem ? skinMat : (isAsuna ? whiteMat : (isSubaru ? blackLeatherMat : topMat));

  if (isRem || isAsuna) {
    // Feminine: Tapered upper bustier chest + slender pinched waist
    const chestH = torsoH * 0.55;
    const waistH = torsoH * 0.45;

    const chestMesh = createBeveledBox(torsoW, chestH, torsoD, 0.008, baseMat);
    chestMesh.position.set(0, waistH / 2, 0);
    torsoGroup.add(chestMesh);

    // ── 3D Sculpted Female Bust Geometry (Anatomical anime bust profile) ──
    const bustMat = isRem ? blackLeatherMat : (isAsuna ? whiteMat : topMat);
    const bustGroup = new THREE.Group();
    bustGroup.position.set(0, 0.065, torsoD / 2 + 0.024);
    torsoGroup.add(bustGroup);

    // Left and right contoured breast volumes
    [-1, 1].forEach((side) => {
      // Main contoured breast cup
      const cup = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.10, 0.052), bustMat);
      cup.position.set(side * 0.062, 0, 0);
      cup.rotation.z = side * 0.08;
      cup.rotation.x = -0.08;
      cup.castShadow = true;
      bustGroup.add(cup);

      // Underbust curved support bevel
      const underBevel = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.030, 0.040), bustMat);
      underBevel.position.set(side * 0.058, -0.045, -0.008);
      underBevel.rotation.z = side * 0.06;
      bustGroup.add(underBevel);

      // Upper décolletage taper slope
      const upperSlopeMat = isRem ? skinMat : bustMat;
      const upperSlope = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.035, 0.035), upperSlopeMat);
      upperSlope.position.set(side * 0.058, 0.050, -0.010);
      upperSlope.rotation.x = 0.22;
      bustGroup.add(upperSlope);
    });

    // Central cleavage cleft / valley
    const cleft = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.085, 0.028), bustMat);
    cleft.position.set(0, 0, -0.012);
    bustGroup.add(cleft);

    // Slender pinched waist (exact proportions of the reference model)
    const waistW = torsoW * 0.76;
    const waistD = torsoD * 0.82;
    const waistMesh = createTaperedBox(torsoW * 0.76, torsoW * 0.68, waistH, torsoD * 0.82, torsoD * 0.78, isRem ? blackLeatherMat : baseMat);
    waistMesh.position.set(0, -chestH / 2, 0);
    torsoGroup.add(waistMesh);
    addAOShadow(torsoGroup, torsoW * 0.5, torsoD * 0.6, -chestH / 2 - waistH / 2 + 0.01, baseMat);
  } else {
    // Masculine: Broad athletic chest + V-taper waist (beveled geometry)
    const chestH = torsoH * 0.58;
    const waistH = torsoH * 0.42;

    const chestMesh = createBeveledBox(torsoW, chestH, torsoD, 0.01, baseMat);
    chestMesh.position.set(0, waistH / 2, 0);
    torsoGroup.add(chestMesh);

    // Pectoral definition (subtle front volume)
    [-1, 1].forEach(side => {
      const pec = new THREE.Mesh(
        new THREE.BoxGeometry(torsoW * 0.35, chestH * 0.4, 0.02),
        baseMat
      );
      pec.position.set(side * torsoW * 0.18, waistH / 2 + chestH * 0.1, torsoD / 2 + 0.008);
      pec.rotation.z = side * 0.05;
      torsoGroup.add(pec);
    });

    // Shoulder ridge bevels
    [-1, 1].forEach(side => {
      const shoulderBevel = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.025, torsoD * 0.9),
        baseMat
      );
      shoulderBevel.position.set(side * (torsoW / 2 + 0.01), torsoH / 2 - 0.01, 0);
      shoulderBevel.rotation.z = side * 0.4;
      torsoGroup.add(shoulderBevel);
    });

    const waistW = torsoW * 0.85;
    const waistD = torsoD * 0.88;
    const waistMesh = createTaperedBox(waistW, waistW * 0.92, waistH, waistD, waistD * 0.94, baseMat);
    waistMesh.position.set(0, -chestH / 2, 0);
    torsoGroup.add(waistMesh);

    // Spine channel (subtle groove on back)
    const spineGroove = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, torsoH * 0.8, 0.008),
      createAOMaterial(baseMat, 0.75)
    );
    spineGroove.position.set(0, 0, -torsoD / 2 - 0.002);
    torsoGroup.add(spineGroove);

    // Under-arm AO strips
    [-1, 1].forEach(side => {
      const aoStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, torsoH * 0.25, torsoD * 0.35),
        createAOMaterial(baseMat, 0.65)
      );
      aoStrip.position.set(side * (torsoW / 2 - 0.004), torsoH * 0.15, 0);
      torsoGroup.add(aoStrip);
    });

    addAOShadow(torsoGroup, torsoW * 0.6, torsoD * 0.7, -chestH / 2 - waistH / 2 + 0.01, baseMat);
  }

  // ── A. LEON S. KENNEDY: R.P.D. TACTICAL SWAT BODY ARMOR (HIGH-DENSITY 3D SCULPT) ──
  if (config.topType === 'rpd_vest') {
    // 1. Shirt collar & epaulets with metal buttons
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.08), topMat);
    collar.position.set(0, torsoH / 2 + 0.01, 0.04);
    torsoGroup.add(collar);

    const epauletL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.14), topMat);
    epauletL.position.set(-torsoW / 2 + 0.02, torsoH / 2 + 0.01, 0);
    torsoGroup.add(epauletL);
    const btnEpL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 8), metalMat);
    btnEpL.position.set(-torsoW / 2 + 0.04, torsoH / 2 + 0.022, 0.04);
    torsoGroup.add(btnEpL);

    const epauletR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.14), topMat);
    epauletR.position.set(torsoW / 2 - 0.02, torsoH / 2 + 0.01, 0);
    torsoGroup.add(epauletR);
    const btnEpR = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 8), metalMat);
    btnEpR.position.set(torsoW / 2 - 0.04, torsoH / 2 + 0.022, 0.04);
    torsoGroup.add(btnEpR);

    // 2. Heavy Front Ballistic Plate with Bevelled Edge & Corner Hex Bolts
    const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.03, torsoH - 0.04, 0.06), blackLeatherMat);
    frontPlate.position.set(0, 0, torsoD / 2 + 0.02);
    torsoGroup.add(frontPlate);

    const boltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.015, 6);
    boltGeo.rotateX(Math.PI / 2);
    const boltPositions = [
      [-torsoW / 2 + 0.02, torsoH / 2 - 0.05],
      [torsoW / 2 - 0.02, torsoH / 2 - 0.05],
      [-torsoW / 2 + 0.02, -torsoH / 2 + 0.05],
      [torsoW / 2 - 0.02, -torsoH / 2 + 0.05],
    ];
    boltPositions.forEach(([bx, by]) => {
      const bolt = new THREE.Mesh(boltGeo, metalMat);
      bolt.position.set(bx, by, torsoD / 2 + 0.055);
      torsoGroup.add(bolt);
    });

    // 3. TRUE 3D VOLUMETRIC "R.P.D." LETTERS (ZERO FLAT TEXTURE STICKER!)
    const rpdWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    const rpdZ = torsoD / 2 + 0.058;
    const rpdY = 0.075;

    // --- Letter 'R' (centered at x = -0.10) ---
    const rSpine = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.072, 0.016), rpdWhiteMat);
    rSpine.position.set(-0.116, rpdY, rpdZ);
    torsoGroup.add(rSpine);
    const rTop = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.016), rpdWhiteMat);
    rTop.position.set(-0.096, rpdY + 0.028, rpdZ);
    torsoGroup.add(rTop);
    const rMid = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.016), rpdWhiteMat);
    rMid.position.set(-0.096, rpdY + 0.003, rpdZ);
    torsoGroup.add(rMid);
    const rLoop = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.038, 0.016), rpdWhiteMat);
    rLoop.position.set(-0.076, rpdY + 0.016, rpdZ);
    torsoGroup.add(rLoop);
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.038, 0.016), rpdWhiteMat);
    rLeg.position.set(-0.078, rpdY - 0.018, rpdZ);
    rLeg.rotation.z = -0.42;
    torsoGroup.add(rLeg);

    // --- Dot 1 ---
    const dot1 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.016), rpdWhiteMat);
    dot1.position.set(-0.055, rpdY - 0.028, rpdZ);
    torsoGroup.add(dot1);

    // --- Letter 'P' (centered at x = -0.01) ---
    const pSpine = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.072, 0.016), rpdWhiteMat);
    pSpine.position.set(-0.026, rpdY, rpdZ);
    torsoGroup.add(pSpine);
    const pTop = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.016), rpdWhiteMat);
    pTop.position.set(-0.006, rpdY + 0.028, rpdZ);
    torsoGroup.add(pTop);
    const pMid = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.016), rpdWhiteMat);
    pMid.position.set(-0.006, rpdY + 0.003, rpdZ);
    torsoGroup.add(pMid);
    const pLoop = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.038, 0.016), rpdWhiteMat);
    pLoop.position.set(0.014, rpdY + 0.016, rpdZ);
    torsoGroup.add(pLoop);

    // --- Dot 2 ---
    const dot2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.016), rpdWhiteMat);
    dot2.position.set(0.035, rpdY - 0.028, rpdZ);
    torsoGroup.add(dot2);

    // --- Letter 'D' (centered at x = 0.08) ---
    const dSpine = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.072, 0.016), rpdWhiteMat);
    dSpine.position.set(0.062, rpdY, rpdZ);
    torsoGroup.add(dSpine);
    const dTop = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.016), rpdWhiteMat);
    dTop.position.set(0.082, rpdY + 0.028, rpdZ);
    torsoGroup.add(dTop);
    const dBot = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.016), rpdWhiteMat);
    dBot.position.set(0.082, rpdY - 0.028, rpdZ);
    torsoGroup.add(dBot);
    const dLoop = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.054, 0.016), rpdWhiteMat);
    dLoop.position.set(0.102, rpdY, rpdZ);
    torsoGroup.add(dLoop);

    // --- Dot 3 ---
    const dot3 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.016), rpdWhiteMat);
    dot3.position.set(0.122, rpdY - 0.028, rpdZ);
    torsoGroup.add(dot3);

    // 4. 3D POLICE SHIELD BADGE ON LEFT BREAST WITH 5-POINT STAR
    const badgeBase = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.016), goldMat);
    badgeBase.position.set(-0.10, 0.155, torsoD / 2 + 0.055);
    torsoGroup.add(badgeBase);

    const badgeStar = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.012, 5), metalMat);
    badgeStar.rotation.x = Math.PI / 2;
    badgeStar.position.set(-0.10, 0.155, torsoD / 2 + 0.065);
    torsoGroup.add(badgeStar);

    // 5. 3D "KENNEDY" NAME TAPE ON RIGHT BREAST
    const nameTape = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.014), blackLeatherMat);
    nameTape.position.set(0.09, 0.155, torsoD / 2 + 0.055);
    torsoGroup.add(nameTape);
    const nameGoldStrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.016), goldMat);
    nameGoldStrip.position.set(0.09, 0.155, torsoD / 2 + 0.062);
    torsoGroup.add(nameGoldStrip);

    // 6. 3D MOLLE WEBBING GRID RAILS ACROSS LOWER CHEST
    const molleMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.9 });
    const stitchMat = new THREE.MeshStandardMaterial({ color: 0x333b47, roughness: 0.7 });
    const molleRows = [-0.035, -0.095, -0.155];
    molleRows.forEach((my) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.020, 0.014), molleMat);
      rail.position.set(0, my, torsoD / 2 + 0.055);
      torsoGroup.add(rail);

      // Vertical bar-tack stitches dividing webbing into tactical loops
      for (let stx = -0.14; stx <= 0.14; stx += 0.07) {
        const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.024, 0.018), stitchMat);
        stitch.position.set(stx, my, torsoD / 2 + 0.058);
        torsoGroup.add(stitch);
      }
    });

    // 7. 4 MODULAR UTILITY POUCHES WITH 3D FLAPS, BUCKLES & PULL TABS
    const pouchMat = new THREE.MeshStandardMaterial({ color: 0x15191f, roughness: 0.8 });
    const flapMat = new THREE.MeshStandardMaterial({ color: 0x1f252e, roughness: 0.7 });
    const pouchPositions = [
      [-0.10, -0.08],
      [0.10, -0.08],
      [-0.10, -0.15],
      [0.10, -0.15],
    ];
    pouchPositions.forEach(([px, py]) => {
      // Pouch body
      const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.045), pouchMat);
      pBody.position.set(px, py, torsoD / 2 + 0.075);
      torsoGroup.add(pBody);
      // Pouch top flap
      const pFlap = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.022, 0.048), flapMat);
      pFlap.position.set(px, py + 0.025, torsoD / 2 + 0.078);
      torsoGroup.add(pFlap);
      // Metal retention buckle / tab
      const pBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.010), metalMat);
      pBuckle.position.set(px, py + 0.012, torsoD / 2 + 0.104);
      torsoGroup.add(pBuckle);
    });

    // 8. Medical IFAK Trauma Kit in center
    const ifak = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.055, 0.040), pouchMat);
    ifak.position.set(0, -0.12, torsoD / 2 + 0.072);
    torsoGroup.add(ifak);
    const ifakCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.024, 0.008), tunicRedMat);
    ifakCrossV.position.set(0, -0.12, torsoD / 2 + 0.095);
    torsoGroup.add(ifakCrossV);
    const ifakCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.008), tunicRedMat);
    ifakCrossH.position.set(0, -0.12, torsoD / 2 + 0.095);
    torsoGroup.add(ifakCrossH);

    // 9. Side Compression Straps with Dual Fastex Buckles
    for (let sy = -0.08; sy <= 0.08; sy += 0.08) {
      const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, torsoD + 0.04), blackLeatherMat);
      strapL.position.set(-torsoW / 2 - 0.01, sy, 0);
      torsoGroup.add(strapL);

      const fastexL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.04), metalMat);
      fastexL.position.set(-torsoW / 2 - 0.02, sy, 0);
      torsoGroup.add(fastexL);

      const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, torsoD + 0.04), blackLeatherMat);
      strapR.position.set(torsoW / 2 + 0.01, sy, 0);
      torsoGroup.add(strapR);

      const fastexR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.04), metalMat);
      fastexR.position.set(torsoW / 2 + 0.02, sy, 0);
      torsoGroup.add(fastexR);
    }

    // 10. Heavy Back Ballistic Plate with Raised White 3D "R.P.D." on Back
    const backPlate = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.03, torsoH - 0.04, 0.05), blackLeatherMat);
    backPlate.position.set(0, 0, -torsoD / 2 - 0.02);
    torsoGroup.add(backPlate);

    // Back RPD lettering in 3D
    const bZ = -torsoD / 2 - 0.048;
    const bY = 0.06;
    const bR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.014), rpdWhiteMat);
    bR.position.set(-0.06, bY, bZ);
    torsoGroup.add(bR);
    const bP = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.014), rpdWhiteMat);
    bP.position.set(0, bY, bZ);
    torsoGroup.add(bP);
    const bD = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.014), rpdWhiteMat);
    bD.position.set(0.06, bY, bZ);
    torsoGroup.add(bD);

    // 11. Tactical Shoulder Radio with Antenna, Dials, & Coiled Mic Wire
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.05), metalMat);
    radio.position.set(-0.16, torsoH / 2 + 0.02, 0.04);
    torsoGroup.add(radio);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.14), metalMat);
    antenna.position.set(-0.16, torsoH / 2 + 0.12, 0.04);
    torsoGroup.add(antenna);

    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 8), goldMat);
    dial.position.set(-0.14, torsoH / 2 + 0.065, 0.04);
    torsoGroup.add(dial);
  }

  // ── B. KIRITO: BLACK SWORDSMAN DUSTER COAT WITH SILVER TRIMS & COAT TAILS ──
  else if (config.topType === 'kirito_coat') {
    const collarL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.16), topMat);
    collarL.position.set(-0.14, torsoH / 2 + 0.06, 0.01);
    torsoGroup.add(collarL);

    const collarR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.16), topMat);
    collarR.position.set(0.14, torsoH / 2 + 0.06, 0.01);
    torsoGroup.add(collarR);

    const collarB = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.03), topMat);
    collarB.position.set(0, torsoH / 2 + 0.06, -0.08);
    torsoGroup.add(collarB);

    const trimMat = new THREE.MeshStandardMaterial({ color: 0xd6dde6, metalness: 0.9, roughness: 0.2 });
    const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.02, torsoH, 0.02), trimMat);
    trimL.position.set(-0.06, 0, torsoD / 2 + 0.01);
    torsoGroup.add(trimL);

    const trimR = new THREE.Mesh(new THREE.BoxGeometry(0.02, torsoH, 0.02), trimMat);
    trimR.position.set(0.06, 0, torsoD / 2 + 0.01);
    torsoGroup.add(trimR);

    // 8 Silver Studs / Buttons along lapels
    for (let b = -0.16; b <= 0.14; b += 0.09) {
      const bL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.015, 8), trimMat);
      bL.rotation.x = Math.PI / 2;
      bL.position.set(-0.06, b, torsoD / 2 + 0.022);
      torsoGroup.add(bL);

      const bR = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.015, 8), trimMat);
      bR.rotation.x = Math.PI / 2;
      bR.position.set(0.06, b, torsoD / 2 + 0.022);
      torsoGroup.add(bR);
    }

    // Diagonal Baldric Chest Strap with Ornate Silver Buckle
    const strap = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.04, 0.045, 0.025), blackLeatherMat);
    strap.position.set(0, 0.08, torsoD / 2 + 0.015);
    strap.rotation.z = -0.32;
    torsoGroup.add(strap);

    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), trimMat);
    clasp.position.set(-0.04, 0.08, torsoD / 2 + 0.025);
    torsoGroup.add(clasp);

    // Flowing Coat Tails with silver borders
    const tailBack = new THREE.Mesh(new THREE.BoxGeometry(torsoW, 0.46, 0.03), topMat);
    tailBack.position.set(0, -torsoH / 2 - 0.22, -torsoD / 2 - 0.01);
    tailBack.rotation.x = isSeated ? 0.35 : 0.08;
    torsoGroup.add(tailBack);

    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, torsoD), topMat);
    tailL.position.set(-torsoW / 2 - 0.01, -torsoH / 2 - 0.20, 0);
    tailL.rotation.z = -0.06;
    torsoGroup.add(tailL);

    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, torsoD), topMat);
    tailR.position.set(torsoW / 2 + 0.01, -torsoH / 2 - 0.20, 0);
    tailR.rotation.z = 0.06;
    torsoGroup.add(tailR);
  }

  // ── C. REM: MAID BODICE, PLEATED BIB, LACED CORSET, SHOULDER FRILLS & BACK SATIN BOW ──
  else if (config.topType === 'maid_dress' || isRem) {
    // 1. Black Velvet Corset Base (covering lower ribs and waist)
    const corset = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.015, 0.28, torsoD + 0.015), blackLeatherMat);
    corset.position.set(0, -0.07, 0);
    torsoGroup.add(corset);

    // 2. White Pleated Center Bib on upper chest (contours over 3D bust)
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.022), whiteMat);
    bib.position.set(0, 0.075, torsoD / 2 + 0.048);
    torsoGroup.add(bib);

    // Scalloped lace frill trim running along upper contour of maid bustier
    [-1, 1].forEach((side) => {
      const topRuffle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.022), whiteMat);
      topRuffle.position.set(side * 0.062, 0.115, torsoD / 2 + 0.040);
      topRuffle.rotation.z = side * 0.10;
      torsoGroup.add(topRuffle);
    });

    // 3. 4 Pairs of Silver Eyelet Studs + 3D Criss-Cross Laces Crossing at Angles on Corset
    const eyeletGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8);
    eyeletGeo.rotateX(Math.PI / 2);
    const laceRows = [-0.17, -0.12, -0.07, -0.02];
    laceRows.forEach((ly, i) => {
      const eL = new THREE.Mesh(eyeletGeo, metalMat);
      eL.position.set(-0.065, ly, torsoD / 2 + 0.016);
      torsoGroup.add(eL);

      const eR = new THREE.Mesh(eyeletGeo, metalMat);
      eR.position.set(0.065, ly, torsoD / 2 + 0.016);
      torsoGroup.add(eR);

      if (i < laceRows.length - 1) {
        const nextY = laceRows[i + 1];
        const midY = (ly + nextY) / 2;
        const laceLR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.012), whiteMat);
        laceLR.position.set(0, midY, torsoD / 2 + 0.018);
        laceLR.rotation.z = -0.38;
        torsoGroup.add(laceLR);

        const laceRL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.012), whiteMat);
        laceRL.position.set(0, midY, torsoD / 2 + 0.020);
        laceRL.rotation.z = 0.38;
        torsoGroup.add(laceRL);
      }
    });

    // 4. White Apron Shoulder Frill Straps (Ruffled wings curving over shoulders)
    [-1, 1].forEach((side) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, torsoH * 0.95, 0.02), whiteMat);
      strap.position.set(side * 0.10, 0.02, torsoD / 2 + 0.016);
      torsoGroup.add(strap);

      const sArch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, torsoD + 0.02), whiteMat);
      sArch.position.set(side * 0.10, torsoH / 2 + 0.005, 0);
      torsoGroup.add(sArch);

      const bStrap = new THREE.Mesh(new THREE.BoxGeometry(0.04, torsoH * 0.95, 0.02), whiteMat);
      bStrap.position.set(side * 0.10, 0.02, -torsoD / 2 - 0.016);
      torsoGroup.add(bStrap);

      // Ruffled frill edge
      for (let rf = -3; rf <= 3; rf++) {
        const frill = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.018), whiteMat);
        frill.position.set(side * 0.13, rf * 0.04 + 0.04, torsoD / 2 + 0.018);
        frill.rotation.z = side * 0.28;
        torsoGroup.add(frill);
      }
    });

    // 5. White Lace Collar around throat
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.03, 0.06), whiteMat);
    collar.position.set(0, torsoH / 2 + 0.01, 0.02);
    torsoGroup.add(collar);

    // 6. Black Ribbon Bow at throat collar (Canon Re:Zero Maid Bow)
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.025), blackLeatherMat);
    bow.position.set(0, 0.15, torsoD / 2 + 0.024);
    torsoGroup.add(bow);

    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.028), blackLeatherMat);
    knot.position.set(0, 0.15, torsoD / 2 + 0.035);
    torsoGroup.add(knot);

    // Center bow on top of white chest bib
    const bibBow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.02), blackLeatherMat);
    bibBow.position.set(0, 0.11, torsoD / 2 + 0.022);
    torsoGroup.add(bibBow);

    // 7. Giant 3D Butterfly Satin Bow on the Lower Back with Trailing Ribbon Tails
    const backBow = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, 0.04), whiteMat);
    backBow.position.set(0, -0.10, -torsoD / 2 - 0.025);
    torsoGroup.add(backBow);

    const backKnot = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.045), whiteMat);
    backKnot.position.set(0, -0.10, -torsoD / 2 - 0.035);
    torsoGroup.add(backKnot);

    [-1, 1].forEach((side) => {
      const ribbonTail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.016), whiteMat);
      ribbonTail.position.set(side * 0.06, -0.22, -torsoD / 2 - 0.03);
      ribbonTail.rotation.z = side * 0.20;
      torsoGroup.add(ribbonTail);
    });
  }

  // ── D. ALBERT WESKER: LEATHER TRENCHCOAT WITH 8 CHROME BUTTONS & LAPELS ──
  else if (config.topType === 'trench_coat') {
    const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.26, 0.03), blackLeatherMat);
    lapelL.position.set(-0.10, 0.08, torsoD / 2 + 0.015);
    lapelL.rotation.z = -0.22;
    torsoGroup.add(lapelL);

    const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.26, 0.03), blackLeatherMat);
    lapelR.position.set(0.10, 0.08, torsoD / 2 + 0.015);
    lapelR.rotation.z = 0.22;
    torsoGroup.add(lapelR);

    // Double-breasted silver chrome buttons down chest (2 columns of 4 = 8 buttons!)
    for (let row = -0.08; row <= 0.16; row += 0.08) {
      const btnL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.018, 8), metalMat);
      btnL.rotation.x = Math.PI / 2;
      btnL.position.set(-0.06, row, torsoD / 2 + 0.022);
      torsoGroup.add(btnL);

      const btnR = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.018, 8), metalMat);
      btnR.rotation.x = Math.PI / 2;
      btnR.position.set(0.06, row, torsoD / 2 + 0.022);
      torsoGroup.add(btnR);
    }

    const wCollar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 0.03), blackLeatherMat);
    wCollar.position.set(0, torsoH / 2 + 0.04, -0.06);
    torsoGroup.add(wCollar);

    const tBelt = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.03, 0.05, torsoD + 0.03), blackLeatherMat);
    tBelt.position.set(0, -0.14, 0);
    torsoGroup.add(tBelt);

    const tBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.02), metalMat);
    tBuckle.position.set(0, -0.14, torsoD / 2 + 0.02);
    torsoGroup.add(tBuckle);

    const tTail = new THREE.Mesh(new THREE.BoxGeometry(torsoW, 0.46, 0.03), blackLeatherMat);
    tTail.position.set(0, -torsoH / 2 - 0.22, -torsoD / 2 - 0.01);
    tTail.rotation.x = isSeated ? 0.35 : 0.08;
    torsoGroup.add(tTail);
  }

  // ── E. HUNK: HEAVY ASSAULT CHEST RIG WITH 6 MAG POUCHES & COLLAR ──
  else if (config.topType === 'combat_rig') {
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.85 });
    const vest = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.02, torsoH - 0.02, 0.06), vestMat);
    vest.position.set(0, 0, torsoD / 2 + 0.02);
    torsoGroup.add(vest);

    // Neck ballistic protector
    const neckGuard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.14), vestMat);
    neckGuard.position.set(0, torsoH / 2 + 0.02, 0.02);
    torsoGroup.add(neckGuard);

    // 6 Ammo Pouches
    const pGeo = new THREE.BoxGeometry(0.08, 0.10, 0.04);
    for (let col = -1; col <= 1; col++) {
      const pTop = new THREE.Mesh(pGeo, blackLeatherMat);
      pTop.position.set(col * 0.11, 0.08, torsoD / 2 + 0.06);
      torsoGroup.add(pTop);

      const pBot = new THREE.Mesh(pGeo, blackLeatherMat);
      pBot.position.set(col * 0.11, -0.08, torsoD / 2 + 0.06);
      torsoGroup.add(pBot);
    }
  }

  // ── F. SUBARU: TRACK JACKET WITH CANONICAL ORANGE CHEVRONS & PIPING ──
  else if (config.topType === 'subaru_jacket' || isSubaru) {
    // 1. High white zip-up collar
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.08), whiteMat);
    collar.position.set(0, torsoH / 2 + 0.01, 0.04);
    torsoGroup.add(collar);

    // 2. Solid vibrant orange upper yoke wrapping across upper chest, shoulders, and upper back
    const yokeFront = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.015, 0.18, 0.025), subaruOrangeMat);
    yokeFront.position.set(0, 0.11, torsoD / 2 + 0.012);
    torsoGroup.add(yokeFront);

    const yokeBack = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.015, 0.18, 0.025), subaruOrangeMat);
    yokeBack.position.set(0, 0.11, -torsoD / 2 - 0.012);
    torsoGroup.add(yokeBack);

    // Shoulders orange top caps
    [-1, 1].forEach((side) => {
      const yokeShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, torsoD + 0.02), subaruOrangeMat);
      yokeShoulder.position.set(side * (torsoW / 2 - 0.02), torsoH / 2 + 0.005, 0);
      torsoGroup.add(yokeShoulder);
    });

    // 3. Crisp white piping bordering the orange yoke
    const pipeFront = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.02, 0.018, 0.03), whiteMat);
    pipeFront.position.set(0, 0.02, torsoD / 2 + 0.014);
    torsoGroup.add(pipeFront);

    const pipeBack = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.02, 0.018, 0.03), whiteMat);
    pipeBack.position.set(0, 0.02, -torsoD / 2 - 0.014);
    torsoGroup.add(pipeBack);

    // 4. White central zipper running all the way down
    const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.024, torsoH, 0.025), whiteMat);
    zipper.position.set(0, 0, torsoD / 2 + 0.022);
    torsoGroup.add(zipper);

    // 5. White ribbed waistband at bottom of jacket
    const waistband = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.02, 0.04, torsoD + 0.02), whiteMat);
    waistband.position.set(0, -torsoH / 2 + 0.02, 0);
    torsoGroup.add(waistband);
  }

  // ── G. ASUNA: KNIGHTS OF THE BLOOD OATH TUNIC WITH 3D RED HERALDIC CROSS, GOLD CLASPS & RAPIER ──
  else if (config.topType === 'asuna_tunic') {
    const redMat = tunicRedMat;

    // 1. Multi-tier 3D Red Heraldic Cross with Bevelled Tips (contours over 3D bust)
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.024), redMat);
    crossV.position.set(0, 0.04, torsoD / 2 + 0.048);
    torsoGroup.add(crossV);

    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.024), redMat);
    crossH.position.set(0, 0.09, torsoD / 2 + 0.048);
    torsoGroup.add(crossH);

    // Cross end caps (flare bevels)
    const capTop = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.016, 0.024), redMat);
    capTop.position.set(0, 0.21, torsoD / 2 + 0.048);
    torsoGroup.add(capTop);

    const capBot = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.016, 0.024), redMat);
    capBot.position.set(0, -0.13, torsoD / 2 + 0.048);
    torsoGroup.add(capBot);

    const capL = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.065, 0.024), redMat);
    capL.position.set(-0.12, 0.09, torsoD / 2 + 0.048);
    torsoGroup.add(capL);

    const capR = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.065, 0.024), redMat);
    capR.position.set(0.12, 0.09, torsoD / 2 + 0.048);
    torsoGroup.add(capR);

    // 2. Gold Filigree Clasps with Ruby Jewels
    [-1, 1].forEach((side) => {
      const goldClasp = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 0.028), goldMat);
      goldClasp.position.set(side * 0.11, 0.15, torsoD / 2 + 0.048);
      torsoGroup.add(goldClasp);

      const rubyJewel = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.015), rubyGlassMat);
      rubyJewel.position.set(side * 0.11, 0.15, torsoD / 2 + 0.060);
      torsoGroup.add(rubyJewel);
    });

    // 3. Gold Trim along Waist and Hem
    const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.015, 0.035, 0.022), goldMat);
    goldTrim.position.set(0, -0.14, torsoD / 2 + 0.014);
    torsoGroup.add(goldTrim);

    // 4. White Capelet / Epaulets with Red Trim
    [-1, 1].forEach((side) => {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.14), whiteMat);
      ep.position.set(side * (torsoW / 2 - 0.01), torsoH / 2 + 0.01, 0);
      torsoGroup.add(ep);

      const epRed = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.012, 0.015), redMat);
      epRed.position.set(side * (torsoW / 2 - 0.01), torsoH / 2 + 0.02, 0.065);
      torsoGroup.add(epRed);
    });

    // 5. Asuna's Legendary Rapier "Lambent Light" on Left Hip!
    const rapierGroup = new THREE.Group();
    rapierGroup.position.set(-torsoW / 2 - 0.035, -0.10, 0.04);
    rapierGroup.rotation.z = 0.22;
    rapierGroup.rotation.y = 0.10;
    torsoGroup.add(rapierGroup);

    // Scabbard (White with Teal/Gold Accents)
    const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.58, 0.028), whiteMat);
    scabbard.position.y = -0.22;
    rapierGroup.add(scabbard);

    const scabbardTip = new THREE.Mesh(new THREE.ConeGeometry(0.020, 0.06, 4), goldMat);
    scabbardTip.position.y = -0.52;
    scabbardTip.rotation.x = Math.PI;
    rapierGroup.add(scabbardTip);

    // Ornate Golden Cup Hilt / Bowl Guard
    const cupHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.040, 0.025, 12), goldMat);
    cupHilt.position.y = 0.08;
    rapierGroup.add(cupHilt);

    // Knuckle Bow
    const knuckleBow = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.04), goldMat);
    knuckleBow.position.set(0, 0.12, 0.025);
    rapierGroup.add(knuckleBow);

    // Grip & Pommel
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.08, 8), whiteMat);
    grip.position.y = 0.13;
    rapierGroup.add(grip);

    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), goldMat);
    pommel.position.y = 0.18;
    rapierGroup.add(pommel);
  }

  // ── H. CYBER-MERCENARY 2077: HIGH-TECH BOMBER WITH GLOWING LED CONDUITS ──
  else if (config.topType === 'cyber_jacket') {
    const cyberDarkMat = new THREE.MeshStandardMaterial({ color: 0x12171f, roughness: 0.5, metalness: 0.3 });

    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.14), cyberDarkMat);
    collar.position.set(0, torsoH / 2 + 0.03, 0.02);
    torsoGroup.add(collar);

    const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.03), cyberDarkMat);
    plateL.position.set(-0.09, 0.02, torsoD / 2 + 0.015);
    torsoGroup.add(plateL);

    const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.03), cyberDarkMat);
    plateR.position.set(0.09, 0.02, torsoD / 2 + 0.015);
    torsoGroup.add(plateR);

    // Glowing Neon Cyan LED Seam Conduits
    const ledL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.30, 0.02), neonCyanMat);
    ledL.position.set(-0.08, 0.02, torsoD / 2 + 0.032);
    torsoGroup.add(ledL);

    const ledR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.30, 0.02), neonCyanMat);
    ledR.position.set(0.08, 0.02, torsoD / 2 + 0.032);
    torsoGroup.add(ledR);

    // Glowing Central Micro-Core Reactor
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), neonCyanMat);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 0.08, torsoD / 2 + 0.03);
    torsoGroup.add(core);

    const backVent = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.20, 0.04), cyberDarkMat);
    backVent.position.set(0, 0.04, -torsoD / 2 - 0.02);
    torsoGroup.add(backVent);
  }

  // ── I. MAD RAIDER: SCAVENGED SPIKED ARMOR & BULLET BANDOLIER ──
  else if (config.topType === 'raider_vest') {
    const raiderLeather = new THREE.MeshStandardMaterial({ color: 0x2b1c14, roughness: 0.9, metalness: 0.1 });

    const vest = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.02, torsoH - 0.02, 0.04), raiderLeather);
    vest.position.set(0, 0, torsoD / 2 + 0.01);
    torsoGroup.add(vest);

    // Left Shoulder Scrap-Metal Pauldron with 5 SHARP 3D METAL SPIKES!
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.16), rustMetalMat);
    pauldron.position.set(-torsoW / 2 - 0.04, torsoH / 2 - 0.02, 0);
    pauldron.rotation.z = -0.22;
    torsoGroup.add(pauldron);

    // 5 Sharp 3D Spikes pointing upward and outward
    const spikeGeo = new THREE.ConeGeometry(0.02, 0.10, 4);
    for (let s = -2; s <= 2; s++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(-torsoW / 2 - 0.06, torsoH / 2 + 0.06, s * 0.035);
      spike.rotation.z = -0.35;
      spike.rotation.x = s * 0.18;
      torsoGroup.add(spike);
    }

    // Diagonal Leather Bandolier across chest
    const bandolier = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.06, 0.05, 0.025), blackLeatherMat);
    bandolier.position.set(0, 0.04, torsoD / 2 + 0.035);
    bandolier.rotation.z = -0.55;
    torsoGroup.add(bandolier);

    // 6 Brass Shotgun Shells / Bullets mounted on bandolier
    const bulletGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.045, 8);
    for (let b = -0.12; b <= 0.12; b += 0.05) {
      const bullet = new THREE.Mesh(bulletGeo, goldMat);
      bullet.position.set(b * 0.8, -b * 0.6 + 0.04, torsoD / 2 + 0.05);
      bullet.rotation.z = -0.55;
      torsoGroup.add(bullet);
    }

    // Spiked Leather Choker Collar around neck
    const choker = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.18), blackLeatherMat);
    choker.position.set(0, torsoH / 2 + 0.02, 0);
    torsoGroup.add(choker);
  }

  // ── J. CANONICAL VAULT 101 JUMPSUIT ──
  else {
    const goldBand = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.01, 0.06, 0.02), goldMat);
    goldBand.position.set(0, 0.10, torsoD / 2 + 0.012);
    torsoGroup.add(goldBand);

    const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.025, torsoH - 0.04, 0.02), goldMat);
    zipper.position.set(0, 0, torsoD / 2 + 0.012);
    torsoGroup.add(zipper);

    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.06), goldMat);
    collar.position.set(0, torsoH / 2 + 0.01, 0.06);
    torsoGroup.add(collar);

    // Back 101 Patch
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.24),
      new THREE.MeshStandardMaterial({ map: createVault101BackTexture(), roughness: 0.5 })
    );
    patch.position.set(0, 0.04, -torsoD / 2 - 0.012);
    patch.rotation.y = Math.PI;
    torsoGroup.add(patch);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ARMS & HANDS (3-5x Density)
  // ═══════════════════════════════════════════════════════════════════════════
  const armsGroup = new THREE.Group();
  torsoGroup.add(armsGroup);

  const armW = isRem || isAsuna ? 0.08 : 0.10;
  const armD = isRem || isAsuna ? 0.08 : 0.10;
  const armX = torsoW / 2 + armW / 2 + 0.01;

  const upperArmMat = isRem ? skinMat : (isSubaru ? blackLeatherMat : (isRaider ? skinMat : topMat));
  const forearmMat = isRem ? blackLeatherMat : (isSubaru ? blackLeatherMat : ((isLeon || isRaider) ? skinMat : topMat));
  const handMat = (config.wristDevice === 'gloves_black' || isHunk || isKirito || isWesker)
    ? blackLeatherMat
    : (config.wristDevice === 'gloves_white' || isAsuna ? whiteMat : skinMat);

  if (isSeated) {
    // SEATED: Forearms forward on table (beveled & tapered)
    const lUpperMat = isCyborg ? chromeMetalMat : upperArmMat;
    const lUpper = createDetailedArm(armW, 0.26, armD, lUpperMat, true);
    lUpper.position.set(-armX, 0.05, 0.05);
    lUpper.rotation.x = -0.38;
    armsGroup.add(lUpper);

    const lForeMat = isCyborg ? chromeMetalMat : forearmMat;
    const lFore = createBeveledBox(armW, armW, 0.28, 0.006, lForeMat);
    lFore.position.set(-armX + 0.02, -0.04, 0.24);
    lFore.rotation.y = 0.18;
    armsGroup.add(lFore);
    group.userData.lForearm = lFore;

    // Rem: double white cuff stripes
    if (isRem) {
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.03, armW + 0.03, 0.016), whiteMat);
      s1.position.set(0, 0, 0.08);
      lFore.add(s1);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.03, armW + 0.03, 0.016), whiteMat);
      s2.position.set(0, 0, 0.12);
      lFore.add(s2);
    }

    const lHandMat = isCyborg ? chromeMetalMat : handMat;
    const lHand = createDetailedHand(0.075, 0.085, 0.055, lHandMat);
    lHand.rotation.x = Math.PI / 2;
    lHand.position.set(-armX + 0.06, -0.04, 0.40);
    armsGroup.add(lHand);

    // Right arm
    const rUpper = createDetailedArm(armW, 0.26, armD, upperArmMat, true);
    rUpper.position.set(armX, 0.05, 0.05);
    rUpper.rotation.x = -0.38;
    armsGroup.add(rUpper);

    const rFore = createBeveledBox(armW, armW, 0.28, 0.006, forearmMat);
    rFore.position.set(armX - 0.02, -0.04, 0.24);
    rFore.rotation.y = -0.18;
    armsGroup.add(rFore);
    group.userData.rForearm = rFore;

    // Rem: double white cuff stripes
    if (isRem) {
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.03, armW + 0.03, 0.016), whiteMat);
      s1.position.set(0, 0, 0.08);
      rFore.add(s1);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.03, armW + 0.03, 0.016), whiteMat);
      s2.position.set(0, 0, 0.12);
      rFore.add(s2);
    }

    // Rem: detached bell sleeve frills & puff attached to upper arm (no floating cubes in seated mode!)
    if (isRem) {
      [lUpper, rUpper].forEach((upper) => {
        const frillBand = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.025, 0.03, armD + 0.025), whiteMat);
        frillBand.position.set(0, 0.04, 0);
        upper.add(frillBand);

        const puff = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.035, 0.09, armD + 0.035), blackLeatherMat);
        puff.position.set(0, -0.02, 0);
        upper.add(puff);

        const topFrill = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.045, 0.02, armD + 0.045), whiteMat);
        topFrill.position.set(0, 0.025, 0);
        upper.add(topFrill);
      });
    }

    // Subaru: orange racing stripes & white piping + cuffs attached directly to arm segments in seated mode
    if (isSubaru) {
      [[-1, lUpper], [1, rUpper]].forEach(([side, upper]) => {
        const armStripeO = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.24, 0.03), subaruOrangeMat);
        armStripeO.position.set(side * (armW / 2 + 0.009), 0, 0);
        upper.add(armStripeO);

        const armStripeW = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.24, 0.015), whiteMat);
        armStripeW.position.set(side * (armW / 2 + 0.012), 0, 0);
        upper.add(armStripeW);
      });

      [[-1, lFore], [1, rFore]].forEach(([side, fore]) => {
        const fStripeO = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, 0.26), subaruOrangeMat);
        fStripeO.position.set(side * (armW / 2 + 0.009), 0, 0);
        fore.add(fStripeO);

        const fStripeW = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.015, 0.26), whiteMat);
        fStripeW.position.set(side * (armW / 2 + 0.012), 0, 0);
        fore.add(fStripeW);

        const cuff = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.02, armW + 0.02, 0.035), whiteMat);
        cuff.position.set(0, 0, 0.10);
        fore.add(cuff);
      });
    }

    const rHand = createDetailedHand(0.075, 0.085, 0.055, handMat);
    rHand.rotation.x = Math.PI / 2;
    rHand.position.set(armX - 0.06, -0.04, 0.40);
    armsGroup.add(rHand);

    if (opts.cardBackTex) {
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.10, 0.02),
        new THREE.MeshStandardMaterial({ map: opts.cardBackTex, roughness: 0.4 })
      );
      deck.position.set(0, -0.02, 0.40);
      deck.rotation.x = -0.15;
      armsGroup.add(deck);
    }
  } else {
    // STANDING: Heroic relaxed pose (beveled & tapered)
    const lUpperMat = isCyborg ? chromeMetalMat : upperArmMat;
    const lUpper = createDetailedArm(armW, 0.30, armD, lUpperMat, true);
    lUpper.position.set(-armX, 0.05, 0);
    lUpper.rotation.z = 0.10;
    armsGroup.add(lUpper);

    const lForeMat = isCyborg ? chromeMetalMat : forearmMat;
    const lFore = createDetailedArm(armW, 0.26, armD, lForeMat, false);
    lFore.position.set(-armX - 0.02, -0.18, 0.02);
    lFore.rotation.x = -0.15;
    armsGroup.add(lFore);
    group.userData.lForearm = lFore;

    // Rem: double white cuff stripes
    if (isRem) {
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.03, 0.016, armD + 0.03), whiteMat);
      s1.position.set(0, -0.08, 0);
      lFore.add(s1);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.03, 0.016, armD + 0.03), whiteMat);
      s2.position.set(0, -0.11, 0);
      lFore.add(s2);
    }

    const lHandMat = isCyborg ? chromeMetalMat : handMat;
    const lHand = createDetailedHand(0.07, 0.09, 0.06, lHandMat);
    lHand.position.set(-armX - 0.04, -0.34, 0.04);
    armsGroup.add(lHand);

    // Right arm
    const rUpper = createDetailedArm(armW, 0.30, armD, upperArmMat, true);
    rUpper.position.set(armX, 0.05, 0);
    rUpper.rotation.z = -0.10;
    armsGroup.add(rUpper);

    const rFore = createDetailedArm(armW, 0.26, armD, forearmMat, false);
    rFore.position.set(armX + 0.02, -0.18, 0.02);
    rFore.rotation.x = -0.15;
    armsGroup.add(rFore);
    group.userData.rForearm = rFore;

    // Rem: double white cuff stripes
    if (isRem) {
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.03, 0.016, armD + 0.03), whiteMat);
      s1.position.set(0, -0.08, 0);
      rFore.add(s1);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.03, 0.016, armD + 0.03), whiteMat);
      s2.position.set(0, -0.11, 0);
      rFore.add(s2);
    }

    // Rem: detached bell sleeve frills & puff attached to upper arm
    if (isRem) {
      [lUpper, rUpper].forEach((upper) => {
        const frillBand = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.025, 0.03, armD + 0.025), whiteMat);
        frillBand.position.set(0, 0.04, 0);
        upper.add(frillBand);

        const puff = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.035, 0.09, armD + 0.035), blackLeatherMat);
        puff.position.set(0, -0.02, 0);
        upper.add(puff);

        const topFrill = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.045, 0.02, armD + 0.045), whiteMat);
        topFrill.position.set(0, 0.025, 0);
        upper.add(topFrill);
      });
    }

    // Subaru: orange racing stripes & white piping + cuffs attached to arm segments
    if (isSubaru) {
      [[-1, lUpper], [1, rUpper]].forEach(([side, upper]) => {
        const armStripeO = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.28, 0.03), subaruOrangeMat);
        armStripeO.position.set(side * (armW / 2 + 0.009), 0, 0);
        upper.add(armStripeO);

        const armStripeW = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.28, 0.015), whiteMat);
        armStripeW.position.set(side * (armW / 2 + 0.012), 0, 0);
        upper.add(armStripeW);
      });

      [[-1, lFore], [1, rFore]].forEach(([side, fore]) => {
        const fStripeO = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.24, 0.03), subaruOrangeMat);
        fStripeO.position.set(side * (armW / 2 + 0.009), 0, 0);
        fore.add(fStripeO);

        const fStripeW = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.24, 0.015), whiteMat);
        fStripeW.position.set(side * (armW / 2 + 0.012), 0, 0);
        fore.add(fStripeW);

        const cuff = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.02, 0.035, armD + 0.02), whiteMat);
        cuff.position.set(0, -0.09, 0);
        fore.add(cuff);
      });
    }

    const rHand = createDetailedHand(0.07, 0.09, 0.06, handMat);
    rHand.position.set(armX + 0.04, -0.34, 0.04);
    armsGroup.add(rHand);
  }

  // ── WRIST DEVICES ──
  if (config.wristDevice === 'pipboy' && group.userData.lForearm) {
    const pipGroup = new THREE.Group();
    const pipBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.12), new THREE.MeshStandardMaterial({ color: 0x3d3528, roughness: 0.5, metalness: 0.6 }));
    pipGroup.add(pipBody);

    const screenMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), screenMat);
    screen.position.set(0, 0, 0.065);
    pipGroup.add(screen);

    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.025, 12), metalMat);
    dial.position.set(0.04, 0.06, 0);
    pipGroup.add(dial);

    pipGroup.position.set(0, 0, 0.05);
    group.userData.lForearm.add(pipGroup);
  } else if ((config.wristDevice === 'cyber_arm' || isCyborg) && group.userData.rForearm) {
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22), neonCyanMat);
    conduit.position.set(armW / 2 + 0.01, 0, 0);
    group.userData.rForearm.add(conduit);
  } else if ((config.wristDevice === 'spiked_band' || isRaider) && group.userData.rForearm) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(armW + 0.03, 0.06, armD + 0.03), blackLeatherMat);
    for (let sp = -1; sp <= 1; sp += 2) {
      const pSpike = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 4), spikeMat);
      pSpike.rotation.x = Math.PI / 2;
      pSpike.position.set(sp * 0.03, 0, armD / 2 + 0.03);
      band.add(pSpike);
    }
    group.userData.rForearm.add(band);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. HEAD, CLEAN FACE TEXTURE & FULL ANATOMICAL HAIR (ZERO BALD SPOTS!)
  // ═══════════════════════════════════════════════════════════════════════════
  const headY = isSeated ? 1.20 : 1.54;
  const headGroup = new THREE.Group();
  headGroup.position.set(0, headY, 0);
  group.add(headGroup);
  group.userData.head = headGroup;

  const headW = 0.24;
  const headH = 0.25;
  const headD = 0.22;

  const isBald = config.hairStyle === 'bald';
  const headBaseMat = isHunk ? blackLeatherMat : skinMat;
  const skullMat = (isBald || isHunk) ? headBaseMat : hairMat;

  // BoxGeometry face order: [+X, -X, +Y, -Y, +Z, -Z]
  // Top (+Y) and Back (-Z) use skullMat (hair color) so no bare skin ever peeks through
  const headMaterials = [
    headBaseMat,
    headBaseMat,
    skullMat,
    headBaseMat,
    headBaseMat,
    skullMat,
  ];
  const headMesh = createBeveledBox(headW, headH, headD, 0.008, headMaterials);
  headMesh.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  headGroup.add(headMesh);

  // Under-chin AO shadow & anatomical jaw bevels (when not wearing full gasmask)
  if (!isHunk) {
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.052, 0.032), skinMat);
      ear.position.set(side * (headW / 2 + 0.007), -headH * 0.08, -0.01);
      ear.rotation.y = side * 0.15;
      headGroup.add(ear);

      const earInner = new THREE.Mesh(
        new THREE.BoxGeometry(0.010, 0.032, 0.018),
        createAOMaterial(skinMat, 0.72)
      );
      earInner.position.set(side * (headW / 2 + 0.014), -headH * 0.08, 0.002);
      headGroup.add(earInner);
    });

    // Subtle 3D nose tip so face isn't completely flat in 3/4 profile
    const noseTip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.032, 0.014), skinMat);
    noseTip.position.set(0, -headH * 0.06, headD / 2 + 0.006);
    headGroup.add(noseTip);

    addAOShadow(headGroup, headW * 0.72, headD * 0.65, -headH / 2 - 0.002, skinMat);
  }

  // Smooth Cylindrical Neck connecting head to torso
  const neckRadius = isRem || isAsuna ? 0.040 : 0.048;
  const neckMat = isHunk ? blackLeatherMat : skinMat;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(neckRadius * 0.95, neckRadius, 0.10, 12), neckMat);
  neck.position.set(0, -headH / 2 - 0.035, 0);
  headGroup.add(neck);

  // Clean Procedural Face Texture
  const faceTex = createFaceTexture(config, skinEntry.hex, hairEntry.hex);
  const facePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(headW, headH),
    new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.65, metalness: 0.04 })
  );
  facePlane.position.set(0, 0, headD / 2 + 0.002);
  headGroup.add(facePlane);

  // ── FULL ANATOMICAL HAIR (ZERO BALD TEMPLES, PROFILE GAPS OR NAPE SLITS!) ──
  const hairGroup = new THREE.Group();
  headGroup.add(hairGroup);

  const sideHairMat = (config.hairStyle === 'mohawk' || isRaider)
    ? new THREE.MeshStandardMaterial({ color: 0x1f1614, roughness: 0.9 })
    : hairMat;

  if (!isBald && !isHunk) {
    // 1. Crown cap (covers top skull and wraps over front hairline, sides, and back)
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(headW + 0.026, 0.075, headD + 0.026), hairMat);
    hairTop.position.set(0, headH / 2 + 0.020, -0.002);
    hairGroup.add(hairTop);

    // 1b. Lateral Crown Bevel Plates (softening skull corners into organic rounded head silhouette)
    [-1, 1].forEach((side) => {
      const bevel = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.035, headD * 0.95), hairMat);
      bevel.position.set(side * (headW / 2 + 0.002), headH / 2 + 0.035, -0.005);
      bevel.rotation.z = side * -0.22;
      hairGroup.add(bevel);
    });

    // 1c. Sagittal Crown Volume Crest (natural top skull hair density)
    const crownRidge = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.028, headD * 0.90), hairMat);
    crownRidge.position.set(0, headH / 2 + 0.048, -0.005);
    hairGroup.add(crownRidge);

    // 2. Forehead hairline root cap (sits directly above eyebrows, anchoring bangs into hair roots)
    const hairlineRoot = new THREE.Mesh(new THREE.BoxGeometry(headW + 0.018, 0.045, 0.024), hairMat);
    hairlineRoot.position.set(0, headH / 2 - 0.015, headD / 2 + 0.006);
    hairGroup.add(hairlineRoot);

    // 2b. Continuous hair undertone plate behind bangs on the forehead to eliminate bald skin gaps across all hairstyles
    const foreheadHairPlate = new THREE.Mesh(new THREE.BoxGeometry(headW * 0.94, 0.070, 0.016), hairMat);
    foreheadHairPlate.position.set(0, headH / 2 - 0.038, headD / 2 + 0.006);
    hairGroup.add(foreheadHairPlate);

    // 3. Full Back Skull Hair Wall (continuous from crown cap to neck collar)
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(headW + 0.026, headH * 0.98, 0.035), hairMat);
    hairBack.position.set(0, 0.00, -headD / 2 - 0.014);
    hairGroup.add(hairBack);

    // 3b. Upper Occipital Shelf (curved anatomical volume shelf giving natural rounded skull profile from rear & 3/4)
    const occipitalShelf = new THREE.Mesh(new THREE.BoxGeometry(headW + 0.022, 0.075, 0.042), hairMat);
    occipitalShelf.position.set(0, 0.045, -headD / 2 - 0.020);
    hairGroup.add(occipitalShelf);

    // 3c. Mid-Occipital Textured Cascading Locks (7 vertical striated lock segments creating 3D facets across back)
    for (let ci = -3; ci <= 3; ci++) {
      const colX = ci * 0.032;
      const lockH = 0.110 - Math.abs(ci) * 0.008;
      const lockD = 0.026 + (Math.abs(ci) % 2) * 0.006;
      const backFacet = new THREE.Mesh(new THREE.BoxGeometry(0.030, lockH, lockD), hairMat);
      backFacet.position.set(colX, -0.010, -headD / 2 - 0.024);
      backFacet.rotation.z = ci * 0.04;
      hairGroup.add(backFacet);
    }

    // 4. Lower Nape Collar Taper Seal (3 horizontal stepped tiers curving inward to hug neck with zero gaps)
    for (let ni = 0; ni < 3; ni++) {
      const napeY = -headH / 2 + 0.020 - ni * 0.025;
      const napeW = headW + 0.020 - ni * 0.018;
      const napeD = 0.038 - ni * 0.004;
      const napeZ = -headD / 2 - 0.016 + ni * 0.003;
      const napeTier = new THREE.Mesh(new THREE.BoxGeometry(napeW, 0.028, napeD), hairMat);
      napeTier.position.set(0, napeY, napeZ);
      hairGroup.add(napeTier);
    }

    // 5. Full Temporal & Parietal Side Hair Walls with Ear Cutouts & Stepped Layering
    [-1, 1].forEach((side) => {
      // Upper parietal wall
      const parietal = new THREE.Mesh(new THREE.BoxGeometry(0.026, headH * 0.52, headD * 0.95), sideHairMat);
      parietal.position.set(side * (headW / 2 + 0.012), 0.040, -0.005);
      hairGroup.add(parietal);

      // Lower temporal wall with ear relief recess
      const temporalRear = new THREE.Mesh(new THREE.BoxGeometry(0.026, headH * 0.45, headD * 0.50), sideHairMat);
      temporalRear.position.set(side * (headW / 2 + 0.012), -0.035, -headD * 0.25);
      hairGroup.add(temporalRear);

      // Anterior temple locks stepping forward over temple
      const templeLock = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.085, 0.048), sideHairMat);
      templeLock.position.set(side * (headW / 2 + 0.010), 0.010, headD / 2 - 0.028);
      hairGroup.add(templeLock);

      // Feathered sideburns tapering along jawline
      const sideburn = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.065, 0.034), sideHairMat);
      sideburn.position.set(side * (headW / 2 + 0.008), -0.060, 0.025);
      sideburn.rotation.z = side * 0.08;
      hairGroup.add(sideburn);
    });

    // 6. Rear-Corner Bevel Fillers (prevents any diagonal slit between side and back)
    const cornerGeo = new THREE.BoxGeometry(0.032, headH * 0.90, 0.032);
    const cornerL = new THREE.Mesh(cornerGeo, sideHairMat);
    cornerL.position.set(-headW / 2 - 0.004, -0.005, -headD / 2 - 0.010);
    hairGroup.add(cornerL);

    const cornerR = new THREE.Mesh(cornerGeo, sideHairMat);
    cornerR.position.set(headW / 2 + 0.004, -0.005, -headD / 2 - 0.010);
    hairGroup.add(cornerR);
  }

  // ── HIGH-DENSITY SCULPTED HAIRSTYLES (20x GEOMETRY DENSITY: 40-80+ ELEMENTS PER STYLE) ──

  // 1. LEON KENNEDY: FULL OVERHAUL - VOLUMINOUS CURTAIN FRINGE, LOWERED HAIRLINE & ZERO FOREHEAD GAPS
  if (config.hairStyle === 'leon_bangs') {
    // --- 1. Forehead Hair Volume Mantle (covers upper forehead down to y = 0.075, well above eyebrows) ---
    const leonForeheadMantle = new THREE.Mesh(new THREE.BoxGeometry(headW + 0.016, 0.046, 0.028), hairMat);
    leonForeheadMantle.position.set(0, 0.098, headD / 2 + 0.010);
    hairGroup.add(leonForeheadMantle);

    // Lateral brow bevels framing the temples while leaving the central inverted V-window wide open
    const leonBrowBevelL = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.020, 0.020), hairMat);
    leonBrowBevelL.position.set(-0.075, 0.080, headD / 2 + 0.014);
    hairGroup.add(leonBrowBevelL);

    const leonBrowBevelR = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.020, 0.020), hairMat);
    leonBrowBevelR.position.set(0.075, 0.082, headD / 2 + 0.014);
    hairGroup.add(leonBrowBevelR);

    // Deep diagonal parting lock at x = +0.025
    const partLock = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.038, 0.070), hairMat);
    partLock.position.set(0.025, headH / 2 + 0.048, 0.020);
    hairGroup.add(partLock);

    // --- 2. Left Flowing Curtain Lock (Frames left eye from outer side, cascades down cheekbone) ---
    const leonMainCurtain = [
      // [x, y, z, w, h, d, rotZ]
      // Near parting line (stays high on upper forehead)
      [ 0.012,  0.096, headD / 2 + 0.024, 0.022, 0.038, 0.020,  0.22],
      [-0.014,  0.090, headD / 2 + 0.026, 0.024, 0.042, 0.022,  0.32],
      [-0.040,  0.080, headD / 2 + 0.028, 0.025, 0.046, 0.022,  0.40],
      // Swoops past outer corner of left eye (leaving eye at x = -0.045, y = 0.015 open)
      [-0.068,  0.060, headD / 2 + 0.026, 0.026, 0.052, 0.022,  0.46],
      [-0.088,  0.034, headD / 2 + 0.024, 0.025, 0.058, 0.020,  0.48],
      [-0.104,  0.005, headD / 2 + 0.020, 0.024, 0.058, 0.018,  0.48],
      [-0.114, -0.026, headD / 2 + 0.016, 0.022, 0.050, 0.016,  0.44],
      [-0.120, -0.055, headD / 2 + 0.012, 0.020, 0.042, 0.014,  0.40],
    ];
    leonMainCurtain.forEach(([lx, ly, lz, lw, lh, ld, lrz]) => {
      const lock = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, ld), hairMat);
      lock.position.set(lx, ly, lz);
      lock.rotation.z = lrz;
      hairGroup.add(lock);
    });

    // Tier 2: Mid-depth volume layer (thickens the curtain sweep, zero gaps)
    const leonMidVolume = [
      [-0.012,  0.086, headD / 2 + 0.018, 0.020, 0.038, 0.018,  0.30],
      [-0.038,  0.076, headD / 2 + 0.020, 0.022, 0.042, 0.018,  0.38],
      [-0.066,  0.054, headD / 2 + 0.020, 0.024, 0.048, 0.018,  0.44],
      [-0.086,  0.028, headD / 2 + 0.018, 0.022, 0.050, 0.016,  0.46],
      [-0.100, -0.002, headD / 2 + 0.014, 0.022, 0.048, 0.016,  0.46],
    ];
    leonMidVolume.forEach(([lx, ly, lz, lw, lh, ld, lrz]) => {
      const lock = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, ld), hairMat);
      lock.position.set(lx, ly, lz);
      lock.rotation.z = lrz;
      hairGroup.add(lock);
    });

    // Tier 3: Surface micro-strands & wisps (Leon's feathered anime/realism styling)
    const leonWisps = [
      [-0.010,  0.092, headD / 2 + 0.032, 0.012, 0.032, 0.010,  0.30],
      [-0.034,  0.080, headD / 2 + 0.032, 0.012, 0.036, 0.010,  0.38],
      [-0.064,  0.058, headD / 2 + 0.030, 0.012, 0.040, 0.010,  0.44],
      [-0.084,  0.032, headD / 2 + 0.028, 0.012, 0.040, 0.010,  0.46],
    ];
    leonWisps.forEach(([lx, ly, lz, lw, lh, ld, lrz]) => {
      const lock = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, ld), hairMat);
      lock.position.set(lx, ly, lz);
      lock.rotation.z = lrz;
      hairGroup.add(lock);
    });

    // --- 3. Right Swept-Back Curtain Lock (Completely clears right eye, brow, and temple) ---
    const leonRightCurtain = [
      [ 0.045,  0.094, headD / 2 + 0.022, 0.022, 0.042, 0.020, -0.22],
      [ 0.068,  0.084, headD / 2 + 0.024, 0.022, 0.046, 0.020, -0.32],
      [ 0.090,  0.074, headD / 2 + 0.024, 0.024, 0.048, 0.020, -0.42],
      [ 0.110,  0.060, headD / 2 + 0.022, 0.022, 0.048, 0.018, -0.50],
      [ 0.124,  0.038, headD / 2 + 0.018, 0.020, 0.046, 0.016, -0.55],
      [ 0.130,  0.008, headD / 2 + 0.014, 0.018, 0.040, 0.014, -0.58],
    ];
    leonRightCurtain.forEach(([lx, ly, lz, lw, lh, ld, lrz]) => {
      const lock = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, ld), hairMat);
      lock.position.set(lx, ly, lz);
      lock.rotation.z = lrz;
      hairGroup.add(lock);
    });

    const leonRightMid = [
      [ 0.055,  0.090, headD / 2 + 0.018, 0.020, 0.040, 0.018, -0.26],
      [ 0.078,  0.078, headD / 2 + 0.018, 0.020, 0.044, 0.018, -0.36],
      [ 0.100,  0.064, headD / 2 + 0.016, 0.020, 0.046, 0.016, -0.45],
    ];
    leonRightMid.forEach(([lx, ly, lz, lw, lh, ld, lrz]) => {
      const lock = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, ld), hairMat);
      lock.position.set(lx, ly, lz);
      lock.rotation.z = lrz;
      hairGroup.add(lock);
    });

    // --- 4. Forehead Root Backing Locks (Stays high on forehead, leaving inverted V-window wide open) ---
    for (let bi = -5; bi <= 5; bi++) {
      const bX = bi * 0.020;
      // In center (|bi| <= 1), keep short at top of forehead to preserve open V-window
      const isCenter = Math.abs(bi) <= 1;
      const bH = isCenter ? 0.026 : 0.036;
      const bY = isCenter ? 0.098 : (0.086 - Math.abs(bi) * 0.002);
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(0.026, bH, 0.018), hairMat);
      bMesh.position.set(bX, bY, headD / 2 + 0.014);
      bMesh.rotation.z = (bi <= 1 ? 0.14 : -0.18);
      hairGroup.add(bMesh);
    }

    // --- 5. Sideburns: 5 fine stepped layers per side tapering along jawline ---
    const burnPositions = [
      [-headW / 2 - 0.015,  0.05, 0.040, 0.026, 0.055, 0.060],
      [-headW / 2 - 0.015,  0.00, 0.042, 0.025, 0.055, 0.055],
      [-headW / 2 - 0.015, -0.05, 0.045, 0.024, 0.050, 0.050],
      [-headW / 2 - 0.015, -0.09, 0.048, 0.022, 0.045, 0.045],
      [-headW / 2 - 0.015, -0.13, 0.050, 0.020, 0.040, 0.040],
      [ headW / 2 + 0.015,  0.05, 0.040, 0.026, 0.055, 0.060],
      [ headW / 2 + 0.015,  0.00, 0.042, 0.025, 0.055, 0.055],
      [ headW / 2 + 0.015, -0.05, 0.045, 0.024, 0.050, 0.050],
      [ headW / 2 + 0.015, -0.09, 0.048, 0.022, 0.045, 0.045],
      [ headW / 2 + 0.015, -0.13, 0.050, 0.020, 0.040, 0.040],
    ];
    burnPositions.forEach(([bx, by, bz, bw, bh, bd]) => {
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), hairMat);
      bMesh.position.set(bx, by, bz);
      hairGroup.add(bMesh);
    });

    // --- 6. Crown Cowlicks & Textured Directional Top Locks (18 detailed micro-voxels) ---
    const crownLocks = [
      // Left of part (sweeping leftward)
      [-0.045, headH / 2 + 0.038,  0.06, 0.035, 0.025, 0.075,  0.12,  0.18],
      [-0.080, headH / 2 + 0.030,  0.05, 0.032, 0.025, 0.070,  0.22,  0.15],
      [-0.040, headH / 2 + 0.042,  0.00, 0.035, 0.025, 0.080,  0.10,  0.08],
      [-0.075, headH / 2 + 0.035, -0.01, 0.032, 0.025, 0.075,  0.20,  0.05],
      [-0.045, headH / 2 + 0.040, -0.06, 0.035, 0.025, 0.070,  0.12, -0.12],
      [-0.080, headH / 2 + 0.032, -0.06, 0.030, 0.025, 0.065,  0.22, -0.15],
      // Parting ridge micro-accent at x = +0.03
      [ 0.030, headH / 2 + 0.045,  0.04, 0.020, 0.022, 0.065,  0.02,  0.20],
      [ 0.030, headH / 2 + 0.048, -0.02, 0.020, 0.022, 0.070,  0.00,  0.05],
      // Right of part (swept rightward flow)
      [ 0.055, headH / 2 + 0.044,  0.05, 0.035, 0.025, 0.075, -0.15,  0.18],
      [ 0.085, headH / 2 + 0.038,  0.05, 0.035, 0.025, 0.070, -0.22,  0.15],
      [ 0.105, headH / 2 + 0.028,  0.04, 0.030, 0.025, 0.065, -0.30,  0.12],
      [ 0.060, headH / 2 + 0.046, -0.01, 0.035, 0.025, 0.080, -0.12,  0.08],
      [ 0.090, headH / 2 + 0.040, -0.01, 0.035, 0.025, 0.075, -0.20,  0.05],
      [ 0.110, headH / 2 + 0.030, -0.02, 0.030, 0.025, 0.070, -0.28,  0.04],
      [ 0.055, headH / 2 + 0.042, -0.06, 0.035, 0.025, 0.070, -0.15, -0.12],
      [ 0.085, headH / 2 + 0.036, -0.06, 0.035, 0.025, 0.065, -0.22, -0.15],
      [ 0.000, headH / 2 + 0.038, -0.08, 0.050, 0.025, 0.060,  0.00, -0.22],
      [ 0.000, headH / 2 + 0.046,  0.02, 0.030, 0.022, 0.055, -0.05,  0.12],
    ];
    crownLocks.forEach(([cx, cy, cz, cw, ch, cd, crz, crx]) => {
      const cLock = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), hairMat);
      cLock.position.set(cx, cy, cz);
      cLock.rotation.z = crz;
      cLock.rotation.x = crx;
      hairGroup.add(cLock);
    });

    // --- 7. Nape Taper: 6 horizontal stepped layers at back of neck ---
    for (let ni = 0; ni < 6; ni++) {
      const nY = 0.02 - ni * 0.030;
      const nW = headW + 0.022 - ni * 0.015;
      const nD = 0.028 - ni * 0.002;
      const nape = new THREE.Mesh(new THREE.BoxGeometry(nW, 0.028, nD), hairMat);
      nape.position.set(0, nY, -headD / 2 - 0.016 - ni * 0.002);
      hairGroup.add(nape);
    }
  }

  // 2. REM: 52+ SCULPTED VOXELS, ICONIC ASYMMETRICAL RIGHT-EYE SWEEP, CURVED BOB, 3D BONNET & DUAL BOWS
  else if (config.hairStyle === 'rem_bob') {
    // --- Massive Asymmetrical Diagonal Bang Covering Right Eye (14 stepped slices) ---
    const remDiagonalBangs = [
      // [x, y, z, w, h, d, rotZ]
      [-0.03, 0.12, headD / 2 + 0.018, 0.05, 0.07, 0.030, -0.20],
      [0.01, 0.10, headD / 2 + 0.022, 0.05, 0.08, 0.030, -0.24],
      [0.04, 0.08, headD / 2 + 0.025, 0.06, 0.10, 0.032, -0.28],
      [0.07, 0.05, headD / 2 + 0.026, 0.06, 0.11, 0.032, -0.32],
      [0.10, 0.02, headD / 2 + 0.026, 0.06, 0.12, 0.032, -0.36],
      [0.12, -0.02, headD / 2 + 0.024, 0.055, 0.12, 0.030, -0.40],
      [0.13, -0.06, headD / 2 + 0.022, 0.050, 0.11, 0.028, -0.44],
      [0.14, -0.10, headD / 2 + 0.018, 0.045, 0.09, 0.025, -0.48],
      // Thickness & volume layer underneath
      [0.02, 0.06, headD / 2 + 0.014, 0.055, 0.09, 0.025, -0.25],
      [0.06, 0.02, headD / 2 + 0.016, 0.055, 0.10, 0.025, -0.30],
      [0.09, -0.02, headD / 2 + 0.016, 0.050, 0.10, 0.025, -0.35],
      [0.11, -0.06, headD / 2 + 0.014, 0.045, 0.09, 0.025, -0.40],
      [0.00, 0.08, headD / 2 + 0.014, 0.045, 0.07, 0.025, -0.22],
      [0.05, 0.10, headD / 2 + 0.018, 0.050, 0.07, 0.028, -0.25],
    ];
    remDiagonalBangs.forEach(([rx, ry, rz, rw, rh, rd, rrz]) => {
      const bang = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), hairMat);
      bang.position.set(rx, ry, rz);
      bang.rotation.z = rrz;
      hairGroup.add(bang);
    });

    // --- Left Side Framing Fringe (6 delicate locks) ---
    const remLeftBangs = [
      [-0.06, 0.11, headD / 2 + 0.018, 0.045, 0.07, 0.028, 0.15],
      [-0.09, 0.09, headD / 2 + 0.020, 0.045, 0.08, 0.028, 0.22],
      [-0.11, 0.06, headD / 2 + 0.020, 0.042, 0.08, 0.028, 0.28],
      [-0.07, 0.06, headD / 2 + 0.012, 0.040, 0.07, 0.024, 0.18],
      [-0.10, 0.02, headD / 2 + 0.014, 0.040, 0.07, 0.024, 0.25],
      [-0.12, -0.01, headD / 2 + 0.016, 0.035, 0.06, 0.024, 0.32],
    ];
    remLeftBangs.forEach(([lx, ly, lz, lw, lh, ld, lrz]) => {
      const lBang = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, ld), hairMat);
      lBang.position.set(lx, ly, lz);
      lBang.rotation.z = lrz;
      hairGroup.add(lBang);
    });

    // --- Left Inward-Curling Bob Flounces (8 stepped blocks hugging cheek) ---
    for (let bi = 0; bi < 8; bi++) {
      const bY = 0.08 - bi * 0.035;
      const bX = -headW / 2 - 0.018 + bi * 0.004;
      const bZ = 0.02 - bi * 0.006;
      const bob = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, headD * 0.75 - bi * 0.01), hairMat);
      bob.position.set(bX, bY, bZ);
      bob.rotation.z = 0.08 + bi * 0.03;
      hairGroup.add(bob);
    }

    // --- Right Inward-Curling Bob Flounces (8 stepped blocks hugging cheek) ---
    for (let bi = 0; bi < 8; bi++) {
      const bY = 0.08 - bi * 0.035;
      const bX = headW / 2 + 0.018 - bi * 0.004;
      const bZ = 0.02 - bi * 0.006;
      const bob = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, headD * 0.75 - bi * 0.01), hairMat);
      bob.position.set(bX, bY, bZ);
      bob.rotation.z = -0.08 - bi * 0.03;
      hairGroup.add(bob);
    }

    // --- Rounded Back Bob Curvature (8 horizontal tiers) ---
    for (let rbi = 0; rbi < 8; rbi++) {
      const rbY = 0.08 - rbi * 0.032;
      const rbW = headW + 0.026 - rbi * 0.008;
      const rbD = 0.038 - rbi * 0.002;
      const rbob = new THREE.Mesh(new THREE.BoxGeometry(rbW, 0.030, rbD), hairMat);
      rbob.position.set(0, rbY, -headD / 2 - 0.016 - rbi * 0.003);
      hairGroup.add(rbob);
    }

    // --- 3D Pink Flower Hair Clip with 4 Petals & Center Crystal ---
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf55c96, roughness: 0.45 });
    const flowerCenter = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.018), rubyGlassMat);
    flowerCenter.position.set(-headW / 2 - 0.020, 0.075, 0.075);
    headGroup.add(flowerCenter);

    const petalOffsets = [
      [0, 0.022, 0],
      [0, -0.022, 0],
      [0, 0, 0.022],
      [0, 0, -0.022],
    ];
    petalOffsets.forEach(([px, py, pz]) => {
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.020, 0.018), pinkMat);
      petal.position.set(-headW / 2 - 0.020 + px, 0.075 + py, 0.075 + pz);
      headGroup.add(petal);
    });

    // 3D Magenta X-hairpins
    const pin1 = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.048, 0.008), pinkMat);
    pin1.position.set(-headW / 2 - 0.018, 0.075, 0.045);
    pin1.rotation.x = 0.45;
    headGroup.add(pin1);
    const pin2 = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.048, 0.008), pinkMat);
    pin2.position.set(-headW / 2 - 0.018, 0.075, 0.045);
    pin2.rotation.x = -0.45;
    headGroup.add(pin2);

    // --- 3D Maid Lace Bonnet Arch with 12 Individual Scalloped Lace Ruffles ---
    const bonnetArch = new THREE.Mesh(new THREE.BoxGeometry(headW + 0.06, 0.035, 0.07), whiteMat);
    bonnetArch.position.set(0, headH / 2 + 0.048, 0.01);
    headGroup.add(bonnetArch);

    for (let ri = -5; ri <= 5; ri++) {
      const ruffle = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.022, 0.075), whiteMat);
      ruffle.position.set(ri * 0.024, headH / 2 + 0.062, 0.01);
      ruffle.rotation.y = (ri % 2 === 0 ? 0.15 : -0.15);
      headGroup.add(ruffle);
    }

    // 3D Magenta Ribbon Bows on BOTH Left and Right Sides of Bonnet!
    [-1, 1].forEach((side) => {
      const bowX = side * (headW / 2 + 0.025);
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.045, 0.045), pinkMat);
      bow.position.set(bowX, headH / 2 + 0.02, 0.01);
      headGroup.add(bow);

      // Trailing ribbon tails
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.02), pinkMat);
      tail.position.set(bowX, headH / 2 - 0.04, 0.01);
      tail.rotation.z = side * 0.12;
      headGroup.add(tail);
    });
  }

  // 3. KIRITO: LAYERED ANIME SHAGGY HAIR, OPEN FOREHEAD FRINGE & FRAMING LOCKS (NO CONE SPIKES!)
  else if (config.hairStyle === 'kirito') {
    // --- Forehead Anime Fringe: Open framing bangs that DO NOT cover the eyes or face! ---
    const kiritoBangs = [
      // [x, y, z, w, h, d, rotZ]
      // 1. Upper Forehead Foundation Fringe (sits high on forehead: tips end well above eyes!)
      [-0.080, 0.090, headD / 2 + 0.018, 0.026, 0.052, 0.022,  0.20],
      [-0.055, 0.086, headD / 2 + 0.020, 0.024, 0.048, 0.022,  0.14],
      [-0.032, 0.088, headD / 2 + 0.022, 0.022, 0.046, 0.022,  0.08],
      [ 0.030, 0.088, headD / 2 + 0.022, 0.022, 0.046, 0.022, -0.08],
      [ 0.055, 0.086, headD / 2 + 0.020, 0.024, 0.048, 0.022, -0.14],
      [ 0.080, 0.090, headD / 2 + 0.018, 0.026, 0.052, 0.022, -0.20],

      // 2. Center Signature Anime Strand (slender strand between eyebrows, above nose bridge, clear of eyes)
      [-0.006, 0.068, headD / 2 + 0.024, 0.016, 0.052, 0.018, -0.04],
      [ 0.010, 0.076, headD / 2 + 0.022, 0.015, 0.042, 0.016,  0.08],

      // 3. Delicate Accent Locks (slanted outward, completely clear of eyes)
      [-0.036, 0.074, headD / 2 + 0.022, 0.016, 0.040, 0.016,  0.15],
      [ 0.034, 0.074, headD / 2 + 0.022, 0.016, 0.040, 0.016, -0.15],

      // 4. Temple and Cheek-Framing Long Side Strands (framing face silhouette, clear of eyes)
      [-0.100, 0.060, headD / 2 + 0.018, 0.024, 0.072, 0.022,  0.22],
      [-0.112, 0.020, headD / 2 + 0.016, 0.022, 0.068, 0.020,  0.26],
      [ 0.100, 0.060, headD / 2 + 0.018, 0.024, 0.072, 0.022, -0.22],
      [ 0.112, 0.020, headD / 2 + 0.016, 0.022, 0.068, 0.020, -0.26],
    ];
    kiritoBangs.forEach(([bx, by, bz, bw, bh, bd, brz]) => {
      const bang = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), hairMat);
      bang.position.set(bx, by, bz);
      bang.rotation.z = brz;
      hairGroup.add(bang);
    });

    // --- Sideburns Framing Jaw (4 stepped locks per side) ---
    for (let si = 0; si < 4; si++) {
      const sY = 0.03 - si * 0.035;
      const spL = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.055, 0.045), hairMat);
      spL.position.set(-headW / 2 - 0.015, sY, 0.030 - si * 0.005);
      spL.rotation.z = 0.10 + si * 0.04;
      hairGroup.add(spL);

      const spR = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.055, 0.045), hairMat);
      spR.position.set(headW / 2 + 0.015, sY, 0.030 - si * 0.005);
      spR.rotation.z = -0.10 - si * 0.04;
      hairGroup.add(spR);
    }

    // --- Crown & Parietal Layered Tufts (16 stylish anime box voxels, NO CONE SPIKES!) ---
    const kiritoCrownLocks = [
      // [x, y, z, w, h, d, rotZ, rotX]
      // Top vertex & crown volume
      [ 0.00, headH / 2 + 0.045,  0.03, 0.055, 0.038, 0.075,  0.00,  0.15],
      [-0.04, headH / 2 + 0.048,  0.02, 0.050, 0.036, 0.070,  0.18,  0.12],
      [ 0.04, headH / 2 + 0.048,  0.02, 0.050, 0.036, 0.070, -0.18,  0.12],
      [-0.08, headH / 2 + 0.038,  0.01, 0.045, 0.034, 0.065,  0.28,  0.08],
      [ 0.08, headH / 2 + 0.038,  0.01, 0.045, 0.034, 0.065, -0.28,  0.08],
      // Mid-crown shaggy tufts
      [ 0.00, headH / 2 + 0.050, -0.03, 0.058, 0.036, 0.075,  0.00, -0.15],
      [-0.05, headH / 2 + 0.045, -0.03, 0.050, 0.034, 0.070,  0.20, -0.18],
      [ 0.05, headH / 2 + 0.045, -0.03, 0.050, 0.034, 0.070, -0.20, -0.18],
      [-0.09, headH / 2 + 0.035, -0.04, 0.042, 0.030, 0.060,  0.30, -0.20],
      [ 0.09, headH / 2 + 0.035, -0.04, 0.042, 0.030, 0.060, -0.30, -0.20],
      // Occipital crest volume (back of crown)
      [ 0.00, headH / 2 + 0.040, -0.07, 0.062, 0.034, 0.065,  0.00, -0.30],
      [-0.04, headH / 2 + 0.036, -0.08, 0.048, 0.030, 0.060,  0.16, -0.32],
      [ 0.04, headH / 2 + 0.036, -0.08, 0.048, 0.030, 0.060, -0.16, -0.32],
      // Subtle angled cowlicks adding authentic anime silhouette
      [-0.02, headH / 2 + 0.055,  0.00, 0.032, 0.028, 0.045,  0.12,  0.05],
      [ 0.03, headH / 2 + 0.054, -0.01, 0.032, 0.028, 0.045, -0.10, -0.08],
      [ 0.00, headH / 2 + 0.046,  0.06, 0.040, 0.026, 0.040,  0.00,  0.22],
    ];
    kiritoCrownLocks.forEach(([cx, cy, cz, cw, ch, cd, crz, crx]) => {
      const lock = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), hairMat);
      lock.position.set(cx, cy, cz);
      lock.rotation.z = crz;
      lock.rotation.x = crx;
      hairGroup.add(lock);
    });

    // --- Flared Nape Tufts at Neck Collar (10 layered voxel locks) ---
    for (let ni = -4; ni <= 4; ni++) {
      const napeSpike = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.065, 0.026), hairMat);
      napeSpike.position.set(ni * 0.026, -0.075, -headD / 2 - 0.018);
      napeSpike.rotation.x = 0.22;
      napeSpike.rotation.z = ni * 0.06;
      hairGroup.add(napeSpike);
    }
  }

  // 4. SUBARU: JAGGED ANIME FACETED LOCKS & SWEPT-BACK RETRO COWLICKS
  else if (config.hairStyle === 'spiky' || isSubaru) {
    // --- Prominent Swept-Up Center Forehead Bang ---
    const centerLock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.035), hairMat);
    centerLock.position.set(0, 0.10, headD / 2 + 0.025);
    centerLock.rotation.x = -0.35;
    hairGroup.add(centerLock);

    // Flanking diagonal stepped locks framing forehead
    const subaruBangs = [
      [-0.04, 0.09, headD / 2 + 0.022, 0.045, 0.09, 0.030, -0.22],
      [0.04, 0.09, headD / 2 + 0.022, 0.045, 0.09, 0.030, 0.22],
      [-0.08, 0.08, headD / 2 + 0.020, 0.045, 0.10, 0.030, -0.34],
      [0.08, 0.08, headD / 2 + 0.020, 0.045, 0.10, 0.030, 0.34],
      [-0.11, 0.05, headD / 2 + 0.016, 0.040, 0.09, 0.028, -0.42],
      [0.11, 0.05, headD / 2 + 0.016, 0.040, 0.09, 0.028, 0.42],
    ];
    subaruBangs.forEach(([bx, by, bz, bw, bh, bd, brz]) => {
      const bang = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), hairMat);
      bang.position.set(bx, by, bz);
      bang.rotation.z = brz;
      hairGroup.add(bang);
    });

    // Tiered sculpted crown volume (overlapping faceted blocks)
    const crownTiers = [
      [0, headH / 2 + 0.04, 0.02, 0.16, 0.06, 0.16, -0.20, 0],
      [0, headH / 2 + 0.07, -0.02, 0.14, 0.06, 0.14, -0.30, 0],
      [-0.05, headH / 2 + 0.06, 0.00, 0.08, 0.07, 0.12, -0.25, 0.25],
      [0.05, headH / 2 + 0.06, 0.00, 0.08, 0.07, 0.12, -0.25, -0.25],
      [-0.07, headH / 2 + 0.04, -0.04, 0.07, 0.07, 0.10, -0.35, 0.35],
      [0.07, headH / 2 + 0.04, -0.04, 0.07, 0.07, 0.10, -0.35, -0.35],
      [0, headH / 2 + 0.05, -0.08, 0.12, 0.06, 0.10, -0.45, 0],
    ];
    crownTiers.forEach(([tx, ty, tz, tw, th, td, rx, rz]) => {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td), hairMat);
      tier.position.set(tx, ty, tz);
      tier.rotation.x = rx;
      tier.rotation.z = rz;
      hairGroup.add(tier);
    });

    // Angled flared cheek cowlicks with solid backing anchors (zero rear-view gaps!)
    [-1, 1].forEach((side) => {
      const anchor = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.08), hairMat);
      anchor.position.set(side * (headW / 2 + 0.010), -0.01, -0.02);
      hairGroup.add(anchor);

      for (let j = 0; j < 4; j++) {
        const cowlick = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.05), hairMat);
        cowlick.position.set(side * (headW / 2 + 0.018), 0.05 - j * 0.035, 0.02 - j * 0.015);
        cowlick.rotation.z = side * (0.28 + j * 0.08);
        hairGroup.add(cowlick);
      }
    });
  }

  // 5. ASUNA: 68+ FLOWING CHESTNUT LOCKS, FRONT CHEST DRAPES, BRAIDED HALO & LONG BACK
  else if (config.hairStyle === 'asuna_long') {
    // --- Front Chest Locks: 2 long locks draping over shoulders (10 stepped voxels each = 20 voxels) ---
    [-1, 1].forEach((side) => {
      for (let di = 0; di < 10; di++) {
        const dY = 0.08 - di * 0.042;
        const dX = side * (headW / 2 - 0.02 + di * 0.003);
        const dZ = headD / 2 + 0.015 - di * 0.002;
        const dW = 0.032 - di * 0.001;
        const dH = 0.045;
        const dD = 0.035 - di * 0.001;
        const drape = new THREE.Mesh(new THREE.BoxGeometry(dW, dH, dD), hairMat);
        drape.position.set(dX, dY, dZ);
        drape.rotation.z = side * 0.06;
        hairGroup.add(drape);
      }
    });

    // --- Forehead Fringe: 10 delicate parted bangs ---
    for (let fi = -4; fi <= 5; fi++) {
      const fX = fi * 0.024;
      const fY = 0.10 - Math.abs(fi) * 0.008;
      const fZ = headD / 2 + 0.018;
      const fMesh = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.07, 0.024), hairMat);
      fMesh.position.set(fX, fY, fZ);
      fMesh.rotation.z = (fi < 0 ? 0.15 : -0.15);
      hairGroup.add(fMesh);
    }

    // --- 3D Braided Circlet Halo (14 interlocking braid voxels sitting flush on head cap) ---
    for (let bi = 0; bi < 14; bi++) {
      const bAngle = (bi / 14) * Math.PI * 2;
      const bX = Math.sin(bAngle) * (headW / 2 + 0.008);
      const bZ = Math.cos(bAngle) * (headD / 2 + 0.008);
      const braidVoxel = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.024), hairMat);
      braidVoxel.position.set(bX, headH / 2 + 0.016, bZ);
      braidVoxel.rotation.y = bAngle;
      braidVoxel.rotation.z = (bi % 2 === 0 ? 0.25 : -0.25);
      headGroup.add(braidVoxel);
    }

    // --- Long Flowing Back Hair: 24 cascading locks in 3 depth tiers ---
    for (let tier = 0; tier < 3; tier++) {
      const tZ = -headD / 2 - 0.016 - tier * 0.018;
      for (let col = -3; col <= 4; col++) {
        const cX = col * 0.032;
        const cY = -0.12 - tier * 0.06;
        const cH = 0.48 - tier * 0.06;
        const backLock = new THREE.Mesh(new THREE.BoxGeometry(0.032, cH, 0.024), hairMat);
        backLock.position.set(cX, cY, tZ);
        backLock.rotation.z = col * 0.03;
        hairGroup.add(backLock);
      }
    }
  }

  // 6. WESKER: 42+ STRIATED COMB RIDGES, POMPADOUR CREST & CLEAN FADE
  else if (config.hairStyle === 'sleek_back') {
    // Raised Pompadour Crest over forehead
    const pompadour = new THREE.Mesh(new THREE.BoxGeometry(headW - 0.01, 0.075, 0.12), hairMat);
    pompadour.position.set(0, headH / 2 + 0.042, 0.03);
    hairGroup.add(pompadour);

    // 16 Longitudinal Comb Ridges sweeping front-to-back
    for (let cri = -7; cri <= 8; cri++) {
      const crX = cri * 0.014;
      const crY = headH / 2 + 0.068 - Math.abs(cri) * 0.003;
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.024, headD + 0.02), hairMat);
      ridge.position.set(crX, crY, 0);
      ridge.rotation.x = -0.06;
      hairGroup.add(ridge);
    }

    // Receding temple angles & widow's peak
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.03), hairMat);
    peak.position.set(0, 0.11, headD / 2 + 0.016);
    hairGroup.add(peak);

    // 12 stepped side fade layers
    [-1, 1].forEach((side) => {
      for (let fi = 0; fi < 6; fi++) {
        const fade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.035, headD * 0.8), hairMat);
        fade.position.set(side * (headW / 2 + 0.010 - fi * 0.002), 0.08 - fi * 0.03, 0);
        hairGroup.add(fade);
      }
    });
  }

  // 7. RAIDER / MOHAWK: AGGRESSIVE FACETED RIDGE CREST & SHAVED UNDERCUT
  else if (config.hairStyle === 'mohawk' || isRaider) {
    // Dense continuous tall ridge along sagittal centerline from forehead to nape
    const mohawkW = 0.055;
    for (let mi = 0; mi < 16; mi++) {
      const mZ = headD / 2 + 0.015 - mi * 0.028;
      const progress = mi / 15;
      const mH = 0.10 + Math.sin(progress * Math.PI) * 0.14; // peaks at crown!
      const crestSegment = new THREE.Mesh(new THREE.BoxGeometry(mohawkW, mH, 0.035), hairMat);
      crestSegment.position.set(0, headH / 2 + mH / 2 + 0.005, mZ);
      crestSegment.rotation.x = (mi < 8 ? 0.20 : -0.25);
      hairGroup.add(crestSegment);
    }

    // Buzzed dark undercut stubble on temporal sides
    [-1, 1].forEach((side) => {
      const buzzPlate = new THREE.Mesh(new THREE.BoxGeometry(0.015, headH * 0.75, headD * 0.9), sideHairMat);
      buzzPlate.position.set(side * (headW / 2 + 0.008), 0.02, 0);
      hairGroup.add(buzzPlate);

      // 3 Metallic ear piercing studs
      for (let pi = 0; pi < 3; pi++) {
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.010, 6), metalMat);
        stud.rotation.z = Math.PI / 2;
        stud.position.set(side * (headW / 2 + 0.016), -0.02 - pi * 0.025, -0.01);
        headGroup.add(stud);
      }
    });
  }

  // 8. MILITARY / CYBER: 32+ CROPPED TOP RIDGES & 3D NEURAL PORT
  else if (config.hairStyle === 'short_military' || config.hairStyle === 'buzz' || isCyborg) {
    // 16 cropped top ridges
    for (let cri = -7; cri <= 8; cri++) {
      const crX = cri * 0.014;
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.020, headD * 0.85), hairMat);
      ridge.position.set(crX, headH / 2 + 0.025, 0);
      hairGroup.add(ridge);
    }
    // 3D Cybernetic Neural Socket on left temple (for cyborg)
    if (isCyborg) {
      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.015, 8), metalMat);
      socket.rotation.z = Math.PI / 2;
      socket.position.set(-headW / 2 - 0.012, 0.04, 0.03);
      hairGroup.add(socket);

      const socketLED = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.018, 8), neonCyanMat);
      socketLED.rotation.z = Math.PI / 2;
      socketLED.position.set(-headW / 2 - 0.014, 0.04, 0.03);
      hairGroup.add(socketLED);
    }
  }

  // 9. HIGH PONYTAIL
  else if (config.hairStyle === 'ponytail') {
    // Parted fringe
    for (let fi = -3; fi <= 3; fi++) {
      const fX = fi * 0.028;
      const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.050, 0.022), hairMat);
      fringe.position.set(fX, 0.09, headD / 2 + 0.018);
      fringe.rotation.z = fi * 0.06;
      hairGroup.add(fringe);
    }
    // Hair tie / band
    const tieMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const hairTie = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.020, 8), tieMat);
    hairTie.position.set(0, headH / 2 + 0.04, -headD / 2 - 0.015);
    hairTie.rotation.x = Math.PI / 4;
    hairGroup.add(hairTie);

    // Ponytail cascading downwards
    for (let pi = 0; pi < 6; pi++) {
      const pY = headH / 2 + 0.02 - pi * 0.045;
      const pZ = -headD / 2 - 0.025 - pi * 0.010;
      const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.035), hairMat);
      tailMesh.position.set(0, pY, pZ);
      tailMesh.rotation.x = -0.18;
      hairGroup.add(tailMesh);
    }
  }

  // 10. TWINTAILS / DUAL PIGTAILS
  else if (config.hairStyle === 'twintails') {
    // Forehead bangs
    for (let fi = -4; fi <= 4; fi++) {
      const fX = fi * 0.024;
      const bang = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.052, 0.022), hairMat);
      bang.position.set(fX, 0.09, headD / 2 + 0.018);
      bang.rotation.z = fi * 0.05;
      hairGroup.add(bang);
    }
    // Dual side tails
    [-1, 1].forEach((side) => {
      const tieMat = new THREE.MeshStandardMaterial({ color: 0xee4466, roughness: 0.4 });
      const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.018, 8), tieMat);
      tie.position.set(side * (headW / 2 + 0.025), headH / 2 + 0.03, 0);
      tie.rotation.z = side * 0.4;
      hairGroup.add(tie);

      for (let ti = 0; ti < 7; ti++) {
        const tY = headH / 2 + 0.01 - ti * 0.045;
        const tX = side * (headW / 2 + 0.032 + Math.sin(ti * 0.4) * 0.015);
        const tailSeg = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.052, 0.028), hairMat);
        tailSeg.position.set(tX, tY, 0);
        tailSeg.rotation.z = side * 0.10;
        hairGroup.add(tailSeg);
      }
    });
  }

  // 11. BALD: No hair elements added
  else if (isBald) {
    // Intentionally empty: bald skull is already rendered by headMesh with headBaseMat
  }

  // 12. DEFAULT / WASTELAND SHAGGY: 40+ TOUSLED LOCKS & UNEVEN BANGS
  else {
    // 14 uneven forehead fringe locks
    for (let bi = -6; bi <= 7; bi++) {
      const bX = bi * 0.018;
      const bH = 0.07 + (bi % 3) * 0.015;
      const bY = 0.10 - Math.abs(bi) * 0.005;
      const bang = new THREE.Mesh(new THREE.BoxGeometry(0.022, bH, 0.024), hairMat);
      bang.position.set(bX, bY, headD / 2 + 0.016);
      bang.rotation.z = (bi % 2 === 0 ? 0.12 : -0.12);
      hairGroup.add(bang);
    }
    // 16 contoured flat lock plates laying flush on hairTop
    for (let ci = 0; ci < 16; ci++) {
      const cAngle = (ci / 16) * Math.PI * 2;
      const cX = Math.cos(cAngle) * 0.065;
      const cZ = Math.sin(cAngle) * 0.065;
      const lockPlate = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.020, 0.065), hairMat);
      lockPlate.position.set(cX, headH / 2 + 0.050, cZ);
      lockPlate.rotation.y = cAngle;
      hairGroup.add(lockPlate);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. 3D HEADWEAR & ACCESSORIES (3-5x Density)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── HUNK'S FULL S10 GAS MASK & COMBAT HELMET ──
  if (config.headwear === 'gasmask_hunk') {
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.9 });
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(headW + 0.04, 0.12, headD + 0.05), helmetMat);
    helmet.position.set(0, headH / 2 + 0.03, -0.01);
    headGroup.add(helmet);

    // NVG Mount Plate on Helmet
    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), metalMat);
    nvgMount.position.set(0, headH / 2 + 0.05, headD / 2 + 0.02);
    headGroup.add(nvgMount);

    const maskPlate = new THREE.Mesh(new THREE.BoxGeometry(headW, headH - 0.02, 0.06), blackLeatherMat);
    maskPlate.position.set(0, 0, headD / 2 + 0.03);
    headGroup.add(maskPlate);

    const lensGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.025, 16);
    lensGeo.rotateX(Math.PI / 2);

    const lensL = new THREE.Mesh(lensGeo, rubyGlassMat);
    lensL.position.set(-0.065, 0.02, headD / 2 + 0.065);
    headGroup.add(lensL);

    const lensR = new THREE.Mesh(lensGeo, rubyGlassMat);
    lensR.position.set(0.065, 0.02, headD / 2 + 0.065);
    headGroup.add(lensR);

    const ringGeo = new THREE.TorusGeometry(0.038, 0.007, 8, 16);
    const ringL = new THREE.Mesh(ringGeo, metalMat);
    ringL.position.set(-0.065, 0.02, headD / 2 + 0.075);
    headGroup.add(ringL);

    const ringR = new THREE.Mesh(ringGeo, metalMat);
    ringR.position.set(0.065, 0.02, headD / 2 + 0.075);
    headGroup.add(ringR);

    const speech = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 16), metalMat);
    speech.rotation.x = Math.PI / 2;
    speech.position.set(0, -0.065, headD / 2 + 0.07);
    headGroup.add(speech);

    const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.07, 16), new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.4 }));
    filter.rotation.z = Math.PI / 2;
    filter.position.set(-headW / 2 - 0.03, -0.065, headD / 2);
    headGroup.add(filter);
  }

  // ── WESKER'S 3D WIRE TEMPLES ──
  else if (config.headwear === 'sunglasses_wesker') {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xccd5e0, metalness: 0.9, roughness: 0.2 });
    const templeL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.16), frameMat);
    templeL.position.set(-headW / 2 - 0.006, 0.02, 0.02);
    headGroup.add(templeL);

    const templeR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.16), frameMat);
    templeR.position.set(headW / 2 + 0.006, 0.02, 0.02);
    headGroup.add(templeR);
  }

  // ── REM'S DEMON HORN ──
  if (config.headwear === 'rem_demon_horn') {
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xddeeff,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 8), hornMat);
    horn.position.set(0, 0.15, headD / 2 + 0.01);
    horn.rotation.x = -0.35;
    headGroup.add(horn);
  }

  // ── VAULT-TEC RADIO HEADSET ──
  else if (config.headwear === 'headset') {
    const headsetMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
    const earCup = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.07), headsetMat);
    earCup.position.set(-headW / 2 - 0.015, 0.01, 0);
    headGroup.add(earCup);

    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.13), headsetMat);
    boom.position.set(-headW / 2 - 0.01, -0.05, 0.06);
    headGroup.add(boom);

    const diodeMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 });
    const diode = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.016), diodeMat);
    diode.position.set(-headW / 2 - 0.022, 0.03, 0.02);
    headGroup.add(diode);
    group.userData.diode = diode;
  }

  // ── CYBERPUNK HOLOGRAPHIC VISOR ──
  else if (config.headwear === 'cyber_visor' || isCyborg) {
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.85,
    });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(headW + 0.02, 0.045, 0.07), visorMat);
    visor.position.set(0, 0.02, headD / 2 + 0.03);
    headGroup.add(visor);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. BACK ACCESSORIES (Detailed 3D Weapons & Equipment)
  // ═══════════════════════════════════════════════════════════════════════════
  if (config.backAccessory === 'dual_swords') {
    // KIRITO DUAL 3D SWORDS (Elucidator & Dark Repulser)
    const swordGroup = new THREE.Group();
    swordGroup.position.set(0, 0, -torsoD / 2 - 0.04);
    torsoGroup.add(swordGroup);

    // 1. ELUCIDATOR (Obsidian Black Sword)
    const sword1 = new THREE.Group();
    sword1.rotation.z = 0.52;

    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.76, 0.018), blackLeatherMat);
    sword1.add(blade1);

    const guard1 = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.02, 16), metalMat);
    guard1.position.y = 0.38;
    sword1.add(guard1);

    const hilt1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), blackLeatherMat);
    hilt1.position.y = 0.46;
    sword1.add(hilt1);

    const pommel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), metalMat);
    pommel1.position.y = 0.54;
    sword1.add(pommel1);

    swordGroup.add(sword1);

    // 2. DARK REPULSER (Crystalline Aqua-Teal Sword)
    const sword2 = new THREE.Group();
    sword2.rotation.z = -0.52;

    const tealMat = new THREE.MeshStandardMaterial({
      color: 0x42f5c8,
      emissive: 0x22c59b,
      emissiveIntensity: 0.55,
      metalness: 0.4,
      roughness: 0.1,
    });
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.76, 0.018), tealMat);
    sword2.add(blade2);

    const guard2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), tealMat);
    guard2.position.y = 0.38;
    sword2.add(guard2);

    const hilt2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), blackLeatherMat);
    hilt2.position.y = 0.46;
    sword2.add(hilt2);

    swordGroup.add(sword2);
  } else if (config.backAccessory === 'backpack' || isRaider) {
    const packMat = new THREE.MeshStandardMaterial({ color: 0x3d281a, roughness: 0.85 });
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.15), packMat);
    pack.position.set(0, 0, -torsoD / 2 - 0.08);
    torsoGroup.add(pack);

    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 12), blackLeatherMat);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 0.23, -torsoD / 2 - 0.07);
    torsoGroup.add(roll);
  } else if (config.backAccessory === 'oxygen_tank' || isHunk) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 16), isHunk ? blackLeatherMat : goldMat);
    tank.position.set(0, 0, -torsoD / 2 - 0.08);
    torsoGroup.add(tank);

    const valve = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.055), metalMat);
    valve.position.set(0, 0.24, -torsoD / 2 - 0.08);
    torsoGroup.add(valve);
  }

  const headScale = config.headScale !== undefined ? config.headScale : 1.0;
  if (group.userData.head && headScale !== 1.0) {
    group.userData.head.scale.set(headScale, headScale, headScale);
  }

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: 3D Drop-Leg Tactical Holster with VP70 Pistol
// ─────────────────────────────────────────────────────────────────────────────
function addTacticalHolster(parent, legSpacing, y, z, isSeated, metalMat, blackLeatherMat) {
  const holsterGroup = new THREE.Group();
  holsterGroup.position.set(legSpacing + 0.08, y, z);

  // 1. Kydex Holster Shell
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.14), blackLeatherMat);
  holsterGroup.add(shell);

  // 2. Dual Thigh Wrap-Around Straps with Metal Buckles
  [-0.04, 0.04].forEach((sy) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.020, 0.15), blackLeatherMat);
    strap.position.set(-0.01, sy, 0);
    holsterGroup.add(strap);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.024, 0.028), metalMat);
    buckle.position.set(0.028, sy, 0.05);
    holsterGroup.add(buckle);
  });

  // 3. Drop Leg Belt Attachment Strap
  const dropStrap = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.015), blackLeatherMat);
  dropStrap.position.set(0, 0.14, 0);
  holsterGroup.add(dropStrap);

  // 4. VP70 Matilda Pistol Inside Holster
  const gunSlide = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.048, 0.13), metalMat);
  gunSlide.position.set(0, isSeated ? 0.05 : 0.07, 0.01);
  holsterGroup.add(gunSlide);

  // Slide serrations (rear grooves)
  for (let si = -2; si <= 2; si++) {
    const serration = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.035, 0.005), blackLeatherMat);
    serration.position.set(0, isSeated ? 0.05 : 0.07, -0.04 + si * 0.008);
    holsterGroup.add(serration);
  }

  // Pistol Textured Grip
  const gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.070, 0.038), blackLeatherMat);
  gunGrip.position.set(0, isSeated ? 0.08 : 0.10, -0.03);
  gunGrip.rotation.x = -0.42;
  holsterGroup.add(gunGrip);

  // Hammer & Beavertail
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.020, 0.018), metalMat);
  hammer.position.set(0, isSeated ? 0.075 : 0.095, -0.05);
  holsterGroup.add(hammer);

  // Holster Thumb Break Retention Strap
  const retentionStrap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.014, 0.05), blackLeatherMat);
  retentionStrap.position.set(0, isSeated ? 0.07 : 0.09, -0.02);
  holsterGroup.add(retentionStrap);

  parent.add(holsterGroup);
}
