/**
 * NEORUSH 3D — Official Three.js WebGL Engine
 * True hardware-accelerated 3D graphics, dynamic lighting, glowing neon shaders & 60-120 FPS
 */
(function(window) {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.warn('[ThreeEngine] THREE is not loaded, falling back to 2D canvas.');
    return;
  }

  let renderer = null, scene = null, camera = null;
  let canvas3D = null;
  let width = 1280, height = 720;

  // Lighting
  let ambientLight, dirLight, carHeadlight, carTailLight, carUnderLight, portalLight;

  // Meshes & Groups
  let worldGroup, roadGroup, laneDividersGroup, carGroup, objectsGroup, sceneryGroup;
  let roadMesh, curbLeft, curbRight;
  let skyDome, sunMesh, starsMesh;
  let carChassis, carCabin, carThrusterL, carThrusterR, carUnderglow;

  // Object pool for 3D representations of G.objs
  const meshPool = new Map();
  const activeMeshes = new Set();

  // Biome Themes configuration for Three.js
  const BIOME_THEMES = {
    0: { sky: 0x050a18, fog: 0x060914, road: 0x080e1c, curb: 0x00f5ff, grid: 0x00f5ff, sun: 0xff007f }, // Neo-Tokyo
    1: { sky: 0x0d071a, fog: 0x0b0616, road: 0x100820, curb: 0xd946ef, grid: 0xa855f7, sun: 0xa855f7 }, // Synthwave Sunset
    2: { sky: 0x031216, fog: 0x030e12, road: 0x05161e, curb: 0x10b981, grid: 0x06b6d4, sun: 0x00f5ff }, // Cyber Grid
    3: { sky: 0x140404, fog: 0x0f0303, road: 0x180505, curb: 0xef4444, grid: 0xf97316, sun: 0xff4400 }, // Crimson Inferno
    4: { sky: 0x040816, fog: 0x030612, road: 0x060f22, curb: 0x38bdf8, grid: 0x60a5fa, sun: 0x38bdf8 }, // Quantum Void
    5: { sky: 0x160e04, fog: 0x120b03, road: 0x181005, curb: 0xf59e0b, grid: 0xfbbf24, sun: 0xf59e0b }, // Solar Flare
    6: { sky: 0x0a0418, fog: 0x080314, road: 0x100624, curb: 0xec4899, grid: 0xc084fc, sun: 0xec4899 }, // Nebula Drift
    7: { sky: 0x021410, fog: 0x020f0c, road: 0x031a15, curb: 0x14b8a6, grid: 0x2dd4bf, sun: 0x10b981 }  // Emerald Matrix
  };

  const THREE_ENGINE = {
    active: false,
    initialized: false,

    init(targetCanvas) {
      if (this.initialized) return;

      canvas3D = targetCanvas || document.getElementById('threeCanvas');
      if (!canvas3D) {
        canvas3D = document.createElement('canvas');
        canvas3D.id = 'threeCanvas';
        canvas3D.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block;';
        const stage = document.getElementById('stage') || document.body;
        stage.insertBefore(canvas3D, stage.firstChild);
      }

      width = window.innerWidth || 1280;
      height = window.innerHeight || 720;

      // WebGL Renderer with High-Performance Settings
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: canvas3D,
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance'
        });
      } catch (e) {
        console.error('[ThreeEngine] Failed to initialize WebGLRenderer:', e);
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      // Scene & Perspective Camera (Grounded low-center arcade racer perspective)
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x060914, 0.0095);

      const isPortrait = height > width * 1.1;
      const initialFov = isPortrait ? 68 : 58;
      camera = new THREE.PerspectiveCamera(initialFov, width / height, 0.1, 420);
      camera.position.set(0, 2.25, -8.0);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 1.35, 32);

      // Lights
      ambientLight = new THREE.AmbientLight(0xffffff, 0.48);
      scene.add(ambientLight);

      dirLight = new THREE.DirectionalLight(0x00f5ff, 0.70);
      dirLight.position.set(15, 30, 20);
      scene.add(dirLight);

      carHeadlight = new THREE.PointLight(0x00f5ff, 2.2, 40, 1.4);
      carTailLight = new THREE.PointLight(0xff0055, 1.8, 14, 2.0);
      carUnderLight = new THREE.PointLight(0x00f5ff, 1.6, 6, 2.0);
      scene.add(carHeadlight);
      scene.add(carTailLight);
      scene.add(carUnderLight);

      portalLight = new THREE.PointLight(0xffd166, 0, 80, 1.6);
      scene.add(portalLight);

      // Groups
      worldGroup = new THREE.Group();
      roadGroup = new THREE.Group();
      carGroup = new THREE.Group();
      objectsGroup = new THREE.Group();
      sceneryGroup = new THREE.Group();

      scene.add(worldGroup);
      worldGroup.add(roadGroup);
      worldGroup.add(carGroup);
      worldGroup.add(objectsGroup);
      worldGroup.add(sceneryGroup);

      this.createRoad();
      this.createSkyAndHorizon();
      this.createPlayerCar();
      this.createSceneryBuildings();

      this.initialized = true;
      this.active = true;
      console.log('[ThreeEngine] Three.js WebGL Engine initialized successfully.');
    },

    resize(w, h) {
      if (!renderer || !camera) return;
      width = w;
      height = h;
      camera.aspect = width / height;
      camera.fov = (height > width * 1.1) ? 68 : 58;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    },

    createRoad() {
      // 3-lane Highway surface: span x from -4.2m to +4.2m (total 8.4m width)
      const roadGeo = new THREE.PlaneGeometry(8.4, 360, 1, 64);
      const roadMat = new THREE.MeshStandardMaterial({
        color: 0x080e1c,
        roughness: 0.50,
        metalness: 0.45
      });
      roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(0, 0, 160);
      roadGroup.add(roadMesh);

      // Glowing Neon Curbs (Left & Right)
      const curbGeo = new THREE.BoxGeometry(0.24, 0.16, 360);
      const curbMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
      curbLeft = new THREE.Mesh(curbGeo, curbMat);
      curbLeft.position.set(-4.15, 0.08, 160);
      roadGroup.add(curbLeft);

      curbRight = new THREE.Mesh(curbGeo, curbMat);
      curbRight.position.set(4.15, 0.08, 160);
      roadGroup.add(curbRight);

      // Lane Divider Dashes (x = -1.35m, x = +1.35m)
      const dashMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.70 });
      laneDividersGroup = new THREE.Group();
      const numDashes = 40;
      for (let i = 0; i < numDashes; i++) {
        const dZ = i * 9.5;
        const dGeo = new THREE.PlaneGeometry(0.14, 4.4);
        dGeo.rotateX(-Math.PI / 2);

        const dashL = new THREE.Mesh(dGeo, dashMat);
        dashL.position.set(-1.35, 0.02, dZ);
        laneDividersGroup.add(dashL);

        const dashR = new THREE.Mesh(dGeo, dashMat);
        dashR.position.set(1.35, 0.02, dZ);
        laneDividersGroup.add(dashR);
      }
      roadGroup.add(laneDividersGroup);
    },

    createSkyAndHorizon() {
      // Celestial Sky Dome (Unfogged deep cosmic background)
      const skyGeo = new THREE.SphereGeometry(360, 32, 16);
      const skyMat = new THREE.MeshBasicMaterial({
        color: 0x060914,
        side: THREE.BackSide,
        fog: false
      });
      skyDome = new THREE.Mesh(skyGeo, skyMat);
      scene.add(skyDome);

      // Distant Synthwave Sun / Neon Orb on the Horizon (Unfogged for iconic cyberpunk silhouette)
      const sunGeo = new THREE.CircleGeometry(15, 32);
      const sunMat = new THREE.MeshBasicMaterial({
        color: 0xff007f,
        side: THREE.DoubleSide,
        fog: false
      });
      sunMesh = new THREE.Mesh(sunGeo, sunMat);
      sunMesh.position.set(0, 18, 280);
      scene.add(sunMesh);

      // Starfield Particle Dust (Unfogged glittering stars)
      const starGeo = new THREE.BufferGeometry();
      const starCount = 380;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i += 3) {
        starPos[i] = (Math.random() - 0.5) * 440;
        starPos[i + 1] = 8 + Math.random() * 160;
        starPos[i + 2] = 40 + Math.random() * 260;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.6,
        transparent: true,
        opacity: 0.90,
        fog: false
      });
      starsMesh = new THREE.Points(starGeo, starMat);
      scene.add(starsMesh);
    },

    createPlayerCar() {
      // Clean, correctly-scaled Cyberpunk Race Vehicle (width 1.4m, height 0.44m, length 2.6m)
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x0b1325,
        metalness: 0.88,
        roughness: 0.22
      });
      const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
      const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
      const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff1a4b });
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        metalness: 0.95,
        roughness: 0.08,
        transparent: true,
        opacity: 0.85
      });

      // 1. Main Aerodynamic Wedge Chassis
      const bodyGeo = new THREE.BoxGeometry(1.36, 0.24, 2.5);
      carChassis = new THREE.Mesh(bodyGeo, bodyMat);
      carChassis.position.set(0, 0.20, 0);
      carGroup.add(carChassis);

      // 2. Cockpit Glass Canopy
      const cabinGeo = new THREE.BoxGeometry(0.88, 0.20, 1.25);
      carCabin = new THREE.Mesh(cabinGeo, glassMat);
      carCabin.position.set(0, 0.38, -0.15);
      carGroup.add(carCabin);

      // 3. Neon Accent Trim Side Rails
      const trimGeo = new THREE.BoxGeometry(1.40, 0.04, 2.52);
      const trim = new THREE.Mesh(trimGeo, neonMat);
      trim.position.set(0, 0.16, 0);
      carGroup.add(trim);

      // 4. Rear Aerodynamic Spoiler Wing
      const wingGeo = new THREE.BoxGeometry(1.34, 0.04, 0.22);
      const wing = new THREE.Mesh(wingGeo, bodyMat);
      wing.position.set(0, 0.44, -1.18);
      carGroup.add(wing);

      const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.24), neonMat);
      wingTipL.position.set(-0.68, 0.44, -1.18);
      carGroup.add(wingTipL);

      const wingTipR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.24), neonMat);
      wingTipR.position.set(0.68, 0.44, -1.18);
      carGroup.add(wingTipR);

      // 5. Rear Dual Thrusters (facing -Z towards camera)
      const exhaustGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.28, 16);
      exhaustGeo.rotateX(Math.PI / 2);

      carThrusterL = new THREE.Mesh(exhaustGeo, thrusterMat);
      carThrusterL.position.set(-0.36, 0.20, -1.26);
      carGroup.add(carThrusterL);

      carThrusterR = new THREE.Mesh(exhaustGeo, thrusterMat);
      carThrusterR.position.set(0.36, 0.20, -1.26);
      carGroup.add(carThrusterR);

      // 6. Rear Full-Width Neon Taillight Bar (facing camera)
      const tailGeo = new THREE.BoxGeometry(1.24, 0.06, 0.06);
      const tailMesh = new THREE.Mesh(tailGeo, taillightMat);
      tailMesh.position.set(0, 0.27, -1.26);
      carGroup.add(tailMesh);

      // 7. Front LED Splitter Headlights (facing forward +Z)
      const headGeo = new THREE.BoxGeometry(0.32, 0.06, 0.06);
      const headL = new THREE.Mesh(headGeo, neonMat);
      headL.position.set(-0.46, 0.20, 1.26);
      carGroup.add(headL);

      const headR = new THREE.Mesh(headGeo, neonMat);
      headR.position.set(0.46, 0.20, 1.26);
      carGroup.add(headR);

      // 8. Neon Underglow Plane (casts colored illumination beneath car)
      const underGeo = new THREE.PlaneGeometry(1.30, 2.3);
      underGeo.rotateX(-Math.PI / 2);
      const underMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.70 });
      carUnderglow = new THREE.Mesh(underGeo, underMat);
      carUnderglow.position.set(0, 0.04, 0);
      carGroup.add(carUnderglow);

      carGroup.position.set(0, 0, 0);
    },

    createSceneryBuildings() {
      // Skyscraper towers flanking both sides of the highway
      const bldgGeo = new THREE.BoxGeometry(16, 90, 22);
      const bldgMat = new THREE.MeshStandardMaterial({
        color: 0x090f1e,
        roughness: 0.85,
        metalness: 0.25
      });
      const windowStripMat = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        transparent: true,
        opacity: 0.55
      });

      for (let i = 0; i < 20; i++) {
        const side = (i % 2 === 0 ? -1 : 1);
        const bldgGroup = new THREE.Group();

        const b = new THREE.Mesh(bldgGeo, bldgMat);
        bldgGroup.add(b);

        // Neon edge strip on skyscraper
        const stripGeo = new THREE.BoxGeometry(0.2, 88, 0.2);
        const strip = new THREE.Mesh(stripGeo, windowStripMat);
        strip.position.set(-side * 7.9, 0, 10.9);
        bldgGroup.add(strip);

        const bz = (i * 18) % 340;
        bldgGroup.position.set(side * (24 + (i % 3) * 6), 45, bz);
        sceneryGroup.add(bldgGroup);
      }
    },

    getMeshForObject(kind) {
      if (!meshPool.has(kind)) {
        meshPool.set(kind, []);
      }
      const pool = meshPool.get(kind);
      for (const m of pool) {
        if (!m.userData.inUse) {
          m.userData.inUse = true;
          m.visible = true;
          activeMeshes.add(m);
          return m;
        }
      }

      const m = this.buildObjectMesh(kind);
      m.userData.inUse = true;
      m.userData.kind = kind;
      pool.push(m);
      objectsGroup.add(m);
      activeMeshes.add(m);
      return m;
    },

    buildObjectMesh(kind) {
      const group = new THREE.Group();

      if (kind === 'coin') {
        const geo = new THREE.CylinderGeometry(0.35, 0.35, 0.10, 18);
        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffc857,
          metalness: 0.92,
          roughness: 0.18,
          emissive: 0xffa500,
          emissiveIntensity: 0.45
        });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
      } else if (kind === 'portal_active') {
        // Single Active Quantum Portal (1-lane gate)
        const pylonMat = new THREE.MeshStandardMaterial({ color: 0x090e1c, roughness: 0.3, metalness: 0.8 });
        const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });

        const colGeo = new THREE.BoxGeometry(0.18, 3.2, 0.36);
        const colL = new THREE.Mesh(colGeo, pylonMat); colL.position.set(-1.12, 1.6, 0); group.add(colL);
        const colR = new THREE.Mesh(colGeo, pylonMat); colR.position.set(1.12, 1.6, 0); group.add(colR);

        const topGeo = new THREE.BoxGeometry(2.40, 0.26, 0.40);
        const topBeam = new THREE.Mesh(topGeo, pylonMat); topBeam.position.set(0, 3.25, 0); group.add(topBeam);

        const ringGeo = new THREE.TorusGeometry(1.08, 0.08, 16, 32);
        const ringMesh = new THREE.Mesh(ringGeo, neonMat);
        ringMesh.position.set(0, 1.65, 0);
        ringMesh.name = 'portalRing';
        group.add(ringMesh);

        const coreGeo = new THREE.CircleGeometry(0.98, 24);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xd946ef, transparent: true, opacity: 0.70 });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        coreMesh.position.set(0, 1.65, 0);
        group.add(coreMesh);
      } else if (kind === 'portal_exit') {
        // 3-LANE GRAND REALITY GATEWAY
        const pylonMat = new THREE.MeshStandardMaterial({ color: 0x0b1325, roughness: 0.25, metalness: 0.85 });
        const goldMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
        const cyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

        // Giant Outer Pylons (x = ±4.0m spanning all 3 lanes)
        const colGeo = new THREE.BoxGeometry(0.48, 4.2, 0.60);
        const colL = new THREE.Mesh(colGeo, pylonMat); colL.position.set(-4.0, 2.1, 0); group.add(colL);
        const colR = new THREE.Mesh(colGeo, pylonMat); colR.position.set(4.0, 2.1, 0); group.add(colR);

        // Giant Overhead Arch
        const topGeo = new THREE.BoxGeometry(8.5, 0.48, 0.68);
        const topBeam = new THREE.Mesh(topGeo, pylonMat); topBeam.position.set(0, 4.25, 0); group.add(topBeam);

        // Golden Solar Emitter Strip
        const stripGeo = new THREE.BoxGeometry(8.1, 0.16, 0.20);
        const strip = new THREE.Mesh(stripGeo, goldMat); strip.position.set(0, 4.25, 0.26); group.add(strip);

        // 3-Lane Grand Celestial Solar Rings
        const ringGeo1 = new THREE.TorusGeometry(3.6, 0.12, 16, 48);
        const ring1 = new THREE.Mesh(ringGeo1, goldMat);
        ring1.position.set(0, 2.1, 0);
        ring1.name = 'exitRing1';
        group.add(ring1);

        const ringGeo2 = new THREE.TorusGeometry(2.7, 0.09, 16, 36);
        const ring2 = new THREE.Mesh(ringGeo2, cyanMat);
        ring2.position.set(0, 2.1, 0);
        ring2.name = 'exitRing2';
        group.add(ring2);

        // Swirling Golden Reality Warp Core
        const coreGeo = new THREE.CircleGeometry(2.5, 32);
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0xffd166,
          transparent: true,
          opacity: 0.40,
          side: THREE.DoubleSide
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        coreMesh.position.set(0, 2.1, 0.05);
        group.add(coreMesh);
      } else if (kind === 'bar' || kind === 'wall') {
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
        const laserMat = new THREE.MeshBasicMaterial({ color: 0xff2b43 });

        const barGeo = new THREE.BoxGeometry(1.9, 0.24, 0.34);
        const barMesh = new THREE.Mesh(barGeo, frameMat);
        barMesh.position.set(0, 0.55, 0);
        group.add(barMesh);

        const laserGeo = new THREE.BoxGeometry(1.8, 0.08, 0.10);
        const laser = new THREE.Mesh(laserGeo, laserMat);
        laser.position.set(0, 0.55, 0.14);
        group.add(laser);
      } else if (kind === 'car') {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.75, roughness: 0.25 });
        const bGeo = new THREE.BoxGeometry(1.45, 0.52, 2.8);
        const bMesh = new THREE.Mesh(bGeo, bodyMat);
        bMesh.position.set(0, 0.36, 0);
        group.add(bMesh);

        // Taillights for traffic car
        const tlGeo = new THREE.BoxGeometry(0.35, 0.08, 0.05);
        const tlMat = new THREE.MeshBasicMaterial({ color: 0xff1144 });
        const tlL = new THREE.Mesh(tlGeo, tlMat); tlL.position.set(-0.45, 0.36, -1.41); group.add(tlL);
        const tlR = new THREE.Mesh(tlGeo, tlMat); tlR.position.set(0.45, 0.36, -1.41); group.add(tlR);
      } else {
        const defGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
        const defMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x00f5ff, emissiveIntensity: 0.4 });
        const defMesh = new THREE.Mesh(defGeo, defMat);
        defMesh.position.set(0, 0.45, 0);
        group.add(defMesh);
      }

      return group;
    },

    updateBiome(biomeIdx) {
      const theme = BIOME_THEMES[biomeIdx % 8] || BIOME_THEMES[0];
      if (scene && scene.fog) scene.fog.color.setHex(theme.fog);
      if (skyDome) skyDome.material.color.setHex(theme.sky);
      if (sunMesh) sunMesh.material.color.setHex(theme.sun);
      if (curbLeft && curbRight) {
        curbLeft.material.color.setHex(theme.curb);
        curbRight.material.color.setHex(theme.curb);
      }
      if (carUnderglow) {
        carUnderglow.material.color.setHex(theme.curb);
      }
    },

    render(G) {
      if (!this.initialized || !this.active || !G) return;

      // 1. Camera Follow & Dynamic Perspective (Classic low-center runner view)
      const camTargetX = (G.x || 0) * 0.32;
      const camTargetY = 2.25 + (G.y || 0) * 0.20;
      camera.position.x += (camTargetX - camera.position.x) * 0.15;
      camera.position.y += (camTargetY - camera.position.y) * 0.15;
      camera.position.z = -8.0;

      if (G.shake > 0) {
        camera.position.x += (Math.random() - 0.5) * G.shake * 0.35;
        camera.position.y += (Math.random() - 0.5) * G.shake * 0.35;
      }

      // Bank camera roll using camera.up (prevents upside-down gimbal flipping)
      const roll = (G.tilt || 0) * 0.22;
      camera.up.set(Math.sin(-roll), Math.cos(-roll), 0);
      camera.lookAt(camera.position.x * 0.65, 1.35, 32);

      // 2. Player Car Position & Dynamics
      carGroup.position.set(G.x || 0, G.y || 0, 0);
      carGroup.rotation.z = -(G.tilt || 0) * 0.35;
      carGroup.rotation.y = -(G.yaw || 0) * 0.25;

      carHeadlight.position.set((G.x || 0), (G.y || 0) + 0.35, 2.4);
      carTailLight.position.set((G.x || 0), (G.y || 0) + 0.25, -1.8);
      carUnderLight.position.set((G.x || 0), (G.y || 0) + 0.10, 0);

      // Thruster flame flicker
      const thrustScale = 1.0 + Math.sin((G.t || 0) * 24) * 0.20 + (G.boost > 0.1 ? 0.6 : 0);
      if (carThrusterL && carThrusterR) {
        carThrusterL.scale.set(1, thrustScale, 1);
        carThrusterR.scale.set(1, thrustScale, 1);
      }

      // 3. Lane Dividers and Road Parallax Streaming
      const dashSpacing = 9.5;
      if (laneDividersGroup) {
        laneDividersGroup.position.z = -((G.dist || 0) % dashSpacing);
      }

      // 4. Update Biome Atmosphere
      if (G.trackIdx != null) {
        this.updateBiome(G.trackIdx);
      }

      // 5. Reset pooled object mesh markers
      for (const m of activeMeshes) {
        m.userData.inUse = false;
        m.visible = false;
      }
      activeMeshes.clear();

      // 6. Synchronize Game Objects (G.objs) into Three.js 3D Space
      let exitPortalFound = false;
      if (G.objs && G.objs.length) {
        for (let i = 0; i < G.objs.length; i++) {
          const o = G.objs[i];
          if (o.dead || o.z < -2 || o.z > 95) continue;

          const m = this.getMeshForObject(o.kind);
          m.position.set(o.x, o.y || 0, o.z);

          // Entity-specific animation
          if (o.kind === 'coin') {
            m.rotation.y = (G.t || 0) * 3.5;
            m.position.y = 0.50 + Math.sin((G.t || 0) * 6 + o.z) * 0.10;
          } else if (o.kind === 'portal_active') {
            const pRing = m.getObjectByName('portalRing');
            if (pRing) pRing.rotation.z = (G.t || 0) * 2.8;
          } else if (o.kind === 'portal_exit') {
            exitPortalFound = true;
            portalLight.position.set(0, 3.2, o.z);
            portalLight.intensity = Math.max(1.8, Math.sin((G.t || 0) * 8) * 3.2 + 2.0);

            const r1 = m.getObjectByName('exitRing1');
            const r2 = m.getObjectByName('exitRing2');
            if (r1) r1.rotation.z = (G.t || 0) * 1.8;
            if (r2) r2.rotation.z = -(G.t || 0) * 2.4;
          }
        }
      }

      if (!exitPortalFound) {
        portalLight.intensity = 0;
      }

      // 7. Render 3D Scene to WebGL
      renderer.render(scene, camera);
    }
  };

  window.THREE_ENGINE = THREE_ENGINE;
})(window);
