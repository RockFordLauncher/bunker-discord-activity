import * as THREE from 'three';

/**
 * Procedural texture generator for Fallout Vault-Tec Bunker
 * All textures are generated via HTML5 Canvas (0 network dependencies, 0 failed assets)
 */

export function createConcreteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Base dirty concrete grey with subtle blue-warm tone
  ctx.fillStyle = '#2d333b';
  ctx.fillRect(0, 0, 1024, 1024);

  // Multi-octave fine noise / concrete grain
  for (let i = 0; i < 70000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const s = Math.random() * 3 + 1;
    const val = Math.floor(Math.random() * 60);
    const alpha = Math.random() * 0.18 + 0.05;
    ctx.fillStyle = Math.random() > 0.4
      ? `rgba(${val + 15}, ${val + 18}, ${val + 22}, ${alpha})`
      : `rgba(${val + 25}, ${val + 24}, ${val + 20}, ${alpha})`;
    ctx.fillRect(x, y, s, s);
  }

  // Large subtle moisture and grime patches
  for (let p = 0; p < 18; p++) {
    const px = Math.random() * 1024;
    const py = Math.random() * 1024;
    const pr = Math.random() * 180 + 80;
    const grad = ctx.createRadialGradient(px, py, 10, px, py, pr);
    grad.addColorStop(0, 'rgba(20, 24, 28, 0.35)');
    grad.addColorStop(0.6, 'rgba(25, 29, 34, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Realistic stress cracks and fissures
  ctx.strokeStyle = 'rgba(8, 10, 12, 0.55)';
  ctx.lineWidth = 2.0;
  for (let c = 0; c < 12; c++) {
    let px = Math.random() * 1024;
    let py = Math.random() * 1024;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let step = 0; step < 16; step++) {
      px += (Math.random() - 0.5) * 50;
      py += Math.random() * 40;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Precast concrete panel seam with highlight bevel
  ctx.strokeStyle = 'rgba(5, 6, 8, 0.8)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(1024, 512);
  ctx.stroke();

  // Subtle highlight on top of panel seam for 3D depth
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 508);
  ctx.lineTo(1024, 508);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createRustyMetalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Industrial steel base with warm metallic tint
  ctx.fillStyle = '#292825';
  ctx.fillRect(0, 0, 1024, 1024);

  // High-frequency brushed metal grain
  for (let i = 0; i < 35000; i++) {
    const y = Math.random() * 1024;
    const alpha = Math.random() * 0.14 + 0.04;
    ctx.fillStyle = Math.random() > 0.5
      ? `rgba(85, 82, 74, ${alpha})`
      : `rgba(25, 24, 20, ${alpha * 1.5})`;
    ctx.fillRect(0, y, 1024, Math.random() * 2 + 1);
  }

  // Micro-scratches
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  for (let s = 0; s < 80; s++) {
    const sx = Math.random() * 1024;
    const sy = Math.random() * 1024;
    const sl = Math.random() * 60 + 20;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + sl, sy + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }

  // Rust patches with multi-stage oxidation (deep dark brown to burnt orange)
  for (let r = 0; r < 35; r++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    const rad = Math.random() * 120 + 40;
    const grad = ctx.createRadialGradient(rx, ry, 4, rx, ry, rad);
    grad.addColorStop(0, 'rgba(140, 52, 14, 0.45)');
    grad.addColorStop(0.4, 'rgba(95, 38, 12, 0.35)');
    grad.addColorStop(0.7, 'rgba(50, 20, 8, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(rx, ry, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Heavy steel bolt rivets along the perimeter with 3D drop shadow & specular highlight
  for (let x = 32; x < 1024; x += 96) {
    drawRivet(ctx, x, 32);
    drawRivet(ctx, x, 992);
  }
  for (let y = 32; y < 1024; y += 96) {
    drawRivet(ctx, 32, y);
    drawRivet(ctx, 992, y);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function drawRivet(ctx, x, y) {
  // Rivet shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.beginPath();
  ctx.arc(x + 2, y + 2, 8, 0, Math.PI * 2);
  ctx.fill();

  // Rivet metal head
  const grad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 7);
  grad.addColorStop(0, '#777065');
  grad.addColorStop(0.6, '#332f28');
  grad.addColorStop(1, '#1a1815');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();

  // Specular gleam
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function createGearDoorTexture(vaultNumber = '101') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const cx = 512;
  const cy = 512;

  // Outer frame dark steel
  ctx.fillStyle = '#111316';
  ctx.fillRect(0, 0, 1024, 1024);

  // Big gear outline
  const outerR = 460;
  const innerR = 390;
  const numTeeth = 16;

  ctx.fillStyle = '#1c2838'; // Vault steel blue
  ctx.beginPath();
  for (let i = 0; i < numTeeth * 2; i++) {
    const angle = (i * Math.PI) / numTeeth;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d4a017'; // Yellow trim
  ctx.lineWidth = 14;
  ctx.stroke();

  // Yellow teeth accents
  ctx.fillStyle = '#d4a017';
  for (let i = 0; i < numTeeth; i++) {
    const angle = (i * 2 * Math.PI) / numTeeth;
    const x = cx + Math.cos(angle) * (innerR + 35);
    const y = cy + Math.sin(angle) * (innerR + 35);
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner circle hatch
  ctx.fillStyle = '#181e28';
  ctx.beginPath();
  ctx.arc(cx, cy, 340, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4a017';
  ctx.lineWidth = 10;
  ctx.stroke();

  // Massive Vault Number
  ctx.fillStyle = '#d4a017';
  ctx.font = 'bold 180px "Impact", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(vaultNumber, cx, cy - 30);

  // VAULT-TEC subtitle
  ctx.fillStyle = '#f0c040';
  ctx.font = 'bold 36px monospace';
  ctx.letterSpacing = '8px';
  ctx.fillText('VAULT-TEC', cx, cy + 90);
  ctx.font = '18px monospace';
  ctx.fillStyle = 'rgba(212, 160, 23, 0.7)';
  ctx.fillText('INNER HERMETIC SEAL', cx, cy + 130);

  // Central turn wheel spokes
  ctx.strokeStyle = 'rgba(80, 80, 80, 0.7)';
  ctx.lineWidth = 12;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(angle) * 180, cy - Math.sin(angle) * 180);
    ctx.lineTo(cx + Math.cos(angle) * 180, cy + Math.sin(angle) * 180);
    ctx.stroke();
  }
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(cx, cy, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4a017';
  ctx.lineWidth = 6;
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

export function createWastelandDoorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Weathered steel
  ctx.fillStyle = '#262320';
  ctx.fillRect(0, 0, 512, 1024);

  // Rust and grunge
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 1024;
    ctx.fillStyle = Math.random() > 0.6 ? 'rgba(100, 40, 10, 0.25)' : 'rgba(5, 5, 5, 0.4)';
    ctx.fillRect(x, y, Math.random() * 4 + 1, Math.random() * 4 + 1);
  }

  // Yellow & Black hazard stripes at top and bottom
  const drawHazard = (yStart, height) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, yStart, 512, height);
    ctx.clip();
    for (let x = -height; x < 512 + height; x += 40) {
      ctx.fillStyle = '#d4a017';
      ctx.beginPath();
      ctx.moveTo(x, yStart);
      ctx.lineTo(x + 20, yStart);
      ctx.lineTo(x + 20 - height, yStart + height);
      ctx.lineTo(x - height, yStart + height);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(x + 20, yStart);
      ctx.lineTo(x + 40, yStart);
      ctx.lineTo(x + 40 - height, yStart + height);
      ctx.lineTo(x + 20 - height, yStart + height);
      ctx.fill();
    }
    ctx.restore();
  };
  drawHazard(0, 70);
  drawHazard(1024 - 70, 70);

  // Armored glass porthole with radiation symbol
  const px = 256, py = 320, pr = 100;
  ctx.fillStyle = '#0a1012';
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Glass reflection
  const glassGrad = ctx.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
  glassGrad.addColorStop(0, 'rgba(40, 120, 140, 0.4)');
  glassGrad.addColorStop(0.5, 'rgba(10, 30, 40, 0.2)');
  glassGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.arc(px, py, pr - 8, 0, Math.PI * 2);
  ctx.fill();

  // Red trefoil symbol inside porthole
  ctx.fillStyle = 'rgba(210, 40, 30, 0.85)';
  ctx.beginPath();
  ctx.arc(px, py, 14, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(px, py, 60, a - 0.4, a + 0.4);
    ctx.arc(px, py, 26, a + 0.4, a - 0.4, true);
    ctx.closePath();
    ctx.fill();
  }

  // Stencil Warnings
  ctx.fillStyle = '#d2281e';
  ctx.font = 'bold 36px "Arial Black", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('OUTER AIRLOCK', 256, 520);
  ctx.fillStyle = '#d4a017';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('WASTELAND EXCLUSION ZONE', 256, 560);
  ctx.fillStyle = '#888';
  ctx.font = '18px monospace';
  ctx.fillText('DECOMPRESSION HAZARD', 256, 610);
  ctx.fillText('UNAUTHORIZED EXIT = DEATH', 256, 640);

  // Heavy lever handle
  ctx.fillStyle = '#333';
  ctx.fillRect(180, 720, 152, 28);
  ctx.fillStyle = '#d2281e';
  ctx.fillRect(320, 710, 36, 120); // big red lever

  return new THREE.CanvasTexture(canvas);
}

export function createPosterTexture(type = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Aged yellowed paper
  ctx.fillStyle = '#d8cbb0';
  ctx.fillRect(0, 0, 384, 512);

  // Grunge vignette
  const grad = ctx.createRadialGradient(192, 256, 120, 192, 256, 260);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(80, 50, 20, 0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 384, 512);

  // Poster border
  ctx.strokeStyle = '#1a3250';
  ctx.lineWidth = 10;
  ctx.strokeRect(16, 16, 352, 480);

  ctx.textAlign = 'center';

  if (type === 0) {
    // PREPARE FOR THE FUTURE
    ctx.fillStyle = '#1a3250';
    ctx.font = 'bold 32px "Arial Black", sans-serif';
    ctx.fillText('PREPARE FOR', 192, 70);
    ctx.fillText('THE FUTURE!', 192, 105);

    // Vault Boy silhouette circle
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    ctx.arc(192, 230, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a3250';
    ctx.beginPath();
    ctx.arc(192, 220, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(160, 250, 64, 60);

    ctx.fillStyle = '#1a3250';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('VAULT-TEC', 192, 370);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#444';
    ctx.fillText('A SECURE TOMORROW TODAY', 192, 400);
    ctx.fillText('CALL YOUR REP NOW', 192, 430);
  } else if (type === 1) {
    // ATOMIC HAZARD
    ctx.fillStyle = '#b02010';
    ctx.font = 'bold 36px "Arial Black", sans-serif';
    ctx.fillText('RADIATION', 192, 75);
    ctx.fillText('KILLS!', 192, 115);

    // Trefoil
    ctx.fillStyle = '#b02010';
    ctx.beginPath();
    ctx.arc(192, 240, 20, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(192, 240, 80, a - 0.45, a + 0.45);
      ctx.arc(192, 240, 35, a + 0.45, a - 0.45, true);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#111';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('REPORT ANY LEAKS', 192, 380);
    ctx.fillText('TO THE OVERSEER', 192, 410);
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText('VAULT-TEC DIRECTIVE #42', 192, 450);
  } else {
    // OBEY THE OVERSEER
    ctx.fillStyle = '#1a3250';
    ctx.font = 'bold 30px "Arial Black", sans-serif';
    ctx.fillText('PROTECT YOUR', 192, 70);
    ctx.fillText('COMMUNITY', 192, 105);

    ctx.fillStyle = '#d4a017';
    ctx.fillRect(92, 150, 200, 160);
    ctx.fillStyle = '#1a3250';
    ctx.font = 'bold 70px "Arial Black", sans-serif';
    ctx.fillText('VAULT', 192, 220);
    ctx.fillText('LIFE', 192, 280);

    ctx.fillStyle = '#1a3250';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('STAY VIGILANT', 192, 370);
    ctx.fillText('MAINTAIN AIRLOCK DISCIPLINE', 192, 400);
    ctx.fillStyle = '#555';
    ctx.font = '13px monospace';
    ctx.fillText('NO ONE LEAVES WITHOUT PERMIT', 192, 440);
  }

  return new THREE.CanvasTexture(canvas);
}

export function createCardBackTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 460;
  const ctx = canvas.getContext('2d');

  // Worn aged card dark navy
  ctx.fillStyle = '#141c28';
  ctx.fillRect(0, 0, 320, 460);

  // Border frame
  ctx.strokeStyle = '#d4a017';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 296, 436);

  // Thin inner border
  ctx.strokeStyle = 'rgba(212, 160, 23, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 280, 420);

  // Corner decors
  const corners = [[26, 26], [294, 26], [26, 434], [294, 434]];
  ctx.fillStyle = '#d4a017';
  corners.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Central Vault-Tec gear
  const cx = 160, cy = 230;
  ctx.fillStyle = '#d4a017';
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    const r = i % 2 === 0 ? 80 : 66;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#141c28';
  ctx.beginPath();
  ctx.arc(cx, cy, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d4a017';
  ctx.font = 'bold 36px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VT', cx, cy);

  ctx.font = 'bold 15px monospace';
  ctx.fillText('BUNKER PROTOCOL', cx, cy + 120);

  return new THREE.CanvasTexture(canvas);
}

// ─── Procedural Vault-Tec Vector Badges (Zero Emojis!) ─────────────────────
function drawVaultTecBadge(ctx, category, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = '#f0c040';
  ctx.fillStyle = '#f0c040';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cat = (category || '').toLowerCase();

  if (cat.includes('prof') || cat === 'profession') {
    // Gear & Crossed Tools
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      const rad = i % 2 === 0 ? r : r * 0.76;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Central hole
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 2);
    ctx.stroke();

    // Crossed wrench & hammer
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
    ctx.moveTo(cx + r * 0.5, cy - r * 0.5);
    ctx.lineTo(cx - r * 0.5, cy + r * 0.5);
    ctx.stroke();
  } else if (cat.includes('health')) {
    // Medical Shield with EKG Pulse
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.85, cy - r * 0.45);
    ctx.lineTo(cx + r * 0.65, cy + r * 0.45);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.65, cy + r * 0.45);
    ctx.lineTo(cx - r * 0.85, cy - r * 0.45);
    ctx.closePath();
    ctx.stroke();

    // Red EKG Pulse
    ctx.strokeStyle = '#ff3344';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy);
    ctx.lineTo(cx - r * 0.25, cy);
    ctx.lineTo(cx - r * 0.1, cy - r * 0.45);
    ctx.lineTo(cx + r * 0.1, cy + r * 0.45);
    ctx.lineTo(cx + r * 0.25, cy);
    ctx.lineTo(cx + r * 0.6, cy);
    ctx.stroke();
  } else if (cat.includes('hobby')) {
    // Precision Sniper Target Reticle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - r * 1.25, cy);
    ctx.lineTo(cx + r * 1.25, cy);
    ctx.moveTo(cx, cy - r * 1.25);
    ctx.lineTo(cx + r * 1.25, cy);
    ctx.stroke();
  } else if (cat.includes('bag') || cat === 'baggage') {
    // Military ALICE Survival Crate / Tactical Pack
    ctx.strokeRect(cx - r * 0.75, cy - r * 0.7, r * 1.5, r * 1.4);
    // Pockets
    ctx.strokeRect(cx - r * 0.6, cy - r * 0.1, r * 0.5, r * 0.6);
    ctx.strokeRect(cx + r * 0.1, cy - r * 0.1, r * 0.5, r * 0.6);
    // Top Flap
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.85, cy - r * 0.65);
    ctx.lineTo(cx + r * 0.85, cy - r * 0.65);
    ctx.lineTo(cx + r * 0.65, cy - r * 0.2);
    ctx.lineTo(cx - r * 0.65, cy - r * 0.2);
    ctx.closePath();
    ctx.stroke();
    // Vault-Tec Stencil Star
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VT-101', cx, cy - r * 0.35);
  } else if (cat.includes('fact')) {
    // Classified Dossier with Red "TOP SECRET" Stamp
    ctx.strokeRect(cx - r * 0.65, cy - r * 0.85, r * 1.3, r * 1.7);
    ctx.beginPath();
    // Document lines
    for (let dy = -0.45; dy <= 0.45; dy += 0.25) {
      ctx.moveTo(cx - r * 0.45, cy + r * dy);
      ctx.lineTo(cx + r * 0.45, cy + r * dy);
    }
    ctx.stroke();

    // Red Confidential Stamp
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.25);
    ctx.strokeStyle = '#ff2222';
    ctx.fillStyle = '#ff2222';
    ctx.lineWidth = 3;
    ctx.strokeRect(-r * 0.65, -16, r * 1.3, 32);
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('СЕКРЕТНО', 0, 0);
    ctx.restore();
  } else if (cat.includes('bio') || cat === 'biology') {
    // DNA Double Helix Spiral
    ctx.beginPath();
    for (let t = -r; t <= r; t += 4) {
      const sin1 = Math.sin(t * 0.12) * r * 0.65;
      const sin2 = -sin1;
      ctx.arc(cx + sin1, cy + t, 3, 0, Math.PI * 2);
      ctx.arc(cx + sin2, cy + t, 3, 0, Math.PI * 2);
    }
    ctx.fill();
    // Rungs
    ctx.beginPath();
    for (let t = -r + 10; t <= r - 10; t += 18) {
      const sin1 = Math.sin(t * 0.12) * r * 0.65;
      ctx.moveTo(cx + sin1, cy + t);
      ctx.lineTo(cx - sin1, cy + t);
    }
    ctx.stroke();
  } else {
    // Special: Nuclear Radiation Trefoil in Gold Vault Star
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const x = cx + Math.cos(a) * r * 1.1;
      const y = cy + Math.sin(a) * r * 1.1;
      const a2 = a + Math.PI / 5;
      const x2 = cx + Math.cos(a2) * r * 0.5;
      const y2 = cy + Math.sin(a2) * r * 0.5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.stroke();

    // Central Radiation Trefoil
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    for (let b = 0; b < 3; b++) {
      const bAng = (b * Math.PI * 2) / 3 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, bAng - 0.45, bAng + 0.45);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

export function createCardFrontTexture(category = 'profession', text = 'Хирург', icon = '', description = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 620;
  const ctx = canvas.getContext('2d');

  // 1. Vault terminal aged cardstock background
  ctx.fillStyle = '#080c09';
  ctx.fillRect(0, 0, 440, 620);

  // Subtle phosphor green-amber gradient glow
  const grad = ctx.createRadialGradient(220, 240, 40, 220, 240, 320);
  grad.addColorStop(0, 'rgba(212, 160, 23, 0.12)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 440, 620);

  // CRT Scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  for (let y = 0; y < 620; y += 4) {
    ctx.fillRect(0, y, 440, 2);
  }

  // Heavy Vault-Tec Double Border
  ctx.strokeStyle = '#d4a017';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 412, 592);

  ctx.strokeStyle = 'rgba(212, 160, 23, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 392, 572);

  // Corner brackets
  ctx.fillStyle = '#d4a017';
  const cSize = 22;
  ctx.fillRect(14, 14, cSize, 6);
  ctx.fillRect(14, 14, 6, cSize);
  ctx.fillRect(440 - 14 - cSize, 14, cSize, 6);
  ctx.fillRect(440 - 20, 14, 6, cSize);
  ctx.fillRect(14, 620 - 20, cSize, 6);
  ctx.fillRect(14, 620 - 14 - cSize, 6, cSize);
  ctx.fillRect(440 - 14 - cSize, 620 - 20, cSize, 6);
  ctx.fillRect(440 - 20, 620 - 14 - cSize, 6, cSize);

  // 2. Header Banner: VAULT-TEC // REQUISITION DOSSIER
  ctx.fillStyle = 'rgba(212, 160, 23, 0.22)';
  ctx.fillRect(28, 28, 384, 52);

  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#d4a017';
  ctx.textAlign = 'center';
  ctx.fillText('★ VAULT-TEC CORP // DOSSIER DECK ★', 220, 44);

  const catNames = {
    profession: 'ПРОФЕССИЯ',
    health: 'ЗДОРОВЬЕ',
    hobby: 'ХОББИ',
    baggage: 'БАГАЖ',
    fact: 'ФАКТ',
    biology: 'БИОЛОГИЯ',
    special: 'СПЕЦИАЛЬНАЯ КАРТА',
  };
  const catLabel = catNames[category.toLowerCase()] || category.toUpperCase();
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#ffea66';
  ctx.fillText(`[ ${catLabel} ]`, 220, 68);

  // 3. Central Procedural Vault-Tec Vector Badge (Zero Emojis!)
  drawVaultTecBadge(ctx, category, 220, 175, 52);

  // 4. Card Title / Text Box
  ctx.strokeStyle = '#d4a017';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 252, 368, 140);
  ctx.fillStyle = 'rgba(15, 20, 15, 0.9)';
  ctx.fillRect(38, 254, 364, 136);

  ctx.fillStyle = '#ffea66';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const words = (text || '—').split(' ');
  let line = '';
  let textY = 270;
  const maxWidth = 340;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, 220, textY);
      line = words[i] + ' ';
      textY += 32;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 220, textY);

  // 5. Card Description / Lore Box
  if (description) {
    ctx.fillStyle = 'rgba(212, 160, 23, 0.12)';
    ctx.fillRect(36, 404, 368, 120);
    ctx.strokeStyle = 'rgba(212, 160, 23, 0.5)';
    ctx.strokeRect(36, 404, 368, 120);

    ctx.fillStyle = 'rgba(240, 220, 160, 0.92)';
    ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const descWords = description.split(' ');
    let descLine = '';
    let descY = 416;
    for (let i = 0; i < descWords.length; i++) {
      const test = descLine + descWords[i] + ' ';
      if (ctx.measureText(test).width > 340 && i > 0) {
        ctx.fillText(descLine, 220, descY);
        descLine = descWords[i] + ' ';
        descY += 22;
      } else {
        descLine = test;
      }
    }
    ctx.fillText(descLine, 220, descY);
  }

  // 6. Footer: Technical Barcode & Security Stencil
  ctx.fillStyle = '#d4a017';
  for (let bx = 45; bx < 200; bx += Math.floor(Math.random() * 5 + 4)) {
    ctx.fillRect(bx, 542, 2, 28);
  }

  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`ID: VT-${Math.abs(text.length * 37 % 9999 + 1000)}`, 395, 555);
  ctx.fillText('AUTH: VAULT-TEC PROTOCOL', 395, 570);

  return new THREE.CanvasTexture(canvas);
}

