import * as THREE from 'three';
import {
  createConcreteTexture,
  createRustyMetalTexture,
  createGearDoorTexture,
  createWastelandDoorTexture,
  createPosterTexture,
  createScreenTexture,
  createHazardStripTexture,
  createMainframeTexture,
  createBreakerBoxTexture,
  createFirstAidTexture,
} from './textures.js';

export const BUNKER_THEMES = {
  fallout: {
    id: 'fallout',
    name: 'Убежище Vault-Tec',
    background: 0x1a1e26,
    fogColor: 0x1a1e26,
    fogDensity: 0.011,
    exposure: 1.25,
    ambientColor: 0x526074,
    ambientIntensity: 0.48,
    hemiSky: 0x8fa4be,
    hemiGround: 0x5a4e42,
    hemiIntensity: 0.65,
    mainLightColor: 0xffbe66,
    mainLightIntensity: 2.3,
    spotColor: 0xffe099,
    spotIntensity: 1.8,
    cornerLightColor: 0x8ea0b5,
    cornerLightIntensity: 0.55,
    redBeaconColor: 0xff2200,
    greenBeaconColor: 0x33ff66,
    terminalTitle: 'ROBCO PROTOCOL',
    terminalSubtitle: 'STANDBY // READY',
  },
  resident_evil: {
    id: 'resident_evil',
    name: 'Лаборатория Umbrella',
    background: 0x0d151c,
    fogColor: 0x0d151c,
    fogDensity: 0.014,
    exposure: 1.2,
    ambientColor: 0x3b586b,
    ambientIntensity: 0.45,
    hemiSky: 0x7ab8d6,
    hemiGround: 0x26323c,
    hemiIntensity: 0.6,
    mainLightColor: 0xbfe8ff,
    mainLightIntensity: 2.2,
    spotColor: 0xdff5ff,
    spotIntensity: 1.9,
    cornerLightColor: 0x22d3ee,
    cornerLightIntensity: 0.6,
    redBeaconColor: 0xff1e38,
    greenBeaconColor: 0x22ff99,
    terminalTitle: 'UMBRELLA BIO-OS',
    terminalSubtitle: 'CONTAINMENT // NOMINAL',
  },
  sao: {
    id: 'sao',
    name: 'Зал Гильдии Айнкрад',
    background: 0x121622,
    fogColor: 0x121622,
    fogDensity: 0.012,
    exposure: 1.22,
    ambientColor: 0x4b5a78,
    ambientIntensity: 0.5,
    hemiSky: 0x8aa8d8,
    hemiGround: 0x3c342e,
    hemiIntensity: 0.65,
    mainLightColor: 0xd8ecff,
    mainLightIntensity: 2.25,
    spotColor: 0x99e2ff,
    spotIntensity: 1.85,
    cornerLightColor: 0x38bdf8,
    cornerLightIntensity: 0.65,
    redBeaconColor: 0xff4444,
    greenBeaconColor: 0x38bdf8,
    terminalTitle: 'CARDINAL SYSTEM',
    terminalSubtitle: 'FLOOR 75 // GUILD HALL',
  },
  rezero: {
    id: 'rezero',
    name: 'Библиотека Розвааля',
    background: 0x1b1210,
    fogColor: 0x1b1210,
    fogDensity: 0.012,
    exposure: 1.25,
    ambientColor: 0x6b4c3b,
    ambientIntensity: 0.52,
    hemiSky: 0xd8a878,
    hemiGround: 0x40261c,
    hemiIntensity: 0.68,
    mainLightColor: 0xffb35c,
    mainLightIntensity: 2.35,
    spotColor: 0xffd28a,
    spotIntensity: 1.8,
    cornerLightColor: 0xff9442,
    cornerLightIntensity: 0.6,
    redBeaconColor: 0xdc2626,
    greenBeaconColor: 0xfbbf24,
    terminalTitle: 'SANCTUARY TOME',
    terminalSubtitle: 'ARCHIVE // SEALED',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Берлога Нетраннера',
    background: 0x0b0d17,
    fogColor: 0x0b0d17,
    fogDensity: 0.015,
    exposure: 1.28,
    ambientColor: 0x3b3560,
    ambientIntensity: 0.45,
    hemiSky: 0x54d8ff,
    hemiGround: 0x38143c,
    hemiIntensity: 0.62,
    mainLightColor: 0xa8f0ff,
    mainLightIntensity: 2.15,
    spotColor: 0x66e8ff,
    spotIntensity: 1.85,
    cornerLightColor: 0xf43f9e,
    cornerLightIntensity: 0.72,
    redBeaconColor: 0xff1177,
    greenBeaconColor: 0x00ffcc,
    terminalTitle: 'NETWATCH ICE v9',
    terminalSubtitle: 'JACKED IN // ACTIVE',
  },
};

export function normalizeThemeId(themeId) {
  return BUNKER_THEMES[themeId] ? themeId : 'fallout';
}

// ─────────────────────────────────────────────────────────────────────────────
// Procedural Canvas Textures for New Themes
// ─────────────────────────────────────────────────────────────────────────────
function createCanvasTex(w, h, drawFn, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function createUmbrellaEmblemTexture() {
  return createCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#141a21';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const r = 190;
    for (let i = 0; i < 8; i++) {
      const a0 = (i * Math.PI) / 4 - Math.PI / 8;
      const a1 = a0 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#e5e7eb';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 6;
    ctx.stroke();
  });
}

function createLabPanelTexture() {
  return createCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1c242d';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2d3947';
    ctx.lineWidth = 4;
    for (let x = 0; x <= w; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#384656';
    for (let x = 16; x < w; x += 128) {
      for (let y = 16; y < h; y += 128) {
        ctx.fillRect(x, y, 6, 6);
        ctx.fillRect(x + 90, y, 6, 6);
      }
    }
  }, 4, 2);
}

