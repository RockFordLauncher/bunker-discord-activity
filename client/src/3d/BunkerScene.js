import * as THREE from 'three';
import {
  createConcreteTexture,
  createRustyMetalTexture,
  createGearDoorTexture,
  createWastelandDoorTexture,
  createPosterTexture,
  createCardBackTexture,
  createCardFrontTexture,
  createScreenTexture,
  createHazardStripTexture,
  createMainframeTexture,
  createBreakerBoxTexture,
  createFirstAidTexture,
} from './textures.js';
import { buildCharacterModel } from './characterBuilder.js';
import { getDefaultCustomization, THEME_PRESETS } from './characterCustomizationData.js';
import { bunkerAudio } from '../audio/bunkerAudio.js';
import {
  BUNKER_THEMES,
  normalizeThemeId,
  buildBunkerTheme,
  createThemedChair,
} from './bunkerThemes.js';

const CARD_TYPES = ['profession', 'health', 'hobby', 'baggage', 'fact', 'biology', 'special'];

const CARD_ICONS = {
  profession: '💼',
  health: '❤️',
  hobby: '🎯',
  baggage: '🎒',
  fact: '📋',
  biology: '🧬',
  special: '⭐',
};

export class Bunker3DScene {
  constructor(container, options = {}) {
    this.container = container;
    this.myId = options.myId || null;
    this.onCardClick = options.onCardClick || (() => {});
    this.onTableCardHover = options.onTableCardHover || (() => {});
    this.onHandCardHover = options.onHandCardHover || (() => {});
    this.onCardsToggle = options.onCardsToggle || null;
    this.onTerminalHover = options.onTerminalHover || null;
    this.onTerminalClick = options.onTerminalClick || null;
    this.themeId = normalizeThemeId(options.theme || 'fallout');
    this.cardsRaised = false; // By default retracted / lowered down
    this.selectedHandCard = null;
    this.targetFov = 65;
    this.hoveredTerminal = false;

    this.width = container.clientWidth || window.innerWidth;
    this.height = container.clientHeight || window.innerHeight;

    // Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1e26);
    this.scene.fog = new THREE.FogExp2(0x1a1e26, 0.011);

    this.camera = new THREE.PerspectiveCamera(65, this.width / this.height, 0.1, 100);
    this.camera.rotation.order = 'YXZ'; // Prevents diagonal roll tilt when looking around
    // Default safe seated eye level looking at table center
    this.camera.position.set(0, 1.35, 2.1);
    this.camera.lookAt(0, 0.75, 0);
    this.initialCameraLook = new THREE.Vector3(0, 0.75, 0);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25; // Balanced exposure with lifted shadow details

    container.appendChild(this.renderer.domElement);

    // Reusable Materials & Textures
    this.concreteTex = createConcreteTexture();
    this.metalTex = createRustyMetalTexture();
    this.cardBackTex = createCardBackTexture();

    // Game objects registry
    this.players = [];
    this.playerSeats = []; // seat positions
    this.avatarMeshes = [];
    this.chairMeshes = [];
    this.tableCards = []; // revealed cards on table
    this.handCards = []; // local player's cards in hand
    this.handGroup = new THREE.Group(); // seated player's hand-level anchor (world space, not glued to head)
    this.handGroup.position.set(0, 0, 2.1);
    this.handGroup.userData.baseRotY = 0;
    this.handGroup.scale.setScalar(0.001);
    this.handGroup.visible = false;
    this.scene.add(this.handGroup);
    this.playerCardPoses = new Map(); // playerId -> boolean (cardsRaised)
    this.playerCardProps = []; // per-player 3D in-hand fan & table stack
    this.currentTurnPlayerId = null;
    this.hoveredHandCard = null;
    this.hoveredTableCard = null;

    // Head rotation / FPV
    this.mouse = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.currentYaw = 0;
    this.currentPitch = 0;
    this.isDragging = false;
    this.cameraMode = false; // toggled with Alt: free mouse look without holding LMB
    this._pointerLockWasActive = false;
    this.previousMousePosition = { x: 0, y: 0 };

    // Lights
    this.flickerLight = null;
    this.flickerTimer = 0;
    this.redBeacon = null;
    this.greenBeacon = null;

    // Animated bunker environment objects
    this.envGroup = new THREE.Group();
    this.tableGroup = new THREE.Group();
    this.scene.add(this.envGroup);
    this.scene.add(this.tableGroup);
    this.gearDoorGroup = null;
    this.wastelandDoorGroup = null;
    this.terminalMesh = null;
    this.tapeReels = [];
    this.mainframeLeds = [];
    this.animatedThemeProps = [];
    this.clock = new THREE.Clock();

    // Build the themed room, lighting & table
    this.applyTheme(this.themeId);

    // Bind event listeners
    this.bindEvents();

    // Start render loop
    this.animate = this.animate.bind(this);
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Theme Management & Lighting / Room / Table Setup
  // ─────────────────────────────────────────────────────────────────────────
  setTheme(themeId) {
    const nextTheme = normalizeThemeId(themeId);
    if (this.themeId === nextTheme && this.envGroup.children.length > 0) return;
    this.themeId = nextTheme;
    this.applyTheme(nextTheme);
    if (this.players && this.players.length > 0) {
      this.updatePlayers(this.players, this.myId);
    }
  }

  disposeGroup(group) {
    if (!group) return;
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (m.map && m.map !== this.concreteTex && m.map !== this.metalTex && m.map !== this.cardBackTex) {
            m.map.dispose();
          }
          m.dispose();
        });
      }
    });
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
  }

  applyTheme(themeId) {
    const id = normalizeThemeId(themeId);
    const cfg = BUNKER_THEMES[id];
    this.disposeGroup(this.envGroup);
    this.disposeGroup(this.tableGroup);

    this.scene.background = new THREE.Color(cfg.background);
    this.scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);
    this.renderer.toneMappingExposure = cfg.exposure;

    const refs = buildBunkerTheme({
      themeId: id,
      envGroup: this.envGroup,
      tableGroup: this.tableGroup,
      metalTex: this.metalTex,
      concreteTex: this.concreteTex,
    });

    this.flickerLight = refs.flickerLight;
    this.redBeacon = refs.redBeacon;
    this.greenBeacon = refs.greenBeacon;
    this.gearDoorGroup = refs.gearDoorGroup;
    this.wastelandDoorGroup = refs.wastelandDoorGroup;
    this.terminalMesh = refs.terminalMesh;
    this.tapeReels = refs.tapeReels;
    this.mainframeLeds = refs.mainframeLeds;
    this.animatedThemeProps = refs.animatedProps || [];
    this.hoveredTerminal = false;
  }

  initLights() {
    // 1. Ambient baseline fill light so shadows and corners are soft and clearly visible
    const ambient = new THREE.AmbientLight(0x526074, 0.45);
    this.scene.add(ambient);

    // 2. Realistic indoor bounce light: cool ceiling bounce + warm floor bounce
    // Ensures dark recesses under the table, chairs, and far corners are never pitch-black
    const hemiLight = new THREE.HemisphereLight(0x8fa4be, 0x5a4e42, 0.65);
    this.scene.add(hemiLight);

    // 3. Overhead central warm tungsten pendant light over the table
    const lampPos = new THREE.Vector3(0, 2.55, 0);
    this.flickerLight = new THREE.PointLight(0xffbe66, 2.3, 11.0, 1.1);
    this.flickerLight.position.copy(lampPos);
    this.flickerLight.castShadow = true;
    this.flickerLight.shadow.mapSize.width = 2048;
    this.flickerLight.shadow.mapSize.height = 2048;
    this.flickerLight.shadow.bias = -0.001;
    this.scene.add(this.flickerLight);

    // 4. Crisp downward spotlight on tabletop (illuminates cards and characters clearly)
    const spot = new THREE.SpotLight(0xffe099, 1.8, 9, Math.PI / 3.2, 0.45);
    spot.position.copy(lampPos);
    spot.target.position.set(0, 0.75, 0);
    this.scene.add(spot);
    this.scene.add(spot.target);

    // 5. Dual directional fill lights for rich 3D shading without harsh pitch-black shadows
    const keyLight = new THREE.DirectionalLight(0xd8e4f0, 0.55);
    keyLight.position.set(2.0, 3.5, 2.0);
    keyLight.target.position.set(0, 0.75, 0);
    this.scene.add(keyLight);
    this.scene.add(keyLight.target);

    const fillLight = new THREE.DirectionalLight(0xcfd8e6, 0.42);
    fillLight.position.set(-2.5, 3.2, -2.0);
    fillLight.target.position.set(0, 0.75, 0);
    this.scene.add(fillLight);
    this.scene.add(fillLight.target);

    // 6. Corner ambient fill lights: softly illuminates dark room corners
    // (RobCo mainframe, Substation electrical box, oxygen tanks, airlock corners)
    const cornerPositions = [
      [-4.0, 2.0, -4.0],
      [4.0, 2.0, -4.0],
      [-4.0, 2.0, 4.0],
      [4.0, 2.0, 4.0],
    ];
    cornerPositions.forEach(([cx, cy, cz]) => {
      const cornerLight = new THREE.PointLight(0x8ea0b5, 0.55, 6.5, 1.2);
      cornerLight.position.set(cx, cy, cz);
      this.scene.add(cornerLight);
    });

    // 7. Authentic Caged Industrial Bulkhead Wall Sconces mounted FLUSH against walls
    // (NO lights placed at x=0 right over player's head, NO floating boxes in mid-air!)
    const wallSconces = [
      // North Wall (placed on left & right of Vault 101 gear door, flush at z = -4.95)
      { pos: [-3.2, 2.4, -4.95], rotY: 0 },
      { pos: [3.2, 2.4, -4.95], rotY: 0 },
      // East Wall (flush at x = 4.95)
      { pos: [4.95, 2.4, -2.6], rotY: -Math.PI / 2 },
      { pos: [4.95, 2.4, 2.6], rotY: -Math.PI / 2 },
      // West Wall (flush at x = -4.95)
      { pos: [-4.95, 2.4, -2.6], rotY: Math.PI / 2 },
      { pos: [-4.95, 2.4, 2.6], rotY: Math.PI / 2 },
      // South Wall (flush at z = 4.95)
      { pos: [-3.2, 2.4, 4.95], rotY: Math.PI },
      { pos: [3.2, 2.4, 4.95], rotY: Math.PI },
    ];

    const sconceMat = new THREE.MeshStandardMaterial({ color: 0x282522, metalness: 0.85, roughness: 0.35 });
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x4a4540, metalness: 0.9, roughness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xffaa44,
      emissive: 0xff9922,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      transparent: true,
      opacity: 0.92,
    });

    wallSconces.forEach(({ pos: [wx, wy, wz], rotY }) => {
      const sconceGroup = new THREE.Group();
      sconceGroup.position.set(wx, wy, wz);
      sconceGroup.rotation.y = rotY;

      // Base wall mounting plate attached flat to wall
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.04), sconceMat);
      plate.position.set(0, 0, 0.02);
      sconceGroup.add(plate);

      // Cast iron protective bezel rim
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.06), sconceMat);
      bezel.position.set(0, 0, 0.05);
      sconceGroup.add(bezel);

      // Frosted glowing amber glass lens
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.06), glassMat);
      lens.position.set(0, 0, 0.08);
      sconceGroup.add(lens);

      // 3D Metal protective wire cage bars
      const barGeoH = new THREE.CylinderGeometry(0.007, 0.007, 0.16, 8);
      barGeoH.rotateZ(Math.PI / 2);
      [-0.08, 0, 0.08].forEach(by => {
        const barH = new THREE.Mesh(barGeoH, wireMat);
        barH.position.set(0, by, 0.12);
        sconceGroup.add(barH);
      });

      const barGeoV = new THREE.CylinderGeometry(0.007, 0.007, 0.30, 8);
      const barV = new THREE.Mesh(barGeoV, wireMat);
      barV.position.set(0, 0, 0.12);
      sconceGroup.add(barV);

      // Warm local point light (brightened and expanded so perimeter walls and corners are warmly lit)
      const pLight = new THREE.PointLight(0xffaa44, 1.35, 7.5, 1.1);
      pLight.position.set(0, 0, 0.20);
      sconceGroup.add(pLight);

      this.scene.add(sconceGroup);
    });

    // 6. Central Hanging Industrial Pendant Lamp with Suspension Chains & Cage
    const lampGroup = new THREE.Group();
    lampGroup.position.set(0, 2.75, 0);

    // Twin suspension chains from ceiling arch down to lamp
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.3 });
    const chainGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.9, 8);
    [-0.12, 0.12].forEach(cx => {
      const chain = new THREE.Mesh(chainGeo, chainMat);
      chain.position.set(cx, 0.45, 0);
      lampGroup.add(chain);
    });

    // Conical enamel lampshade (dark olive-green / hammered metal finish)
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2a3228, metalness: 0.75, roughness: 0.35 });
    const shadeGeo = new THREE.CylinderGeometry(0.12, 0.44, 0.22, 24, 1, true);
    const shade = new THREE.Mesh(shadeGeo, shadeMat);
    shade.position.set(0, 0, 0);
    lampGroup.add(shade);

    // Lamp socket and neck collar
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.10, 16), chainMat);
    neck.position.set(0, 0.14, 0);
    lampGroup.add(neck);

    // Glowing incandescent filament bulb inside shade
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffe099,
      emissive: 0xffaa33,
      emissiveIntensity: 1.8,
      roughness: 0.1,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), bulbMat);
    bulb.position.set(0, -0.06, 0);
    lampGroup.add(bulb);

    // Protective bottom wire basket cage
    for (let c = 0; c < 8; c++) {
      const cAngle = (c * Math.PI) / 4;
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.36, 8), wireMat);
      wire.position.set(Math.cos(cAngle) * 0.16, -0.12, Math.sin(cAngle) * 0.16);
      wire.rotation.x = Math.sin(cAngle) * 0.4;
      wire.rotation.z = -Math.cos(cAngle) * 0.4;
      lampGroup.add(wire);
    }
    const cageRing = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.008, 8, 24), wireMat);
    cageRing.position.set(0, -0.16, 0);
    cageRing.rotation.x = Math.PI / 2;
    lampGroup.add(cageRing);

    this.scene.add(lampGroup);

    // 7. Red beacon near outer wasteland door (South wall)
    this.redBeacon = new THREE.PointLight(0xff2200, 0.8, 6);
    this.redBeacon.position.set(0, 2.7, 4.2);
    this.scene.add(this.redBeacon);

    // 8. Green beacon above Inner Vault gear door (North wall)
    this.greenBeacon = new THREE.PointLight(0x33ff66, 1.4, 7);
    this.greenBeacon.position.set(0, 2.9, -4.2);
    this.scene.add(this.greenBeacon);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Room Geometry & High-Density Vault-Tec Environmental Props
  // ─────────────────────────────────────────────────────────────────────────
  initRoom() {
    const roomWidth = 10;
    const roomLength = 10;
    const roomHeight = 3.8;

    // Floor (Rusty steel diamond-tread plates)
    this.metalTex.repeat.set(5, 5);
    const floorGeo = new THREE.PlaneGeometry(roomWidth, roomLength);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.metalTex,
      roughness: 0.5,
      metalness: 0.65,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Ceiling
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x323740, roughness: 0.8 });
    const ceil = new THREE.Mesh(floorGeo, ceilMat);
    ceil.position.y = roomHeight;
    ceil.rotation.x = Math.PI / 2;
    this.scene.add(ceil);

    // Walls
    this.concreteTex.repeat.set(3, 1.5);
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.concreteTex,
      roughness: 0.85,
      metalness: 0.15,
    });

    // North Wall (Vault gear door wall)
    const nWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat);
    nWall.position.set(0, roomHeight / 2, -roomLength / 2);
    nWall.receiveShadow = true;
    this.scene.add(nWall);

    // South Wall (Outer Wasteland blast door)
    const sWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat);
    sWall.position.set(0, roomHeight / 2, roomLength / 2);
    sWall.rotation.y = Math.PI;
    sWall.receiveShadow = true;
    this.scene.add(sWall);

    // East Wall (Terminal, Substation & Posters)
    const eWall = new THREE.Mesh(new THREE.PlaneGeometry(roomLength, roomHeight), wallMat);
    eWall.position.set(roomWidth / 2, roomHeight / 2, 0);
    eWall.rotation.y = -Math.PI / 2;
    eWall.receiveShadow = true;
    this.scene.add(eWall);

    // West Wall (RobCo Mainframe, First Aid & Pipes)
    const wWall = new THREE.Mesh(new THREE.PlaneGeometry(roomLength, roomHeight), wallMat);
    wWall.position.set(-roomWidth / 2, roomHeight / 2, 0);
    wWall.rotation.y = Math.PI / 2;
    wWall.receiveShadow = true;
    this.scene.add(wWall);

    // ── LOWER STEEL ARMORED WAINSCOTING (1.15m height along all 4 walls) ──
    const wainscotMat = new THREE.MeshStandardMaterial({ color: 0x2d323b, metalness: 0.7, roughness: 0.45 });
    const rivetMat = new THREE.MeshStandardMaterial({ color: 0x505864, metalness: 0.9, roughness: 0.25 });
    const hazardTex = createHazardStripTexture(512, 64);
    hazardTex.repeat.set(8, 1);
    const hazardBorderMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5 });

    const addWainscot = (length, posX, posY, posZ, rotY) => {
      const panelGroup = new THREE.Group();
      panelGroup.position.set(posX, posY, posZ);
      panelGroup.rotation.y = rotY;

      // Heavy armor plate
      const plate = new THREE.Mesh(new THREE.BoxGeometry(length, 1.15, 0.05), wainscotMat);
      plate.position.set(0, 1.15 / 2, 0.025);
      panelGroup.add(plate);

      // Top beveled steel capping rail
      const cap = new THREE.Mesh(new THREE.BoxGeometry(length, 0.05, 0.08), wainscotMat);
      cap.position.set(0, 1.15, 0.04);
      panelGroup.add(cap);

      // Hazard caution stripe ribbon along top rail
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.08), hazardBorderMat);
      stripe.position.set(0, 1.08, 0.052);
      panelGroup.add(stripe);

      // 3D Hex Bolt Rivets
      const rivetGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.02, 6);
      rivetGeo.rotateX(Math.PI / 2);
      for (let rx = -length / 2 + 0.4; rx < length / 2; rx += 0.6) {
        const r1 = new THREE.Mesh(rivetGeo, rivetMat);
        r1.position.set(rx, 1.0, 0.055);
        panelGroup.add(r1);
        const r2 = new THREE.Mesh(rivetGeo, rivetMat);
        r2.position.set(rx, 0.15, 0.055);
        panelGroup.add(r2);
      }

      this.scene.add(panelGroup);
    };

    addWainscot(roomWidth, 0, 0, -roomLength / 2 + 0.01, 0); // North
    addWainscot(roomWidth, 0, 0, roomLength / 2 - 0.01, Math.PI); // South
    addWainscot(roomLength, roomWidth / 2 - 0.01, 0, 0, -Math.PI / 2); // East
    addWainscot(roomLength, -roomWidth / 2 + 0.01, 0, 0, Math.PI / 2); // West

    // ── FLOOR AIRLOCK DRAINAGE TRENCH & CIRCULAR TABLE CAUTION BORDER ──
    const drainGrateMat = new THREE.MeshStandardMaterial({ color: 0x282c32, metalness: 0.8, roughness: 0.4 });
    const addDrain = (len, px, pz, rotY) => {
      const grate = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.28), drainGrateMat);
      grate.position.set(px, 0.005, pz);
      grate.rotation.x = -Math.PI / 2;
      grate.rotation.z = rotY;
      this.scene.add(grate);
    };
    addDrain(roomWidth - 1.2, 0, -roomLength / 2 + 0.45, 0);
    addDrain(roomWidth - 1.2, 0, roomLength / 2 - 0.45, 0);
    addDrain(roomLength - 1.2, roomWidth / 2 - 0.45, 0, Math.PI / 2);
    addDrain(roomLength - 1.2, -roomWidth / 2 + 0.45, 0, Math.PI / 2);

    // Circular table caution hazard ring on floor
    const tableRingTex = createHazardStripTexture(512, 64);
    tableRingTex.repeat.set(6, 1);
    const tableRingMat = new THREE.MeshStandardMaterial({ map: tableRingTex, roughness: 0.5 });
    const tableRing = new THREE.Mesh(new THREE.RingGeometry(2.35, 2.50, 32), tableRingMat);
    tableRing.position.set(0, 0.004, 0);
    tableRing.rotation.x = -Math.PI / 2;
    this.scene.add(tableRing);

    // Heavy Industrial I-Beams / Columns along corners
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x34373d, metalness: 0.8, roughness: 0.35 });
    [-roomWidth / 2 + 0.15, roomWidth / 2 - 0.15].forEach(x => {
      [-roomLength / 2 + 0.15, roomLength / 2 - 0.15].forEach(z => {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, roomHeight, 0.35), beamMat);
        col.position.set(x, roomHeight / 2, z);
        this.scene.add(col);
      });
    });

    // Ceiling arch I-beams
    [-2.5, 0, 2.5].forEach(z => {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.28, 0.28), beamMat);
      arch.position.set(0, roomHeight - 0.15, z);
      this.scene.add(arch);
    });

    // ── CEILING HVAC VENTILATION DUCTING ──
    const ductMat = new THREE.MeshStandardMaterial({ color: 0x363a40, metalness: 0.7, roughness: 0.45 });
    const mainDuct = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, roomLength - 1.0), ductMat);
    mainDuct.position.set(-2.0, roomHeight - 0.35, 0);
    this.scene.add(mainDuct);

    // Duct suspension brackets & flanges
    [-3.0, -1.0, 1.0, 3.0].forEach(dz => {
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.36, 0.05), beamMat);
      flange.position.set(-2.0, roomHeight - 0.35, dz);
      this.scene.add(flange);

      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.20), beamMat);
      hanger.position.set(-2.0, roomHeight - 0.10, dz);
      this.scene.add(hanger);
    });

    // ── ROBCO MAINFRAME SUPERCOMPUTER RACK (West Wall) ──
    const mainframeGroup = new THREE.Group();
    mainframeGroup.position.set(-roomWidth / 2 + 0.35, 1.35, -1.8);
    mainframeGroup.rotation.y = Math.PI / 2;

    const mfTex = createMainframeTexture();
    const mfMat = new THREE.MeshStandardMaterial({ map: mfTex, metalness: 0.65, roughness: 0.4 });
    const mfChassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.55), mfMat);
    mainframeGroup.add(mfChassis);

    // Dual 3D Magnetic Tape Reels that spin in animate()
    const reelMat = new THREE.MeshStandardMaterial({ color: 0xc4cdd8, metalness: 0.9, roughness: 0.2 });
    [-0.26, 0.26].forEach(rx => {
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 24), reelMat);
      reel.position.set(rx, 0.22, 0.29);
      reel.rotation.x = Math.PI / 2;
      mainframeGroup.add(reel);
      this.tapeReels.push(reel);

      // Center chrome spindle
      const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16), beamMat);
      spindle.position.set(rx, 0.22, 0.30);
      spindle.rotation.x = Math.PI / 2;
      mainframeGroup.add(spindle);
    });

    // Bank of 24 Blinking Status LEDs (green, amber, red)
    const ledColors = [0x33ff66, 0xffaa22, 0xff3333, 0x33ff66, 0x33ccff];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        const lColor = ledColors[(r * 8 + c) % ledColors.length];
        const ledMat = new THREE.MeshBasicMaterial({ color: lColor });
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), ledMat);
        led.position.set(-0.35 + c * 0.10, -0.45 - r * 0.08, 0.29);
        mainframeGroup.add(led);
        this.mainframeLeds.push({ mesh: led, baseColor: lColor });
      }
    }
    this.scene.add(mainframeGroup);

    // ── HIGH-VOLTAGE ELECTRICAL SUBSTATION BREAKER BOX (East Wall) ──
    const breakerGroup = new THREE.Group();
    breakerGroup.position.set(roomWidth / 2 - 0.22, 1.9, -1.8);
    breakerGroup.rotation.y = -Math.PI / 2;

    const bbTex = createBreakerBoxTexture();
    const bbMat = new THREE.MeshStandardMaterial({ map: bbTex, metalness: 0.65, roughness: 0.4 });
    const bbBox = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.24), bbMat);
    breakerGroup.add(bbBox);

    // Heavy red knife-switch disconnect handle
    const switchBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.04), beamMat);
    switchBase.position.set(0.28, -0.15, 0.14);
    breakerGroup.add(switchBase);

    const redHandleMat = new THREE.MeshStandardMaterial({ color: 0xd2281e, roughness: 0.4 });
    const switchHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.05), redHandleMat);
    switchHandle.position.set(0.28, -0.12, 0.18);
    switchHandle.rotation.x = 0.35;
    breakerGroup.add(switchHandle);

    // 3 Steel Conduit Pipes running from breaker box up to ceiling
    const conduitMat = new THREE.MeshStandardMaterial({ color: 0x4a505a, metalness: 0.85, roughness: 0.3 });
    [-0.22, 0, 0.22].forEach(cx => {
      const cPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.2, 12), conduitMat);
      cPipe.position.set(cx, 0.95, 0.04);
      breakerGroup.add(cPipe);
    });
    this.scene.add(breakerGroup);

    // ── WALL-MOUNTED EMERGENCY LIFE-SUPPORT PROPS ──
    // 1. Red Fire Extinguisher (East Wall, near wasteland blast door)
    const extGroup = new THREE.Group();
    extGroup.position.set(roomWidth / 2 - 0.15, 1.35, 1.6);
    extGroup.rotation.y = -Math.PI / 2;

    const extMat = new THREE.MeshStandardMaterial({ color: 0xd62214, metalness: 0.6, roughness: 0.35 });
    const extTank = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.52, 16), extMat);
    extGroup.add(extTank);

    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.9, roughness: 0.25 });
    const extValve = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), brassMat);
    extValve.position.y = 0.30;
    extGroup.add(extValve);

    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const extHose = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), hoseMat);
    extHose.position.set(0.06, 0.10, 0);
    extGroup.add(extHose);
    this.scene.add(extGroup);

    // 2. Vault-Tec Emergency First Aid Kit (West Wall)
    const faGroup = new THREE.Group();
    faGroup.position.set(-roomWidth / 2 + 0.10, 1.8, 1.6);
    faGroup.rotation.y = Math.PI / 2;

    const faTex = createFirstAidTexture();
    const faMat = new THREE.MeshStandardMaterial({ map: faTex, roughness: 0.45 });
    const faCabinet = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.14), faMat);
    faGroup.add(faCabinet);
    this.scene.add(faGroup);

    // 3. Compressed Oxygen Reserve Tanks (North Wall, right corner)
    const oxyGroup = new THREE.Group();
    oxyGroup.position.set(3.8, 1.25, -roomLength / 2 + 0.24);

    const oxyMat = new THREE.MeshStandardMaterial({ color: 0x8a9235, metalness: 0.7, roughness: 0.4 });
    [-0.15, 0.15].forEach(ox => {
      const oTank = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 1.4, 16), oxyMat);
      oTank.position.set(ox, 0, 0);
      oxyGroup.add(oTank);

      const oDome = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 16), oxyMat);
      oDome.position.set(ox, 0.70, 0);
      oxyGroup.add(oDome);

      const oValve = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.10, 8), brassMat);
      oValve.position.set(ox, 0.82, 0);
      oxyGroup.add(oValve);
    });

    // Connecting high-pressure manifold bar
    const manifold = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), brassMat);
    manifold.rotateZ(Math.PI / 2);
    manifold.position.set(0, 0.82, 0);
    oxyGroup.add(manifold);

    // Wall mounting bracket strap
    const oStrap = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.05, 0.22), beamMat);
    oStrap.position.set(0, 0.35, 0);
    oxyGroup.add(oStrap);
    this.scene.add(oxyGroup);

    // Industrial Pipes with valves on West Wall (upper)
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x5a4a38, metalness: 0.65, roughness: 0.45 });
    const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, roomLength, 12);
    pipeGeo.rotateX(Math.PI / 2);
    const pipe1 = new THREE.Mesh(pipeGeo, pipeMat);
    pipe1.position.set(-roomWidth / 2 + 0.25, 2.9, 0);
    const pipe2 = new THREE.Mesh(pipeGeo, pipeMat);
    pipe2.position.set(-roomWidth / 2 + 0.25, 3.2, 0);
    this.scene.add(pipe1);
    this.scene.add(pipe2);

    // ── Posters on East Wall ──
    const posterGeo = new THREE.PlaneGeometry(1.2, 1.6);
    [0, 1, 2].forEach((pType, idx) => {
      const posterTex = createPosterTexture(pType);
      const posterMat = new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.7 });
      const poster = new THREE.Mesh(posterGeo, posterMat);
      poster.position.set(roomWidth / 2 - 0.02, 2.1, -2.4 + idx * 2.4);
      poster.rotation.y = -Math.PI / 2;
      this.scene.add(poster);
    });

    // ── North Wall: Giant Vault Gear Door (Upright plane facing into room) ──
    this.gearDoorGroup = new THREE.Group();
    const gearDoorTex = createGearDoorTexture('101');
    const gearDoorMat = new THREE.MeshStandardMaterial({ map: gearDoorTex, metalness: 0.55, roughness: 0.4 });
    const gearDoor = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), gearDoorMat);
    this.gearDoorGroup.add(gearDoor);

    // Gear door frame & hydraulic cylinders
    const frameGeo = new THREE.RingGeometry(1.48, 1.75, 32);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2e333b, metalness: 0.85, roughness: 0.35 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = 0.02;
    this.gearDoorGroup.add(frame);

    this.gearDoorGroup.position.set(0, 1.8, -roomLength / 2 + 0.05);
    this.scene.add(this.gearDoorGroup);

    // Hazard warning border frame around Vault Gear door
    const hTop = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.22), hazardBorderMat);
    hTop.position.set(0, 3.42, -roomLength / 2 + 0.04);
    this.scene.add(hTop);

    const hLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 3.4), hazardBorderMat);
    hLeft.position.set(-1.75, 1.75, -roomLength / 2 + 0.04);
    this.scene.add(hLeft);

    const hRight = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 3.4), hazardBorderMat);
    hRight.position.set(1.75, 1.75, -roomLength / 2 + 0.04);
    this.scene.add(hRight);

    // Green indicator light fixture above gear door
    const greenLampGeo = new THREE.BoxGeometry(0.4, 0.15, 0.1);
    const greenLampMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 });
    const greenLamp = new THREE.Mesh(greenLampGeo, greenLampMat);
    greenLamp.position.set(0, 3.6, -roomLength / 2 + 0.05);
    this.scene.add(greenLamp);

    // ── South Wall: Outer Wasteland Blast Door ──
    this.wastelandDoorGroup = new THREE.Group();
    const wasteTex = createWastelandDoorTexture();
    const wasteMat = new THREE.MeshStandardMaterial({ map: wasteTex, metalness: 0.45, roughness: 0.55 });
    const wasteDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 0.12), wasteMat);
    wasteDoor.position.set(0, 1.35, 0);
    this.wastelandDoorGroup.add(wasteDoor);
    this.wastelandDoorGroup.position.set(0, 0, roomLength / 2 - 0.06);
    this.scene.add(this.wastelandDoorGroup);

    // Red warning beacon bulb above wasteland door
    const redBulbGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const redBulbMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const redBulb = new THREE.Mesh(redBulbGeo, redBulbMat);
    redBulb.position.set(0, 2.9, roomLength / 2 - 0.12);
    this.scene.add(redBulb);

    // ── East Wall: RobCo CRT Terminal for Catastrophe Roulette ──
    const termGeo = new THREE.BoxGeometry(0.14, 0.85, 1.25);
    const termMat = new THREE.MeshStandardMaterial({ color: 0x32302b, metalness: 0.75, roughness: 0.35 });
    const terminalBox = new THREE.Mesh(termGeo, termMat);
    terminalBox.position.set(roomWidth / 2 - 0.07, 2.1, 0);

    const screenTex = createScreenTexture('ROBCO PROTOCOL', 'STANDBY // READY');
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
    this.terminalMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), screenMat);
    this.terminalMesh.position.set(-0.075, 0, 0);
    this.terminalMesh.rotation.y = -Math.PI / 2;
    terminalBox.add(this.terminalMesh);
    this.scene.add(terminalBox);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Central Metal Table & Chairs
  // ─────────────────────────────────────────────────────────────────────────
  initTable() {
    const tableRadius = 1.5;
    const tableHeight = 0.75;

    // Heavy round steel table top with radial panel seams
    const topGeo = new THREE.CylinderGeometry(tableRadius, tableRadius, 0.08, 32);
    const topMat = new THREE.MeshStandardMaterial({
      map: this.metalTex,
      metalness: 0.75,
      roughness: 0.38,
    });
    const tableTop = new THREE.Mesh(topGeo, topMat);
    tableTop.position.y = tableHeight;
    tableTop.receiveShadow = true;
    this.scene.add(tableTop);

    // Heavy riveted steel outer rim
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x343840, metalness: 0.85, roughness: 0.3 });
    const outerRim = new THREE.Mesh(new THREE.CylinderGeometry(tableRadius + 0.02, tableRadius + 0.02, 0.09, 32), rimMat);
    outerRim.position.y = tableHeight;
    this.scene.add(outerRim);

    // 16 Hex bolt rivets along table rim
    const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6);
    for (let b = 0; b < 16; b++) {
      const bAngle = (b * Math.PI * 2) / 16;
      const bolt = new THREE.Mesh(boltGeo, rimMat);
      bolt.position.set(Math.cos(bAngle) * (tableRadius + 0.015), tableHeight + 0.045, Math.sin(bAngle) * (tableRadius + 0.015));
      this.scene.add(bolt);
    }

    // Central heavy cylindrical base pillar with hydraulic flutes
    const baseGeo = new THREE.CylinderGeometry(0.35, 0.55, tableHeight, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2a, metalness: 0.85, roughness: 0.35 });
    const tableBase = new THREE.Mesh(baseGeo, baseMat);
    tableBase.position.y = tableHeight / 2;
    tableBase.castShadow = true;
    this.scene.add(tableBase);

    // Table Prop 1: Heavy Cast-Iron Ashtray with glowing smoldering cigarette ember
    const ashGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.04, 16);
    const ashMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.7, roughness: 0.5 });
    const ashtray = new THREE.Mesh(ashGeo, ashMat);
    ashtray.position.set(0.15, tableHeight + 0.04, -0.10);
    this.scene.add(ashtray);

    const emberGeo = new THREE.SphereGeometry(0.008, 8, 8);
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    const ember = new THREE.Mesh(emberGeo, emberMat);
    ember.position.set(0.18, tableHeight + 0.065, -0.08);
    this.scene.add(ember);

    // Table Prop 2: Vintage Brass Vault-Tec Radiation Dosimeter with needle dial
    const dosiGeo = new THREE.BoxGeometry(0.18, 0.065, 0.12);
    const dosiMat = new THREE.MeshStandardMaterial({ color: 0x826e32, metalness: 0.88, roughness: 0.28 });
    const dosimeter = new THREE.Mesh(dosiGeo, dosiMat);
    dosimeter.position.set(-0.20, tableHeight + 0.05, 0.12);
    dosimeter.rotation.y = 0.5;
    this.scene.add(dosimeter);

    const dialGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16), rimMat);
    dialGlass.position.set(-0.22, tableHeight + 0.085, 0.11);
    this.scene.add(dialGlass);

    // Table Prop 3: Stamped Steel Vault-Tec Coffee Mug
    const mugMat = new THREE.MeshStandardMaterial({ color: 0x244268, metalness: 0.6, roughness: 0.4 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 16), mugMat);
    mug.position.set(-0.05, tableHeight + 0.07, -0.22);
    this.scene.add(mug);

    // Table Prop 4: Spent Brass .308 Ammunition Shell Casings
    const casingMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.95, roughness: 0.2 });
    const casingGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.038, 8);
    casingGeo.rotateZ(Math.PI / 2);
    const casing1 = new THREE.Mesh(casingGeo, casingMat);
    casing1.position.set(0.24, tableHeight + 0.045, 0.15);
    casing1.rotation.y = 0.8;
    this.scene.add(casing1);

    const casing2 = new THREE.Mesh(casingGeo, casingMat);
    casing2.position.set(0.27, tableHeight + 0.045, 0.18);
    casing2.rotation.y = -0.4;
    this.scene.add(casing2);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Update Players, Chairs & 3D Avatars
  // ─────────────────────────────────────────────────────────────────────────
  updatePlayers(players, myId) {
    this.players = players;
    if (myId) this.myId = myId;
    const effectiveMyId = myId || this.myId;
    const numPlayers = Math.max(players.length, 4);

    // Clean up old avatars and chairs
    this.avatarMeshes.forEach(m => {
      this.scene.remove(m);
    });
    this.avatarMeshes = [];
    if (this.chairMeshes) {
      this.chairMeshes.forEach(c => this.scene.remove(c));
    }
    this.chairMeshes = [];
    this.playerSeats = [];

    // Table radius is 1.5, seat radius is 2.1
    const seatRadius = 2.1;
    const eyeHeight = 1.25;

    // Find local player's index so local player is always seated at angle 0 (front-facing)
    const myIndex = players.findIndex(p => p.id === effectiveMyId);
    const myOffset = myIndex >= 0 ? myIndex : 0;

    for (let i = 0; i < numPlayers; i++) {
      // Angle: i=0 is positioned at (0, eyeHeight, 2.1) looking at table center (0, 0.75, 0)
      const relativeIdx = (i - myOffset + numPlayers) % numPlayers;
      const angle = (relativeIdx * 2 * Math.PI) / numPlayers + Math.PI / 2;

      const px = Math.cos(angle) * seatRadius;
      const pz = Math.sin(angle) * seatRadius;
      const seatPos = new THREE.Vector3(px, 0, pz);

      this.playerSeats.push({ seatPos, angle, player: players[i] || null });

      // Build Metal Screw Chair
      this.createChair(px, pz, angle);

      // Seat relativeIdx === 0 is ALWAYS the local player's first-person camera position (px = 0, pz = 2.1, eyeHeight = 1.25).
      // NEVER create an avatar mesh at relativeIdx === 0 or when players[i]?.id === myId!
      const isLocal = (relativeIdx === 0) || (effectiveMyId && players[i]?.id === effectiveMyId);

      if (isLocal) {
        // Position camera at player's seat!
        this.camera.position.set(px, eyeHeight, pz);
        // Look toward table center
        this.camera.lookAt(0, 0.75, 0);
        this.initialCameraLook = new THREE.Vector3(0, 0.75, 0);

        // Anchor handGroup to local player's seat facing the table (-Z toward center, +Z toward player)
        if (this.handGroup) {
          this.handGroup.position.set(px, 0, pz);
          const handBaseRotY = Math.atan2(px, pz);
          this.handGroup.rotation.y = handBaseRotY;
          this.handGroup.userData.baseRotY = handBaseRotY;
        }

        // Render local player's own 3D avatar seated at their chair in First-Person Mode
        // (head/neck hidden so torso, arms, hands, and legs are visible when looking down)
        if (players[i] && !players[i].eliminated) {
          const localAvatar = this.createAvatar(players[i], px, pz, angle, true);
          if (localAvatar) {
            this.avatarMeshes.push(localAvatar);
            this.scene.add(localAvatar);
          }
        }
      } else if (players[i]) {
        // Create 3D Avatar for other player/bot ONLY IF NOT ELIMINATED!
        // When a player/bot is eliminated, their chair remains completely empty!
        if (!players[i].eliminated) {
          const avatar = this.createAvatar(players[i], px, pz, angle, false);
          if (avatar) {
            this.avatarMeshes.push(avatar);
            this.scene.add(avatar);
          }
        }
      }
    }

    // Rebuild cards on table and in hand
    this.syncTableCards(players, effectiveMyId);
    this.syncPlayerCardProps(players, effectiveMyId);
  }

  setCurrentTurnPlayer(playerId) {
    this.currentTurnPlayerId = playerId || null;
  }

  setPlayerCardsPose(playerId, cardsRaised) {
    if (!playerId) return;
    this.playerCardPoses.set(playerId, Boolean(cardsRaised));
  }

  setPlayerHeadRotation(playerId, yaw, pitch) {
    if (!playerId) return;
    if (!this.playerHeadRotations) this.playerHeadRotations = new Map();
    const existing = this.playerHeadRotations.get(playerId);
    if (existing) {
      existing.targetYaw = Number(yaw) || 0;
      existing.targetPitch = Number(pitch) || 0;
    } else {
      const y = Number(yaw) || 0;
      const p = Number(pitch) || 0;
      this.playerHeadRotations.set(playerId, {
        targetYaw: y,
        targetPitch: p,
        yaw: y,
        pitch: p,
      });
    }
  }

  syncPlayerCardProps(players, myId) {
    // Clean up old per-player 3D card fans & table stacks
    if (this.playerCardProps && this.playerCardProps.length > 0) {
      this.playerCardProps.forEach(p => {
        if (p.tableStackGroup) {
          this.disposeGroup(p.tableStackGroup);
          this.scene.remove(p.tableStackGroup);
        }
        if (p.inHandFanGroup) {
          this.disposeGroup(p.inHandFanGroup);
          this.scene.remove(p.inHandFanGroup);
        }
      });
    }
    this.playerCardProps = [];

    const numPlayers = Math.max(players.length, 4);
    const myIndex = players.findIndex(p => p.id === myId);
    const myOffset = myIndex >= 0 ? myIndex : 0;

    players.forEach((player, idx) => {
      if (!player || player.eliminated) return;

      const relativeIdx = (idx - myOffset + numPlayers) % numPlayers;
      const angle = (relativeIdx * 2 * Math.PI) / numPlayers + Math.PI / 2;
      const isLocal = (relativeIdx === 0) || (myId && player.id === myId);
      const avatar = this.avatarMeshes.find(a => a.userData?.player?.id === player.id) || null;

      // 1. 3D Table Stack right in front of the player's seat (radius 1.34m on table y=0.802)
      const tableStackGroup = new THREE.Group();
      const stackRadius = 1.34;
      const stackX = Math.cos(angle) * stackRadius;
      const stackZ = Math.sin(angle) * stackRadius;
      tableStackGroup.position.set(stackX, 0.803, stackZ);
      tableStackGroup.rotation.y = Math.atan2(-stackX, -stackZ);

      const stackGeo = new THREE.BoxGeometry(0.095, 0.0025, 0.14);
      const stackEdgeMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6 });
      const stackBackMat = new THREE.MeshStandardMaterial({ map: this.cardBackTex, roughness: 0.45 });
      const stackMats = [
        stackEdgeMat, stackEdgeMat,
        stackBackMat, stackBackMat,
        stackEdgeMat, stackEdgeMat,
      ];

      const stackCount = 6;
      for (let c = 0; c < stackCount; c++) {
        const card = new THREE.Mesh(stackGeo, stackMats);
        card.position.set(
          Math.sin(c * 1.9 + idx) * 0.003,
          c * 0.0028,
          Math.cos(c * 2.3 + idx) * 0.003
        );
        card.rotation.y = (c - stackCount / 2) * 0.025;
        card.castShadow = true;
        card.receiveShadow = true;
        tableStackGroup.add(card);
      }
      this.scene.add(tableStackGroup);

      // 2. 3D In-Hand Card Fan (comfortable chest / table-edge reading height)
      const inHandFanGroup = new THREE.Group();
      const handRadius = 1.68; // ~0.42m in front of seat (2.1m), right between raised hands
      const handX = Math.cos(angle) * handRadius;
      const handZ = Math.sin(angle) * handRadius;
      const fanBaseRotY = Math.atan2(-handX, -handZ);
      inHandFanGroup.position.set(handX, 0.96, handZ);
      inHandFanGroup.rotation.y = fanBaseRotY;
      inHandFanGroup.userData.baseRotY = fanBaseRotY;

      const fanGeo = new THREE.BoxGeometry(0.088, 0.128, 0.0028);
      const fanInnerMat = new THREE.MeshStandardMaterial({ color: 0xd9d2c5, roughness: 0.5 });
      const fanMats = [
        stackEdgeMat, stackEdgeMat,
        stackEdgeMat, stackEdgeMat,
        stackBackMat, // outward toward table/other players
        fanInnerMat,  // inward toward player
      ];

      const fanCount = 5;
      for (let c = 0; c < fanCount; c++) {
        const t = (c / (fanCount - 1)) - 0.5; // -0.5 .. +0.5
        const card = new THREE.Mesh(fanGeo, fanMats);
        card.position.set(t * 0.125, -Math.abs(t) * 0.018, Math.abs(t) * 0.007);
        card.rotation.set(0.42, 0, -t * 0.36); // tilted comfortably for reading
        card.castShadow = true;
        inHandFanGroup.add(card);
      }

      // Local player already has interactive FPV handCards attached to camera; keep 3D fan hidden for local
      // so it doesn't double-render in front of their own FPV cards, while remote players see it!
      inHandFanGroup.visible = !isLocal;
      inHandFanGroup.scale.setScalar(0.001);
      this.scene.add(inHandFanGroup);

      const initialHold = isLocal ? this.cardsRaised : Boolean(this.playerCardPoses.get(player.id));
      this.playerCardProps.push({
        playerId: player.id,
        player,
        avatar,
        isLocal,
        seatIndex: idx,
        tableStackGroup,
        inHandFanGroup,
        baseStackPos: new THREE.Vector3(stackX, 0.803, stackZ),
        baseHandPos: new THREE.Vector3(handX, 0.96, handZ),
        baseHandRotY: fanBaseRotY,
        holdWeight: initialHold ? 1 : 0,
      });
    });
  }

  createChair(x, z, angle) {
    const chairGroup = createThemedChair(this.themeId, x, z);
    this.scene.add(chairGroup);
    this.chairMeshes.push(chairGroup);
  }

  _legacyCreateChairUnused(x, z, angle) {
    const chairGroup = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x30333a, metalness: 0.85, roughness: 0.3 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0x9ba4b0, metalness: 0.92, roughness: 0.2 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.75, metalness: 0.1 });

    // 1. 5-Spoke Star Base with Floor Casters (Firmly grounded on the floor)
    const starBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.04, 5), frameMat);
    starBase.position.y = 0.03;
    chairGroup.add(starBase);

    for (let c = 0; c < 5; c++) {
      const cAngle = (c * Math.PI * 2) / 5;
      const caster = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), frameMat);
      caster.position.set(Math.cos(cAngle) * 0.30, 0.025, Math.sin(cAngle) * 0.30);
      chairGroup.add(caster);
    }

    // 2. Heavy Hydraulic Central Column
    const hydraulic = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.46, 16), chromeMat);
    hydraulic.position.y = 0.26;
    chairGroup.add(hydraulic);

    const hydraulicCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 16), frameMat);
    hydraulicCollar.position.y = 0.12;
    chairGroup.add(hydraulicCollar);

    // 3. Ergonomic Molded Swivel Seat Cushion
    const seatPad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.07, 24), cushionMat);
    seatPad.position.y = 0.52;
    chairGroup.add(seatPad);

    const seatPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 24), frameMat);
    seatPlate.position.y = 0.48;
    chairGroup.add(seatPlate);

    // 4. Continuous Heavy Tubular Steel Back Support Spine & Arms
    // Sturdy vertical tubular spine posts running from under seat up to lumbar backrest
    const postGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.36, 12);
    [-0.14, 0.14].forEach(px => {
      const post = new THREE.Mesh(postGeo, chromeMat);
      post.position.set(px, 0.68, -0.20);
      chairGroup.add(post);
    });

    // Horizontal top frame bar
    const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.36, 12), chromeMat);
    crossBar.rotateZ(Math.PI / 2);
    crossBar.position.set(0, 0.88, -0.20);
    chairGroup.add(crossBar);

    // Bottom reinforcement bracket under seat
    const underBracket = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.18), frameMat);
    underBracket.position.set(0, 0.48, -0.12);
    chairGroup.add(underBracket);

    // 5. Solid Padded Lumbar Backrest Cushion (visibly supported by the steel posts)
    const backCushion = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.06), cushionMat);
    backCushion.position.set(0, 0.82, -0.19);
    chairGroup.add(backCushion);

    // 6. Integrated Tubular Armrests with Padded Rests
    [-0.24, 0.24].forEach(side => {
      // Upright arm post from seat
      const armUpright = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.20, 10), chromeMat);
      armUpright.position.set(side, 0.60, 0.02);
      chairGroup.add(armUpright);

      // Armrest pad
      const armPad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.24), cushionMat);
      armPad.position.set(side, 0.70, 0.04);
      chairGroup.add(armPad);
    });

    // Orient chair toward table center (0, 0, 0)
    const targetAngle = Math.atan2(-x, -z);
    chairGroup.position.set(x, 0, z);
    chairGroup.rotation.y = targetAngle;

    this.scene.add(chairGroup);
    this.chairMeshes.push(chairGroup);
  }

  createAvatar(player, x, z, angle, isLocal = false) {
    if (!player) return null;
    let cust = player.customization;
    if (!cust) {
      if (player.isBot) {
        // Diverse theme presets for bots (Kirito, Asuna, Leon, HUNK, Wesker, Subaru, Rem, Raider, Cyborg...)
        const hash = (player.username || player.id || 'bot')
          .split('')
          .reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const preset = THEME_PRESETS[hash % THEME_PRESETS.length];
        cust = { ...preset.data, preset: preset.id };
      } else {
        cust = getDefaultCustomization();
      }
    }

    const avatarGroup = buildCharacterModel(cust, {
      mode: 'seated',
      cardBackTex: isLocal ? null : this.cardBackTex,
    });

    avatarGroup.userData.player = player;
    avatarGroup.userData.baseAngle = angle;
    avatarGroup.userData.isLocal = isLocal;

    if (isLocal) {
      if (typeof avatarGroup.userData?.setFirstPersonMode === 'function') {
        avatarGroup.userData.setFirstPersonMode(true);
      } else {
        // Safe fallback if loader doesn't expose setFirstPersonMode yet
        if (avatarGroup.userData.head) avatarGroup.userData.head.visible = false;
        if (avatarGroup.userData.neck) avatarGroup.userData.neck.visible = false;
      }
    }

    // Position avatar and orient local +Z directly toward table center (0, 0, 0)
    const targetAngle = Math.atan2(-x, -z);
    avatarGroup.position.set(x, 0, z);
    avatarGroup.rotation.y = targetAngle;

    // Attach floating 3D nametag above remote player avatars
    if (!isLocal) {
      const nametag = this.createNametagSprite(player.username || (player.isBot ? 'БОТ' : 'ОПЕРАТОР'), player.isHost);
      nametag.position.set(0, 1.48, 0);
      avatarGroup.add(nametag);
      avatarGroup.userData.nametag = nametag;
    }

    return avatarGroup;
  }

  createNametagSprite(username, isHost = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Dark sleek semi-transparent pill badge
    ctx.fillStyle = 'rgba(10, 14, 20, 0.85)';
    ctx.roundRect ? ctx.roundRect(16, 20, 480, 88, 20) : ctx.fillRect(16, 20, 480, 88);
    ctx.fill();

    // Border
    ctx.lineWidth = 4;
    ctx.strokeStyle = isHost ? 'rgba(235, 172, 39, 0.9)' : 'rgba(90, 180, 255, 0.65)';
    if (ctx.roundRect) ctx.roundRect(16, 20, 480, 88, 20);
    ctx.stroke();

    // Text
    ctx.font = 'bold 44px monospace, "Courier New", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isHost ? '#ffcc44' : '#e0eef8';
    const cleanName = (username.length > 15 ? username.slice(0, 14) + '…' : username).toUpperCase();
    ctx.fillText((isHost ? '★ ' : '') + cleanName, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.65, 0.16, 1.0);
    return sprite;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Revealed Cards on Table & Local Hand Cards
  // ─────────────────────────────────────────────────────────────────────────
  syncTableCards(players, myId) {
    // Clear old table card meshes
    this.tableCards.forEach(c => this.scene.remove(c));
    this.tableCards = [];

    const numPlayers = Math.max(players.length, 4);
    const myIndex = players.findIndex(p => p.id === myId);
    const myOffset = myIndex >= 0 ? myIndex : 0;

    players.forEach((player, idx) => {
      const relativeIdx = (idx - myOffset + numPlayers) % numPlayers;
      const angle = (relativeIdx * 2 * Math.PI) / numPlayers + Math.PI / 2;

      // Table radius 1.5. Place cards in sector in front of player on top of table
      const sectorCenter = new THREE.Vector3(Math.cos(angle) * 1.05, 0.802, Math.sin(angle) * 1.05);

      const hand = player.hand;
      if (!hand) return;

      const revealed = hand.revealed || {};
      const revealedTypes = CARD_TYPES.filter(type => revealed[type]);
      if (revealedTypes.length === 0) return;

      // Center the cards symmetrically in front of player
      const cardSpacing = 0.13;
      let cardOffset = -((revealedTypes.length - 1) * cardSpacing) / 2;

      revealedTypes.forEach(type => {
        const cardData = hand[type];
        const text = typeof cardData === 'string' ? cardData : (cardData?.text || '—');
        const desc = typeof cardData === 'object' ? (cardData?.description || '') : '';
        const icon = CARD_ICONS[type] || '🃏';

        const frontTex = createCardFrontTexture(type, text, icon, desc);
        // Compact realistic playing card size
        const cardGeo = new THREE.BoxGeometry(0.11, 0.003, 0.16);
        const cardMats = [
          new THREE.MeshStandardMaterial({ color: 0x222 }),
          new THREE.MeshStandardMaterial({ color: 0x222 }),
          new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.3, emissive: 0x141008 }), // top face
          new THREE.MeshStandardMaterial({ map: this.cardBackTex }), // bottom face
          new THREE.MeshStandardMaterial({ color: 0x222 }),
          new THREE.MeshStandardMaterial({ color: 0x222 }),
        ];
        const cardMesh = new THREE.Mesh(cardGeo, cardMats);

        // Position on table facing towards player
        const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
        cardMesh.position.copy(sectorCenter).addScaledVector(tangent, cardOffset);
        cardMesh.rotation.y = -angle - Math.PI / 2;

        cardMesh.userData = {
          type,
          text,
          description: desc,
          player,
          isTableCard: true,
        };

        this.tableCards.push(cardMesh);
        this.scene.add(cardMesh);

        cardOffset += cardSpacing;
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Local FPV Hand Cards (Attached to Camera View)
  // ─────────────────────────────────────────────────────────────────────────
  setLocalHandCards(myCards, myRevealed = {}, isEliminated = false) {
    // Eliminated spectator has NO cards in hand!
    if (isEliminated) {
      this.handCards.forEach(c => {
        this.handGroup.remove(c);
        if (c.geometry) c.geometry.dispose();
        if (Array.isArray(c.material)) {
          c.material.forEach(m => {
            if (m.map && m.map !== this.cardBackTex) m.map.dispose();
            m.dispose();
          });
        }
      });
      this.handCards = [];
      this.hoveredHandCard = null;
      this.selectedHandCard = null;
      return;
    }

    // ONLY SHOW UNREVEALED CARDS IN HAND (revealed cards are on the table!)
    const activeTypes = CARD_TYPES.filter(t => myCards && myCards[t] && !myRevealed[t]);
    const count = activeTypes.length;

    if (count === 0) {
      this.handCards.forEach(c => {
        this.handGroup.remove(c);
        if (c.geometry) c.geometry.dispose();
        if (Array.isArray(c.material)) {
          c.material.forEach(m => {
            if (m.map && m.map !== this.cardBackTex) m.map.dispose();
            m.dispose();
          });
        }
      });
      this.handCards = [];
      this.hoveredHandCard = null;
      this.selectedHandCard = null;
      return;
    }

    // Compare current card types with existing cards.
    // If they match, keep the existing meshes and just update their userData and textures,
    // preserving this.hoveredHandCard and this.selectedHandCard!
    const existingTypes = this.handCards.map(c => c.userData?.type);
    const typesMatch = existingTypes.length === activeTypes.length &&
      existingTypes.every((type, idx) => type === activeTypes[idx]);

    if (typesMatch) {
      activeTypes.forEach((type, i) => {
        const mesh = this.handCards[i];
        const cardData = myCards[type];
        const text = typeof cardData === 'string' ? cardData : (cardData?.text || '—');
        const desc = typeof cardData === 'object' ? (cardData?.description || '') : '';
        const icon = CARD_ICONS[type] || '🃏';

        if (mesh.userData.text !== text || mesh.userData.description !== desc) {
          const frontTex = createCardFrontTexture(type, text, icon, desc);
          if (Array.isArray(mesh.material) && mesh.material[4]) {
            if (mesh.material[4].map && mesh.material[4].map !== this.cardBackTex) {
              mesh.material[4].map.dispose();
            }
            mesh.material[4].map = frontTex;
            mesh.material[4].needsUpdate = true;
          }
        }

        mesh.userData.text = text;
        mesh.userData.description = desc;
        mesh.userData.cardData = cardData;
      });
      return;
    }

    // Remember hovered / selected card types in case they still exist in the updated hand
    const prevHoveredType = this.hoveredHandCard?.userData?.type;
    const prevSelectedType = this.selectedHandCard?.userData?.type;

    // Remove old hand cards from handGroup
    this.handCards.forEach(c => {
      this.handGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (Array.isArray(c.material)) {
        c.material.forEach(m => {
          if (m.map && m.map !== this.cardBackTex) m.map.dispose();
          m.dispose();
        });
      }
    });
    this.handCards = [];

    // Centered symmetric fan calculation
    const maxSpread = 0.44;
    const cardStep = count > 1 ? Math.min(0.068, maxSpread / (count - 1)) : 0;
    const totalWidth = (count - 1) * cardStep;

    activeTypes.forEach((type, i) => {
      const cardData = myCards[type];
      const text = typeof cardData === 'string' ? cardData : (cardData?.text || '—');
      const desc = typeof cardData === 'object' ? (cardData?.description || '') : '';
      const icon = CARD_ICONS[type] || '🃏';

      const frontTex = createCardFrontTexture(type, text, icon, desc);
      const cardGeo = new THREE.BoxGeometry(0.115, 0.165, 0.004);
      const cardMats = [
        new THREE.MeshBasicMaterial({ color: 0x222 }),
        new THREE.MeshBasicMaterial({ color: 0x222 }),
        new THREE.MeshBasicMaterial({ color: 0x222 }),
        new THREE.MeshBasicMaterial({ color: 0x222 }),
        new THREE.MeshBasicMaterial({ map: frontTex }), // front face (+z)
        new THREE.MeshBasicMaterial({ map: this.cardBackTex }), // back face (-z)
      ];

      const mesh = new THREE.Mesh(cardGeo, cardMats);

      // Centered symmetric fan in player's hands, just below straight-ahead eye level (world space)
      const x = -totalWidth / 2 + i * cardStep;
      const archY = -Math.pow(x / 0.35, 2) * 0.018;
      const y = 0.93 + archY;
      const z = -0.48;
      const rotZ = -x * 0.42;

      mesh.position.set(x, y, z);
      mesh.rotation.set(-0.42, 0, rotZ);

      mesh.userData = {
        type,
        text,
        description: desc,
        cardData,
        basePos: new THREE.Vector3(x, y, z),
        baseRot: new THREE.Vector3(-0.42, 0, rotZ),
        isHandCard: true,
      };

      this.handGroup.add(mesh);
      this.handCards.push(mesh);
    });

    this.hoveredHandCard = prevHoveredType ? (this.handCards.find(c => c.userData.type === prevHoveredType) || null) : null;
    this.selectedHandCard = prevSelectedType ? (this.handCards.find(c => c.userData.type === prevSelectedType) || null) : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Catastrophe Roulette Animation
  // ─────────────────────────────────────────────────────────────────────────
  playCatastropheRoulette(catastrophe, onDone) {
    if (!this.terminalMesh) return;
    const titles = [
      'ЯДЕРНАЯ ВОЙНА', 'ЗОМБИ-АПОКАЛИПСИС', 'СВЕРХВСПЫШКА СОЛНЦА',
      'ПАДЕНИЕ АСТЕРОИДА', 'ВОССТАНИЕ ИИ', 'СПОРОМОР КОРДИЦЕПСА',
      'ОРБИТАЛЬНАЯ БОМБАРДИРОВКА', 'СЕРАЯ СЛИЗЬ НАНОБОТОВ',
    ];

    let ticks = 0;
    const maxTicks = 22;
    let speed = 60;

    const tick = () => {
      ticks++;
      bunkerAudio.playRelayTick();

      const randomTitle = titles[Math.floor(Math.random() * titles.length)];
      this.terminalMesh.material.map = createScreenTexture('ROBCO SATELLITE ALERT', randomTitle);
      this.terminalMesh.material.map.needsUpdate = true;

      if (ticks < maxTicks) {
        speed += 18;
        setTimeout(tick, speed);
      } else {
        // Final catastrophe
        bunkerAudio.playPipBoySelect();
        const finalTitle = (catastrophe?.text || 'КАТАСТРОФА').toUpperCase();
        this.terminalMesh.material.map = createScreenTexture('ALERT: CATASTROPHE CONFIRMED', finalTitle);
        this.terminalMesh.material.map.needsUpdate = true;
        if (onDone) onDone();
      }
    };

    setTimeout(tick, speed);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Ejection & Victory Visual Effects
  // ─────────────────────────────────────────────────────────────────────────
  playEjectionEffect(ejectedPlayerName) {
    bunkerAudio.playEjectionAlarm();

    // Flash red beacon
    let flashes = 0;
    const flashInterval = setInterval(() => {
      flashes++;
      if (this.redBeacon) {
        this.redBeacon.intensity = flashes % 2 === 0 ? 3.5 : 0;
      }
      if (flashes > 12) {
        clearInterval(flashInterval);
        if (this.redBeacon) this.redBeacon.intensity = 0;
      }
    }, 200);

    // Slide open outer wasteland door slightly, then slam shut
    if (this.wastelandDoorGroup) {
      this.wastelandDoorGroup.position.x = -1.2;
      setTimeout(() => {
        if (this.wastelandDoorGroup) this.wastelandDoorGroup.position.x = 0;
        bunkerAudio.playCardSlap(); // heavy thud
      }, 2500);
    }
  }

  playVictoryEffect() {
    bunkerAudio.playVaultDoorOpen();

    // Roll open gear door
    if (this.gearDoorGroup) {
      let t = 0;
      const openInterval = setInterval(() => {
        t += 0.05;
        this.gearDoorGroup.rotation.z += 0.08;
        this.gearDoorGroup.position.x -= 0.04;
        if (t >= 2.0) clearInterval(openInterval);
      }, 50);
    }

    if (this.greenBeacon) {
      this.greenBeacon.intensity = 5.0;
    }
  }

  toggleCardsRaised() {
    this.cardsRaised = !this.cardsRaised;
    if (this.myId) {
      this.playerCardPoses.set(this.myId, this.cardsRaised);
    }
    bunkerAudio.playPipBoySelect();
    if (!this.cardsRaised) {
      this.hoveredHandCard = null;
      this.selectedHandCard = null;
      if (this.onHandCardHover) this.onHandCardHover(null);
    }
    if (this.onCardsToggle) {
      this.onCardsToggle(this.cardsRaised);
    }
    return this.cardsRaised;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Input & Mouse Look (Clamped FPV + Alt Camera/Cursor Toggle)
  // ─────────────────────────────────────────────────────────────────────────
  toggleCameraMode(forceState) {
    const next = typeof forceState === 'boolean' ? forceState : !this.cameraMode;
    this.cameraMode = next;
    this.isDragging = false;

    if (next) {
      this.previousMousePosition = null;
      this.mouse.set(0, 0);
      try {
        const res = this.container.requestPointerLock?.();
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch (_) {}
    } else {
      this._pointerLockWasActive = false;
      if (document.pointerLockElement === this.container) {
        try { document.exitPointerLock?.(); } catch (_) {}
      }
    }
    this.updateCameraModeUI();
  }

  updateCameraModeUI() {
    if (this._crosshairEl) {
      this._crosshairEl.style.display = this.cameraMode ? 'block' : 'none';
    }
    if (this._modeHintEl) {
      this._modeHintEl.textContent = this.cameraMode ? '[ALT] КАМЕРА' : '[ALT] КУРСОР';
      this._modeHintEl.style.borderColor = this.cameraMode ? 'rgba(56, 189, 248, 0.7)' : 'rgba(255, 255, 255, 0.2)';
      this._modeHintEl.style.color = this.cameraMode ? '#7dd3fc' : 'rgba(255, 255, 255, 0.65)';
    }
  }

  bindEvents() {
    // Lightweight center reticle + mode badge (non-blocking pointer-events: none)
    const crosshair = document.createElement('div');
    crosshair.style.cssText = 'position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:rgba(255,255,255,0.85);box-shadow:0 0 4px rgba(0,0,0,0.9);pointer-events:none;z-index:20;display:none;';
    this.container.appendChild(crosshair);
    this._crosshairEl = crosshair;

    const modeHint = document.createElement('div');
    modeHint.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);padding:3px 10px;border-radius:4px;background:rgba(10,14,20,0.65);border:1px solid rgba(255,255,255,0.2);font-family:monospace;font-size:11px;letter-spacing:0.08em;color:rgba(255,255,255,0.65);pointer-events:none;z-index:20;';
    modeHint.textContent = '[ALT] КУРСОР';
    this.container.appendChild(modeHint);
    this._modeHintEl = modeHint;

    this.onMouseDown = (e) => {
      bunkerAudio.init();
      bunkerAudio.resume();

      if (e.button === 0) {
        if (!this.cameraMode) {
          this.isDragging = true;
          this.previousMousePosition = { x: e.clientX, y: e.clientY };
        }
        this.handleCardClick();
      }
    };

    this.onMouseMove = (e) => {
      const isLocked = document.pointerLockElement === this.container;
      if (isLocked) {
        this.mouse.set(0, 0);
      } else {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / this.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / this.height) * 2 + 1;
      }

      if (isLocked || this.cameraMode || this.isDragging) {
        let deltaX = 0;
        let deltaY = 0;
        if (isLocked) {
          deltaX = e.movementX || 0;
          deltaY = e.movementY || 0;
        } else if (this.previousMousePosition) {
          deltaX = e.clientX - this.previousMousePosition.x;
          deltaY = e.clientY - this.previousMousePosition.y;
        }
        this.previousMousePosition = { x: e.clientX, y: e.clientY };

        // Realistic human neck limits:
        // Yaw: ±115 degrees (approx ±2.0 radians)
        // Pitch: -45 deg down, +30 deg up (approx -0.8 to +0.55 rad)
        this.targetYaw -= deltaX * 0.0035;
        this.targetPitch -= deltaY * 0.0035;

        this.targetYaw = Math.max(-2.0, Math.min(2.0, this.targetYaw));
        this.targetPitch = Math.max(-0.8, Math.min(0.55, this.targetPitch));

        if (this.onHeadMove) {
          const now = performance.now();
          if (!this._lastHeadSync || now - this._lastHeadSync > 50) {
            this._lastHeadSync = now;
            this.onHeadMove(this.targetYaw, this.targetPitch);
          }
        }
      } else {
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }

      this.checkHover();
    };

    this.onMouseUp = () => {
      this.isDragging = false;
    };

    this.onPointerLockChange = () => {
      const locked = document.pointerLockElement === this.container;
      if (locked) {
        this._pointerLockWasActive = true;
      } else if (this.cameraMode && this._pointerLockWasActive) {
        this.cameraMode = false;
        this._pointerLockWasActive = false;
        this.updateCameraModeUI();
      }
    };

    this.onKeyDown = (e) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        if (!e.repeat) {
          this.toggleCameraMode();
        }
        return;
      }
      if (e.code === 'Space') {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        this.toggleCardsRaised();
      }
    };

    this.onResize = () => {
      this.width = this.container.clientWidth || window.innerWidth;
      this.height = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    };

    this.container.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  checkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Check Hand Cards only if cards are raised into view!
    if (this.cardsRaised) {
      const handIntersects = this.raycaster.intersectObjects(this.handCards);

      if (handIntersects.length > 0) {
        const hit = handIntersects[0].object;
        if (this.hoveredHandCard !== hit) {
          this.hoveredHandCard = hit;
          bunkerAudio.playCardHover();
          this.container.style.cursor = 'pointer';
        }
        return;
      } else {
        if (this.hoveredHandCard) {
          this.hoveredHandCard = null;
          this.container.style.cursor = 'default';
        }
      }
    } else {
      if (this.hoveredHandCard) {
        this.hoveredHandCard = null;
      }
    }

    // 2. Check RobCo Wall Terminal Hover (Smooth Zoom feature)
    if (this.terminalMesh) {
      const termIntersects = this.raycaster.intersectObject(this.terminalMesh);
      if (termIntersects.length > 0) {
        if (!this.hoveredTerminal) {
          this.hoveredTerminal = true;
          this.container.style.cursor = 'zoom-in';
          if (this.onTerminalHover) this.onTerminalHover(true);
        }
        return;
      } else {
        if (this.hoveredTerminal) {
          this.hoveredTerminal = false;
          this.container.style.cursor = 'default';
          if (this.onTerminalHover) this.onTerminalHover(false);
        }
      }
    }

    // 3. Check Table Cards Hover
    const tableIntersects = this.raycaster.intersectObjects(this.tableCards);
    if (tableIntersects.length > 0) {
      const hit = tableIntersects[0].object;
      if (this.hoveredTableCard !== hit) {
        this.hoveredTableCard = hit;
        this.container.style.cursor = 'pointer';
        this.onTableCardHover(hit.userData);
      }
    } else {
      if (this.hoveredTableCard) {
        this.hoveredTableCard = null;
        this.container.style.cursor = 'default';
        this.onTableCardHover(null);
      }
    }
  }

  handleCardClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Hand card selection (only when cards are raised!)
    if (this.cardsRaised) {
      const intersects = this.raycaster.intersectObjects(this.handCards);
      if (intersects.length > 0) {
        const card = intersects[0].object;
        bunkerAudio.playPipBoySelect();
        if (this.selectedHandCard === card) {
          // Second click on already selected card -> trigger onCardClick to drop it onto table!
          if (this.onCardClick) this.onCardClick(card.userData.type);
        } else {
          // First click -> select and inspect it!
          this.selectedHandCard = card;
          if (this.onHandCardHover) this.onHandCardHover(card.userData);
        }
        return;
      }
    }

    // 2. RobCo Terminal click
    if (this.terminalMesh) {
      const termIntersects = this.raycaster.intersectObject(this.terminalMesh);
      if (termIntersects.length > 0) {
        bunkerAudio.playTerminalBeep();
        if (this.onTerminalClick) this.onTerminalClick();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Animation Loop
  // ─────────────────────────────────────────────────────────────────────────
  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Smooth Camera Head Rotation with Dampening (YXZ prevents diagonal roll!)
    this.currentYaw += (this.targetYaw - this.currentYaw) * 0.14;
    this.currentPitch += (this.targetPitch - this.currentPitch) * 0.14;

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.currentYaw;
    this.camera.rotation.x = this.currentPitch;
    this.camera.rotation.z = 0;

    // Smooth FOV zoom when hovering over RobCo Terminal!
    this.targetFov = this.hoveredTerminal ? 34 : 65;
    if (Math.abs(this.camera.fov - this.targetFov) > 0.1) {
      this.camera.fov += (this.targetFov - this.camera.fov) * 0.12;
      this.camera.updateProjectionMatrix();
    }

    // 2. Fluorescent Light Flicker Simulation (subtle flicker without plunging the room into darkness)
    this.flickerTimer += delta;
    if (this.flickerLight && this.flickerTimer > 0.1) {
      this.flickerTimer = 0;
      if (Math.random() > 0.88) {
        this.flickerLight.intensity = 1.8 + Math.random() * 0.7;
      } else {
        this.flickerLight.intensity = 2.4;
      }
    }

    // 3. Hand Cards Elevation & Hover (Hidden when lowered so only the table stack shows; smoothly raised into hands on Space)
    const targetHandScale = this.cardsRaised ? 1 : 0.001;
    if (this.handGroup) {
      const curScale = this.handGroup.scale.x + (targetHandScale - this.handGroup.scale.x) * 0.22;
      this.handGroup.scale.setScalar(curScale);
      this.handGroup.visible = curScale > 0.03;
      const baseHandRotY = this.handGroup.userData.baseRotY ?? 0;
      this.handGroup.rotation.y = baseHandRotY + this.currentYaw * 0.35;
    }
    this.handCards.forEach(c => {
      const isSelectedOrHovered = this.cardsRaised && (this.hoveredHandCard === c || this.selectedHandCard === c);
      const raisedOffsetY = this.cardsRaised ? 0 : -0.125;
      const raisedOffsetZ = this.cardsRaised ? 0 : -0.08;
      const hoverOffsetY = isSelectedOrHovered ? 0.04 : 0;
      const hoverOffsetZ = isSelectedOrHovered ? 0.03 : 0;
      const targetY = c.userData.basePos.y + raisedOffsetY + hoverOffsetY;
      const targetZ = c.userData.basePos.z + raisedOffsetZ + hoverOffsetZ;
      const targetRotX = isSelectedOrHovered ? -0.25 : (this.cardsRaised ? c.userData.baseRot.x : -1.45);

      c.position.y += (targetY - c.position.y) * 0.22;
      c.position.z += (targetZ - c.position.z) * 0.22;
      c.rotation.x += (targetRotX - c.rotation.x) * 0.22;
    });

    // 3b. Per-Player 3D In-Hand Card Fans & 3D Table Stacks
    const propByPlayerId = new Map();
    if (this.playerCardProps && this.playerCardProps.length > 0) {
      this.playerCardProps.forEach((prop, idx) => {
        propByPlayerId.set(prop.playerId, prop);
        let isHolding = false;
        if (prop.isLocal) {
          isHolding = this.cardsRaised;
        } else if (this.playerCardPoses.has(prop.playerId)) {
          isHolding = Boolean(this.playerCardPoses.get(prop.playerId));
        } else if (prop.player?.isBot) {
          // Bots naturally hold cards during their turn and occasionally check their hand
          const isTurn = prop.playerId === this.currentTurnPlayerId;
          isHolding = isTurn
            ? (Math.sin(time * 0.65 + idx * 1.7) > -0.35)
            : (Math.sin(time * 0.28 + idx * 2.4) > 0.72);
        }

        const targetHold = isHolding ? 1 : 0;
        prop.holdWeight += (targetHold - prop.holdWeight) * 0.14;
        const w = prop.holdWeight;

        // Animate 3D Table Stack (neatly resting on table when holdWeight -> 0, hidden when player raises cards)
        if (prop.tableStackGroup) {
          const stackScale = Math.max(0.001, 1 - w);
          prop.tableStackGroup.visible = stackScale > 0.02;
          prop.tableStackGroup.scale.set(stackScale, stackScale, stackScale);
          prop.tableStackGroup.position.y = prop.baseStackPos.y - w * 0.025;
        }

        // Animate 3D In-Hand Fan (visible for remote players when holdWeight > 0, follows torso turn)
        if (prop.inHandFanGroup && !prop.isLocal) {
          const fanScale = Math.max(0.001, w);
          prop.inHandFanGroup.visible = fanScale > 0.02;
          prop.inHandFanGroup.scale.set(fanScale, fanScale, fanScale);
          prop.inHandFanGroup.position.y = prop.baseHandPos.y + Math.sin(time * 1.85 + idx * 2.17) * 0.004;
          const netRot = this.playerHeadRotations?.get(prop.playerId);
          const torsoYaw = netRot ? netRot.yaw * 0.35 : 0;
          prop.inHandFanGroup.rotation.y = (prop.baseHandRotY ?? prop.inHandFanGroup.userData.baseRotY ?? 0) + torsoYaw;
        }
      });
    }

    // 4. Avatars: Rich Seated Animations, FP Body Follow-Through, and Card-Holding Poses
    const snapNode = (node) => node ? {
      pos: { x: node.position.x, y: node.position.y, z: node.position.z },
      rot: { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z },
      scale: { x: node.scale.x, y: node.scale.y, z: node.scale.z },
    } : null;

    this.avatarMeshes.forEach((avatar, i) => {
      const ud = avatar.userData;
      if (!ud.seatedBase) {
        ud.seatedBase = {
          torso: snapNode(ud.torso),
          head: snapNode(ud.head),
          leftArm: snapNode(ud.leftArm),
          rightArm: snapNode(ud.rightArm),
          leftForearm: snapNode(ud.lForearm),
          rightForearm: snapNode(ud.rForearm),
        };
      }
      const base = ud.seatedBase;
      const phase = i * 2.17;
      const style = i % 3;
      const breath = Math.sin(time * 1.85 + phase);
      const sway = Math.sin(time * 0.55 + phase * 1.3);

      const playerId = ud.player?.id;
      const isSpeaking = Boolean(playerId && playerId === this.currentTurnPlayerId);
      ud.speakWeight = (ud.speakWeight || 0) + ((isSpeaking ? 1 : 0) - (ud.speakWeight || 0)) * 0.08;
      const speakW = ud.speakWeight;

      const cardProp = playerId ? propByPlayerId.get(playerId) : null;
      const holdW = cardProp ? cardProp.holdWeight : (ud.isLocal && this.cardsRaised ? 1 : 0);

      // Smoothly interpolate remote player's synchronized head/body look direction
      const netRot = !ud.isLocal && playerId ? this.playerHeadRotations?.get(playerId) : null;
      if (netRot) {
        netRot.yaw += (netRot.targetYaw - netRot.yaw) * 0.18;
        netRot.pitch += (netRot.targetPitch - netRot.pitch) * 0.18;
      }

      // Torso: breathing + weight shift + speaking lean + full-body follow-through matching FP view!
      if (ud.torso && base.torso) {
        ud.torso.scale.z = base.torso.scale.z * (1 + breath * 0.032);
        ud.torso.scale.y = base.torso.scale.y * (1 + breath * 0.014);

        if (ud.isLocal) {
          const fpPitchLean = Math.max(-0.12, Math.min(0.22, -this.currentPitch * 0.22));
          ud.torso.rotation.y = base.torso.rot.y + this.currentYaw * 0.35 + sway * 0.012;
          ud.torso.rotation.x = base.torso.rot.x + fpPitchLean + breath * 0.012 + speakW * 0.05;
          ud.torso.rotation.z = base.torso.rot.z - this.currentYaw * 0.05 + sway * 0.010;
        } else if (netRot) {
          const remotePitchLean = Math.max(-0.12, Math.min(0.22, -netRot.pitch * 0.22));
          ud.torso.rotation.y = base.torso.rot.y + netRot.yaw * 0.35 + sway * 0.012;
          ud.torso.rotation.x = base.torso.rot.x + remotePitchLean + breath * 0.012 + speakW * 0.08;
          ud.torso.rotation.z = base.torso.rot.z - netRot.yaw * 0.05 + sway * 0.010;
        } else {
          ud.torso.rotation.x = base.torso.rot.x + breath * 0.014 + speakW * 0.08 + holdW * 0.06;
          ud.torso.rotation.y = base.torso.rot.y + Math.sin(time * 0.38 + phase) * 0.035;
          ud.torso.rotation.z = base.torso.rot.z + sway * 0.025;
        }
      }

      // Head (attached to torso so it never detaches!): synchronized rotation for remote players, natural glances for bots
      if (ud.head && base.head && !ud.isLocal) {
        if (netRot) {
          ud.head.rotation.y = base.head.rot.y + netRot.yaw * 0.65;
          ud.head.rotation.x = base.head.rot.x - netRot.pitch * 0.78;
          ud.head.rotation.z = base.head.rot.z;
        } else {
          const glanceYaw = Math.sin(time * 0.42 + phase) * 0.24 + Math.sin(time * 0.95 + phase * 2) * 0.08;
          const glancePitch = -0.05 + Math.sin(time * 0.65 + phase) * 0.06 + holdW * 0.22;
          ud.head.rotation.y = base.head.rot.y + glanceYaw;
          ud.head.rotation.x = base.head.rot.x + glancePitch;
          ud.head.rotation.z = base.head.rot.z + Math.sin(time * 0.5 + phase) * 0.03;
        }
      }

      // Arms & Forearms: idle gestures, speaking gestures, and clear card-holding lift vs table-stack placement
      const gestureL = Math.sin(time * (1.1 + style * 0.2) + phase) * (0.025 + speakW * 0.06);
      const gestureR = Math.cos(time * (0.95 + style * 0.2) + phase) * (0.025 + speakW * 0.07);

      if (ud.leftArm && base.leftArm) {
        ud.leftArm.rotation.x = base.leftArm.rot.x + breath * 0.015 + holdW * 0.44 + gestureL * (1 - holdW * 0.65);
        ud.leftArm.rotation.y = base.leftArm.rot.y - holdW * 0.22;
        ud.leftArm.rotation.z = base.leftArm.rot.z + breath * 0.018;
      }
      if (ud.rightArm && base.rightArm) {
        ud.rightArm.rotation.x = base.rightArm.rot.x + breath * 0.015 + holdW * 0.44 + gestureR * (1 - holdW * 0.65);
        ud.rightArm.rotation.y = base.rightArm.rot.y + holdW * 0.22;
        ud.rightArm.rotation.z = base.rightArm.rot.z - breath * 0.018;
      }

      if (ud.lForearm && base.leftForearm) {
        ud.lForearm.rotation.x = base.leftForearm.rot.x + holdW * 0.48 + gestureL * 0.8;
        ud.lForearm.rotation.y = base.leftForearm.rot.y - holdW * 0.18 + Math.cos(time * 0.7 + phase) * 0.02;
      }
      if (ud.rForearm && base.rightForearm) {
        ud.rForearm.rotation.x = base.rightForearm.rot.x + holdW * 0.48 + gestureR * 0.8;
        ud.rForearm.rotation.y = base.rightForearm.rot.y + holdW * 0.18 + Math.sin(time * 0.8 + phase) * 0.02;
      }

      // Headset mic blinking diode (green glow pulsing)
      if (ud.diode) {
        ud.diode.material.color.setHex((Math.sin(time * 3 + i) > 0.2) ? 0x33ff66 : 0x007722);
      }
    });

    // 5. Spin RobCo Mainframe Magnetic Tape Reels
    if (this.tapeReels && this.tapeReels.length > 0) {
      this.tapeReels.forEach((reel, idx) => {
        reel.rotation.z += (idx % 2 === 0 ? 0.032 : -0.026);
      });
    }

    // 6. Blink RobCo Mainframe Status LEDs
    if (this.mainframeLeds && this.mainframeLeds.length > 0) {
      this.mainframeLeds.forEach((ledItem) => {
        if (Math.random() > 0.94) {
          const isLit = Math.random() > 0.35;
          ledItem.mesh.material.color.setHex(isLit ? ledItem.baseColor : 0x0a1014);
        }
      });
    }

    // 7. Theme-specific animated props (cryo-tubes, floating crystals, etc.)
    if (this.animatedThemeProps && this.animatedThemeProps.length > 0) {
      this.animatedThemeProps.forEach((prop) => {
        if (prop.type === 'cryo') {
          prop.mesh.scale.y = 1 + Math.sin(time * 1.8 + prop.phase) * 0.04;
        } else if (prop.type === 'spin') {
          prop.mesh.rotation.y += prop.speed || 0.02;
        }
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    this.disposeGroup(this.envGroup);
    this.disposeGroup(this.tableGroup);
    this.container.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    if (document.pointerLockElement === this.container) {
      try { document.exitPointerLock?.(); } catch (_) {}
    }
    if (this._crosshairEl?.parentNode) this._crosshairEl.parentNode.removeChild(this._crosshairEl);
    if (this._modeHintEl?.parentNode) this._modeHintEl.parentNode.removeChild(this._modeHintEl);
    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
  }
}