// Hazard Warning Tape Texture
export function createHazardStripTexture(w = 512, h = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const stripeW = h * 0.8;
  for (let x = -h; x < w + h; x += stripeW) {
    ctx.fillStyle = '#e6a817';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW / 2, 0);
    ctx.lineTo(x + stripeW / 2 - h, h);
    ctx.lineTo(x - h, h);
    ctx.fill();

    ctx.fillStyle = '#141416';
    ctx.beginPath();
    ctx.moveTo(x + stripeW / 2, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - h, h);
    ctx.lineTo(x + stripeW / 2 - h, h);
    ctx.fill();
  }

  // Grime & edge shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, w, 3);
  ctx.fillRect(0, h - 3, w, 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createScreenTexture(title = 'CATASTROPHE', subtitle = 'ANALYSIS IN PROGRESS...') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  // CRT Green/Amber terminal
  ctx.fillStyle = '#061008';
  ctx.fillRect(0, 0, 512, 384);

  // Scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  for (let y = 0; y < 384; y += 4) {
    ctx.fillRect(0, y, 512, 2);
  }

  // Border
  ctx.strokeStyle = '#33ff66';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 488, 360);

  ctx.fillStyle = '#33ff66';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ROBCO INDUSTRIES (TM) TERMINAL', 256, 50);

  ctx.strokeStyle = '#33ff66';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 70);
  ctx.lineTo(482, 70);
  ctx.stroke();

  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = '#55ff88';
  ctx.fillText(title, 256, 150);

  ctx.font = '18px monospace';
  ctx.fillStyle = '#88ffaa';
  ctx.fillText(subtitle, 256, 210);

  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(51, 255, 102, 0.6)';
  ctx.fillText('VAULT PROTOCOL 101 // STANDBY', 256, 330);

  return new THREE.CanvasTexture(canvas);
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional Fallout Bunker Prop Textures (Mainframe, Breaker Box, First Aid)
// ─────────────────────────────────────────────────────────────────────────────