function createStoneWallTexture() {
  return createCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#232834';
    ctx.fillRect(0, 0, w, h);
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * 48;
      for (let x = -48; x < w; x += 96) {
        const shade = 32 + ((r * 13 + x * 7) % 16);
        ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 12})`;
        ctx.fillRect(x + offset + 2, r * rh + 2, 92, rh - 4);
      }
    }
  }, 3, 2);
}

function createMahoganyTexture() {
  return createCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#3a1d14';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      ctx.fillStyle = y % 12 === 0 ? 'rgba(20, 8, 4, 0.28)' : 'rgba(95, 45, 25, 0.16)';
      ctx.fillRect(0, y, w, 3);
    }
    ctx.strokeStyle = '#24100a';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, w - 24, h - 24);
  }, 3, 2);
}

function createWetConcreteTexture() {
  return createCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#14161e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      const x = (i * 73) % w;
      const y = (i * 137) % h;
      const sz = 6 + (i % 18);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(38, 44, 58, 0.25)' : 'rgba(10, 12, 18, 0.35)';
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.strokeStyle = '#1e222e';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }, 4, 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Structural & Fixture Helpers
// ─────────────────────────────────────────────────────────────────────────────
function addVolumetricCone(parent, color, radiusTop, radiusBottom, height, yOffset, opacity = 0.08) {
  const coneGeo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = yOffset;
  parent.add(cone);
  return cone;
}

function addWallRibs(group, roomWidth, roomLength, roomHeight, ribMat, accentMat) {
  const positions = [-3.2, -1.6, 1.6, 3.2];
  positions.forEach(p => {
    // East & West ribs
    [-roomWidth / 2 + 0.08, roomWidth / 2 - 0.08].forEach(wx => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.14, roomHeight, 0.18), ribMat);
      rib.position.set(wx, roomHeight / 2, p);
      group.add(rib);
      if (accentMat) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, roomHeight - 0.4, 0.05), accentMat);
        strip.position.set(wx + (wx < 0 ? 0.075 : -0.075), roomHeight / 2, p);
        group.add(strip);
      }
    });
  });

  // Corner structural columns
  [-roomWidth / 2 + 0.16, roomWidth / 2 - 0.16].forEach(x => {
    [-roomLength / 2 + 0.16, roomLength / 2 - 0.16].forEach(z => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.36, roomHeight, 0.36), ribMat);
      col.position.set(x, roomHeight / 2, z);
      group.add(col);
    });
  });

  // Ceiling transverse beams
  [-3.2, -1.6, 0, 1.6, 3.2].forEach(z => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.24, 0.22), ribMat);
    beam.position.set(0, roomHeight - 0.12, z);
    group.add(beam);
  });
}

function addWallSconces(group, lightColor, frameColor, lensColor, emissiveColor, style = 'industrial') {
  const wallSconces = [
    { pos: [-3.2, 2.4, -4.94], rotY: 0 },
    { pos: [3.2, 2.4, -4.94], rotY: 0 },
    { pos: [4.94, 2.4, -2.6], rotY: -Math.PI / 2 },
    { pos: [4.94, 2.4, 2.6], rotY: -Math.PI / 2 },
    { pos: [-4.94, 2.4, -2.6], rotY: Math.PI / 2 },
    { pos: [-4.94, 2.4, 2.6], rotY: Math.PI / 2 },
    { pos: [-3.2, 2.4, 4.94], rotY: Math.PI },
    { pos: [3.2, 2.4, 4.94], rotY: Math.PI },
  ];

  const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.85, roughness: 0.35 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: lensColor,
    emissive: emissiveColor,
    emissiveIntensity: 1.45,
    roughness: 0.2,
    transparent: true,
    opacity: 0.92,
  });

  wallSconces.forEach(({ pos: [wx, wy, wz], rotY }) => {
    const sg = new THREE.Group();
    sg.position.set(wx, wy, wz);
    sg.rotation.y = rotY;

    if (style === 'crystal') {
      const bracket = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.22, 6), frameMat);
      bracket.rotation.x = Math.PI;
      bracket.position.set(0, -0.08, 0.08);
      sg.add(bracket);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), lensMat);
      crystal.scale.set(0.8, 1.6, 0.8);
      crystal.position.set(0, 0.12, 0.09);
      sg.add(crystal);
    } else if (style === 'candle') {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12), frameMat);
      plate.rotation.x = Math.PI / 2;
      plate.position.set(0, -0.05, 0.02);
      sg.add(plate);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.16, 8), frameMat);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(0, -0.04, 0.09);
      sg.add(arm);
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xf5ebd6, roughness: 0.7 }));
      wax.position.set(0, 0.05, 0.15);
      sg.add(wax);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.055, 8), lensMat);
      flame.position.set(0, 0.16, 0.15);
      sg.add(flame);
    } else if (style === 'neon') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.04), lensMat);
      bar.position.set(0, 0, 0.04);
      sg.add(bar);
      const capT = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.06), frameMat);
      capT.position.set(0, 0.34, 0.04);
      sg.add(capT);
      const capB = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.06), frameMat);
      capB.position.set(0, -0.34, 0.04);
      sg.add(capB);
    } else {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.04), frameMat);
      plate.position.set(0, 0, 0.02);
      sg.add(plate);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.06), lensMat);
      lens.position.set(0, 0, 0.07);
      sg.add(lens);
      const barGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.16, 8);
      barGeo.rotateZ(Math.PI / 2);
      [-0.08, 0, 0.08].forEach(by => {
        const b = new THREE.Mesh(barGeo, frameMat);
        b.position.set(0, by, 0.11);
        sg.add(b);
      });
    }

    const pLight = new THREE.PointLight(lightColor, 1.35, 7.5, 1.15);
    pLight.position.set(0, 0, 0.22);
    sg.add(pLight);
    group.add(sg);
  });
}

function addTerminalConsole(group, roomWidth, title, subtitle, frameColor, accentColor) {
  const termGeo = new THREE.BoxGeometry(0.14, 0.85, 1.25);
  const termMat = new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.75, roughness: 0.35 });
  const terminalBox = new THREE.Mesh(termGeo, termMat);
  terminalBox.position.set(roomWidth / 2 - 0.08, 2.1, 0);

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.92, 1.32),
    new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.85, roughness: 0.25 })
  );
  bezel.position.set(-0.04, 0, 0);
  terminalBox.add(bezel);

  const screenTex = createScreenTexture(title, subtitle);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
  const terminalMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), screenMat);
  terminalMesh.position.set(-0.08, 0, 0);
  terminalMesh.rotation.y = -Math.PI / 2;
  terminalBox.add(terminalMesh);

  group.add(terminalBox);
  return terminalMesh;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Chair Builder
// ─────────────────────────────────────────────────────────────────────────────
export function createThemedChair(themeId, x, z) {
  const id = normalizeThemeId(themeId);
  const chairGroup = new THREE.Group();

  const palettes = {
    fallout: { frame: 0x30333a, accent: 0x9ba4b0, cushion: 0x2c2f36, metal: 0.85 },
    resident_evil: { frame: 0x1e293b, accent: 0x94a3b8, cushion: 0x0f172a, metal: 0.9 },
    sao: { frame: 0x2a2420, accent: 0x64748b, cushion: 0x1e293b, metal: 0.6 },
    rezero: { frame: 0x3f1d14, accent: 0xd4a017, cushion: 0x6d1422, metal: 0.3 },
    cyberpunk: { frame: 0x11131a, accent: 0x22d3ee, cushion: 0x1f2433, metal: 0.85 },
  };
  const pal = palettes[id];
  const frameMat = new THREE.MeshStandardMaterial({ color: pal.frame, metalness: pal.metal, roughness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: pal.accent,
    metalness: 0.85,
    roughness: 0.25,
    emissive: id === 'cyberpunk' ? 0x0891b2 : 0x000000,
    emissiveIntensity: id === 'cyberpunk' ? 0.5 : 0,
  });
  const cushionMat = new THREE.MeshStandardMaterial({ color: pal.cushion, roughness: 0.72, metalness: 0.12 });

  if (id === 'rezero' || id === 'sao') {
    // 4-leg carved wood / gothic iron dining chair
    const legGeo = new THREE.CylinderGeometry(0.025, 0.018, 0.48, 8);
    [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(lx, 0.24, lz);
      chairGroup.add(leg);
    });
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.44), frameMat);
    seatBase.position.y = 0.48;
    chairGroup.add(seatBase);
    const seatPad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.40), cushionMat);
    seatPad.position.y = 0.52;
    chairGroup.add(seatPad);
    [-0.18, 0.18].forEach(px => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.52, 8), frameMat);
      post.position.set(px, 0.74, -0.20);
      chairGroup.add(post);
    });
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.05), cushionMat);
    backPanel.position.set(0, 0.82, -0.20);
    chairGroup.add(backPanel);
    const finial = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.06), accentMat);
    finial.position.set(0, 1.01, -0.20);
    chairGroup.add(finial);
  } else {
    // Swivel / tactical / cyber chair
    const starBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.04, 5), frameMat);
    starBase.position.y = 0.03;
    chairGroup.add(starBase);
    for (let c = 0; c < 5; c++) {
      const cAngle = (c * Math.PI * 2) / 5;
      const caster = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), frameMat);
      caster.position.set(Math.cos(cAngle) * 0.30, 0.025, Math.sin(cAngle) * 0.30);
      chairGroup.add(caster);
    }
    const hydraulic = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.46, 16), accentMat);
    hydraulic.position.y = 0.26;
    chairGroup.add(hydraulic);
    const seatPad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.07, 24), cushionMat);
    seatPad.position.y = 0.52;
    chairGroup.add(seatPad);
    const seatPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 24), frameMat);
    seatPlate.position.y = 0.48;
    chairGroup.add(seatPlate);
    [-0.14, 0.14].forEach(px => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 12), accentMat);
      post.position.set(px, 0.69, -0.20);
      chairGroup.add(post);
    });
    const backCushion = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.06), cushionMat);
    backCushion.position.set(0, 0.83, -0.19);
    chairGroup.add(backCushion);
    [-0.24, 0.24].forEach(side => {
      const armUpright = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.20, 10), accentMat);
      armUpright.position.set(side, 0.60, 0.02);
      chairGroup.add(armUpright);
      const armPad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.24), cushionMat);
      armPad.position.set(side, 0.70, 0.04);
      chairGroup.add(armPad);
    });
  }

  const targetAngle = Math.atan2(-x, -z);
  chairGroup.position.set(x, 0, z);
  chairGroup.rotation.y = targetAngle;
  return chairGroup;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Theme Builder
// ─────────────────────────────────────────────────────────────────────────────
export function buildBunkerTheme({ themeId, envGroup, tableGroup, metalTex, concreteTex }) {
  const id = normalizeThemeId(themeId);
  const cfg = BUNKER_THEMES[id];
  const refs = {
    flickerLight: null,
    redBeacon: null,
    greenBeacon: null,
    gearDoorGroup: null,
    wastelandDoorGroup: null,
    terminalMesh: null,
    tapeReels: [],
    mainframeLeds: [],
    animatedProps: [],
  };

  const roomWidth = 10;
  const roomLength = 10;
  const roomHeight = 3.8;

  // 1. Common Lights
  envGroup.add(new THREE.AmbientLight(cfg.ambientColor, cfg.ambientIntensity));
  envGroup.add(new THREE.HemisphereLight(cfg.hemiSky, cfg.hemiGround, cfg.hemiIntensity));

  const lampPos = new THREE.Vector3(0, 2.55, 0);
  refs.flickerLight = new THREE.PointLight(cfg.mainLightColor, cfg.mainLightIntensity, 11.5, 1.1);
  refs.flickerLight.position.copy(lampPos);
  refs.flickerLight.castShadow = true;
  refs.flickerLight.shadow.mapSize.set(2048, 2048);
  refs.flickerLight.shadow.bias = -0.001;
  envGroup.add(refs.flickerLight);

  const spot = new THREE.SpotLight(cfg.spotColor, cfg.spotIntensity, 9, Math.PI / 3.2, 0.45);
  spot.position.copy(lampPos);
  spot.target.position.set(0, 0.75, 0);
  envGroup.add(spot);
  envGroup.add(spot.target);

  const keyLight = new THREE.DirectionalLight(0xd8e4f0, 0.52);
  keyLight.position.set(2.0, 3.5, 2.0);
  keyLight.target.position.set(0, 0.75, 0);
  envGroup.add(keyLight);
  envGroup.add(keyLight.target);

  const fillLight = new THREE.DirectionalLight(0xcfd8e6, 0.4);
  fillLight.position.set(-2.5, 3.2, -2.0);
  fillLight.target.position.set(0, 0.75, 0);
  envGroup.add(fillLight);
  envGroup.add(fillLight.target);

  [[-4.0, 2.0, -4.0], [4.0, 2.0, -4.0], [-4.0, 2.0, 4.0], [4.0, 2.0, 4.0]].forEach(([cx, cy, cz]) => {
    const cl = new THREE.PointLight(cfg.cornerLightColor, cfg.cornerLightIntensity, 6.8, 1.2);
    cl.position.set(cx, cy, cz);
    envGroup.add(cl);
  });

  refs.redBeacon = new THREE.PointLight(cfg.redBeaconColor, 0.9, 6);
  refs.redBeacon.position.set(0, 2.7, 4.2);
  envGroup.add(refs.redBeacon);

  refs.greenBeacon = new THREE.PointLight(cfg.greenBeaconColor, 1.4, 7);
  refs.greenBeacon.position.set(0, 2.9, -4.2);
  envGroup.add(refs.greenBeacon);

  // 2. Room Shell Builder Helper
  const buildShell = (floorMat, wallMat, ceilMat) => {
    const floorGeo = new THREE.PlaneGeometry(roomWidth, roomLength);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    envGroup.add(floor);

    const ceil = new THREE.Mesh(floorGeo, ceilMat);
    ceil.position.y = roomHeight;
    ceil.rotation.x = Math.PI / 2;
    envGroup.add(ceil);

    const walls = [
      { pos: [0, roomHeight / 2, -roomLength / 2], rotY: 0 },
      { pos: [0, roomHeight / 2, roomLength / 2], rotY: Math.PI },
      { pos: [roomWidth / 2, roomHeight / 2, 0], rotY: -Math.PI / 2 },
      { pos: [-roomWidth / 2, roomHeight / 2, 0], rotY: Math.PI / 2 },
    ];
    walls.forEach(({ pos, rotY }) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat);
      w.position.set(...pos);
      w.rotation.y = rotY;
      w.receiveShadow = true;
      envGroup.add(w);
    });
  };

  // 3. Central Hanging Fixture
  const buildCentralLamp = (shadeColor, bulbColor, hasCone = true) => {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(0, 2.75, 0);
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.3 });
    [-0.12, 0.12].forEach(cx => {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 8), chainMat);
      ch.position.set(cx, 0.45, 0);
      lampGroup.add(ch);
    });
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.44, 0.22, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: shadeColor, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide })
    );
    lampGroup.add(shade);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshStandardMaterial({ color: bulbColor, emissive: bulbColor, emissiveIntensity: 1.8, roughness: 0.1 })
    );
    bulb.position.set(0, -0.06, 0);
    lampGroup.add(bulb);
    if (hasCone) {
      addVolumetricCone(lampGroup, bulbColor, 0.18, 1.35, 2.0, -1.05, 0.055);
    }
    envGroup.add(lampGroup);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Theme-Specific Builders
  // ───────────────────────────────────────────────────────────────────────────
  if (id === 'fallout') {
    metalTex.repeat.set(5, 5);
    concreteTex.repeat.set(3, 1.5);
    buildShell(
      new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.5, metalness: 0.65 }),
      new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.85, metalness: 0.15 }),
      new THREE.MeshStandardMaterial({ color: 0x323740, roughness: 0.8 })
    );
    buildCentralLamp(0x2a3228, 0xffaa33, true);
    addWallSconces(envGroup, 0xffaa44, 0x282522, 0xffaa44, 0xff9922, 'industrial');

    const beamMat = new THREE.MeshStandardMaterial({ color: 0x34373d, metalness: 0.8, roughness: 0.35 });
    addWallRibs(envGroup, roomWidth, roomLength, roomHeight, beamMat, null);

    // Hazard wainscoting
    const wainscotMat = new THREE.MeshStandardMaterial({ color: 0x2d323b, metalness: 0.7, roughness: 0.45 });
    const hazardTex = createHazardStripTexture(512, 64);
    hazardTex.repeat.set(8, 1);
    const hazardBorderMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5 });
    [
      [roomWidth, 0, -roomLength / 2 + 0.01, 0],
      [roomWidth, 0, roomLength / 2 - 0.01, Math.PI],
      [roomLength, roomWidth / 2 - 0.01, 0, -Math.PI / 2],
      [roomLength, -roomWidth / 2 + 0.01, 0, Math.PI / 2],
    ].forEach(([len, px, pz, ry]) => {
      const pg = new THREE.Group();
      pg.position.set(px, 0, pz);
      pg.rotation.y = ry;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(len, 1.15, 0.05), wainscotMat);
      plate.position.set(0, 0.575, 0.025);
      pg.add(plate);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.08), hazardBorderMat);
      stripe.position.set(0, 1.08, 0.052);
      pg.add(stripe);
      envGroup.add(pg);
    });

    // Floor caution ring
    const ringTex = createHazardStripTexture(512, 64);
    ringTex.repeat.set(6, 1);
    const tableRing = new THREE.Mesh(
      new THREE.RingGeometry(2.35, 2.50, 32),
      new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.5 })
    );
    tableRing.position.set(0, 0.004, 0);
    tableRing.rotation.x = -Math.PI / 2;
    envGroup.add(tableRing);

    // RobCo Mainframe (West Wall)
    const mfGroup = new THREE.Group();
    mfGroup.position.set(-roomWidth / 2 + 0.35, 1.35, -1.8);
    mfGroup.rotation.y = Math.PI / 2;
    mfGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.55), new THREE.MeshStandardMaterial({ map: createMainframeTexture(), metalness: 0.65, roughness: 0.4 })));
    const reelMat = new THREE.MeshStandardMaterial({ color: 0xc4cdd8, metalness: 0.9, roughness: 0.2 });
    [-0.26, 0.26].forEach(rx => {
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 24), reelMat);
      reel.position.set(rx, 0.22, 0.29);
      reel.rotation.x = Math.PI / 2;
      mfGroup.add(reel);
      refs.tapeReels.push(reel);
    });
    const ledColors = [0x33ff66, 0xffaa22, 0xff3333, 0x33ff66, 0x33ccff];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        const lColor = ledColors[(r * 8 + c) % ledColors.length];
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), new THREE.MeshBasicMaterial({ color: lColor }));
        led.position.set(-0.35 + c * 0.10, -0.45 - r * 0.08, 0.29);
        mfGroup.add(led);
        refs.mainframeLeds.push({ mesh: led, baseColor: lColor });
      }
    }
    envGroup.add(mfGroup);

    // Breaker Box & First Aid & Posters & Oxygen Tanks
    const bbGroup = new THREE.Group();
    bbGroup.position.set(roomWidth / 2 - 0.22, 1.9, -1.8);
    bbGroup.rotation.y = -Math.PI / 2;
    bbGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.24), new THREE.MeshStandardMaterial({ map: createBreakerBoxTexture(), metalness: 0.65, roughness: 0.4 })));
    envGroup.add(bbGroup);

    const fa = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.14), new THREE.MeshStandardMaterial({ map: createFirstAidTexture(), roughness: 0.45 }));
    fa.position.set(-roomWidth / 2 + 0.10, 1.8, 1.6);
    fa.rotation.y = Math.PI / 2;
    envGroup.add(fa);

    [0, 1, 2].forEach((pType, idx) => {
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshStandardMaterial({ map: createPosterTexture(pType), roughness: 0.7 }));
      poster.position.set(roomWidth / 2 - 0.02, 2.1, -2.4 + idx * 2.4);
      poster.rotation.y = -Math.PI / 2;
      envGroup.add(poster);
    });

    // North Vault Gear Door
    refs.gearDoorGroup = new THREE.Group();
    refs.gearDoorGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), new THREE.MeshStandardMaterial({ map: createGearDoorTexture('101'), metalness: 0.55, roughness: 0.4 })));
    const frame = new THREE.Mesh(new THREE.RingGeometry(1.48, 1.75, 32), beamMat);
    frame.position.z = 0.02;
    refs.gearDoorGroup.add(frame);
    refs.gearDoorGroup.position.set(0, 1.8, -roomLength / 2 + 0.05);
    envGroup.add(refs.gearDoorGroup);

    // South Wasteland Door
    refs.wastelandDoorGroup = new THREE.Group();
    const wasteDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 0.12), new THREE.MeshStandardMaterial({ map: createWastelandDoorTexture(), metalness: 0.45, roughness: 0.55 }));
    wasteDoor.position.set(0, 1.35, 0);
    refs.wastelandDoorGroup.add(wasteDoor);
    refs.wastelandDoorGroup.position.set(0, 0, roomLength / 2 - 0.06);
    envGroup.add(refs.wastelandDoorGroup);

    refs.terminalMesh = addTerminalConsole(envGroup, roomWidth, cfg.terminalTitle, cfg.terminalSubtitle, 0x32302b, 0x4a505a);

    // Table
    buildRoundTable(tableGroup, {
      topMat: new THREE.MeshStandardMaterial({ map: metalTex, metalness: 0.75, roughness: 0.38 }),
      rimMat: new THREE.MeshStandardMaterial({ color: 0x343840, metalness: 0.85, roughness: 0.3 }),
      baseMat: new THREE.MeshStandardMaterial({ color: 0x2e2e2a, metalness: 0.85, roughness: 0.35 }),
      rivets: true,
    });
    // Fallout Table Props (Ashtray, Dosimeter, Mug)
    const ash = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.7, roughness: 0.5 }));
    ash.position.set(0.15, 0.79, -0.10);
    tableGroup.add(ash);
    const dosi = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.065, 0.12), new THREE.MeshStandardMaterial({ color: 0x826e32, metalness: 0.88, roughness: 0.28 }));
    dosi.position.set(-0.20, 0.80, 0.12);
    dosi.rotation.y = 0.5;
    tableGroup.add(dosi);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 16), new THREE.MeshStandardMaterial({ color: 0x244268, metalness: 0.6, roughness: 0.4 }));
    mug.position.set(-0.05, 0.82, -0.22);
    tableGroup.add(mug);
  } else if (id === 'resident_evil') {
    const labTex = createLabPanelTexture();
    buildShell(
      new THREE.MeshStandardMaterial({ color: 0x18222c, metalness: 0.65, roughness: 0.28 }),
      new THREE.MeshStandardMaterial({ map: labTex, metalness: 0.45, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x101820, metalness: 0.6, roughness: 0.5 })
    );
    buildCentralLamp(0x1e293b, 0xbfe8ff, true);
    addWallSconces(envGroup, 0x38bdf8, 0x1e293b, 0x7dd3fc, 0x0ea5e9, 'industrial');

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x24303e, metalness: 0.82, roughness: 0.3 });
    const cyanStripMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    addWallRibs(envGroup, roomWidth, roomLength, roomHeight, steelMat, cyanStripMat);

    // 4 Glowing Biohazard Cryo-Tubes in corners
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.2 });
    const bioCoreMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 1.3, roughness: 0.2 });
    [[-3.7, -3.7], [3.7, -3.7], [-3.7, 3.7], [3.7, 3.7]].forEach(([cx, cz], idx) => {
      const cryo = new THREE.Group();
      cryo.position.set(cx, 0, cz);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.50, 0.32, 20), steelMat);
      base.position.y = 0.16;
      cryo.add(base);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.45, 0.28, 20), steelMat);
      cap.position.y = 2.65;
      cryo.add(cap);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 2.2, 20), glassMat);
      tube.position.y = 1.42;
      cryo.add(tube);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 1.75, 14), bioCoreMat);
      core.position.y = 1.42;
      cryo.add(core);
      const cLight = new THREE.PointLight(idx % 2 === 0 ? 0x10b981 : 0x06b6d4, 1.1, 4.5);
      cLight.position.y = 1.4;
      cryo.add(cLight);
      refs.animatedProps.push({ type: 'cryo', mesh: core, phase: idx * 1.4 });
      envGroup.add(cryo);
    });

    // Herb / Containment Crates along West Wall
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x2b3b2e, metalness: 0.35, roughness: 0.65 });
    const herbMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x14532d, emissiveIntensity: 0.5 });
    [-1.4, 1.4].forEach(z => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.9), crateMat);
      crate.position.set(-roomWidth / 2 + 0.45, 0.3, z);
      envGroup.add(crate);
      const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12), herbMat);
      vial.position.set(-roomWidth / 2 + 0.45, 0.71, z);
      envGroup.add(vial);
    });

    // North Umbrella Blast Door
    refs.gearDoorGroup = new THREE.Group();
    refs.gearDoorGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshStandardMaterial({ map: createUmbrellaEmblemTexture(), metalness: 0.6, roughness: 0.35 })));
    const uFrame = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.68, 32), steelMat);
    uFrame.position.z = 0.02;
    refs.gearDoorGroup.add(uFrame);
    refs.gearDoorGroup.position.set(0, 1.75, -roomLength / 2 + 0.05);
    envGroup.add(refs.gearDoorGroup);

    // South Quarantine Airlock
    refs.wastelandDoorGroup = new THREE.Group();
    const qDoor = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.7, 0.14), steelMat);
    qDoor.position.set(0, 1.35, 0);
    refs.wastelandDoorGroup.add(qDoor);
    const bioStripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 }));
    bioStripe.position.set(0, 1.5, 0);
    refs.wastelandDoorGroup.add(bioStripe);
    refs.wastelandDoorGroup.position.set(0, 0, roomLength / 2 - 0.06);
    envGroup.add(refs.wastelandDoorGroup);

    refs.terminalMesh = addTerminalConsole(envGroup, roomWidth, cfg.terminalTitle, cfg.terminalSubtitle, 0x1e293b, 0x22d3ee);

    // Clinical Steel Table + T-Virus Vials
    buildRoundTable(tableGroup, {
      topMat: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.22 }),
      rimMat: new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.8, roughness: 0.25 }),
      baseMat: steelMat,
      rivets: false,
    });
    [0x22d3ee, 0x10b981, 0xef4444].forEach((vc, idx) => {
      const vial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.11, 12),
        new THREE.MeshStandardMaterial({ color: vc, emissive: vc, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 })
      );
      vial.position.set(-0.18 + idx * 0.08, 0.84, 0.12);
      tableGroup.add(vial);
    });
  } else if (id === 'sao') {
    const stoneTex = createStoneWallTexture();
    buildShell(
      new THREE.MeshStandardMaterial({ color: 0x1c202a, metalness: 0.4, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.85, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x151822, roughness: 0.8 })
    );
    buildCentralLamp(0x283244, 0x7dd3fc, true);
    addWallSconces(envGroup, 0x38bdf8, 0x475569, 0x7dd3fc, 0x0ea5e9, 'crystal');

    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2d3340, metalness: 0.82, roughness: 0.38 });
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.1 });
    addWallRibs(envGroup, roomWidth, roomLength, roomHeight, ironMat, crystalMat);

    // Wall Sword Racks (West & East Walls)
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.95, roughness: 0.15 });
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.4 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.9, roughness: 0.25 });
    [-2.0, 2.0].forEach(rz => {
      const rack = new THREE.Group();
      rack.position.set(-roomWidth / 2 + 0.12, 1.85, rz);
      rack.rotation.y = Math.PI / 2;
      rack.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.06), new THREE.MeshStandardMaterial({ color: 0x2c1b12, roughness: 0.7 })));
      [-0.22, 0.22].forEach(sy => {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.045, 0.015), bladeMat);
        blade.position.set(0.08, sy, 0.06);
        rack.add(blade);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.04), goldMat);
        guard.position.set(-0.38, sy, 0.06);
        rack.add(guard);
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), hiltMat);
        grip.rotation.z = Math.PI / 2;
        grip.position.set(-0.48, sy, 0.06);
        rack.add(grip);
      });
      envGroup.add(rack);
    });

    // North Gothic Guild Arch Door
    refs.gearDoorGroup = new THREE.Group();
    const archDoor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 0.18), ironMat);
    refs.gearDoorGroup.add(archDoor);
    const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), crystalMat);
    crest.scale.set(1, 1.4, 0.25);
    crest.position.set(0, 0.2, 0.12);
    refs.gearDoorGroup.add(crest);
    refs.gearDoorGroup.position.set(0, 1.5, -roomLength / 2 + 0.08);
    envGroup.add(refs.gearDoorGroup);

    // South Iron Gate
    refs.wastelandDoorGroup = new THREE.Group();
    const sGate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 0.14), ironMat);
    sGate.position.set(0, 1.35, 0);
    refs.wastelandDoorGroup.add(sGate);
    refs.wastelandDoorGroup.position.set(0, 0, roomLength / 2 - 0.06);
    envGroup.add(refs.wastelandDoorGroup);

    refs.terminalMesh = addTerminalConsole(envGroup, roomWidth, cfg.terminalTitle, cfg.terminalSubtitle, 0x1e293b, 0x38bdf8);

    // Carved War Table + Teleport Crystal
    buildRoundTable(tableGroup, {
      topMat: new THREE.MeshStandardMaterial({ color: 0x2b211a, roughness: 0.55, metalness: 0.2 }),
      rimMat: goldMat,
      baseMat: ironMat,
      rivets: false,
    });
    const tCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), crystalMat);
    tCrystal.scale.set(0.7, 1.6, 0.7);
    tCrystal.position.set(0.14, 0.90, -0.08);
    tableGroup.add(tCrystal);
    refs.animatedProps.push({ type: 'spin', mesh: tCrystal, speed: 0.02 });
  } else if (id === 'rezero') {
    const woodTex = createMahoganyTexture();
    buildShell(
      new THREE.MeshStandardMaterial({ color: 0x2b160e, roughness: 0.55, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.65, metalness: 0.08 }),
      new THREE.MeshStandardMaterial({ color: 0x24120b, roughness: 0.75 })
    );
    buildCentralLamp(0x5c3a14, 0xffbe66, true);
    addWallSconces(envGroup, 0xffaa44, 0xd4a017, 0xffcc55, 0xff8811, 'candle');

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a1c12, roughness: 0.6 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.9, roughness: 0.25 });
    addWallRibs(envGroup, roomWidth, roomLength, roomHeight, woodMat, null);

    // Tall Bookshelves along West & East Walls
    const bookColors = [0x7f1d1d, 0x1e3a8a, 0x14532d, 0x78350f, 0x581c87, 0x991b1b];
    [-2.4, 2.4].forEach(bz => {
      const shelfGroup = new THREE.Group();
      shelfGroup.position.set(-roomWidth / 2 + 0.30, 1.45, bz);
      shelfGroup.rotation.y = Math.PI / 2;
      shelfGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 0.42), woodMat));
      for (let row = -1.0; row <= 1.0; row += 0.5) {
        for (let bx = -0.58; bx <= 0.58; bx += 0.11) {
          const bh = 0.26 + ((Math.abs(bx * 10 + row * 7) % 3) * 0.03);
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.085, bh, 0.26),
            new THREE.MeshStandardMaterial({ color: bookColors[Math.abs(Math.floor((bx + row) * 10)) % bookColors.length], roughness: 0.7 })
          );
          book.position.set(bx, row + 0.05, 0.12);
          shelfGroup.add(book);
        }
      }
      envGroup.add(shelfGroup);
    });

    // Crimson Velvet Drapes flanking North Sanctuary Door
    const drapeMat = new THREE.MeshStandardMaterial({ color: 0x6d1422, roughness: 0.85 });
    [-1.65, 1.65].forEach(dx => {
      const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.2, 12), drapeMat);
      drape.position.set(dx, 1.65, -roomLength / 2 + 0.22);
      envGroup.add(drape);
    });

    // North Sanctuary Double Doors
    refs.gearDoorGroup = new THREE.Group();
    const sDoor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 0.16), woodMat);
    refs.gearDoorGroup.add(sDoor);
    const goldMedallion = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 12, 24), brassMat);
    goldMedallion.position.set(0, 0.2, 0.10);
    refs.gearDoorGroup.add(goldMedallion);
    refs.gearDoorGroup.position.set(0, 1.5, -roomLength / 2 + 0.08);
    envGroup.add(refs.gearDoorGroup);

    // South Mansion Door
    refs.wastelandDoorGroup = new THREE.Group();
    const mDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 0.14), woodMat);
    mDoor.position.set(0, 1.35, 0);
    refs.wastelandDoorGroup.add(mDoor);
    refs.wastelandDoorGroup.position.set(0, 0, roomLength / 2 - 0.06);
    envGroup.add(refs.wastelandDoorGroup);

    refs.terminalMesh = addTerminalConsole(envGroup, roomWidth, cfg.terminalTitle, cfg.terminalSubtitle, 0x3a1c12, 0xd4a017);

    // Mahogany Round Table + Brass Candelabra & Open Tome
    buildRoundTable(tableGroup, {
      topMat: new THREE.MeshStandardMaterial({ color: 0x451f14, roughness: 0.45, metalness: 0.12 }),
      rimMat: brassMat,
      baseMat: woodMat,
      rivets: false,
    });
    const candBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 0.22, 12), brassMat);
    candBase.position.set(-0.18, 0.89, -0.12);
    tableGroup.add(candBase);
    const candleFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.06, 8),
      new THREE.MeshBasicMaterial({ color: 0xffcc44 })
    );
    candleFlame.position.set(-0.18, 1.04, -0.12);
    tableGroup.add(candleFlame);
    const tome = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.18), new THREE.MeshStandardMaterial({ color: 0x6d1422, roughness: 0.7 }));
    tome.position.set(0.18, 0.81, 0.14);
    tome.rotation.y = -0.35;
    tableGroup.add(tome);
  } else if (id === 'cyberpunk') {
    const wetTex = createWetConcreteTexture();
    buildShell(
      new THREE.MeshStandardMaterial({ map: wetTex, roughness: 0.22, metalness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0x131622, roughness: 0.7, metalness: 0.35 }),
      new THREE.MeshStandardMaterial({ color: 0x0c0e16, roughness: 0.8 })
    );
    buildCentralLamp(0x11131a, 0x22d3ee, true);
    addWallSconces(envGroup, 0xf43f9e, 0x1e2230, 0xf43f9e, 0xe11d48, 'neon');

    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x181b26, metalness: 0.85, roughness: 0.3 });
    const cyanNeon = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const magentaNeon = new THREE.MeshBasicMaterial({ color: 0xf43f9e });
    addWallRibs(envGroup, roomWidth, roomLength, roomHeight, darkMetal, cyanNeon);

    // Server Racks with Blinking Fiber LEDs (West Wall)
    [-1.8, 1.8].forEach((sz, rIdx) => {
      const rack = new THREE.Group();
      rack.position.set(-roomWidth / 2 + 0.35, 1.3, sz);
      rack.rotation.y = Math.PI / 2;
      rack.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.5, 0.55), darkMetal));
      for (let l = 0; l < 10; l++) {
        const lColor = (l + rIdx) % 2 === 0 ? 0x22d3ee : 0xf43f9e;
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: lColor }));
        led.position.set(-0.32 + (l % 3) * 0.32, -0.8 + Math.floor(l / 3) * 0.45, 0.28);
        rack.add(led);
        refs.mainframeLeds.push({ mesh: led, baseColor: lColor });
      }
      envGroup.add(rack);
    });

    // Floor Power Cables snaking toward the central table
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
    [-0.6, 0.6].forEach((cx, idx) => {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 3.6, 10), idx === 0 ? cableMat : darkMetal);
      cable.rotation.x = Math.PI / 2;
      cable.position.set(cx, 0.028, -2.8);
      envGroup.add(cable);
    });

    // North Netrunner Blast Shutter
    refs.gearDoorGroup = new THREE.Group();
    refs.gearDoorGroup.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.9, 0.15), darkMetal));
    const neonFrame = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.08, 0.18), cyanNeon);
    neonFrame.position.set(0, 1.45, 0.02);
    refs.gearDoorGroup.add(neonFrame);
    refs.gearDoorGroup.position.set(0, 1.45, -roomLength / 2 + 0.08);
    envGroup.add(refs.gearDoorGroup);

    // South Alley Exit Shutter
    refs.wastelandDoorGroup = new THREE.Group();
    const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 0.14), darkMetal);
    exitDoor.position.set(0, 1.35, 0);
    refs.wastelandDoorGroup.add(exitDoor);
    const exitStrip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.16), magentaNeon);
    exitStrip.position.set(0, 2.5, 0);
    refs.wastelandDoorGroup.add(exitStrip);
    refs.wastelandDoorGroup.position.set(0, 0, roomLength / 2 - 0.06);
    envGroup.add(refs.wastelandDoorGroup);

    refs.terminalMesh = addTerminalConsole(envGroup, roomWidth, cfg.terminalTitle, cfg.terminalSubtitle, 0x11131a, 0xf43f9e);

    // Cyber Table + Holo Deck
    buildRoundTable(tableGroup, {
      topMat: new THREE.MeshStandardMaterial({ color: 0x181c28, metalness: 0.85, roughness: 0.25 }),
      rimMat: new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.7 }),
      baseMat: darkMetal,
      rivets: false,
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.16), darkMetal);
    deck.position.set(-0.14, 0.81, 0.10);
    tableGroup.add(deck);
    const holo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    holo.position.set(-0.14, 0.92, 0.10);
    holo.rotation.x = -0.3;
    tableGroup.add(holo);
  }

  return refs;
}

function buildRoundTable(tableGroup, { topMat, rimMat, baseMat, rivets }) {
  const tableRadius = 1.5;
  const tableHeight = 0.75;

  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(tableRadius, tableRadius, 0.08, 32), topMat);
  tableTop.position.y = tableHeight;
  tableTop.receiveShadow = true;
  tableGroup.add(tableTop);

  const outerRim = new THREE.Mesh(new THREE.CylinderGeometry(tableRadius + 0.02, tableRadius + 0.02, 0.09, 32), rimMat);
  outerRim.position.y = tableHeight;
  tableGroup.add(outerRim);

  if (rivets) {
    const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6);
    for (let b = 0; b < 16; b++) {
      const bAngle = (b * Math.PI * 2) / 16;
      const bolt = new THREE.Mesh(boltGeo, rimMat);
      bolt.position.set(Math.cos(bAngle) * (tableRadius + 0.015), tableHeight + 0.045, Math.sin(bAngle) * (tableRadius + 0.015));
      tableGroup.add(bolt);
    }
  }

  const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, tableHeight, 16), baseMat);
  tableBase.position.y = tableHeight / 2;
  tableBase.castShadow = true;
  tableGroup.add(tableBase);
}
