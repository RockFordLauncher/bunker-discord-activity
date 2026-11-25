// CharacterPreviewScene.js — Real-Time 3D Character Preview for Customization Studio
import * as THREE from 'three';
import { buildCharacterModel } from './characterBuilder.js';
import { getDefaultCustomization } from './characterCustomizationData.js';

export class CharacterPreviewScene {
  constructor(container, initialCustomization = null) {
    this.container = container;
    this.customization = initialCustomization || getDefaultCustomization();

    this.width = container.clientWidth || 400;
    this.height = container.clientHeight || 600;

    // Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080b0e);

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 50);
    this.camera.position.set(0, 1.0, 2.8);
    this.target = new THREE.Vector3(0, 0.85, 0);
    this.camera.lookAt(this.target);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    container.appendChild(this.renderer.domElement);

    // Studio 3-Point Lighting
    this.setupLighting();

    // Pedestal Platform
    this.setupPedestal();

    // Character Model
    this.characterGroup = null;
    this.buildModel();

    // Mouse Interaction (Orbit rotation & Zoom)
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.rotationY = 0;
    this.rotationX = 0;
    this.zoomDistance = 2.8;

    this.bindEvents();

    // Render loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  setupLighting() {
    // Ambient light — clean neutral illumination so colors are true
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // Key Light (crisp studio key light, neutral-warm daylight)
    const keyLight = new THREE.DirectionalLight(0xfffaed, 1.6);
    keyLight.position.set(2.5, 3.5, 3.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0008;
    this.scene.add(keyLight);

    // Fill Light (soft cool sky-fill from left)
    const fillLight = new THREE.DirectionalLight(0x8faec9, 0.75);
    fillLight.position.set(-3.2, 2.0, 1.8);
    this.scene.add(fillLight);

    // Front Chest Fill Light (ensures all 3D pouches, belts, buckles, lapels, and fabric folds are bright and clear)
    const chestFillLight = new THREE.DirectionalLight(0xfffaed, 0.65);
    chestFillLight.position.set(0, 1.2, 2.6);
    this.scene.add(chestFillLight);

    // Rim / Back Light (clean silver-white silhouette separator — NO green tint!)
    const rimLight = new THREE.DirectionalLight(0xe8f0ff, 0.95);
    rimLight.position.set(0, 3.0, -3.5);
    this.scene.add(rimLight);

    // Under-pedestal warm amber floor bounce
    const underLight = new THREE.PointLight(0xd4a017, 0.8, 3.5);
    underLight.position.set(0, 0.08, 0);
    this.scene.add(underLight);
  }

  setupPedestal() {
    this.pedestalGroup = new THREE.Group();

    // Base cylinder in heavy industrial dark gunmetal
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x14181e,
      metalness: 0.85,
      roughness: 0.25,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.85, 0.1, 32), metalMat);
    base.position.y = -0.05;
    base.receiveShadow = true;
    this.pedestalGroup.add(base);

    // Top trim ring in polished Vault-Tec brass
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a017,
      metalness: 0.8,
      roughness: 0.25,
      emissive: 0x332200,
      emissiveIntensity: 0.15,
    });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.79, 0.02, 32), goldMat);
    rim.position.y = 0.005;
    this.pedestalGroup.add(rim);

    // Glowing center ring in warm Vault-Tec Amber (matches HUD)
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xd4a017 });
    const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.52, 32), glowMat);
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.012;
    this.pedestalGroup.add(glowRing);

    // Center Vault-Tec Logo plate
    const centerPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.015, 32),
      new THREE.MeshStandardMaterial({ color: 0x101317, metalness: 0.9, roughness: 0.2 })
    );
    centerPlate.position.y = 0.01;
    this.pedestalGroup.add(centerPlate);

    this.scene.add(this.pedestalGroup);
  }

  buildModel() {
    if (this.characterGroup) {
      this.scene.remove(this.characterGroup);
    }

    this.characterGroup = buildCharacterModel(this.customization, {
      mode: 'standing',
    });

    this.characterGroup.position.set(0, 0, 0);
    this.characterGroup.rotation.y = this.rotationY;
    this.scene.add(this.characterGroup);
  }

  updateCharacter(newCustomization) {
    this.customization = { ...newCustomization };
    this.buildModel();
  }

  bindEvents() {
    this.onMouseDown = (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    this.onMouseMove = (e) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.rotationY += deltaX * 0.01;
      this.rotationX = Math.max(-0.4, Math.min(0.4, this.rotationX + deltaY * 0.005));

      if (this.characterGroup) {
        this.characterGroup.rotation.y = this.rotationY;
      }

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    this.onMouseUp = () => {
      this.isDragging = false;
    };

    this.onWheel = (e) => {
      e.preventDefault();
      this.zoomDistance = Math.max(1.4, Math.min(4.0, this.zoomDistance + e.deltaY * 0.002));
    };

    this.onResize = () => {
      if (!this.container) return;
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    };

    this.container.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.container.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const time = this.clock.getElapsedTime();

    // Auto slow rotate if not actively dragging
    if (!this.isDragging) {
      this.rotationY += 0.004;
      if (this.characterGroup) {
        this.characterGroup.rotation.y = this.rotationY;
      }
    }

    // Camera orbit position based on zoom & vertical tilt
    const camY = 0.85 + Math.sin(this.rotationX) * this.zoomDistance * 0.6;
    const camZ = Math.cos(this.rotationX) * this.zoomDistance;
    this.camera.position.set(0, camY, camZ);
    this.camera.lookAt(this.target);

    // Subtle breathing animation on model
    if (this.characterGroup) {
      const torso = this.characterGroup.userData.torso;
      if (torso) {
        torso.scale.z = 1 + Math.sin(time * 2) * 0.025;
        torso.scale.y = 1 + Math.sin(time * 2) * 0.012;
      }

      const head = this.characterGroup.userData.head;
      if (head) {
        head.rotation.y = Math.sin(time * 0.8) * 0.05;
      }

      const diode = this.characterGroup.userData.diode;
      if (diode) {
        diode.material.color.setHex((Math.sin(time * 3) > 0.2) ? 0x33ff66 : 0x007722);
      }
    }

    // Subtle pedestal rim rotation
    if (this.pedestalGroup) {
      this.pedestalGroup.rotation.y = -time * 0.1;
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    this.container.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.container.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);

    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
  }
}