export function createMainframeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Dark industrial steel rack chassis
  ctx.fillStyle = '#121417';
  ctx.fillRect(0, 0, 512, 1024);

  // Horizontal rack unit dividers
  ctx.strokeStyle = '#252930';
  ctx.lineWidth = 4;
  for (let y = 0; y < 1024; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Upper Section: CRT Diagnostic Oscilloscope
  ctx.fillStyle = '#0a100c';
  ctx.fillRect(40, 40, 432, 220);
  ctx.strokeStyle = '#33ff66';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, 432, 220);

  // Oscilloscope grid
  ctx.strokeStyle = 'rgba(51, 255, 102, 0.2)';
  ctx.lineWidth = 1;
  for (let gx = 60; gx < 470; gx += 30) {
    ctx.beginPath();
    ctx.moveTo(gx, 40);
    ctx.lineTo(gx, 260);
    ctx.stroke();
  }
  for (let gy = 60; gy < 260; gy += 25) {
    ctx.beginPath();
    ctx.moveTo(40, gy);
    ctx.lineTo(472, gy);
    ctx.stroke();
  }

  // Green sine waveform
  ctx.strokeStyle = '#55ff88';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 40; x <= 472; x += 2) {
    const y = 150 + Math.sin((x - 40) * 0.045) * 35 + Math.sin((x - 40) * 0.12) * 12;
    if (x === 40) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#33ff66';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('ROBCO MAINFRAME // V8.4', 55, 70);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#88ffaa';
  ctx.fillText('CORE: OPTIMAL | AIR: 99.4% | SYS: ONLINE', 55, 245);

  // Middle Section: Magnetic Tape Deck Panel Face
  ctx.fillStyle = '#1a1e24';
  ctx.fillRect(40, 300, 432, 340);
  ctx.strokeStyle = '#3a424e';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 300, 432, 340);

  // Reel hub backings
  ctx.fillStyle = '#0e1014';
  ctx.beginPath();
  ctx.arc(150, 470, 85, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(362, 470, 85, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d4a017';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MAGNETIC STORAGE BANK A', 256, 335);

  // Lower Section: Status Indicator Arrays and Ventilation Louvers
  ctx.fillStyle = '#16191f';
  ctx.fillRect(40, 680, 432, 300);
  ctx.strokeStyle = '#2a303c';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 680, 432, 300);

  // Louver cooling slots
  ctx.fillStyle = '#080a0c';
  for (let ly = 720; ly < 950; ly += 14) {
    ctx.fillRect(60, ly, 392, 6);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createBreakerBoxTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Heavy steel enclosure
  ctx.fillStyle = '#22252a';
  ctx.fillRect(0, 0, 512, 512);

  // Beveled door rim
  ctx.strokeStyle = '#14161a';
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 496, 496);

  // Yellow Warning Triangle: DANGER HIGH VOLTAGE
  const tx = 256, ty = 140, ts = 110;
  ctx.fillStyle = '#e6a817';
  ctx.beginPath();
  ctx.moveTo(tx, ty - ts);
  ctx.lineTo(tx + ts * 1.15, ty + ts * 0.8);
  ctx.lineTo(tx - ts * 1.15, ty + ts * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 10;
  ctx.stroke();

  // Lightning Bolt Symbol
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.moveTo(tx - 6, ty - 60);
  ctx.lineTo(tx + 22, ty - 60);
  ctx.lineTo(tx - 2, ty + 10);
  ctx.lineTo(tx + 28, ty + 10);
  ctx.lineTo(tx - 20, ty + 70);
  ctx.lineTo(tx - 6, ty + 20);
  ctx.lineTo(tx - 26, ty + 20);
  ctx.closePath();
  ctx.fill();

  // Text warnings
  ctx.fillStyle = '#e6a817';
  ctx.font = 'bold 28px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DANGER // 10,000 VOLTS', 256, 280);
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#cad2dc';
  ctx.fillText('VAULT-TEC SUBSTATION 04 - PRIMARY BUS', 256, 310);
  ctx.fillStyle = '#e24432';
  ctx.fillText('AUTHORIZED PERSONNEL ONLY', 256, 335);

  // Circuit breaker toggle slots chart
  ctx.fillStyle = '#111418';
  ctx.fillRect(60, 360, 392, 110);
  ctx.strokeStyle = '#444c58';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 360, 392, 110);

  ctx.fillStyle = '#88a0b8';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('01: VAULT DOOR DRIVE [ON]', 80, 390);
  ctx.fillText('02: LIFE SUPPORT AIR [ON]', 80, 415);
  ctx.fillText('03: WATER PURIFIER   [ON]', 80, 440);
  ctx.fillText('04: AUX EMERGENCY   [STBY]', 270, 390);
  ctx.fillText('05: PERIMETER GRID  [ON]', 270, 415);
  ctx.fillText('06: OVERSEER UPLINK [ON]', 270, 440);

  return new THREE.CanvasTexture(canvas);
}

export function createFirstAidTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Enamel off-white cabinet
  ctx.fillStyle = '#e8ecef';
  ctx.fillRect(0, 0, 256, 256);

  // Border frame
  ctx.strokeStyle = '#c5ccd4';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 246);

  // Red Cross
  ctx.fillStyle = '#d2281e';
  ctx.fillRect(106, 40, 44, 120);
  ctx.fillRect(68, 78, 120, 44);

  // Text
  ctx.fillStyle = '#1a3250';
  ctx.font = 'bold 20px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VAULT-TEC', 128, 195);
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#d2281e';
  ctx.fillText('EMERGENCY FIRST AID', 128, 220);

  return new THREE.CanvasTexture(canvas);
}
