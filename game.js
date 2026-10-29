
"use strict";
/* =====================================================================
   NEON YARISH 3D — mashina poygasi
   Kutubxonasiz 3D renderer (canvas2d + perspektiva), WebAudio,
   Yandex Games SDK adaptatori (majburiy emas).
   Vizual qoida: QIZIL = xavf, RANGLI = ochko.
   ===================================================================== */

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('ny3d_' + k);
      if (v == null) return d;
      const parsed = JSON.parse(v);
      if (parsed === null || parsed === undefined) return d;
      if (typeof d === 'object' && d !== null && !Array.isArray(d)) {
        if (typeof parsed !== 'object' || Array.isArray(parsed)) return d;
      }
      return parsed;
    } catch {
      return d;
    }
  },
  set(k, v) { try { localStorage.setItem('ny3d_' + k, JSON.stringify(v)); } catch {} }
};

/* --------------------------- AKKAUNT PROGRESSIYASI ---------------------------
   ⭐ OCHKO — poyga oxirida yutiladi. Ikki xil sarflanadi:
   1) akkaunt DARAJASINI oshirishga (har daraja doimiy bonus + garaj ochiladi),
   2) doimiy KUCHLARGA (UPGRADES ro'yxati).
   Tanga (🪙) esa mashina olish uchun. --------------------------------------------------- */
const ACCT = {
  lvl: Math.max(1, store.get('aLvl', 1) | 0),
  pts: Math.max(0, store.get('aPts', 0) | 0),
  total: Math.max(0, store.get('aTotal', 0) | 0),
  spent: Math.max(0, store.get('aSpent', 0) | 0),
  maxLvl: 30,
  cost(l) { return 100 + (Math.max(1, l) - 1) * 75; },
  save() { store.set('aLvl', this.lvl); store.set('aPts', this.pts); store.set('aTotal', this.total); store.set('aSpent', this.spent); },
  add(n) { n = Math.max(0, Math.floor(n) || 0); this.pts += n; this.total += n; this.save(); return n; },
  can(lvl) { return lvl <= this.lvl; },
  canUp() { return this.lvl < this.maxLvl && this.pts >= this.cost(this.lvl); },
  up() {
    if (this.lvl >= this.maxLvl) { toast('⭐ Достигнут максимальный уровень!'); return false; }
    const c = this.cost(this.lvl);
    if (this.pts < c) { toast('Не хватает ' + (c - this.pts) + ' ⭐ очков'); Sound.blip(200, .12, 'sawtooth', .18); return false; }
    this.pts -= c; this.spent += c; this.lvl++; this.save();
    Sound.chord([523, 659, 784, 1046], .4, .2);
    toast('⭐ ОТКРЫТ ' + this.lvl + '-Й УРОВЕНЬ АККАУНТА! ' + this.nextBonusText(this.lvl), 2600);
    renderAcct(); renderPerks(); renderShips(); menuStats();
    return true;
  },
  /* --- Daraja bonuslari (hisoblagich — bir joydan boshqariladi) --- */
  speedMul() { return 1 + (this.lvl - 1) * .012; },
  coinMul() { return 1 + (this.lvl - 1) * .015; },
  extraEnergon() { return Math.floor((this.lvl - 1) / 4) * 15; },
  extraLives() { return Math.floor((this.lvl - 1) / 5); },
  jumpMul() { return 1 + Math.floor((this.lvl - 1) / 3) * .03; },
  extraShield() { return Math.floor((this.lvl - 1) / 6) * 3; },
  bonusRows() {
    return [
      ['⚡ Базовая скорость', '+' + Math.round((this.speedMul() - 1) * 100) + '%'],
      ['🪙 Монеты и очки', '+' + Math.round((this.coinMul() - 1) * 100) + '%'],
      ['❤ Дополнительные жизни', this.extraLives()],
      ['🛢 Запас нитро', '+' + this.extraEnergon()],
      ['🦘 Сила прыжка', '+' + Math.round((this.jumpMul() - 1) * 100) + '%'],
      ['🛡 Стартовый щит', this.extraShield() + ' с'],
      ['🚗 Гараж', CARS.filter(c => c.lvl <= this.lvl).length + ' / ' + CARS.length + ' машин открыто']
    ];
  },
  nextBonusText(n) {
    n = n == null ? this.lvl : n; // n = yangi daraja
    const b = ['⚡ Скорость +1,2%'];
    if (n % 4 === 1) b.push('🛢 Запас нитро +15');
    if (n % 5 === 1) b.push('❤ Дополнительная жизнь +1');
    if (n % 3 === 1) b.push('🦘 Прыжок +3%');
    if (n % 6 === 1) b.push('🛡 Щит +3 с');
    const nc = CARS.filter(c => (c.lvl || 1) === n).map(c => c.name);
    if (nc.length) b.push('🔓 Новая машина: ' + nc.join(', '));
    return b.join(' · ');
  },
  /* Poyga natijasidan ochko hisoblash */
  runPoints(g) {
    return Math.floor(g.score / 45) + Math.floor(g.dist / 10) + (g.level - 1) * 20 +
      (g.runCoins || 0) + (g.meta && g.meta.best && g.score >= g.meta.best ? 40 : 0);
  }
};
const PERM = {
  data: store.get('perm', {}),
  n(k) { return this.data[k] | 0; },
  price(u) { return Math.round((u.pc || 60) * (1 + this.n(u.k) * .85)); },
  rankMax(u) { return u.max || 3; },
  buyable(u) {
    if (this.n(u.k) >= this.rankMax(u)) return 'max';
    if (!ACCT.can(u.pl || 1)) return 'lvl';
    if (ACCT.pts < this.price(u)) return 'pts';
    return 'ok';
  },
  buy(u) {
    const st = this.buyable(u);
    if (st === 'max') { toast(u.ic + ' Улучшение уже максимального уровня'); return false; }
    if (st === 'lvl') { toast('🔒 Требуется ' + (u.pl || 1) + '-й уровень аккаунта'); Sound.blip(200, .12, 'sawtooth', .18); return false; }
    if (st === 'pts') { toast('Не хватает ' + (this.price(u) - ACCT.pts) + ' ⭐ очков'); Sound.blip(200, .12, 'sawtooth', .18); return false; }
    ACCT.pts -= this.price(u); ACCT.spent += this.price(u);
    this.data[u.k] = this.n(u.k) + 1;
    store.set('perm', this.data); ACCT.save();
    Sound.chord([659, 880, 1174], .3, .18);
    toast(u.ic + ' ' + u.name + ' → уровень ' + this.n(u.k) + '/' + this.rankMax(u));
    return true;
  },
  reset() { this.data = {}; store.set('perm', {}); }
};

/* --------------------------- 3D MATEMATIKA --------------------------- */
const CAM = { x: 0, y: 2.25, z: -8.0, fov: 620 };
const LIGHT = [0.38, 0.80, -0.46];
let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, skyGrad = null, FOV_BASE = 620;
const canvas = document.getElementById('gl');
let ctx = canvas.getContext('2d', { alpha: false });

function detectInitialQuality() {
  const saved = store.get('qual', null);
  if (saved === 'low' || saved === 'medium' || saved === 'high') return saved;
  const coarse = (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in window);
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 8;
  const mem = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 8;
  const minDim = Math.min(window.innerWidth || 960, window.innerHeight || 600);
  if (coarse && (cores <= 4 || mem <= 3 || minDim <= 375)) return 'low';
  if (coarse || minDim < 768) return 'medium';
  return 'high';
}
function qualLabel(q) {
  return q === 'low' ? 'Низкая' : (q === 'medium' ? 'Средняя' : 'Высокая');
}
function syncQualityClass() {
  if (!document.body || !document.body.classList) return;
  const q = (typeof G !== 'undefined' && G.quality) || 'high';
  document.body.classList.toggle('qual-low', q === 'low');
  document.body.classList.toggle('qual-med', q === 'medium');
}

function resize() {
  const q = (typeof G !== 'undefined' && G.quality) || 'high';
  const maxDpr = q === 'low' ? 1.0 : (q === 'medium' ? 1.25 : 1.5);
  DPR = Math.min(window.devicePixelRatio || 1, maxDpr);
  W = Math.max(280, window.innerWidth || 960);
  H = Math.max(240, window.innerHeight || 600);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx = W / 2;
  // Portretda gorizontni yuqoriroq qo'yamiz — yo'lga ko'proq joy qolsin.
  const portrait = H > W * 1.05;
  if (typeof G !== 'undefined') G.portrait = portrait;
  cy = Math.round(H * (portrait ? 0.44 : 0.52));
  // FOV: chetki qatorlar har doim ekranda sig'ishi kerak — kenglik asosiy cheklov.
  FOV_BASE = Math.round(Math.max(280, Math.min(Math.min(W * 1.02, H * (portrait ? 1.35 : 1.30)), 980)));
  CAM.fov = FOV_BASE;
  skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#070a20'); skyGrad.addColorStop(.40, '#180b3c');
  skyGrad.addColorStop(.60, '#40104a'); skyGrad.addColorStop(1, '#0a0620');
  syncQualityClass();
}

function proj(p, out) {
  const dz = p[2] - CAM.z;
  if (dz < 0.4) { out.vis = false; return out; }
  const s = CAM.fov / dz;
  out.x = cx + (p[0] - CAM.x) * s;
  out.y = cy - (p[1] - CAM.y) * s;
  out.s = s; out.dz = dz; out.vis = true;
  return out;
}
const _a = { x: 0, y: 0, s: 0, dz: 0, vis: true };
const _b = { x: 0, y: 0, s: 0, dz: 0, vis: true };
const _c = { x: 0, y: 0, s: 0, dz: 0, vis: true };
const _d = { x: 0, y: 0, s: 0, dz: 0, vis: true };
const _pv = [{ x: 0, y: 0, s: 0, dz: 0, vis: true }, { x: 0, y: 0, s: 0, dz: 0, vis: true },
             { x: 0, y: 0, s: 0, dz: 0, vis: true }, { x: 0, y: 0, s: 0, dz: 0, vis: true },
             { x: 0, y: 0, s: 0, dz: 0, vis: true }, { x: 0, y: 0, s: 0, dz: 0, vis: true }];
const _pw = { x: 0, y: 0, s: 0, dz: 0, vis: true };
const _pw2 = { x: 0, y: 0, s: 0, dz: 0, vis: true };

/* ------------------- NEORUSH NEON CYBERPUNK DESIGN SYSTEM -------------------
   Centralized visual configuration for colors, emissive intensity, metalness,
   roughness, glow settings, graphics quality tiers, and reusable materials/assets. */
const DESIGN_SYSTEM = {
  palette: {
    obsidianBlack: '#090D18',
    deepNavy:      '#0D1725',
    electricCyan:  '#00E5FF',
    neonViolet:    '#A855F7',
    energyGold:    '#FFC857',
    warningOrange: '#FF6B35',
    dangerRed:     '#FF2B43',
    emeraldBio:    '#10B981',
    cleanWhite:    '#F1F5F9',
    slateSteel:    '#64748B'
  },
  qualityTiers: {
    low: {
      id: 'low', label: 'Низкая', maxDpr: 1.0, roadSegs: 28, starCount: 60,
      atmoCount: 28, maxParticles: 36, glowEnabled: false, faceStroke: false,
      shadowBlurScale: 0, specularBoost: 0.08
    },
    medium: {
      id: 'medium', label: 'Средняя', maxDpr: 1.25, roadSegs: 38, starCount: 105,
      atmoCount: 52, maxParticles: 75, glowEnabled: true, faceStroke: true,
      shadowBlurScale: 0.5, specularBoost: 0.16
    },
    high: {
      id: 'high', label: 'Высокая', maxDpr: 1.5, roadSegs: 48, starCount: 150,
      atmoCount: 75, maxParticles: 140, glowEnabled: true, faceStroke: true,
      shadowBlurScale: 1.0, specularBoost: 0.24
    }
  },
  getQualityConfig(q) {
    const key = q || ((typeof G !== 'undefined' && G.quality) || 'high');
    return this.qualityTiers[key] || this.qualityTiers.high;
  }
};

/* Reusable Material Registry (supports metalness, roughness, emissive intensity, alpha, and colors) */
const MATERIALS = {
  vehicleDarkMetal: {
    id: 'vehicleDarkMetal', color: '#090D18', top: '#161C2A', bot: '#05070E',
    metalness: 0.88, roughness: 0.22, emissive: false, emissiveIntensity: 0, alpha: 1.0
  },
  vehicleCarbon: {
    id: 'vehicleCarbon', color: '#161C2A', top: '#242E42', bot: '#090D18',
    metalness: 0.72, roughness: 0.35, emissive: false, emissiveIntensity: 0, alpha: 1.0
  },
  vehicleChrome: {
    id: 'vehicleChrome', color: '#B7C4D8', top: '#F1F5F9', bot: '#64748B',
    metalness: 0.95, roughness: 0.12, emissive: true, emissiveIntensity: 0.35, alpha: 1.0
  },
  emissiveCyan: {
    id: 'emissiveCyan', color: '#00E5FF', top: '#80F5FF', bot: '#0099B8',
    metalness: 0.20, roughness: 0.10, emissive: true, emissiveIntensity: 1.25, glowRadius: 1.6, alpha: 1.0
  },
  emissiveViolet: {
    id: 'emissiveViolet', color: '#A855F7', top: '#D8B4FE', bot: '#6B21A8',
    metalness: 0.25, roughness: 0.12, emissive: true, emissiveIntensity: 1.20, glowRadius: 1.6, alpha: 1.0
  },
  roadAsphalt: {
    id: 'roadAsphalt', color: '#0D1725', altColor: '#132034', laneColor: '#F1F5F9', curbColor: '#00E5FF',
    metalness: 0.35, roughness: 0.75, emissive: false, emissiveIntensity: 0.15, alpha: 0.92
  },
  goldCollectible: {
    id: 'goldCollectible', color: '#FFC857', top: '#FFFBEB', rim: '#D97706',
    metalness: 0.94, roughness: 0.15, emissive: true, emissiveIntensity: 1.15, glowRadius: 1.5, alpha: 1.0
  },
  energyTransparent: {
    id: 'energyTransparent', color: '#00E5FF', secondary: '#7DFFE4',
    metalness: 0.10, roughness: 0.08, emissive: true, emissiveIntensity: 1.30, glowRadius: 1.7, alpha: 0.55
  },
  industrialMetal: {
    id: 'industrialMetal', color: '#1E293B', top: '#FF6B35', hazard: '#FF2B43',
    metalness: 0.80, roughness: 0.40, emissive: false, emissiveIntensity: 0.20, alpha: 1.0
  },
  iceCrystalline: {
    id: 'iceCrystalline', color: '#38BDF8', top: '#E0F2FE', bot: '#0284C7',
    metalness: 0.65, roughness: 0.14, emissive: true, emissiveIntensity: 0.85, alpha: 0.90
  },
  desertSandstone: {
    id: 'desertSandstone', color: '#FF6B35', top: '#FFC857', bot: '#7C2D12',
    metalness: 0.18, roughness: 0.82, emissive: false, emissiveIntensity: 0.15, alpha: 1.0
  },
  alienBiolum: {
    id: 'alienBiolum', color: '#10B981', top: '#6EE7B7', accent: '#A855F7',
    metalness: 0.30, roughness: 0.28, emissive: true, emissiveIntensity: 1.10, alpha: 1.0
  },
  cosmicVoid: {
    id: 'cosmicVoid', color: '#090D18', top: '#A855F7', accent: '#00E5FF',
    metalness: 0.78, roughness: 0.18, emissive: true, emissiveIntensity: 1.25, alpha: 0.95
  },
  cityGlassSlate: {
    id: 'cityGlassSlate', color: '#0f172a', top: '#38bdf8', bot: '#020617',
    metalness: 0.88, roughness: 0.14, emissive: false, emissiveIntensity: 0, alpha: 1.0
  },
  forestBark: {
    id: 'forestBark', color: '#3f271d', top: '#059669', bot: '#1c1917',
    metalness: 0.12, roughness: 0.88, emissive: false, emissiveIntensity: 0, alpha: 1.0
  },
  glacialIce: {
    id: 'glacialIce', color: '#bae6fd', top: '#ffffff', bot: '#0284c7',
    metalness: 0.82, roughness: 0.12, emissive: false, emissiveIntensity: 0, alpha: 1.0
  },
  volcanicBasalt: {
    id: 'volcanicBasalt', color: '#1c1917', top: '#44403c', bot: '#090505',
    metalness: 0.25, roughness: 0.85, emissive: false, emissiveIntensity: 0, alpha: 1.0
  },
  moltenMagma: {
    id: 'moltenMagma', color: '#ff4500', top: '#fef08a', bot: '#991b1b',
    metalness: 0.40, roughness: 0.30, emissive: true, emissiveIntensity: 1.35, alpha: 1.0
  },
  oceanCoral: {
    id: 'oceanCoral', color: '#0d9488', top: '#2dd4bf', bot: '#042f2e',
    metalness: 0.45, roughness: 0.40, emissive: true, emissiveIntensity: 0.90, alpha: 1.0
  },
  oceanAbyssStone: {
    id: 'oceanAbyssStone', color: '#062d4a', top: '#0d4f7a', bot: '#021827',
    metalness: 0.55, roughness: 0.45, emissive: false, emissiveIntensity: 0.15, alpha: 1.0
  },
  astralFloatingStone: {
    id: 'astralFloatingStone', color: '#24063d', top: '#4a1575', bot: '#120220',
    metalness: 0.50, roughness: 0.50, emissive: false, emissiveIntensity: 0.20, alpha: 1.0
  },
  arcaneMythic: {
    id: 'arcaneMythic', color: '#581C87', top: '#C084FC', bot: '#1E0538',
    metalness: 0.70, roughness: 0.20, emissive: true, emissiveIntensity: 1.15, alpha: 1.0
  }
};

/* Shared Asset & Geometry Cache Registry with Procedural Fallback Support */
const ASSET_REGISTRY = {
  meshes: new Map(),
  materials: MATERIALS,
  design: DESIGN_SYSTEM,
  registerMesh(id, factoryOrMesh) {
    if (this.meshes.has(id)) return this.meshes.get(id);
    const mesh = typeof factoryOrMesh === 'function' ? factoryOrMesh() : factoryOrMesh;
    if (mesh) {
      mesh._assetId = id;
      this.meshes.set(id, mesh);
    }
    return mesh;
  },
  getMesh(id, fallbackFactory) {
    if (this.meshes.has(id)) return this.meshes.get(id);
    if (typeof fallbackFactory === 'function') return this.registerMesh(id, fallbackFactory);
    return null;
  },
  getMaterial(id) {
    return this.materials[id] || this.materials.industrialMetal;
  },
  applyMaterialProps(boxOrWedge, matId) {
    const mat = this.getMaterial(matId);
    if (!mat) return boxOrWedge;
    if (!boxOrWedge.c) boxOrWedge.c = mat.color;
    if (mat.top && !boxOrWedge.top) boxOrWedge.top = mat.top;
    if (mat.bot && !boxOrWedge.bot) boxOrWedge.bot = mat.bot;
    if (mat.emissive && boxOrWedge.em === undefined) boxOrWedge.em = true;
    boxOrWedge.mat = matId;
    return boxOrWedge;
  },
  stats() {
    return {
      cachedMeshes: this.meshes.size,
      registeredMaterials: Object.keys(this.materials).length,
      shadeCacheSize: shadeCache.size
    };
  }
};

/** Mesh yuzalarini dunyo koordinatalariga otkazib, yorug'lik va rang bilan qaytaradi. */
function facesOf(mesh, pos, rotY, S) {
  S = S || 1;
  const out = [];
  const mv = mesh.v, n = mv.length, vs = mesh._vs || (mesh._vs = new Array(n));
  if (!rotY && S === 1) {
    const px = pos[0], py = pos[1], pz = pos[2];
    for (let i = 0; i < n; i++) {
      const p = mv[i];
      const v = vs[i] || (vs[i] = [0, 0, 0]);
      v[0] = px + p[0];
      v[1] = py + p[1];
      v[2] = pz + p[2];
    }
  } else {
    const cs = Math.cos(rotY), sn = Math.sin(rotY);
    for (let i = 0; i < n; i++) {
      const p = mv[i];
      const x = p[0] * S, y = p[1] * S, z = p[2] * S;
      const v = vs[i] || (vs[i] = [0, 0, 0]);
      v[0] = pos[0] + x * cs - z * sn;
      v[1] = pos[1] + y;
      v[2] = pos[2] + x * sn + z * cs;
    }
  }
  const L = mesh.light || LIGHT, cols = mesh.c, em = mesh.em, mats = mesh.mat;
  const qCfg = DESIGN_SYSTEM.getQualityConfig();
  const fcPool = mesh._fc || (mesh._fc = new Array(mesh.f.length));
  const camX = CAM.x, camY = CAM.y, camZ = CAM.z;
  for (let fi = 0; fi < mesh.f.length; fi++) {
    const f = mesh.f[fi], cnt = f.length;
    let zAvg = 0, xAvg = 0, yAvg = 0;
    for (let i = 0; i < cnt; i++) {
      const vi = vs[f[i]];
      xAvg += vi[0];
      yAvg += vi[1];
      zAvg += vi[2];
    }
    xAvg /= cnt; yAvg /= cnt; zAvg /= cnt;
    if (zAvg < camZ + 0.8) continue;
    const a = vs[f[0]], b = vs[f[1]], c = vs[f[2]];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const ln = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    const diff = Math.abs((nx / ln) * L[0] + (ny / ln) * L[1] + (nz / ln) * L[2]);
    let fc = fcPool[fi];
    if (!fc) fc = fcPool[fi] = { f, vs, z: zAvg, rawZ: zAvg, col: cols[fi], l: 1, em: false };
    fc.f = f; fc.vs = vs;
    // True 3D Euclidean distance from camera ensures visible inner/front/top faces always sort in front of hidden outer/back faces
    const cdx = xAvg - camX, cdy = yAvg - camY, cdz = zAvg - camZ;
    fc.z = (cdz > 2) ? (cdz + (cdx * cdx + cdy * cdy) / (2 * cdz) + camZ) : (Math.sqrt(cdx * cdx + cdy * cdy + cdz * cdz) + camZ);
    fc.rawZ = zAvg;
    fc.col = cols[fi];
    fc.em = !!(em && em[fi]);
    if (fc.em) {
      fc.l = 1.08;
    } else {
      const matObj = mats && mats[fi] ? MATERIALS[mats[fi]] : null;
      const spec = (matObj && matObj.metalness > 0.6 && diff > 0.72) ? (diff - 0.72) * qCfg.specularBoost * matObj.metalness : 0;
      fc.l = 0.36 + 0.64 * diff + spec;
    }
    out.push(fc);
  }
  return out;
}

let _cachedFogHex = null;
let _cachedFogTrack = -999;
let _cachedFogDim = -999;

const _pp = [];
function drawFace(fc) {
  const idx = fc.f, vs = fc.vs, pts = fc.pts;
  const n = pts ? pts.length : idx.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts ? pts[i] : vs[idx[i]];
    const o = _pp[i] || (_pp[i] = { x: 0, y: 0, s: 0, dz: 0, vis: true });
    proj(p, o);
    if (!o.vis) return;
    i ? ctx.lineTo(o.x, o.y) : ctx.moveTo(o.x, o.y);
  }
  ctx.closePath();
  const distZ = (fc.rawZ !== undefined ? fc.rawZ : fc.z) - CAM.z;
  const horizonAlpha = distZ > 70 ? Math.max(0, 1 - (distZ - 70) / 18) : 1.0;
  if (horizonAlpha <= 0.01) return;
  ctx.globalAlpha = fc.alpha !== undefined ? fc.alpha * horizonAlpha : horizonAlpha;

  if (typeof G !== 'undefined' && (G.trackIdx !== _cachedFogTrack || G.dimensionIdx !== _cachedFogDim)) {
    _cachedFogTrack = G.trackIdx;
    _cachedFogDim = G.dimensionIdx;
    const bm = typeof currentBiome === 'function' ? currentBiome() : null;
    _cachedFogHex = bm && bm.sky2 ? bm.sky2 : null;
  }
  const fogHex = _cachedFogHex;
  const fogAmt = (!fogHex || distZ < 15) ? 0 : Math.min(fc.em ? 0.22 : 0.70, (distZ - 15) / 72);
  const fillCol = fogAmt > 0.02 ? shadeFog(fc.col, fc.l, fogHex, fogAmt) : shade(fc.col, fc.l);
  ctx.fillStyle = fillCol;
  ctx.fill();
  const q = (typeof G !== 'undefined' && G.quality) || 'high';
  if (q === 'high' ? distZ < 15 : (q === 'medium' && distZ < 10)) {
    ctx.strokeStyle = fogAmt > 0.02 ? fillCol : shade(fc.col, fc.l * 1.12);
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const shadeCache = new Map();
function shade(hex, l) {
  const key = hex + (l * 100 | 0);
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const out2 = 'rgb(' + (Math.min(255, r * l) | 0) + ',' + (Math.min(255, g * l) | 0) + ',' + (Math.min(255, b * l) | 0) + ')';
  if (shadeCache.size < 6000) shadeCache.set(key, out2);
  return out2;
}

function shadeFog(hex, l, fogHex, fogAmt) {
  const fQuant = (fogAmt * 20) | 0;
  if (fQuant <= 0) return shade(hex, l);
  const key = hex + '_' + (l * 50 | 0) + '_' + fogHex + '_' + fQuant;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) * l);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) * l);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) * l);
  const fr = parseInt(fogHex.slice(1, 3), 16) || 20;
  const fg = parseInt(fogHex.slice(3, 5), 16) || 15;
  const fb = parseInt(fogHex.slice(5, 7), 16) || 40;
  const k = fQuant / 20;
  const out2 = 'rgb(' + ((r * (1 - k) + fr * k) | 0) + ',' + ((g * (1 - k) + fg * k) | 0) + ',' + ((b * (1 - k) + fb * k) | 0) + ')';
  if (shadeCache.size < 6000) shadeCache.set(key, out2);
  return out2;
}

/* --------------------------- MESH QURGICHLAR --------------------------- */
const CUBE_V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const CUBE_F = [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]];
/* yuza tartibi: -z, +z, -x, +x, +y(top), -y(bottom) */

function emptyMesh() { return { v: [], f: [], c: [], em: [], mat: [] }; }
function mergeMesh() {
  const m = emptyMesh();
  for (let k = 0; k < arguments.length; k++) {
    const s = arguments[k]; if (!s) continue;
    const base = m.v.length;
    for (const v of s.v) m.v.push([v[0], v[1], v[2]]);
    for (let i = 0; i < s.f.length; i++) {
      m.f.push(s.f[i].map(ix => ix + base));
      m.c.push(s.c[i]); m.em.push(s.em[i]);
      m.mat.push(s.mat ? s.mat[i] : null);
    }
  }
  return m;
}
/** Torisiimon (klin) blok: orqa (-z) va old (+z) kesimlari har xil o'lchamda.
    w = {p:[x,y,z], hz, rr:[hx,hy], fr:[hx,hy], ry?, fy?, c, top?, bot?, em?, mat?}
    rr/fr — yarm o'lchamlar, ry/fy — kesim markazining y surilishi.
    Yuza tartibi: 0 -z, 1 +z, 2 -y(past), 3 +y(ust), 4 -x, 5 +x */
function meshOfWedges(list) {
  const m = emptyMesh();
  for (const w of list) {
    if (w.mat && MATERIALS[w.mat]) ASSET_REGISTRY.applyMaterialProps(w, w.mat);
    const px = w.p[0], py = w.p[1], pz = w.p[2], hz = w.hz || .1;
    const rx = w.rr[0], ryh = w.rr[1], fx = w.fr[0], fyh = w.fr[1];
    const ryc = py + (w.ry || 0), fyc = py + (w.fy || 0);
    const rz = pz - hz, fz = pz + hz;
    const base = m.v.length;
    m.v.push(
      [px - rx, ryc - ryh, rz], [px + rx, ryc - ryh, rz], [px + rx, ryc + ryh, rz], [px - rx, ryc + ryh, rz],
      [px - fx, fyc - fyh, fz], [px + fx, fyc - fyh, fz], [px + fx, fyc + fyh, fz], [px - fx, fyc + fyh, fz]);
    const F = [[0, 1, 2, 3], [5, 4, 7, 6], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    for (let fi = 0; fi < 6; fi++) {
      m.f.push(F[fi].map(i => i + base));
      const col = fi === 3 && w.top ? w.top : fi === 2 && w.bot ? w.bot : (w.c || '#c9d6ff');
      m.c.push(col); m.em.push(!!w.em);
      m.mat.push(w.mat || 'vehicleDarkMetal');
    }
  }
  return m;
}
/** boxes: [{p:[x,y,z], s:[hx,hy,hz], c:'#rrggbb', top?, bot?, side?, front?, back?, em?, mat?}]
    side = ±x yoqlari, front = +z (old), back = -z (ort) — g'ildirak diski va
    far/orqa chiroqlar shu orqali alohida ranglanadi. */
function meshOfBoxes(boxes) {
  const m = emptyMesh();
  for (const b of boxes) {
    if (b.mat && MATERIALS[b.mat]) ASSET_REGISTRY.applyMaterialProps(b, b.mat);
    const px = b.p[0], py = b.p[1], pz = b.p[2];
    const hx = b.s[0], hy = b.s[1], hz = b.s[2];
    const base = m.v.length;
    for (const u of CUBE_V) m.v.push([px + u[0] * hx, py + u[1] * hy, pz + u[2] * hz]);
    for (let fi = 0; fi < 6; fi++) {
      m.f.push(CUBE_F[fi].map(i => i + base));
      let col = b.c || '#c9d6ff';
      if (fi === 4 && b.top) col = b.top;
      else if (fi === 5 && b.bot) col = b.bot;
      else if (fi === 0 && b.back) col = b.back;
      else if (fi === 1 && b.front) col = b.front;
      else if ((fi === 2 || fi === 3) && b.side) col = b.side;
      m.c.push(col); m.em.push(!!b.em);
      m.mat.push(b.mat || 'vehicleDarkMetal');
    }
  }
  return m;
}
function meshOfSportWheel(p, size, accent) {
  const m = emptyMesh(), n = 8;
  const [hx, ry, rz] = size, [px, py, pz] = p;
  const rimCol = accent || '#00e5ff';

  // 1. Tashqi shina protektori (Outer tire tread cylinder)
  const baseTire = m.v.length;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28318;
    const y = Math.cos(a), z = Math.sin(a);
    m.v.push([px - hx, py + y * ry, pz + z * rz]); // Left outer
    m.v.push([px + hx, py + y * ry, pz + z * rz]); // Right outer
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const f0 = baseTire + i * 2, f1 = baseTire + j * 2;
    m.f.push([f0, f1, f1 + 1, f0 + 1]);
    m.c.push('#10141e'); m.em.push(false); m.mat.push('vehicleDarkMetal');
  }

  // 2. Shina yoni va disk labi (Sidewalls & Rim faces)
  for (const side of [-1, 1]) {
    const sx = px + side * (hx + 0.005);
    const baseLip = m.v.length;
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.28318;
      m.v.push([sx, py + Math.cos(a) * ry * 0.72, pz + Math.sin(a) * rz * 0.72]);
    }
    const baseOuter = side === -1 ? baseTire : baseTire + 1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const o0 = baseOuter + i * 2, o1 = baseOuter + j * 2;
      const l0 = baseLip + i, l1 = baseLip + j;
      m.f.push([o0, o1, l1, l0]);
      m.c.push('#1b2230'); m.em.push(false); m.mat.push('vehicleCarbon');
    }

    // Aero sport spitsalari (Turbine alloy spokes)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * 6.28318;
      const cosA = Math.cos(a), sinA = Math.sin(a);
      const w = 0.038, rIn = 0.16, rOut = 0.68;
      const bSpoke = m.v.length;
      m.v.push(
        [sx + side * 0.005, py + (cosA * rIn - sinA * w) * ry, pz + (sinA * rIn + cosA * w) * rz],
        [sx + side * 0.005, py + (cosA * rOut - sinA * w) * ry, pz + (sinA * rOut + cosA * w) * rz],
        [sx + side * 0.005, py + (cosA * rOut + sinA * w) * ry, pz + (sinA * rOut - cosA * w) * rz],
        [sx + side * 0.005, py + (cosA * rIn + sinA * w) * ry, pz + (sinA * rIn - cosA * w) * rz]
      );
      m.f.push([bSpoke, bSpoke + 1, bSpoke + 2, bSpoke + 3]);
      m.c.push(rimCol); m.em.push(true); m.mat.push('emissiveCyan');
    }

    // Markaziy stupitsa (Center hub cap)
    const hubBase = m.v.length;
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.28318;
      m.v.push([sx + side * 0.007, py + Math.cos(a) * ry * 0.22, pz + Math.sin(a) * rz * 0.22]);
    }
    const hubF = [];
    for (let i = 0; i < n; i++) hubF.push(hubBase + (side === -1 ? i : n - 1 - i));
    m.f.push(hubF); m.c.push('#222c3d'); m.em.push(false); m.mat.push('vehicleChrome');
  }

  // 3. Tormoz diski va sport support (Brake rotor & caliper)
  const rotorBase = m.v.length;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28318;
    m.v.push([px, py + Math.cos(a) * ry * 0.50, pz + Math.sin(a) * rz * 0.50]);
  }
  const rotorF = [];
  for (let i = 0; i < n; i++) rotorF.push(rotorBase + i);
  m.f.push(rotorF); m.c.push('#475569'); m.em.push(false); m.mat.push('industrialMetal');

  const calBase = m.v.length;
  m.v.push(
    [px - hx * 0.5, py + ry * 0.36, pz + rz * 0.16],
    [px + hx * 0.5, py + ry * 0.36, pz + rz * 0.16],
    [px + hx * 0.5, py + ry * 0.52, pz + rz * 0.34],
    [px - hx * 0.5, py + ry * 0.52, pz + rz * 0.34]
  );
  m.f.push([calBase, calBase + 1, calBase + 2, calBase + 3]);
  m.c.push('#ff2b43'); m.em.push(true); m.mat.push('emissiveViolet');

  return m;
}
/** tekis halqa (tangа) — XY tekisligi, aylanishda flipped ko'rinadi */
function meshOfRing(R, RI, col, N) {
  N = N || 8;
  const m = emptyMesh();
  for (let i = 0; i < N; i++) { const u = i / N * 6.283; m.v.push([R * Math.cos(u), R * Math.sin(u), 0]); }
  for (let i = 0; i < N; i++) { const u = i / N * 6.283; m.v.push([RI * Math.cos(u), RI * Math.sin(u), 0]); }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    m.f.push([i, j, N + j, N + i]); m.c.push(col); m.em.push(true);
  }
  return m;
}
/** Qalin tangа (disk) — XY tekisligida, qalinligi Z bo'ylab. Aylansa ham g'oyib bo'lmaydi. */
function meshOfCoin(R, TH, N, col, hubCol) {
  N = N || 12;
  const m = emptyMesh();
  const hz = TH / 2, ri = R * .58;
  // old (z=+hz) va orqa (z=-hz) qirralari + yon qirra
  for (let i = 0; i < N; i++) { const u = i / N * 6.283; m.v.push([R * Math.cos(u), R * Math.sin(u), hz]); }
  for (let i = 0; i < N; i++) { const u = i / N * 6.283; m.v.push([R * Math.cos(u), R * Math.sin(u), -hz]); }
  const F = [], B = [];
  for (let i = 0; i < N; i++) F.push(i);
  for (let i = N - 1; i >= 0; i--) B.push(N + i);
  m.f.push(F); m.c.push(col); m.em.push(true);
  m.f.push(B); m.c.push(hubCol || col); m.em.push(true);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    m.f.push([i, j, N + j, N + i]); m.c.push('#b8862b'); m.em.push(false);
  }
  // markazdoym muhr (halqa) — qirralarni yorqinroq ko'rsatadi
  for (let i = 0; i < N; i++) { const u = i / N * 6.283; m.v.push([ri * Math.cos(u), ri * Math.sin(u), hz + .01]); }
  const hub = [];
  for (let i = N - 1; i >= 0; i--) hub.push(2 * N + i);
  m.f.push(hub); m.c.push('#fff3c4'); m.em.push(true);
  return m;
}
/** oktaedr (olmos) */
function meshOfOcta(r, h, col) {
  const m = emptyMesh();
  m.v.push([0, h, 0], [0, -h, 0], [r, 0, 0], [-r, 0, 0], [0, 0, r], [0, 0, -r]);
  const F = [[0,4,2],[0,2,5],[0,5,3],[0,3,4],[1,2,4],[1,5,2],[1,3,5],[1,4,3]];
  for (const f of F) { m.f.push(f); m.c.push(col); m.em.push(true); }
  return m;
}
/** prizma (n qirrali ustun) — pastki markaz [0,0,0], balandlik h */
function meshOfPrism(r, h, n, col, topCol) {
  const m = emptyMesh();
  for (let i = 0; i < n; i++) { const u = i / n * 6.283; m.v.push([r * Math.cos(u), 0, r * Math.sin(u)]); }
  for (let i = 0; i < n; i++) { const u = i / n * 6.283; m.v.push([r * Math.cos(u), h, r * Math.sin(u)]); }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    m.f.push([i, j, n + j, n + i]); m.c.push(col); m.em.push(false);
  }
  const top = [], bot = [];
  for (let i = n - 1; i >= 0; i--) top.push(n + i);
  for (let i = 0; i < n; i++) bot.push(i);
  m.f.push(top); m.c.push(topCol || col); m.em.push(false);
  m.f.push(bot); m.c.push(col); m.em.push(false);
  return m;
}
/** konus */
function meshOfCone(r, h, n, col, bandCol) {
  const m = emptyMesh();
  m.v.push([0, 0, 0]);
  for (let i = 0; i < n; i++) { const u = i / n * 6.283; m.v.push([r * Math.cos(u), 0, r * Math.sin(u)]); }
  m.v.push([0, h, 0]);
  const AP = 1 + n;
  for (let i = 0; i < n; i++) {
    const a = 1 + i, b = 1 + (i + 1) % n;
    m.f.push([a, b, AP]); m.c.push(i % 2 ? col : bandCol || col); m.em.push(false);
  }
  const base = [];
  for (let i = 0; i < n; i++) base.push(1 + i);
  m.f.push(base); m.c.push('#241a12'); m.em.push(false);
  return m;
}

/* --------------------------- OVOZ (WebAudio) --------------------------- */
const Sound = {
  ac: null, master: null, engine: null, engineGain: null, on: store.get('snd', true), musicOn: store.get('mus', true), _mus: 0, _lastSiren: 0,
  ensure() {
    if (this.ac || !this.on) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain(); this.master.gain.value = 0.45; this.master.connect(this.ac.destination);
      const o = this.ac.createOscillator(), g = this.ac.createGain(), flt = this.ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 55; flt.type = 'lowpass'; flt.frequency.value = 340;
      g.gain.value = 0; o.connect(flt); flt.connect(g); g.connect(this.master); o.start();
      this.engine = o; this.engineGain = g;
      this.startMusic();
    } catch {}
  },
  _resuming: false,
  resume() {
    if (this.ac && this.ac.state === 'suspended' && !this._resuming) {
      this._resuming = true;
      try {
        const p = this.ac.resume();
        if (p && typeof p.then === 'function') {
          p.then(() => { this._resuming = false; }).catch(() => { this._resuming = false; });
        } else {
          this._resuming = false;
        }
      } catch {
        this._resuming = false;
      }
    }
  },
  set(v) { this.on = v; store.set('snd', v); if (this.master) this.master.gain.value = v ? 0.45 : 0; },
  engineSet(k) {
    if (!this.engine) return;
    this.engine.frequency.value = 40 + k * 145;
    this.engineGain.gain.value = G.running ? 0.05 + k * 0.11 : 0;
  },
  blip(freq = 880, dur = .09, type = 'square', vol = .22) {
    if (!this.ac || !this.on) return;
    try {
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ac.currentTime + dur);
      o.connect(g); g.connect(this.master); o.start(); o.stop(this.ac.currentTime + dur + .02);
    } catch {}
  },
  noise(dur = .3, vol = .4) {
    if (!this.ac || !this.on) return;
    try {
      const n = Math.floor(this.ac.sampleRate * dur), buf = this.ac.createBuffer(1, n, this.ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = this.ac.createBufferSource(), g = this.ac.createGain(), f = this.ac.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1400; s.buffer = buf; g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(this.master); s.start();
    } catch {}
  },
  chord(fs, dur = .4, vol = .16) { if (!this.on) return; fs.forEach((f, i) => setTimeout(() => this.blip(f, dur, 'triangle', vol), i * 55)); },
  scaleChime(step = 0, vol = 0.22) {
    if (!this.ac || !this.on) return;
    const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51, 1567.98];
    const freq = notes[Math.min(notes.length - 1, Math.max(0, step | 0))];
    this.blip(freq, 0.12, 'square', vol);
    setTimeout(() => this.blip(freq * 1.5, 0.08, 'sine', vol * 0.5), 25);
  },
  whoosh(vol = 0.32) {
    if (!this.ac || !this.on) return;
    try {
      const dur = 0.32, n = Math.floor(this.ac.sampleRate * dur);
      const buf = this.ac.createBuffer(1, n, this.ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / n) * Math.PI);
      const s = this.ac.createBufferSource(), g = this.ac.createGain(), f = this.ac.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 2.2;
      f.frequency.setValueAtTime(320, this.ac.currentTime);
      f.frequency.exponentialRampToValueAtTime(1700, this.ac.currentTime + dur * 0.45);
      f.frequency.exponentialRampToValueAtTime(260, this.ac.currentTime + dur);
      g.gain.setValueAtTime(vol, this.ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + dur);
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(this.master); s.start();
    } catch {}
  },
  kick() {
    if (!this.ac || !this.on || !this.musicOn) return;
    try {
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.frequency.setValueAtTime(130, this.ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(34, this.ac.currentTime + 0.11);
      g.gain.setValueAtTime(0.35, this.ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + 0.11);
      o.connect(g); g.connect(this.master); o.start(); o.stop(this.ac.currentTime + 0.12);
    } catch {}
  },
  snare() {
    if (!this.ac || !this.on || !this.musicOn) return;
    try {
      const dur = 0.13, n = Math.floor(this.ac.sampleRate * dur);
      const buf = this.ac.createBuffer(1, n, this.ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = this.ac.createBufferSource(), g = this.ac.createGain(), f = this.ac.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 850;
      g.gain.setValueAtTime(0.18, this.ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + dur);
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(this.master); s.start();
    } catch {}
  },
  sirenTick(t) {
    if (!this.ac || !this.on || !G.running) return;
    const c = car();
    if (!c.bar) return;
    if (Math.floor(t * 4) % 2 === 0) {
      if (this._lastSiren !== 1) { this.blip(750, 0.2, 'sawtooth', 0.08); this._lastSiren = 1; }
    } else {
      if (this._lastSiren !== 2) { this.blip(580, 0.2, 'sawtooth', 0.08); this._lastSiren = 2; }
    }
  },
  tireSqueal() {
    if (!this.ac || !this.on || !G.running) return;
    if (this._squealT && this.ac.currentTime - this._squealT < 0.18) return;
    this._squealT = this.ac.currentTime;
    try {
      const dur = 0.22, n = Math.floor(this.ac.sampleRate * dur);
      const buf = this.ac.createBuffer(1, n, this.ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / n) * Math.PI);
      const s = this.ac.createBufferSource(), g = this.ac.createGain(), f = this.ac.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 6.0;
      f.frequency.setValueAtTime(2200, this.ac.currentTime);
      f.frequency.linearRampToValueAtTime(1800, this.ac.currentTime + dur);
      g.gain.setValueAtTime(0.18, this.ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + dur);
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(this.master); s.start();
    } catch {}
  },
  bossWarning() {
    if (!this.on) return;
    this.chord([880, 440, 880, 440], 0.35, 0.25);
  },
  biomeEvent(props) {
    if (!this.on) return;
    const ev = (typeof BIOME_EVENTS !== 'undefined' && BIOME_EVENTS[props]) ? BIOME_EVENTS[props] : (typeof BIOME_EVENTS !== 'undefined' ? BIOME_EVENTS.city : null);
    if (!ev) return;
    this.chord(ev.soundChords || [523, 659, 784], ev.soundDur || 0.35, ev.soundVol || 0.16);
  },
  startMusic() {
    if (!this.ac || !this.musicOn || this._mus) return;
    const bass = [110, 110, 110, 110, 130.8, 130.8, 98, 98];
    const leads = [220, 261.6, 329.6, 392, 440, 523.2, 392, 329.6];
    let step = 0;
    this._mus = setInterval(() => {
      if (!this.on || !this.musicOn || (!G.running && !G.menuMusic)) return;
      const bf = bass[step % bass.length];
      const oct = (G.boost > 0.3) ? 1.0 : 0.5;
      this.blip(bf * oct, 0.11, 'sawtooth', 0.06);
      if (step % 2 === 0) {
        const lf = leads[(Math.floor(step / 2)) % leads.length];
        this.blip(lf, 0.08, 'triangle', 0.05);
      }
      if (step % 4 === 0) this.kick();
      else if (step % 4 === 2) this.snare();
      step++;
    }, 140);
  },
  setMusic(v) { this.musicOn = v; store.set('mus', v); if (v) this.startMusic(); }
};

/* --------------------------- YANDEX GAMES SDK --------------------------- */
const YA = {
  ready: false, player: null,   lang: 'ru', sdk: null,
  async init() {
    const note = document.getElementById('sdkNote'), rn = document.getElementById('reviveNote');
    try {
      if (typeof window.YaGames === 'undefined') {
        if (note) note.textContent = 'SDK не найден — игра работает автономно (офлайн).';
          if (rn) rn.textContent = 'Без SDK доступно одно бесплатное воскрешение.';
        return;
      }
      const sdk = await window.YaGames.init({ leaderboards: true, cloudSave: true });
      this.sdk = sdk; this.ready = true;
      this.lang = 'ru';
      try { this.player = await sdk.getPlayer(); } catch {}
      try { sdk.features && sdk.features.LoadingAPI && sdk.features.LoadingAPI.ready(); } catch {}
      if (note) note.textContent = 'Yandex Games SDK подключён — реклама, сохранения и таблица лидеров активны.';
      if (rn) rn.textContent = 'Воскресните, посмотрев рекламу (1 раз).';
    } catch (e) {
      if (note) note.textContent = 'SDK: некоторые функции недоступны, но игра продолжит работать.';
    }
  },
  async interstitial() {
    if (!this.ready) return;
    try {
      await this.sdk.adv.showFullscreenAdv({
        callbacks: { onOpen() { G.paused = true; }, onClose() { G.paused = false; }, onError() {} }
      });
    } catch {}
  },
  async rewarded() {
    if (!this.ready) return false;
    try {
      let got = false;
      await this.sdk.adv.showRewardedVideo({
        callbacks: { onRewarded: () => { got = true; }, onClose: () => { G.paused = false; }, onError: () => {}, onOpen: () => { G.paused = true; } }
      });
      return got;
    } catch { return false; }
  },
  async submit(score) {
    if (!this.ready) return;
    try { if (this.player) await this.player.setData({ best: score }); } catch {}
    try {
      const lb = await this.sdk.getLeaderboards();
      if (lb && lb.setScore) await lb.setScore('main', { score: score });
    } catch {}
  }
};

/* --------------------------- O'YIN HOLATI --------------------------- */
const LANES = [-2.4, 0, 2.4];
const ROADH = 3.7;          // yo'l yarim kengligi
const HAZARD = { car: 1, truck: 1, bar: 1, wall: 1, cone: 1 };
const GOOD = { coin: 1, nitro: 1, shield: 1, magnet: 1, life: 1, magnet_plus: 1, shield_plus: 1, heart_plus: 1 };
const JUMPABLE = { bar: 1, cone: 1 };
const KIND = { CAR: 'car', TRUCK: 'truck', BAR: 'bar', WALL: 'wall', CONE: 'cone',
  COIN: 'coin', NITRO: 'nitro', SH: 'shield', MAG: 'magnet', LIFE: 'life',
  MAG_PLUS: 'magnet_plus', SH_PLUS: 'shield_plus', LIFE_PLUS: 'heart_plus' };

/* har bir tur uchun: badge balandligi, yo'l dog'i kengligi, rang, urish radiusi */
const OBJ = {
  car:           { badY: 1.75, patW: 1.25, patL: 1.5, col: '#ff2b43', hit: 1.15, spin: 0,    y: 0 },
  truck:         { badY: 2.35, patW: 1.35, patL: 1.9, col: '#ff2b43', hit: 1.25, spin: 0,    y: 0 },
  bar:           { badY: 0.65, patW: 1.20, patL: 0.9, col: '#ff2b43', hit: 1.15, spin: 0,    y: 0 },
  wall:          { badY: 3.15, patW: 1.30, patL: 0.9, col: '#ff2b43', hit: 1.25, spin: 0,    y: 0 },
  cone:          { badY: 0.75, patW: 0.85, patL: 0.9, col: '#ff5a3c', hit: 0.95, spin: 0.4,  y: 0 },
  coin:          { badY: 1.75, patW: 0.95, patL: 1.0, col: '#ffd166', hit: 1.55, spin: 2.4,  y: 1.0 },
  nitro:         { badY: 1.85, patW: 0.95, patL: 1.0, col: '#00e5ff', hit: 1.50, spin: 1.7,  y: 1.0 },
  shield:        { badY: 1.85, patW: 0.95, patL: 1.0, col: '#46ff8f', hit: 1.50, spin: 1.1,  y: 0.05 },
  magnet:        { badY: 1.80, patW: 0.95, patL: 1.0, col: '#c08cff', hit: 1.50, spin: 1.3,  y: 0.9 },
  life:          { badY: 1.85, patW: 0.95, patL: 1.0, col: '#ff7ab8', hit: 1.50, spin: 0.9,  y: 1.0 },
  magnet_plus:   { badY: 1.80, patW: 1.05, patL: 1.1, col: '#e879f9', hit: 1.55, spin: 1.4,  y: 0.9 },
  shield_plus:   { badY: 1.85, patW: 1.05, patL: 1.1, col: '#22d3ee', hit: 1.55, spin: 1.2,  y: 0.05 },
  heart_plus:    { badY: 1.85, patW: 1.05, patL: 1.1, col: '#f43f5e', hit: 1.55, spin: 1.0,  y: 1.0 },
  checkpoint:    { badY: 3.40, patW: 3.80, patL: 0.6, col: '#00e5ff', hit: 0,    spin: 0,    y: 0 },
  portal_active: { badY: 3.20, patW: 1.35, patL: 0.6, col: '#d946ef', hit: 0,    spin: 0,    y: 0 },
  portal_open:   { badY: 3.00, patW: 1.25, patL: 0.5, col: '#64748b', hit: 0,    spin: 0,    y: 0 }
};

function speedToKmh(spd) {
  return Math.min(400, Math.round((spd || 0) * (120 / 23)));
}

const G = {
  running: false, paused: false, over: false, menuMusic: true,
  t: 0, last: 0, dt: 0, fps: 60, frame: 0, frameMs: 16, slowFrames: 0, fastFrames: 0, qualCooldown: 0, frameSpikes: 0,
  speed: 23, maxSpeed: 23, baseSpeed: 23, dist: 0, score: 0, coins: store.get('coins', 0),
  lives: 3, maxLives: 3, level: 1, nextLevelAt: 1000, levelAt: 0, levelFrom: 0, combo: 1, bestCombo: 1, comboT: 0, comboHold: 3.4,
  boost: 0, boostOn: false, touchBrake: false, energon: 100, energonMax: 100, nitroT: 0,
  magnet: 0, magnetMax: 5, shield: 0, shieldMax: 0, invul: 0, coinMult: 1,
  lane: 1, laneX: 0, x: 0, y: 0, vy: 0, onGround: true, tilt: 0, yaw: 0, jumpV: 1,
  spawnGap: 15, shake: 0, flash: 0, camRoll: 0, runCoins: 0, brakePow: 0, smashBonus: 0,
  objs: [], parts: [], stars: [], mountains: [], posts: [], biomeAtmo: [],
  trackIdx: 0, trackT: 0, prevTrackIdx: null, trans: 99,
  inDimension: false, dimensionTime: 0, dimensionIdx: 0, portalEntryAnim: 0, portalExitAnim: 0, lastPortalLane: -1, shieldAnim: 0, nitroAnim: 0,
  nextCheckpointAt: 1300, nextPortalAt: 650, checkpointSpawned: false, portalSpawned: false,
  quality: detectInitialQuality(), car: store.get('car', 0), ship: store.get('car', 0),
  meta: store.get('meta', { plays: 0, best: 0, totalCoins: store.get('coins', 0), runs: 0, farthest: 0, bestLevel: 1 }),
  upgrades: {}, tut: false, lesson: 0, lessonT: 0, tutDone: !!store.get('tutDone', false)
};

/* --------------------------- MESHRLAR --------------------------- */
/* Mashina shakllari: har biri yarim o'lchamlar (half-extents).
   taper — oldining torayib pastlash darajasi (0 = tik furgon, 1 = poyga burni),
   tuck  — burunning tanadan chiqadigan qismi. gf/gr — old/orqa oyna (kenglik, balandlik). */
const SHAPE_DEF = {
  ch: [.86, .18, 1.20], chy: .33,
  hood: [.72, .085, .58], hody: .43, hoodz: .62,
  cab: [.55, .155, .40], caby: .59, cabz: -.20,
  gf: [.50, .13], gr: [.48, .11],
  wh: [.18, .24, .37], wx: .90, wz: .72, wy: .24,
  bum: [.80, .08, .09], taper: .68, tuck: .28,
  wing: 1, rails: 0, scoop: 0, nose: 0, bar: 0, sign: 0
};
const SHAPES = {
  sport: {},
  suv: { ch: [.88, .19, 1.20], chy: .34, hood: [.74, .09, .56], hody: .44, hoodz: .62,
    cab: [.57, .16, .44], caby: .60, cabz: -.20, gf: [.52, .13], gr: [.50, .11],
    wh: [.19, .25, .38], wx: .91, wz: .72, wy: .25, bum: [.82, .08, .10], taper: .62, tuck: .26,
    wing: 1 },
  muscle: { ch: [.88, .19, 1.23], chy: .34, hood: [.79, .10, .62], hody: .44, hoodz: .66,
    cab: [.56, .16, .39], caby: .60, cabz: -.36, gf: [.51, .13], gr: [.49, .11],
    wh: [.19, .25, .39], wx: .92, wz: .76, wy: .25, bum: [.82, .09, .10], taper: .52, tuck: .24, wing: 2 },
  racer: { ch: [.66, .16, 1.28], chy: .29, hood: [.48, .08, .52], hody: .39, hoodz: .82,
    cab: [.43, .14, .37], caby: .52, cabz: -.08, gf: [.39, .12], gr: [.37, .10],
    wh: [.17, .22, .34], wx: .67, wz: .82, wy: .22, bum: [.60, .08, .09], taper: .76, tuck: .30,
    wing: 3, nose: 1 },
  van: { ch: [.87, .19, 1.22], chy: .34, hood: [.74, .09, .55], hody: .44, hoodz: .64,
    cab: [.56, .16, .42], caby: .60, cabz: -.24, gf: [.51, .13], gr: [.49, .11],
    wh: [.19, .25, .38], wx: .90, wz: .73, wy: .25, bum: [.82, .08, .10], taper: .60, tuck: .25,
    wing: 1 },
  pickup: { ch: [.88, .19, 1.22], chy: .34, hood: [.76, .09, .57], hody: .44, hoodz: .66,
    cab: [.56, .16, .40], caby: .60, cabz: -.20, gf: [.51, .13], gr: [.49, .11],
    wh: [.19, .25, .39], wx: .91, wz: .74, wy: .25, bum: [.82, .08, .10], taper: .62, tuck: .25, wing: 1 },
  hyper: { ch: [.89, .17, 1.26], chy: .32, hood: [.82, .08, .59], hody: .41, hoodz: .72,
    cab: [.53, .145, .39], caby: .56, cabz: -.16, gf: [.48, .12], gr: [.46, .10],
    wh: [.18, .23, .39], wx: .92, wz: .81, wy: .23, bum: [.84, .08, .10], taper: .70, tuck: .30, wing: 2 },
  drift: { ch: [.86, .17, 1.22], chy: .30, hood: [.76, .08, .58], hody: .40, hoodz: .64,
    cab: [.54, .15, .40], caby: .57, cabz: -.22, gf: [.50, .12], gr: [.48, .10],
    wh: [.18, .23, .38], wx: .91, wz: .74, wy: .23, bum: [.82, .08, .10], taper: .66, tuck: .28, wing: 4 },
  rally: { ch: [.87, .18, 1.20], chy: .33, hood: [.75, .09, .55], hody: .43, hoodz: .60,
    cab: [.56, .16, .42], caby: .59, cabz: -.20, gf: [.51, .13], gr: [.49, .11],
    wh: [.20, .26, .39], wx: .92, wz: .72, wy: .26, bum: [.84, .09, .10], taper: .58, tuck: .25, wing: 2 },
  speedster: { ch: [.88, .15, 1.24], chy: .28, hood: [.80, .07, .60], hody: .37, hoodz: .68,
    cab: [.52, .11, .36], caby: .49, cabz: -.18, gf: [.48, .09], gr: [.46, .08],
    wh: [.18, .22, .38], wx: .91, wz: .78, wy: .22, bum: [.83, .08, .09], taper: .74, tuck: .32, wing: 1 },
  coupe: { ch: [.87, .18, 1.21], chy: .32, hood: [.77, .09, .59], hody: .42, hoodz: .64,
    cab: [.55, .15, .39], caby: .58, cabz: -.24, gf: [.50, .12], gr: [.48, .10],
    wh: [.19, .24, .38], wx: .90, wz: .74, wy: .24, bum: [.82, .08, .10], taper: .64, tuck: .27, wing: 1 }
};

function buildCar(body, roof, glass, accent, shape, ex) {
  const S = Object.assign({}, SHAPE_DEF, SHAPES[shape] || SHAPES.sport, ex || {});
  const B = [], W = [], wheels = [];
  const tp = S.taper == null ? .5 : S.taper;
  const chx = S.ch[0], chh = S.ch[1], chz = S.ch[2];
  const bodyTop = S.chy + chh, bodyBot = S.chy - chh;
  const cabTop = S.caby + S.cab[1], cabBot = S.caby - S.cab[1];
  const cabFront = S.cabz + S.cab[2], cabBack = S.cabz - S.cab[2];
  const hoodTop = S.hody + S.hood[1];
  const DARK = '#0d1119', CARB = '#161c2a', RIM = '#a4b1c9';

  /* 1) Tana: orqada keng va baland, oldinga torayib pastlaydi (sport kar silueti) */
  const fhx = chx * (1 - .18 * tp), fhy = chh * (1 - .16 * tp), ffy = -.16 * chh * tp;
  W.push({ p: [0, S.chy, 0], hz: chz, rr: [chx, chh], fr: [fhx, fhy], fy: ffy,
    c: body, top: body, bot: '#0a0d14' });
  /* 2) Orqa yelka — diffyuzor ustidagi baland qism (salon bilan buferni tutadi) */
  B.push({ p: [0, bodyTop + .02, -(chz * .60)], s: [chx * .98, .05, chz * .30], c: body, top: body });
  /* 3) Kaput — oldinga qarab pasayadigan va torayadigan klin */
  W.push({ p: [0, S.hody, S.hoodz], hz: S.hood[2], rr: [S.hood[0], S.hood[1] + .02],
    fr: [S.hood[0] * (1 - .20 * tp), S.hood[1]], ry: .02, fy: -.05, c: body, top: body });
  for (const sx of [-1, 1]) W.push({ p: [sx * S.hood[0] * .30, hoodTop + .035, S.hoodz],
    hz: S.hood[2] * .60, rr: [.038, .012], fr: [.032, .012], fy: -.05, c: accent, top: accent, em: true });
  B.push({ p: [0, hoodTop + .012, S.hoodz + S.hood[2] * .50], s: [S.hood[0] * .18, .012, .10],
    c: CARB, top: DARK });

  /* --- Poyga chiziqlari (Racing Stripes) --- */
  if (S.stripe === 1) {
    const sc = S.stripeColor || accent;
    B.push({ p: [0, hoodTop + .018, S.hoodz], s: [.12, .014, S.hood[2] * .95], c: sc, top: sc, em: true });
    B.push({ p: [0, cabTop + .016, S.cabz], s: [.12, .014, S.cab[2] * .92], c: sc, top: sc, em: true });
  } else if (S.stripe === 2) {
    const sc = S.stripeColor || accent;
    for (const sx of [-1, 1]) {
      B.push({ p: [sx * .12, hoodTop + .018, S.hoodz], s: [.06, .014, S.hood[2] * .95], c: sc, top: sc, em: true });
      B.push({ p: [sx * .12, cabTop + .016, S.cabz], s: [.06, .014, S.cab[2] * .92], c: sc, top: sc, em: true });
    }
  }

  /* --- Supercharger Blower (Muskul kar kompressori) --- */
  if (S.blower) {
    const bw = S.blower === 2 ? .26 : .20;
    B.push({ p: [0, hoodTop + .08, S.hoodz + .05], s: [bw, .08, .22], c: '#1e2433', top: '#8a99b5' });
    B.push({ p: [0, hoodTop + .14, S.hoodz + .12], s: [bw * .8, .05, .10], c: accent, em: true });
    for (const bx of [-1, 1]) {
      B.push({ p: [bx * bw * .45, hoodTop + .13, S.hoodz + .14], s: [.04, .04, .04], c: '#ff3b4e', em: true });
    }
  }

  if (S.scoop) {
    B.push({ p: [0, hoodTop + .07, S.hoodz - S.hood[2] * .28], s: [.16, .07, .18], c: accent, top: '#f3f7ff' });
  }
  /* 4) Burun uchi — tanadan chiqadigan tor klin */
  if (S.tuck > 0) {
    const fcy = S.chy + ffy;
    W.push({ p: [0, fcy - .005, chz + S.tuck / 2], hz: S.tuck / 2, rr: [fhx * .97, fhy * .90],
      fr: [chx * .32, fhy * .46], fy: -.015, c: body, top: body, bot: CARB });
  }
  /* 5) Salon — yuqoriga torayadi, ustida tom rangi */
  W.push({ p: [0, S.caby, S.cabz], hz: S.cab[2], rr: [S.cab[0], S.cab[1]],
    fr: [S.cab[0] * .99, S.cab[1] * .74], ry: .006, fy: -.03, c: body, top: roof });

  /* --- Tom usti havo so'rgich (Roof Scoop) --- */
  if (S.roofScoop) {
    B.push({ p: [0, cabTop + .06, S.cabz + S.cab[2] * .3], s: [.14, .05, .16], c: accent, top: DARK });
    B.push({ p: [0, cabTop + .06, S.cabz + S.cab[2] * .38], s: [.10, .035, .04], c: DARK, em: true });
  }

  /* --- Akula qanoti (Cyber Shark Fin) --- */
  if (S.cyberFin) {
    B.push({ p: [0, cabTop + .07, S.cabz - S.cab[2] * .4], s: [.02, .09, .22], c: accent, top: '#ffffff', em: true });
  }

  /* 6) Old oyna: salon oldidan kaput tepasigacha tushadi */
  const wsLen = .10 + .20 * tp, wsTop = Math.min(hoodTop + .05, cabTop - .12), wsBot = cabBot - .03;
  const wsHr = (cabTop + .004 - wsBot) / 2, wsHf = Math.max(.02, (wsTop - wsBot) / 2);
  W.push({ p: [0, wsBot + wsHr, cabFront + wsLen * .45], hz: wsLen * .55, rr: [S.gf[0], wsHr],
    fr: [S.gf[0] * .95, wsHf], fy: wsHf - wsHr, c: glass, top: glass });
  /* 7) Orqa oyna: salon ortidan orqa deckkacha yotqizilgan */
  const rsLen = .06 + .14 * tp, rsTop = cabTop - .015, rsBot = bodyTop - .02;
  const rsHf = (rsTop - rsBot) / 2, rsHr = Math.max(.02, (bodyTop + .10 - rsBot) / 2);
  W.push({ p: [0, rsBot + rsHf, cabBack - rsLen * .45], hz: rsLen * .55, rr: [S.gr[0], rsHr],
    fr: [S.gr[0] * .96, rsHf], ry: rsHr - rsHf, c: glass, top: glass });
  /* 8) Yon oynalar — salon yon panellariga yopishqan shisha lentalari */
  for (const sx of [-1, 1]) B.push({ p: [sx * (S.cab[0] + .012), S.caby + S.cab[1] * .26, S.cabz + S.cab[2] * .08],
    s: [.016, S.cab[1] * .46, S.cab[2] * .42], c: glass, top: glass });

  /* --- Widebody Fenders (Kengaytirilgan mushakli arkalar) --- */
  if (S.widebody) {
    for (const sx of [-1, 1]) {
      B.push({ p: [sx * (chx + .04), S.chy + .02, S.wz], s: [.05, chh * .7, .36], c: body, top: accent });
      B.push({ p: [sx * (chx + .04), S.chy + .02, -S.wz], s: [.05, chh * .75, .38], c: body, top: accent });
    }
  }

  /* 9) Yon havo o'tkazgich va yon etak */
  if (tp > .28) for (const sx of [-1, 1]) B.push({ p: [sx * (chx + .010), bodyBot + chh * .80, -(chz * .30)],
    s: [.02, chh * .34, chz * .14], c: DARK });
  for (const sx of [-1, 1]) B.push({ p: [sx * (chx * .98), bodyBot + .03, chz * .02],
    s: [.03, .03, chz * .58], c: CARB, top: DARK });

  /* --- Side Exhaust (Yon egzoz quvurlari va olov) --- */
  if (S.sideExhaust) {
    for (const sx of [-1, 1]) {
      B.push({ p: [sx * (chx + .03), bodyBot + .04, -chz * .2], s: [.04, .04, .12], c: '#8fa2b8' });
      B.push({ p: [sx * (chx + .045), bodyBot + .04, -chz * .2 - .03], s: [.02, .025, .03], c: '#ff6200', em: true });
    }
  }

  /* 10) Old splityer + radyator tory */
  const splitW = S.splitter === 2 ? chx * 1.05 : chx * .86;
  const splitL = S.splitter === 2 ? .14 : .09;
  B.push({ p: [0, bodyBot + .015, chz + .02], s: [splitW, .026, splitL], c: CARB, top: accent });
  B.push({ p: [0, S.chy + ffy - chh * .02, chz + .005], s: [chx * .40, chh * .30, .05], c: DARK });

  /* --- Old poyga qanotchalari (Aero Canards) --- */
  if (S.canards) {
    for (const sx of [-1, 1]) {
      B.push({ p: [sx * (chx * .92), bodyBot + chh * .6, chz * .8], s: [.10, .018, .12], c: accent, em: true });
      B.push({ p: [sx * (chx * .88), bodyBot + chh * .9, chz * .7], s: [.09, .018, .10], c: accent, em: true });
    }
  }

  /* 11) LED faralar — kibersport lazerli va diodli yoritish */
  if (S.headlights === 'laser') {
    for (const sx of [-1, 1]) {
      // Asosiy lazer nuri chizig'i + yorqin oq yadro
      B.push({ p: [sx * chx * .62, bodyTop - chh * .24, chz + .02], s: [.24, .025, .04], c: '#7dffff', em: true, front: '#ffffff' });
      // Pastki o'tkir qosh (Cyber DRL blade)
      B.push({ p: [sx * chx * .68, bodyTop - chh * .36, chz + .02], s: [.16, .014, .03], c: accent, em: true });
    }
  } else if (S.headlights === 'quad') {
    for (const sx of [-1, 1]) {
      // To'rtlik linzali projektorlar
      B.push({ p: [sx * chx * .54, bodyTop - chh * .28, chz + .01], s: [.08, .05, .045], c: '#eaf4ff', em: true, front: '#ffffff' });
      B.push({ p: [sx * chx * .74, bodyTop - chh * .28, chz + .01], s: [.08, .05, .045], c: '#ffd166', em: true, front: '#fff9d6' });
      B.push({ p: [sx * chx * .64, bodyTop - chh * .40, chz + .01], s: [.18, .014, .03], c: accent, em: true });
    }
  } else {
    for (const sx of [-1, 1]) {
      B.push({ p: [sx * chx * .60, bodyTop - chh * .28, chz + .01], s: [.17, .045, .045], c: '#eaf4ff', em: true, front: '#ffffff' });
      B.push({ p: [sx * chx * .84, bodyTop - chh * .58, chz - .01], s: [.03, .085, .04], c: '#dfe9ff', em: true });
      B.push({ p: [sx * chx * .66, bodyTop - chh * .38, chz + .01], s: [.14, .014, .03], c: accent, em: true });
    }
  }

  /* 12) Orqa bufer + to'liq kenglikdagi kiber-LED chiroq lentasi */
  B.push({ p: [0, S.chy - chh * .20, -(chz + .04)], s: S.bum, c: CARB, top: '#28324a' });
  // Gorizontal monoxrom stop-chiziq
  B.push({ p: [0, bodyTop - .02, -(chz + .05)], s: [chx * .84, .032, .03], c: '#ff2b43', em: true, back: '#ff6b82' });
  // Chetki burchakli pastga tushuvchi qanotchalari
  for (const sx of [-1, 1]) {
    B.push({ p: [sx * chx * .82, bodyTop - .045, -(chz + .055)], s: [.025, .045, .025], c: '#ff2b43', em: true, back: '#ff7a86' });
    B.push({ p: [sx * chx * .58, bodyTop - .02, -(chz + .06)], s: [.14, .055, .025], c: '#ff2b43', em: true, back: '#ff7a86' });
  }

  /* 13) Orqa diffyuzor va titan egzoz uchlari */
  B.push({ p: [0, bodyBot - .01, -(chz + .01)], s: [chx * .70, .05, .09], c: DARK, bot: DARK });
  for (const fx of [-.44, 0, .44]) B.push({ p: [chx * fx, bodyBot - .02, -(chz + .03)], s: [.025, .05, .08], c: '#242c3d' });
  if (S.diffuser === 2) {
    for (const fx of [-.6, -.2, .2, .6]) B.push({ p: [chx * fx, bodyBot - .03, -(chz + .06)], s: [.03, .07, .12], c: accent, em: true });
  }
  // Ikkita titan egzoz (Titanium exhaust tips)
  for (const sx of [-1, 1]) {
    B.push({ p: [sx * chx * .42, bodyBot + .04, -(chz + .05)], s: [.07, .04, .04], c: '#64748b', back: '#00e5ff', em: true });
  }

  /* 14) Spoylerlar (Aero wings) */
  const wingY = Math.min(cabTop + .12, bodyTop + .30);
  if (S.wing === 1 || S.wing === 2) {
    const ww = S.wing === 2 ? .68 : .58, wl = S.wing === 2 ? .18 : .15;
    B.push({ p: [0, wingY, -(S.ch[2] - .04)], s: [ww, .035, wl], c: accent, top: '#f3f7ff' });
    for (const sx of [-1, 1])
      B.push({ p: [sx * ww * .62, (bodyTop + wingY) / 2, -(S.ch[2] - .04)], s: [.05, (wingY - bodyTop) / 2, .05], c: accent });
  } else if (S.wing === 3) {
    B.push({ p: [0, wingY, -(S.ch[2] + .02)], s: [.54, .03, .20], c: accent, top: '#f3f7ff' });
    for (const sx of [-1, 1]) B.push({ p: [sx * .54, wingY - .09, -(S.ch[2] + .02)], s: [.03, .09, .20], c: accent });
    for (const sx of [-1, 1]) B.push({ p: [sx * .24, (bodyTop + wingY) / 2, -(S.ch[2] - .02)],
      s: [.05, (wingY - bodyTop) / 2, .05], c: roof });
  } else if (S.wing === 4) {
    /* Ducktail / Drag orqa lab qanoti */
    B.push({ p: [0, bodyTop + .06, -(S.ch[2] + .02)], s: [chx * .82, .06, .12], c: accent, top: '#ffffff' });
    for (const sx of [-1, 1]) B.push({ p: [sx * chx * .82, bodyTop + .08, -(S.ch[2] + .02)], s: [.02, .08, .12], c: body });
  } else if (S.wing === 5) {
    /* Bi-Plane ikki qavatli super qanot */
    const ww = .72;
    B.push({ p: [0, wingY, -(S.ch[2] - .02)], s: [ww, .03, .16], c: accent, top: '#ffffff' });
    B.push({ p: [0, wingY + .12, -(S.ch[2] - .04)], s: [ww * .9, .025, .14], c: body, top: accent });
    for (const sx of [-1, 1]) {
      B.push({ p: [sx * ww * .55, (bodyTop + wingY + .12) / 2, -(S.ch[2] - .02)], s: [.04, (wingY + .12 - bodyTop) / 2, .05], c: accent });
      B.push({ p: [sx * ww, wingY + .06, -(S.ch[2] - .02)], s: [.025, .12, .18], c: accent });
    }
  }

  /* 15) Old qanotcha (poyga) */
  if (S.nose) {
    B.push({ p: [0, .16, S.ch[2] + .16], s: [.60, .03, .16], c: accent });
    B.push({ p: [0, S.chy + .06, S.ch[2] + .06], s: [.24, .07, .12], c: roof });
  }
  /* 16) Tom relslari / militsiya chiroqlari / taksi belgisi */
  if (S.rails) {
    for (const sx of [-1, 1]) B.push({ p: [sx * (S.cab[0] - .12), cabTop + .05, S.cabz],
      s: [.05, .05, S.cab[2] * .78], c: accent });
  }
  if (S.bar) {
    B.push({ p: [-.16, cabTop + .07, S.cabz], s: [.14, .06, .07], c: '#ff3b4e', em: true });
    B.push({ p: [.16, cabTop + .07, S.cabz], s: [.14, .06, .07], c: '#3b8cff', em: true });
  }
  if (S.sign) B.push({ p: [0, cabTop + .08, S.cabz], s: [.24, .08, .09], c: '#fff3c4', em: true });
  /* 17) Zerkalolar */
  for (const sx of [-1, 1]) B.push({ p: [sx * (S.cab[0] + .08), cabTop - S.cab[1] * .45, cabFront - .06],
    s: [.05, .028, .035], c: accent, top: body });

  /* --- Neon Underglow (Mashina osti neon ajoyib nuri) --- */
  if (S.underglow) {
    const ug = S.underglow;
    for (const sx of [-1, 1]) {
      B.push({ p: [sx * (chx * .92), bodyBot - .01, 0], s: [.03, .015, chz * .82], c: ug, em: true });
    }
    B.push({ p: [0, bodyBot - .01, -chz * .85], s: [chx * .7, .015, .03], c: ug, em: true });
    B.push({ p: [0, bodyBot - .01, chz * .85], s: [chx * .7, .015, .03], c: ug, em: true });
  }

  /* 18) G'ildiraklar: yon yoqlari disk rangida (rimColor yoki accent) */
  const rimCol = S.rimColor || accent;
  for (const sx of [-1, 1]) for (const sz of [1, -1])
    wheels.push(meshOfSportWheel([sx * S.wx, S.wy, sz * S.wz], S.wh, rimCol));
  for (const sx of [-1, 1]) B.push({ p: [sx * chx * .44, bodyBot + .05, -(chz + .13)],
    s: [.09, .045, .035], c: '#b7c4d8', front: '#dce7f7', back: '#8795aa', em: true });
  for (const sx of [-1, 1]) {
    B.push({ p: [sx * (chx + .014), S.chy + .015, .02], s: [.018, .075, .23], c: CARB, side: '#252d40' });
    B.push({ p: [sx * (chx + .025), S.chy + .015, .02], s: [.012, .012, .18], c: accent, em: true });
  }
  return mergeMesh(meshOfWedges(W), meshOfBoxes(B), ...wheels);
}
const MESH_TRUCK = meshOfBoxes([
  // Asosiy kiber-korpus (Main heavy container cargo body)
  { p: [0, .82, -.75], s: [1.02, .82, 1.35], c: '#150f24', top: '#291838', side: '#1e142e' },
  // Korpus ustidagi yon qizil xavf chiziqlari (Side hazard light strips)
  { p: [0, 1.12, -.75], s: [1.04, .08, 1.36], c: '#ff2b43', em: true },
  { p: [0, .46, -.75], s: [1.04, .06, 1.36], c: '#ff5500', em: true },
  // Orqa to'liq kenglikdagi kiber-stop panellari (Rear tailgate stop & hazard panels)
  { p: [-.62, .82, -2.12], s: [.14, .66, .05], c: '#ff2b43', em: true, back: '#ff7a86' },
  { p: [0, .82, -2.12], s: [.24, .66, .05], c: '#ffc857', em: true, back: '#ffffff' },
  { p: [.62, .82, -2.12], s: [.14, .66, .05], c: '#ff2b43', em: true, back: '#ff7a86' },
  // Orqa pastki bamper va yorug'lik aks ettiruvchi (Rear heavy bumper)
  { p: [0, .26, -2.12], s: [.98, .12, .08], c: '#0b0e18', top: '#ff6b35' },
  // Kiber-kabina (Front armored cab)
  { p: [0, .64, 1.05], s: [.96, .50, .62], c: '#241233', top: '#ff2b43', side: '#180d24' },
  // Old tsian oyna (Front cockpit cyan visor)
  { p: [0, .76, 1.44], s: [.84, .18, .24], c: '#00e5ff', em: true, front: '#cffafe' },
  // Old radiator panjarasi va pastki qism (Front grille and chin)
  { p: [0, .32, 1.16], s: [.76, .18, .34], c: '#080c16', front: '#ff2b43' },
  { p: [-.86, .36, 1.46], s: [.14, .12, .10], c: '#ffc857', em: true },
  { p: [.86, .36, 1.46], s: [.14, .12, .10], c: '#ffc857', em: true },
  // Yuqori ogohlantiruvchi gologramma mayoq (Top hazard strobe)
  { p: [0, 1.70, -.75], s: [.36, .34, .14], c: '#f1f5f9', em: true, top: '#ffffff' },
  { p: [0, 1.70, -.68], s: [.22, .20, .09], c: '#ff2b43', em: true },
  // Yon og'ir egzoz quvurlari (Heavy side exhaust stacks)
  { p: [-1.06, 1.05, .35], s: [.06, .45, .08], c: '#475569', top: '#ff5500' },
  { p: [1.06, 1.05, .35], s: [.06, .45, .08], c: '#475569', top: '#ff5500' },
  // Og'ir yuk g'ildiraklari (Heavy armored wheels)
  { p: [-.94, .40, .28], s: [.20, .40, .46], c: '#080c16', side: '#222d3d' },
  { p: [.94, .40, .28], s: [.20, .40, .46], c: '#080c16', side: '#222d3d' },
  { p: [-.94, .40, -1.35], s: [.20, .40, .46], c: '#080c16', side: '#222d3d' },
  { p: [.94, .40, -1.35], s: [.20, .40, .46], c: '#080c16', side: '#222d3d' }
]);
/* Past lazer to'sig'i (sakrab o'tiladi): sanoat ustunlari + gorizontal plazma nurlari */
const MESH_BAR = meshOfBoxes([
  // Chap va o'ng sanoat ustunlari (Industrial pylon stanchions)
  { p: [-1.08, .22, 0], s: [.11, .22, .16], c: '#1e293b', top: '#ff6b35' },
  { p: [1.08, .22, 0], s: [.11, .22, .16], c: '#1e293b', top: '#ff6b35' },
  // Ogohlantiruvchi qizil diodlar (Pylon warning strobe tops)
  { p: [-1.08, .44, 0], s: [.07, .04, .08], c: '#ff2b43', em: true, top: '#ffffff' },
  { p: [1.08, .44, 0], s: [.07, .04, .08], c: '#ff2b43', em: true, top: '#ffffff' },
  // Yuqori intensiv lazer nuri (Upper plasma laser beam)
  { p: [0, .32, 0], s: [1.18, .05, .09], c: '#ff2b43', top: '#ff8ea0', em: true },
  // Pastki tutib turuvchi plazma kanali (Lower amber containment beam)
  { p: [0, .16, 0], s: [1.18, .045, .09], c: '#ffc857', top: '#ffffff', em: true },
  // Markaziy sakrash belgisi (Center jump indicator diamond)
  { p: [0, .41, 0], s: [.28, .04, .08], c: '#ffd166', em: true, top: '#ffffff' },
  // Diagonal xavf belgilari (Hazard stripe pads)
  { p: [-.58, .24, .02], s: [.15, .08, .12], c: '#ffd166', em: true },
  { p: [.58, .24, .02], s: [.15, .08, .12], c: '#ffd166', em: true }
]);
/* 3D Checkpoint Arch spanning all 3 lanes */
const MESH_CHECKPOINT = meshOfBoxes([
  { p: [-3.6, 1.6, 0], s: [.26, 1.6, .26], c: '#0d1725', top: '#00e5ff' },
  { p: [3.6, 1.6, 0], s: [.26, 1.6, .26], c: '#0d1725', top: '#00e5ff' },
  { p: [0, 3.2, 0], s: [3.9, .25, .32], c: '#090d18', top: '#00e5ff' },
  { p: [0, 3.2, .06], s: [3.4, .16, .08], c: '#00e5ff', em: true },
  { p: [-3.6, 1.6, .08], s: [.07, 1.4, .08], c: '#a855f7', em: true },
  { p: [3.6, 1.6, .08], s: [.07, 1.4, .08], c: '#a855f7', em: true }
]);
/* Active portal frame on single lane — High-tech Cyberpunk Quantum Portal Gate */
const MESH_PORTAL_ACTIVE = meshOfBoxes([
  // Asosiy kvant pylon ustunlari (Outer obsidian columns)
  { p: [-1.32, 1.55, 0], s: [.18, 1.55, .26], c: '#0d0f1e', top: '#00e5ff', side: '#1a103c' },
  { p: [1.32, 1.55, 0], s: [.18, 1.55, .26], c: '#0d0f1e', top: '#00e5ff', side: '#1a103c' },
  // Ichki neon energiya kanallari (Vertical quantum conduits)
  { p: [-1.22, 1.55, .04], s: [.06, 1.45, .12], c: '#00e5ff', em: true },
  { p: [1.22, 1.55, .04], s: [.06, 1.45, .12], c: '#00e5ff', em: true },
  { p: [-1.36, 1.55, .02], s: [.05, 1.35, .14], c: '#a855f7', em: true },
  { p: [1.36, 1.55, .02], s: [.05, 1.35, .14], c: '#a855f7', em: true },
  // Yon barqarorlashtiruvchi qanotlar (Stabilizer fins)
  { p: [-1.48, .90, 0], s: [.12, .80, .18], c: '#15122b', top: '#38bdf8' },
  { p: [1.48, .90, 0], s: [.12, .80, .18], c: '#15122b', top: '#38bdf8' },
  // Poydevor reaktiv induktorlari (Base anchors)
  { p: [-1.34, .12, 0], s: [.32, .12, .38], c: '#090a16', top: '#00f5ff' },
  { p: [1.34, .12, 0], s: [.32, .12, .38], c: '#090a16', top: '#00f5ff' },
  // Yuqori kvant arkasi (Overhead primary arch beam)
  { p: [0, 3.05, 0], s: [1.48, .18, .28], c: '#1b1035', top: '#00e5ff', bot: '#38bdf8' },
  // Yuqori neon plazma rezonatori (Overhead emitter strip)
  { p: [0, 3.05, .05], s: [1.32, .07, .12], c: '#a855f7', em: true },
  // Markaziy kvant generator yadrosi (Apex core focus)
  { p: [0, 3.28, 0], s: [.48, .14, .18], c: '#00e5ff', em: true, top: '#ffffff' },
  { p: [0, 3.42, 0], s: [.18, .08, .12], c: '#ffffff', em: true }
]);
/* Open highway arch on non-portal lanes — Sleek Cyber Highway Bypass Arch */
const MESH_PORTAL_OPEN = meshOfBoxes([
  // Yengil aerodinamik pylonlar
  { p: [-1.24, 1.45, 0], s: [.12, 1.45, .18], c: '#09111e', top: '#38bdf8', side: '#1e293b' },
  { p: [1.24, 1.45, 0], s: [.12, 1.45, .18], c: '#09111e', top: '#38bdf8', side: '#1e293b' },
  // Moviy tranzit neon chiziqlari
  { p: [-1.24, 1.45, .03], s: [.04, 1.35, .08], c: '#38bdf8', em: true },
  { p: [1.24, 1.45, .03], s: [.04, 1.35, .08], c: '#38bdf8', em: true },
  // Yuqori tranzit to'sini
  { p: [0, 2.85, 0], s: [1.36, .12, .18], c: '#0f172a', top: '#38bdf8', bot: '#1e293b' },
  { p: [0, 2.85, .04], s: [.95, .05, .08], c: '#00e5ff', em: true },
  // Tranzit indikatori
  { p: [0, 3.02, 0], s: [.32, .06, .10], c: '#38bdf8', em: true }
]);
/* Baland energetik qalqon-devor (sakrab bo'lmaydi): og'ir sanoat ramkasi + lazer panجara */
const MESH_WALL = meshOfBoxes([
  // Asosiy sanoat ustunlari (Heavy vertical carbon-steel pylons)
  { p: [-1.08, 1.35, 0], s: [.14, 1.35, .28], c: '#0f172a', top: '#ff2b43', side: '#1e293b' },
  { p: [1.08, 1.35, 0], s: [.14, 1.35, .28], c: '#0f172a', top: '#ff2b43', side: '#1e293b' },
  // Ustun tepasidagi qizil mayoqlar (Top danger beacon flashers)
  { p: [-1.08, 2.78, 0], s: [.09, .08, .12], c: '#ff2b43', em: true, top: '#ffffff' },
  { p: [1.08, 2.78, 0], s: [.09, .08, .12], c: '#ff2b43', em: true, top: '#ffffff' },
  // Yuqori sanoat fermasi (Overhead truss beam)
  { p: [0, 2.70, 0], s: [1.24, .12, .26], c: '#1e293b', top: '#ff6b35' },
  { p: [0, 2.70, .03], s: [.90, .05, .08], c: '#ffd166', em: true },
  // Yuqori kuchlanishli plazma to'r qalqoni (High-voltage plasma shield lattice)
  { p: [0, 1.35, 0], s: [1.02, 1.25, .18], c: '#7f1d1d', top: '#dc2626', bot: '#450a0a' },
  // Gorizontal lazer to'siq nurlari (Horizontal laser beams)
  { p: [0, 2.05, .04], s: [.98, .08, .20], c: '#ff2b43', em: true, top: '#ff8ea0' },
  { p: [0, 1.35, .04], s: [.98, .08, .20], c: '#ff5500', em: true, top: '#ffd166' },
  { p: [0, 0.65, .04], s: [.98, .08, .20], c: '#ff2b43', em: true, top: '#ff8ea0' },
  // Vertikal energiya o'zaklari (Vertical plasma conduits)
  { p: [-.48, 1.35, .05], s: [.07, 1.15, .16], c: '#f1f5f9', em: true },
  { p: [.48, 1.35, .05], s: [.07, 1.15, .16], c: '#f1f5f9', em: true },
  // Markaziy xavf belgisi (Center high-voltage diamond emblem)
  { p: [0, 1.35, .08], s: [.28, .36, .18], c: '#ffc857', em: true, top: '#ffffff' },
  // Pastki og'ir poydevor (Heavy bottom foundation barrier)
  { p: [0, .10, 0], s: [1.22, .10, .32], c: '#090d18', top: '#1e293b' }
]);
/* Konus / Kiber-pilon: olovrang energetik mayoq */
const MESH_CONE = mergeMesh(
  meshOfCone(.48, 1.05, 10, '#ff5500', '#ffd166'),
  meshOfBoxes([
    { p: [0, .06, 0], s: [.56, .07, .56], c: '#090d18', top: '#ff5500', side: '#1e293b' },
    { p: [0, .48, 0], s: [.30, .07, .30], c: '#f8fafc', em: true },
    { p: [0, .98, 0], s: [.11, .09, .11], c: '#ffd166', em: true, top: '#ffffff' }
  ])
);
/* Tanga (COIN): tilla metall korpus (#ffc857) + markaziy yorqin kiber-emblema */
const MESH_COIN = mergeMesh(
  meshOfCoin(.52, .16, 12, '#ffc857', '#d97706'),
  meshOfBoxes([
    { p: [0, 0, 0], s: [.11, .25, .19], c: '#ffffff', em: true },
    { p: [0, 0, 0], s: [.24, .08, .19], c: '#fffbeb', em: true },
    { p: [0, .42, 0], s: [.08, .04, .18], c: '#ffd166', em: true },
    { p: [0, -.42, 0], s: [.08, .04, .18], c: '#ffd166', em: true },
    { p: [.42, 0, 0], s: [.04, .08, .18], c: '#ffd166', em: true },
    { p: [-.42, 0, 0], s: [.04, .08, .18], c: '#ffd166', em: true }
  ])
);
/* Nitro (NITRO): elektr-tsian energetik kapsula (#00e5ff) + plazma yadrosi */
const MESH_NITRO = mergeMesh(
  meshOfOcta(.44, .64, '#00e5ff'),
  meshOfBoxes([
    { p: [0, 0, 0], s: [.20, .36, .20], c: '#f1f5f9', em: true },
    { p: [0, .46, 0], s: [.28, .07, .28], c: '#0d1725', top: '#00e5ff', side: '#1e293b' },
    { p: [0, -.46, 0], s: [.28, .07, .28], c: '#0d1725', bot: '#00e5ff', side: '#1e293b' },
    { p: [0, 0, 0], s: [.52, .06, .52], c: '#a855f7', em: true },
    { p: [0, 0, .24], s: [.08, .24, .04], c: '#00e5ff', em: true },
    { p: [0, 0, -.24], s: [.08, .24, .04], c: '#00e5ff', em: true }
  ])
);
/* Qalqon (SHIELD): yarim shaffof tsian-zumrad geksagonal himoya maydoni */
const MESH_SHIELD = mergeMesh(
  meshOfPrism(.52, .96, 6, '#00e5ff', '#7dffe4'),
  meshOfBoxes([
    { p: [0, .48, 0], s: [.58, .07, .58], c: '#46ff8f', em: true },
    { p: [0, .48, .01], s: [.20, .28, .56], c: '#f1f5f9', em: true },
    { p: [0, .98, 0], s: [.34, .06, .34], c: '#7dffe4', em: true, top: '#ffffff' },
    { p: [0, .02, 0], s: [.34, .06, .34], c: '#0d1725', bot: '#00e5ff' }
  ])
);
/* Magnit (MAGNET): taqa (U-shakl) + binafsha (#a855F7) va elektr-tsian (#00E5FF) qutblar */
const MESH_MAGNET = meshOfBoxes([
  { p: [-.36, .54, 0], s: [.16, .38, .20], c: '#7c3aed', top: '#a855f7', side: '#6d28d9' },
  { p: [.36, .54, 0], s: [.16, .38, .20], c: '#7c3aed', top: '#a855f7', side: '#6d28d9' },
  { p: [0, .18, 0], s: [.52, .16, .20], c: '#5b21b6', bot: '#4c1d95' },
  { p: [-.36, .86, 0], s: [.17, .08, .21], c: '#00e5ff', em: true, top: '#ffffff' },
  { p: [.36, .86, 0], s: [.17, .08, .21], c: '#ff2b43', em: true, top: '#ffffff' },
  { p: [-.36, .98, 0], s: [.17, .06, .21], c: '#f1f5f9', em: true },
  { p: [.36, .98, 0], s: [.17, .06, .21], c: '#f1f5f9', em: true },
  { p: [0, .42, 0], s: [.12, .12, .18], c: '#00e5ff', em: true }
]);
/* Haqiqiy 3D Yurak modeli: lyuminessent qizil/pushti yadro (#ff2b43),
   oq yorug'lik qirralari (#ffffff) va yon fasetlari bilan */
const MESH_LIFE = mergeMesh(
  // 1) Markaziy qavariq yadro (Central radiant core)
  meshOfBoxes([
    { p: [0, .52, 0], s: [.36, .26, .18], c: '#ff2b43', top: '#ff758f', bot: '#dc2626', em: true },
    { p: [0, .52, .02], s: [.24, .18, .18], c: '#ffffff', em: true }
  ]),
  // 2) Chap va o'ng yuqori qanotlar (Rounded upper left and right lobes)
  meshOfBoxes([
    { p: [-.18, .74, 0], s: [.19, .15, .17], c: '#ff2b43', top: '#ffffff', side: '#ff758f', em: true },
    { p: [.18, .74, 0], s: [.19, .15, .17], c: '#ff2b43', top: '#ffffff', side: '#ff758f', em: true },
    { p: [-.18, .84, 0], s: [.14, .06, .15], c: '#ff758f', top: '#ffffff', em: true },
    { p: [.18, .84, 0], s: [.14, .06, .15], c: '#ff758f', top: '#ffffff', em: true }
  ]),
  // 3) Pastki o'tkir ponasimon uchi (Tapered bottom heart wedge)
  meshOfWedges([
    { p: [0, .32, 0], hz: .16, rr: [.32, .14], fr: [.05, .05], fy: -.16, c: '#ff2b43', top: '#ff758f', bot: '#991b1b', em: true }
  ])
);
const MESH_BOSS = meshOfBoxes([
  { p: [0, .65, 0], s: [1.35, .45, 1.9], c: '#1e0508', top: '#2d080c' },
  { p: [-1.45, .55, 0], s: [.18, .38, 1.7], c: '#450a0a', top: '#dc2626' },
  { p: [1.45, .55, 0], s: [.18, .38, 1.7], c: '#450a0a', top: '#dc2626' },
  { p: [0, 1.25, -.2], s: [.85, .25, .8], c: '#080102', top: '#180405' },
  { p: [0, 1.30, .4], s: [.78, .16, .1], c: '#ff0033', em: true },
  { p: [-.95, .55, 1.8], s: [.25, .15, .08], c: '#ff0033', em: true },
  { p: [.95, .55, 1.8], s: [.25, .15, .08], c: '#ff0033', em: true },
  { p: [-.7, .65, -1.9], s: [.28, .28, .15], c: '#ff5500', em: true },
  { p: [.7, .65, -1.9], s: [.28, .28, .15], c: '#ff5500', em: true },
  { p: [0, 1.55, -1.0], s: [.08, .35, .8], c: '#ff0033', em: true }
]);
/* Magnit Plus (MAGNET PLUS): neon-magenta (#e879f9) va oltin (#ffd166) korpus + yorqin PLUS ramzi */
const MESH_MAGNET_PLUS = meshOfBoxes([
  { p: [-.38, .56, 0], s: [.18, .42, .22], c: '#d946ef', top: '#f472b6', side: '#a21caf' },
  { p: [.38, .56, 0], s: [.18, .42, .22], c: '#d946ef', top: '#f472b6', side: '#a21caf' },
  { p: [0, .18, 0], s: [.58, .18, .22], c: '#c026d3', bot: '#86198f' },
  { p: [-.38, .92, 0], s: [.19, .10, .23], c: '#00e5ff', em: true, top: '#ffffff' },
  { p: [.38, .92, 0], s: [.19, .10, .23], c: '#ffd166', em: true, top: '#ffffff' },
  { p: [-.38, 1.04, 0], s: [.19, .06, .23], c: '#ffffff', em: true },
  { p: [.38, 1.04, 0], s: [.19, .06, .23], c: '#ffffff', em: true },
  { p: [0, .54, 0], s: [.26, .08, .16], c: '#ffffff', em: true },
  { p: [0, .54, 0], s: [.08, .26, .16], c: '#ffffff', em: true },
  { p: [-.48, .56, 0], s: [.05, .24, .18], c: '#ffd166', em: true },
  { p: [.48, .56, 0], s: [.05, .24, .18], c: '#ffd166', em: true }
]);

/* Qalqon Plus (SHIELD PLUS): kuchaytirilgan geksagonal prizma (#22d3ee) + markaziy 3D PLUS kresti */
const MESH_SHIELD_PLUS = mergeMesh(
  meshOfPrism(.58, 1.04, 6, '#22d3ee', '#67e8f9'),
  meshOfBoxes([
    { p: [0, .52, 0], s: [.68, .08, .68], c: '#ffd166', em: true },
    { p: [0, .52, 0], s: [.32, .10, .64], c: '#ffffff', em: true },
    { p: [0, .52, 0], s: [.10, .32, .64], c: '#ffffff', em: true },
    { p: [0, 1.06, 0], s: [.38, .07, .38], c: '#67e8f9', em: true, top: '#ffffff' },
    { p: [0, .02, 0], s: [.38, .07, .38], c: '#083344', bot: '#00e5ff' },
    { p: [-.36, .52, 0], s: [.06, .36, .10], c: '#46ff8f', em: true },
    { p: [.36, .52, 0], s: [.06, .36, .10], c: '#46ff8f', em: true }
  ])
);

/* Yurak Plus (HEART PLUS): yoqut/pushti yadro (#f43f5e) + markaziy oltin PLUS ramzi */
const MESH_HEART_PLUS = mergeMesh(
  meshOfBoxes([
    { p: [0, .54, 0], s: [.40, .28, .20], c: '#f43f5e', top: '#fb7185', bot: '#be123c', em: true },
    { p: [0, .54, .04], s: [.28, .09, .18], c: '#ffd166', top: '#ffffff', em: true },
    { p: [0, .54, .04], s: [.09, .28, .18], c: '#ffd166', top: '#ffffff', em: true },
    { p: [0, .54, .06], s: [.11, .11, .19], c: '#ffffff', em: true }
  ]),
  meshOfBoxes([
    { p: [-.20, .78, 0], s: [.21, .16, .18], c: '#f43f5e', top: '#ffd166', side: '#fb7185', em: true },
    { p: [.20, .78, 0], s: [.21, .16, .18], c: '#f43f5e', top: '#ffd166', side: '#fb7185', em: true },
    { p: [-.20, .88, 0], s: [.15, .06, .16], c: '#fb7185', top: '#ffffff', em: true },
    { p: [.20, .88, 0], s: [.15, .06, .16], c: '#fb7185', top: '#ffffff', em: true },
    { p: [-.31, .76, 0], s: [.06, .14, .14], c: '#ffd166', em: true },
    { p: [.31, .76, 0], s: [.06, .14, .14], c: '#ffd166', em: true }
  ]),
  meshOfBoxes([
    { p: [-.12, .28, 0], s: [.18, .24, .18], c: '#e11d48', bot: '#be123c', em: true },
    { p: [.12, .28, 0], s: [.18, .24, .18], c: '#e11d48', bot: '#be123c', em: true },
    { p: [0, .14, 0], s: [.14, .18, .16], c: '#ffd166', bot: '#ffffff', em: true }
  ])
);
const MESHES = {
  car: null,
  truck: ASSET_REGISTRY.registerMesh('truck', MESH_TRUCK),
  bar: ASSET_REGISTRY.registerMesh('bar', MESH_BAR),
  wall: ASSET_REGISTRY.registerMesh('wall', MESH_WALL),
  cone: ASSET_REGISTRY.registerMesh('cone', MESH_CONE),
  coin: ASSET_REGISTRY.registerMesh('coin', MESH_COIN),
  nitro: ASSET_REGISTRY.registerMesh('nitro', MESH_NITRO),
  shield: ASSET_REGISTRY.registerMesh('shield', MESH_SHIELD),
  magnet: ASSET_REGISTRY.registerMesh('magnet', MESH_MAGNET),
  life: ASSET_REGISTRY.registerMesh('life', MESH_LIFE),
  magnet_plus: ASSET_REGISTRY.registerMesh('magnet_plus', MESH_MAGNET_PLUS),
  shield_plus: ASSET_REGISTRY.registerMesh('shield_plus', MESH_SHIELD_PLUS),
  heart_plus: ASSET_REGISTRY.registerMesh('heart_plus', MESH_HEART_PLUS),
  checkpoint: ASSET_REGISTRY.registerMesh('checkpoint', MESH_CHECKPOINT),
  portal_active: ASSET_REGISTRY.registerMesh('portal_active', MESH_PORTAL_ACTIVE),
  portal_open: ASSET_REGISTRY.registerMesh('portal_open', MESH_PORTAL_OPEN),
  boss: ASSET_REGISTRY.registerMesh('boss', MESH_BOSS)
};

/* =====================================================================
   NEORUSH 3D ENVIRONMENT & UNIQUE BIOME ANIMATION ENGINE
   Genuine 3D Procedural Meshes, Spatial Parallax & Biome-Specific Animations
   ===================================================================== */
function _b3dBox(minX, minY, minZ, maxX, maxY, maxZ, c, top, bot, front, back, side, em, mat) {
  const px = (minX + maxX) * 0.5, py = (minY + maxY) * 0.5, pz = (minZ + maxZ) * 0.5;
  const hx = (maxX - minX) * 0.5, hy = (maxY - minY) * 0.5, hz = (maxZ - minZ) * 0.5;
  return { p: [px, py, pz], s: [hx, hy, hz], c, top: top || c, bot: bot || c, front: front || c, back: back || c, side: side || c, em: !!em, mat: mat || null };
}

const _b3dCache = new Map();

// Reusable AAA Neon City 3D Architectural Helpers
// Optimized 3D box builder for non-rotating (rotY=0) city architecture:
// Culls back-facing (+z) and occluded top/bottom faces relative to the racing camera (CAM.y ~ 2.15),
// cutting polygon count by ~42% with 100% identical visual appearance from the player's camera!
function meshOfCityBoxes(boxes) {
  const m = emptyMesh();
  for (const b of boxes) {
    if (b.mat && MATERIALS[b.mat]) ASSET_REGISTRY.applyMaterialProps(b, b.mat);
    const px = b.p[0], py = b.p[1], pz = b.p[2];
    const hx = b.s[0], hy = b.s[1], hz = b.s[2];
    const base = m.v.length;
    for (const u of CUBE_V) m.v.push([px + u[0] * hx, py + u[1] * hy, pz + u[2] * hz]);
    for (let fi = 0; fi < 6; fi++) {
      // fi=1 is +z (back face away from camera) -> always occluded when rotY=0 and z > CAM.z
      if (fi === 1) continue;
      // fi=4 is +y (top face) -> occluded when top of box is above camera eye height (py + hy > 2.6)
      if (fi === 4 && (py + hy) > 2.6) continue;
      // fi=5 is -y (bottom face) -> occluded when bottom of box is below camera eye height (py - hy < 2.2)
      if (fi === 5 && (py - hy) < 2.2) continue;
      m.f.push(CUBE_F[fi].map(i => i + base));
      let col = b.c || '#c9d6ff';
      if (fi === 4 && b.top) col = b.top;
      else if (fi === 5 && b.bot) col = b.bot;
      else if (fi === 0 && b.back) col = b.back;
      else if (fi === 1 && b.front) col = b.front;
      else if ((fi === 2 || fi === 3) && b.side) col = b.side;
      m.c.push(col); m.em.push(!!b.em);
      m.mat.push(b.mat || 'vehicleDarkMetal');
    }
  }
  return m;
}

function _cityAddPodium(b, w, d, h, nCol, cCol, lodLow) {
  // Heavy armored dark-slate podium plinth + cantilevered neon canopy
  b.push(_b3dBox(-w * 1.10, 0, -d * 1.06, w * 1.10, h, d * 1.06, '#060913', '#162038', '#03050a', '#0a1020', '#080d1a', '#0c1428', false, 'cityGlassSlate'));
  if (!lodLow) {
    b.push(_b3dBox(-w * 0.76, 0.15, -d * 1.10, w * 0.76, h * 0.75, d * 0.65, nCol, '#ffffff', nCol, '#e0f2fe', nCol, nCol, true, 'emissiveCyan'));
    b.push(_b3dBox(-w * 1.16, h * 0.78, -d * 1.14, w * 1.16, h * 0.96, d * 1.08, '#111a2e', '#1e293b', cCol, cCol, '#1e293b', nCol, false, 'industrialMetal'));
  }
}

function _cityAddExoColumnsAndLedges(b, w, d, y0, y1, ledgeStep, nCol, cCol, lodLow) {
  // Front & side corner structural steel exo-columns with integrated neon pilasters
  const cw = 0.30, cd = 0.30;
  b.push(_b3dBox(-w - 0.12, y0, -d - 0.12, -w + cw, y1, -d + cd, '#050811', '#1e293b', '#050811', nCol, '#050811', nCol, true, 'emissiveCyan'));
  b.push(_b3dBox(w - cw, y0, -d - 0.12, w + 0.12, y1, -d + cd, '#050811', '#1e293b', '#050811', cCol, '#050811', cCol, true, 'emissiveViolet'));
  if (!lodLow) {
    // Center vertical structural mullion splitting facade into recessed window bays
    b.push(_b3dBox(-0.18, y0, -d - 0.10, 0.18, y1, d + 0.08, '#050811', '#1e293b', '#050811', '#162238', '#050811', '#162238', false, 'industrialMetal'));
    // Horizontal structural spandrel ledges
    for (let ly = y0 + ledgeStep; ly < y1 - 0.8; ly += ledgeStep) {
      b.push(_b3dBox(-w - 0.09, ly, -d - 0.09, w + 0.09, ly + 0.24, d + 0.06, '#070b16', '#1e293b', '#04060d', '#1e293b', '#0f172a', '#162238', false, 'industrialMetal'));
    }
  }
}

function _cityAddWindowBays(b, w, d, y0, y1, stepY, seed, nCol, cCol, lodLow) {
  const actualStep = lodLow ? stepY * 1.55 : stepY;
  let rowIdx = 0;
  for (let wy = y0 + 0.65; wy < y1 - 0.85; wy += actualStep) {
    const pat = (rowIdx + seed) % 4;
    const winCol = pat === 0 ? nCol : (pat === 1 ? '#e0f2fe' : (pat === 2 ? '#fde047' : cCol));
    const sideCol = (rowIdx % 2 === 0) ? '#e0f2fe' : nCol;
    // Recessed window bay slab split by the center mullion & corner exo-columns
    b.push(_b3dBox(-w * 0.88, wy, -d - 0.05, w * 0.88, wy + 0.44, d * 0.82, winCol, winCol, winCol, winCol, winCol, sideCol, true, 'emissiveCyan'));
    rowIdx++;
  }
}

function _cityAddFramedHoloSign(b, cx, cy, cz, hx, hy, hz, signCol, accentCol, lodLow) {
  // 1) Structural dark-metal bezel frame with bright top/bottom emitter bars
  b.push(_b3dBox(cx - hx - 0.10, cy - hy - 0.12, cz - hz, cx + hx + 0.10, cy + hy + 0.12, cz + hz, '#0f172a', '#ffffff', accentCol, '#1e293b', '#0f172a', '#334155', false, 'industrialMetal'));
  // 2) Glowing holographic screen core
  b.push(_b3dBox(cx - hx, cy - hy + 0.12, cz - hz - 0.06, cx + hx, cy + hy - 0.12, cz + hz + 0.06, signCol, '#ffffff', accentCol, signCol, signCol, accentCol, true, 'emissiveViolet'));
}

const BIOME_3D = {
  models: {
    // 1. NEON CITY (ГОРОД БУДУЩЕГО) — 4 Distinct Architectural Skyscraper Archetypes
    citySkyscraper(v, neon, curbc, lodLow) {
      const nCol = neon || '#00e5ff', cCol = curbc || '#ff2fb9';
      const archType = v % 4;
      const b = [];

      if (archType === 0) {
        // ARCHETYPE 0: Neo-Corporate Stepped Megatower with Cantilevered Vertical Holograms & Twin Spires
        const w1 = 2.65, d1 = 2.50, h0 = 2.3, h1 = 10.8;
        _cityAddPodium(b, w1, d1, h0, nCol, cCol, lodLow);
        // Main recessed glass curtain-wall shaft
        b.push(_b3dBox(-w1, h0, -d1, w1, h1, d1, '#081021', '#1e293b', '#050811', '#0c162c', '#091224', '#0f1c36', false, 'cityGlassSlate'));
        _cityAddExoColumnsAndLedges(b, w1, d1, h0, h1, 2.8, nCol, cCol, lodLow);
        _cityAddWindowBays(b, w1, d1, h0, h1, 1.85, 0, nCol, cCol, lodLow);

        // Cantilevered tall vertical holographic signs on left & right facades with mounting struts
        if (!lodLow) {
          b.push(_b3dBox(-w1 - 0.55, 5.2, -0.35, -w1, 5.45, 0.35, '#334155', '#64748b', '#1e293b', '#334155', '#334155', '#334155', false, 'industrialMetal'));
          b.push(_b3dBox(w1, 5.2, -0.35, w1 + 0.55, 5.45, 0.35, '#334155', '#64748b', '#1e293b', '#334155', '#334155', '#334155', false, 'industrialMetal'));
        }
        _cityAddFramedHoloSign(b, -w1 - 0.52, 6.6, -0.45, 0.14, 2.3, 0.48, cCol, nCol, lodLow);
        _cityAddFramedHoloSign(b, w1 + 0.52, 6.6, -0.45, 0.14, 2.3, 0.48, nCol, cCol, lodLow);

        // Setback Tier 2
        const w2 = 1.92, d2 = 1.85, h2 = 15.8;
        b.push(_b3dBox(-w2, h1, -d2, w2, h2, d2, '#070d1c', '#1e293b', '#050811', '#0b1428', '#091020', '#12203d', false, 'cityGlassSlate'));
        _cityAddExoColumnsAndLedges(b, w2, d2, h1, h2, 2.5, cCol, nCol, lodLow);
        // Wide front-mounted framed holographic billboard on Tier 2
        _cityAddFramedHoloSign(b, 0, h1 + 2.3, -d2 - 0.14, w2 * 0.84, 1.15, 0.10, cCol, '#fde047', lodLow);

        // Tier 3 Mechanical Penthouse & Twin Spires
        const w3 = 1.18, d3 = 1.18, h3 = 18.2;
        b.push(_b3dBox(-w3, h2, -d3, w3, h3, d3, '#050914', nCol, '#050914', '#0a1224', '#0a1224', '#0e1830', false, 'industrialMetal'));
        b.push(_b3dBox(-0.55, h3, -0.10, -0.38, h3 + 3.8, 0.10, '#ffffff', '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'emissiveCyan'));
        b.push(_b3dBox(0.38, h3, -0.10, 0.55, h3 + 2.9, 0.10, cCol, '#ffffff', cCol, '#ffffff', cCol, cCol, true, 'emissiveViolet'));
        return meshOfCityBoxes(b);
      }

      if (archType === 1) {
        // ARCHETYPE 1: Twin-Core Skybridge Tower (Dual Vertical Shafts Connected by Elevated 3D Skybridge)
        const wP = 3.05, dP = 2.45, h0 = 2.2, h1 = 15.6;
        _cityAddPodium(b, wP, dP, h0, cCol, nCol, lodLow);

        // Left & Right Twin Shafts with open sky gap between x = -0.62 and +0.62
        for (const sDir of [-1, 1]) {
          const sx0 = sDir < 0 ? -2.90 : 0.62;
          const sx1 = sDir < 0 ? -0.62 : 2.90;
          const scx = (sx0 + sx1) * 0.5;
          const vCol = sDir < 0 ? nCol : cCol;
          b.push(_b3dBox(sx0, h0, -2.15, sx1, h1, 2.15, '#081020', '#1e293b', '#050811', '#0b152b', '#091022', '#101d38', false, 'cityGlassSlate'));
          // Vertical recessed neon channel up center of each shaft
          b.push(_b3dBox(scx - 0.14, h0 + 0.5, -2.23, scx + 0.14, h1 - 0.4, 2.23, vCol, '#ffffff', vCol, '#ffffff', vCol, vCol, true, 'emissiveCyan'));
          // Horizontal window bands on each shaft
          const wStep = lodLow ? 3.6 : 2.4;
          for (let wy = h0 + 1.0; wy < h1 - 1.0; wy += wStep) {
            const wc = ((wy | 0) % 2 === 0) ? '#e0f2fe' : '#fde047';
            b.push(_b3dBox(sx0 - 0.06, wy, -1.75, sx1 + 0.06, wy + 0.36, 1.75, wc, wc, wc, wc, wc, wc, true, 'emissiveCyan'));
          }
        }

        // Elevated Mid-Air 3D Skybridge (y = 7.4..9.4) with Framed Billboard
        b.push(_b3dBox(-1.15, 7.4, -1.95, 1.15, 9.4, 1.95, '#0f172a', '#38bdf8', '#090d16', '#1e293b', '#0f172a', '#1e293b', false, 'industrialMetal'));
        _cityAddFramedHoloSign(b, 0, 8.4, -2.08, 1.85, 0.78, 0.10, nCol, cCol, lodLow);

        // Upper Crown Skybridge (y = 13.6..15.0) & Twin Beacons
        b.push(_b3dBox(-2.95, 13.6, -2.20, 2.95, 14.8, 2.20, '#070b16', nCol, cCol, '#162238', '#0f172a', '#1e293b', false, 'industrialMetal'));
        b.push(_b3dBox(-1.85, h1, -0.12, -1.65, h1 + 3.4, 0.12, '#ff2b43', '#ffffff', '#ff2b43', '#ffffff', '#ff2b43', '#ff2b43', true, 'moltenMagma'));
        b.push(_b3dBox(1.65, h1, -0.12, 1.85, h1 + 3.4, 0.12, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'emissiveCyan'));
        return meshOfCityBoxes(b);
      }

      if (archType === 2) {
        // ARCHETYPE 2: Beveled Cyber-Ziggurat & Prismatic Spire (Uses Wedges + Boxes + Hex Prism)
        const w0 = 2.95, d0 = 2.75, h0 = 2.0;
        _cityAddPodium(b, w0, d0, h0, nCol, cCol, lodLow);
        // Stepped glowing neon ribs between wedge tiers
        b.push(_b3dBox(-2.55, 6.2, -2.45, 2.55, 6.65, 2.45, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'emissiveCyan'));
        b.push(_b3dBox(-1.85, 11.6, -1.80, 1.85, 12.05, 1.80, cCol, '#ffffff', cCol, '#ffffff', cCol, cCol, true, 'emissiveViolet'));
        // Vertical glowing core ribs on all 4 sides
        b.push(_b3dBox(-0.26, 2.0, -2.65, 0.26, 11.8, 2.65, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'emissiveCyan'));
        b.push(_b3dBox(-2.65, 2.0, -0.26, 2.65, 11.8, 0.26, cCol, '#ffffff', cCol, cCol, cCol, '#ffffff', true, 'emissiveViolet'));
        // Cantilevered side hologram fins
        _cityAddFramedHoloSign(b, -2.55, 9.0, -0.4, 0.14, 1.65, 0.45, cCol, '#fde047', lodLow);
        _cityAddFramedHoloSign(b, 2.55, 9.0, -0.4, 0.14, 1.65, 0.45, nCol, '#fde047', lodLow);
        // High-energy needle spire at apex
        b.push(_b3dBox(-0.12, 15.8, -0.12, 0.12, 20.5, 0.12, '#ffffff', '#ffffff', nCol, '#ffffff', '#ffffff', nCol, true, 'emissiveCyan'));

        const wedges = meshOfWedges([
          { p: [0, 4.1, 0], hz: 2.35, rr: [2.85, 2.1], fr: [2.25, 2.1], c: '#091224', top: '#1e293b', bot: '#050811', mat: 'cityGlassSlate' },
          { p: [0, 9.1, 0], hz: 1.85, rr: [2.25, 2.5], fr: [1.55, 2.5], c: '#0b162c', top: '#38bdf8', bot: '#070b16', mat: 'cityGlassSlate' }
        ]);
        const crownPrism = meshOfPrism(1.45, 3.8, 6, '#0f1c36', nCol);
        for (const pt of crownPrism.v) pt[1] += 12.0;
        return mergeMesh(meshOfCityBoxes(b), wedges, crownPrism);
      }

      // ARCHETYPE 3: Asymmetric High-Density Arcology, Corner Ticker & Rooftop Helipad
      _cityAddPodium(b, 2.95, 2.55, 2.1, nCol, cCol, lodLow);
      // Tall main slab (offset left: x = -2.75..+1.05, y = 2.1..15.2)
      b.push(_b3dBox(-2.75, 2.1, -2.35, 1.05, 15.2, 2.35, '#081020', '#1e293b', '#050811', '#0c162c', '#091122', '#101d36', false, 'cityGlassSlate'));
      _cityAddExoColumnsAndLedges(b, 2.75, 2.35, 2.1, 15.2, 3.2, nCol, cCol, lodLow);
      _cityAddWindowBays(b, 2.65, 2.32, 2.1, 14.8, 2.25, 2, nCol, cCol, lodLow);

      // Lower stepped side-wing (offset right: x = +1.05..+3.10, y = 2.1..9.4)
      b.push(_b3dBox(1.05, 2.1, -2.10, 3.10, 9.4, 2.10, '#0b1426', '#1e293b', '#050811', '#0f1c34', '#0b1426', '#162644', false, 'cityGlassSlate'));
      // Wrap-around L-shaped corner digital ticker billboards
      _cityAddFramedHoloSign(b, 1.45, 5.2, -2.24, 1.55, 0.85, 0.10, '#fde047', cCol, lodLow);
      _cityAddFramedHoloSign(b, -0.85, 11.4, -2.48, 1.55, 0.95, 0.10, cCol, nCol, lodLow);

      // 3D Rooftop Helipad Platform on top of the mid-rise wing (y = 9.4..9.85)
      b.push(_b3dBox(0.95, 9.4, -2.25, 3.25, 9.80, 2.25, '#1e293b', '#0f172a', nCol, nCol, '#1e293b', nCol, false, 'industrialMetal'));
      b.push(_b3dBox(1.35, 9.81, -1.45, 2.85, 9.92, 1.45, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));

      // Sloped wedge penthouse crown on main tower (y = 15.2..17.8) + comms array
      const roofWedge = meshOfWedges([
        { p: [-0.85, 16.4, 0], hz: 1.85, rr: [1.65, 1.2], fr: [0.95, 0.45], fy: -0.5, c: '#0d182e', top: cCol, bot: '#050811', mat: 'cityGlassSlate' }
      ]);
      b.push(_b3dBox(-0.95, 17.5, -0.10, -0.75, 21.0, 0.10, '#ffffff', '#ffffff', cCol, '#ffffff', cCol, cCol, true, 'emissiveViolet'));
      return mergeMesh(meshOfCityBoxes(b), roofWedge);
    },

    // Upgraded Roadside Streetlight + Utility Unit + Framed Vertical Street Hologram
    cityStreetLamp(side, neon, curbc, lodLow) {
      const b = [];
      const nCol = neon || '#00e5ff', cCol = curbc || '#ff2fb9';
      const armDir = side < 0 ? 1 : -1;

      // 1) Heavy anchored concrete/steel bollard base (y = 0..0.95) with hazard reflector strip
      b.push(_b3dBox(-0.28, 0, -0.28, 0.28, 0.95, 0.28, '#0f172a', '#334155', '#050811', '#1e293b', '#0f172a', '#1e293b', false, 'industrialMetal'));
      b.push(_b3dBox(-0.30, 0.22, -0.30, 0.30, 0.42, 0.30, '#fde047', '#ffffff', '#f59e0b', '#fde047', '#fde047', '#fde047', true, 'desertSandstone'));

      // 2) Roadside utility / ventilation cabinet beside mast (y = 0..1.35)
      if (!lodLow) {
        const ux0 = armDir < 0 ? 0.32 : -1.05;
        const ux1 = armDir < 0 ? 1.05 : -0.32;
        b.push(_b3dBox(ux0, 0, -0.36, ux1, 1.35, 0.36, '#111a2e', nCol, '#090d16', '#1e293b', '#111a2e', '#1e293b', false, 'industrialMetal'));
      }

      // 3) Structural vertical mast (y = 0.95..5.85) + diagonal support gusset (y = 4.7..5.45)
      b.push(_b3dBox(-0.15, 0.95, -0.15, 0.15, 5.85, 0.15, '#1e293b', '#475569', '#0f172a', '#334155', '#1e293b', '#334155', false, 'industrialMetal'));
      const gx0 = armDir > 0 ? 0.12 : -0.75, gx1 = armDir > 0 ? 0.75 : -0.12;
      b.push(_b3dBox(gx0, 4.75, -0.10, gx1, 5.40, 0.10, '#334155', '#64748b', '#1e293b', nCol, '#334155', '#475569', false, 'industrialMetal'));

      // 4) Double-arm cantilevered luminaire housing & dual LED emitter bars
      const minX = armDir > 0 ? -0.18 : -2.35, maxX = armDir > 0 ? 2.35 : 0.18;
      b.push(_b3dBox(minX, 5.45, -0.16, maxX, 5.78, 0.16, '#1e293b', '#64748b', '#0f172a', '#334155', '#1e293b', '#475569', false, 'industrialMetal'));
      const headX = armDir * 1.95;
      b.push(_b3dBox(headX - 0.48, 5.10, -0.28, headX + 0.48, 5.42, 0.28, nCol, '#ffffff', '#ffffff', '#ffffff', nCol, nCol, true, 'emissiveCyan'));

      // 5) Framed 3D Vertical Street Hologram Banner with Mounting Brackets (y = 2.1..4.5)
      const signCx = -armDir * 0.62;
      const brMinX = Math.min(0, signCx), brMaxX = Math.max(0, signCx);
      b.push(_b3dBox(brMinX, 4.25, -0.09, brMaxX, 4.42, 0.09, '#334155', '#64748b', '#1e293b', '#475569', '#334155', '#475569', false, 'industrialMetal'));
      _cityAddFramedHoloSign(b, signCx, 3.30, 0, 0.34, 1.15, 0.09, cCol, nCol, lodLow);
      return meshOfCityBoxes(b);
    },

    // New 3D Overhead Highway Sign Gantry & Suspended Hologram Bridge (rowType === 'arch')
    cityOverheadGantry(v, neon, curbc, lodLow) {
      const b = [];
      const nCol = neon || '#00e5ff', cCol = curbc || '#ff2fb9';
      // 1) Left & Right heavy truss support piers outside road shoulders (x = +/-4.45)
      for (const sDir of [-1, 1]) {
        const px0 = sDir * 4.45 - 0.26, px1 = sDir * 4.45 + 0.26;
        b.push(_b3dBox(px0, 0, -0.28, px1, 5.35, 0.28, '#0f172a', '#475569', '#050811', '#1e293b', '#0f172a', '#334155', false, 'industrialMetal'));
        const stripX0 = sDir < 0 ? px1 : px0 - 0.10;
        const stripX1 = sDir < 0 ? px1 + 0.10 : px0;
        b.push(_b3dBox(stripX0, 0.35, -0.16, stripX1, 4.85, 0.16, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'emissiveCyan'));
      }
      // 2) Overhead structural box-truss beam spanning the 3-lane highway (y = 4.80..5.30)
      b.push(_b3dBox(-4.75, 4.80, -0.28, 4.75, 5.30, 0.28, '#111a2e', '#475569', '#090d16', '#1e293b', '#111a2e', '#334155', false, 'industrialMetal'));
      // 3) Under-mounted Lane Guidance LED Pods aligned with the 3 playable lanes (-2.4, 0, +2.4)
      for (const lx of [-2.4, 0, 2.4]) {
        const podCol = lx === 0 ? '#46ff8f' : nCol;
        b.push(_b3dBox(lx - 0.38, 4.56, -0.18, lx + 0.38, 4.80, 0.18, podCol, '#ffffff', '#ffffff', '#ffffff', podCol, podCol, true, 'emissiveCyan'));
      }
      // 4) Dual Framed 3D Overhead Holographic Highway Signs mounted to gantry
      _cityAddFramedHoloSign(b, -1.95, 5.65, -0.18, 1.45, 0.58, 0.12, nCol, cCol, lodLow);
      _cityAddFramedHoloSign(b, 1.95, 5.65, -0.18, 1.45, 0.58, 0.12, cCol, '#fde047', lodLow);

      const gantryMesh = meshOfCityBoxes(b);
      if (!lodLow && (v % 2 === 1)) {
        const spinner = this.cityHoverCar(v, nCol);
        for (const pt of spinner.v) {
          pt[0] += (v % 4 === 1 ? -1.8 : 1.8);
          pt[1] += 6.75;
        }
        return mergeMesh(gantryMesh, spinner);
      }
      return gantryMesh;
    },

    // Upgraded 3D Cyber-Spinner Flying Vehicle (Sleek Wedge Nose, Canopy, Twin Thrusters)
    cityHoverCar(v, neon) {
      const b = [];
      const bodyCol = v % 2 === 0 ? '#162038' : '#2e1042';
      const tailCol = '#ff2b43';
      const headCol = neon || '#00e5ff';
      // Main chassis & side thruster nacelles
      b.push(_b3dBox(-0.92, 0.05, -1.65, 0.92, 0.44, 1.25, bodyCol, '#475569', '#050811', bodyCol, bodyCol, '#334155', false, 'vehicleChrome'));
      b.push(_b3dBox(-1.12, 0.0, -1.45, -0.78, 0.32, 1.10, '#0f172a', headCol, '#050811', '#1e293b', tailCol, '#1e293b', false, 'industrialMetal'));
      b.push(_b3dBox(0.78, 0.0, -1.45, 1.12, 0.32, 1.10, '#0f172a', headCol, '#050811', '#1e293b', tailCol, '#1e293b', false, 'industrialMetal'));
      // Tinted glass cockpit canopy
      b.push(_b3dBox(-0.56, 0.42, -0.75, 0.56, 0.80, 0.75, '#091326', '#38bdf8', '#091326', '#7dd3fc', '#091326', '#1e293b', false, 'cityGlassSlate'));
      // Afterburner taillight bar & dual laser headlights
      b.push(_b3dBox(-0.88, 0.12, -1.80, 0.88, 0.36, -1.58, tailCol, '#ffffff', tailCol, tailCol, '#ffffff', tailCol, true, 'moltenMagma'));
      b.push(_b3dBox(-0.84, 0.12, 1.55, 0.84, 0.32, 1.82, headCol, '#ffffff', headCol, '#ffffff', headCol, headCol, true, 'emissiveCyan'));
      const noseWedge = meshOfWedges([
        { p: [0, 0.22, 1.48], hz: 0.32, rr: [0.88, 0.20], fr: [0.48, 0.09], fy: -0.06, c: bodyCol, top: '#64748b', bot: '#050811', mat: 'vehicleChrome' }
      ]);
      return mergeMesh(meshOfBoxes(b), noseWedge);
    },

    // 2. DESERT (БЕСКОНЕЧНЫЕ ПЕСКИ / КРИСТАЛЬНАЯ ПУСТЫНЯ) — 4 Distinct Canyon & Crystal Desert Archetypes
    desertMesa(v, rockCol, accentCol, lodLow) {
      const nCol = accentCol || '#f59e0b';
      const archType = v % 4;
      const b = [];

      if (archType === 0) {
        // ARCHETYPE 0: Layered Grand Canyon Butte & Overhanging Sandstone Escarpment with Glowing Crystal Veins
        const w0 = 3.85, d0 = 3.25, h0 = 2.1;
        b.push(_b3dBox(-w0, 0, -d0, w0, h0, d0, '#5c1d0e', '#9a3412', '#361006', '#7c2d12', '#6c2410', '#853015', false, 'desertSandstone'));
        const w1 = 3.15, d1 = 2.65, h1 = 9.0;
        b.push(_b3dBox(-w1, h0, -d1, w1, h1, d1, '#7c2d12', '#b45309', '#451a03', '#9a3412', '#7c2d12', '#b45309', false, 'desertSandstone'));
        b.push(_b3dBox(-w1 * 1.05, h0 + 2.5, -d1 * 1.05, w1 * 1.05, h0 + 3.3, d1 * 1.02, '#d97706', '#f59e0b', '#451a03', '#d97706', '#7c2d12', '#f59e0b', false, 'desertSandstone'));
        b.push(_b3dBox(-0.30, h0 + 0.6, -d1 - 0.14, 0.30, h1 - 0.4, d1 * 0.85, nCol, '#ffffff', nCol, '#fde047', nCol, '#ef4444', true, 'moltenMagma'));
        const w2 = 3.48, d2 = 2.88, h2 = 10.9;
        b.push(_b3dBox(-w2, h1, -d2, w2, h2, d2, '#b45309', '#f59e0b', '#451a03', '#d97706', '#9a3412', '#f59e0b', false, 'desertSandstone'));
        const w3 = 1.95, d3 = 1.65, h3 = 13.6;
        b.push(_b3dBox(-w3, h2, -d3, w3, h3, d3, '#d97706', '#fde047', '#7c2d12', '#ea580c', '#b45309', '#fbbf24', false, 'desertSandstone'));
        b.push(_b3dBox(-0.35, h3, -0.32, 0.35, h3 + 1.6, 0.32, '#fde047', '#ffffff', nCol, '#ffffff', '#fde047', nCol, true, 'moltenMagma'));
        if (!lodLow) {
          b.push(_b3dBox(-w1 * 1.04, h0 + 5.2, -d1 * 1.04, w1 * 1.04, h0 + 5.9, d1 * 1.02, '#9a3412', '#ea580c', '#451a03', '#9a3412', '#7c2d12', '#ea580c', false, 'desertSandstone'));
        }
        return meshOfCityBoxes(b);
      }

      if (archType === 1) {
        // ARCHETYPE 1: Twin Sandstone Canyon Towers & Natural Stone Window Arch
        const wP = 3.70, dP = 2.65, h0 = 2.0, h1 = 10.4;
        b.push(_b3dBox(-wP, 0, -dP, wP, h0, dP, '#5c1d0e', '#9a3412', '#361006', '#7c2d12', '#5c1d0e', '#853015', false, 'desertSandstone'));
        for (const sDir of [-1, 1]) {
          const sx0 = sDir < 0 ? -3.45 : 0.82;
          const sx1 = sDir < 0 ? -0.82 : 3.45;
          const scx = (sx0 + sx1) * 0.5;
          b.push(_b3dBox(sx0, h0, -2.25, sx1, h1, 2.25, '#853015', '#d97706', '#451a03', '#9a3412', '#7c2d12', '#b45309', false, 'desertSandstone'));
          b.push(_b3dBox(scx - 0.16, h0 + 0.5, -2.32, scx + 0.16, h1 - 0.4, 2.25, sDir < 0 ? nCol : '#ef4444', '#ffffff', nCol, '#fde047', nCol, '#fde047', true, 'moltenMagma'));
        }
        b.push(_b3dBox(-3.60, h1, -2.40, 3.60, 12.3, 2.40, '#9a3412', '#f59e0b', '#451a03', '#c2410c', '#7c2d12', '#d97706', false, 'desertSandstone'));
        b.push(_b3dBox(-2.25, 12.3, -1.85, 2.25, 14.0, 1.85, '#b45309', '#fde047', '#7c2d12', '#ea580c', '#9a3412', '#fbbf24', false, 'desertSandstone'));
        if (!lodLow) {
          b.push(_b3dBox(-0.25, h1 - 1.2, -0.30, 0.25, h1, 0.30, '#fde047', '#ffffff', '#ef4444', '#fde047', '#f59e0b', '#ffffff', true, 'moltenMagma'));
        }
        return meshOfCityBoxes(b);
      }

      if (archType === 2) {
        // ARCHETYPE 2: Ancient Desert Sun-Ziggurat & Floating Prismatic Crystal Monolith
        const w0 = 3.55, d0 = 3.05, h0 = 1.9;
        b.push(_b3dBox(-w0, 0, -d0, w0, h0, d0, '#5c1d0e', '#9a3412', '#361006', '#78350f', '#5c1d0e', '#92400e', false, 'desertSandstone'));
        b.push(_b3dBox(-2.85, h0, -2.55, 2.85, 5.8, 2.55, '#7c2d12', '#b45309', '#451a03', '#9a3412', '#7c2d12', '#b45309', false, 'desertSandstone'));
        b.push(_b3dBox(-2.05, 5.8, -1.95, 2.05, 9.6, 1.95, '#9a3412', '#d97706', '#451a03', '#d97706', '#7c2d12', '#d97706', false, 'desertSandstone'));
        b.push(_b3dBox(-0.26, h0, -2.65, 0.26, 9.6, 2.60, '#fde047', '#ffffff', nCol, '#ffffff', nCol, '#fde047', true, 'moltenMagma'));
        const crystal = meshOfOcta(1.35, 2.8, '#fde047');
        for (const pt of crystal.v) pt[1] += 11.2;
        return mergeMesh(meshOfCityBoxes(b), crystal);
      }

      // ARCHETYPE 3: Asymmetric Stepped Badlands Escarpment & Balanced Hoodoo Rock
      const w0 = 3.75, d0 = 2.95, h0 = 2.0;
      b.push(_b3dBox(-w0, 0, -d0, w0, h0, d0, '#5c1d0e', '#9a3412', '#361006', '#7c2d12', '#5c1d0e', '#853015', false, 'desertSandstone'));
      b.push(_b3dBox(-3.45, h0, -2.45, 1.25, 12.6, 2.45, '#7c2d12', '#d97706', '#451a03', '#9a3412', '#7c2d12', '#b45309', false, 'desertSandstone'));
      b.push(_b3dBox(-2.65, 12.6, -1.95, 0.65, 14.5, 1.95, '#d97706', '#fde047', '#7c2d12', '#ea580c', '#b45309', '#fbbf24', false, 'desertSandstone'));
      b.push(_b3dBox(-1.35, h0 + 1.0, -2.54, -0.45, 12.0, 2.10, '#ef4444', '#ffffff', '#dc2626', '#fde047', '#f59e0b', '#fde047', true, 'moltenMagma'));
      b.push(_b3dBox(1.85, h0, -1.45, 3.15, 8.4, 1.45, '#9a3412', '#d97706', '#451a03', '#b45309', '#7c2d12', '#d97706', false, 'desertSandstone'));
      b.push(_b3dBox(1.40, 8.4, -1.85, 3.60, 10.1, 1.85, '#d97706', '#fde047', '#451a03', '#f59e0b', '#9a3412', '#fbbf24', false, 'desertSandstone'));
      b.push(_b3dBox(2.15, 10.1, -1.05, 2.85, 11.6, 1.05, nCol, '#ffffff', nCol, '#fde047', nCol, '#ffffff', true, 'moltenMagma'));
      return meshOfCityBoxes(b);
    },

    // Inner Roadside Layer: Sculpted Sandstone Hoodoo Pillar OR Prismatic Desert Crystal Cluster
    desertSpire(v, sideDir, rockCol, accentCol, lodLow) {
      const dir = sideDir || -1;
      const nCol = accentCol || '#f59e0b';
      const b = [];

      if ((v & 2) === 0) {
        // INNER VARIANT A: Sculpted Multi-Tier Sandstone Hoodoo Pillar
        b.push(_b3dBox(-1.15, 0, -1.02, 1.15, 1.40, 1.02, '#5c1d0e', '#9a3412', '#361006', '#7c2d12', '#5c1d0e', '#853015', false, 'desertSandstone'));
        b.push(_b3dBox(-0.65, 1.40, -0.62, 0.65, 4.40, 0.62, '#7c2d12', '#b45309', '#451a03', '#9a3412', '#7c2d12', '#b45309', false, 'desertSandstone'));
        b.push(_b3dBox(-1.22, 4.40, -1.10, 1.22, 5.45, 1.10, '#b45309', '#f59e0b', '#451a03', '#d97706', '#9a3412', '#fbbf24', false, 'desertSandstone'));
        const rx0 = dir < 0 ? 0.52 : -1.02;
        const rx1 = dir < 0 ? 1.02 : -0.52;
        b.push(_b3dBox(rx0, 0.45, -0.40, rx1, 4.30, 0.40, nCol, '#ffffff', '#ef4444', '#fde047', nCol, '#fde047', true, 'moltenMagma'));
        const tip = meshOfCone(0.90, 1.9, 5, '#d97706', '#fde047');
        for (const pt of tip.v) pt[1] += 5.45;
        return mergeMesh(meshOfCityBoxes(b), tip);
      }

      // INNER VARIANT B: Prismatic Desert Crystal Obelisk Cluster
      b.push(_b3dBox(-1.20, 0, -1.05, 1.20, 1.30, 1.05, '#451a03', '#9a3412', '#290f02', '#7c2d12', '#5c1d0e', '#853015', false, 'desertSandstone'));
      const p1 = meshOfPrism(0.82, 4.8, 5, '#d97706', '#fde047');
      const c1 = meshOfCone(0.82, 2.2, 5, '#f59e0b', '#ffffff');
      for (const pt of c1.v) pt[1] += 4.8;
      const offX = dir < 0 ? 0.65 : -0.65;
      b.push(_b3dBox(offX - 0.32, 0.7, -0.38, offX + 0.32, 4.0, 0.38, '#ef4444', '#ffffff', '#dc2626', '#fde047', '#f59e0b', '#fde047', true, 'moltenMagma'));
      return mergeMesh(meshOfCityBoxes(b), p1, c1);
    },

    // Overhead 3D Natural Sandstone Canyon Arch & Crystal Stalactite Span (rowType === 'arch')
    desertCanyonArch(v, neonCol, curbc, lodLow) {
      const nCol = neonCol || '#f59e0b', cCol = curbc || '#ef4444';
      const b = [];
      b.push(_b3dBox(-5.35, 0, -0.95, -4.05, 5.10, 0.95, '#7c2d12', '#b45309', '#451a03', '#9a3412', '#7c2d12', '#b45309', false, 'desertSandstone'));
      b.push(_b3dBox(4.05, 0, -0.95, 5.35, 5.10, 0.95, '#7c2d12', '#b45309', '#451a03', '#9a3412', '#7c2d12', '#b45309', false, 'desertSandstone'));
      b.push(_b3dBox(-4.05, 0.5, -0.32, -3.88, 4.75, 0.32, nCol, '#ffffff', nCol, '#fde047', nCol, '#fde047', true, 'moltenMagma'));
      b.push(_b3dBox(3.88, 0.5, -0.32, 4.05, 4.75, 0.32, cCol, '#ffffff', cCol, '#fde047', cCol, '#fde047', true, 'moltenMagma'));
      b.push(_b3dBox(-4.20, 4.25, -0.80, -2.55, 4.85, 0.80, '#9a3412', '#d97706', '#451a03', '#b45309', '#7c2d12', '#d97706', false, 'desertSandstone'));
      b.push(_b3dBox(2.55, 4.25, -0.80, 4.20, 4.85, 0.80, '#9a3412', '#d97706', '#451a03', '#b45309', '#7c2d12', '#d97706', false, 'desertSandstone'));
      b.push(_b3dBox(-5.20, 4.82, -0.85, 5.20, 5.55, 0.85, '#b45309', '#f59e0b', '#451a03', '#d97706', '#9a3412', '#fbbf24', false, 'desertSandstone'));
      b.push(_b3dBox(-2.55, 5.55, -0.70, 2.55, 6.08, 0.70, '#d97706', '#fde047', '#7c2d12', '#ea580c', '#b45309', '#fde047', false, 'desertSandstone'));
      b.push(_b3dBox(-2.45, 4.38, -0.28, -2.05, 4.82, 0.28, nCol, '#ffffff', nCol, '#ffffff', nCol, '#fde047', true, 'moltenMagma'));
      b.push(_b3dBox(-0.25, 4.42, -0.28, 0.25, 4.85, 0.28, '#fde047', '#ffffff', '#fde047', '#ffffff', '#fde047', '#ffffff', true, 'moltenMagma'));
      b.push(_b3dBox(2.05, 4.38, -0.28, 2.45, 4.82, 0.28, cCol, '#ffffff', cCol, '#ffffff', cCol, '#fde047', true, 'moltenMagma'));
      return meshOfCityBoxes(b);
    },

    // 3. FOREST / EMERALD FOREST (ИЗУМРУДНЫЙ ЛЕС — AAA ANCIENT ALIEN FOREST)
    // 4 Distinct Massive Outer 3D Ancient Giants, Bioluminescent Crystal Trees & Overgrown Shrines
    forestAncientGiant(v, foliageCol, neonCol, lodLow) {
      const nCol = neonCol || '#10b981';
      const variant = (v || 0) % 4;
      const b = [];

      if (variant === 0) {
        // Archetype 0: Ancient Emerald Giant Tree (Buttressed sculpted burl trunk with layered tiered canopies & glowing sap fissure)
        const w1 = 3.6, h1 = 2.4, d1 = 2.6;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#271810', '#065f46', '#140c08', '#3f271d', '#271810', '#342016', false, 'forestBark'));
        const w2 = 1.6, h2 = 7.8, d2 = 1.6;
        b.push(_b3dBox(-w2, h1, -d2, w2, h2, d2, '#3f271d', '#059669', '#1a100a', '#5c3a28', '#3f271d', '#4a2e20', false, 'forestBark'));
        // Lower Broad Canopy Tier
        b.push(_b3dBox(-4.2, h2, -2.4, 4.2, 10.8, 2.4, '#064e3b', '#34d399', '#022c22', '#047857', '#064e3b', '#059669', false, 'alienBiolum'));
        // Upper Crown Canopy Tier
        b.push(_b3dBox(-2.6, 10.8, -1.8, 2.6, 14.2, 1.8, '#047857', '#6ee7b7', '#064e3b', '#059669', '#047857', '#10b981', false, 'alienBiolum'));
        // Emissive vertical bioluminescent sap fissure
        b.push(_b3dBox(-0.22, 0.8, -d2 - 0.12, 0.22, h2 * 0.95, -d2 + 0.15, nCol, '#ffffff', nCol, '#6ee7b7', nCol, nCol, true, 'alienBiolum'));
        if (!lodLow) {
          const cap = meshOfOcta(1.25, 1.8, '#34d399', 'alienBiolum');
          for (const pt of cap.v) pt[1] += 14.6;
          return mergeMesh(meshOfCityBoxes(b), cap);
        }
        return meshOfCityBoxes(b);
      } else if (variant === 1) {
        // Archetype 1: Bioluminescent Crystal Tree (Angular crystalline trunk splitting into twin branching limbs with suspended spore orb)
        const w1 = 3.2, h1 = 2.0, d1 = 2.4;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#1e2922', '#10b981', '#0b130e', '#2a3b31', '#1e2922', '#233229', false, 'forestBark'));
        // Dominant Left Crystal Limb
        b.push(_b3dBox(-3.4, h1, -1.6, -1.0, 13.8, 1.6, '#065f46', '#6ee7b7', '#022c22', '#10b981', '#065f46', '#34d399', false, 'alienBiolum'));
        // Secondary Right Limb
        b.push(_b3dBox(1.0, h1, -1.4, 2.8, 10.2, 1.4, '#047857', '#34d399', '#022c22', '#059669', '#047857', '#10b981', false, 'alienBiolum'));
        // Radiant Center Energy Shaft
        b.push(_b3dBox(-0.8, h1 + 0.4, -1.5, 0.8, h1 + 5.8, -1.3, nCol, '#ffffff', nCol, '#a7f3d0', nCol, nCol, true, 'alienBiolum'));
        if (!lodLow) {
          const orb = meshOfOcta(1.05, 1.6, '#6ee7b7', 'alienBiolum');
          for (const pt of orb.v) { pt[0] -= 0.1; pt[1] += 11.4; }
          return mergeMesh(meshOfCityBoxes(b), orb);
        }
        return meshOfCityBoxes(b);
      } else if (variant === 2) {
        // Archetype 2: Ancient Forest Monolith & Overgrown Shrine (Stepped stone menhir with glowing runic bio-energy band)
        const w1 = 3.8, h1 = 2.8, d1 = 2.6;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#1c2820', '#059669', '#0b130e', '#26362b', '#1c2820', '#202e25', false, 'forestBark'));
        const w2 = 2.6, h2 = 7.2, d2 = 1.8;
        b.push(_b3dBox(-w2, h1, -d2, w2, h2, d2, '#26362b', '#10b981', '#0b130e', '#344b3c', '#26362b', '#2c3f33', false, 'forestBark'));
        const w3 = 1.4, h3 = 13.2, d3 = 1.2;
        b.push(_b3dBox(-w3, h2, -d3, w3, h3, d3, '#047857', '#6ee7b7', '#022c22', '#10b981', '#047857', '#34d399', false, 'alienBiolum'));
        // Horizontal Glowing Bio-Energy Band
        b.push(_b3dBox(-w2 - 0.15, h1 + 1.8, -d2 - 0.15, w2 + 0.15, h1 + 2.4, d2 + 0.15, nCol, '#ffffff', nCol, '#a7f3d0', nCol, nCol, true, 'alienBiolum'));
        if (!lodLow) {
          const crown = meshOfOcta(1.2, 1.8, '#10b981', 'alienBiolum');
          for (const pt of crown.v) pt[1] += h3 + 1.0;
          return mergeMesh(meshOfCityBoxes(b), crown);
        }
        return meshOfCityBoxes(b);
      } else {
        // Archetype 3: Massive Overhanging Root Arch Spur & Hollow Burl (Asymmetric twisted limb leaning toward track)
        const w1 = 3.6, h1 = 3.0, d1 = 2.4;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#271810', '#047857', '#140c08', '#3f271d', '#271810', '#342016', false, 'forestBark'));
        // Projecting Hollow Burl Shelf
        b.push(_b3dBox(-2.5, h1, -3.0, 2.3, 7.8, 1.8, '#3f271d', '#10b981', '#140c08', '#5c3a28', '#3f271d', '#4a2e20', false, 'forestBark'));
        // Rising Twisted Limb
        b.push(_b3dBox(-1.2, 7.8, -2.6, 1.0, 13.6, 0.8, '#064e3b', '#6ee7b7', '#022c22', '#047857', '#064e3b', '#34d399', false, 'alienBiolum'));
        // Radiant Hollow Under-Burl Glow
        b.push(_b3dBox(-2.2, h1 + 0.2, -2.9, 2.0, h1 + 0.8, -2.6, nCol, '#ffffff', nCol, '#6ee7b7', nCol, nCol, true, 'alienBiolum'));
        return meshOfCityBoxes(b);
      }
    },

    // Inner Roadside Waystones & Bioluminescent Spore Spires
    forestShrine(v, sideDir, neonCol, lodLow) {
      const nCol = neonCol || '#10b981';
      const variant = (v || 0) & 1;
      const b = [];
      const sDir = sideDir || -1;

      if (variant === 0) {
        // Ancient Mossy Runic Waystone with Directional Chevron
        b.push(_b3dBox(-0.85, 0, -0.85, 0.85, 1.2, 0.85, '#1c2820', '#10b981', '#0b130e', '#26362b', '#1c2820', '#202e25', false, 'forestBark'));
        b.push(_b3dBox(-0.45, 1.2, -0.45, 0.45, 6.4, 0.45, '#26362b', '#6ee7b7', '#0b130e', '#047857', '#26362b', '#34d399', false, 'alienBiolum'));
        // Emissive Vertical Runic Conduit
        b.push(_b3dBox(-0.16, 1.4, -0.52, 0.16, 6.0, 0.52, nCol, '#ffffff', nCol, '#6ee7b7', nCol, nCol, true, 'alienBiolum'));
        // Directional Hazard Warning Chevron pointing toward track
        b.push(_b3dBox(-0.55 * sDir, 4.2, -0.55, 0.55 * sDir, 4.8, 0.55, '#6ee7b7', '#ffffff', '#6ee7b7', '#ffffff', '#6ee7b7', '#6ee7b7', true, 'alienBiolum'));
        if (!lodLow) {
          const cap = meshOfOcta(0.65, 1.2, '#a7f3d0', 'alienBiolum');
          for (const pt of cap.v) pt[1] += 7.0;
          return mergeMesh(meshOfCityBoxes(b), cap);
        }
        return meshOfCityBoxes(b);
      } else {
        // Bioluminescent Spore Cluster & Root Pillar
        b.push(_b3dBox(-1.1, 0, -0.9, 1.1, 0.85, 0.9, '#271810', '#059669', '#140c08', '#3f271d', '#271810', '#342016', false, 'forestBark'));
        // Primary Center Root Spire
        b.push(_b3dBox(-0.35, 0.85, -0.35, 0.35, 5.6, 0.35, '#047857', '#6ee7b7', '#022c22', '#10b981', '#047857', '#34d399', false, 'alienBiolum'));
        // Flanking Needles
        b.push(_b3dBox(-0.95, 0.85, -0.28, -0.42, 3.6, 0.28, '#064e3b', '#34d399', '#022c22', '#059669', '#064e3b', '#10b981', false, 'alienBiolum'));
        b.push(_b3dBox(0.42, 0.85, -0.28, 0.95, 2.6, 0.28, '#271810', '#10b981', '#140c08', '#3f271d', '#271810', '#059669', false, 'forestBark'));
        // Luminous Pulsing Spore Node
        b.push(_b3dBox(-0.25, 3.8, -0.42, 0.25, 4.4, 0.42, nCol, '#ffffff', nCol, '#a7f3d0', nCol, nCol, true, 'alienBiolum'));
        if (!lodLow) {
          const topShard = meshOfOcta(0.55, 1.1, '#6ee7b7', 'alienBiolum');
          for (const pt of topShard.v) pt[1] += 6.2;
          return mergeMesh(meshOfCityBoxes(b), topShard);
        }
        return meshOfCityBoxes(b);
      }
    },

    // 3D Overhead Ancient Root Arch / Alien Bio-Gateway (Spanning all 3 racing lanes)
    forestRootArch(v, neonCol, curbc, lodLow) {
      const nCol = neonCol || '#10b981';
      const b = [];
      // Heavy Left Root Buttress Trunk (x = -12.6 to -9.2)
      b.push(_b3dBox(-12.6, 0, -2.4, -9.2, 9.2, 2.4, '#271810', '#059669', '#140c08', '#3f271d', '#271810', '#342016', false, 'forestBark'));
      // Inward Slanted Left Branch Corbel
      b.push(_b3dBox(-11.2, 9.2, -2.1, -7.8, 11.4, 2.1, '#3f271d', '#10b981', '#140c08', '#047857', '#3f271d', '#059669', false, 'forestBark'));
      // Heavy Right Root Buttress Trunk (x = +9.2 to +12.6)
      b.push(_b3dBox(9.2, 0, -2.4, 12.6, 9.2, 2.4, '#271810', '#059669', '#140c08', '#3f271d', '#271810', '#342016', false, 'forestBark'));
      // Inward Slanted Right Branch Corbel
      b.push(_b3dBox(7.8, 9.2, -2.1, 11.2, 11.4, 2.1, '#3f271d', '#10b981', '#140c08', '#047857', '#3f271d', '#059669', false, 'forestBark'));
      // High Ancient Root Span Arch (x = -9.6 to +9.6, clears y = 10.8 above tallest vehicles)
      b.push(_b3dBox(-9.6, 11.0, -1.9, 9.6, 14.4, 1.9, '#064e3b', '#6ee7b7', '#022c22', '#047857', '#064e3b', '#34d399', false, 'alienBiolum'));
      // Upper Foliage Crest Canopy
      b.push(_b3dBox(-7.8, 14.4, -1.3, 7.8, 15.6, 1.3, '#047857', '#a7f3d0', '#064e3b', '#10b981', '#047857', '#34d399', false, 'alienBiolum'));
      // Overhead Luminous Bioluminescent Vine Seam
      b.push(_b3dBox(-8.8, 10.5, -2.05, 8.8, 11.0, -1.75, nCol, '#ffffff', nCol, '#6ee7b7', nCol, nCol, true, 'alienBiolum'));

      if (!lodLow) {
        // Hanging Bioluminescent Spore Pods below arch span
        const st1 = meshOfOcta(0.65, 1.6, '#34d399', 'alienBiolum');
        for (const pt of st1.v) { pt[0] -= 4.5; pt[1] += 9.7; }
        const st2 = meshOfOcta(0.85, 2.0, '#6ee7b7', 'alienBiolum');
        for (const pt of st2.v) { pt[1] += 9.5; }
        const st3 = meshOfOcta(0.65, 1.6, '#34d399', 'alienBiolum');
        for (const pt of st3.v) { pt[0] += 4.5; pt[1] += 9.7; }
        return mergeMesh(meshOfCityBoxes(b), st1, st2, st3);
      }
      return meshOfCityBoxes(b);
    },

    // Backward-compatibility wrappers for legacy test callers:
    forestTree(v, foliageCol, trunkCol) {
      return this.forestAncientGiant(v, foliageCol, '#10b981', false);
    },
    forestSpore(foliageCol, neon) {
      return this.forestShrine(0, -1, neon || '#10b981', false);
    },

    // 4. SNOW / ICE ORBIT (ЛЕДЯНАЯ ОРБИТА — AAA EXTRATERRESTRIAL ENVIRONMENT)
    // 4 Distinct Massive Outer 3D Ice Cliffs, Spire Pinnacles & Orbital Monoliths
    iceGlacier(v, neonCol, lodLow) {
      const nCol = neonCol || '#38bdf8';
      const variant = (v || 0) % 4;
      const b = [];

      if (variant === 0) {
        // Archetype 0: The Great Glacial Crag & Cryo-Pinnacle (Sheer ice bluff with vertical fault fracture & crystal needle summit)
        const w1 = 4.4, h1 = 3.8, d1 = 2.6;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#072a4a', '#38bdf8', '#041524', '#0c4a6e', '#072a4a', '#0369a1', false, 'glacialIce'));
        const w2 = 3.2, h2 = 8.6, d2 = 2.0;
        b.push(_b3dBox(-w2, h1, -d2, w2 * 0.9, h2, d2, '#0c4a6e', '#e0f2fe', '#072a4a', '#0284c7', '#0c4a6e', '#0ea5e9', false, 'glacialIce'));
        const w3 = 1.4, h3 = 14.8, d3 = 1.3;
        b.push(_b3dBox(-w3, h2, -d3, w3 * 0.8, h3, d3, '#0284c7', '#ffffff', '#0c4a6e', '#38bdf8', '#0284c7', '#7dd3fc', false, 'iceCrystalline'));
        // Emissive subterranean cryo-fracture fault
        b.push(_b3dBox(-0.25, 0.4, -d1 - 0.12, 0.25, h2 * 0.95, -d1 + 0.15, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'energyTransparent'));
        if (!lodLow) {
          const cap = meshOfOcta(1.25, 1.9, '#bae6fd', 'iceCrystalline');
          for (const pt of cap.v) pt[1] += h3 + 0.9;
          return mergeMesh(meshOfCityBoxes(b), cap);
        }
        return meshOfCityBoxes(b);
      } else if (variant === 1) {
        // Archetype 1: Twin Crystalline Spire & Orbital Chasm (Two asymmetric rising crystal needles with glowing chasm)
        const w1 = 3.8, h1 = 2.8, d1 = 2.4;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#082f49', '#7dd3fc', '#021024', '#0369a1', '#082f49', '#0284c7', false, 'glacialIce'));
        // Dominant Left Needle
        b.push(_b3dBox(-3.5, h1, -1.8, -1.1, 14.2, 1.8, '#0369a1', '#ffffff', '#082f49', '#38bdf8', '#0369a1', '#7dd3fc', false, 'iceCrystalline'));
        // Secondary Right Needle
        b.push(_b3dBox(1.0, h1, -1.6, 2.9, 10.6, 1.6, '#0284c7', '#e0f2fe', '#082f49', '#0ea5e9', '#0284c7', '#38bdf8', false, 'glacialIce'));
        // Luminous Chasm energy field
        b.push(_b3dBox(-1.0, h1 + 0.4, -1.7, 0.9, h1 + 6.4, -1.5, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'energyTransparent'));
        if (!lodLow) {
          const shard = meshOfOcta(1.0, 1.6, '#e0f2fe', 'iceCrystalline');
          for (const pt of shard.v) { pt[0] -= 0.1; pt[1] += 11.8; }
          return mergeMesh(meshOfCityBoxes(b), shard);
        }
        return meshOfCityBoxes(b);
      } else if (variant === 2) {
        // Archetype 2: Extraterrestrial Cryo-Monolith & Stepped Ice Sheaths (Alien geometric beacon encased in polar glacier)
        const w1 = 4.0, h1 = 3.2, d1 = 2.8;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#072a4a', '#38bdf8', '#031226', '#0c4a6e', '#072a4a', '#0284c7', false, 'glacialIce'));
        const w2 = 2.8, h2 = 7.8, d2 = 2.0;
        b.push(_b3dBox(-w2, h1, -d2, w2, h2, d2, '#0c4a6e', '#e0f2fe', '#072a4a', '#0284c7', '#0c4a6e', '#38bdf8', false, 'glacialIce'));
        const w3 = 1.6, h3 = 13.6, d3 = 1.4;
        b.push(_b3dBox(-w3, h2, -d3, w3, h3, d3, '#0284c7', '#ffffff', '#0c4a6e', '#38bdf8', '#0284c7', '#7dd3fc', false, 'iceCrystalline'));
        // Horizontal Orbital Ring Sheath
        b.push(_b3dBox(-w2 - 0.15, h1 + 1.8, -d2 - 0.15, w2 + 0.15, h1 + 2.4, d2 + 0.15, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'energyTransparent'));
        if (!lodLow) {
          const crown = meshOfOcta(1.35, 2.1, '#bae6fd', 'iceCrystalline');
          for (const pt of crown.v) pt[1] += h3 + 1.1;
          return mergeMesh(meshOfCityBoxes(b), crown);
        }
        return meshOfCityBoxes(b);
      } else {
        // Archetype 3: Glacial Ice Fang with Overhanging Crevasse (Forward jutting alien ice spur with illuminated crevasse)
        const w1 = 3.8, h1 = 3.4, d1 = 2.6;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#082f49', '#7dd3fc', '#021024', '#0369a1', '#082f49', '#0284c7', false, 'glacialIce'));
        // Projecting Overhang Shelf
        b.push(_b3dBox(-2.7, h1, -3.2, 2.5, 8.2, 1.8, '#0369a1', '#e0f2fe', '#082f49', '#0284c7', '#0369a1', '#38bdf8', false, 'glacialIce'));
        // Rising Fang Needle
        b.push(_b3dBox(-1.3, 8.2, -2.8, 1.1, 14.0, 0.8, '#0284c7', '#ffffff', '#0369a1', '#38bdf8', '#0284c7', '#7dd3fc', false, 'iceCrystalline'));
        // Radiant Under-shelf crevasse glow
        b.push(_b3dBox(-2.3, h1 + 0.2, -3.1, 2.1, h1 + 0.8, -2.8, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'energyTransparent'));
        return meshOfCityBoxes(b);
      }
    },

    // Inner Roadside Waypoints & Cryo-Pillars (Replaces generic snow pines with faceted cryo-spires)
    iceBeacon(v, sideDir, neonCol, lodLow) {
      const nCol = neonCol || '#38bdf8';
      const variant = (v || 0) & 1;
      const b = [];
      const sDir = sideDir || -1;

      if (variant === 0) {
        // Crystalline Waypoint Spire with Energy Core & Directional Chevron
        b.push(_b3dBox(-0.85, 0, -0.85, 0.85, 1.2, 0.85, '#072a4a', '#7dd3fc', '#031226', '#0c4a6e', '#072a4a', '#0369a1', false, 'glacialIce'));
        b.push(_b3dBox(-0.45, 1.2, -0.45, 0.45, 6.6, 0.45, '#0369a1', '#e0f2fe', '#072a4a', '#38bdf8', '#0369a1', '#7dd3fc', false, 'iceCrystalline'));
        // Emissive Vertical Energy Core
        b.push(_b3dBox(-0.16, 1.4, -0.52, 0.16, 6.2, 0.52, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'energyTransparent'));
        // Directional Chevron Marker pointing toward track
        b.push(_b3dBox(-0.55 * sDir, 4.2, -0.55, 0.55 * sDir, 4.8, 0.55, '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', true, 'energyTransparent'));
        if (!lodLow) {
          const cap = meshOfOcta(0.65, 1.25, '#bae6fd', 'iceCrystalline');
          for (const pt of cap.v) pt[1] += 7.2;
          return mergeMesh(meshOfCityBoxes(b), cap);
        }
        return meshOfCityBoxes(b);
      } else {
        // Tiered Cryo-Cluster & Solar Resonator Node
        b.push(_b3dBox(-1.1, 0, -0.9, 1.1, 0.85, 0.9, '#082f49', '#38bdf8', '#021024', '#0369a1', '#082f49', '#0284c7', false, 'glacialIce'));
        // Primary Center Needle
        b.push(_b3dBox(-0.35, 0.85, -0.35, 0.35, 5.8, 0.35, '#0284c7', '#ffffff', '#082f49', '#7dd3fc', '#0284c7', '#38bdf8', false, 'iceCrystalline'));
        // Flanking Shards
        b.push(_b3dBox(-0.95, 0.85, -0.28, -0.42, 3.8, 0.28, '#0369a1', '#bae6fd', '#082f49', '#38bdf8', '#0369a1', '#0ea5e9', false, 'glacialIce'));
        b.push(_b3dBox(0.42, 0.85, -0.28, 0.95, 2.8, 0.28, '#072a4a', '#7dd3fc', '#082f49', '#0284c7', '#072a4a', '#0369a1', false, 'glacialIce'));
        // Luminous Pulsing Resonator
        b.push(_b3dBox(-0.25, 4.0, -0.42, 0.25, 4.6, 0.42, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'energyTransparent'));
        if (!lodLow) {
          const topShard = meshOfOcta(0.55, 1.1, '#e0f2fe', 'iceCrystalline');
          for (const pt of topShard.v) pt[1] += 6.4;
          return mergeMesh(meshOfCityBoxes(b), topShard);
        }
        return meshOfCityBoxes(b);
      }
    },

    // 3D Overhead Frozen Orbital Ice Arch / Cryo-Bridge (Spanning all 3 racing lanes)
    iceOrbitalArch(v, neonCol, curbc, lodLow) {
      const nCol = neonCol || '#38bdf8';
      const b = [];
      // Heavy Left Glacial Pylon (x = -12.6 to -9.2)
      b.push(_b3dBox(-12.6, 0, -2.4, -9.2, 9.2, 2.4, '#072a4a', '#7dd3fc', '#031226', '#0c4a6e', '#072a4a', '#0369a1', false, 'glacialIce'));
      // Inward Slanted Left Corbel
      b.push(_b3dBox(-11.2, 9.2, -2.1, -7.8, 11.4, 2.1, '#0c4a6e', '#e0f2fe', '#072a4a', '#0284c7', '#0c4a6e', '#38bdf8', false, 'glacialIce'));
      // Heavy Right Glacial Pylon (x = +9.2 to +12.6)
      b.push(_b3dBox(9.2, 0, -2.4, 12.6, 9.2, 2.4, '#072a4a', '#7dd3fc', '#031226', '#0c4a6e', '#072a4a', '#0369a1', false, 'glacialIce'));
      // Inward Slanted Right Corbel
      b.push(_b3dBox(7.8, 9.2, -2.1, 11.2, 11.4, 2.1, '#0c4a6e', '#e0f2fe', '#072a4a', '#0284c7', '#0c4a6e', '#38bdf8', false, 'glacialIce'));
      // High Translucent Glacial Span Arch (x = -9.6 to +9.6, clears y = 10.8 above tallest vehicles)
      b.push(_b3dBox(-9.6, 11.0, -1.9, 9.6, 14.4, 1.9, '#0369a1', '#ffffff', '#072a4a', '#38bdf8', '#0369a1', '#7dd3fc', false, 'glacialIce'));
      // Upper Frost Crest Ridge
      b.push(_b3dBox(-7.8, 14.4, -1.3, 7.8, 15.6, 1.3, '#bae6fd', '#ffffff', '#0369a1', '#e0f2fe', '#bae6fd', '#ffffff', false, 'iceCrystalline'));
      // Overhead Luminous Cryo-Navigation Strip
      b.push(_b3dBox(-8.8, 10.5, -2.05, 8.8, 11.0, -1.75, nCol, '#ffffff', nCol, '#ffffff', nCol, nCol, true, 'energyTransparent'));

      if (!lodLow) {
        // Hanging Ice Crystal Stalactites below span
        const st1 = meshOfOcta(0.65, 1.6, '#bae6fd', 'iceCrystalline');
        for (const pt of st1.v) { pt[0] -= 4.5; pt[1] += 9.7; }
        const st2 = meshOfOcta(0.85, 2.0, '#ffffff', 'iceCrystalline');
        for (const pt of st2.v) { pt[1] += 9.5; }
        const st3 = meshOfOcta(0.65, 1.6, '#bae6fd', 'iceCrystalline');
        for (const pt of st3.v) { pt[0] += 4.5; pt[1] += 9.7; }
        return mergeMesh(meshOfCityBoxes(b), st1, st2, st3);
      }
      return meshOfCityBoxes(b);
    },

    // Backward-compatibility wrappers for legacy test callers:
    iceSpire(v, iceCol) {
      return this.iceGlacier(v, iceCol, false);
    },
    snowPine(v) {
      return this.iceBeacon(v, -1, '#38bdf8', false);
    },

    // 5. VOLCANO / LAVA & MAGMA (ЛАВА И МАГМА — AAA CALDERA ENVIRONMENT)
    // 4 Distinct Massive Outer 3D Volcanic Basalt Crags, Caldera Towers & Magma Cascades
    volcanoCaldera(v, rockCol, magmaCol, lodLow) {
      const mCol = magmaCol || '#ff5500';
      const variant = (v || 0) % 4;
      const b = [];

      if (variant === 0) {
        // Archetype 0: The Great Basalt Crag with Magma Cascades (Sheer fractured caldera cliff with vertical fissure)
        const w1 = 4.4, h1 = 3.6, d1 = 2.6;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#181312', '#442822', '#0a0504', '#241a18', '#181312', '#2c1e1a', false, 'volcanicBasalt'));
        const w2 = 3.2, h2 = 8.4, d2 = 2.0;
        b.push(_b3dBox(-w2, h1, -d2, w2 * 0.9, h2, d2, '#211816', '#f97316', '#140c0b', '#2e201c', '#211816', '#3b2824', false, 'volcanicBasalt'));
        const w3 = 1.4, h3 = 14.4, d3 = 1.3;
        b.push(_b3dBox(-w3, h2, -d3, w3 * 0.8, h3, d3, '#2a1d1a', '#fef08a', '#140c0b', '#f97316', '#2a1d1a', '#ff4500', false, 'volcanicBasalt'));
        // Emissive vertical molten fissure
        b.push(_b3dBox(-0.30, 0.4, -d1 - 0.12, 0.30, h2 * 0.95, -d1 + 0.15, mCol, '#fef08a', mCol, '#fef08a', mCol, mCol, true, 'moltenMagma'));
        if (!lodLow) {
          const cap = meshOfOcta(1.2, 1.8, '#ff5500', 'moltenMagma');
          for (const pt of cap.v) pt[1] += h3 + 0.9;
          return mergeMesh(meshOfCityBoxes(b), cap);
        }
        return meshOfCityBoxes(b);
      } else if (variant === 1) {
        // Archetype 1: Twin Basalt Horns & Molten Vent Chasm (Two asymmetric volcanic needles flanking a radiant lava gorge)
        const w1 = 3.8, h1 = 2.8, d1 = 2.4;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#1a1312', '#ff5500', '#0a0504', '#261b18', '#1a1312', '#2f201c', false, 'volcanicBasalt'));
        // Dominant Left Basalt Horn
        b.push(_b3dBox(-3.5, h1, -1.8, -1.1, 14.0, 1.8, '#241a18', '#fef08a', '#100a09', '#f97316', '#241a18', '#382622', false, 'volcanicBasalt'));
        // Secondary Right Horn
        b.push(_b3dBox(1.0, h1, -1.6, 2.9, 10.4, 1.6, '#291d1a', '#fbbf24', '#100a09', '#ea580c', '#291d1a', '#ff4500', false, 'volcanicBasalt'));
        // Radiant Molten Chasm
        b.push(_b3dBox(-1.0, h1 + 0.4, -1.7, 0.9, h1 + 6.2, -1.5, mCol, '#ffffff', mCol, '#fef08a', mCol, mCol, true, 'moltenMagma'));
        if (!lodLow) {
          const shard = meshOfOcta(1.0, 1.6, '#f97316', 'moltenMagma');
          for (const pt of shard.v) { pt[0] -= 0.1; pt[1] += 11.6; }
          return mergeMesh(meshOfCityBoxes(b), shard);
        }
        return meshOfCityBoxes(b);
      } else if (variant === 2) {
        // Archetype 2: Stepped Obsidian Citadel & Geothermal Conduit (Terraced volcanic ziggurat with glowing conduit band)
        const w1 = 4.0, h1 = 3.2, d1 = 2.8;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#181312', '#f97316', '#0a0504', '#241a18', '#181312', '#2c1e1a', false, 'volcanicBasalt'));
        const w2 = 2.8, h2 = 7.6, d2 = 2.0;
        b.push(_b3dBox(-w2, h1, -d2, w2, h2, d2, '#211816', '#fbbf24', '#0a0504', '#2e201c', '#211816', '#3b2824', false, 'volcanicBasalt'));
        const w3 = 1.6, h3 = 13.4, d3 = 1.4;
        b.push(_b3dBox(-w3, h2, -d3, w3, h3, d3, '#2a1d1a', '#fef08a', '#0a0504', '#ff4500', '#2a1d1a', '#f97316', false, 'volcanicBasalt'));
        // Horizontal Magma Conduit Belt
        b.push(_b3dBox(-w2 - 0.15, h1 + 1.8, -d2 - 0.15, w2 + 0.15, h1 + 2.4, d2 + 0.15, mCol, '#ffffff', mCol, '#fef08a', mCol, mCol, true, 'moltenMagma'));
        if (!lodLow) {
          const crown = meshOfOcta(1.3, 2.0, '#ff5500', 'moltenMagma');
          for (const pt of crown.v) pt[1] += h3 + 1.0;
          return mergeMesh(meshOfCityBoxes(b), crown);
        }
        return meshOfCityBoxes(b);
      } else {
        // Archetype 3: Slanted Basalt Dike with Undercut Magma Chamber (Forward thrusting volcanic fang over molten chamber)
        const w1 = 3.8, h1 = 3.4, d1 = 2.6;
        b.push(_b3dBox(-w1, 0, -d1, w1, h1, d1, '#1a1312', '#ea580c', '#0a0504', '#261b18', '#1a1312', '#2f201c', false, 'volcanicBasalt'));
        // Projecting Basalt Shelf
        b.push(_b3dBox(-2.7, h1, -3.2, 2.5, 8.0, 1.8, '#241a18', '#f97316', '#0a0504', '#2e201c', '#241a18', '#382622', false, 'volcanicBasalt'));
        // Rising Basalt Fang
        b.push(_b3dBox(-1.3, 8.0, -2.8, 1.1, 13.8, 0.8, '#2a1d1a', '#fef08a', '#0a0504', '#ff4500', '#2a1d1a', '#f97316', false, 'volcanicBasalt'));
        // Radiant Molten Under-Chamber Glow
        b.push(_b3dBox(-2.3, h1 + 0.2, -3.1, 2.1, h1 + 0.8, -2.8, mCol, '#ffffff', mCol, '#fef08a', mCol, mCol, true, 'moltenMagma'));
        return meshOfCityBoxes(b);
      }
    },

    // Inner Roadside Thermal Fumaroles & Geothermal Spires
    volcanoFumarole(v, sideDir, neonCol, lodLow) {
      const mCol = neonCol || '#ff5500';
      const variant = (v || 0) & 1;
      const b = [];
      const sDir = sideDir || -1;

      if (variant === 0) {
        // Hexagonal Basalt Vent Column with Thermal Core & Warning Chevron
        b.push(_b3dBox(-0.85, 0, -0.85, 0.85, 1.2, 0.85, '#181312', '#f97316', '#0a0504', '#241a18', '#181312', '#2c1e1a', false, 'volcanicBasalt'));
        b.push(_b3dBox(-0.45, 1.2, -0.45, 0.45, 6.4, 0.45, '#211816', '#fbbf24', '#0a0504', '#2e201c', '#211816', '#ff4500', false, 'volcanicBasalt'));
        // Emissive Vertical Magma Fissure
        b.push(_b3dBox(-0.16, 1.4, -0.52, 0.16, 6.0, 0.52, mCol, '#fef08a', mCol, '#fef08a', mCol, mCol, true, 'moltenMagma'));
        // Directional Hazard Warning Chevron pointing toward track
        b.push(_b3dBox(-0.55 * sDir, 4.2, -0.55, 0.55 * sDir, 4.8, 0.55, '#fef08a', '#fef08a', '#fef08a', '#fef08a', '#fef08a', '#fef08a', true, 'moltenMagma'));
        if (!lodLow) {
          const cap = meshOfOcta(0.65, 1.2, '#fef08a', 'moltenMagma');
          for (const pt of cap.v) pt[1] += 7.0;
          return mergeMesh(meshOfCityBoxes(b), cap);
        }
        return meshOfCityBoxes(b);
      } else {
        // Clustered Magma Horns & Geothermal Vent Mound
        b.push(_b3dBox(-1.1, 0, -0.9, 1.1, 0.85, 0.9, '#1a1312', '#ea580c', '#0a0504', '#261b18', '#1a1312', '#2f201c', false, 'volcanicBasalt'));
        // Primary Center Horn
        b.push(_b3dBox(-0.35, 0.85, -0.35, 0.35, 5.6, 0.35, '#241a18', '#fef08a', '#0a0504', '#f97316', '#241a18', '#382622', false, 'volcanicBasalt'));
        // Flanking Needles
        b.push(_b3dBox(-0.95, 0.85, -0.28, -0.42, 3.6, 0.28, '#211816', '#fbbf24', '#0a0504', '#ff4500', '#211816', '#2e201c', false, 'volcanicBasalt'));
        b.push(_b3dBox(0.42, 0.85, -0.28, 0.95, 2.6, 0.28, '#181312', '#f97316', '#0a0504', '#ea580c', '#181312', '#2c1e1a', false, 'volcanicBasalt'));
        // Luminous Pulsing Magma Vent
        b.push(_b3dBox(-0.25, 3.8, -0.42, 0.25, 4.4, 0.42, mCol, '#ffffff', mCol, '#fef08a', mCol, mCol, true, 'moltenMagma'));
        if (!lodLow) {
          const topShard = meshOfOcta(0.55, 1.1, '#ff5500', 'moltenMagma');
          for (const pt of topShard.v) pt[1] += 6.2;
          return mergeMesh(meshOfCityBoxes(b), topShard);
        }
        return meshOfCityBoxes(b);
      }
    },

    // 3D Overhead Volcanic Basalt Arch (Spanning all 3 racing lanes)
    volcanoBasaltArch(v, neonCol, curbc, lodLow) {
      const mCol = neonCol || '#ff5500';
      const b = [];
      // Heavy Left Basalt Pylon (x = -12.6 to -9.2)
      b.push(_b3dBox(-12.6, 0, -2.4, -9.2, 9.2, 2.4, '#181312', '#f97316', '#0a0504', '#241a18', '#181312', '#2c1e1a', false, 'volcanicBasalt'));
      // Inward Slanted Left Corbel
      b.push(_b3dBox(-11.2, 9.2, -2.1, -7.8, 11.4, 2.1, '#211816', '#fbbf24', '#0a0504', '#2e201c', '#211816', '#ff4500', false, 'volcanicBasalt'));
      // Heavy Right Basalt Pylon (x = +9.2 to +12.6)
      b.push(_b3dBox(9.2, 0, -2.4, 12.6, 9.2, 2.4, '#181312', '#f97316', '#0a0504', '#241a18', '#181312', '#2c1e1a', false, 'volcanicBasalt'));
      // Inward Slanted Right Corbel
      b.push(_b3dBox(7.8, 9.2, -2.1, 11.2, 11.4, 2.1, '#211816', '#fbbf24', '#0a0504', '#2e201c', '#211816', '#ff4500', false, 'volcanicBasalt'));
      // High Volcanic Basalt Span Arch (x = -9.6 to +9.6, clears y = 10.8 above tallest vehicles)
      b.push(_b3dBox(-9.6, 11.0, -1.9, 9.6, 14.4, 1.9, '#241a18', '#fef08a', '#0a0504', '#f97316', '#241a18', '#382622', false, 'volcanicBasalt'));
      // Upper Jagged Lava Crest Ridge
      b.push(_b3dBox(-7.8, 14.4, -1.3, 7.8, 15.6, 1.3, '#ff4500', '#fef08a', '#241a18', '#f97316', '#ff4500', '#fbbf24', false, 'moltenMagma'));
      // Overhead Luminous Magma Navigation Seam
      b.push(_b3dBox(-8.8, 10.5, -2.05, 8.8, 11.0, -1.75, mCol, '#ffffff', mCol, '#fef08a', mCol, mCol, true, 'moltenMagma'));

      if (!lodLow) {
        // Hanging Molten Basalt Drips & Stalactites below span
        const st1 = meshOfOcta(0.65, 1.6, '#ff5500', 'moltenMagma');
        for (const pt of st1.v) { pt[0] -= 4.5; pt[1] += 9.7; }
        const st2 = meshOfOcta(0.85, 2.0, '#fef08a', 'moltenMagma');
        for (const pt of st2.v) { pt[1] += 9.5; }
        const st3 = meshOfOcta(0.65, 1.6, '#ff5500', 'moltenMagma');
        for (const pt of st3.v) { pt[0] += 4.5; pt[1] += 9.7; }
        return mergeMesh(meshOfCityBoxes(b), st1, st2, st3);
      }
      return meshOfCityBoxes(b);
    },

    // Backward-compatibility wrappers for legacy test callers:
    volcanoCrag(v, rockCol, magmaCol) {
      return this.volcanoCaldera(v, rockCol, magmaCol, false);
    },
    volcanoVent(magmaCol) {
      return this.volcanoFumarole(0, -1, magmaCol, false);
    },

    // 6. SPACE (КОСМИЧЕСКИЙ ПУТЬ / КОСМИЧЕСКАЯ АНОМАЛИЯ) — AAA UPGRADE
    spaceAnomaly(variant, neonCol, curbc, lodLow) {
      const nCol = neonCol || '#00f5ff';
      const cCol = curbc || '#ec4899';
      const b = [];
      const varMod = (variant || 0) % 4;

      if (varMod === 0) {
        // --- ARCHETYPE 0: REALITY FRACTURE MONOLITH ---
        // Massive split geometric obelisk with glowing dimensional rift running through its core
        // Base obsidian anchor
        b.push(_b3dBox(-2.4, 0, -1.8, 2.4, 3.2, 1.8, '#090318', '#0f0728', '#090318', '#1e1b4b', '#1e1b4b', '#05020c', false, 'cosmicVoid'));
        b.push(_b3dBox(-2.6, 0.4, -2.0, 2.6, 1.1, 2.0, '#1e1b4b', nCol, '#090318', nCol, nCol, '#090318', false, 'cosmicVoid'));

        // Lower fractured pillar (left side)
        b.push(_b3dBox(-2.0, 3.2, -1.5, -0.25, 12.5, 1.5, '#0f0728', '#1e1b4b', '#090318', '#312e81', '#1e1b4b', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(-1.9, 4.0, -1.55, -0.4, 11.8, -1.45, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));

        // Displaced sheared upper floating pillar (right side, shifted upward and outward by reality rift)
        b.push(_b3dBox(0.35, 4.8, -1.4, 2.1, 14.8, 1.4, '#1e1b4b', '#2e1065', '#090318', '#1e1b4b', '#4338ca', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(0.5, 5.5, 1.35, 1.95, 14.0, 1.45, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'emissiveViolet'));

        // Glowing central dimensional rift core spanning between the fractured halves
        b.push(_b3dBox(-0.35, 3.8, -0.7, 0.45, 13.5, 0.7, nCol, '#ffffff', cCol, '#ffffff', nCol, cCol, true, 'emissiveCyan'));
        b.push(_b3dBox(-0.15, 5.0, -0.4, 0.25, 12.2, 0.4, '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', true, 'emissiveCyan'));

        // Floating zero-g satellite fragments drifting alongside the rift
        if (!lodLow) {
          b.push(_b3dBox(-2.9, 7.2, -0.6, -2.3, 8.8, 0.6, '#1e1b4b', nCol, '#090318', '#312e81', '#1e1b4b', '#090318', false, 'cosmicVoid'));
          b.push(_b3dBox(2.4, 9.5, -0.5, 3.1, 11.2, 0.5, '#2e1065', cCol, '#090318', '#4338ca', '#1e1b4b', '#090318', false, 'cosmicVoid'));
        }
        return meshOfBoxes(b);

      } else if (varMod === 1) {
        // --- ARCHETYPE 1: GRAVITATIONAL SINGULARITY CORE ---
        // Dark polyhedral monolith base with elevated magnetic containment pylons and a hovering singularity core
        // Base foundation
        b.push(_b3dBox(-2.8, 0, -2.8, 2.8, 2.2, 2.8, '#090318', '#0f0728', '#090318', '#1e1b4b', '#1e1b4b', '#05020c', false, 'cosmicVoid'));
        b.push(_b3dBox(-2.2, 2.2, -2.2, 2.2, 3.4, 2.2, '#1e1b4b', '#312e81', '#090318', '#2e1065', '#2e1065', '#090318', false, 'cosmicVoid'));

        // Four angled magnetic containment pylons rising around the core
        b.push(_b3dBox(-2.4, 3.4, -2.4, -1.7, 9.8, -1.7, '#0f0728', nCol, '#090318', '#312e81', '#1e1b4b', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(1.7, 3.4, -2.4, 2.4, 9.8, -1.7, '#0f0728', nCol, '#090318', '#1e1b4b', '#312e81', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(-2.4, 3.4, 1.7, -1.7, 9.8, 2.4, '#0f0728', cCol, '#090318', '#312e81', '#1e1b4b', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(1.7, 3.4, 1.7, 2.4, 9.8, 2.4, '#0f0728', cCol, '#090318', '#1e1b4b', '#312e81', '#090318', false, 'cosmicVoid'));

        // Pylon energy emitters
        b.push(_b3dBox(-2.2, 9.8, -2.2, -1.9, 10.6, -1.9, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));
        b.push(_b3dBox(1.9, 9.8, -2.2, 2.2, 10.6, -1.9, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));
        b.push(_b3dBox(-2.2, 9.8, 1.9, -1.9, 10.6, 2.2, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'emissiveViolet'));
        b.push(_b3dBox(1.9, 9.8, 1.9, 2.2, 10.6, 2.2, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'emissiveViolet'));

        const meshBase = meshOfBoxes(b);

        // Hovering central Singularity Octahedron (pulsing micro-black-hole event horizon)
        const singCore = meshOfOcta(1.75, 2.5, '#f43f5e', 'emissiveMagenta');
        for (const pt of singCore.v) { pt[1] += 6.5; }

        // Hovering magnetic containment ring suspended around the core
        const ring = meshOfRing(2.9, 2.2, nCol, 8, 'emissiveCyan');
        for (const pt of ring.v) {
          const tmp = pt[1]; pt[1] = pt[2] + 6.5; pt[2] = tmp;
        }

        return mergeMesh(meshBase, singCore, ring);

      } else if (varMod === 2) {
        // --- ARCHETYPE 2: FLOATING COSMIC VOID CITADEL ---
        // Stepped celestial ziggurat with horizontal gravitational containment conduits and apex warp conduit
        b.push(_b3dBox(-3.2, 0, -2.2, 3.2, 2.6, 2.2, '#090318', '#0f0728', '#090318', '#1e1b4b', '#1e1b4b', '#05020c', false, 'cosmicVoid'));
        b.push(_b3dBox(-2.4, 2.6, -1.8, 2.4, 5.0, 1.8, '#1e1b4b', '#2e1065', '#090318', '#312e81', '#312e81', '#090318', false, 'cosmicVoid'));

        // Glowing horizontal energy conduits running across the facade
        b.push(_b3dBox(-3.0, 1.1, -2.28, 3.0, 1.5, 2.28, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));
        b.push(_b3dBox(-2.2, 3.6, -1.88, 2.2, 4.0, 1.88, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'emissiveViolet'));

        // Twin celestial warp towers rising from the ziggurat
        b.push(_b3dBox(-2.2, 5.0, -1.0, -1.1, 13.2, 1.0, '#0f0728', '#1e1b4b', '#090318', '#312e81', '#1e1b4b', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(1.1, 5.0, -1.0, 2.2, 13.2, 1.0, '#0f0728', '#1e1b4b', '#090318', '#1e1b4b', '#312e81', '#090318', false, 'cosmicVoid'));

        // High horizontal quantum bridge between the twin towers
        b.push(_b3dBox(-1.1, 10.2, -0.6, 1.1, 11.2, 0.6, '#1e1b4b', nCol, cCol, '#2e1065', '#2e1065', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(-0.9, 10.5, -0.65, 0.9, 10.9, 0.65, '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', true, 'emissiveCyan'));

        // Apex hovering beacon crystal suspended between the towers
        const apexMesh = meshOfOcta(1.1, 1.8, cCol, 'emissiveViolet');
        for (const pt of apexMesh.v) { pt[1] += 12.8; }

        return mergeMesh(meshOfBoxes(b), apexMesh);

      } else {
        // --- ARCHETYPE 3: FRACTURED CELESTIAL SHARD CLUSTER ---
        // Forward-thrusting warped cosmic crystal cluster breaking apart under tidal gravitational forces
        // Solid celestial bedrock
        b.push(_b3dBox(-2.5, 0, -2.0, 2.5, 2.8, 2.0, '#090318', '#0f0728', '#090318', '#1e1b4b', '#1e1b4b', '#05020c', false, 'cosmicVoid'));

        // Main towering diagonal crystal shard
        b.push(_b3dBox(-1.4, 2.8, -1.4, 0.8, 14.5, 1.2, '#1e1b4b', '#312e81', '#090318', '#2e1065', '#4338ca', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(-1.2, 3.8, -1.48, 0.6, 13.8, -1.35, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));

        // Secondary flanking angled shard
        b.push(_b3dBox(0.9, 2.8, -1.0, 2.3, 10.5, 1.0, '#0f0728', '#2e1065', '#090318', '#1e1b4b', '#312e81', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(1.1, 3.5, -1.08, 2.1, 9.8, -0.95, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'emissiveViolet'));

        // Glowing void fissure between the crystal spires
        b.push(_b3dBox(0.65, 3.0, -0.5, 1.05, 11.2, 0.5, cCol, '#ffffff', nCol, '#ffffff', cCol, nCol, true, 'emissiveViolet'));

        // Trailing zero-g debris shards
        if (!lodLow) {
          b.push(_b3dBox(-2.2, 5.5, -0.4, -1.6, 7.2, 0.4, '#1e1b4b', nCol, '#090318', '#312e81', '#1e1b4b', '#090318', false, 'cosmicVoid'));
          b.push(_b3dBox(1.6, 11.2, -0.4, 2.1, 12.6, 0.4, '#2e1065', cCol, '#090318', '#4338ca', '#1e1b4b', '#090318', false, 'cosmicVoid'));
        }
        return meshOfBoxes(b);
      }
    },

    // Backward-compatible outer scenery wrapper
    spaceAsteroid(v) {
      return this.spaceAnomaly(v, '#00f5ff', '#ec4899', false);
    },

    // Inner roadside 3D navigational props (2 archetypes)
    spaceBeacon(variant, side, neonCol, lodLow) {
      const nCol = neonCol || '#00f5ff';
      const cCol = '#ec4899';
      const b = [];
      const varMod = (variant || 0) % 2;
      const sDir = (side || -1) < 0 ? -1 : 1;

      if (varMod === 0) {
        // --- ARCHETYPE 0: GRAVITY ALIGNMENT PYLON ---
        // Sleek dark matter pillar with vertical cyan pulse strip and 3D directional chevron marker
        // Base stabilizer
        b.push(_b3dBox(-0.75, 0, -0.65, 0.75, 1.0, 0.65, '#090318', '#0f0728', '#090318', '#1e1b4b', '#1e1b4b', '#05020c', false, 'cosmicVoid'));
        b.push(_b3dBox(-0.55, 1.0, -0.5, 0.55, 5.6, 0.5, '#0f0728', '#1e1b4b', '#090318', '#312e81', '#312e81', '#090318', false, 'cosmicVoid'));

        // Vertical glowing pulse channel
        b.push(_b3dBox(-0.16, 0.4, -0.56, 0.16, 5.2, 0.56, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));

        // Directional chevron marker pointing inward toward the track
        const chevX1 = -sDir * 0.15;
        const chevX2 = -sDir * 0.65;
        b.push(_b3dBox(Math.min(chevX1, chevX2), 4.6, -0.22, Math.max(chevX1, chevX2), 5.4, 0.22, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'emissiveViolet'));

        // Crown beacon emitter
        b.push(_b3dBox(-0.25, 5.6, -0.25, 0.25, 6.2, 0.25, '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', true, 'emissiveCyan'));
        return meshOfBoxes(b);

      } else {
        // --- ARCHETYPE 1: GRAVITATIONAL RESONATOR / MICRO-SINGULARITY BEACON ---
        // Compact stepped obsidian base with floating micro-singularity node and protective containment fins
        b.push(_b3dBox(-0.85, 0, -0.85, 0.85, 1.2, 0.85, '#090318', '#0f0728', '#090318', '#1e1b4b', '#1e1b4b', '#05020c', false, 'cosmicVoid'));
        b.push(_b3dBox(-0.65, 1.2, -0.65, 0.65, 1.8, 0.65, '#1e1b4b', nCol, '#090318', '#2e1065', '#2e1065', '#090318', false, 'cosmicVoid'));

        // Three protective vertical containment fins
        b.push(_b3dBox(-0.75, 1.8, -0.25, -0.5, 4.4, 0.25, '#0f0728', cCol, '#090318', '#312e81', '#1e1b4b', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(0.5, 1.8, -0.25, 0.75, 4.4, 0.25, '#0f0728', cCol, '#090318', '#1e1b4b', '#312e81', '#090318', false, 'cosmicVoid'));
        b.push(_b3dBox(-0.25, 1.8, 0.5, 0.25, 4.4, 0.75, '#0f0728', nCol, '#090318', '#312e81', '#312e81', '#090318', false, 'cosmicVoid'));

        const baseMesh = meshOfBoxes(b);

        // Hovering central micro-singularity node
        const node = meshOfOcta(0.65, 0.95, cCol, 'emissiveViolet');
        for (const pt of node.v) { pt[1] += 3.1; }

        return mergeMesh(baseMesh, node);
      }
    },

    // Backward-compatible inner scenery wrapper
    spaceMonolith(v, neonCol) {
      return this.spaceBeacon(v, (v & 1) === 0 ? -1 : 1, neonCol, false);
    },

    // OVERHEAD 3D COSMIC ARCH (Spanning all 3 lanes, [-12.6, 12.6], clearance y = 8.8m - 10.8m)
    spaceTunnelArch(vOrNeon, neonColOrCurbc, curbc, lodLow) {
      let nCol = '#00f5ff', cCol = '#ec4899';
      if (typeof vOrNeon === 'string') {
        nCol = vOrNeon;
        if (typeof neonColOrCurbc === 'string') cCol = neonColOrCurbc;
      } else {
        if (typeof neonColOrCurbc === 'string') nCol = neonColOrCurbc;
        if (typeof curbc === 'string') cCol = curbc;
      }
      const b = [];

      // Left support tower (x = -12.8 to -10.4, height y = 0 to 9.4m)
      b.push(_b3dBox(-12.8, 0, -2.4, -10.4, 3.2, 2.4, '#090318', '#0f0728', '#090318', '#1e1b4b', '#1e1b4b', '#05020c', false, 'cosmicVoid'));
      b.push(_b3dBox(-12.4, 3.2, -1.8, -10.6, 9.4, 1.8, '#0f0728', '#1e1b4b', '#090318', '#312e81', '#1e1b4b', '#090318', false, 'cosmicVoid'));
      b.push(_b3dBox(-11.8, 1.2, -1.86, -11.2, 9.0, 1.86, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));

      // Right support tower (x = 10.4 to 12.8, height y = 0 to 9.4m)
      b.push(_b3dBox(10.4, 0, -2.4, 12.8, 3.2, 2.4, '#090318', '#0f0728', '#090318', '#1e1b4b', '#1e1b4b', '#05020c', false, 'cosmicVoid'));
      b.push(_b3dBox(10.6, 3.2, -1.8, 12.4, 9.4, 1.8, '#0f0728', '#1e1b4b', '#090318', '#1e1b4b', '#312e81', '#090318', false, 'cosmicVoid'));
      b.push(_b3dBox(11.2, 1.2, -1.86, 11.8, 9.0, 1.86, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));

      // Massive overhead cross-span beam spanning all 3 lanes (x = -12.8 to +12.8, clearance y = 8.8m to 10.6m)
      b.push(_b3dBox(-12.8, 8.8, -2.2, 12.8, 10.6, 2.2, '#0f0728', '#1e1b4b', '#090318', '#312e81', '#312e81', '#090318', false, 'cosmicVoid'));
      b.push(_b3dBox(-11.5, 9.2, -2.28, 11.5, 10.2, 2.28, '#1e1b4b', '#2e1065', '#090318', '#4338ca', '#4338ca', '#090318', false, 'cosmicVoid'));

      // Luminous under-arch dimensional navigation strip
      b.push(_b3dBox(-10.6, 8.7, -0.6, 10.6, 8.95, 0.6, nCol, '#ffffff', cCol, '#ffffff', nCol, cCol, true, 'emissiveCyan'));

      // Upper celestial crest ridge with geometric energy conduits
      b.push(_b3dBox(-7.5, 10.6, -1.4, 7.5, 12.2, 1.4, '#1e1b4b', '#312e81', '#090318', '#2e1065', '#2e1065', '#090318', false, 'cosmicVoid'));
      b.push(_b3dBox(-6.2, 11.2, -1.48, 6.2, 11.8, 1.48, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'emissiveViolet'));

      const archBase = meshOfBoxes(b);

      // Hanging zero-g crystal stalactites suspended beneath the arch clearance (at y = 8.2m)
      const cLeft = meshOfOcta(0.55, 0.9, nCol, 'emissiveCyan');
      for (const pt of cLeft.v) { pt[0] -= 5.5; pt[1] += 8.2; }

      const cMid = meshOfOcta(0.7, 1.1, cCol, 'emissiveViolet');
      for (const pt of cMid.v) { pt[1] += 8.0; }

      const cRight = meshOfOcta(0.55, 0.9, nCol, 'emissiveCyan');
      for (const pt of cRight.v) { pt[0] += 5.5; pt[1] += 8.2; }

      return mergeMesh(archBase, cLeft, cMid, cRight);
    },

    // 7. OCEAN (ГЛУБИНЫ ОКЕАНА / ПОДВОДНЫЙ ОКЕАН) — STAGE 15 AAA 3D OVERHAUL
    oceanBiomeLandmark(variant, aquaCol, neonCol, lodLow) {
      const v = (variant || 0) % 4;
      const nCol = neonCol || '#00f0ff';
      const aCol = aquaCol || '#2dd4bf';
      const b = [];

      if (v === 0) {
        // Archetype 0: Abyssal Guardian Colossus (Submerged ancient stone titan statue)
        // Tiered monumental pedestal
        b.push(_b3dBox(-3.6, 0, -3.6, 3.6, 1.4, 3.6, '#021827', '#082a44', '#010c14', '#041f33', '#041f33', '#031b2c', false, 'oceanAbyssStone'));
        b.push(_b3dBox(-2.8, 1.4, -2.8, 2.8, 2.6, 2.8, '#042238', '#0b395c', '#021827', '#062d4a', '#062d4a', '#052741', false, 'oceanAbyssStone'));
        // Glowing base runic foundation seams
        b.push(_b3dBox(-2.9, 1.25, -2.9, 2.9, 1.45, 2.9, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));
        // Guardian lower torso / column pediment
        b.push(_b3dBox(-1.9, 2.6, -1.9, 1.9, 6.2, 1.9, '#031e33', '#093352', '#021827', '#052843', '#052843', '#04233b', false, 'oceanAbyssStone'));
        // Flanking guardian shoulder buttresses
        b.push(_b3dBox(-3.2, 3.8, -1.6, -1.9, 7.8, 1.6, '#04253e', '#0b3d63', '#021827', '#073254', '#073254', '#052945', false, 'oceanAbyssStone'));
        b.push(_b3dBox(1.9, 3.8, -1.6, 3.2, 7.8, 1.6, '#04253e', '#0b3d63', '#021827', '#073254', '#073254', '#052945', false, 'oceanAbyssStone'));
        // Abyssal energy chest-core conduit
        b.push(_b3dBox(-0.6, 4.2, 1.82, 0.6, 5.8, 2.02, '#38bdf8', '#ffffff', '#0ea5e9', '#38bdf8', '#38bdf8', '#38bdf8', true, 'emissiveCyan'));
        // Guardian helm / crown spire
        b.push(_b3dBox(-1.4, 6.2, -1.4, 1.4, 9.6, 1.4, '#052c49', '#0d4875', '#031e33', '#083b62', '#083b62', '#063152', false, 'oceanAbyssStone'));
        b.push(_b3dBox(-0.5, 9.6, -0.5, 0.5, 12.2, 0.5, aCol, '#ffffff', aCol, aCol, aCol, aCol, true, 'emissiveCyan'));
        // Levitating guardian crest halo fragments
        b.push(_b3dBox(-2.2, 10.0, -0.3, -1.2, 11.2, 0.3, '#073659', aCol, '#031e33', '#0b4570', '#0b4570', '#073659', false, 'oceanCoral'));
        b.push(_b3dBox(1.2, 10.0, -0.3, 2.2, 11.2, 0.3, '#073659', aCol, '#031e33', '#0b4570', '#0b4570', '#073659', false, 'oceanCoral'));
        // Submerged sentinel arms with runic anchors
        b.push(_b3dBox(-3.6, 2.0, -1.2, -2.8, 4.4, 1.2, '#021a2b', '#07304e', '#010f1a', '#04243b', '#04243b', '#031d30', false, 'oceanAbyssStone'));
        b.push(_b3dBox(2.8, 2.0, -1.2, 3.6, 4.4, 1.2, '#021a2b', '#07304e', '#010f1a', '#04243b', '#04243b', '#031d30', false, 'oceanAbyssStone'));
      } else if (v === 1) {
        // Archetype 1: Bioluminescent Coral Cathedral (Branching alien organic reef formation)
        // Seafloor reef terrace foundation
        b.push(_b3dBox(-3.8, 0, -3.8, 3.8, 1.6, 3.8, '#012022', '#053e41', '#011314', '#032c2f', '#032c2f', '#022426', false, 'oceanCoral'));
        b.push(_b3dBox(-2.6, 1.6, -2.6, 2.6, 3.0, 2.6, '#022e31', '#085357', '#012022', '#043d41', '#043d41', '#033336', false, 'oceanCoral'));
        // Central braided coral trunk
        b.push(_b3dBox(-1.4, 3.0, -1.4, 1.4, 8.4, 1.4, '#043d41', '#0c686d', '#022e31', '#064f54', '#064f54', '#054448', false, 'oceanCoral'));
        // Radiating coral branch fans (stepped outriggers)
        b.push(_b3dBox(-3.4, 4.2, -1.1, -1.4, 5.6, 1.1, '#05474b', '#0d767c', '#033235', '#085c62', '#085c62', '#065055', false, 'oceanCoral'));
        b.push(_b3dBox(1.4, 4.8, -1.1, 3.4, 6.2, 1.1, '#05474b', '#0d767c', '#033235', '#085c62', '#085c62', '#065055', false, 'oceanCoral'));
        // Branch vertical spires reaching toward surface
        b.push(_b3dBox(-3.4, 5.6, -0.8, -2.2, 9.8, 0.8, '#065358', '#108990', '#043d41', '#0a6c72', '#0a6c72', '#085d63', false, 'oceanCoral'));
        b.push(_b3dBox(2.2, 6.2, -0.8, 3.4, 10.4, 0.8, '#065358', '#108990', '#043d41', '#0a6c72', '#0a6c72', '#085d63', false, 'oceanCoral'));
        // Bioluminescent luminous polyp tips (cyan, turquoise, violet)
        b.push(_b3dBox(-3.2, 9.8, -0.6, -2.4, 11.4, 0.6, '#2dd4bf', '#ffffff', '#14b8a6', '#2dd4bf', '#2dd4bf', '#2dd4bf', true, 'emissiveCyan'));
        b.push(_b3dBox(2.4, 10.4, -0.6, 3.2, 12.0, 0.6, '#38bdf8', '#ffffff', '#0284c7', '#38bdf8', '#38bdf8', '#38bdf8', true, 'emissiveCyan'));
        b.push(_b3dBox(-0.6, 8.4, -0.6, 0.6, 12.8, 0.6, '#c084fc', '#ffffff', '#9333ea', '#c084fc', '#c084fc', '#c084fc', true, 'emissiveCyan'));
        // Secondary bio-polyps clusters
        b.push(_b3dBox(-1.8, 5.6, -2.4, -0.8, 7.8, -1.4, '#0f766e', aCol, '#042f2e', '#115e59', '#115e59', '#0f766e', false, 'oceanCoral'));
        b.push(_b3dBox(0.8, 6.0, 1.4, 1.8, 8.2, 2.4, '#0f766e', aCol, '#042f2e', '#115e59', '#115e59', '#0f766e', false, 'oceanCoral'));
      } else if (v === 2) {
        // Archetype 2: Sunken Ocean Citadel (Submerged monumental stepped architecture with arches)
        // Foundation bastions
        b.push(_b3dBox(-4.2, 0, -3.2, 4.2, 2.2, 3.2, '#031a29', '#08324e', '#01101a', '#05253b', '#05253b', '#042033', false, 'oceanAbyssStone'));
        b.push(_b3dBox(-3.4, 2.2, -2.6, 3.4, 4.2, 2.6, '#042439', '#0a4267', '#021a29', '#073350', '#073350', '#052b44', false, 'oceanAbyssStone'));
        // Ancient sunken archway opening (submerged portal chamber)
        b.push(_b3dBox(-3.0, 4.2, -2.2, -1.2, 8.6, 2.2, '#062d47', '#0d4f7a', '#031f32', '#083c5e', '#083c5e', '#063452', false, 'oceanAbyssStone'));
        b.push(_b3dBox(1.2, 4.2, -2.2, 3.0, 8.6, 2.2, '#062d47', '#0d4f7a', '#031f32', '#083c5e', '#083c5e', '#063452', false, 'oceanAbyssStone'));
        // Citadel spanning arch lintel
        b.push(_b3dBox(-3.0, 8.6, -2.2, 3.0, 10.2, 2.2, '#083655', '#105d90', '#042539', '#0b476e', '#0b476e', '#093e61', false, 'oceanAbyssStone'));
        // Illuminated interior abyss vault chamber
        b.push(_b3dBox(-1.1, 4.2, -0.2, 1.1, 8.4, 0.2, nCol, '#ffffff', '#0284c7', nCol, nCol, nCol, true, 'emissiveCyan'));
        // Crown spires / broken parapets
        b.push(_b3dBox(-2.8, 10.2, -1.8, -1.6, 12.4, 1.8, '#0b4065', '#146ca7', '#062d47', '#0e5281', '#0e5281', '#0c4771', false, 'oceanAbyssStone'));
        b.push(_b3dBox(1.6, 10.2, -1.8, 2.8, 11.6, 1.8, '#0b4065', '#146ca7', '#062d47', '#0e5281', '#0e5281', '#0c4771', false, 'oceanAbyssStone'));
        // Suspended energy focus crystal
        b.push(_b3dBox(-0.5, 10.4, -0.5, 0.5, 11.8, 0.5, aCol, '#ffffff', '#0d9488', aCol, aCol, aCol, true, 'emissiveCyan'));
        // Coral growth encroaching on stone
        b.push(_b3dBox(-3.8, 1.0, 1.8, -2.2, 3.2, 3.4, '#0d9488', '#2dd4bf', '#042f2e', '#0f766e', '#0f766e', '#0d9488', false, 'oceanCoral'));
        b.push(_b3dBox(2.2, 1.0, -3.4, 3.8, 3.2, -1.8, '#0d9488', '#2dd4bf', '#042f2e', '#0f766e', '#0f766e', '#0d9488', false, 'oceanCoral'));
      } else {
        // Archetype 3: Abyssal Hydrothermal Chimney (Volcanic seafloor black smoker)
        // Tiered basalt mound
        b.push(_b3dBox(-3.2, 0, -3.2, 3.2, 1.8, 3.2, '#020f18', '#072439', '#010a10', '#041b2b', '#041b2b', '#031522', false, 'volcanicBasalt'));
        b.push(_b3dBox(-2.4, 1.8, -2.4, 2.4, 3.4, 2.4, '#031726', '#092d47', '#020f18', '#052238', '#052238', '#041c2e', false, 'volcanicBasalt'));
        // Main hydrothermal chimney shaft
        b.push(_b3dBox(-1.5, 3.4, -1.5, 1.5, 8.8, 1.5, '#041e30', '#0a3655', '#021522', '#062942', '#062942', '#052338', false, 'volcanicBasalt'));
        // Glowing thermal fissure seams in the mineral spire
        b.push(_b3dBox(-1.58, 4.4, -0.4, 1.58, 4.75, 0.4, '#00f0ff', '#ffffff', '#0284c7', '#00f0ff', '#00f0ff', '#00f0ff', true, 'emissiveCyan'));
        b.push(_b3dBox(-0.4, 6.2, -1.58, 0.4, 6.55, 1.58, aCol, '#ffffff', '#0d9488', aCol, aCol, aCol, true, 'emissiveCyan'));
        // Secondary side vent chimney
        b.push(_b3dBox(1.2, 3.2, -0.9, 2.6, 7.2, 0.9, '#05243b', '#0c3e62', '#031726', '#082f4c', '#082f4c', '#062740', false, 'volcanicBasalt'));
        b.push(_b3dBox(1.5, 7.2, -0.6, 2.3, 7.7, 0.6, '#38bdf8', '#ffffff', '#0284c7', '#38bdf8', '#38bdf8', '#38bdf8', true, 'emissiveCyan'));
        // Main summit vent crater nozzle
        b.push(_b3dBox(-1.2, 8.8, -1.2, 1.2, 11.2, 1.2, '#062b45', '#0e466e', '#031c2e', '#093656', '#093656', '#072e4a', false, 'volcanicBasalt'));
        // Glowing hydrothermal super-heated plume vent core
        b.push(_b3dBox(-0.7, 11.2, -0.7, 0.7, 12.6, 0.7, '#22d3ee', '#ffffff', '#06b6d4', '#22d3ee', '#22d3ee', '#22d3ee', true, 'emissiveCyan'));
        // Basal mineral crust shelves
        b.push(_b3dBox(-2.8, 1.0, 1.6, -1.4, 2.6, 2.8, '#0d9488', '#2dd4bf', '#042f2e', '#0f766e', '#0f766e', '#0d9488', false, 'oceanCoral'));
        b.push(_b3dBox(-2.6, 2.8, -1.8, -1.2, 4.6, -0.8, '#042238', '#0b395c', '#021827', '#062d4a', '#062d4a', '#052741', false, 'volcanicBasalt'));
      }

      return meshOfBoxes(b);
    },

    oceanRoadsideProp(variant, side, neonCol, lodLow) {
      const v = (variant || 0) % 2;
      const nCol = neonCol || '#00f0ff';
      const aCol = '#2dd4bf';
      const b = [];
      const s = side < 0 ? -1 : 1;

      if (v === 0) {
        // Archetype 0: Bioluminescent Depth Beacon (Undersea navigation pylon with directional chevron)
        // Anchor pedestal
        b.push(_b3dBox(-1.2, 0, -1.2, 1.2, 1.2, 1.2, '#021624', '#062c47', '#010e17', '#042136', '#042136', '#031a2b', false, 'oceanAbyssStone'));
        b.push(_b3dBox(-0.8, 1.2, -0.8, 0.8, 4.6, 0.8, '#042338', '#0a3d61', '#021624', '#062e49', '#062e49', '#05273f', false, 'oceanAbyssStone'));
        // Runic energy bands
        b.push(_b3dBox(-0.86, 2.2, -0.86, 0.86, 2.5, 0.86, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));
        b.push(_b3dBox(-0.86, 3.6, -0.86, 0.86, 3.9, 0.86, aCol, '#ffffff', aCol, aCol, aCol, aCol, true, 'emissiveCyan'));
        // Directional chevron marker pointing inward toward the road
        b.push(_b3dBox(-s * 0.2, 4.6, -0.6, -s * 1.3, 5.8, 0.6, aCol, '#ffffff', '#0d9488', aCol, aCol, aCol, true, 'emissiveCyan'));
        // Summit beacon sensor bulb
        b.push(_b3dBox(-0.45, 5.8, -0.45, 0.45, 7.2, 0.45, '#38bdf8', '#ffffff', '#0284c7', '#38bdf8', '#38bdf8', '#38bdf8', true, 'emissiveCyan'));
      } else {
        // Archetype 1: Ancient Pressure Resonator (Stone-and-metal pedestal with levitating orb)
        // Stepped stone base
        b.push(_b3dBox(-1.3, 0, -1.3, 1.3, 1.4, 1.3, '#021827', '#07304e', '#010f1a', '#04243b', '#04243b', '#031d30', false, 'oceanAbyssStone'));
        // Four outer resonator containment prongs
        b.push(_b3dBox(-1.1, 1.4, -1.1, -0.6, 5.2, -0.6, '#052945', '#0c436d', '#021827', '#073659', '#073659', '#062e4d', false, 'oceanAbyssStone'));
        b.push(_b3dBox(0.6, 1.4, -1.1, 1.1, 5.2, -0.6, '#052945', '#0c436d', '#021827', '#073659', '#073659', '#062e4d', false, 'oceanAbyssStone'));
        b.push(_b3dBox(-1.1, 1.4, 0.6, -0.6, 5.2, 1.1, '#052945', '#0c436d', '#021827', '#073659', '#073659', '#062e4d', false, 'oceanAbyssStone'));
        b.push(_b3dBox(0.6, 1.4, 0.6, 1.1, 5.2, 1.1, '#052945', '#0c436d', '#021827', '#073659', '#073659', '#062e4d', false, 'oceanAbyssStone'));
        // Inward prong tips
        b.push(_b3dBox(-0.9, 4.8, -0.9, 0.9, 5.4, -0.4, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));
        b.push(_b3dBox(-0.9, 4.8, 0.4, 0.9, 5.4, 0.9, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));
        // Levitating pressure resonance orb
        b.push(_b3dBox(-0.55, 2.6, -0.55, 0.55, 3.8, 0.55, '#22d3ee', '#ffffff', '#0891b2', '#22d3ee', '#22d3ee', '#22d3ee', true, 'emissiveCyan'));
      }

      return meshOfBoxes(b);
    },

    oceanTrenchArch(vOrNeon, neonColOrCurbc, curbc, lodLow) {
      let nCol = '#00f0ff', cCol = '#2dd4bf';
      if (typeof vOrNeon === 'string') {
        nCol = vOrNeon;
        if (typeof neonColOrCurbc === 'string') cCol = neonColOrCurbc;
      } else {
        if (typeof neonColOrCurbc === 'string') nCol = neonColOrCurbc;
        if (typeof curbc === 'string') cCol = curbc;
      }
      const b = [];

      // Left support bastion tower (x = -12.8 to -10.4, height y = 0 to 9.6m)
      b.push(_b3dBox(-12.8, 0, -2.4, -10.4, 3.4, 2.4, '#021a2c', '#062f4e', '#01101b', '#04243c', '#04243c', '#031c2f', false, 'oceanAbyssStone'));
      b.push(_b3dBox(-12.4, 3.4, -1.8, -10.6, 9.6, 1.8, '#042742', '#0a426e', '#021a2c', '#063456', '#063456', '#052c4a', false, 'oceanAbyssStone'));
      // Left illuminated vertical conduit
      b.push(_b3dBox(-11.8, 1.2, -1.86, -11.2, 9.2, 1.86, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));

      // Right support bastion tower (x = 10.4 to 12.8, height y = 0 to 9.6m)
      b.push(_b3dBox(10.4, 0, -2.4, 12.8, 3.4, 2.4, '#021a2c', '#062f4e', '#01101b', '#04243c', '#04243c', '#031c2f', false, 'oceanAbyssStone'));
      b.push(_b3dBox(10.6, 3.4, -1.8, 12.4, 9.6, 1.8, '#042742', '#0a426e', '#021a2c', '#063456', '#063456', '#052c4a', false, 'oceanAbyssStone'));
      // Right illuminated vertical conduit
      b.push(_b3dBox(11.2, 1.2, -1.86, 11.8, 9.2, 1.86, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));

      // Inward angled support haunches / corbels (x = -10.6 to -8.2 and 8.2 to 10.6, y = 7.4 to 9.2m)
      b.push(_b3dBox(-10.6, 7.4, -1.6, -8.2, 9.2, 1.6, '#063354', '#0d5386', '#031f34', '#084069', '#084069', '#06375b', false, 'oceanAbyssStone'));
      b.push(_b3dBox(8.2, 7.4, -1.6, 10.6, 9.2, 1.6, '#063354', '#0d5386', '#031f34', '#084069', '#084069', '#06375b', false, 'oceanAbyssStone'));

      // Massive overhead cross-span bridge spanning all 3 lanes (x = -12.8 to +12.8, clearance y = 8.8m to 10.8m)
      b.push(_b3dBox(-12.8, 8.8, -1.8, 12.8, 10.8, 1.8, '#052c4a', '#0b4b7a', '#031d31', '#073a61', '#073a61', '#063254', false, 'oceanAbyssStone'));

      // Under-arch glowing cyan navigation strip (clearance y = 8.82m)
      b.push(_b3dBox(-12.6, 8.82, -0.4, 12.6, 9.02, 0.4, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'emissiveCyan'));

      // Upper coral / stone crest parapet (y = 10.8 to 12.0m)
      b.push(_b3dBox(-11.2, 10.8, -1.2, 11.2, 12.0, 1.2, '#083c65', '#10619e', '#042640', '#0b4d7f', '#0b4d7f', '#094370', false, 'oceanAbyssStone'));
      // Central luminous ocean crest gem
      b.push(_b3dBox(-1.4, 11.2, -1.3, 1.4, 13.2, 1.3, cCol, '#ffffff', '#0d9488', cCol, cCol, cCol, true, 'emissiveCyan'));

      // Flanking ancient coral colonies along the top ridge
      b.push(_b3dBox(-9.2, 12.0, -0.9, -6.8, 13.4, 0.9, '#0d9488', '#2dd4bf', '#042f2e', '#0f766e', '#0f766e', '#0d9488', false, 'oceanCoral'));
      b.push(_b3dBox(6.8, 12.0, -0.9, 9.2, 13.4, 0.9, '#0d9488', '#2dd4bf', '#042f2e', '#0f766e', '#0f766e', '#0d9488', false, 'oceanCoral'));

      // Safe hanging stalactites above car clearance line (y = 9.2m to 9.9m)
      b.push(_b3dBox(-4.8, 9.2, -0.6, -3.8, 9.9, 0.6, '#0f766e', cCol, '#042f2e', '#115e59', '#115e59', '#0f766e', false, 'oceanCoral'));
      b.push(_b3dBox(3.8, 9.2, -0.6, 4.8, 9.9, 0.6, '#0f766e', cCol, '#042f2e', '#115e59', '#115e59', '#0f766e', false, 'oceanCoral'));

      return meshOfBoxes(b);
    },

    // Backward-compatibility wrappers
    oceanBiodome(v, aquaCol, neonCol) {
      return this.oceanBiomeLandmark(v, aquaCol, neonCol, false);
    },
    oceanCoral(v, aquaCol, neonCol) {
      return this.oceanRoadsideProp(v, 1, neonCol, false);
    },
    oceanHydroVent(aquaCol) {
      return this.oceanBiomeLandmark(3, aquaCol, '#00f0ff', false);
    },

    // 8. FANTASY / MAGIC RIFT (ВОЛШЕБНЫЙ МИР / МАГИЧЕСКИЙ МИР) — STAGE 17 AAA 3D OVERHAUL
    riftBiomeLandmark(variant, arcaneCol, neonCol, lodLow) {
      const v = (variant || 0) % 4;
      const nCol = neonCol || '#c084fc';
      const aCol = arcaneCol || '#f472b6';
      const b = [];

      if (v === 0) {
        // Archetype 0: Rift Aether Spire (Tall asymmetrical floating magical citadel)
        // Tiered monumental stepped astral base
        b.push(_b3dBox(-3.4, 0, -3.4, 3.4, 1.4, 3.4, '#24063d', '#3f1163', '#160228', '#2d0a4c', '#2d0a4c', '#200537', false, 'astralFloatingStone'));
        b.push(_b3dBox(-2.6, 1.4, -2.6, 2.6, 2.6, 2.6, '#2e0a4e', '#4c1775', '#1a042e', '#390e5e', '#390e5e', '#290845', false, 'astralFloatingStone'));
        // Inset glowing amethyst runic channels on base
        b.push(_b3dBox(-2.7, 1.25, -2.7, 2.7, 1.45, 2.7, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));

        // Soaring central spire shaft
        b.push(_b3dBox(-1.7, 2.6, -1.7, 1.7, 8.4, 1.7, '#260842', '#431368', '#18032c', '#330c54', '#330c54', '#24073d', false, 'astralFloatingStone'));
        // Vertical illuminated mana conduits
        b.push(_b3dBox(-0.35, 2.8, -1.78, 0.35, 8.2, 1.78, aCol, '#ffffff', aCol, aCol, aCol, aCol, true, 'arcaneMythic'));
        b.push(_b3dBox(-1.78, 2.8, -0.35, 1.78, 8.2, 0.35, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));

        // Cantilevered astral platforms
        b.push(_b3dBox(-3.4, 4.8, -1.4, -1.7, 5.5, 1.4, '#300b52', '#50197d', '#1c0432', '#3c1064', '#3c1064', '#2a0847', false, 'astralFloatingStone'));
        b.push(_b3dBox(1.7, 5.6, -1.4, 3.4, 6.3, 1.4, '#300b52', '#50197d', '#1c0432', '#3c1064', '#3c1064', '#2a0847', false, 'astralFloatingStone'));
        // Platform illuminated edge trim
        b.push(_b3dBox(-3.45, 5.35, -1.45, -1.65, 5.55, 1.45, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));
        b.push(_b3dBox(1.65, 6.15, -1.45, 3.45, 6.35, 1.45, aCol, '#ffffff', aCol, aCol, aCol, aCol, true, 'arcaneMythic'));

        // Upper crowned tower
        b.push(_b3dBox(-1.1, 8.4, -1.1, 1.1, 11.2, 1.1, '#3b1062', '#5f2094', '#200539', '#491678', '#491678', '#340e56', false, 'astralFloatingStone'));

        // Flanking suspended floating rune stones
        if (!lodLow) {
          b.push(_b3dBox(-2.5, 7.8, -0.6, -1.9, 8.8, 0.6, '#4c1775', '#7326b0', '#290845', '#5b1d8c', '#5b1d8c', '#401264', true, 'arcaneMythic'));
          b.push(_b3dBox(1.9, 8.6, -0.6, 2.5, 9.6, 0.6, '#4c1775', '#7326b0', '#290845', '#5b1d8c', '#5b1d8c', '#401264', true, 'arcaneMythic'));
        }

        const baseMesh = meshOfBoxes(b);
        // Floating levitating crown octahedron crystal hovering freely above the spire top
        const crownCrystal = meshOfOcta(1.35, 2.8, aCol, 'arcaneMythic');
        for (const pt of crownCrystal.v) pt[1] += 12.8;

        return mergeMesh(baseMesh, crownCrystal);

      } else if (v === 1) {
        // Archetype 1: Rift Floating Sanctuary (Large floating island carrying an ancient sanctuary)
        // Multi-tiered inverted rock shelf beneath the island
        b.push(_b3dBox(-1.4, 0.4, -1.4, 1.4, 1.6, 1.4, '#150226', '#25063f', '#0c0116', '#1c0331', '#1c0331', '#130222', false, 'astralFloatingStone'));
        b.push(_b3dBox(-2.6, 1.6, -2.6, 2.6, 2.6, 2.6, '#1f0436', '#350a58', '#11021e', '#290746', '#290746', '#1b0330', false, 'astralFloatingStone'));
        b.push(_b3dBox(-3.8, 2.6, -3.8, 3.8, 3.6, 3.8, '#2a0749', '#461073', '#18032c', '#360c5c', '#360c5c', '#24063f', false, 'astralFloatingStone'));

        // Sacred temple terrace slab
        b.push(_b3dBox(-3.6, 3.6, -3.6, 3.6, 4.3, 3.6, '#360d5b', '#57188f', '#200539', '#441272', '#441272', '#2f0a50', false, 'astralFloatingStone'));
        // Luminous terrace edge border
        b.push(_b3dBox(-3.65, 4.15, -3.65, 3.65, 4.35, 3.65, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));

        // 4 Corner temple pillars
        b.push(_b3dBox(-2.5, 4.3, -2.5, -1.9, 7.8, -1.9, '#300b52', '#521980', '#1c0432', '#3e1167', '#3e1167', '#2a0847', false, 'astralFloatingStone'));
        b.push(_b3dBox(1.9, 4.3, -2.5, 2.5, 7.8, -1.9, '#300b52', '#521980', '#1c0432', '#3e1167', '#3e1167', '#2a0847', false, 'astralFloatingStone'));
        b.push(_b3dBox(-2.5, 4.3, 1.9, -1.9, 7.8, 2.5, '#300b52', '#521980', '#1c0432', '#3e1167', '#3e1167', '#2a0847', false, 'astralFloatingStone'));
        b.push(_b3dBox(1.9, 4.3, 1.9, 2.5, 7.8, 2.5, '#300b52', '#521980', '#1c0432', '#3e1167', '#3e1167', '#2a0847', false, 'astralFloatingStone'));

        // Temple roof entablature
        b.push(_b3dBox(-2.8, 7.8, -2.8, 2.8, 8.6, 2.8, '#3d1166', '#602196', '#22063b', '#4b177b', '#4b177b', '#350e58', false, 'astralFloatingStone'));
        b.push(_b3dBox(-2.0, 8.6, -2.0, 2.0, 9.8, 2.0, '#4a157a', '#7127b0', '#2a0847', '#5a1d90', '#5a1d90', '#3f1267', false, 'astralFloatingStone'));

        // Detached satellite floating stones
        if (!lodLow) {
          b.push(_b3dBox(-4.8, 4.2, -1.2, -4.1, 5.1, -0.3, '#2a0749', '#461073', '#18032c', '#360c5c', '#360c5c', '#24063f', true, 'arcaneMythic'));
          b.push(_b3dBox(4.1, 5.2, 0.4, 4.8, 6.2, 1.3, '#2a0749', '#461073', '#18032c', '#360c5c', '#360c5c', '#24063f', true, 'arcaneMythic'));
        }

        const baseMesh = meshOfBoxes(b);
        // Suspended sacred mana crystal hovering inside the open shrine
        const shrineCrystal = meshOfOcta(1.15, 2.4, aCol, 'arcaneMythic');
        for (const pt of shrineCrystal.v) pt[1] += 5.8;

        return mergeMesh(baseMesh, shrineCrystal);

      } else if (v === 2) {
        // Archetype 2: Rift Arcane Rune Pillar (Monumental carved stone pillar with geometric tiers)
        // Octagonal tiered base
        b.push(_b3dBox(-2.8, 0, -2.8, 2.8, 1.3, 2.8, '#24063d', '#3f1163', '#160228', '#2d0a4c', '#2d0a4c', '#200537', false, 'astralFloatingStone'));
        b.push(_b3dBox(-2.1, 1.3, -2.1, 2.1, 2.4, 2.1, '#2e0a4e', '#4c1775', '#1a042e', '#390e5e', '#390e5e', '#290845', false, 'astralFloatingStone'));
        // Luminous rune base collar
        b.push(_b3dBox(-2.15, 2.2, -2.15, 2.15, 2.45, 2.15, aCol, '#ffffff', aCol, aCol, aCol, aCol, true, 'arcaneMythic'));

        // Main carved pillar shaft
        b.push(_b3dBox(-1.5, 2.4, -1.5, 1.5, 8.8, 1.5, '#280945', '#45146c', '#19032d', '#340d57', '#340d57', '#24073e', false, 'astralFloatingStone'));
        // Embedded glowing rune channels
        b.push(_b3dBox(-0.35, 2.6, -1.56, 0.35, 8.6, 1.56, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));
        b.push(_b3dBox(-1.56, 2.6, -0.35, 1.56, 8.6, 0.35, aCol, '#ffffff', aCol, aCol, aCol, aCol, true, 'arcaneMythic'));

        // Floating horizontal inductor rings
        b.push(_b3dBox(-2.2, 4.4, -2.2, 2.2, 4.9, 2.2, '#380e5c', '#5b1a92', '#200538', '#461372', '#461372', '#310b50', true, 'arcaneMythic'));
        b.push(_b3dBox(-2.0, 6.8, -2.0, 2.0, 7.3, 2.0, '#380e5c', '#5b1a92', '#200538', '#461372', '#461372', '#310b50', true, 'arcaneMythic'));

        // Flared pillar capital
        b.push(_b3dBox(-2.3, 8.8, -2.3, 2.3, 9.8, 2.3, '#3c1064', '#602097', '#22063b', '#4a167a', '#4a167a', '#340e57', false, 'astralFloatingStone'));
        b.push(_b3dBox(-1.6, 9.8, -1.6, 1.6, 10.8, 1.6, '#491578', '#6e27ab', '#290845', '#571c8b', '#571c8b', '#3d1163', false, 'astralFloatingStone'));

        // Levitating crown ring
        if (!lodLow) {
          b.push(_b3dBox(-2.6, 11.2, -2.6, 2.6, 11.8, 2.6, aCol, '#ffffff', aCol, aCol, aCol, aCol, true, 'arcaneMythic'));
        }

        const baseMesh = meshOfBoxes(b);
        const topCrystal = meshOfOcta(1.2, 2.4, nCol, 'arcaneMythic');
        for (const pt of topCrystal.v) pt[1] += 12.2;

        return mergeMesh(baseMesh, topCrystal);

      } else {
        // Archetype 3: Rift Astral Obelisk (Angular celestial obelisk with levitating fragments)
        // Asymmetrical faceted plinth
        b.push(_b3dBox(-3.0, 0, -2.4, 2.4, 1.4, 2.4, '#24063d', '#3f1163', '#160228', '#2d0a4c', '#2d0a4c', '#200537', false, 'astralFloatingStone'));
        b.push(_b3dBox(-2.2, 1.4, -1.8, 1.8, 2.6, 1.8, '#2e0a4e', '#4c1775', '#1a042e', '#390e5e', '#390e5e', '#290845', false, 'astralFloatingStone'));
        b.push(_b3dBox(-2.3, 2.3, -1.9, 1.9, 2.5, 1.9, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));

        // Slanted obelisk lower body
        b.push(_b3dBox(-1.5, 2.6, -1.5, 1.5, 6.2, 1.5, '#290947', '#46146e', '#19032e', '#340e57', '#340e57', '#24083f', false, 'astralFloatingStone'));
        // Diagonal energy fracture fissure
        b.push(_b3dBox(-0.35, 2.8, -1.56, 0.55, 6.4, 1.56, aCol, '#ffffff', aCol, aCol, aCol, aCol, true, 'arcaneMythic'));

        // Slanted obelisk upper tapering body (offset center)
        b.push(_b3dBox(-1.1, 6.2, -1.1, 1.1, 9.8, 1.1, '#380f5d', '#5b1b93', '#200538', '#461473', '#461473', '#310c51', false, 'astralFloatingStone'));
        b.push(_b3dBox(-0.6, 9.8, -0.6, 0.6, 12.2, 0.6, '#481477', '#6d26aa', '#280743', '#561c8a', '#561c8a', '#3c1162', false, 'astralFloatingStone'));

        // Levitating stone fragments floating beside the obelisk
        b.push(_b3dBox(-2.6, 4.4, 1.2, -1.8, 5.4, 2.0, '#300b52', '#521980', '#1c0432', '#3e1167', '#3e1167', '#2a0847', true, 'arcaneMythic'));
        b.push(_b3dBox(1.7, 7.2, -1.8, 2.5, 8.2, -1.0, '#300b52', '#521980', '#1c0432', '#3e1167', '#3e1167', '#2a0847', true, 'arcaneMythic'));
        if (!lodLow) {
          b.push(_b3dBox(-2.2, 8.8, -1.6, -1.5, 9.7, -0.9, '#4c1775', '#7326b0', '#290845', '#5b1d8c', '#5b1d8c', '#401264', true, 'arcaneMythic'));
        }

        const baseMesh = meshOfBoxes(b);
        const obeliskSpire = meshOfOcta(0.9, 2.2, aCol, 'arcaneMythic');
        for (const pt of obeliskSpire.v) pt[1] += 13.2;

        return mergeMesh(baseMesh, obeliskSpire);
      }
    },

    riftRoadsideProp(variant, side, neonCol, lodLow) {
      const v = (variant || 0) % 2;
      const nCol = neonCol || '#c084fc';
      const aCol = '#f472b6';
      const b = [];

      if (v === 0) {
        // Archetype 0: Rift Mana Beacon (Compact layered arcane wayfinder)
        b.push(_b3dBox(-0.9, 0, -0.9, 0.9, 0.6, 0.9, '#24063d', '#3f1163', '#160228', '#2d0a4c', '#2d0a4c', '#200537', false, 'astralFloatingStone'));
        b.push(_b3dBox(-0.65, 0.6, -0.65, 0.65, 1.2, 0.65, '#2e0a4e', '#4c1775', '#1a042e', '#390e5e', '#390e5e', '#290845', false, 'astralFloatingStone'));
        b.push(_b3dBox(-0.7, 1.1, -0.7, 0.7, 1.25, 0.7, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));

        // Pillar shaft
        b.push(_b3dBox(-0.45, 1.2, -0.45, 0.45, 3.8, 0.45, '#280945', '#45146c', '#19032d', '#340d57', '#340d57', '#24073e', false, 'astralFloatingStone'));
        // Inlaid vertical runic channel
        b.push(_b3dBox(-0.16, 1.3, -0.48, 0.16, 3.7, 0.48, aCol, '#ffffff', aCol, aCol, aCol, aCol, true, 'arcaneMythic'));

        // Flared brazier head
        b.push(_b3dBox(-0.8, 3.8, -0.8, 0.8, 4.4, 0.8, '#3d1166', '#602196', '#22063b', '#4b177b', '#4b177b', '#350e58', false, 'astralFloatingStone'));

        const baseMesh = meshOfBoxes(b);
        // Levitating mana crystal floating above the brazier
        const crystal = meshOfOcta(0.65, 1.5, nCol, 'arcaneMythic');
        for (const pt of crystal.v) pt[1] += 5.2;

        return mergeMesh(baseMesh, crystal);

      } else {
        // Archetype 1: Rift Celestial Pylon (Arcane navigation structure with suspended collar & energy orb)
        b.push(_b3dBox(-1.1, 0, -1.1, 1.1, 0.7, 1.1, '#24063d', '#3f1163', '#160228', '#2d0a4c', '#2d0a4c', '#200537', false, 'astralFloatingStone'));
        b.push(_b3dBox(-0.8, 0.7, -0.8, 0.8, 1.4, 0.8, '#2e0a4e', '#4c1775', '#1a042e', '#390e5e', '#390e5e', '#290845', false, 'astralFloatingStone'));
        b.push(_b3dBox(-0.85, 1.25, -0.85, 0.85, 1.45, 0.85, aCol, '#ffffff', aCol, aCol, aCol, aCol, true, 'arcaneMythic'));

        // Twin tuning fork stanchions flanking central cavity
        b.push(_b3dBox(-0.9, 1.4, -0.4, -0.45, 5.2, 0.4, '#300b52', '#50197d', '#1c0432', '#3c1064', '#3c1064', '#2a0847', false, 'astralFloatingStone'));
        b.push(_b3dBox(0.45, 1.4, -0.4, 0.9, 5.2, 0.4, '#300b52', '#50197d', '#1c0432', '#3c1064', '#3c1064', '#2a0847', false, 'astralFloatingStone'));

        // Floating collar ring connecting stanchions
        b.push(_b3dBox(-1.2, 3.2, -0.6, 1.2, 3.7, 0.6, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));

        // Suspended upper rune cap
        b.push(_b3dBox(-1.0, 5.2, -0.5, 1.0, 5.8, 0.5, '#4a157a', '#7127b0', '#2a0847', '#5a1d90', '#5a1d90', '#3f1267', false, 'astralFloatingStone'));

        const baseMesh = meshOfBoxes(b);
        // Suspended celestial energy orb
        const energyOrb = meshOfOcta(0.6, 1.3, aCol, 'arcaneMythic');
        for (const pt of energyOrb.v) pt[1] += 2.8;

        return mergeMesh(baseMesh, energyOrb);
      }
    },

    riftAstralArch(vOrNeon, neonColOrCurbc, curbc, lodLow) {
      let nCol = '#c084fc', cCol = '#f472b6';
      if (typeof vOrNeon === 'string') {
        nCol = vOrNeon;
        if (typeof neonColOrCurbc === 'string') cCol = neonColOrCurbc;
      } else {
        if (typeof neonColOrCurbc === 'string') nCol = neonColOrCurbc;
        if (typeof curbc === 'string') cCol = curbc;
      }
      const b = [];

      // Left Layered Floating Pylon (x = -12.8 to -10.2, y = 0 to 9.8m)
      b.push(_b3dBox(-12.8, 0, -2.4, -10.2, 3.2, 2.4, '#24063d', '#3f1163', '#160228', '#2d0a4c', '#2d0a4c', '#200537', false, 'astralFloatingStone'));
      // Floating energy gap at y = 3.2 to 3.5m
      b.push(_b3dBox(-12.4, 3.2, -2.0, -10.6, 3.5, 2.0, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));
      b.push(_b3dBox(-12.6, 3.5, -2.2, -10.4, 6.8, 2.2, '#2e0a4e', '#4c1775', '#1a042e', '#390e5e', '#390e5e', '#290845', false, 'astralFloatingStone'));
      // Inlaid vertical illuminated conduit
      b.push(_b3dBox(-11.8, 1.2, -2.26, -11.2, 6.6, 2.26, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'arcaneMythic'));
      b.push(_b3dBox(-12.2, 6.8, -2.0, -10.4, 9.8, 2.0, '#380f5d', '#5b1b93', '#200538', '#461473', '#461473', '#310c51', false, 'astralFloatingStone'));

      // Right Layered Floating Pylon (x = 10.2 to 12.8, y = 0 to 9.8m)
      b.push(_b3dBox(10.2, 0, -2.4, 12.8, 3.2, 2.4, '#24063d', '#3f1163', '#160228', '#2d0a4c', '#2d0a4c', '#200537', false, 'astralFloatingStone'));
      // Floating energy gap at y = 3.2 to 3.5m
      b.push(_b3dBox(10.6, 3.2, -2.0, 12.4, 3.5, 2.0, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));
      b.push(_b3dBox(10.4, 3.5, -2.2, 12.6, 6.8, 2.2, '#2e0a4e', '#4c1775', '#1a042e', '#390e5e', '#390e5e', '#290845', false, 'astralFloatingStone'));
      // Inlaid vertical illuminated conduit
      b.push(_b3dBox(11.2, 1.2, -2.26, 11.8, 6.6, 2.26, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'arcaneMythic'));
      b.push(_b3dBox(10.4, 6.8, -2.0, 12.2, 9.8, 2.0, '#380f5d', '#5b1b93', '#200538', '#461473', '#461473', '#310c51', false, 'astralFloatingStone'));

      // Floating Overhead Bridge Span across all 3 lanes (x = -10.2 to +10.2, clearance y = 8.8m to 10.6m)
      b.push(_b3dBox(-10.2, 8.8, -1.8, 10.2, 10.6, 1.8, '#300b52', '#50197d', '#1c0432', '#3c1064', '#3c1064', '#2a0847', false, 'astralFloatingStone'));
      // Under-arch illuminated navigation energy strip (y = 8.8 to 9.0m)
      b.push(_b3dBox(-10.0, 8.8, -0.6, 10.0, 9.02, 0.6, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'arcaneMythic'));
      // Upper glowing rune crest line (y = 10.4 to 10.65m)
      b.push(_b3dBox(-10.1, 10.4, -1.86, 10.1, 10.65, 1.86, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));

      // Suspended Central Astral Portal Ring Support Frame (x = -4.2 to 4.2, y = 10.6m to 14.6m)
      b.push(_b3dBox(-4.2, 10.6, -1.2, -2.8, 14.2, 1.2, '#3b1062', '#5f2094', '#200539', '#491678', '#491678', '#340e56', false, 'astralFloatingStone'));
      b.push(_b3dBox(2.8, 10.6, -1.2, 4.2, 14.2, 1.2, '#3b1062', '#5f2094', '#200539', '#491678', '#491678', '#340e56', false, 'astralFloatingStone'));
      b.push(_b3dBox(-4.2, 13.8, -1.2, 4.2, 14.8, 1.2, '#481477', '#6d26aa', '#280743', '#561c8a', '#561c8a', '#3c1162', false, 'astralFloatingStone'));

      // Inner floating celestial portal ring
      b.push(_b3dBox(-3.2, 11.4, -0.8, 3.2, 13.8, 0.8, cCol, '#ffffff', cCol, cCol, cCol, cCol, true, 'arcaneMythic'));

      // Suspended astral rune keystones
      if (!lodLow) {
        b.push(_b3dBox(-5.6, 9.4, -1.5, -4.8, 10.4, 1.5, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));
        b.push(_b3dBox(4.8, 9.4, -1.5, 5.6, 10.4, 1.5, nCol, '#ffffff', nCol, nCol, nCol, nCol, true, 'arcaneMythic'));
      }

      const baseArch = meshOfBoxes(b);
      // Center floating celestial star octahedron in the portal ring
      const starOcta = meshOfOcta(1.4, 2.6, nCol, 'arcaneMythic');
      for (const pt of starOcta.v) pt[1] += 12.6;

      return mergeMesh(baseArch, starOcta);
    },

    // Backward compatibility wrappers for legacy code & tests
    fantasyCastle(v, arcaneCol) {
      return this.riftBiomeLandmark(0, arcaneCol, '#c084fc', false);
    },
    fantasyIsland(v, arcaneCol) {
      return this.riftBiomeLandmark(1, arcaneCol, '#c084fc', false);
    },
    fantasyCrystal(arcaneCol) {
      return this.riftRoadsideProp(0, 1, arcaneCol || '#c084fc', false);
    },
    quantumPortalRing(col1, col2) {
      const outerHex = meshOfPrism(3.5, 0.7, 6, col1 || '#00e5ff', '#ffffff');
      for (const pt of outerHex.v) {
        const tmp = pt[1]; pt[1] = pt[2] + 2.5; pt[2] = tmp;
      }
      const innerHex = meshOfPrism(2.7, 0.9, 6, col2 || '#d946ef', '#ffffff');
      for (const pt of innerHex.v) {
        const tmp = pt[1]; pt[1] = pt[2] + 2.5; pt[2] = tmp;
      }
      return mergeMesh(outerHex, innerHex);
    }
  },

  getMesh(biomeType, variant, neonCol, curbc, rowType, lodLow) {
    const key = `${biomeType}_${rowType || 'auto'}_${variant % 4}_${neonCol || ''}_${curbc || ''}_${lodLow ? 'lod1' : 'lod0'}`;
    let mesh = _b3dCache.get(key);
    if (mesh) return mesh;
    const m = this.models;
    const isInner = rowType ? (rowType === 'inner') : (variant % 2 === 1);
    const isArch = rowType === 'arch';
    if (biomeType === 'city' || biomeType === 'grid') {
      if (isArch) mesh = m.cityOverheadGantry(variant, neonCol, curbc, lodLow);
      else mesh = isInner ? m.cityStreetLamp(variant % 2 === 0 ? -1 : 1, neonCol, curbc, lodLow) : m.citySkyscraper(variant, neonCol, curbc, lodLow);
    } else if (biomeType === 'crystal') {
      if (isArch) mesh = m.desertCanyonArch(variant, neonCol, curbc, lodLow);
      else mesh = isInner ? m.desertSpire(variant, (variant & 1) === 0 ? -1 : 1, '#9a3412', neonCol, lodLow) : m.desertMesa(variant, '#7c2d12', neonCol, lodLow);
    } else if (biomeType === 'bio') {
      if (isArch) mesh = m.forestRootArch(variant, neonCol, curbc, lodLow);
      else mesh = isInner ? m.forestShrine(variant, (variant & 1) === 0 ? -1 : 1, neonCol, lodLow) : m.forestAncientGiant(variant, '#059669', neonCol, lodLow);
    } else if (biomeType === 'ice') {
      if (isArch) mesh = m.iceOrbitalArch(variant, neonCol, curbc, lodLow);
      else mesh = isInner ? m.iceBeacon(variant, (variant & 1) === 0 ? -1 : 1, neonCol, lodLow) : m.iceGlacier(variant, neonCol, lodLow);
    } else if (biomeType === 'lava' || biomeType === 'volcano') {
      if (isArch) mesh = m.volcanoBasaltArch(variant, neonCol, curbc, lodLow);
      else mesh = isInner ? m.volcanoFumarole(variant, (variant & 1) === 0 ? -1 : 1, neonCol, lodLow) : m.volcanoCaldera(variant, '#1c1917', neonCol, lodLow);
    } else if (biomeType === 'cosmic' || biomeType === 'chrono') {
      if (isArch) mesh = m.spaceTunnelArch(variant, neonCol, curbc, lodLow);
      else mesh = isInner ? m.spaceBeacon(variant, (variant & 1) === 0 ? -1 : 1, neonCol, lodLow) : m.spaceAnomaly(variant, neonCol, curbc, lodLow);
    } else if (biomeType === 'tech') {
      if (isArch) mesh = m.oceanTrenchArch(variant, neonCol, curbc, lodLow);
      else mesh = isInner ? m.oceanRoadsideProp(variant, (variant & 1) === 0 ? -1 : 1, neonCol, lodLow) : m.oceanBiomeLandmark(variant, '#2dd4bf', neonCol, lodLow);
    } else if (biomeType === 'rift') {
      if (isArch) mesh = m.riftAstralArch(variant, neonCol, curbc, lodLow);
      else mesh = isInner ? m.riftRoadsideProp(variant, (variant & 1) === 0 ? -1 : 1, neonCol, lodLow) : m.riftBiomeLandmark(variant, '#f472b6', neonCol, lodLow);
    } else {
      mesh = isInner ? m.cityStreetLamp(-1, neonCol, curbc, lodLow) : m.citySkyscraper(variant, neonCol, curbc, lodLow);
    }
    _b3dCache.set(key, mesh);
    return mesh;
  },

  initScenery() {
    G.scenery3D = [];
    const count = G.quality === 'low' ? 12 : (G.quality === 'medium' ? 20 : 28);
    const loopLen = 140;
    const step = loopLen / count;
    for (let i = 0; i < count; i++) {
      const side = (i % 2 === 0) ? -1 : 1;
      const mod = i % 7;
      let rowType = 'outer';
      let xOffset = 9.6 + ((i * 2.3) % 5.4);
      let scale = 1.0 + ((i * 5) % 4) * 0.10;
      let rot = 0;
      if (mod === 1 || mod === 4) {
        rowType = 'inner';
        xOffset = 1.65 + ((i * 0.9) % 1.1);
        scale = 0.92 + ((i * 3) % 3) * 0.06;
      } else if (mod === 6) {
        rowType = 'arch';
        xOffset = 0;
        scale = 1.0;
      } else {
        rot = ((i % 4) * 1.5708);
      }
      const distOffset = i * step + ((i * 1.7) % (step * 0.35));
      const variant = (i + (i >> 1)) % 4;
      G.scenery3D.push({ side, xOffset, distOffset, variant, rot, scale, rowType, animSeed: (i * 13) % 100 });
    }
  },

  drawScenery(s, z, bmProps) {
    if (z > 62 || z < 0.8) return;
    if (G.quality === 'low' && z > 54) return;
    const bm = currentBiome();
    let rowType = s.rowType || (s.variant % 2 === 1 ? 'inner' : 'outer');
    if (rowType === 'arch' && bmProps !== 'cosmic' && bmProps !== 'chrono' && bmProps !== 'city' && bmProps !== 'grid' && bmProps !== 'crystal' && bmProps !== 'ice' && bmProps !== 'lava' && bmProps !== 'volcano' && bmProps !== 'bio' && bmProps !== 'tech' && bmProps !== 'rift') {
      rowType = 'inner';
    }
    const lodLow = (z > 20) || (G.quality === 'low');
    const secVariant = rowType === 'inner'
      ? (bmProps === 'crystal' || bmProps === 'ice' || bmProps === 'lava' || bmProps === 'volcano' || bmProps === 'bio' || bmProps === 'cosmic' || bmProps === 'chrono' || bmProps === 'tech' || bmProps === 'rift' ? ((s.side < 0 ? 0 : 1) | (s.variant & 2)) : (s.side < 0 ? 0 : 1))
      : s.variant;
    const mesh = this.getMesh(bmProps, secVariant, bm.neon, bm.curbc, rowType, lodLow);
    if (!mesh) return;
    let yPos = 0, rotY = s.rot, worldX = s.side * (ROADH + (s.xOffset || 2.2));
    if (rowType === 'arch') {
      if (bmProps === 'cosmic' || bmProps === 'chrono' || bmProps === 'city' || bmProps === 'grid' || bmProps === 'crystal' || bmProps === 'ice' || bmProps === 'lava' || bmProps === 'volcano' || bmProps === 'bio' || bmProps === 'tech' || bmProps === 'rift') {
        worldX = 0;
        yPos = 0;
        rotY = 0;
      }
    } else if (bmProps === 'city' || bmProps === 'grid' || bmProps === 'crystal' || bmProps === 'ice' || bmProps === 'lava' || bmProps === 'volcano' || bmProps === 'bio' || bmProps === 'tech' || bmProps === 'rift') {
      // Keep structures oriented so their sculpted faces and glowing conduits face the camera & road
      rotY = 0;
    } else if (bmProps === 'cosmic' || bmProps === 'chrono') {
      yPos = (rowType === 'outer' ? 1.2 : 0) + Math.sin(G.t * 1.8 + s.animSeed) * 0.45;
      if (rowType === 'outer') rotY = Math.sin(G.t * 0.5 + s.animSeed) * 0.15;
    } else if (bmProps === 'rift') {
      if (rowType === 'outer' && s.variant % 2 === 1) {
        yPos = 1.4 + Math.sin(G.t * 2.0 + s.animSeed) * 0.55;
      } else if (rowType === 'inner') {
        yPos = Math.sin(G.t * 3.0 + s.animSeed) * 0.22;
        rotY += G.t * 0.4;
      }
    } else if (bmProps === 'tech' && rowType === 'inner') {
      yPos = Math.sin(G.t * 2.4 + s.animSeed) * 0.18;
    } else if (bmProps === 'bio') {
      rotY += Math.sin(G.t * 2.0 + s.animSeed) * 0.05;
    }
    const pos = [worldX, yPos, z];
    const faces = facesOf(mesh, pos, rotY, s.scale);
    faces.sort((a, b) => b.z - a.z);
    for (let i = 0; i < faces.length; i++) {
      drawFace(faces[i]);
    }
  },

  // Zero-alloc 3D Perspective Terrain Embankments, Sidewalks, Drainage Channels & Guardrails
  drawRoadShoulders(bm, prev, row, depth, segIdx) {
    if (depth < 0.06) return;
    const type = bm.props || 'city';
    const alt = (segIdx & 1) === 0;
    const midW = ROADH + 6.5;
    const farW = ROADH + 34.0;
    const slopeY = (type === 'crystal' || type === 'ice' || type === 'bio' || type === 'lava') ? 1.65 : (type === 'cosmic' || type === 'rift' ? -0.6 : (type === 'tech' ? 1.4 : 0.0));

    for (let sIdx = 0; sIdx < 2; sIdx++) {
      const side = sIdx === 0 ? -1 : 1;
      const rEdgePrev = prev.x + side * prev.half;
      const rEdgeRow = row.x + side * row.half;
      const s1x = prev.x + side * midW * prev.s, s1y = prev.y;
      const s2x = row.x + side * midW * row.s, s2y = row.y;
      const s3x = prev.x + side * farW * prev.s, s3y = prev.y - slopeY * prev.s;
      const s4x = row.x + side * farW * row.s, s4y = row.y - slopeY * row.s;

      if (type === 'city' || type === 'grid') {
        // 1) Outer wet urban plaza ground plane
        ctx.fillStyle = alt ? '#070b17' : '#0a1020';
        ctx.beginPath();
        ctx.moveTo(rEdgePrev, prev.y); ctx.lineTo(s3x, prev.y);
        ctx.lineTo(s4x, row.y); ctx.lineTo(rEdgeRow, row.y);
        ctx.closePath(); ctx.fill();

        // 2) Raised 3D Sidewalk Platform & Layered Barrier (ROADH + 0.55 to ROADH + 4.8)
        const drainWPrev = 0.55 * prev.s, drainWRow = 0.55 * row.s;
        const swInPrev = rEdgePrev + side * drainWPrev, swInRow = rEdgeRow + side * drainWRow;
        const swOutPrev = prev.x + side * (ROADH + 4.8) * prev.s, swOutRow = row.x + side * (ROADH + 4.8) * row.s;
        const stepHPrev = 0.28 * prev.s, stepHRow = 0.28 * row.s;
        ctx.fillStyle = alt ? '#111a2e' : '#18243e';
        ctx.beginPath();
        ctx.moveTo(swInPrev, prev.y); ctx.lineTo(swInPrev, prev.y - stepHPrev);
        ctx.lineTo(swOutPrev, prev.y - stepHPrev); ctx.lineTo(swOutRow, row.y - stepHRow);
        ctx.lineTo(swInRow, row.y - stepHRow); ctx.lineTo(swInRow, row.y);
        ctx.closePath(); ctx.fill();

        // 3) Layered Roadside Barrier Reflective Strip & Wet Plaza Reflection
        if (depth > 0.12 && alt) {
          const stripCol = (segIdx % 4 === 0) ? '#fde047' : ((segIdx & 2) === 0 ? (bm.neon || '#00e5ff') : (bm.curbc || '#ff2fb9'));
          ctx.strokeStyle = rgba(stripCol, 0.65 * depth);
          ctx.lineWidth = Math.max(1.2, 2.6 * depth);
          ctx.beginPath();
          ctx.moveTo(swInPrev, prev.y - stepHPrev);
          ctx.lineTo(swInRow, row.y - stepHRow);
          ctx.stroke();

          ctx.fillStyle = rgba(stripCol, 0.20 * depth);
          ctx.beginPath();
          ctx.moveTo(swOutPrev + side * 1.0 * prev.s, prev.y);
          ctx.lineTo(s1x + side * 3.2 * prev.s, s1y);
          ctx.lineTo(s2x + side * 3.2 * row.s, s2y);
          ctx.lineTo(swOutRow + side * 1.0 * row.s, row.y);
          ctx.closePath(); ctx.fill();
        }
      } else if (type === 'crystal') {
        ctx.fillStyle = alt ? '#6c2710' : '#853216';
        ctx.beginPath();
        ctx.moveTo(rEdgePrev, prev.y); ctx.lineTo(s1x, s1y);
        ctx.lineTo(s2x, s2y); ctx.lineTo(rEdgeRow, row.y);
        ctx.closePath(); ctx.fill();

        ctx.fillStyle = alt ? '#9a3412' : '#b45309';
        ctx.beginPath();
        ctx.moveTo(s1x, s1y); ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y); ctx.lineTo(s2x, s2y);
        ctx.closePath(); ctx.fill();

        const ledgeInPrev = rEdgePrev + side * 0.85 * prev.s, ledgeInRow = rEdgeRow + side * 0.85 * row.s;
        const ledgeOutPrev = prev.x + side * (ROADH + 5.4) * prev.s, ledgeOutRow = row.x + side * (ROADH + 5.4) * row.s;
        const ledgeHPrev = 0.34 * prev.s, ledgeHRow = 0.34 * row.s;
        ctx.fillStyle = alt ? '#7c2d12' : '#9a3412';
        ctx.beginPath();
        ctx.moveTo(ledgeInPrev, prev.y); ctx.lineTo(ledgeInPrev, prev.y - ledgeHPrev);
        ctx.lineTo(ledgeOutPrev, prev.y - ledgeHPrev); ctx.lineTo(ledgeOutRow, row.y - ledgeHRow);
        ctx.lineTo(ledgeInRow, row.y - ledgeHRow); ctx.lineTo(ledgeInRow, row.y);
        ctx.closePath(); ctx.fill();

        if (depth > 0.10) {
          const railH = Math.max(2.6, 9.8 * depth);
          const railW = Math.max(1.5, 4.2 * depth);
          ctx.fillStyle = alt ? '#fbbf24' : '#1c1917';
          ctx.beginPath();
          ctx.moveTo(rEdgePrev, prev.y - railH);
          ctx.lineTo(rEdgePrev + side * railW, prev.y);
          ctx.lineTo(rEdgeRow + side * railW * 0.92, row.y);
          ctx.lineTo(rEdgeRow, row.y - railH * 0.90);
          ctx.closePath(); ctx.fill();

          if (alt && depth > 0.14) {
            const refCol = (segIdx % 4 === 0) ? '#ef4444' : '#fde047';
            ctx.strokeStyle = rgba(refCol, 0.72 * depth);
            ctx.lineWidth = Math.max(1.1, 2.4 * depth);
            ctx.beginPath();
            ctx.moveTo(rEdgePrev, prev.y - railH);
            ctx.lineTo(rEdgeRow, row.y - railH * 0.90);
            ctx.stroke();
          }
        }
      } else if (type === 'bio') {
        // 1) Fertile Humus Margin (Inner mossy forest verge)
        ctx.fillStyle = alt ? '#064e3b' : '#047857';
        ctx.beginPath();
        ctx.moveTo(rEdgePrev, prev.y); ctx.lineTo(s1x, s1y);
        ctx.lineTo(s2x, s2y); ctx.lineTo(rEdgeRow, row.y);
        ctx.closePath(); ctx.fill();

        // 2) Deep Forest Understory Terrain & Exposed Roots
        ctx.fillStyle = alt ? '#022c22' : '#064e3b';
        ctx.beginPath();
        ctx.moveTo(s1x, s1y); ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y); ctx.lineTo(s2x, s2y);
        ctx.closePath(); ctx.fill();

        // 3) Raised 3D Stepped Moss-Covered Root Shelf (ROADH + 0.8 to ROADH + 5.6)
        const ledgeInPrev = rEdgePrev + side * 0.85 * prev.s, ledgeInRow = rEdgeRow + side * 0.85 * row.s;
        const ledgeOutPrev = prev.x + side * (ROADH + 5.6) * prev.s, ledgeOutRow = row.x + side * (ROADH + 5.6) * row.s;
        const ledgeHPrev = 0.38 * prev.s, ledgeHRow = 0.38 * row.s;
        ctx.fillStyle = alt ? '#059669' : '#10b981';
        ctx.beginPath();
        ctx.moveTo(ledgeInPrev, prev.y); ctx.lineTo(ledgeInPrev, prev.y - ledgeHPrev);
        ctx.lineTo(ledgeOutPrev, prev.y - ledgeHPrev); ctx.lineTo(ledgeOutRow, row.y - ledgeHRow);
        ctx.lineTo(ledgeInRow, row.y - ledgeHRow); ctx.lineTo(ledgeInRow, row.y);
        ctx.closePath(); ctx.fill();

        // 4) 3D Living Root Guardrails with Radiant Jade Reflectors
        if (depth > 0.10) {
          const railH = Math.max(2.6, 9.8 * depth);
          const railW = Math.max(1.5, 4.2 * depth);
          ctx.fillStyle = alt ? '#34d399' : '#14281e';
          ctx.beginPath();
          ctx.moveTo(rEdgePrev, prev.y - railH);
          ctx.lineTo(rEdgePrev + side * railW, prev.y);
          ctx.lineTo(rEdgeRow + side * railW * 0.92, row.y);
          ctx.lineTo(rEdgeRow, row.y - railH * 0.90);
          ctx.closePath(); ctx.fill();

          if (alt && depth > 0.14) {
            const refCol = (segIdx % 4 === 0) ? '#a7f3d0' : '#10b981';
            ctx.strokeStyle = rgba(refCol, 0.85 * depth);
            ctx.lineWidth = Math.max(1.2, 2.6 * depth);
            ctx.beginPath();
            ctx.moveTo(rEdgePrev, prev.y - railH);
            ctx.lineTo(rEdgeRow, row.y - railH * 0.90);
            ctx.stroke();
          }
        }
      } else if (type === 'ice') {
        // 1) Frozen firn margin (inner compacted ice verge)
        ctx.fillStyle = alt ? '#072a4a' : '#0c4a6e';
        ctx.beginPath();
        ctx.moveTo(rEdgePrev, prev.y); ctx.lineTo(s1x, s1y);
        ctx.lineTo(s2x, s2y); ctx.lineTo(rEdgeRow, row.y);
        ctx.closePath(); ctx.fill();

        // 2) Glacial Ice Shelf & Rising Outer Mountain Terrain
        ctx.fillStyle = alt ? '#0369a1' : '#0284c7';
        ctx.beginPath();
        ctx.moveTo(s1x, s1y); ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y); ctx.lineTo(s2x, s2y);
        ctx.closePath(); ctx.fill();

        // 3) Raised 3D Stepped Glacial Ledge (ROADH + 0.8 to ROADH + 5.6)
        const ledgeInPrev = rEdgePrev + side * 0.85 * prev.s, ledgeInRow = rEdgeRow + side * 0.85 * row.s;
        const ledgeOutPrev = prev.x + side * (ROADH + 5.6) * prev.s, ledgeOutRow = row.x + side * (ROADH + 5.6) * row.s;
        const ledgeHPrev = 0.38 * prev.s, ledgeHRow = 0.38 * row.s;
        ctx.fillStyle = alt ? '#0ea5e9' : '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(ledgeInPrev, prev.y); ctx.lineTo(ledgeInPrev, prev.y - ledgeHPrev);
        ctx.lineTo(ledgeOutPrev, prev.y - ledgeHPrev); ctx.lineTo(ledgeOutRow, row.y - ledgeHRow);
        ctx.lineTo(ledgeInRow, row.y - ledgeHRow); ctx.lineTo(ledgeInRow, row.y);
        ctx.closePath(); ctx.fill();

        // 4) 3D Crystalline Safety Guardrail with Radiant Azure Reflectors
        if (depth > 0.10) {
          const railH = Math.max(2.6, 9.8 * depth);
          const railW = Math.max(1.5, 4.2 * depth);
          ctx.fillStyle = alt ? '#7dd3fc' : '#041524';
          ctx.beginPath();
          ctx.moveTo(rEdgePrev, prev.y - railH);
          ctx.lineTo(rEdgePrev + side * railW, prev.y);
          ctx.lineTo(rEdgeRow + side * railW * 0.92, row.y);
          ctx.lineTo(rEdgeRow, row.y - railH * 0.90);
          ctx.closePath(); ctx.fill();

          if (alt && depth > 0.14) {
            const refCol = (segIdx % 4 === 0) ? '#ffffff' : '#38bdf8';
            ctx.strokeStyle = rgba(refCol, 0.85 * depth);
            ctx.lineWidth = Math.max(1.2, 2.6 * depth);
            ctx.beginPath();
            ctx.moveTo(rEdgePrev, prev.y - railH);
            ctx.lineTo(rEdgeRow, row.y - railH * 0.90);
            ctx.stroke();
          }
        }
      } else if (type === 'lava' || type === 'volcano') {
        // 1) Scorched Cinder Margin (Inner cooled basalt bed)
        ctx.fillStyle = alt ? '#1c1412' : '#291814';
        ctx.beginPath();
        ctx.moveTo(rEdgePrev, prev.y); ctx.lineTo(s1x, s1y);
        ctx.lineTo(s2x, s2y); ctx.lineTo(rEdgeRow, row.y);
        ctx.closePath(); ctx.fill();

        // 2) Flanking Molten Magma River & Outer Caldera Wall
        const magmaShimmer = 0.5 + 0.5 * Math.sin(G.t * 5.0 + segIdx * 0.4);
        ctx.fillStyle = alt ? (magmaShimmer > 0.5 ? '#ff4500' : '#dc2626') : '#991b1b';
        ctx.beginPath();
        ctx.moveTo(s1x, s1y); ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y); ctx.lineTo(s2x, s2y);
        ctx.closePath(); ctx.fill();

        // 3) Raised 3D Stepped Basalt Ledge (ROADH + 0.8 to ROADH + 5.6)
        const ledgeInPrev = rEdgePrev + side * 0.85 * prev.s, ledgeInRow = rEdgeRow + side * 0.85 * row.s;
        const ledgeOutPrev = prev.x + side * (ROADH + 5.6) * prev.s, ledgeOutRow = row.x + side * (ROADH + 5.6) * row.s;
        const ledgeHPrev = 0.38 * prev.s, ledgeHRow = 0.38 * row.s;
        ctx.fillStyle = alt ? '#33221e' : '#442822';
        ctx.beginPath();
        ctx.moveTo(ledgeInPrev, prev.y); ctx.lineTo(ledgeInPrev, prev.y - ledgeHPrev);
        ctx.lineTo(ledgeOutPrev, prev.y - ledgeHPrev); ctx.lineTo(ledgeOutRow, row.y - ledgeHRow);
        ctx.lineTo(ledgeInRow, row.y - ledgeHRow); ctx.lineTo(ledgeInRow, row.y);
        ctx.closePath(); ctx.fill();

        // 4) 3D Thermal Hazard Guardrail with Radiant Magma/Amber Reflectors
        if (depth > 0.10) {
          const railH = Math.max(2.6, 9.8 * depth);
          const railW = Math.max(1.5, 4.2 * depth);
          ctx.fillStyle = alt ? '#f59e0b' : '#140806';
          ctx.beginPath();
          ctx.moveTo(rEdgePrev, prev.y - railH);
          ctx.lineTo(rEdgePrev + side * railW, prev.y);
          ctx.lineTo(rEdgeRow + side * railW * 0.92, row.y);
          ctx.lineTo(rEdgeRow, row.y - railH * 0.90);
          ctx.closePath(); ctx.fill();

          if (alt && depth > 0.14) {
            const refCol = (segIdx % 4 === 0) ? '#fef08a' : '#ff4500';
            ctx.strokeStyle = rgba(refCol, 0.85 * depth);
            ctx.lineWidth = Math.max(1.2, 2.6 * depth);
            ctx.beginPath();
            ctx.moveTo(rEdgePrev, prev.y - railH);
            ctx.lineTo(rEdgeRow, row.y - railH * 0.90);
            ctx.stroke();
          }
        }
      } else if (type === 'cosmic' || type === 'chrono') {
        // Multi-tier Quantum Gravity Shoulder with Floating Barrier Rails & Anti-Grav Pylons
        // 1) Base floating roadbed margin (void gravity shelf)
        const shelfWPrev = (ROADH + 4.8) * prev.s;
        const shelfWRow = (ROADH + 4.8) * row.s;
        const sOutPrev = prev.x + side * shelfWPrev;
        const sOutRow = row.x + side * shelfWRow;
        ctx.fillStyle = alt ? '#090318' : '#0f0728';
        ctx.beginPath();
        ctx.moveTo(rEdgePrev, prev.y);
        ctx.lineTo(sOutPrev, prev.y + 2.5 * depth);
        ctx.lineTo(sOutRow, row.y + 2.5 * depth);
        ctx.lineTo(rEdgeRow, row.y);
        ctx.closePath(); ctx.fill();

        // 2) Stepped dark violet gravity shelf
        const shelf2Prev = prev.x + side * (ROADH + 2.4) * prev.s;
        const shelf2Row = row.x + side * (ROADH + 2.4) * row.s;
        ctx.fillStyle = alt ? '#1e1b4b' : '#312e81';
        ctx.beginPath();
        ctx.moveTo(rEdgePrev, prev.y);
        ctx.lineTo(shelf2Prev, prev.y + 1.2 * depth);
        ctx.lineTo(shelf2Row, row.y + 1.2 * depth);
        ctx.lineTo(rEdgeRow, row.y);
        ctx.closePath(); ctx.fill();

        // 3) Luminous quantum border curb with harmonic pulse
        if (depth > 0.08) {
          const curbPulse = 0.5 + 0.5 * Math.sin(G.t * 5.0 - row.z * 0.4);
          ctx.strokeStyle = alt ? rgba('#00f5ff', (0.75 + 0.25 * curbPulse) * depth) : rgba('#ec4899', (0.65 + 0.35 * curbPulse) * depth);
          ctx.lineWidth = Math.max(1.4, 3.2 * depth);
          ctx.beginPath();
          ctx.moveTo(rEdgePrev, prev.y);
          ctx.lineTo(rEdgeRow, row.y);
          ctx.stroke();
        }

        // 4) 3D Cosmic Guardrail with Floating Anti-Grav Pylons
        if (depth > 0.10) {
          const railH = Math.max(2.4, 8.8 * depth);
          const railW = Math.max(1.4, 3.8 * depth);
          ctx.fillStyle = alt ? '#2e1065' : '#0f0728';
          ctx.beginPath();
          ctx.moveTo(rEdgePrev, prev.y - railH);
          ctx.lineTo(rEdgePrev + side * railW, prev.y);
          ctx.lineTo(rEdgeRow + side * railW * 0.92, row.y);
          ctx.lineTo(rEdgeRow, row.y - railH * 0.90);
          ctx.closePath(); ctx.fill();

          if (alt && depth > 0.14) {
            const pylonGlow = (segIdx % 4 === 0) ? '#00f5ff' : '#ec4899';
            ctx.strokeStyle = rgba(pylonGlow, 0.90 * depth);
            ctx.lineWidth = Math.max(1.2, 2.5 * depth);
            ctx.beginPath();
            ctx.moveTo(rEdgePrev, prev.y - railH);
            ctx.lineTo(rEdgeRow, row.y - railH * 0.90);
            ctx.stroke();
          }
        }
      } else if (type === 'tech') {
        // 1) Outer deep ocean seafloor basin terrain plane
        ctx.fillStyle = alt ? '#021320' : '#041c2e';
        ctx.beginPath();
        ctx.moveTo(rEdgePrev, prev.y); ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y); ctx.lineTo(rEdgeRow, row.y);
        ctx.closePath(); ctx.fill();

        // 2) Stepped Submerged Continental Shelf / Trench Terrace (ROADH + 0.6 to ROADH + 5.2)
        const shInPrev = rEdgePrev + side * 0.6 * prev.s, shInRow = rEdgeRow + side * 0.6 * row.s;
        const shOutPrev = prev.x + side * (ROADH + 5.2) * prev.s, shOutRow = row.x + side * (ROADH + 5.2) * row.s;
        const shelfHPrev = 0.35 * prev.s, shelfHRow = 0.35 * row.s;

        // Shelf vertical rock riser
        ctx.fillStyle = alt ? '#031b2c' : '#062d47';
        ctx.beginPath();
        ctx.moveTo(shInPrev, prev.y); ctx.lineTo(shInPrev, prev.y - shelfHPrev);
        ctx.lineTo(shInRow, row.y - shelfHRow); ctx.lineTo(shInRow, row.y);
        ctx.closePath(); ctx.fill();

        // Shelf flat top surface with deep ocean rock sheen
        ctx.fillStyle = alt ? '#052940' : '#093c60';
        ctx.beginPath();
        ctx.moveTo(shInPrev, prev.y - shelfHPrev); ctx.lineTo(shOutPrev, prev.y - shelfHPrev);
        ctx.lineTo(shOutRow, row.y - shelfHRow); ctx.lineTo(shInRow, row.y - shelfHRow);
        ctx.closePath(); ctx.fill();

        // 3) Inner Luminous Boundary Curb (Hydrodynamic guide edge)
        ctx.fillStyle = alt ? (bm.curbc || '#2dd4bf') : (bm.neon || '#00f0ff');
        ctx.beginPath();
        ctx.moveTo(rEdgePrev, prev.y); ctx.lineTo(shInPrev, prev.y);
        ctx.lineTo(shInRow, row.y); ctx.lineTo(rEdgeRow, row.y);
        ctx.closePath(); ctx.fill();

        // 4) 3D Deep-Sea Guardrail Posts & Anti-Pressure Stanchions
        if (depth > 0.08 && (segIdx % 2 === 0)) {
          const postW = 0.42 * prev.s;
          const postH = 1.15 * prev.s;
          const p1x = shInPrev, p1y = prev.y - shelfHPrev;
          const p2x = shInPrev + side * postW, p2y = p1y - postH;

          // Stanchion pillar
          ctx.fillStyle = '#062b45';
          ctx.beginPath();
          ctx.moveTo(p1x, p1y); ctx.lineTo(p1x, p1y - postH);
          ctx.lineTo(p2x, p2y); ctx.lineTo(p2x, p1y);
          ctx.closePath(); ctx.fill();

          // Reflective luminous turquoise cap
          ctx.fillStyle = (segIdx % 4 === 0) ? '#5eead4' : '#00f0ff';
          ctx.beginPath();
          ctx.arc(p1x + side * postW * 0.5, p1y - postH, Math.max(1.5, 3.2 * prev.s), 0, Math.PI * 2);
          ctx.fill();
        }

        // 5) Periodic Seafloor Vent Micro-Bubble Whisps on shelf
        if (depth > 0.15 && (segIdx % 7 === 0)) {
          const ventX = shInPrev + side * 2.2 * prev.s;
          const ventY = prev.y - shelfHPrev;
          ctx.fillStyle = 'rgba(45, 212, 191, 0.45)';
          ctx.beginPath();
          ctx.ellipse(ventX, ventY, 3.5 * prev.s, 1.6 * prev.s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'rift') {
        // 1) Outer deep astral void space plane
        ctx.fillStyle = alt ? '#0e021a' : '#140324';
        ctx.beginPath();
        ctx.moveTo(rEdgePrev, prev.y); ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y); ctx.lineTo(rEdgeRow, row.y);
        ctx.closePath(); ctx.fill();

        // 2) Primary floating astral rock shelf (ROADH + 0.55 to ROADH + 4.6, shelfH = 0.36 * s)
        const shInPrev = rEdgePrev + side * 0.55 * prev.s, shInRow = rEdgeRow + side * 0.55 * row.s;
        const shOutPrev = prev.x + side * (ROADH + 4.6) * prev.s, shOutRow = row.x + side * (ROADH + 4.6) * row.s;
        const shelfHPrev = 0.36 * prev.s, shelfHRow = 0.36 * row.s;

        // Front / side drop-off face of floating island
        ctx.fillStyle = alt ? '#1c0432' : '#280746';
        ctx.beginPath();
        ctx.moveTo(shInPrev, prev.y); ctx.lineTo(shInPrev, prev.y - shelfHPrev);
        ctx.lineTo(shOutPrev, prev.y - shelfHPrev); ctx.lineTo(shOutRow, row.y - shelfHRow);
        ctx.lineTo(shInRow, row.y - shelfHRow); ctx.lineTo(shInRow, row.y);
        ctx.closePath(); ctx.fill();

        // Top amethyst bevel face of island
        ctx.fillStyle = alt ? '#380e5c' : '#481375';
        ctx.beginPath();
        ctx.moveTo(shInPrev, prev.y - shelfHPrev);
        ctx.lineTo(shOutPrev, prev.y - shelfHPrev);
        ctx.lineTo(shOutRow, row.y - shelfHRow);
        ctx.lineTo(shInRow, row.y - shelfHRow);
        ctx.closePath(); ctx.fill();

        // 3) Detached floating rock fragments separated by visible void gaps (ROADH + 5.8 to ROADH + 9.8)
        if (depth > 0.08 && alt) {
          const fragInPrev = prev.x + side * (ROADH + 5.8) * prev.s, fragInRow = row.x + side * (ROADH + 5.8) * row.s;
          const fragOutPrev = prev.x + side * (ROADH + 9.8) * prev.s, fragOutRow = row.x + side * (ROADH + 9.8) * row.s;
          const fragHPrev = 0.52 * prev.s, fragHRow = 0.52 * row.s;

          ctx.fillStyle = '#22053d';
          ctx.beginPath();
          ctx.moveTo(fragInPrev, prev.y - fragHPrev);
          ctx.lineTo(fragOutPrev, prev.y - fragHPrev * 0.85);
          ctx.lineTo(fragOutRow, row.y - fragHRow * 0.85);
          ctx.lineTo(fragInRow, row.y - fragHRow);
          ctx.closePath(); ctx.fill();

          ctx.strokeStyle = rgba(bm.neon || '#c084fc', 0.45 * depth);
          ctx.lineWidth = Math.max(1.0, 1.8 * depth);
          ctx.stroke();
        }

        // 4) Luminous Rose-Violet Runic Curb Border
        if (depth > 0.06) {
          const curbPulse = 0.65 + 0.35 * Math.sin(G.t * 4.2 + segIdx * 0.45);
          ctx.strokeStyle = rgba(bm.curbc || '#f472b6', curbPulse * depth);
          ctx.lineWidth = Math.max(1.4, 3.2 * depth);
          ctx.beginPath();
          ctx.moveTo(rEdgePrev, prev.y - shelfHPrev * 0.5);
          ctx.lineTo(rEdgeRow, row.y - shelfHRow * 0.5);
          ctx.stroke();
        }

        // 5) Levitating roadside mana crystal clusters (periodic)
        if (depth > 0.12 && segIdx % 4 === 0) {
          const bobY = Math.sin(G.t * 3.6 + segIdx * 1.2) * 5.5 * depth;
          const cX = shOutPrev + side * 1.8 * prev.s;
          const cY = prev.y - shelfHPrev - 12 * depth + bobY;
          const cRad = 3.6 * depth;

          ctx.fillStyle = rgba(bm.curbc || '#f472b6', 0.85);
          ctx.beginPath();
          ctx.moveTo(cX, cY - cRad * 1.8);
          ctx.lineTo(cX + cRad, cY);
          ctx.lineTo(cX, cY + cRad * 1.8);
          ctx.lineTo(cX - cRad, cY);
          ctx.closePath(); ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(0.8, 1.2 * depth);
          ctx.stroke();
        }
      }
    }
  },

  drawRoadSurfaceEffects(bm, prev, row, depth, segIdx) {
    const type = bm.props || 'city';
    if (depth < 0.08) return;
    if (type === 'city' || type === 'grid') {
      if (G.quality === 'low' || (segIdx & 1) !== 0) return;
      const nCol = bm.neon || '#00e5ff';
      const cCol = bm.curbc || '#ff2fb9';
      // 1) Spatially connected wet reflections along left & right outer road edges (aligned with streetlamps & neon signs)
      const lampWave = 0.5 + 0.5 * Math.sin(G.t * 3.8 - row.z * 0.28);
      if (lampWave > 0.22) {
        const lCol = (segIdx % 4 === 0) ? cCol : nCol;
        const rCol = (segIdx % 4 === 0) ? nCol : cCol;
        const reflAlpha = (lampWave - 0.22) * 0.34 * depth;
        ctx.fillStyle = rgba(lCol, reflAlpha);
        ctx.beginPath();
        ctx.moveTo(prev.x - prev.half * 0.96, prev.y); ctx.lineTo(prev.x - prev.half * 0.62, prev.y);
        ctx.lineTo(row.x - row.half * 0.62, row.y); ctx.lineTo(row.x - row.half * 0.96, row.y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgba(rCol, reflAlpha);
        ctx.beginPath();
        ctx.moveTo(prev.x + prev.half * 0.62, prev.y); ctx.lineTo(prev.x + prev.half * 0.96, prev.y);
        ctx.lineTo(row.x + row.half * 0.96, row.y); ctx.lineTo(row.x + row.half * 0.62, row.y);
        ctx.closePath(); ctx.fill();
      }
      // 2) Vehicle & Lighting Integration: Player Car Headlight Wet Asphalt Reflection
      if (row.z < 14 && row.z > 0.5) {
        const carXPrev = prev.x + G.x * prev.s;
        const carXRow = row.x + G.x * row.s;
        const beamWPrev = 0.82 * prev.s, beamWRow = 0.82 * row.s;
        ctx.fillStyle = rgba(nCol, (1 - row.z / 14) * 0.22);
        ctx.beginPath();
        ctx.moveTo(carXPrev - beamWPrev, prev.y); ctx.lineTo(carXPrev + beamWPrev, prev.y);
        ctx.lineTo(carXRow + beamWRow, row.y); ctx.lineTo(carXRow - beamWRow, row.y);
        ctx.closePath(); ctx.fill();
      }
    } else if (type === 'crystal') {
      if ((segIdx & 1) === 0) {
        const driftWave = 0.68 + 0.14 * Math.sin(segIdx * 1.3 + G.t * 1.4);
        ctx.fillStyle = rgba('#d97706', 0.24 * depth);
        ctx.beginPath();
        ctx.moveTo(prev.x - prev.half * 0.97, prev.y); ctx.lineTo(prev.x - prev.half * driftWave, prev.y);
        ctx.lineTo(row.x - row.half * driftWave, row.y); ctx.lineTo(row.x - row.half * 0.97, row.y);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(prev.x + prev.half * driftWave, prev.y); ctx.lineTo(prev.x + prev.half * 0.97, prev.y);
        ctx.lineTo(row.x + row.half * 0.97, row.y); ctx.lineTo(row.x + row.half * driftWave, row.y);
        ctx.closePath(); ctx.fill();

        const sandShift = (G.t * 32 + segIdx * 13) % (prev.half * 1.6) - prev.half * 0.8;
        ctx.strokeStyle = rgba('#fbbf24', 0.30 * depth);
        ctx.lineWidth = Math.max(1.4, 3.4 * depth);
        ctx.beginPath();
        ctx.moveTo(prev.x - prev.half * 0.86, prev.y);
        ctx.quadraticCurveTo(prev.x + sandShift * 0.45, (prev.y + row.y) * 0.5, row.x + row.half * 0.84, row.y);
        ctx.stroke();
      }
      if (row.z < 14 && row.z > 0.5 && G.quality !== 'low') {
        const carXPrev = prev.x + G.x * prev.s;
        const carXRow = row.x + G.x * row.s;
        const beamWPrev = 0.80 * prev.s, beamWRow = 0.80 * row.s;
        ctx.fillStyle = rgba(bm.neon || '#f59e0b', (1 - row.z / 14) * 0.20);
        ctx.beginPath();
        ctx.moveTo(carXPrev - beamWPrev, prev.y); ctx.lineTo(carXPrev + beamWPrev, prev.y);
        ctx.lineTo(carXRow + beamWRow, row.y); ctx.lineTo(carXRow - beamWRow, row.y);
        ctx.closePath(); ctx.fill();
      }
    } else if (type === 'bio') {
      // 1) Damp Mossy Forest Roadbed with Soil Sheen
      ctx.fillStyle = rgba('#064e3b', ((segIdx & 1) === 0 ? 0.22 : 0.12) * depth);
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half * 0.94, prev.y); ctx.lineTo(prev.x + prev.half * 0.94, prev.y);
      ctx.lineTo(row.x + row.half * 0.94, row.y); ctx.lineTo(row.x - row.half * 0.94, row.y);
      ctx.closePath(); ctx.fill();

      // 2) Living Sub-surface Mycelium Bio-Veins pulsing along track lanes
      const bioPulse = 0.5 + 0.5 * Math.sin(G.t * 3.6 + segIdx * 0.55);
      if (bioPulse > 0.32 && depth > 0.12) {
        ctx.strokeStyle = rgba('#34d399', (bioPulse * 0.42) * depth);
        ctx.lineWidth = Math.max(1.1, 2.4 * depth);
        const fx1 = prev.x + Math.sin(segIdx * 1.7) * prev.half * 0.50;
        const fx2 = row.x + Math.sin((segIdx + 1) * 1.7) * row.half * 0.50;
        ctx.beginPath();
        ctx.moveTo(fx1, prev.y); ctx.lineTo(fx2, row.y);
        ctx.stroke();
      }

      // 3) Drifting Wind-blown Spores & Forest Leaf Litter
      if (segIdx % 3 === 0 && depth > 0.15) {
        const leafX = prev.x + Math.sin(G.t * 3.8 + segIdx * 1.9) * prev.half * 0.78;
        ctx.fillStyle = (segIdx & 1) === 0 ? '#34d399' : '#6ee7b7';
        ctx.beginPath();
        ctx.ellipse(leafX, prev.y, 3.8 * depth, 1.9 * depth, G.t * 3.5 + segIdx, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4) Luminous Fungal Spore Flecks on Road Edge
      if (depth > 0.18 && (segIdx % 5 === 0)) {
        const sporeX = prev.x + Math.sin(G.t * 5.0 + segIdx) * prev.half * 0.85;
        ctx.fillStyle = '#a7f3d0';
        ctx.beginPath();
        ctx.arc(sporeX, prev.y, 2.2 * depth, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'ice') {
      // 1) Translucent Glazed Black-Ice racing surface
      ctx.fillStyle = rgba('#38bdf8', ((segIdx & 1) === 0 ? 0.20 : 0.10) * depth);
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half * 0.94, prev.y); ctx.lineTo(prev.x + prev.half * 0.94, prev.y);
      ctx.lineTo(row.x + row.half * 0.94, row.y); ctx.lineTo(row.x - row.half * 0.94, row.y);
      ctx.closePath(); ctx.fill();

      // 2) Sub-surface cryo-fractures pulsing with faint internal cyan energy
      const frostPulse = 0.5 + 0.5 * Math.sin(G.t * 3.4 + segIdx * 0.55);
      if (frostPulse > 0.35 && depth > 0.12) {
        ctx.strokeStyle = rgba('#7dd3fc', (frostPulse * 0.38) * depth);
        ctx.lineWidth = Math.max(1.0, 2.4 * depth);
        const fx1 = prev.x + Math.sin(segIdx * 1.8) * prev.half * 0.55;
        const fx2 = row.x + Math.sin((segIdx + 1) * 1.8) * row.half * 0.55;
        ctx.beginPath();
        ctx.moveTo(fx1, prev.y); ctx.lineTo(fx2, row.y);
        ctx.stroke();
      }

      // 3) Diamond-dust glints sparkling on the ice surface
      const glint = Math.sin(G.t * 12.0 + segIdx * 4.1);
      if (glint > 0.80 && depth > 0.15) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(prev.x + Math.sin(segIdx * 2.3) * prev.half * 0.7, prev.y, 2.8 * depth, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4) High-speed orbital drift wind streak skimming the road surface
      if (depth > 0.18 && (segIdx % 5 === 0)) {
        const driftX = prev.x + Math.sin(G.t * 6.0 + segIdx) * prev.half * 0.82;
        ctx.fillStyle = rgba('#e0f2fe', 0.26 * depth);
        ctx.fillRect(driftX - 12 * depth, prev.y, 24 * depth, Math.max(1.5, prev.y - row.y));
      }
    } else if (type === 'lava' || type === 'volcano') {
      // 1) Scorched Obsidian Roadbed with Cooling Slag Sheen
      ctx.fillStyle = rgba('#1a0806', ((segIdx & 1) === 0 ? 0.35 : 0.22) * depth);
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half * 0.94, prev.y); ctx.lineTo(prev.x + prev.half * 0.94, prev.y);
      ctx.lineTo(row.x + row.half * 0.94, row.y); ctx.lineTo(row.x - row.half * 0.94, row.y);
      ctx.closePath(); ctx.fill();

      // 2) Living Sub-surface Magma Fissures along Track Lanes
      const magmaFlow = 0.5 + 0.5 * Math.sin(G.t * 5.2 - row.z * 0.45);
      if (magmaFlow > 0.30 && depth > 0.12) {
        ctx.strokeStyle = rgba('#ff5500', (magmaFlow * 0.55) * depth);
        ctx.lineWidth = Math.max(1.2, 2.8 * depth);
        const fx1 = prev.x + Math.sin(segIdx * 1.6) * prev.half * 0.45;
        const fx2 = row.x + Math.sin((segIdx + 1) * 1.6) * row.half * 0.45;
        ctx.beginPath();
        ctx.moveTo(fx1, prev.y); ctx.lineTo(fx2, row.y);
        ctx.stroke();
      }

      // 3) Incandescent Road Edge Magma Gutters
      ctx.fillStyle = rgba('#ff4500', (0.55 + magmaFlow * 0.40) * depth);
      const ew = Math.max(2.8, 9.2 * depth);
      ctx.fillRect(prev.x - prev.half, row.y, ew, Math.max(1.5, prev.y - row.y + 1));
      ctx.fillRect(prev.x + prev.half - ew, row.y, ew, Math.max(1.5, prev.y - row.y + 1));

      // 4) Glowing Ember Cinders skimming across road
      if (depth > 0.16 && (segIdx % 4 === 0)) {
        const emberX = prev.x + Math.sin(G.t * 8.0 + segIdx * 2.3) * prev.half * 0.75;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(emberX, prev.y, 2.2 * depth, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'cosmic' || type === 'chrono') {
      // 1) Outer Roadside Quantum Containment Rails
      const railPulse = 0.5 + 0.5 * Math.sin(G.t * 7.0 - row.z * 0.45);
      ctx.strokeStyle = rgba(bm.neon || '#00f5ff', (0.55 + 0.45 * railPulse) * depth);
      ctx.lineWidth = Math.max(1.6, 3.8 * depth);
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half, prev.y); ctx.lineTo(row.x - row.half, row.y);
      ctx.moveTo(prev.x + prev.half, prev.y); ctx.lineTo(row.x + row.half, row.y);
      ctx.stroke();

      // 2) Reality Fracture Fissures running through the dark asphalt
      if (depth > 0.08 && (segIdx % 3 === 0)) {
        const fracOffset = Math.sin(row.z * 0.65 + G.t * 3.5) * prev.half * 0.42;
        const fracGlow = 0.5 + 0.5 * Math.sin(G.t * 9.0 - row.z * 0.7);
        ctx.strokeStyle = rgba('#ec4899', (0.50 + 0.50 * fracGlow) * depth);
        ctx.lineWidth = Math.max(1.2, 2.8 * depth);
        ctx.beginPath();
        ctx.moveTo(prev.x + fracOffset, prev.y);
        ctx.lineTo(row.x + fracOffset * 0.95, row.y);
        ctx.stroke();
      }

      // 3) Quantum Lane Guidance Energy Pulses
      if (depth > 0.12 && (segIdx % 4 === 1)) {
        const lanePulse = 0.4 + 0.6 * Math.sin(G.t * 8.0 + row.z * 0.5);
        ctx.strokeStyle = rgba('#38bdf8', lanePulse * depth);
        ctx.lineWidth = Math.max(1.0, 2.2 * depth);
        const l1Prev = prev.x - prev.half * 0.33, l1Row = row.x - row.half * 0.33;
        const l2Prev = prev.x + prev.half * 0.33, l2Row = row.x + row.half * 0.33;
        ctx.beginPath();
        ctx.moveTo(l1Prev, prev.y); ctx.lineTo(l1Row, row.y);
        ctx.moveTo(l2Prev, prev.y); ctx.lineTo(l2Row, row.y);
        ctx.stroke();
      }

      // 4) Zero-G Cosmic Energy Flecks dancing across the road
      if (depth > 0.15 && (segIdx % 5 === 0)) {
        const fleckX = prev.x + Math.sin(G.t * 6.5 + segIdx * 3.1) * prev.half * 0.7;
        ctx.fillStyle = (segIdx % 2 === 0) ? '#00f5ff' : '#ec4899';
        ctx.beginPath();
        ctx.arc(fleckX, prev.y - 1.2 * depth, 2.2 * depth, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'tech') {
      // 1) Outer Hydrodynamic Current Guide Rails
      const railGlow = 0.5 + 0.5 * Math.sin(G.t * 4.5 - row.z * 0.3);
      ctx.strokeStyle = rgba(bm.neon || '#00f0ff', (0.50 + 0.45 * railGlow) * depth);
      ctx.lineWidth = Math.max(1.5, 3.6 * depth);
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half, prev.y); ctx.lineTo(row.x - row.half, row.y);
      ctx.moveTo(prev.x + prev.half, prev.y); ctx.lineTo(row.x + row.half, row.y);
      ctx.stroke();

      // 2) Moving Caustic Wave Patterns sweeping across racing substrate
      if (G.quality !== 'low') {
        const causticWave = Math.sin(G.t * 3.4 + row.z * 0.28) * Math.cos(G.t * 2.2 - row.z * 0.18);
        if (causticWave > 0.08) {
          ctx.strokeStyle = rgba('#67e8f9', (causticWave + 0.08) * 0.42 * depth);
          ctx.lineWidth = Math.max(1.2, 3.4 * depth);
          const cOff1 = Math.sin(row.z * 0.4 + G.t * 2.0) * prev.half * 0.55;
          const cOff2 = Math.cos(row.z * 0.45 - G.t * 1.8) * row.half * 0.55;
          ctx.beginPath();
          ctx.moveTo(prev.x + cOff1, prev.y);
          ctx.lineTo(row.x + cOff2, row.y);
          ctx.stroke();
        }
      }

      // 3) Bioluminescent Plankton Flecks along road boundaries
      if (depth > 0.12 && (segIdx % 3 === 0)) {
        const planktonPulse = 0.4 + 0.6 * Math.sin(G.t * 5.0 + segIdx * 0.8);
        ctx.fillStyle = rgba('#5eead4', (0.45 + 0.45 * planktonPulse) * depth);
        const pOff = (segIdx % 2 === 0 ? -1 : 1) * prev.half * 0.68;
        ctx.beginPath();
        ctx.arc(prev.x + pOff, prev.y, Math.max(1.2, 2.6 * depth), 0, Math.PI * 2);
        ctx.fill();
      }

      // 4) Sub-surface Abyssal Current Pulse in Central Lane
      if (depth > 0.10 && (segIdx % 5 === 1)) {
        const currentPulse = 0.5 + 0.5 * Math.sin(G.t * 6.5 - row.z * 0.5);
        ctx.strokeStyle = rgba('#2dd4bf', currentPulse * 0.40 * depth);
        ctx.lineWidth = Math.max(1.0, 2.2 * depth);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y); ctx.lineTo(row.x, row.y);
        ctx.stroke();
      }
    } else if (type === 'rift') {
      // 1) Outer Arcane Runic Edge Guide Rails
      if ((segIdx & 1) === 0 && depth > 0.08) {
        const nCol = bm.neon || '#c084fc';
        const cCol = bm.curbc || '#f472b6';
        const runeFlow = 0.5 + 0.5 * Math.sin(G.t * 4.6 - row.z * 0.32);
        const lAlpha = (0.28 + 0.42 * runeFlow) * depth;

        ctx.fillStyle = rgba(nCol, lAlpha);
        ctx.beginPath();
        ctx.moveTo(prev.x - prev.half * 0.94, prev.y); ctx.lineTo(prev.x - prev.half * 0.76, prev.y);
        ctx.lineTo(row.x - row.half * 0.76, row.y); ctx.lineTo(row.x - row.half * 0.94, row.y);
        ctx.closePath(); ctx.fill();

        ctx.fillStyle = rgba(cCol, lAlpha);
        ctx.beginPath();
        ctx.moveTo(prev.x + prev.half * 0.76, prev.y); ctx.lineTo(prev.x + prev.half * 0.94, prev.y);
        ctx.lineTo(row.x + row.half * 0.94, row.y); ctx.lineTo(row.x + row.half * 0.76, row.y);
        ctx.closePath(); ctx.fill();
      }

      // 2) Center-Lane Traveling Ley-Line Energy Waves
      const leyWave = Math.sin(G.t * 5.2 - row.z * 0.22);
      if (leyWave > 0.15 && depth > 0.09) {
        const leyAlpha = (leyWave - 0.15) * 0.55 * depth;
        ctx.fillStyle = rgba(bm.curbc || '#f472b6', leyAlpha);
        ctx.beginPath();
        ctx.moveTo(prev.x - prev.half * 0.14, prev.y); ctx.lineTo(prev.x + prev.half * 0.14, prev.y);
        ctx.lineTo(row.x + row.half * 0.14, row.y); ctx.lineTo(row.x - row.half * 0.14, row.y);
        ctx.closePath(); ctx.fill();
      }

      // 3) Runic Node Circles at Lane Dividers
      if (depth > 0.12 && segIdx % 3 === 0) {
        const nodePulse = 0.5 + 0.5 * Math.sin(G.t * 5.8 + segIdx * 1.1);
        ctx.fillStyle = rgba('#ffffff', (0.55 + 0.45 * nodePulse) * depth);
        for (const laneRatio of [-0.33, 0.33]) {
          const nx = prev.x + prev.half * laneRatio;
          ctx.beginPath();
          ctx.arc(nx, prev.y, 2.8 * depth, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  },

  drawHorizonPanorama(bm, horizon, bpar) {
    const type = bm.props || 'city';
    ctx.save();
    if (type === 'city' || type === 'grid') {
      // Far Atmospheric Megastructure Layer (Deep atmospheric perspective behind midground skyline)
      const megaTowers = [
        { x: 0.04, w: 0.11, h: 0.38, style: 'ziggurat' },
        { x: 0.17, w: 0.08, h: 0.44, style: 'spire' },
        { x: 0.29, w: 0.10, h: 0.34, style: 'twin' },
        { x: 0.62, w: 0.11, h: 0.42, style: 'spire' },
        { x: 0.75, w: 0.12, h: 0.36, style: 'ziggurat' },
        { x: 0.89, w: 0.09, h: 0.40, style: 'twin' }
      ];
      for (let i = 0; i < megaTowers.length; i++) {
        const mt = megaTowers[i];
        const mx = mt.x * W + bpar * 0.35, mw = mt.w * W, mh = mt.h * H;
        ctx.fillStyle = 'rgba(18, 12, 44, 0.78)';
        if (mt.style === 'ziggurat') {
          ctx.beginPath();
          ctx.moveTo(mx, horizon);
          ctx.lineTo(mx + mw * 0.16, horizon - mh * 0.72);
          ctx.lineTo(mx + mw * 0.30, horizon - mh);
          ctx.lineTo(mx + mw * 0.70, horizon - mh);
          ctx.lineTo(mx + mw * 0.84, horizon - mh * 0.72);
          ctx.lineTo(mx + mw, horizon);
          ctx.closePath();
          ctx.fill();
        } else if (mt.style === 'spire') {
          ctx.fillRect(mx + mw * 0.15, horizon - mh * 0.80, mw * 0.70, mh * 0.80);
          ctx.fillRect(mx + mw * 0.30, horizon - mh, mw * 0.40, mh * 0.20);
          ctx.strokeStyle = rgba(bm.neon || '#00e5ff', 0.32);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(mx + mw * 0.5, horizon - mh);
          ctx.lineTo(mx + mw * 0.5, horizon - mh * 1.16);
          ctx.stroke();
        } else {
          ctx.fillRect(mx, horizon - mh * 0.88, mw * 0.42, mh * 0.88);
          ctx.fillRect(mx + mw * 0.58, horizon - mh * 0.94, mw * 0.42, mh * 0.94);
          ctx.fillRect(mx + mw * 0.35, horizon - mh * 0.62, mw * 0.30, mh * 0.08);
        }
        // Subtle atmospheric vertical light strip on far megastructures
        ctx.fillStyle = rgba(i % 2 === 0 ? (bm.neon || '#00e5ff') : (bm.curbc || '#ff2fb9'), 0.22);
        ctx.fillRect(mx + mw * 0.48, horizon - mh * 0.82, 1.5, mh * 0.68);
      }
    } else if (type === 'crystal') {
      const farPlateaus = [
        { x: 0.02, w: 0.18, h: 0.30 },
        { x: 0.22, w: 0.16, h: 0.25 },
        { x: 0.58, w: 0.19, h: 0.28 },
        { x: 0.78, w: 0.20, h: 0.32 }
      ];
      for (let i = 0; i < farPlateaus.length; i++) {
        const fp = farPlateaus[i];
        const fx = fp.x * W + bpar * 0.32, fw = fp.w * W, fh = fp.h * H;
        ctx.fillStyle = 'rgba(74, 18, 48, 0.72)';
        ctx.beginPath();
        ctx.moveTo(fx, horizon);
        ctx.lineTo(fx + fw * 0.12, horizon - fh * 0.72);
        ctx.lineTo(fx + fw * 0.22, horizon - fh);
        ctx.lineTo(fx + fw * 0.78, horizon - fh);
        ctx.lineTo(fx + fw * 0.88, horizon - fh * 0.72);
        ctx.lineTo(fx + fw, horizon);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.32)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(fx + fw * 0.22, horizon - fh);
        ctx.lineTo(fx + fw * 0.78, horizon - fh);
        ctx.stroke();
      }

      const mesas = [
        { x: 0.06, w: 0.20, h: 0.24, arch: false, crystal: true },
        { x: 0.26, w: 0.18, h: 0.20, arch: true, crystal: false },
        { x: 0.62, w: 0.19, h: 0.23, arch: false, crystal: true },
        { x: 0.80, w: 0.21, h: 0.26, arch: true, crystal: false }
      ];
      for (const m of mesas) {
        const mx = m.x * W + bpar * 0.6, mw = m.w * W, mh = m.h * H;
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(mx, horizon);
        ctx.lineTo(mx + mw * 0.10, horizon - mh * 0.65);
        ctx.lineTo(mx + mw * 0.16, horizon - mh);
        ctx.lineTo(mx + mw * 0.58, horizon - mh);
        ctx.lineTo(mx + mw * 0.72, horizon);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.moveTo(mx + mw * 0.58, horizon - mh);
        ctx.lineTo(mx + mw * 0.86, horizon - mh * 0.92);
        ctx.lineTo(mx + mw, horizon);
        ctx.lineTo(mx + mw * 0.72, horizon);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(253, 224, 71, 0.28)';
        ctx.lineWidth = 1.1;
        for (const st of [0.35, 0.68]) {
          const sy = horizon - mh * st;
          ctx.beginPath();
          ctx.moveTo(mx + mw * 0.14 * st, sy);
          ctx.lineTo(mx + mw * 0.66, sy);
          ctx.stroke();
        }

        if (m.arch) {
          ctx.fillStyle = bm.sky2 || '#8c2230';
          ctx.beginPath();
          ctx.arc(mx + mw * 0.45, horizon, mw * 0.16, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
          ctx.stroke();
        }
        if (m.crystal) {
          const cxSpire = mx + mw * 0.36;
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.moveTo(cxSpire - mw * 0.04, horizon - mh);
          ctx.lineTo(cxSpire, horizon - mh * 1.24);
          ctx.lineTo(cxSpire + mw * 0.04, horizon - mh);
          ctx.closePath();
          ctx.fill();
        }
      }

      if (G.quality !== 'low') {
        for (let dv = 0; dv < 2; dv++) {
          const dvX = ((W * (0.20 + dv * 0.54) + Math.sin(G.t * 0.45 + dv * 2.1) * W * 0.06 + bpar * 0.45) % W + W) % W;
          const dvH = H * (0.15 + dv * 0.03);
          for (let seg = 0; seg < 5; seg++) {
            const frac = seg / 5;
            const sy = horizon - frac * dvH;
            const sway = Math.sin(G.t * 4.2 + seg * 1.1 + dv) * (3 + frac * 8);
            const rx = (5 + frac * 16) * (W / 900 + 0.4);
            ctx.fillStyle = 'rgba(245, 158, 11, ' + ((0.16 - frac * 0.025)).toFixed(3) + ')';
            ctx.beginPath();
            ctx.ellipse(dvX + sway, sy - 4, rx, 4.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else if (type === 'bio') {
      // 1) Distant Colossal Alien Tree Canopy Silhouettes
      const fTowers = [
        { x: 0.04, w: 0.20, h: 0.38, crown: 0.48 },
        { x: 0.22, w: 0.24, h: 0.44, crown: 0.52 },
        { x: 0.44, w: 0.22, h: 0.35, crown: 0.46 },
        { x: 0.64, w: 0.26, h: 0.42, crown: 0.50 },
        { x: 0.82, w: 0.22, h: 0.36, crown: 0.48 }
      ];
      for (const t of fTowers) {
        const px = t.x * W + bpar * 0.46, pw = t.w * W, ph = t.h * H;
        const apexX = px + pw * t.crown, apexY = horizon - ph;
        // Deep Shadowed Trunk & Lower Boughs
        ctx.fillStyle = '#021e16';
        ctx.beginPath();
        ctx.moveTo(px, horizon);
        ctx.lineTo(apexX, apexY);
        ctx.lineTo(apexX + pw * 0.06, horizon);
        ctx.closePath();
        ctx.fill();
        // Emerald Foliage Canopy Tier
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.moveTo(apexX, apexY);
        ctx.lineTo(px + pw, horizon);
        ctx.lineTo(apexX + pw * 0.06, horizon);
        ctx.closePath();
        ctx.fill();
        // Bioluminescent Canopy Crest
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.ellipse(apexX, apexY, pw * 0.35, ph * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2) Cascading Bioluminescent Waterfalls with Misty Spore Basins
      const falls = [
        { x: 0.18, fall: 0.20, h: 0.26 },
        { x: 0.72, fall: 0.74, h: 0.28 }
      ];
      for (const fl of falls) {
        const fx = fl.fall * W + bpar * 0.48;
        const fw = Math.max(6, W * 0.015);
        const ch = fl.h * H;
        ctx.fillStyle = '#6ee7b7';
        ctx.fillRect(fx - fw * 0.5, horizon - ch, fw, ch);
        ctx.fillStyle = 'rgba(167, 243, 208, 0.48)';
        ctx.beginPath(); ctx.arc(fx, horizon - 4, fw * 2.8, 0, Math.PI * 2); ctx.fill();
      }

      // 3) Floating Zero-G Fungal Pollen Spheres
      for (let sIdx = 0; sIdx < 3; sIdx++) {
        const sx = W * (0.15 + sIdx * 0.35) + bpar * 0.35;
        const sy = horizon * (0.30 + sIdx * 0.12) + Math.sin(G.t * 1.5 + sIdx * 2.4) * 6;
        const sr = 6 + sIdx * 2;
        ctx.fillStyle = 'rgba(52, 211, 153, 0.42)';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'ice') {
      // 1) Shattered Planetary Ring / Orbital Ice Arch in distant space
      const ringCX = W * 0.52 + bpar * 0.25;
      const ringCY = horizon * 0.78;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = Math.max(2.0, W * 0.007);
      ctx.beginPath();
      ctx.ellipse(ringCX, ringCY, W * 0.62, H * 0.24, -0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.16)';
      ctx.lineWidth = Math.max(1.0, W * 0.003);
      ctx.beginPath();
      ctx.ellipse(ringCX, ringCY, W * 0.66, H * 0.26, -0.22, 0, Math.PI * 2);
      ctx.stroke();

      // 2) Layered Alien Ice Mountain Range with Faceted Sunlight/Shadow Polygons
      const peaks = [
        { x: 0.02, w: 0.22, h: 0.36, split: 0.46 },
        { x: 0.18, w: 0.26, h: 0.42, split: 0.52 },
        { x: 0.38, w: 0.24, h: 0.32, split: 0.44 },
        { x: 0.56, w: 0.28, h: 0.44, split: 0.48 },
        { x: 0.76, w: 0.26, h: 0.38, split: 0.54 }
      ];
      for (const pk of peaks) {
        const px = pk.x * W + bpar * 0.5, pw = pk.w * W, ph = pk.h * H;
        const apexX = px + pw * pk.split, apexY = horizon - ph;
        // Shadowed Facet (Deep Navy)
        ctx.fillStyle = '#041524';
        ctx.beginPath();
        ctx.moveTo(px, horizon);
        ctx.lineTo(apexX, apexY);
        ctx.lineTo(apexX + pw * 0.05, horizon);
        ctx.closePath();
        ctx.fill();
        // Sunlit Crystalline Facet (Azure Ice)
        ctx.fillStyle = '#0c4a6e';
        ctx.beginPath();
        ctx.moveTo(apexX, apexY);
        ctx.lineTo(px + pw, horizon);
        ctx.lineTo(apexX + pw * 0.05, horizon);
        ctx.closePath();
        ctx.fill();
        // Crystalline Summit Specular Highlight
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(apexX - pw * 0.08, apexY + ph * 0.22);
        ctx.lineTo(apexX, apexY);
        ctx.lineTo(apexX + pw * 0.09, apexY + ph * 0.24);
        ctx.closePath();
        ctx.fill();
      }

      // 3) Suspended Zero-G Ice Monoliths drifting in orbit
      for (let mIdx = 0; mIdx < 3; mIdx++) {
        const mx = W * (0.16 + mIdx * 0.34) + bpar * 0.38;
        const my = horizon * (0.32 + mIdx * 0.12) + Math.sin(G.t * 1.4 + mIdx * 2.2) * 6;
        const mw = 12 + mIdx * 4, mh = 22 + mIdx * 6;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
        ctx.beginPath();
        ctx.moveTo(mx, my - mh);
        ctx.lineTo(mx + mw, my);
        ctx.lineTo(mx, my + mh * 0.6);
        ctx.lineTo(mx - mw, my);
        ctx.closePath();
        ctx.fill();
      }
    } else if (type === 'lava' || type === 'volcano') {
      // 1) Distant Jagged Volcanic Caldera Ridge Range
      const vPeaks = [
        { x: 0.02, w: 0.24, h: 0.34, split: 0.46 },
        { x: 0.22, w: 0.28, h: 0.42, split: 0.52 },
        { x: 0.54, w: 0.26, h: 0.36, split: 0.44 },
        { x: 0.76, w: 0.26, h: 0.40, split: 0.50 }
      ];
      for (const pk of vPeaks) {
        const px = pk.x * W + bpar * 0.48, pw = pk.w * W, ph = pk.h * H;
        const apexX = px + pw * pk.split, apexY = horizon - ph;
        // Shadowed Basalt Facet
        ctx.fillStyle = '#140806';
        ctx.beginPath();
        ctx.moveTo(px, horizon);
        ctx.lineTo(apexX, apexY);
        ctx.lineTo(apexX + pw * 0.05, horizon);
        ctx.closePath();
        ctx.fill();
        // Firelit Molten Facet
        ctx.fillStyle = '#2a120c';
        ctx.beginPath();
        ctx.moveTo(apexX, apexY);
        ctx.lineTo(px + pw, horizon);
        ctx.lineTo(apexX + pw * 0.05, horizon);
        ctx.closePath();
        ctx.fill();
        // Glowing Summit Lava Vein
        ctx.strokeStyle = '#ff5500';
        ctx.lineWidth = Math.max(1.2, W * 0.0025);
        ctx.beginPath();
        ctx.moveTo(apexX, apexY);
        ctx.lineTo(apexX + pw * 0.08, apexY + ph * 0.35);
        ctx.stroke();
      }

      // 2) Central Massive Active Stratovolcano with Billowing Smoke Plumes & Molten Caldera
      const vx = cx + W * 0.12 + bpar * 0.42;
      const vw = W * 0.48, vh = H * 0.38;
      const topW = vw * 0.22;
      for (let sm = 0; sm < 5; sm++) {
        const smProg = ((G.t * 0.32 + sm * 0.20) % 1);
        const smX = vx + Math.sin(G.t * 1.4 + sm * 2.1) * (20 + smProg * 50);
        const smY = (horizon - vh) - smProg * H * 0.24;
        const smR = 22 + smProg * 52;
        ctx.fillStyle = smProg < 0.25 ? 'rgba(255, 69, 0, 0.48)' : (smProg < 0.55 ? 'rgba(249, 115, 22, 0.36)' : 'rgba(28, 18, 16, 0.55)');
        ctx.beginPath(); ctx.arc(smX, smY, smR, 0, Math.PI * 2); ctx.fill();
      }
      // Volcano Basalt Mountain Silhouette
      ctx.fillStyle = '#1c100e';
      ctx.beginPath();
      ctx.moveTo(vx - vw * 0.5, horizon);
      ctx.lineTo(vx - topW * 0.5, horizon - vh);
      ctx.lineTo(vx + topW * 0.5, horizon - vh);
      ctx.lineTo(vx + vw * 0.5, horizon);
      ctx.closePath();
      ctx.fill();
      // Molten Caldera Core
      ctx.fillStyle = '#ff4500';
      ctx.beginPath(); ctx.ellipse(vx, horizon - vh, topW * 0.88, topW * 0.30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath(); ctx.ellipse(vx, horizon - vh, topW * 0.55, topW * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      // Flowing Lava Rivers Down Flanks
      ctx.strokeStyle = '#ff4500';
      ctx.lineWidth = Math.max(2.2, W * 0.004);
      for (const dir of [-1, -0.3, 0.3, 1]) {
        ctx.beginPath();
        ctx.moveTo(vx + dir * topW * 0.32, horizon - vh + 2);
        ctx.quadraticCurveTo(vx + dir * vw * 0.18 + Math.sin(G.t * 2.8 + dir) * 8, horizon - vh * 0.45, vx + dir * vw * 0.32, horizon);
        ctx.stroke();
      }
    } else if (type === 'cosmic' || type === 'chrono') {
      // 1) Distant Warped Celestial Moon (eclipsed in deep space)
      const moonX = cx + W * 0.34 + bpar * 0.22;
      const moonY = horizon - H * 0.34;
      const moonR = H * 0.075;
      const mg = ctx.createRadialGradient(moonX - moonR * 0.35, moonY - moonR * 0.35, moonR * 0.1, moonX, moonY, moonR);
      mg.addColorStop(0, '#c084fc');
      mg.addColorStop(0.5, '#581c87');
      mg.addColorStop(1, '#0f0728');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();

      // 2) Distant Gravitational Lensing Warp Arc
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR * 1.5, -0.8, 1.2);
      ctx.stroke();

      // 3) Distant Shattered Asteroid Belt Silhouettes
      ctx.fillStyle = 'rgba(49, 46, 129, 0.85)';
      for (let i = 0; i < 9; i++) {
        const astX = cx + (i - 4) * (W * 0.11) + bpar * 0.45;
        const astY = horizon - H * (0.08 + (i % 3) * 0.05);
        const astR = 4.0 + (i % 4) * 2.2;
        ctx.beginPath();
        ctx.arc(astX, astY, astR, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'tech') {
      // 1) Volumetric Crepuscular Light Shafts (Downward sun rays piercing water column from surface)
      const rayCount = G.quality === 'low' ? 3 : 5;
      for (let r = 0; r < rayCount; r++) {
        const rx = ((r * 180 + G.t * 12 + bpar * 0.4) % (W + 160)) - 80;
        const rw = 40 + (r % 3) * 25;
        const rayDrift = Math.sin(G.t * 0.8 + r) * 20;
        const rayGrad = ctx.createLinearGradient(rx, 0, rx + rayDrift, horizon);
        rayGrad.addColorStop(0, 'rgba(103, 232, 249, 0.18)');
        rayGrad.addColorStop(0.4, 'rgba(45, 212, 191, 0.10)');
        rayGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(rx - rw * 0.3, 0);
        ctx.lineTo(rx + rw * 0.3, 0);
        ctx.lineTo(rx + rw * 1.8 + rayDrift, horizon);
        ctx.lineTo(rx - rw * 0.8 + rayDrift, horizon);
        ctx.closePath();
        ctx.fill();
      }

      // 2) Colossal Distant Submerged Seamount & Trench Ridges (Layered silhouettes)
      const ridges = [
        { yOffset: 0.42, color: 'rgba(2, 18, 36, 0.90)', freq: 0.0035, amp: 28 },
        { yOffset: 0.28, color: 'rgba(4, 32, 58, 0.85)', freq: 0.0055, amp: 22 }
      ];
      for (let rd = 0; rd < ridges.length; rd++) {
        const rInfo = ridges[rd];
        ctx.fillStyle = rInfo.color;
        ctx.beginPath();
        ctx.moveTo(0, horizon);
        for (let x = 0; x <= W; x += 30) {
          const ridgeY = horizon - H * rInfo.yOffset + Math.sin((x + bpar * 0.25) * rInfo.freq + rd * 1.8) * rInfo.amp;
          ctx.lineTo(x, ridgeY);
        }
        ctx.lineTo(W, horizon);
        ctx.closePath();
        ctx.fill();
      }

      // 3) Sunken Ancient Citadel Ruin Silhouette
      const citX = cx - W * 0.24 + bpar * 0.26;
      const citW = W * 0.16, citH = H * 0.22;
      ctx.fillStyle = 'rgba(3, 22, 40, 0.92)';
      ctx.fillRect(citX - citW * 0.5, horizon - citH * 0.75, citW, citH * 0.75);
      // Twin spires
      ctx.fillRect(citX - citW * 0.45, horizon - citH, citW * 0.22, citH * 0.25);
      ctx.fillRect(citX + citW * 0.23, horizon - citH * 0.92, citW * 0.22, citH * 0.17);
      // Glowing ancient portal archway in the sunken fortress
      ctx.fillStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(citX, horizon - citH * 0.18, citW * 0.14, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      // 4) Distant Pelagic Marine Life Silhouettes (Giant Manta Rays)
      const rayCreatures = G.quality === 'low' ? 2 : 4;
      for (let m = 0; m < rayCreatures; m++) {
        const mx = ((G.t * 24 + m * 260 + bpar * 0.3) % (W + 240)) - 120;
        const my = horizon * (0.32 + (m % 3) * 0.14) + Math.sin(G.t * 1.4 + m * 1.5) * 10;
        const wingSpan = 14 + (m % 3) * 4;
        const wingFlap = Math.sin(G.t * 2.8 + m * 1.8) * 3.5;
        ctx.fillStyle = 'rgba(6, 44, 76, 0.78)';
        ctx.beginPath();
        ctx.moveTo(mx, my - 2);
        ctx.lineTo(mx + wingSpan, my + wingFlap);
        ctx.lineTo(mx, my + 4);
        ctx.lineTo(mx - wingSpan, my + wingFlap);
        ctx.closePath();
        ctx.fill();
      }
    } else if (type === 'rift') {
      // 1) Distant Monumental Shattered Celestial Citadel & Arcane Ring
      const ringX = cx + W * 0.16 + bpar * 0.42;
      const ringY = horizon - H * 0.28;
      const ringR = H * 0.18;

      ctx.save();
      // Outer celestial corona halo
      const haloGrad = ctx.createRadialGradient(ringX, ringY, ringR * 0.4, ringX, ringY, ringR * 1.4);
      haloGrad.addColorStop(0, 'rgba(192, 132, 252, 0.35)');
      haloGrad.addColorStop(0.5, 'rgba(244, 114, 182, 0.18)');
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(ringX, ringY, ringR * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Levitating fractured celestial ring
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(ringX, ringY, ringR * 1.6, ringR * 0.45, 0.22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(244, 114, 182, 0.42)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(ringX, ringY, ringR * 1.85, ringR * 0.52, 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 2) Multiple Distant Floating Astral Islands with Stardust Cascades
      const floatIslands = [
        { x: 0.08, w: 0.16, h: 0.14, bob: 0 },
        { x: 0.28, w: 0.12, h: 0.11, bob: 1.8 },
        { x: 0.68, w: 0.20, h: 0.16, bob: 3.2 },
        { x: 0.88, w: 0.14, h: 0.12, bob: 4.5 }
      ];

      for (let i = 0; i < floatIslands.length; i++) {
        const isl = floatIslands[i];
        const ix = isl.x * W + bpar * 0.55;
        const iw = isl.w * W, ih = isl.h * H;
        const iy = horizon - ih * 1.5 + Math.sin(G.t * 1.8 + isl.bob) * 9;

        // Dark astral silhouette of floating island
        ctx.fillStyle = '#1c0331';
        ctx.beginPath();
        ctx.moveTo(ix - iw * 0.5, iy);
        ctx.lineTo(ix + iw * 0.5, iy);
        ctx.lineTo(ix + iw * 0.25, iy + ih);
        ctx.lineTo(ix, iy + ih * 1.35);
        ctx.lineTo(ix - iw * 0.25, iy + ih);
        ctx.closePath();
        ctx.fill();

        // Glowing amethyst upper temple terrace
        ctx.fillStyle = '#3f1163';
        ctx.fillRect(ix - iw * 0.28, iy - ih * 0.35, iw * 0.56, ih * 0.35);

        // Luminous temple spire
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.moveTo(ix - iw * 0.08, iy - ih * 0.35);
        ctx.lineTo(ix, iy - ih * 0.85);
        ctx.lineTo(ix + iw * 0.08, iy - ih * 0.35);
        ctx.closePath();
        ctx.fill();

        // Ether stardust waterfall falling from under the island
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.38)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ix, iy + ih * 1.35);
        ctx.lineTo(ix + Math.sin(G.t * 3.2 + i) * 3, iy + ih * 2.2);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  drawAtmosphereEffects(bm, horizon) {
    const type = bm.props || 'city';
    if (G.quality === 'low') return;
    if (type === 'city' || type === 'grid') {
      ctx.save();
      // 1) Multi-layer depth rain (distant mist layer + midground angled rain + fast outer foreground streaks)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const bgRain = G.quality === 'high' ? 20 : 12;
      for (let i = 0; i < bgRain; i++) {
        const rx = ((i * 73 + G.t * 110) % (W + 60)) - 30;
        const ry = ((i * 47 + G.t * 360) % (horizon * 0.96));
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3.5, ry + 12);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.30)';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      const fgRain = G.quality === 'high' ? 24 : 14;
      for (let i = 0; i < fgRain; i++) {
        const rx = ((i * 107 + G.t * 195) % (W + 80)) - 40;
        const ry = ((i * 61 + G.t * 590) % (H * 0.90));
        // Avoid cluttering directly over the player car center
        if (ry > horizon && Math.abs(rx - cx) < W * 0.14) continue;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 6, ry + 21);
      }
      ctx.stroke();

      // 2) Controlled road & sidewalk raindrop splash ripples
      const splashCount = G.quality === 'high' ? 12 : 6;
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
      ctx.lineWidth = 0.9;
      for (let s = 0; s < splashCount; s++) {
        const phase = ((G.t * 2.8 + s * 0.37) % 1);
        const sy = horizon + 18 + ((s * 53) % Math.max(20, (H - horizon - 55)));
        const sx = ((s * 131 + Math.floor(G.t * 2.8 + s * 0.37) * 89) % W);
        if (Math.abs(sx - cx) < W * 0.12 && sy > H * 0.72) continue;
        const sr = (2.0 + phase * 5.5) * ((sy - horizon) / (H - horizon) + 0.3);
        ctx.globalAlpha = (1 - phase) * 0.55;
        ctx.beginPath();
        ctx.ellipse(sx, sy, sr, sr * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 3) Subtle atmospheric steam wisps near roadside drainage vents
      for (let v = 0; v < 2; v++) {
        const side = v === 0 ? -1 : 1;
        const vProg = ((G.t * 0.45 + v * 0.5) % 1);
        const vx = cx + side * W * (0.24 + vProg * 0.14);
        const vy = horizon + (H - horizon) * (0.18 + vProg * 0.32) - vProg * 18;
        const vr = 14 + vProg * 26;
        ctx.fillStyle = 'rgba(186, 230, 253, ' + ((1 - vProg) * 0.08).toFixed(3) + ')';
        ctx.beginPath();
        ctx.ellipse(vx, vy, vr * 1.4, vr * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (type === 'crystal') {
      ctx.save();
      for (let hw = 0; hw < 3; hw++) {
        const wy = horizon - 6 + hw * 7;
        ctx.strokeStyle = hw === 1 ? 'rgba(253, 224, 71, 0.22)' : 'rgba(245, 158, 11, 0.18)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 36) {
          const yOff = Math.sin(G.t * (5.2 + hw * 0.9) + x * 0.045 + hw * 1.7) * (2.6 + hw * 0.6);
          x === 0 ? ctx.moveTo(x, wy + yOff) : ctx.lineTo(x, wy + yOff);
        }
        ctx.stroke();
      }

      const bgGusts = G.quality === 'high' ? 14 : 8;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.20)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let i = 0; i < bgGusts; i++) {
        const gx = W - (((i * 97 + G.t * 240) % (W + 80)) - 40);
        const gy = ((i * 53 + G.t * 42) % (horizon * 0.94));
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 24, gy + 3);
      }
      ctx.stroke();

      const fgGusts = G.quality === 'high' ? 16 : 9;
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.28)';
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      for (let i = 0; i < fgGusts; i++) {
        const gx = W - (((i * 131 + G.t * 390) % (W + 100)) - 50);
        const gy = ((i * 67 + G.t * 68) % (H * 0.88));
        if (gy > horizon && Math.abs(gx - cx) < W * 0.15) continue;
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 34, gy + 4.5);
      }
      ctx.stroke();
      ctx.restore();
    } else if (type === 'bio') {
      ctx.save();
      // ANIMATION 1: Bioluminescent Canopy Breathing (Living Forest Pulse Waves)
      const breathCount = G.quality === 'low' ? 1 : 2;
      for (let b = 0; b < breathCount; b++) {
        const bPhase = (G.t * 0.75 + b * 1.8);
        const bAlpha = 0.07 + 0.04 * Math.sin(bPhase);
        const bY = horizon * (0.20 + b * 0.18);
        const grad = ctx.createLinearGradient(0, bY - horizon * 0.12, 0, bY + horizon * 0.22);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, `rgba(16, 185, 129, ${bAlpha * 1.8})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, bY - horizon * 0.12, W, horizon * 0.34);
      }

      // ANIMATION 2: Emerald Energy Resonance & Filtered Light Shafts
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const rayCount = G.quality === 'low' ? 2 : 4;
      for (let r = 0; r < rayCount; r++) {
        const rayX = W * (0.16 + r * 0.24) - CAM.x * 8, rayW = W * 0.09;
        const alpha = 0.08 + 0.05 * Math.sin(G.t * 2.0 + r * 1.6);
        const rg = ctx.createLinearGradient(rayX, 0, rayX + W * 0.06, horizon);
        rg.addColorStop(0, `rgba(110, 231, 183, ${alpha * 1.6})`);
        rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(rayX - rayW * 0.4, 0);
        ctx.lineTo(rayX + rayW * 0.6, 0);
        ctx.lineTo(rayX + rayW * 1.4, horizon);
        ctx.lineTo(rayX - rayW * 0.4, horizon);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // ANIMATION 3: Floating Bioluminescent Spores & Pollen Flurries
      const sporeCount = G.quality === 'low' ? 14 : (G.quality === 'medium' ? 26 : 40);
      for (let s = 0; s < sporeCount; s++) {
        const depthFactor = ((s * 19) % 100) / 100; // 0 (far) to 1 (near)
        const riseSpeed = 22 + depthFactor * 55;
        const sx = ((s * 113 + G.t * 14) % (W + 200)) - 100 - CAM.x * (4 + depthFactor * 14);
        const sway = Math.sin(G.t * 2.8 + s * 2.5) * (10 + depthFactor * 20);
        const sy = horizon - ((G.t * riseSpeed + s * 79) % (horizon * 0.95));
        const r = 1.0 + depthFactor * 2.2;
        const alpha = 0.35 + 0.55 * depthFactor;
        ctx.fillStyle = (s % 3 === 0) ? `rgba(167, 243, 208, ${alpha})` : ((s % 3 === 1) ? `rgba(52, 211, 153, ${alpha * 0.9})` : `rgba(110, 231, 183, ${alpha * 0.85})`);
        ctx.beginPath();
        ctx.arc(sx + sway, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (type === 'ice') {
      ctx.save();
      // ANIMATION 1: Polar Aurora Curtains (Borealis Undulating Ribbons in High Orbit)
      const aurCount = G.quality === 'low' ? 1 : 2;
      for (let a = 0; a < aurCount; a++) {
        const aTime = G.t * (0.55 + a * 0.25);
        const yBase = horizon * (0.16 + a * 0.15);
        const amp = horizon * 0.10;
        const y1 = yBase + Math.sin(aTime * 1.2) * amp;
        const y2 = yBase + Math.cos(aTime * 1.5 + 1.2) * amp * 1.2;
        const y3 = yBase + Math.sin(aTime * 1.1 + 2.5) * amp;
        const c1 = a === 0 ? 'rgba(56, 189, 248, 0.18)' : 'rgba(52, 211, 153, 0.14)';
        const c2 = a === 0 ? 'rgba(167, 139, 250, 0.15)' : 'rgba(56, 189, 248, 0.12)';
        const grad = ctx.createLinearGradient(0, yBase - amp * 1.5, 0, yBase + amp * 2.0);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, c1);
        grad.addColorStop(0.8, c2);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.bezierCurveTo(W * 0.32, y1 - amp * 0.8, W * 0.68, y2 + amp * 0.8, W, y3);
        ctx.lineTo(W, y3 + amp * 2.4);
        ctx.bezierCurveTo(W * 0.68, y2 + amp * 2.4, W * 0.32, y1 + amp * 2.0, 0, y1 + amp * 2.2);
        ctx.closePath();
        ctx.fill();
      }

      // ANIMATION 2: Ice Crystal Harmonic Energy Pulses (Rhythmic Concentric Horizon Cryo-Waves)
      if (G.quality !== 'low') {
        const pulseCycle = (G.t * 0.45) % 1.0;
        const pulseR = W * (0.12 + pulseCycle * 0.38);
        const pulseAlpha = (1.0 - pulseCycle) * 0.24;
        const pCX = W * 0.52 - CAM.x * 6;
        const pCY = horizon * 0.72;
        ctx.strokeStyle = `rgba(56, 189, 248, ${pulseAlpha})`;
        ctx.lineWidth = Math.max(1.5, 3.5 * (1.0 - pulseCycle));
        ctx.beginPath();
        ctx.ellipse(pCX, pCY, pulseR, pulseR * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ANIMATION 3: Orbital Micro-Crystals & Zero-G Diamond Dust (Multi-Depth Drifting Fragments)
      const flakeCount = G.quality === 'low' ? 12 : (G.quality === 'medium' ? 24 : 36);
      for (let f = 0; f < flakeCount; f++) {
        const depthFactor = ((f * 17) % 100) / 100; // 0 (far) to 1 (near)
        const speed = 25 + depthFactor * 65;
        const fx = ((G.t * speed + f * 110) % (W + 240)) - 120 - CAM.x * (4 + depthFactor * 14);
        const sway = Math.sin(G.t * 2.5 + f * 3.1) * (12 + depthFactor * 22);
        const fy = ((f * 89 + G.t * 18 * depthFactor) % (horizon * 1.05));
        const r = 1.0 + depthFactor * 2.4;
        const alpha = 0.25 + 0.55 * depthFactor;
        ctx.fillStyle = (f % 3 === 0) ? `rgba(255, 255, 255, ${alpha})` : `rgba(186, 230, 253, ${alpha * 0.85})`;
        ctx.beginPath();
        ctx.arc(fx + sway, fy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (type === 'lava' || type === 'volcano') {
      ctx.save();
      // ANIMATION 1: Erupting Magma Plumes & Geyser Arcs from Caldera Vents
      const plumeCount = G.quality === 'low' ? 1 : 2;
      for (let p = 0; p < plumeCount; p++) {
        const pCycle = ((G.t * 0.55 + p * 0.50) % 1.0);
        const pX = W * (0.22 + p * 0.56) - CAM.x * 6;
        const pMaxH = horizon * 0.55;
        const curH = Math.sin(pCycle * Math.PI) * pMaxH;
        if (curH > 2) {
          const pAlpha = Math.sin(pCycle * Math.PI) * 0.85;
          ctx.strokeStyle = `rgba(255, 69, 0, ${pAlpha})`;
          ctx.lineWidth = Math.max(2.0, 4.5 * (1.0 - pCycle * 0.5));
          ctx.beginPath();
          ctx.moveTo(pX, horizon);
          ctx.quadraticCurveTo(pX + Math.sin(G.t * 3.0 + p) * 14, horizon - curH * 0.85, pX + (p === 0 ? 12 : -12), horizon - curH);
          ctx.stroke();
          // Molten Burst Head
          ctx.fillStyle = `rgba(254, 240, 138, ${pAlpha})`;
          ctx.beginPath();
          ctx.arc(pX + (p === 0 ? 12 : -12), horizon - curH, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ANIMATION 2: Thermal Heat-Haze Shimmer & Convective Magma Breathing Waves
      const waveCount = G.quality === 'low' ? 1 : 2;
      for (let w = 0; w < waveCount; w++) {
        const wPhase = (G.t * 1.6 + w * 2.2);
        const wY = horizon * (0.78 + w * 0.10);
        const wAmp = 4 + w * 2.5;
        ctx.fillStyle = `rgba(249, 115, 22, ${0.08 + 0.04 * Math.sin(wPhase)})`;
        ctx.beginPath();
        ctx.moveTo(0, wY);
        for (let x = 0; x <= W; x += 40) {
          ctx.lineTo(x, wY + Math.sin(wPhase + x * 0.02) * wAmp);
        }
        ctx.lineTo(W, horizon);
        ctx.lineTo(0, horizon);
        ctx.closePath();
        ctx.fill();
      }

      // ANIMATION 3: Rising Pyroclastic Embers & Firefly Ash Spores
      const emberCount = G.quality === 'low' ? 14 : (G.quality === 'medium' ? 26 : 40);
      for (let e = 0; e < emberCount; e++) {
        const depthFactor = ((e * 19) % 100) / 100; // 0 (far) to 1 (near)
        const riseSpeed = 30 + depthFactor * 60;
        const ex = ((e * 117 + G.t * 12) % (W + 200)) - 100 - CAM.x * (4 + depthFactor * 14);
        const sway = Math.sin(G.t * 3.2 + e * 2.7) * (10 + depthFactor * 18);
        const ey = horizon - ((G.t * riseSpeed + e * 83) % (horizon * 0.95));
        const r = 1.0 + depthFactor * 2.2;
        const alpha = 0.35 + 0.60 * depthFactor;
        ctx.fillStyle = (e % 3 === 0) ? `rgba(254, 240, 138, ${alpha})` : ((e % 3 === 1) ? `rgba(255, 69, 0, ${alpha * 0.9})` : `rgba(249, 115, 22, ${alpha * 0.85})`);
        ctx.beginPath();
        ctx.arc(ex + sway, ey, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (type === 'cosmic' || type === 'chrono') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // 1) ANIMATION 1: Spatial Distortion Waves (Expanding concentric quantum shockwaves)
      const singX = cx - W * 0.26 + (CAM.x ? -CAM.x * 6 : 0);
      const singY = horizon * 0.42;
      for (let w = 0; w < 3; w++) {
        const wavePhase = (G.t * 0.45 + w * 0.33) % 1.0;
        const waveR = 25 + wavePhase * (H * 0.55);
        const waveAlpha = (1.0 - wavePhase) * 0.38;
        ctx.strokeStyle = (w % 2 === 0) ? rgba('#00f5ff', waveAlpha) : rgba('#ec4899', waveAlpha);
        ctx.lineWidth = Math.max(1.2, 3.0 * (1.0 - wavePhase));
        ctx.beginPath();
        ctx.arc(singX, singY, waveR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2) ANIMATION 2: Dimensional Fracture Pulses (Breathing cosmic nebula & glowing rift fissures)
      const nebPulse = 0.5 + 0.5 * Math.sin(G.t * 2.8);
      const nebX = cx + W * 0.18 - (CAM.x ? CAM.x * 8 : 0);
      const nebY = horizon * 0.36;
      const nebR = H * 0.40;
      const ng = ctx.createRadialGradient(nebX, nebY, 0, nebX, nebY, nebR);
      ng.addColorStop(0, rgba('#a855f7', 0.24 + 0.14 * nebPulse));
      ng.addColorStop(0.5, rgba('#00f5ff', 0.12 + 0.08 * nebPulse));
      ng.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(nebX, nebY, nebR, 0, Math.PI * 2);
      ctx.fill();

      // 3) ANIMATION 3: Gravitational Orbiting Debris (Depth-aware floating particles orbiting in local zero-g)
      const debrisCount = G.quality === 'low' ? 8 : (G.quality === 'medium' ? 14 : 20);
      for (let d = 0; d < debrisCount; d++) {
        const orbitAngle = G.t * (0.8 + (d % 3) * 0.3) + d * (Math.PI * 2 / debrisCount);
        const orbitRx = (W * 0.22) + (d % 4) * 25;
        const orbitRy = (H * 0.12) + (d % 3) * 15;
        const debX = nebX + Math.cos(orbitAngle) * orbitRx;
        const debY = nebY + Math.sin(orbitAngle) * orbitRy;
        const debZ = 0.5 + 0.5 * Math.sin(orbitAngle);
        const debSize = 1.6 + debZ * 2.4;
        const debCol = (d % 3 === 0) ? '#00f5ff' : ((d % 3 === 1) ? '#ec4899' : '#fef08a');
        ctx.fillStyle = rgba(debCol, 0.45 + 0.45 * debZ);
        ctx.beginPath();
        ctx.arc(debX, debY, debSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    } else if (type === 'tech') {
      ctx.save();

      // Animation A: Caustic Light Waves sweeping through water column
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.16)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const waveStreams = G.quality === 'high' ? 6 : 4;
      for (let w = 0; w < waveStreams; w++) {
        const wx = ((w * 140 + G.t * 28) % (W + 100)) - 50;
        const wy = (horizon * 0.2) + Math.sin(G.t * 1.8 + w * 1.2) * 24;
        ctx.moveTo(wx, wy);
        ctx.bezierCurveTo(wx + 45, wy - 18, wx + 95, wy + 22, wx + 140, wy);
      }
      ctx.stroke();

      // Animation B: Rising Bubble Columns with batched path rendering
      const bubbleCount = G.quality === 'high' ? 24 : 16;
      ctx.fillStyle = 'rgba(153, 246, 228, 0.55)';
      ctx.beginPath();
      for (let b = 0; b < bubbleCount; b++) {
        const speed = 40 + (b % 5) * 16;
        const bubblePhase = ((G.t * speed + b * 48) % horizon);
        const bubbleY = horizon - bubblePhase;
        const wobble = Math.sin(G.t * 3.4 + b * 1.1) * 8;
        const colSpread = (b % 4 === 0) ? -W * 0.32 : ((b % 4 === 1) ? -W * 0.12 : ((b % 4 === 2) ? W * 0.14 : W * 0.34));
        const bubbleX = cx + colSpread + wobble - CAM.x * 6;
        const rad = 1.4 + (b % 4) * 0.9;
        ctx.moveTo(bubbleX + rad, bubbleY);
        ctx.arc(bubbleX, bubbleY, rad, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      for (let b = 0; b < bubbleCount; b++) {
        const speed = 40 + (b % 5) * 16;
        const bubblePhase = ((G.t * speed + b * 48) % horizon);
        const bubbleY = horizon - bubblePhase;
        const wobble = Math.sin(G.t * 3.4 + b * 1.1) * 8;
        const colSpread = (b % 4 === 0) ? -W * 0.32 : ((b % 4 === 1) ? -W * 0.12 : ((b % 4 === 2) ? W * 0.14 : W * 0.34));
        const bubbleX = cx + colSpread + wobble - CAM.x * 6;
        const rad = 1.4 + (b % 4) * 0.9;
        const hx = bubbleX - rad * 0.35, hy = bubbleY - rad * 0.35, hr = rad * 0.35;
        ctx.moveTo(hx + hr, hy);
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      }
      ctx.fill();

      // Animation C: Bioluminescent Pulse Network in deep ocean water
      const pulseNodes = G.quality === 'high' ? 10 : 6;
      for (let p = 0; p < pulseNodes; p++) {
        const px = ((p * 95 + G.t * 14) % (W + 60)) - 30;
        const py = horizon * (0.42 + (p % 4) * 0.13) + Math.sin(G.t * 2.0 + p) * 6;
        const pulse = 0.5 + 0.5 * Math.sin(G.t * 3.6 + p * 1.4);
        const col = (p % 3 === 0) ? '#2dd4bf' : ((p % 3 === 1) ? '#00f0ff' : '#c084fc');
        ctx.fillStyle = rgba(col, (0.35 + 0.45 * pulse) * 0.7);
        ctx.beginPath();
        ctx.arc(px, py, 2.2 + pulse * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    } else if (type === 'rift') {
      ctx.save();
      // ANIMATION 1: Levitation Field (Gentle vertical bobbing of astral energy conduits)
      const fieldCount = G.quality === 'high' ? 5 : 3;
      for (let f = 0; f < fieldCount; f++) {
        const fx = W * (0.12 + f * 0.19) - CAM.x * 4;
        const fy = horizon * (0.22 + Math.sin(G.t * 1.6 + f * 1.7) * 0.06);
        const fLen = horizon * 0.38;
        const fPulse = 0.08 + 0.07 * Math.sin(G.t * 2.4 + f * 2.1);

        const fg = ctx.createLinearGradient(fx, fy - fLen, fx, fy + fLen);
        fg.addColorStop(0, 'rgba(192, 132, 252, 0)');
        fg.addColorStop(0.5, 'rgba(244, 114, 182, ' + fPulse + ')');
        fg.addColorStop(1, 'rgba(192, 132, 252, 0)');

        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 4 + f * 2, fLen, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // ANIMATION 2: Arcane Rune Circulation (Horizontally drifting ley-line streams)
      const streamCount = G.quality === 'high' ? 4 : 2;
      for (let s = 0; s < streamCount; s++) {
        const sy = horizon * (0.18 + s * 0.22 + Math.sin(G.t * 1.4 + s) * 0.04);
        const sPhase = (G.t * 35 + s * 140) % (W + 200) - 100;
        ctx.strokeStyle = s % 2 === 0 ? 'rgba(192, 132, 252, 0.32)' : 'rgba(244, 114, 182, 0.28)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sPhase - 40, sy);
        ctx.quadraticCurveTo(sPhase, sy + Math.sin(G.t * 4 + s) * 12, sPhase + 40, sy);
        ctx.stroke();
      }

      // ANIMATION 3: Astral Rift Particles (Ascending mana motes curving gently into the ether)
      const moteCount = G.quality === 'high' ? 18 : 10;
      for (let p = 0; p < moteCount; p++) {
        const seed = p * 47.3;
        const speed = 24 + (p % 5) * 8;
        const px = (seed * 19 + Math.sin(G.t * 1.2 + seed) * 45 - CAM.x * 6) % (W + 80) - 40;
        const py = ((horizon * 1.1) - ((G.t * speed + seed * 23) % (horizon * 1.2))) + horizon * 0.05;
        const pRad = 1.2 + (p % 4) * 0.55;
        const pAlpha = 0.35 + 0.35 * Math.sin(G.t * 3.8 + seed);

        ctx.fillStyle = p % 2 === 0 ? 'rgba(245, 208, 254, ' + pAlpha + ')' : 'rgba(244, 114, 182, ' + pAlpha + ')';
        ctx.beginPath();
        ctx.arc(px, py, pRad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  drawPortal3DRing(o, col1, col2, aperture, prox) {
    if (o.z > 70 || o.z < 0.4) return;
    const ringMesh = this.models.quantumPortalRing(col1, col2);
    if (!ringMesh) return;
    const rotZ = G.t * (3.5 + prox * 2.0);
    const faces = facesOf(ringMesh, [o.x, 0, o.z], rotZ, 1.0);
    faces.sort((a, b) => b.z - a.z);
    const alpha = Math.max(0.25, 1.0 - aperture * 0.7);
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < faces.length; i++) drawFace(faces[i]);
    ctx.restore();
  }
};

/* --------------------------- GARAJ: 30 СПОРТКАРОВ ---------------------------
   cost = 🪙 монеты, pcost = ⭐ очки, lvl = уровень аккаунта.
   30 уникальных спорткаров с индивидуальными улучшениями и перками. */
const PERKS = {
  steady:      { ic: '🌱', name: 'Плавный старт', desc: 'Скорость растёт на 30% плавнее — проще маневрировать' },
  drain:       { ic: '⚡', name: 'Экономное нитро', desc: 'Энергия расходуется на 45% медленнее' },
  score:       { ic: '🏆', name: 'Рекордсмен', desc: 'На 28% больше очков за каждый метр дистанции' },
  coin:        { ic: '🪙', name: 'Золотая жила', desc: 'Каждая монета приносит дополнительную ценность' },
  magnetup:    { ic: '🧲', name: 'Долгий магнит', desc: 'Магнит работает на 6 секунд дольше' },
  turbo:       { ic: '🚀', name: 'Турбодвигатель', desc: 'Выше базовая скорость и мощнее импульс нитро' },
  armor:       { ic: '❤', name: 'Броня', desc: 'Начинайте гонку с дополнительной жизнью' },
  luck:        { ic: '🍀', name: 'Удача', desc: 'На трассе значительно чаще появляются бонусы' },
  combo:       { ic: '🔥', name: 'Мастер комбо', desc: 'Комбо угасает на 50% медленнее' },
  smash:       { ic: '💥', name: 'Мощный бампер', desc: 'Тараньте препятствия на нитро и получайте +250 очков' },
  brakes:      { ic: '🛑', name: 'Точный поворот', desc: 'Быстрее перестраивайтесь между полосами' },
  sregen:      { ic: '♻', name: 'Восстановление щита', desc: 'Щит автоматически восстанавливается после окончания' },
  djump:       { ic: '🦘', name: 'Двойной прыжок', desc: 'Возможность совершить второй прыжок в воздухе' },
  revive:      { ic: '🚑', name: 'Второй шанс', desc: 'Один раз воскресните бесплатно после потери всех жизней' },
  ghost:       { ic: '👻', name: 'Призрак', desc: 'Шанс проскочить сквозь препятствие без повреждений' },
  slipstream:  { ic: '💨', name: 'Слипстрим', desc: 'Ускорение на 20% выше при следовании по центральной полосе' },
  overdrive:   { ic: '⚡', name: 'Овердрайв', desc: 'Взрывной старт с повышенным запасом энергии' },
  aero:        { ic: '✈', name: 'Аэродинамика', desc: 'Прижимная сила: идеальный контроль на высокой скорости' },
  shockwave:   { ic: '🌊', name: 'Ударная волна', desc: 'Щит притягивает ближайшие монеты к машине' },
  goldrush:    { ic: '👑', name: 'Золотая лихорадка', desc: 'Монеты временно ускоряют перезарядку нитро' },
  warp:        { ic: '🌀', name: 'Варп-мастер', desc: 'Двойные очки в специальных измерениях' },
  collector:   { ic: '🧲', name: 'Коллекционер', desc: 'Магнит притягивает кристаллы и бонусы издалека' },
  boostmaster: { ic: '🔥', name: 'Мастер форсажа', desc: 'Нитро расходуется значительно экономнее' },
  titan:       { ic: '🛡', name: 'Титановый бампер', desc: 'Бронированный корпус снижает силу ударов' },
  photon:      { ic: '💡', name: 'Фотонный луч', desc: 'Опасные зоны подсвечиваются на большем расстоянии' },
  energy:      { ic: '🔋', name: 'Энергогенератор', desc: 'Пассивная регенерация энергии в ходе гонки' },
  hyperdrive:  { ic: '🚀', name: 'Гипердрайв', desc: 'Сверхвысокая предельная скорость на максимальных оборотах' },
  driftking:   { ic: '🏎', name: 'Король дрифта', desc: 'Мгновенное перестроение между полосами' },
  specter:     { ic: '👻', name: 'Спектральный щит', desc: 'При потере жизни даётся 3 секунды неуязвимости' },
  apex:        { ic: '👑', name: 'Апекс-мастер', desc: 'Максимальный множитель очков на рекордных скоростях' }
};
const PERK_KEYS = Object.keys(PERKS);

const CARS = [
  // 1. SHADOW (Редкая, УР. 1)
  { id: 0, name: 'SHADOW', rarity: 'rare', cost: 0, pcost: 0, lvl: 1, shape: 'sport',
    body: '#18112e', roof: '#090614', glass: '#a5b4fc', acc: '#00e5ff',
    stripe: 1, stripeColor: '#00e5ff', underglow: '#00e5ff', cyberFin: true, wing: 4, splitter: 1, headlights: 'laser',
    boost: 1.25, shieldStart: 0, magnet: 1.15, tag: 'Кибер-стелс: теневой карбон и неоновый лазер', perk: 'steady' },

  // 2. VOLT (Редкая, УР. 2)
  { id: 1, name: 'VOLT', rarity: 'rare', cost: 450, pcost: 90, lvl: 2, shape: 'sport',
    body: '#00e5ff', roof: '#041f33', glass: '#dff6ff', acc: '#38bdf8',
    stripe: 2, stripeColor: '#ffffff', underglow: '#00e5ff', canards: 1, wing: 2, headlights: 'quad',
    boost: 1.45, shieldStart: 0, magnet: 1.25, tag: 'Электрический форсаж и плазменные контуры', perk: 'drain' },

  // 3. PHANTOM (Редкая, УР. 3)
  { id: 2, name: 'PHANTOM', rarity: 'rare', cost: 900, pcost: 180, lvl: 3, shape: 'muscle',
    body: '#a855f7', roof: '#24083b', glass: '#f3e8ff', acc: '#e879f9',
    blower: 1, widebody: 1, underglow: '#c084fc', sideExhaust: 1, wing: 1, splitter: 1,
    boost: 1.40, shieldStart: 6, magnet: 1.40, tag: 'Призрачный фиолетовый неон и аэродинамика', perk: 'score' },

  // 4. RAZOR (Редкая, УР. 4)
  { id: 3, name: 'RAZOR', rarity: 'rare', cost: 1400, pcost: 280, lvl: 4, shape: 'sport',
    body: '#10b981', roof: '#022617', glass: '#d1fae5', acc: '#34d399', sign: 0, rails: 0,
    stripe: 1, stripeColor: '#6ee7b7', underglow: '#10b981', widebody: 1, wing: 4, splitter: 2,
    boost: 1.42, shieldStart: 4, magnet: 1.55, tag: 'Изумрудное лезвие: сверхточный аэродинамический профиль', perk: 'coin' },

  // 5. COBRA (Редкая, УР. 5)
  { id: 4, name: 'COBRA', rarity: 'rare', cost: 1800, pcost: 360, lvl: 5, shape: 'sport',
    body: '#ef4444', roof: '#380707', glass: '#fee2e2', acc: '#f97316',
    stripe: 2, stripeColor: '#facc15', underglow: '#ff2b43', wing: 2, canards: 1,
    boost: 1.46, shieldStart: 8, magnet: 1.45, tag: 'Хищный алый корпус с форсированным нитро', perk: 'energy' },

  // 6. NOVA (Редкая, УР. 6)
  { id: 5, name: 'NOVA', rarity: 'rare', cost: 2400, pcost: 480, lvl: 6, shape: 'sport',
    body: '#38bdf8', roof: '#082f49', glass: '#e0f2fe', acc: '#00e5ff',
    roofScoop: 1, canards: 1, underglow: '#38bdf8', wing: 2, splitter: 2, headlights: 'laser',
    boost: 1.48, shieldStart: 8, magnet: 1.70, tag: 'Сверхновая звезда: ледяной поток и квантовая скорость', perk: 'magnetup' },

  // 7. ZENITH (Редкая, УР. 7)
  { id: 6, name: 'ZENITH', rarity: 'rare', cost: 3000, pcost: 600, lvl: 7, shape: 'sport',
    body: '#2563eb', roof: '#0d1d45', glass: '#dbeafe', acc: '#60a5fa',
    stripe: 1, stripeColor: '#93c5fd', underglow: '#3b82f6', wing: 3, diffuser: 2, headlights: 'laser',
    boost: 1.55, shieldStart: 6, magnet: 1.60, tag: 'Абсолютный зенит: королевский синий и титан', perk: 'photon' },

  // 8. TITAN (Редкая, УР. 8)
  { id: 7, name: 'TITAN', rarity: 'rare', cost: 3800, pcost: 760, lvl: 8, shape: 'racer',
    body: '#64748b', roof: '#0f172a', glass: '#f1f5f9', acc: '#00e5ff',
    nose: 1, wing: 3, cyberFin: true, underglow: '#38bdf8', stripe: 2, stripeColor: '#00e5ff',
    boost: 1.90, shieldStart: 2, magnet: 1.35, tag: 'Титановый монокок со сверхзвуковым ускорением', perk: 'turbo' },

  // 9. AURORA (Эпическая, УР. 9)
  { id: 8, name: 'AURORA', rarity: 'epic', cost: 4600, pcost: 920, lvl: 9, shape: 'drift',
    body: '#06b6d4', roof: '#083344', glass: '#cffafe', acc: '#2dd4bf',
    wing: 4, canards: 1, underglow: '#06b6d4', sideExhaust: 1, splitter: 2,
    boost: 1.62, shieldStart: 4, magnet: 1.50, tag: 'Полярное сияние: градиент северного ветра', perk: 'driftking' },

  // 10. DRIFT (Эпическая, УР. 10)
  { id: 9, name: 'DRIFT', rarity: 'epic', cost: 5500, pcost: 1100, lvl: 10, shape: 'muscle',
    body: '#d946ef', roof: '#3b0736', glass: '#fae8ff', acc: '#f43f5e', rails: 0,
    widebody: 1, blower: 1, underglow: '#ff2fb9', diffuser: 2, wing: 4,
    boost: 1.35, shieldStart: 18, magnet: 1.45, tag: 'Мастер неонового заноса и дымных виражей', perk: 'armor' },

  // 11. VORTEX (Эпическая, УР. 12)
  { id: 10, name: 'VORTEX', rarity: 'epic', cost: 7000, pcost: 1400, lvl: 12, shape: 'sport',
    body: '#1e3a8a', roof: '#090d18', glass: '#bfdbfe', acc: '#00e5ff', bar: 1,
    stripe: 1, stripeColor: '#00e5ff', underglow: '#00e5ff', canards: 1, wing: 2, headlights: 'laser',
    boost: 1.65, shieldStart: 12, magnet: 1.80, tag: 'Гравитационный вихрь: сингулярность ночной трассы', perk: 'luck' },

  // 12. PULSE (Эпическая, УР. 13)
  { id: 11, name: 'PULSE', rarity: 'epic', cost: 8200, pcost: 1640, lvl: 13, shape: 'coupe',
    body: '#14b8a6', roof: '#042f2e', glass: '#ccfbf1', acc: '#a3e635',
    underglow: '#14b8a6', diffuser: 2, splitter: 1, wing: 4, headlights: 'laser',
    boost: 1.68, shieldStart: 12, magnet: 1.60, tag: 'Импульсный био-кибернетический гиперкар', perk: 'slipstream' },

  // 13. INFERNO (Эпическая, УР. 14)
  { id: 12, name: 'INFERNO', rarity: 'epic', cost: 9500, pcost: 1900, lvl: 14, shape: 'muscle',
    body: '#ea580c', roof: '#330d00', glass: '#ffedd5', acc: '#facc15',
    blower: 2, widebody: 1, sideExhaust: 1, underglow: '#ff5500', wing: 4, splitter: 2,
    boost: 1.80, shieldStart: 14, magnet: 2.05, tag: 'Пламя преисподней: магматический форсаж', perk: 'combo' },

  // 14. STORM (Эпическая, УР. 15)
  { id: 13, name: 'STORM', rarity: 'epic', cost: 11000, pcost: 2200, lvl: 15, shape: 'rally',
    body: '#1d4ed8', roof: '#0b1638', glass: '#dbeafe', acc: '#fbbf24',
    widebody: 1, rails: 1, underglow: '#3b82f6', wing: 2, headlights: 'quad',
    boost: 1.72, shieldStart: 14, magnet: 1.75, tag: 'Грозовой шторм: полноприводная стихия', perk: 'titan' },

  // 15. ECLIPSE (Эпическая, УР. 16)
  { id: 14, name: 'ECLIPSE', rarity: 'epic', cost: 13000, pcost: 2600, lvl: 16, shape: 'hyper',
    body: '#d97706', roof: '#1c0f00', glass: '#fef3c7', acc: '#fde047',
    roofScoop: 1, canards: 1, wing: 5, underglow: '#ffd166', stripe: 1, stripeColor: '#fde047',
    boost: 1.70, shieldStart: 12, magnet: 1.65, tag: 'Солнечное затмение: золотой венец короны', perk: 'smash' },

  // 16. ORBIT (Эпическая, УР. 18)
  { id: 15, name: 'ORBIT', rarity: 'epic', cost: 15500, pcost: 3100, lvl: 18, shape: 'racer',
    body: '#4f46e5', roof: '#131038', glass: '#e0e7ff', acc: '#00f5ff',
    nose: 1, wing: 3, underglow: '#6366f1', splitter: 2, cyberFin: true,
    boost: 1.95, shieldStart: 6, magnet: 1.45, tag: 'Орбитальная траектория: квантовый монокок', perk: 'brakes' },

  // 17. HUNTER (Мифическая, УР. 19)
  { id: 16, name: 'HUNTER', rarity: 'mythic', cost: 17500, pcost: 3500, lvl: 19, shape: 'speedster',
    body: '#1e293b', roof: '#020617', glass: '#94a3b8', acc: '#00e5ff',
    roofScoop: 1, cyberFin: true, underglow: '#00e5ff', wing: 2, headlights: 'laser',
    boost: 1.85, shieldStart: 10, magnet: 1.80, tag: 'Ночной охотник: скрытный перехватчик трассы', perk: 'goldrush' },

  // 18. FROST (Мифическая, УР. 20)
  { id: 17, name: 'FROST', rarity: 'mythic', cost: 19500, pcost: 3900, lvl: 20, shape: 'muscle',
    body: '#e0f2fe', roof: '#0c233c', glass: '#ffffff', acc: '#38bdf8', scoop: 1,
    blower: 1, widebody: 1, underglow: '#38bdf8', wing: 2, sideExhaust: 1, diffuser: 2,
    boost: 1.75, shieldStart: 20, magnet: 1.70, tag: 'Абсолютный ноль: вечная мерзлота', perk: 'sregen' },

  // 19. VENOM (Мифическая, УР. 21)
  { id: 18, name: 'VENOM', rarity: 'mythic', cost: 21500, pcost: 4300, lvl: 21, shape: 'muscle',
    body: '#701a75', roof: '#1a021c', glass: '#fce7f3', acc: '#ec4899',
    blower: 1, canards: 1, wing: 5, underglow: '#d946ef', sideExhaust: 1,
    boost: 1.88, shieldStart: 16, magnet: 1.90, tag: 'Токсичный яд: агрессивный фиолетовый штурмовик', perk: 'overdrive' },

  // 20. CELESTIAL (Мифическая, УР. 22)
  { id: 19, name: 'CELESTIAL', rarity: 'mythic', cost: 24000, pcost: 4800, lvl: 22, shape: 'hyper',
    body: '#3730a3', roof: '#0e0b30', glass: '#e0e7ff', acc: '#38bdf8',
    wing: 5, canards: 1, roofScoop: 1, underglow: '#818cf8', splitter: 2,
    boost: 1.90, shieldStart: 10, magnet: 1.85, tag: 'Небесный странник: звёздный гиперкар', perk: 'djump' },

  // 21. HORIZON (Мифическая, УР. 23)
  { id: 20, name: 'HORIZON', rarity: 'mythic', cost: 26500, pcost: 5300, lvl: 23, shape: 'speedster',
    body: '#b45309', roof: '#261000', glass: '#fef3c7', acc: '#f59e0b',
    nose: 1, cyberFin: true, underglow: '#f59e0b', splitter: 2, wing: 3,
    boost: 1.98, shieldStart: 8, magnet: 1.70, tag: 'Линия горизонта: аэродинамический закат', perk: 'aero' },

  // 22. WRAITH (Мифическая, УР. 24)
  { id: 21, name: 'WRAITH', rarity: 'mythic', cost: 29000, pcost: 5800, lvl: 24, shape: 'sport',
    body: '#3b0764', roof: '#0a0112', glass: '#f3e8ff', acc: '#a855f7',
    widebody: 1, stripe: 2, stripeColor: '#c084fc', underglow: '#9333ea', wing: 2, cyberFin: true,
    boost: 1.75, shieldStart: 24, magnet: 2.20, tag: 'Призрак пустоты: тёмная материя', perk: 'revive' },

  // 23. ATOM (Мифическая, УР. 25)
  { id: 22, name: 'ATOM', rarity: 'mythic', cost: 31500, pcost: 6300, lvl: 25, shape: 'muscle',
    body: '#0284c7', roof: '#041a2e', glass: '#e0f2fe', acc: '#38bdf8',
    blower: 2, widebody: 1, underglow: '#00e5ff', sideExhaust: 1, diffuser: 2, wing: 4,
    boost: 1.92, shieldStart: 22, magnet: 2.10, tag: 'Атомный синтез: чистая квантовая энергия', perk: 'shockwave' },

  // 24. BLAZE (Мифическая, УР. 26)
  { id: 23, name: 'BLAZE', rarity: 'mythic', cost: 35000, pcost: 7000, lvl: 26, shape: 'hyper',
    body: '#dc2626', roof: '#310505', glass: '#fee2e2', acc: '#f97316',
    wing: 3, nose: 1, stripe: 1, stripeColor: '#facc15', underglow: '#ef4444', roofScoop: 1, diffuser: 2, splitter: 2,
    boost: 2.25, shieldStart: 16, magnet: 2.00, tag: 'Солнечная вспышка: термоядерный болид', perk: 'ghost' },

  // 25. SHARK (Легендарная, УР. 27)
  { id: 24, name: 'SHARK', rarity: 'legendary', cost: 34000, pcost: 6800, lvl: 27, shape: 'hyper',
    body: '#0284c7', roof: '#032036', glass: '#e0f2fe', acc: '#06b6d4',
    roofScoop: 1, canards: 1, wing: 5, underglow: '#00f5ff', cyberFin: true, stripe: 1, stripeColor: '#06b6d4',
    boost: 2.05, shieldStart: 14, magnet: 2.00, tag: 'Глубоководный хищник: аэродинамический плавник', perk: 'boostmaster' },

  // 26. LEGEND (Легендарная, УР. 28)
  { id: 25, name: 'LEGEND', rarity: 'legendary', cost: 37000, pcost: 7400, lvl: 28, shape: 'speedster',
    body: '#eab308', roof: '#261c00', glass: '#fef9c3', acc: '#ffffff',
    splitter: 2, underglow: '#facc15', wing: 2, cyberFin: true, headlights: 'laser',
    boost: 2.08, shieldStart: 12, magnet: 1.95, tag: 'Золотая легенда: непобедимый чемпион', perk: 'collector' },

  // 27. PHOENIX (Легендарная, УР. 29)
  { id: 26, name: 'PHOENIX', rarity: 'legendary', cost: 41000, pcost: 8200, lvl: 29, shape: 'racer',
    body: '#be185d', roof: '#330417', glass: '#fce7f3', acc: '#fb7185',
    nose: 1, wing: 3, sideExhaust: 1, underglow: '#ec4899', diffuser: 2, splitter: 2,
    boost: 2.30, shieldStart: 18, magnet: 2.15, tag: 'Возрождённый феникс: пламя сверхновой', perk: 'warp' },

  // 28. VALKYRIE (Легендарная, УР. 29)
  { id: 27, name: 'VALKYRIE', rarity: 'legendary', cost: 45000, pcost: 9000, lvl: 29, shape: 'hyper',
    body: '#7c3aed', roof: '#1e0a47', glass: '#ede9fe', acc: '#00e5ff',
    roofScoop: 1, wing: 5, canards: 1, underglow: '#a855f7', cyberFin: true, diffuser: 2,
    boost: 2.35, shieldStart: 20, magnet: 2.25, tag: 'Боевая валькирия: аэродинамический монокок', perk: 'hyperdrive' },

  // 29. CHRONO (Легендарная, УР. 30)
  { id: 28, name: 'CHRONO', rarity: 'legendary', cost: 49000, pcost: 9800, lvl: 30, shape: 'muscle',
    body: '#475569', roof: '#0f172a', glass: '#f1f5f9', acc: '#38bdf8',
    blower: 2, widebody: 1, underglow: '#38bdf8', wing: 4, rails: 1, diffuser: 2,
    boost: 2.20, shieldStart: 26, magnet: 2.30, tag: 'Хроно-монолит: искажение пространства и времени', perk: 'specter' },

  // 30. OMEGA (Легендарная, УР. 30)
  { id: 29, name: 'OMEGA', rarity: 'legendary', cost: 55000, pcost: 11000, lvl: 30, shape: 'hyper',
    body: '#f59e0b', roof: '#172554', glass: '#ffffff', acc: '#ec4899',
    nose: 1, wing: 5, roofScoop: 1, underglow: '#f59e0b', stripe: 2, stripeColor: '#ec4899', diffuser: 2, splitter: 2,
    boost: 2.45, shieldStart: 22, magnet: 2.40, tag: 'Вершина эволюции 2099: абсолютный прототип', perk: 'apex' }
];

/* --------------------------- ИНДИВИДУАЛЬНЫЕ УЛУЧШЕНИЯ МАШИН ---------------------------
   Каждая машина прокачивается отдельно от других.
   Улучшения: скорость, разгон, нитро, магнит, щит, управляемость. */
const UPG_DEFS = {
  speed: {
    name: 'Макс. скорость',
    ic: '⚡',
    desc: 'Повышает базовую и предельную скорость машины (от 120 до 400 км/ч)',
    unit: 'км/ч',
    val: (c, lvl) => Math.min(400, Math.round(120 + (c.boost - 1) * 96 + lvl * 28)),
    effect: '+28 км/ч'
  },
  accel: {
    name: 'Ускорение',
    ic: '🚀',
    desc: 'Увеличивает динамику разгона и отклик на ускорение (+15% за ур.)',
    unit: '%',
    val: (c, lvl) => Math.round(100 + lvl * 15),
    effect: '+15%'
  },
  nitro: {
    name: 'Мощность нитро',
    ic: '🔥',
    desc: 'Усиливает множитель форсажа и импульс ускорения (+0.15x)',
    unit: 'x',
    val: (c, lvl) => (c.boost + lvl * 0.15).toFixed(2),
    effect: '+0.15x'
  },
  nitroDuration: {
    name: 'Длительность нитро',
    ic: '⏱',
    desc: 'Снижает расход энергии нитро на 18% за уровень',
    unit: '%',
    val: (c, lvl) => Math.round(100 + lvl * 18),
    effect: '+18%'
  },
  magnet: {
    name: 'Радиус магнита',
    ic: '🧲',
    desc: 'Расширяет радиус притяжения монет и продлевает время действия (+1.5 с)',
    unit: 'с',
    val: (c, lvl) => (5 * c.magnet + lvl * 1.5).toFixed(1),
    effect: '+1.5 с'
  },
  shield: {
    name: 'Энергощит',
    ic: '🛡',
    desc: 'Увеличивает стартовую длительность щита и поглощение урона (+3 с)',
    unit: 'с',
    val: (c, lvl) => (carStartingShield(c) + lvl * 3).toFixed(0),
    effect: '+3 с'
  },
  handling: {
    name: 'Управляемость',
    ic: '🏎',
    desc: 'Ускоряет перестроение между полосами и улучшает отклик (+15%)',
    unit: '%',
    val: (c, lvl) => Math.round(100 + lvl * 15),
    effect: '+15%'
  },
  drift: {
    name: 'Контроль дрифта',
    ic: '🌀',
    desc: 'Увеличивает устойчивость в заносе и множитель очков за дрифт (+20%)',
    unit: '%',
    val: (c, lvl) => Math.round(100 + lvl * 20),
    effect: '+20%'
  }
};
const UPG_KEYS = Object.keys(UPG_DEFS);

const CAR_UPG = {
  get(carId) {
    const def = { speed: 0, accel: 0, nitro: 0, nitroDuration: 0, magnet: 0, shield: 0, handling: 0, drift: 0 };
    const raw = store.get('car_upg_' + carId, def);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return def;
    const validated = Object.assign({}, def);
    for (const k in def) {
      const val = Number(raw[k]);
      validated[k] = (!isNaN(val) && isFinite(val)) ? Math.max(0, Math.min(5, Math.floor(val))) : 0;
    }
    return validated;
  },
  set(carId, data) {
    store.set('car_upg_' + carId, data);
  },
  lvl(carId, key) {
    const u = this.get(carId);
    return (u && u[key] | 0) || 0;
  },
  cost(car, key, curLvl) {
    if (curLvl === undefined) curLvl = this.lvl(car.id, key);
    const base = 120 + curLvl * 90;
    const tierMul = car.rarity === 'legendary' ? 2.0 : (car.rarity === 'mythic' ? 1.6 : (car.rarity === 'epic' ? 1.3 : 1.0));
    return Math.round(base * tierMul);
  },
  ptCost(car, key, curLvl) {
    return Math.round(this.cost(car, key, curLvl) / 5);
  },
  can(car, key, usePts) {
    const curLvl = this.lvl(car.id, key);
    if (curLvl >= 5) return 'max';
    if (!ownedOf(car)) return 'not_owned';
    const c = usePts ? this.ptCost(car, key, curLvl) : this.cost(car, key, curLvl);
    if (usePts) {
      if (ACCT.pts < c) return 'no_pts';
    } else {
      if (G.coins < c) return 'no_coins';
    }
    return 'ok';
  },
  upgrade(car, key, usePts) {
    const st = this.can(car, key, usePts);
    if (st === 'max') { toast('Достигнут максимальный уровень улучшения (5/5)!'); return false; }
    if (st === 'not_owned') { toast('Сначала откройте эту машину в гараже!'); Sound.blip(200, .12, 'sawtooth', .18); return false; }
    const curLvl = this.lvl(car.id, key);
    const c = usePts ? this.ptCost(car, key, curLvl) : this.cost(car, key, curLvl);
    if (st === 'no_pts') { toast('Не хватает ' + (c - ACCT.pts) + ' ⭐ очков!'); Sound.blip(200, .12, 'sawtooth', .18); return false; }
    if (st === 'no_coins') { toast('Не хватает ' + (c - G.coins) + ' 🪙 монет!'); Sound.blip(200, .12, 'sawtooth', .18); return false; }

    if (usePts) ACCT.pts -= c;
    else G.coins -= c;
    bankCoins(); ACCT.save();

    const u = this.get(car.id);
    u[key] = curLvl + 1;
    this.set(car.id, u);

    Sound.chord([523, 659, 784, 1046], .35, .2);
    toast('⚡ ' + car.name + ': ' + UPG_DEFS[key].name + ' улучшено до ур. ' + (curLvl + 1) + '/5!');
    G.meta.upgradesPurchased = (G.meta.upgradesPurchased || 0) + 1;
    store.set('meta', G.meta);
    return true;
  }
};

const CAR_TUNING = {
  get(carId) {
    const def = {
      wing: null, splitter: null, stripe: null, stripeColor: null,
      rimColor: null, underglow: null, cyberFin: null, widebody: null
    };
    const raw = store.get('car_tune_' + carId, def);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return def;
    const validated = Object.assign({}, def);
    for (const k in def) { if (k in raw) validated[k] = raw[k]; }
    return validated;
  },
  set(carId, data) {
    store.set('car_tune_' + carId, data);
  },
  apply(c) {
    const tune = this.get(c.id);
    const p = palOf(c);
    const merged = Object.assign({}, c);
    if (tune.stripe !== null && tune.stripe !== undefined) merged.stripe = tune.stripe;
    if (tune.stripeColor) merged.stripeColor = tune.stripeColor;
    if (tune.rimColor !== undefined) merged.rimColor = tune.rimColor;
    if (tune.underglow !== undefined) merged.underglow = tune.underglow;
    if (tune.wing !== null && tune.wing !== undefined) merged.wing = tune.wing;
    if (tune.splitter !== null && tune.splitter !== undefined) merged.splitter = tune.splitter;
    if (tune.cyberFin !== null && tune.cyberFin !== undefined) merged.cyberFin = tune.cyberFin;
    if (tune.widebody !== null && tune.widebody !== undefined) merged.widebody = tune.widebody;
    c.mesh = buildCar(p.body, p.roof, p.glass, p.acc, c.shape, merged);
    return c;
  }
};
/* --------------------------- SKINLAR ---------------------------
   Ko'rinish rang uslubi. lvl = akkaunt darajasi talabi (tekin ochiladi). */
const SKINS = [
  { id: 'stock', name: 'Заводской', lvl: 1, pal: null },
  { id: 'cyan', name: 'Неоновый', lvl: 1, pal: { body: '#00e5ff', roof: '#0b2e46', glass: '#bff5ff', acc: '#7dff9b' } },
  { id: 'pink', name: 'Розовый', lvl: 2, pal: { body: '#ff2fb9', roof: '#3a0d2c', glass: '#ffd9f2', acc: '#ffd166' } },
  { id: 'gold', name: 'Золотой', lvl: 3, pal: { body: '#ffd166', roof: '#3b2e10', glass: '#fff6d8', acc: '#fff3c4' } },
  { id: 'lime', name: 'Лаймовый', lvl: 4, pal: { body: '#7dff9b', roof: '#0e3320', glass: '#dcffe4', acc: '#00e5ff' } },
  { id: 'violet', name: 'Фиолетовый', lvl: 5, pal: { body: '#a97bff', roof: '#231248', glass: '#e3d6ff', acc: '#ff7ab8' } },
  { id: 'ruby', name: 'Рубиновый', lvl: 6, pal: { body: '#e01776', roof: '#3a0624', glass: '#ffd0e8', acc: '#ff6ec7' } },
  { id: 'ice', name: 'Ледяной', lvl: 8, pal: { body: '#dff3ff', roof: '#22384f', glass: '#8ef9ff', acc: '#4fb8ff' } },
  { id: 'shadow', name: 'Теневой', lvl: 10, pal: { body: '#2b3350', roof: '#0c0f1c', glass: '#6f86ff', acc: '#00e5ff' } },
  { id: 'candy', name: 'Карамельный', lvl: 13, pal: { body: '#ff9ad5', roof: '#4a1030', glass: '#fff0fa', acc: '#7dffd0' } }
];
const skinKey = (id) => 'skin' + id;
/** Saqlangan skin akkaunt darajasiga mos bo'lmasa "Zavod" (0) ga qaytadi */
function skinIdx(c) {
  const i = store.get(skinKey(c.id), 0) | 0;
  const s = SKINS[i];
  return s && ACCT.can(s.lvl || 1) ? i : 0;
}
function skinOf(c) { return SKINS[skinIdx(c)]; }
function palOf(c) {
  const s = skinOf(c);
  return (s && s.pal) ? s.pal : { body: c.body, roof: c.roof, glass: c.glass, acc: c.acc };
}
/** Skinni qo'llaymiz: pal + mesh qayta quriladi (vitrina, plaka va o'yin bir xil ko'rinadi) */
function applySkin(c) {
  const p = palOf(c);
  c.pal = p;
  if (typeof CAR_TUNING !== 'undefined' && CAR_TUNING.apply) {
    CAR_TUNING.apply(c);
  } else {
    c.mesh = buildCar(p.body, p.roof, p.glass, p.acc, c.shape, c);
  }
  return c;
}
CARS.forEach(applySkin);
const car = () => CARS[G.car] || CARS[0];
const ship = car;

/* Xar bir mashinaning o'z maxsus imkoniyati (perk) — startRun() da qo'llanadi */
function applyPerk(p) {
  G.perk = p || null;
  G.drainMul = 1; G.shieldRegen = false; G.extraJumps = 0; G.jumpsLeft = 0;
  G.shieldRt = 0; G.luck = false; G.ghost = false;
  G.rampMul = 1; G.scoreMul = 1; G.reviveFree = 0;
  if (!p || !PERKS[p]) return false;
  if (p === 'drain') G.drainMul = .55;
  else if (p === 'steady') G.rampMul = .7;
  else if (p === 'score') G.scoreMul = 1.28;
  else if (p === 'coin') G.coinMult = Math.round(G.coinMult * 1.4 * 100) / 100;
  else if (p === 'armor') G.maxLives++;
  else if (p === 'combo') G.comboHold = Math.round(G.comboHold * 1.5 * 10) / 10;
  else if (p === 'magnetup') G.magnetMax = Math.round((G.magnetMax + 2) * 10) / 10;
  else if (p === 'brakes') G.brakePow += .9;
  else if (p === 'smash') G.smashBonus += 250;
  else if (p === 'sregen') G.shieldRegen = true;
  else if (p === 'djump') G.extraJumps = 1;
  else if (p === 'luck') G.luck = true;
  else if (p === 'ghost') G.ghost = true;
  else if (p === 'revive') G.reviveFree = 1;
  else if (p === 'turbo') {
    G.baseSpeed = Math.round(G.baseSpeed * 1.06 * 100) / 100;
    G.boostRate = Math.round((G.boostRate || 1) * 1.3 * 100) / 100;
  }
  else if (p === 'slipstream') {
    G.boostRate = Math.round((G.boostRate || 1) * 1.25 * 100) / 100;
    G.rampMul = .85;
  }
  else if (p === 'overdrive') {
    G.baseSpeed = Math.round(G.baseSpeed * 1.08 * 100) / 100;
    G.maxLives++;
  }
  else if (p === 'aero') {
    G.brakePow += .7;
    G.rampMul = .8;
  }
  else if (p === 'shockwave') {
    G.magnetMax = Math.round((G.magnetMax + 1.8) * 10) / 10;
    G.shieldRegen = true;
  }
  else if (p === 'goldrush') {
    G.coinMult = Math.round(G.coinMult * 1.35 * 100) / 100;
    G.drainMul = .7;
  }
  else if (p === 'warp') {
    G.scoreMul = 1.35;
    G.ghost = true;
  }
  else if (p === 'collector') {
    G.magnetMax = Math.round((G.magnetMax + 2.5) * 10) / 10;
    G.luck = true;
  }
  else if (p === 'boostmaster') {
    G.drainMul = .5;
    G.boostRate = Math.round((G.boostRate || 1) * 1.2 * 100) / 100;
  }
  else if (p === 'titan') {
    G.maxLives += 2;
    G.smashBonus += 300;
  }
  else if (p === 'photon') {
    G.luck = true;
    G.scoreMul = 1.2;
  }
  else if (p === 'energy') {
    G.drainMul = .65;
    G.shieldRegen = true;
  }
  else if (p === 'hyperdrive') {
    G.baseSpeed = Math.round(G.baseSpeed * 1.12 * 100) / 100;
    G.extraJumps = 1;
  }
  else if (p === 'driftking') {
    G.brakePow += 1.2;
    G.comboHold = Math.round(G.comboHold * 1.6 * 10) / 10;
  }
  else if (p === 'specter') {
    G.ghost = true;
    G.maxLives++;
  }
  else if (p === 'apex') {
    G.scoreMul = 1.45;
    G.baseSpeed = Math.round(G.baseSpeed * 1.10 * 100) / 100;
  }
  return true;
}

/* --------------------------- DOIMIY KUCHLAR ---------------------------
   pc = ⭐ ochko narxi (1-rank), pl = akkaunt darajasi talabi, max = rank soni */
const UPGRADES = [
  { k: 'speed', ic: '⚡', name: 'Мощный двигатель', p: 'Увеличивает базовую скорость', amt: '+7%', rare: 0, pc: 120, pl: 1, max: 5, fn: () => { G.baseSpeed += 1.2; } },
  { k: 'tank', ic: '🛢', name: 'Большой бак', p: 'Увеличивает запас нитро', amt: '+25', rare: 0, pc: 100, pl: 1, max: 5, fn: () => { G.energonMax += 25; } },
  { k: 'magnet', ic: '🧲', name: 'Сильный магнит', p: 'Магнит работает дольше', amt: '+2 с', rare: 0, pc: 110, pl: 2, max: 4, fn: () => { G.magnetMax += 2; } },
  { k: 'jump', ic: '🦘', name: 'Спортивная подвеска', p: 'Увеличивает высоту прыжка', amt: '+18%', rare: 0, pc: 140, pl: 2, max: 4, fn: () => { G.jumpV *= 1.18; } },
  { k: 'brake', ic: '🛑', name: 'Дисковые тормоза', p: 'Ускоряет смену полосы', amt: '+3', rare: 0, pc: 90, pl: 3, max: 3, fn: () => { G.brakePow += .5; } },
  { k: 'smash', ic: '💥', name: 'Мощный бампер', p: 'Тараньте препятствия на нитро и получайте очки', amt: '+200', rare: 0, pc: 150, pl: 4, max: 3, fn: () => { G.smashBonus += 200; } },
  { k: 'shield', ic: '🛡', name: 'Генератор щита', p: 'Увеличивает время действия щита', amt: '+6 с', rare: 1, pc: 220, pl: 5, max: 4, fn: () => { G.shieldMax += 6; G.shield = Math.max(G.shield, 6); } },
  { k: 'coin', ic: '🪙', name: 'Монетный запас', p: 'Каждая монета приносит больше', amt: '+30%', rare: 1, pc: 260, pl: 6, max: 4, fn: () => { G.coinMult += .3; G.comboHold += 1.2; } },
  { k: 'life', ic: '❤', name: 'Запасная жизнь', p: 'Увеличивает максимум жизней', amt: '+1', rare: 1, pc: 340, pl: 7, max: 3, fn: () => { G.maxLives++; G.lives = Math.min(G.lives + 1, G.maxLives); renderLives(); } }
];

MESHES.car = buildCar('#ff2b43', '#1e0508', '#ffd7dd', '#ff6b35', 'sport', { wing: 2, splitter: 2, headlights: 'laser', underglow: '#ff2b43', bar: 1 });

/* --------------------------- UI --------------------------- */
const $ = (s) => document.querySelector(s);
const el = {
  score: $('#score'), dist: $('#dist'), coins: $('#coins'), speed: $('#speed'), lives: $('#lives'),
  boostBar: $('#boostBar'), magBar: $('#magBar'), shBar: $('#shBar'), combo: $('#combo'), levelTag: $('#levelTag'),
  mileBar: $('#hudMilestoneBar'), lvlNum: $('#lvlNum'), lvlNext: $('#lvlNext'),
  flash: $('#flash'), toast: $('#toast'), load: $('#load'), legend: $('#legend'), hint: $('#hint'),
  scrMenu: $('#scrMenu'), scrHow: $('#scrHow'), scrCards: $('#scrCards'), scrPause: $('#scrPause'),
  scrOver: $('#scrOver'), scrRevive: $('#scrRevive'),
  introModal: $('#introModal'), tutorialBanner: $('#tutorialBanner'), tutorialCompleteModal: $('#tutorialCompleteModal')
};
function show(n) { n.classList.remove('hidden'); }
function hide(n) { n.classList.add('hidden'); }
const _toastQueue = [];
let _toastBusy = false;
function toast(msg, ms = 1500) {
  if (!el.toast) return;
  if (_toastBusy && el.toast.textContent === msg) return;
  if (_toastQueue.some(item => item.msg === msg)) return;
  if (_toastBusy) {
    if (_toastQueue.length < 5) _toastQueue.push({ msg, ms });
    return;
  }
  _showToast(msg, ms);
}
function _showToast(msg, ms) {
  if (!el.toast) return;
  _toastBusy = true;
  el.toast.textContent = msg;
  el.toast.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.toast.classList.remove('on');
    _toastBusy = false;
    if (_toastQueue.length > 0) {
      const next = _toastQueue.shift();
      setTimeout(() => _showToast(next.msg, next.ms), 90);
    }
  }, ms);
}
const CYBER_HEART_SVG = '<svg viewBox="0 0 24 24" class="heart-svg" aria-hidden="true"><path class="heart-crest" d="M12 21.2L3.8 13.4C1.4 11 1.4 7.2 3.8 4.8C6.2 2.4 10 2.4 12.4 4.8L12 5.2L11.6 4.8C14 2.4 17.8 2.4 20.2 4.8C22.6 7.2 22.6 11 20.2 13.4L12 21.2Z"/><path class="heart-accent" d="M12 7.2L14.2 9.5H17.2L12 15.8L6.8 9.5H9.8L12 7.2Z"/><polygon class="heart-core" points="12,8.8 13.4,10.2 10.6,10.2"/></svg>';

function renderLives() {
  el.lives.innerHTML = '';
  for (let i = 0; i < G.maxLives; i++) {
    const s = document.createElement('i');
    s.innerHTML = CYBER_HEART_SVG;
    if (i >= G.lives) s.className = 'off';
    el.lives.appendChild(s);
  }
}

/* --------------------------- O'QITISH (LESSONS) --------------------------- */
const LESSONS = [
  { ev: 'lane', txt: 'Нажимайте <b>◀ ▶</b>, чтобы перестраиваться. На телефоне нажмите на левую или правую половину экрана.' },
  { ev: 'coin', txt: '<b class="go">Жёлтое кольцо</b> = ОЧКИ. Проезжайте сквозь кольца, чтобы собирать монеты.' },
  { ev: 'jump', txt: '<b class="go">SPACE</b> или <b>▲</b> — ПРЫЖОК. Перепрыгивайте красные барьеры, не проезжайте под ними!' },
  { ev: 'avoid', txt: '<b>КРАСНОЕ = ОПАСНО</b> (отмечено знаком «!»). Не врезайтесь — перестройтесь на свободную полосу.' },
  { ev: 'nitro', txt: '<b class="go">Синий кристалл</b> = НИТРО. Удерживайте <b>N / ⚡</b>, чтобы ускориться.' }
];
function setHint(i) {
  G.lesson = i; G.lessonT = 0;
  if (i < 0 || i >= LESSONS.length) { el.hint.classList.remove('on'); el.hint.innerHTML = ''; return; }
  el.hint.innerHTML = LESSONS[i].txt;
  el.hint.classList.add('on');
}
function nextLesson() {
  if (!G.tut) return;
  if (G.lesson + 1 < LESSONS.length) setHint(G.lesson + 1);
  else { G.tut = false; setHint(-1); el.legend.classList.add('dim'); store.set('tutDone', true); G.tutDone = true; toast('✅ Отлично! Теперь вы готовы — удачи!', 1600); }
}
function lessonEvent(ev) {
  if (!G.tut) return;
  const L = LESSONS[G.lesson];
  if (L && L.ev === ev) { Sound.blip(980, .09, 'triangle', .2); nextLesson(); }
}
function lessonTick(dt) {
  if (!G.tut) return;
  G.lessonT += dt;
  if (G.lessonT > 13) nextLesson();
  if (G.dist > 340 && G.lesson >= 2) { G.tut = false; setHint(-1); el.legend.classList.add('dim'); }
}

/* --------------------------- BOSHQARUV --------------------------- */
const keys = {};
window.addEventListener('keydown', (e) => {
  const k = (e.key || '').toLowerCase();
  if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
  if (keys[k]) return; keys[k] = true;
  Sound.ensure(); Sound.resume();
  if (!G.running && !el.scrMenu.classList.contains('hidden') && menuView === 'home' &&
      (k === 'arrowleft' || k === 'arrowright')) {
    cycleHomeCar(k === 'arrowleft' ? -1 : 1);
    return;
  }
  if (k === 'escape' && !$('#menuDropdown').classList.contains('hidden')) {
    setMenuDropdown(false);
    return;
  }
  if (k === 'arrowleft' || k === 'a') moveLane(-1);
  if (k === 'arrowright' || k === 'd') moveLane(1);
  if (k === ' ' || k === 'w' || k === 'arrowup') jump();
  if (k === 'shift' || k === 'n') G.boostOn = true;
  if (k === 'p' || k === 'escape') togglePause();
  if (k === 'm') { Sound.set(!Sound.on); $('#btnSnd').textContent = Sound.on ? 'ВКЛ' : 'ВЫКЛ'; }
  if (k === 'r' && G.over) startRun();
}, { passive: false });
window.addEventListener('keyup', (e) => {
  const k = (e.key || '').toLowerCase(); keys[k] = false;
  if (k === 'shift' || k === 'n') G.boostOn = false;
});


/* --------------------------- STAGE 4: BIOME SELECTION & PORTAL INTEGRATION --------------------------- */
let selectedStartingBiome = store.get('selected_biome', 0);
if (typeof selectedStartingBiome !== 'number' || selectedStartingBiome < 0 || selectedStartingBiome >= 8) {
  selectedStartingBiome = 0;
}

function getSelectedStartingBiome() {
  return selectedStartingBiome;
}

function selectStartingBiome(idx, autoStart) {
  if (idx < 0 || idx >= BIOMES.length) return;
  selectedStartingBiome = idx;
  store.set('selected_biome', idx);
  const bm = BIOMES[idx];
  const tag = $('#heroBiomeTag');
  if (tag) tag.textContent = bm.name;
  const footnote = $('#homeSelectedBiome');
  if (footnote) footnote.textContent = bm.name;
  Sound.ensure(); Sound.blip(620, .08, 'triangle', .16);
  renderBiomesMenu();
  if (autoStart) {
    startRun();
  } else {
    toast('🌍 Стартовый биом: ' + bm.name, 2200);
  }
}

function drawBiomeCardPreview(canvas, bm) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const horizon = h * 0.58;
  const type = bm.props || 'city';

  ctx.clearRect(0, 0, w, h);

  // 1. Sky gradient
  const sg = ctx.createLinearGradient(0, 0, 0, horizon);
  sg.addColorStop(0, bm.sky0);
  sg.addColorStop(0.5, bm.sky1);
  sg.addColorStop(1, bm.sky2);
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, horizon);

  // 2. Celestial body / sun
  const sunX = w * 0.5;
  const sunY = horizon * 0.40;
  const sunR = Math.min(20, h * 0.18);
  ctx.fillStyle = bm.sun1;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Halo
  ctx.fillStyle = rgba(bm.sun0, 0.28);
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // 3. Environment-specific horizon silhouettes
  ctx.save();
  ctx.fillStyle = bm.sil || '#060714';
  if (type === 'city') {
    const bldgs = [[0.05, 0.12, 0.40], [0.18, 0.10, 0.28], [0.30, 0.14, 0.48], [0.46, 0.09, 0.35], [0.58, 0.13, 0.52], [0.73, 0.11, 0.32], [0.86, 0.12, 0.44]];
    for (const [bx, bw, bh] of bldgs) {
      const rx = bx * w, rw = bw * w, rh = bh * horizon;
      ctx.fillRect(rx, horizon - rh, rw, rh);
      ctx.strokeStyle = rgba(bm.neon, 0.45); ctx.lineWidth = 1;
      ctx.strokeRect(rx, horizon - rh, rw, rh);
    }
  } else if (type === 'crystal') {
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w * 0.15, horizon - 28);
    ctx.lineTo(w * 0.35, horizon - 28);
    ctx.lineTo(w * 0.45, horizon - 12);
    ctx.lineTo(w * 0.65, horizon - 35);
    ctx.lineTo(w * 0.85, horizon - 35);
    ctx.lineTo(w, horizon - 16);
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(w * 0.22, horizon - 18, 3, 18);
    ctx.fillRect(w * 0.78, horizon - 22, 3, 22);
  } else if (type === 'ice') {
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w * 0.18, horizon - 42);
    ctx.lineTo(w * 0.38, horizon - 15);
    ctx.lineTo(w * 0.55, horizon - 48);
    ctx.lineTo(w * 0.75, horizon - 22);
    ctx.lineTo(w * 0.90, horizon - 38);
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)'; ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, horizon * 0.25);
    ctx.bezierCurveTo(w * 0.3, horizon * 0.1, w * 0.6, horizon * 0.35, w, horizon * 0.2);
    ctx.stroke();
  } else if (type === 'lava') {
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w * 0.3, horizon - 38);
    ctx.lineTo(w * 0.44, horizon - 22);
    ctx.lineTo(w * 0.56, horizon - 22);
    ctx.lineTo(w * 0.7, horizon - 38);
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(w * 0.46, horizon - 24, w * 0.08, 6);
  } else if (type === 'bio') {
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0.08; x < 0.96; x += 0.12) {
      const ph = 24 + ((x * 100) % 18);
      ctx.lineTo(x * w, horizon - ph);
      ctx.lineTo((x + 0.06) * w, horizon);
    }
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'cosmic') {
    ctx.strokeStyle = rgba(bm.neon, 0.75); ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(sunX, sunY, sunR * 1.8, sunR * 0.45, -0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(w * 0.78, horizon - 32, 6, 32);
  } else if (type === 'tech') {
    ctx.fillRect(w * 0.15, horizon - 26, 14, 26);
    ctx.fillRect(w * 0.24, horizon - 18, 12, 18);
    ctx.fillRect(w * 0.75, horizon - 28, 16, 28);
    ctx.beginPath();
    ctx.moveTo(w * 0.45, horizon * 0.35);
    ctx.lineTo(w * 0.55, horizon * 0.28);
    ctx.lineTo(w * 0.58, horizon * 0.40);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'rift') {
    ctx.beginPath();
    ctx.ellipse(w * 0.25, horizon * 0.45, 24, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.75, horizon * 0.38, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w * 0.73, horizon * 0.38 - 18, 5, 18);
    ctx.fillRect(w * 0.78, horizon * 0.38 - 14, 4, 14);
  }
  ctx.restore();

  // 4. Ground plane
  const gg = ctx.createLinearGradient(0, horizon, 0, h);
  gg.addColorStop(0, bm.gnd0 || '#100a26');
  gg.addColorStop(1, bm.gnd1 || '#03030a');
  ctx.fillStyle = gg;
  ctx.fillRect(0, horizon, w, h - horizon);

  // 5. Road converging into horizon
  const rTopW = w * 0.22, rBotW = w * 0.78;
  ctx.fillStyle = bm.road;
  ctx.beginPath();
  ctx.moveTo(w * 0.5 - rTopW / 2, horizon);
  ctx.lineTo(w * 0.5 + rTopW / 2, horizon);
  ctx.lineTo(w * 0.5 + rBotW / 2, h);
  ctx.lineTo(w * 0.5 - rBotW / 2, h);
  ctx.closePath();
  ctx.fill();

  // Curbs
  ctx.strokeStyle = bm.curbc || bm.neon;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.5 - rTopW / 2, horizon); ctx.lineTo(w * 0.5 - rBotW / 2, h);
  ctx.moveTo(w * 0.5 + rTopW / 2, horizon); ctx.lineTo(w * 0.5 + rBotW / 2, h);
  ctx.stroke();

  // Center neon dash
  ctx.strokeStyle = bm.neon;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, horizon + 2);
  ctx.lineTo(w * 0.5, h);
  ctx.stroke();
  ctx.setLineDash([]);
}

function renderBiomesMenu() {
  const grid = $('#biomesGrid');
  if (!grid) return;
  const current = getSelectedStartingBiome();

  grid.innerHTML = BIOMES.map((bm, i) => {
    const isActive = i === current;
    const evName = (BIOME_EVENTS[bm.props] && BIOME_EVENTS[bm.props].name) || 'ШТОРМ';
    return '<div class="biome-card' + (isActive ? ' active' : '') + '" data-biome-id="' + i + '" style="--bm-neon:' + bm.neon + ';--bm-curb:' + (bm.curbc || bm.neon) + '">' +
      '<div class="biome-card-header">' +
        '<span class="biome-num">0' + (i + 1) + '</span>' +
        '<b class="biome-title">' + bm.name + '</b>' +
        '<span class="biome-band-tag">' + (BAND_NAME[bm.band] || '★') + ' · ' + '★'.repeat(bm.diff) + '</span>' +
      '</div>' +
      '<div class="biome-card-stage">' +
        '<canvas class="biome-preview-canvas" width="280" height="120" data-biome-idx="' + i + '"></canvas>' +
        (isActive ? '<span class="biome-badge-active">АКТИВЕН ✓</span>' : '') +
      '</div>' +
      '<div class="biome-card-details">' +
        '<div class="biome-meta-row">' +
          '<span><small>ТИП МИРА</small><b>' + bm.props.toUpperCase() + '</b></span>' +
          '<span><small>СОБЫТИЕ</small><b>' + evName + '</b></span>' +
          '<span><small>СЛОЖНОСТЬ</small><b>×' + bm.hz.toFixed(2) + '</b></span>' +
        '</div>' +
      '</div>' +
      '<div class="biome-card-actions">' +
        '<button class="btn sm ghost btn-select-biome' + (isActive ? ' on' : '') + '" data-biome-select="' + i + '" type="button">' +
          (isActive ? 'ВЫБРАН ✓' : 'ВЫБРАТЬ') +
        '</button>' +
        '<button class="btn sm pink btn-start-biome" data-biome-start="' + i + '" type="button">' +
          'В ЗАЕЗД ▶' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('');

  const canvases = grid.querySelectorAll('.biome-preview-canvas');
  canvases.forEach(cv => {
    const idx = parseInt(cv.dataset.biomeIdx, 10);
    const bm = BIOMES[idx];
    if (bm) drawBiomeCardPreview(cv, bm);
  });
}

function initBiomeSelectionEvents() {
  const btnOpenBiomes = $('#btnOpenBiomes');
  if (btnOpenBiomes) {
    btnOpenBiomes.addEventListener('click', () => {
      Sound.ensure(); Sound.blip(520, .08, 'triangle', .16);
      setMenuView('garage');
      activateTab('biomes');
    });
  }

  const btnFootnoteBiome = $('#btnFootnoteBiome');
  if (btnFootnoteBiome) {
    btnFootnoteBiome.addEventListener('click', () => {
      Sound.ensure(); Sound.blip(520, .08, 'triangle', .16);
      setMenuView('garage');
      activateTab('biomes');
    });
  }

  const bgGrid = $('#biomesGrid');
  if (bgGrid) {
    bgGrid.addEventListener('click', (e) => {
      const selBtn = e.target.closest('[data-biome-select]');
      if (selBtn) {
        const idx = parseInt(selBtn.dataset.biomeSelect, 10);
        selectStartingBiome(idx, false);
        return;
      }
      const startBtn = e.target.closest('[data-biome-start]');
      if (startBtn) {
        const idx = parseInt(startBtn.dataset.biomeStart, 10);
        selectStartingBiome(idx, true);
        return;
      }
      const card = e.target.closest('.biome-card');
      if (card && card.dataset.biomeId != null) {
        const idx = parseInt(card.dataset.biomeId, 10);
        selectStartingBiome(idx, false);
      }
    });
  }

  const curBm = BIOMES[selectedStartingBiome] || BIOMES[0];
  const tag = $('#heroBiomeTag');
  if (tag) tag.textContent = curBm.name;
  const footnote = $('#homeSelectedBiome');
  if (footnote) footnote.textContent = curBm.name;
}

/* --------------------------- COMPLETE INTERACTIVE TUTORIAL SYSTEM --------------------------- */
const TUTORIAL_SYSTEM = {
  active: false,
  step: 0,
  domBound: false,
  tasks: { left: false, right: false, jump: false, coin: false, nitro: false, portal: false },

  bindDOM() {
    if (this.domBound) return;
    this.domBound = true;

    // 1. Intro Modal buttons
    const btnLearn = $('#btnIntroLearn');
    if (btnLearn) {
      const onLearn = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        Sound.ensure(); Sound.resume();
        this.startRace(1);
      };
      btnLearn.onclick = onLearn;
      btnLearn.addEventListener('click', onLearn);
    }
    const btnSkip = $('#btnIntroSkip');
    if (btnSkip) {
      const onSkip = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        Sound.ensure(); Sound.resume();
        this.skipIntro();
      };
      btnSkip.onclick = onSkip;
      btnSkip.addEventListener('click', onSkip);
    }

    // 2. In-race Tutorial Banner buttons
    const btnTutSkip = $('#btnTutSkip');
    if (btnTutSkip) {
      const onTutSkip = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        this.end(true);
        toast('Обучение пропущено. Удачи в гонке!', 2200);
      };
      btnTutSkip.onclick = onTutSkip;
      btnTutSkip.addEventListener('click', onTutSkip);
    }
    const btnTutNext = $('#btnTutNext');
    if (btnTutNext) {
      const onTutNext = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (this.step < 5) this.setStep(this.step + 1);
        else this.startGarage();
      };
      btnTutNext.onclick = onTutNext;
      btnTutNext.addEventListener('click', onTutNext);
    }

    // 3. Complete modal buttons
    const btnRace = $('#btnCompleteRace');
    if (btnRace) {
      const onRace = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        Sound.ensure(); Sound.resume();
        this.hideComplete();
        startRun();
      };
      btnRace.onclick = onRace;
      btnRace.addEventListener('click', onRace);
    }
    const btnRestart = $('#btnCompleteRestart');
    if (btnRestart) {
      const onRestart = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        Sound.ensure(); Sound.resume();
        this.hideComplete();
        this.startRace(1);
      };
      btnRestart.onclick = onRestart;
      btnRestart.addEventListener('click', onRestart);
    }
    const btnGarage = $('#btnCompleteGarage');
    if (btnGarage) {
      const onGarage = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        this.hideComplete();
        hide(el.scrOver);
        show(el.scrMenu);
        setMenuView('garage');
        activateTab('ships');
      };
      btnGarage.onclick = onGarage;
      btnGarage.addEventListener('click', onGarage);
    }

    // 4. Hero button on home screen
    const btnOpenTut = $('#btnOpenTut');
    if (btnOpenTut) {
      const onOpenTut = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        Sound.ensure(); Sound.resume();
        setMenuDropdown(false);
        this.startRace(1);
      };
      btnOpenTut.onclick = onOpenTut;
      btnOpenTut.addEventListener('click', onOpenTut);
    }
  },

  checkFirstTime() {
    this.bindDOM();
    const seen = store.get('neorush_intro_seen');
    if (!seen) {
      setTimeout(() => this.showIntro(), 300);
    }
  },

  showIntro() {
    this.bindDOM();
    const m = $('#introModal');
    if (m) m.classList.remove('hidden');
  },

  hideIntro() {
    const m = $('#introModal');
    if (m) m.classList.add('hidden');
    store.set('neorush_intro_seen', true);
  },

  skipIntro() {
    this.hideIntro();
    this.active = false;
    this.step = 0;
    store.set('tutDone', true);
    G.tutDone = true;
    G.isTutorial = false;
    Sound.ensure(); Sound.resume();
    startRun();
  },

  startRace(fromStep = 1) {
    this.bindDOM();
    this.hideIntro();
    this.hideComplete();
    this.active = true;
    G.isTutorial = true;
    Sound.ensure(); Sound.resume();
    startRun();
    G.invul = 9999; // Tutorialda o'lmaslik
    this.setStep(fromStep);
  },

  setStep(s) {
    this.step = s;
    const b = $('#tutorialBanner');
    if (!b) return;

    if (s <= 0 || s > 5) {
      b.classList.add('hidden');
      if (s === 6) this.startGarage();
      else if (s >= 8) this.showComplete();
      return;
    }

    b.classList.remove('hidden');
    const tag = $('#tutStepTag');
    const title = $('#tutTitle');
    const desc = $('#tutDesc');
    const task = $('#tutTask');
    const hint = $('#tutDeviceHint');

    if (s === 1) {
      this.tasks.left = false; this.tasks.right = false;
      if (tag) tag.textContent = 'ЭТАП 1/5';
      if (title) title.textContent = 'УПРАВЛЕНИЕ';
      if (desc) desc.innerHTML = 'Перестраивайтесь клавишами <b>A / D</b> или <b>◀ / ▶</b> на ПК. На телефоне нажимайте на <b>левую или правую</b> половину экрана.';
      if (task) task.innerHTML = '<span class="tut-check" id="tutCheckLeft">◯ Влево</span><span class="tut-check" id="tutCheckRight">◯ Вправо</span>';
      if (hint) hint.innerHTML = '💻 ПК: A/D или ◀/▶ · 📱 Телефон: касание по бокам';
      for (const o of G.objs) if (HAZARD[o.kind]) o.dead = true;
    } else if (s === 2) {
      this.tasks.jump = false; this.tasks.coin = false;
      if (tag) tag.textContent = 'ЭТАП 2/5';
      if (title) title.textContent = 'ПРЕПЯТСТВИЯ И МОНЕТЫ';
      if (desc) desc.innerHTML = 'Собирайте <b>золотые кольца 🪙</b>. Перепрыгивайте красные барьеры клавишей <b>SPACE / W / ▲</b> или кнопкой <b>🦘 ПРЫЖОК</b>.';
      if (task) task.innerHTML = '<span class="tut-check" id="tutCheckCoin">◯ Монета</span><span class="tut-check" id="tutCheckJump">◯ Прыжок</span>';
      if (hint) hint.innerHTML = '💻 ПК: SPACE / W / ▲ · 📱 Телефон: кнопка 🦘';
      addObj('coin', G.lane, 22);
      addObj('coin', G.lane, 28);
      addObj('bar', G.lane, 36);
    } else if (s === 3) {
      this.tasks.nitro = false;
      G.energon = G.energonMax;
      if (tag) tag.textContent = 'ЭТАП 3/5';
      if (title) title.textContent = 'НИТРО';
      if (desc) desc.innerHTML = 'Удерживайте <b>SHIFT / N</b> на ПК или кнопку <b>⚡ NITRO</b> на телефоне. Нитро даёт мощный разгон и плазменный шлейф!';
      if (task) task.innerHTML = '<span class="tut-check" id="tutCheckNitro">◯ Включить нитро</span>';
      if (hint) hint.innerHTML = '💻 ПК: SHIFT или N · 📱 Телефон: кнопка ⚡';
    } else if (s === 4) {
      G.shield = 10; G.shieldMax = 10; G.shieldAnim = 1.0;
      if (tag) tag.textContent = 'ЭТАП 4/5';
      if (title) title.textContent = 'ЩИТ И ЖИЗНИ';
      if (desc) desc.innerHTML = 'Зелёный <b>ЩИТ 🛡</b> поглощает удар без потери жизни. Вверху экрана индикатор <b>4 ЖИЗНЕЙ ❤</b>. Берегите их!';
      if (task) task.innerHTML = '<span class="tut-check done">✔ Щит активен (10 с)</span><span class="tut-check done">✔ 4 Жизни защищены</span>';
      if (hint) hint.innerHTML = '🛡 Щит поглощает удар · ❤ Жизни сохраняются';
    } else if (s === 5) {
      this.tasks.portal = false;
      if (tag) tag.textContent = 'ЭТАП 5/5';
      if (title) title.textContent = 'ПОРТАЛЫ И БИОМЫ';
      if (desc) desc.innerHTML = '<b>3-полосный квантовый портал!</b> Полоса со светящимся шлейфом и знаком ведёт в секретное измерение. Остальные полосы — транзит.';
      if (task) task.innerHTML = '<span class="tut-check" id="tutCheckPortal">◯ Войти в портал</span>';
      if (hint) hint.innerHTML = '🌀 Найдите активную полосу со стрелками и въезжайте!';
      for (const o of G.objs) if (o.kind.startsWith('portal_') || HAZARD[o.kind]) o.dead = true;
      const targetDim = 1;
      const pGroup = (G.portalGroupSeq = (G.portalGroupSeq || 0) + 1);
      const activeLane = G.lane;
      for (let l = 0; l < 3; l++) {
        const p = allocObj(l === activeLane ? 'portal_active' : 'portal_open', LANES[l], 42);
        p.targetDim = targetDim;
        p.activeLane = activeLane;
        p.portalGroupId = pGroup;
        G.objs.push(p);
      }
    }
  },

  onAction(act) {
    if (!this.active) return;
    if (this.step === 1) {
      if (act === 'lane_left') this.tasks.left = true;
      if (act === 'lane_right') this.tasks.right = true;
      const elL = $('#tutCheckLeft'), elR = $('#tutCheckRight');
      if (this.tasks.left && elL) { elL.classList.add('done'); elL.textContent = '✔ Влево'; }
      if (this.tasks.right && elR) { elR.classList.add('done'); elR.textContent = '✔ Вправо'; }
      if (this.tasks.left && this.tasks.right) {
        Sound.blip(880, .1, 'triangle', .2);
        setTimeout(() => { if (this.active && this.step === 1) this.setStep(2); }, 800);
      }
    } else if (this.step === 2) {
      if (act === 'coin') this.tasks.coin = true;
      if (act === 'jump') this.tasks.jump = true;
      const elC = $('#tutCheckCoin'), elJ = $('#tutCheckJump');
      if (this.tasks.coin && elC) { elC.classList.add('done'); elC.textContent = '✔ Монета'; }
      if (this.tasks.jump && elJ) { elJ.classList.add('done'); elJ.textContent = '✔ Прыжок'; }
      if (this.tasks.coin && this.tasks.jump) {
        Sound.blip(880, .1, 'triangle', .2);
        setTimeout(() => { if (this.active && this.step === 2) this.setStep(3); }, 800);
      }
    } else if (this.step === 3) {
      if (act === 'nitro') {
        this.tasks.nitro = true;
        const elN = $('#tutCheckNitro');
        if (elN) { elN.classList.add('done'); elN.textContent = '✔ Нитро включено!'; }
        Sound.blip(980, .12, 'triangle', .22);
        setTimeout(() => { if (this.active && this.step === 3) this.setStep(4); }, 1200);
      }
    } else if (this.step === 5) {
      if (act === 'portal') {
        this.tasks.portal = true;
        const elP = $('#tutCheckPortal');
        if (elP) { elP.classList.add('done'); elP.textContent = '✔ Портал пройден!'; }
        Sound.chord([523, 659, 784, 1046], .4, .2);
        setTimeout(() => {
          if (this.active && this.step === 5) {
            this.startGarage();
          }
        }, 1800);
      }
    }
  },

  next() {
    if (!this.active) return;
    if (this.step >= 1 && this.step <= 4) this.setStep(this.step + 1);
    else if (this.step === 5) this.startGarage();
    else if (this.step === 6) this.startTuning();
    else if (this.step === 7) this.showComplete();
  },

  skip() {
    this.end(false);
    toast('Обучение завершено. Удачной гонки!', 2200);
  },

  startGarage() {
    this.step = 6;
    G.running = false;
    G.isTutorial = false;
    hide($('#tutorialBanner'));
    hide(el.scrOver);
    show(el.scrMenu);
    setMenuView('garage');
    activateTab('ships');
    toast('🚗 РАЗДЕЛ «ГАРАЖ»: 30 спорткаров с уникальными характеристиками!', 3500);
    showModal('🎓 ОБУЧЕНИЕ: ГАРАЖ', `
      <div style="text-align:left;line-height:1.55;color:#e2e8f0;font-size:13px">
        <p style="margin-top:0">В <b>ГАРАЖЕ</b> представлено <b>30 футуристических спорткаров</b> 8 различных классов (Sport, Muscle, Hyper, Racer и др.).</p>
        <ul style="padding-left:18px;margin:8px 0;color:#cbd5e1">
          <li>У каждой машины свои параметры: <b>Скорость, Разгон, Нитро, Щит и Магнит</b>.</li>
          <li>Новые машины открываются за 🪙 <b>монеты</b> или ⭐ <b>очки</b>.</li>
          <li>Нажмите на любую открытую машину и выберите <b>«ВЫБРАТЬ»</b>.</li>
        </ul>
        <p style="color:#7fe9ff;margin-bottom:14px">Попробуйте переключить машины прямо сейчас!</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn sm" id="btnTutToTuning" type="button">ДАЛЕЕ: ТЮНИНГ ▶</button>
        </div>
      </div>
    `);
    setTimeout(() => {
      const btnNext = $('#btnTutToTuning');
      if (btnNext) btnNext.addEventListener('click', () => { hideModal(); TUTORIAL_SYSTEM.startTuning(); });
    }, 50);
  },

  startTuning() {
    this.step = 7;
    setMenuView('garage');
    activateTab('carUpgrades');
    toast('⚡ РАЗДЕЛ «ТЮНИНГ»: прокачивайте параметры до 5-го уровня!', 3500);
    showModal('🎓 ОБУЧЕНИЕ: УЛУЧШЕНИЕ АВТО', `
      <div style="text-align:left;line-height:1.55;color:#e2e8f0;font-size:13px">
        <p style="margin-top:0">В разделе <b>ТЮНИНГ</b> можно улучшать характеристики выбранной машины до <b>5 уровней</b>:</p>
        <ul style="padding-left:18px;margin:8px 0;color:#cbd5e1">
          <li><b>🚀 Макс. скорость</b> и <b>⚡ Разгон</b> — для быстрого набора темпа.</li>
          <li><b>🔥 Эффект нитро</b> и <b>⏱ Время нитро</b> — мощность и длительность ускорения.</li>
          <li><b>🧲 Радиус магнита</b> и <b>🛡 Прочность щита</b> — больше бонусов и защиты.</li>
        </ul>
        <p style="color:#94a3b8;font-size:12px">Улучшения приобретаются за 🪙 монеты или ⭐ очки. При нехватке валюты собирайте больше монет на трассе!</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn sm" id="btnTutFinish" type="button">ЗАВЕРШИТЬ ОБУЧЕНИЕ 🏆</button>
        </div>
      </div>
    `);
    setTimeout(() => {
      const btnFin = $('#btnTutFinish');
      if (btnFin) btnFin.addEventListener('click', () => { hideModal(); TUTORIAL_SYSTEM.showComplete(); });
    }, 50);
  },

  showComplete() {
    this.end(true);
    const m = $('#tutorialCompleteModal');
    if (m) m.classList.remove('hidden');
    Sound.chord([523, 659, 784, 1046], .5, .25);
  },

  hideComplete() {
    const m = $('#tutorialCompleteModal');
    if (m) m.classList.add('hidden');
  },

  end(completed = true) {
    this.active = false;
    this.step = 0;
    G.isTutorial = false;
    hide($('#tutorialBanner'));
    if (completed) {
      store.set('tutDone', true);
      store.set('neorush_intro_seen', true);
      G.tutDone = true;
    }
  }
};
window.TUTORIAL_SYSTEM = TUTORIAL_SYSTEM;

function moveLane(d) {
  if (!G.running || G.paused) return;
  const n = Math.max(0, Math.min(2, G.lane + d));
  if (n !== G.lane) {
    G.lane = n; G.tilt = d * .5; Sound.blip(500 + n * 130, .05, 'triangle', .13); lessonEvent('lane');
    if (TUTORIAL_SYSTEM.active) TUTORIAL_SYSTEM.onAction(d < 0 ? 'lane_left' : 'lane_right');
  }
}
function jump() {
  if (!G.running || G.paused) return;
  if (TUTORIAL_SYSTEM.active) TUTORIAL_SYSTEM.onAction('jump');
  const effJump = 1 + Math.min(0.08, (Math.max(1, G.jumpV || 1) - 1) * 0.12);
  if (G.onGround) {
    G.vy = 6.3 * effJump;
    G.onGround = false;
    G.jumpsLeft = G.extraJumps || 0;
    Sound.blip(340, .10, 'sine', .18);
    lessonEvent('jump');
  } else if ((G.jumpsLeft || 0) > 0) {
    G.jumpsLeft--;
    if (G.y > 0.85) G.y = 0.85;
    G.vy = 4.6 * effJump;
    Sound.blip(560, .10, 'triangle', .2);
    addFloatingText(G.x, G.y + 0.8, 0, 'ДВОЙНОЙ ПРЫЖОК!', '#7dffe4');
    burst(G.x, G.y, 0, 10, '#7dffe4', .45);
  }
}

const isTouch = (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
let tx0 = 0, ty0 = 0, tt0 = 0, swiped = false;
canvas.addEventListener('touchstart', (e) => {
  Sound.ensure(); Sound.resume();
  const t = e.touches[0]; tx0 = t.clientX; ty0 = t.clientY; tt0 = performance.now(); swiped = false;
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (G.running && !G.paused && e.cancelable) e.preventDefault();
  const t = e.touches[0], dx = t.clientX - tx0, dy = t.clientY - ty0;
  if (!swiped && Math.abs(dx) > 44) { moveLane(dx > 0 ? 1 : -1); swiped = true; tx0 = t.clientX; }
  else if (!swiped && dy < -46) { jump(); swiped = true; }
}, { passive: false });
canvas.addEventListener('touchcancel', () => { swiped = false; }, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!swiped && performance.now() - tt0 < 420) {
    const x = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : tx0);
    moveLane(x > W / 2 ? 1 : -1);
  }
}, { passive: true });
const bind = (id, dn, up) => {
  const n = document.getElementById(id); if (!n) return;
  n.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); Sound.ensure(); Sound.resume(); dn(); }, { passive: false });
  n.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); if (up) up(); }, { passive: false });
  n.addEventListener('touchcancel', () => { if (up) up(); }, { passive: true });
  n.addEventListener('mousedown', dn);
  n.addEventListener('mouseup', () => { if (up) up(); });
  n.addEventListener('mouseleave', () => { if (up) up(); });
};
bind('tL', () => moveLane(-1)); bind('tR', () => moveLane(1)); bind('tJ', () => jump());
bind('tB', () => { G.boostOn = true; }, () => { G.boostOn = false; });
bind('tD', () => { G.touchBrake = true; }, () => { G.touchBrake = false; });
$('#tP').addEventListener('click', togglePause);
canvas.addEventListener('click', () => { Sound.ensure(); Sound.resume(); if (G.paused) togglePause(); });

/* --------------------------- OBʼYEKTLAR / SPAWN --------------------------- */
const POOL = [];
const PART_POOL = [];
function addObj(kind, lane, z, opt) {
  const o = POOL.pop() || {};
  o.kind = kind; o.lane = lane; o.x = LANES[lane]; o.z = z; o.y = (OBJ[kind] && OBJ[kind].y) || 0;
  o.rot = Math.random() * 6.28; o.taken = false; o.dead = false; o.sway = 0; o.hit = 0;
  o.nearMissed = false; o.promptShown = false;
  if (opt) for (const k in opt) o[k] = opt[k];
  G.objs.push(o);
  return o;
}
function allocObj(kind, xOrLane, z, opt) {
  const o = POOL.pop() || {};
  let lane = 1;
  let x = 0;
  if (kind === 'checkpoint') {
    lane = 1;
    x = 0;
  } else if (typeof xOrLane === 'number') {
    if (xOrLane === 0 || xOrLane === 1 || xOrLane === 2) {
      lane = xOrLane;
      x = LANES[lane];
    } else {
      x = xOrLane;
      lane = x < -0.5 ? 0 : (x > 0.5 ? 2 : 1);
    }
  }
  o.kind = kind; o.lane = lane; o.x = x; o.z = z; o.y = (OBJ[kind] && OBJ[kind].y) || 0;
  o.rot = 0; o.taken = false; o.dead = false; o.sway = 0; o.hit = 0;
  o.nearMissed = false; o.promptShown = false;
  if (opt) for (const k in opt) o[k] = opt[k];
  return o;
}
function freeObj(o) { if (POOL.length < 90) POOL.push(o); }

/** Qoida: har qatorda kamida BITTA yoʼlak butunlay boʼsh boʼladi. */
function spawnRow(z) {
  const lv = G.level;
  const hz = currentBiome().hz || 1;   // biom qiyinligi — tosiqlar zichligi
  let portalLane = -1;
  for (let i = 0; i < G.objs.length; i++) {
    const po = G.objs[i];
    if (po.kind === 'portal_active' && !po.dead && Math.abs(po.z - z) < 16) {
      portalLane = po.lane;
      break;
    }
  }
  const open = portalLane >= 0 ? portalLane : Math.floor(Math.random() * 3);
  // dastlabki 140 m — faqat tangа (odam tushunib olishi uchun)
  if (G.dist < 140) {
    const l = G.tut ? (Math.floor(G.dist / 28) % 3) : open;
    const n = 4;
    for (let i = 0; i < n; i++) addObj(KIND.COIN, l, z + i * 2.3);
    if (G.dist > 90 && lv >= 1) addObj(KIND.BAR, (l + 1) % 3, z);
    return;
  }
  let filled = 0;
  for (let l = 0; l < 3; l++) {
    if (l === open) continue;
    // tosiqlar ANCHA kam: bazа 0.15 + darajaga 0.022, ustida biom koeffitsienti
    const p = Math.min(.40, .15 + lv * .022) * hz;
    if (Math.random() > p) continue;
    filled++;
    const r = Math.random();
    let kind = KIND.BAR;
    if (lv >= 2 && r > .74) kind = KIND.WALL;
    else if (lv >= 2 && r > .56) kind = KIND.CONE;
    else if (lv >= 1 && r > .38) kind = KIND.CAR;
    else if (lv >= 3 && r > .24) kind = KIND.TRUCK;
    else if (lv >= 4 && r > .12) kind = KIND.WALL;
    addObj(kind, l, z);
  }
  // ikkala yon yo'lak ham band bo'lsa — kamida bitta xavfsiz yo'l qoladi
  if (filled >= 2) {
    const extra = Math.random();
    let k = null;
    if (extra < .28) k = KIND.NITRO;
    else if (extra < .48) k = KIND.SH;
    else if (extra < .56) k = KIND.MAG;
    else if (extra < .62) k = KIND.SH_PLUS;
    else if (extra < .68) k = KIND.MAG_PLUS;
    if (k && portalLane < 0) addObj(k, open, z + 5);
  }
  if (portalLane >= 0) return;
  // boʼsh yoʼlakka mukofot
  const luck = G.luck ? .12 : 0;
  const rr = Math.random();
  if (rr < .60 - luck) { const n = 4 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) addObj(KIND.COIN, open, z + i * 2.2); }
  else if (rr < .74 - luck) addObj(KIND.NITRO, open, z);
  else if (rr < .83 - luck) addObj(KIND.SH, open, z);
  else if (rr < .865 - luck) addObj(KIND.SH_PLUS, open, z);
  else if (rr < .895 - luck) addObj(KIND.MAG, open, z);
  else if (rr < .925 - luck) addObj(KIND.MAG_PLUS, open, z);
  else if (rr < .965 - luck) { if (lv >= 2) addObj(KIND.LIFE, open, z); else addObj(KIND.COIN, open, z); }
  else { if (lv >= 2) addObj(KIND.LIFE_PLUS, open, z); else addObj(KIND.COIN, open, z); }
  // "Baxt" perk: qo'shimcha kuch chiqadi
  if (G.luck && Math.random() < .28) addObj(Math.random() < .5 ? KIND.NITRO : KIND.SH, open, z + 3.4);
  // boʼsh qatorda ham faqat havasiz barer (kam hollarda)
  if (!filled && Math.random() < .18 * hz) addObj(KIND.BAR, (open + 1) % 3, z);
}

function burst(x, y, z, n, col, pow) {
  pow = pow || 1;
  const q = G.quality || 'high';
  const maxParts = q === 'low' ? 36 : (q === 'medium' ? 75 : 140);
  if (q === 'low') n = Math.max(2, Math.round(n * 0.4));
  else if (q === 'medium') n = Math.max(3, Math.round(n * 0.7));
  if (G.parts.length >= maxParts) return;
  const allow = Math.min(n, maxParts - G.parts.length);
  for (let i = 0; i < allow; i++) {
    const p = PART_POOL.pop() || {};
    p.x = x; p.y = y; p.z = z;
    p.vx = (Math.random() - .5) * 6 * pow;
    p.vy = Math.random() * 5 * pow;
    p.vz = (Math.random() - .5) * 6 * pow;
    p.l = .45 + Math.random() * .5;
    p.t = 0; p.col = col; p.s = .07 + Math.random() * .13;
    G.parts.push(p);
  }
}

/* --------------------------- ТОЧНО 6 БИОМОВ И 6 ИЗМЕРЕНИЙ --------------------------- */
const BIOMES = [
  {
    id: 0,
    band: 0,
    diff: 1,
    hz: 0.80,
    name: 'НЕОНОВЫЙ МЕГАПОЛИС',
    props: 'city',
    sky0: '#070a20', sky1: '#180b3c', sky2: '#40104a',
    sun0: '#ffe08a', sun1: '#ff2fb9', sun2: '#6d1fa0',
    road: 'rgba(21,23,43,0.85)', roadAlt: 'rgba(28,31,56,0.85)',
    neon: '#00e5ff', curbc: '#ff2fb9', sil: '#060714',
    gnd0: '#100a26', gnd1: '#03030a', star: '#dfeaff'
  },
  {
    id: 1,
    band: 1,
    diff: 2,
    hz: 0.95,
    name: 'КРИСТАЛЬНАЯ ПУСТЫНЯ',
    props: 'crystal',
    sky0: '#1e0520', sky1: '#4a1230', sky2: '#8c2230',
    sun0: '#fffbeb', sun1: '#f59e0b', sun2: '#b45309',
    road: 'rgba(42,22,28,0.88)', roadAlt: 'rgba(56,28,36,0.88)',
    neon: '#f59e0b', curbc: '#ef4444', sil: '#1a060e',
    gnd0: '#330f18', gnd1: '#0e0206', star: '#fed7aa'
  },
  {
    id: 2,
    band: 2,
    diff: 3,
    hz: 1.10,
    name: 'ЛЕДЯНАЯ ОРБИТА',
    props: 'ice',
    sky0: '#021024', sky1: '#06264c', sky2: '#14588e',
    sun0: '#ffffff', sun1: '#7dd3fc', sun2: '#0284c7',
    road: 'rgba(14,32,56,0.88)', roadAlt: 'rgba(20,44,74,0.88)',
    neon: '#38bdf8', curbc: '#e0f2fe', sil: '#041524',
    gnd0: '#0b2e4c', gnd1: '#020d18', star: '#f0f9ff'
  },
  {
    id: 3,
    band: 2,
    diff: 3,
    hz: 1.20,
    name: 'ЛАВА И МАГМА',
    props: 'lava',
    sky0: '#180303', sky1: '#3c0909', sky2: '#721208',
    sun0: '#fef08a', sun1: '#f97316', sun2: '#dc2626',
    road: 'rgba(34,14,14,0.90)', roadAlt: 'rgba(46,18,18,0.90)',
    neon: '#ff5500', curbc: '#fbbf24', sil: '#140404',
    gnd0: '#320b0b', gnd1: '#0d0202', star: '#fed7aa'
  },
  {
    id: 4,
    band: 3,
    diff: 4,
    hz: 1.30,
    name: 'ИЗУМРУДНЫЙ ЛЕС',
    props: 'bio',
    sky0: '#011c14', sky1: '#053828', sky2: '#0b5e40',
    sun0: '#ecfdf5', sun1: '#34d399', sun2: '#059669',
    road: 'rgba(12,34,22,0.88)', roadAlt: 'rgba(18,48,32,0.88)',
    neon: '#10b981', curbc: '#6ee7b7', sil: '#02160d',
    gnd0: '#062d1d', gnd1: '#01100a', star: '#d1fae5'
  },
  {
    id: 5,
    band: 3,
    diff: 4,
    hz: 1.40,
    name: 'КОСМИЧЕСКАЯ АНОМАЛИЯ',
    props: 'cosmic',
    sky0: '#040010', sky1: '#120028', sky2: '#2a044e',
    sun0: '#ffffff', sun1: '#e879f9', sun2: '#701a75',
    road: 'rgba(18,8,38,0.92)', roadAlt: 'rgba(28,12,54,0.92)',
    neon: '#a855f7', curbc: '#fbbf24', sil: '#0a0218',
    gnd0: '#15062a', gnd1: '#04000c', star: '#fef08a'
  },
  {
    id: 6,
    band: 3,
    diff: 4,
    hz: 1.45,
    name: 'ПОДВОДНЫЙ ОКЕАН',
    props: 'tech',
    sky0: '#020b18', sky1: '#051d38', sky2: '#0a3d62',
    sun0: '#cffafe', sun1: '#06b6d4', sun2: '#0284c7',
    road: 'rgba(8,28,48,0.90)', roadAlt: 'rgba(14,40,68,0.90)',
    neon: '#00f0ff', curbc: '#2dd4bf', sil: '#020c1a',
    gnd0: '#04162c', gnd1: '#01060e', star: '#bae6fd'
  },
  {
    id: 7,
    band: 3,
    diff: 4,
    hz: 1.50,
    name: 'МАГИЧЕСКИЙ МИР',
    props: 'rift',
    sky0: '#1a052e', sky1: '#3b0764', sky2: '#701a75',
    sun0: '#ffffff', sun1: '#c084fc', sun2: '#9333ea',
    road: 'rgba(38,16,56,0.90)', roadAlt: 'rgba(52,22,76,0.90)',
    neon: '#c084fc', curbc: '#f472b6', sil: '#130322',
    gnd0: '#230638', gnd1: '#08010e', star: '#f5d0fe'
  }
];

const DIMENSIONS = [
  {
    id: 0,
    name: 'НЕОНОВОЕ ИЗМЕРЕНИЕ',
    desc: 'Коридор гиперускорения: скорость +35%, удвоение очков (×2.0)',
    scoreMul: 2.0,
    speedBoost: 1.35,
    props: 'city',
    sky0: '#001a2c', sky1: '#003e66', sky2: '#0088cc',
    sun0: '#e0ffff', sun1: '#00ffff', sun2: '#005588',
    road: 'rgba(0,35,55,0.92)', roadAlt: 'rgba(0,50,80,0.92)',
    neon: '#00ffff', curbc: '#80ffff', sil: '#001020',
    gnd0: '#002540', gnd1: '#000810', star: '#e0ffff'
  },
  {
    id: 1,
    name: 'КРИСТАЛЬНЫЙ ЛАБИРИНТ',
    desc: 'Кристальный каньон: изобилие кристаллов и умножение очков (×2.2)',
    scoreMul: 2.2,
    speedBoost: 1.25,
    props: 'crystal',
    sky0: '#2a1a00', sky1: '#553600', sky2: '#996600',
    sun0: '#fffbe0', sun1: '#ffd700', sun2: '#b8860b',
    road: 'rgba(50,35,0,0.92)', roadAlt: 'rgba(70,50,0,0.92)',
    neon: '#ffd700', curbc: '#fff080', sil: '#1f1400',
    gnd0: '#3d2b00', gnd1: '#0f0a00', star: '#fffbe0'
  },
  {
    id: 2,
    name: 'ЛЕДЯНОЙ КОСМОС',
    desc: 'Нулевое трение в открытом космосе: сверхскорость (×2.4)',
    scoreMul: 2.4,
    speedBoost: 1.40,
    props: 'ice',
    sky0: '#02182c', sky1: '#083866', sky2: '#1e68aa',
    sun0: '#f0f9ff', sun1: '#38bdf8', sun2: '#0284c7',
    road: 'rgba(10,32,60,0.92)', roadAlt: 'rgba(18,48,85,0.92)',
    neon: '#38bdf8', curbc: '#bae6fd', sil: '#041528',
    gnd0: '#0c3358', gnd1: '#020d18', star: '#ffffff'
  },
  {
    id: 3,
    name: 'МАГМАТИЧЕСКИЙ РАЗЛОМ',
    desc: 'Огненный шторм кинетической плазмы: экстремальный множитель (×2.6)',
    scoreMul: 2.6,
    speedBoost: 1.30,
    props: 'lava',
    sky0: '#330a00', sky1: '#661a00', sky2: '#bb3300',
    sun0: '#ffeedd', sun1: '#ff4400', sun2: '#991100',
    road: 'rgba(55,15,0,0.92)', roadAlt: 'rgba(80,22,0,0.92)',
    neon: '#ff4400', curbc: '#ffaa00', sil: '#200600',
    gnd0: '#401200', gnd1: '#100400', star: '#ffeedd'
  },
  {
    id: 4,
    name: 'ЗАБЫТАЯ БИОСФЕРА',
    desc: 'Биолюминесцентные потоки чистой энергии: сбор бонусов (×2.8)',
    scoreMul: 2.8,
    speedBoost: 1.20,
    props: 'bio',
    sky0: '#001a14', sky1: '#003b2c', sky2: '#00664d',
    sun0: '#e0fff2', sun1: '#00ff88', sun2: '#006633',
    road: 'rgba(0,35,25,0.92)', roadAlt: 'rgba(0,50,38,0.92)',
    neon: '#00ff88', curbc: '#80ffc4', sil: '#00120d',
    gnd0: '#00261b', gnd1: '#000806', star: '#e0fff2'
  },
  {
    id: 5,
    name: 'ГРАВИТАЦИОННАЯ АНОМАЛИЯ',
    desc: 'Искривление пространства-времени: максимальный множитель очков (×3.5)',
    scoreMul: 3.5,
    speedBoost: 1.50,
    props: 'cosmic',
    sky0: '#140026', sky1: '#2e0057', sky2: '#520099',
    sun0: '#ffe6f7', sun1: '#ff00aa', sun2: '#660044',
    road: 'rgba(28,0,50,0.92)', roadAlt: 'rgba(42,0,72,0.92)',
    neon: '#ff00aa', curbc: '#00ffff', sil: '#0e001a',
    gnd0: '#22003b', gnd1: '#08000f', star: '#ffe6f7'
  }
];
/* --------------------------- PHASE 5: DINAMIK BIOM HODISALARI --------------------------- */
const BIOME_EVENTS = {
  city: {
    key: 'neon_storm',
    name: 'НЕОНОВЫЙ ШТОРМ',
    props: 'city',
    banner: '⛈️ НЕОНОВЫЙ ШТОРМ: КИБЕР-ЛИВЕНЬ!',
    type: 'rain',
    color: '#00e5ff',
    colorAlt: '#ff2fb9',
    streakLen: 18,
    soundChords: [523, 659, 784, 1046],
    soundDur: 0.35,
    soundVol: 0.16
  },
  crystal: {
    key: 'crystal_storm',
    name: 'КРИСТАЛЬНАЯ БУРЯ',
    props: 'crystal',
    banner: '🌪️ КРИСТАЛЬНАЯ БУРЯ: ЗОЛОТОЙ ВИХРЬ!',
    type: 'dust',
    color: '#fbbf24',
    colorAlt: '#d946ef',
    streakLen: 8,
    soundChords: [440, 554, 659, 880],
    soundDur: 0.38,
    soundVol: 0.16
  },
  ice: {
    key: 'ice_blizzard',
    name: 'ЛЕДЯНАЯ МЕТЕЛЬ',
    props: 'ice',
    banner: '❄️ ЛЕДЯНАЯ МЕТЕЛЬ: КРИСТАЛЬНЫЙ БУРАН!',
    type: 'blizzard',
    color: '#7dd3fc',
    colorAlt: '#ffffff',
    streakLen: 10,
    soundChords: [659, 784, 987, 1318],
    soundDur: 0.36,
    soundVol: 0.16
  },
  lava: {
    key: 'magma_surge',
    name: 'МАГМАТИЧЕСКИЙ ВСПЛЕСК',
    props: 'lava',
    banner: '🔥 МАГМАТИЧЕСКИЙ ВСПЛЕСК: ПЛАЗМЕННЫЕ ИСКРЫ!',
    type: 'embers',
    color: '#ff5500',
    colorAlt: '#fef08a',
    streakLen: 6,
    soundChords: [220, 277, 330, 440],
    soundDur: 0.42,
    soundVol: 0.18
  },
  bio: {
    key: 'spore_drift',
    name: 'СПОРОПАД БИОСФЕРЫ',
    props: 'bio',
    banner: '🌿 СПОРОПАД БИОСФЕРЫ: ЛЮМИНЕСЦЕНТНЫЙ ТУМАН!',
    type: 'spores',
    color: '#34d399',
    colorAlt: '#10b981',
    streakLen: 5,
    soundChords: [392, 493, 587, 784],
    soundDur: 0.40,
    soundVol: 0.16
  },
  cosmic: {
    key: 'quantum_rift',
    name: 'КВАНТОВЫЙ РАЗЛОМ',
    props: 'cosmic',
    banner: '🌌 КВАНТОВЫЙ РАЗЛОМ: ЭНЕРГЕТИЧЕСКИЙ СДВИГ!',
    type: 'quantum',
    color: '#e879f9',
    colorAlt: '#00f5ff',
    streakLen: 12,
    soundChords: [587, 739, 880, 1174],
    soundDur: 0.40,
    soundVol: 0.18
  },
  tech: {
    key: 'electro_surge',
    name: 'ЭЛЕКТРИЧЕСКИЙ РАЗРЯД',
    props: 'tech',
    banner: '⚡ СОБЫТИЕ: ЭЛЕКТРИЧЕСКИЙ РАЗРЯД · ПЕРЕГРУЗКА СЕТИ!',
    type: 'spark',
    color: '#f59e0b',
    colorAlt: '#06b6d4',
    streakLen: 10,
    soundChords: [330, 440, 554, 659],
    soundDur: 0.35,
    soundVol: 0.18
  },
  rift: {
    key: 'aether_flux',
    name: 'ЭФИРНЫЙ ВОДОПАД',
    props: 'rift',
    banner: '🌌 СОБЫТИЕ: ЭФИРНЫЙ ВОДОПАД · НЕБЕСНЫЙ СДВИГ!',
    type: 'aether',
    color: '#818cf8',
    colorAlt: '#38bdf8',
    streakLen: 14,
    soundChords: [523, 659, 830, 1046],
    soundDur: 0.40,
    soundVol: 0.18
  }
};

function initBiomeEventParticles() {
  if (G.biomeEventParticles && G.biomeEventParticles.length >= 70) return;
  G.biomeEventParticles = [];
  for (let i = 0; i < 70; i++) {
    G.biomeEventParticles.push({
      x: (Math.random() - 0.5) * 26,
      y: Math.random() * 6.5 + 0.5,
      z: 4.0 + Math.random() * 58,
      vx: 0, vy: 0, vz: 0,
      size: 1.5 + Math.random() * 2,
      alpha: 0.35,
      seed: Math.random(),
      a: Math.random() * 6.28
    });
  }
}

function triggerBiomeEvent(keyOrProps, silent) {
  if (!G.running || G.over) return false;
  if (G.inDimension || G.bossActive || G.bossWarningActive) return false;

  const bm = trackBiome();
  const targetProps = keyOrProps || bm.props || 'city';
  let ev = BIOME_EVENTS[targetProps];
  if (!ev) {
    for (const k in BIOME_EVENTS) {
      if (BIOME_EVENTS[k].key === targetProps) { ev = BIOME_EVENTS[k]; break; }
    }
  }
  if (!ev) ev = BIOME_EVENTS.city;

  G.biomeEventActive = true;
  G.biomeEventTimer = 16.0;
  G.biomeEventCooldown = 24.0 + Math.random() * 6.0;
  G.biomeEventKey = ev.key;
  G.biomeEventName = ev.name;
  G.biomeEventProps = ev.props || targetProps;

  initBiomeEventParticles();
  for (let i = 0; i < G.biomeEventParticles.length; i++) {
    const p = G.biomeEventParticles[i];
    p.seed = Math.random();
    p.a = Math.random() * 6.28;
    p.x = (Math.random() - 0.5) * 26;
    p.y = Math.random() * 6.5 + 0.5;
    p.z = 4.0 + Math.random() * 58;
    p.size = (1.5 + Math.random() * 2) * (ev.type === 'rain' ? 1.0 : (ev.type === 'spores' ? 1.5 : 1.2));
    p.alpha = 0.30 + Math.random() * 0.30;

    if (ev.type === 'rain') {
      p.vx = -1.8 - Math.random() * 1.5;
      p.vy = -18 - Math.random() * 7;
      p.vz = -12 - Math.random() * 5;
    } else if (ev.type === 'dust') {
      p.vx = -10 - Math.random() * 6;
      p.vy = (Math.random() - 0.5) * 1.6;
      p.vz = -6 - Math.random() * 5;
    } else if (ev.type === 'blizzard') {
      p.vx = 8 + Math.random() * 7;
      p.vy = -2.5 - Math.random() * 2.0;
      p.vz = -8 - Math.random() * 5;
    } else if (ev.type === 'embers') {
      p.vx = (Math.random() - 0.5) * 2.0;
      p.vy = 4.5 + Math.random() * 4.5;
      p.vz = -3 - Math.random() * 4;
      p.y = 0.15 + Math.random() * 0.8;
    } else if (ev.type === 'spores') {
      p.vx = (Math.random() - 0.5) * 1.5;
      p.vy = (Math.random() - 0.5) * 1.0;
      p.vz = -2.5 - Math.random() * 3.0;
    } else if (ev.type === 'quantum') {
      p.vx = Math.cos(p.a) * 4.0;
      p.vy = Math.sin(p.a) * 3.0;
      p.vz = -8 - Math.random() * 6;
    } else if (ev.type === 'spark') {
      p.vx = (Math.random() - 0.5) * 8.0;
      p.vy = -8.0 - Math.random() * 8.0;
      p.vz = -10 - Math.random() * 8;
    } else if (ev.type === 'aether') {
      p.vx = (Math.sin(p.a) * 2.5);
      p.vy = 2.0 + Math.random() * 3.5;
      p.vz = -6 - Math.random() * 6;
    }
  }

  if (!silent) {
    toast(ev.banner, 3500);
    if (Sound && typeof Sound.biomeEvent === 'function') {
      Sound.biomeEvent(G.biomeEventProps);
    }
  }
  return true;
}

function updateBiomeEventParticles(dt) {
  if (!G.biomeEventParticles || !G.biomeEventParticles.length) return;
  const ev = BIOME_EVENTS[G.biomeEventProps] || BIOME_EVENTS.city;
  const isLow = G.quality === 'low';
  const count = isLow ? 38 : (G.quality === 'medium' ? 54 : 70);
  const roadSpeed = G.speed || 24;

  for (let i = 0; i < count; i++) {
    const p = G.biomeEventParticles[i];
    if (ev.type === 'spores') {
      p.x += (Math.cos(G.t * 1.6 + p.seed * 10) * 1.5 + p.vx) * dt;
      p.y += (Math.sin(G.t * 2.0 + p.seed * 15) * 1.2 + p.vy) * dt;
      p.z += (p.vz - roadSpeed * 0.25) * dt;
    } else if (ev.type === 'quantum') {
      p.a += dt * 3.5;
      p.x += (Math.cos(p.a) * 4.0 + p.vx * 0.4) * dt;
      p.y += (Math.sin(p.a) * 3.0 + p.vy * 0.4) * dt;
      p.z += (p.vz - roadSpeed * 0.5) * dt;
    } else if (ev.type === 'aether') {
      p.a += dt * 2.2;
      p.x += (Math.sin(p.a) * 1.8 + p.vx) * dt;
      p.y += p.vy * dt;
      p.z += (p.vz - roadSpeed * 0.35) * dt;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += (p.vz - roadSpeed * (ev.type === 'embers' ? 0.20 : 0.45)) * dt;
    }

    if (p.z < 2.0) {
      p.z = 58.0 + Math.random() * 8.0;
      p.x = (Math.random() - 0.5) * 26;
      p.y = ev.type === 'embers' ? (0.15 + Math.random() * 0.4) : (Math.random() * 6.5 + 0.5);
    }
    if (ev.type === 'rain') {
      if (p.y < 0.1) {
        p.y = 7.0 + Math.random() * 1.8;
        p.z = 8.0 + Math.random() * 52.0;
        p.x = (Math.random() - 0.5) * 24;
      }
    } else if (ev.type === 'embers') {
      if (p.y > 7.5) {
        p.y = 0.15 + Math.random() * 0.4;
        p.z = 8.0 + Math.random() * 52.0;
        p.x = (Math.random() - 0.5) * 22;
      }
    } else {
      if (p.x < -16) p.x += 32;
      if (p.x > 16) p.x -= 32;
      if (p.y < 0.1) p.y += 7.0;
      if (p.y > 8.0) p.y -= 7.0;
    }
  }
}

function drawBiomeWeather(bm) {
  if (!G.biomeEventActive || !G.biomeEventParticles || G.inDimension) return;
  const ev = BIOME_EVENTS[G.biomeEventProps] || BIOME_EVENTS.city;
  const count = G.quality === 'low' ? 38 : (G.quality === 'medium' ? 54 : 70);

  const fade = Math.max(0, Math.min(1, Math.min(G.biomeEventTimer / 1.5, (16.0 - G.biomeEventTimer) / 1.5)));
  if (fade <= 0) return;

  ctx.save();
  for (let i = 0; i < count; i++) {
    const p = G.biomeEventParticles[i];
    proj([p.x, p.y, p.z], _pw);
    if (!_pw.vis || _pw.x < -60 || _pw.x > W + 60 || _pw.y < -60 || _pw.y > H + 60) continue;

    if (ev.type === 'rain') {
      proj([p.x - p.vx * 0.035, p.y - p.vy * 0.035, p.z + 1.2], _pw2);
      ctx.strokeStyle = p.seed > 0.4 ? ev.color : ev.colorAlt;
      ctx.lineWidth = Math.max(1.0, Math.min(2.2, _pw.s * 0.022));
      ctx.globalAlpha = Math.max(0, Math.min(0.55, p.alpha * fade));
      ctx.beginPath();
      ctx.moveTo(_pw2.x, _pw2.y);
      ctx.lineTo(_pw.x, _pw.y);
      ctx.stroke();

      if (p.y < 0.4 && _pw.dz < 35) {
        ctx.strokeStyle = ev.color;
        ctx.globalAlpha = Math.max(0, Math.min(0.25, p.alpha * fade * 0.5));
        ctx.beginPath();
        ctx.ellipse(_pw.x, _pw.y, _pw.s * 0.03, _pw.s * 0.012, 0, 0, 6.28);
        ctx.stroke();
      }
    } else if (ev.type === 'dust') {
      const sz = Math.max(1.4, Math.min(6.0, p.size * _pw.s * 0.022));
      const glint = Math.sin(G.t * 5 + p.seed * 20);
      ctx.fillStyle = glint > 0.6 ? '#ffffff' : (p.seed > 0.5 ? ev.color : ev.colorAlt);
      ctx.globalAlpha = Math.max(0, Math.min(0.50, (p.alpha + glint * 0.12) * fade));
      ctx.beginPath();
      ctx.moveTo(_pw.x, _pw.y - sz * 1.3);
      ctx.lineTo(_pw.x + sz, _pw.y);
      ctx.lineTo(_pw.x, _pw.y + sz * 1.3);
      ctx.lineTo(_pw.x - sz, _pw.y);
      ctx.fill();
    } else if (ev.type === 'blizzard') {
      const sz = Math.max(1.5, Math.min(5.5, p.size * _pw.s * 0.022));
      ctx.fillStyle = p.seed > 0.6 ? '#ffffff' : ev.color;
      ctx.globalAlpha = Math.max(0, Math.min(0.52, p.alpha * fade));
      ctx.beginPath();
      ctx.ellipse(_pw.x, _pw.y, sz * 1.7, sz * 0.85, -0.25, 0, 6.28);
      ctx.fill();
    } else if (ev.type === 'embers') {
      const sz = Math.max(1.4, Math.min(5.5, p.size * _pw.s * 0.024));
      const lifeFrac = Math.min(1, p.y / 7.0);
      ctx.fillStyle = lifeFrac < 0.35 ? '#fff3b0' : (lifeFrac < 0.7 ? ev.color : '#dc2626');
      ctx.globalAlpha = Math.max(0, Math.min(0.58, p.alpha * (1 - lifeFrac * 0.35) * fade));
      ctx.beginPath();
      ctx.arc(_pw.x, _pw.y, sz, 0, 6.28);
      ctx.fill();
    } else if (ev.type === 'spores') {
      const sz = Math.max(1.8, Math.min(6.5, p.size * _pw.s * 0.025));
      const pulse = 0.6 + 0.4 * Math.sin(G.t * 3 + p.seed * 12);
      ctx.fillStyle = p.seed > 0.5 ? ev.color : ev.colorAlt;
      ctx.globalAlpha = Math.max(0, Math.min(0.48, p.alpha * pulse * fade));
      ctx.beginPath();
      ctx.arc(_pw.x, _pw.y, sz, 0, 6.28);
      ctx.fill();
      if (G.quality !== 'low') {
        ctx.globalAlpha = Math.max(0, Math.min(0.18, p.alpha * pulse * fade * 0.4));
        ctx.beginPath();
        ctx.arc(_pw.x, _pw.y, sz * 2.2, 0, 6.28);
        ctx.fill();
      }
    } else if (ev.type === 'quantum') {
      const sz = Math.max(1.8, Math.min(7.0, p.size * _pw.s * 0.026));
      ctx.fillStyle = p.seed > 0.5 ? ev.color : ev.colorAlt;
      ctx.globalAlpha = Math.max(0, Math.min(0.50, p.alpha * fade));
      ctx.save();
      ctx.translate(_pw.x, _pw.y);
      ctx.rotate(p.a);
      ctx.beginPath();
      ctx.moveTo(0, -sz * 1.5);
      ctx.lineTo(sz * 0.6, 0);
      ctx.lineTo(0, sz * 1.5);
      ctx.lineTo(-sz * 0.6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (ev.type === 'spark') {
      proj([p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.z + 0.8], _pw2);
      ctx.strokeStyle = p.seed > 0.4 ? ev.color : ev.colorAlt;
      ctx.lineWidth = Math.max(1.2, Math.min(2.8, _pw.s * 0.025));
      ctx.globalAlpha = Math.max(0, Math.min(0.65, p.alpha * fade));
      ctx.beginPath();
      ctx.moveTo(_pw2.x, _pw2.y);
      ctx.lineTo(_pw.x, _pw.y);
      ctx.stroke();
    } else if (ev.type === 'aether') {
      const sz = Math.max(1.6, Math.min(6.2, p.size * _pw.s * 0.025));
      ctx.fillStyle = p.seed > 0.5 ? ev.color : ev.colorAlt;
      ctx.globalAlpha = Math.max(0, Math.min(0.52, p.alpha * fade));
      ctx.beginPath();
      ctx.arc(_pw.x, _pw.y, sz, 0, 6.28);
      ctx.fill();
    }
  }
  ctx.restore();
}

const BAND_NAME = ['ЛЁГКАЯ', 'СРЕДНЯЯ', 'СЛОЖНАЯ', 'ЭКСТРЕМАЛЬНАЯ'];
const TRACK_SEC = 45;           // Biomlar 45 soniyada bir almashadi
const TRANS_DUR = 2.4;          // boy va hayajonli biom almashish animatsiyasi (soniya)
const CHECKPOINT_TRACK_GAP = 18;
const BM_MIX_KEYS = ['sky0', 'sky1', 'sky2', 'sun0', 'sun1', 'sun2', 'road', 'roadAlt', 'neon', 'curbc', 'sil', 'gnd0', 'gnd1', 'star'];

/** Poyga qiyinligi — daraja va masofaga qarab 0..3 band */
/* Daraja uchun kerakli masofa: 1→2 = 1000 m, 2→3 = 1500 m … 9→10 = 5000 m.
   10-darajadan keyin har daraja 5000 m (oyin cheksiz davom etadi). */
function levelNeed(lv) { return Math.min(5000, 1000 + (Math.max(1, (lv | 0) || 1) - 1) * 500); }
/* Silliq qiyinlik: 0 = boshlanish, 1 = ~9 km. Daraja raqami sekin oshadi,
   shuning uchun qiyinlik asosan masofa bilan yumshoq ko'tariladi. */
function diff01() { return Math.max(0, Math.min(1, (((G && G.dist) || 0) - 250) / 8750)); }
/* Masofani o'qiladigan ko'rinishda: 850 m · 2.4 km · 12.5 km */
function km(m) {
  m = Math.max(0, m || 0);
  return m < 1000 ? Math.round(m) + ' м' : (Math.round(m / 100) / 10) + ' км';
}
/* Sonlarni bo'shliq bilan guruhlash: 12 480 */
function num(n) {
  n = Math.max(0, Math.round(n || 0));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
/* Koeffitsiyentlarni toza ko'rsatish: 9 → ×9, 1.5 → ×1.5 */
function mul(v) {
  v = Math.round((v || 1) * 100) / 100;
  return '×' + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2).replace(/0$/, ''));
}
/* Qiyinlik bosqichi (0..3) — biom shu bosqichga mos yo'l tanlaydi */
function difficultyBand() {
  const lv = (G && G.level) || 1, d = (G && G.dist) || 0;
  if (lv >= 8 || d >= 9000) return 3;
  if (lv >= 5 || d >= 4000) return 2;
  if (lv >= 2 || d >= 1000) return 1;
  return 0;
}

/* --- Rang aralashtirish (hex -> hex, rgba -> rgba) --- */
function _parseCol(s) {
  if (!s) return [0, 0, 0, 1, true];
  if (s.charAt(0) === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0, 1, true];
  }
  const p = s.replace(/rgba?\(/, '').replace(')', '').split(/[, ]+/);
  return [parseFloat(p[0]) || 0, parseFloat(p[1]) || 0, parseFloat(p[2]) || 0, p.length > 3 ? (parseFloat(p[3]) || 1) : 1, false];
}
const _hx = (n) => ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2);
function mixColor(a, b, t) {
  const A = _parseCol(a), B = _parseCol(b);
  if (A[4] && B[4]) return '#' + _hx(A[0] + (B[0] - A[0]) * t) + _hx(A[1] + (B[1] - A[1]) * t) + _hx(A[2] + (B[2] - A[2]) * t);
  return 'rgba(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' +
    Math.round(A[2] + (B[2] - A[2]) * t) + ',' + (A[3] + (B[3] - A[3]) * t).toFixed(3) + ')';
}
let _bmMix = null, _bmMixKey = '';
function currentBiome() {
  if (G && G.inDimension && DIMENSIONS[G.dimensionIdx]) {
    return DIMENSIONS[G.dimensionIdx];
  }
  const total = BIOMES.length;
  const i = (((G && G.trackIdx) | 0) % total + total) % total;
  const bm = BIOMES[i];
  if (!G) return bm;
  const tr = G.trans == null ? TRANS_DUR : G.trans;
  const prev = G.prevTrackIdx;
  if (tr >= TRANS_DUR || prev == null || prev === i) return bm;
  const old = BIOMES[((prev % total) + total) % total] || bm;
  const t = Math.max(0, Math.min(1, tr / TRANS_DUR));
  const key = i + '>' + prev + '@' + Math.round(t * 24);
  if (_bmMixKey === key && _bmMix) return _bmMix;
  const out = { name: bm.name, props: bm.props, band: bm.band, diff: bm.diff, hz: bm.hz };
  for (const k of BM_MIX_KEYS) out[k] = mixColor(old[k] == null ? bm[k] : old[k], bm[k], t);
  _bmMix = out; _bmMixKey = key;
  return out;
}
/** Hozirgi yoʼlning sof (aralashtirilmagan) paletresi — banner uchun */
function trackBiome() {
  const total = BIOMES.length;
  const i = (((G && G.trackIdx) | 0) % total + total) % total;
  return BIOMES[i] || BIOMES[0];
}
function nextTrack(auto) {
  const nextIdx = (G.trackIdx + 1) % BIOMES.length;
  G.prevTrackIdx = G.trackIdx;
  G.trackIdx = nextIdx;
  G.trackT = 0;
  G.trans = auto ? 0 : TRANS_DUR;
  _bmMixKey = '';
  if (auto) {
    G.nextBiomeDist = G.dist + 1500;
    G.nextCheckpointAt = G.nextBiomeDist - 500;
    G.checkpointSpawned = false;
    G.checkpointCrossed = false;
    const cpHud = el._cpHud || (el._cpHud = $('#checkpointHud'));
    if (cpHud) cpHud.classList.add('hidden');
  }
  const nb = trackBiome();
  buildBackdrop();
  if (auto) {
    G.biomeEventActive = false; G.biomeEventTimer = 0; G.biomeEventKey = ''; G.biomeEventName = '';
    G.biomeEventCooldown = 18.0;
    const beh3 = el._biomeEventHud || (el._biomeEventHud = $('#biomeEventHud'));
    if (beh3) beh3.classList.add('hidden');
    G.flash = 0.85;
    G.shake = Math.max(G.shake || 0, .55);
    toast('⚡ ПЕРЕХОД: ' + nb.name + ' · ' + BAND_NAME[nb.band] + ' (' + '★'.repeat(nb.diff) + ')', 3200);
    Sound.chord([440, 554, 659, 880, 1108], .6, .22);
    for (let i = 0; i < 6; i++) {
      const bx = (i - 2.5) * .85;
      burst(bx, .5 + (i % 2) * .4, 10 + (i % 3) * 4, 16, nb.neon, 1.8);
      burst(bx, .3, 14, 10, nb.curbc || '#fff', 1.4);
    }
  }
  return nb;
}
function addFloatingText(x, y, z, text, col) {
  G.texts || (G.texts = []);
  if (G.texts.length > 25) G.texts.shift();
  G.texts.push({ x, y, z, text, col: col || '#ffd166', t: 0, l: 0.95 });
}

function buildBackdrop() {
  G.stars = [];
  const N = G.quality === 'low' ? 60 : (G.quality === 'medium' ? 105 : 150);
  for (let i = 0; i < N; i++) G.stars.push({ x: Math.random(), y: Math.random() * .48, r: Math.random() * 1.5 + .4, tw: Math.random() * 6.28 });
  G.mountains = [];
  let x = -0.1;
  while (x < 1.3) { const w = .07 + Math.random() * .14, h = .04 + Math.random() * .16; G.mountains.push({ x, w, h }); x += w * .8; }
  G.buildings = [];
  let bx = -0.05;
  while (bx < 1.15) {
    const bw = 0.035 + Math.random() * 0.055, bh = 0.06 + Math.random() * 0.18;
    const wins = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) if (Math.random() < 0.6) wins.push([c, r]);
    G.buildings.push({ x: bx, w: bw, h: bh, wins, beacon: Math.random() < 0.65 });
    bx += bw + Math.random() * 0.02;
  }
  G.posts = [];
  for (let i = 0; i < 26; i++) G.posts.push(i * 7);
  /* Yo'l yon manzarasi (palma, kaktus, kristal...) — har trassa uchun yangidan */
  G.sil = [];
  let sx = -0.06;
  while (sx < 1.12) {
    const sw = 0.035 + Math.random() * 0.055;
    G.sil.push({ x: sx, w: sw, h: 0.05 + Math.random() * 0.13, k: Math.random(), a: Math.random() * 6.28 });
    sx += sw + Math.random() * 0.045;
  }
  /* Har bir biom uchun dinamik atmosfera zarrachalari (chang, qor, uchqun, spora, kvant nurlar) */
  G.biomeAtmo = [];
  const atmoCount = G.quality === 'low' ? 28 : (G.quality === 'medium' ? 52 : 75);
  for (let i = 0; i < atmoCount; i++) {
    G.biomeAtmo.push({
      x: Math.random(),
      y: Math.random(),
      r: 1.0 + Math.random() * 2.4,
      a: Math.random() * 6.28,
      seed: Math.random()
    });
  }
  if (typeof BIOME_3D !== 'undefined' && BIOME_3D.initScenery) {
    BIOME_3D.initScenery();
  }
}

/* --------------------------- RUN --------------------------- */
function bankCoins() { store.set('coins', G.coins); }

function enterDimension(dimIdx) {
  const dim = DIMENSIONS[dimIdx] || DIMENSIONS[0];
  if (G.bossActive) {
    G.bossActive = false;
    G.bossWarningActive = false;
    const bh = el._bossHud || (el._bossHud = $('#bossHud'));
    if (bh) bh.classList.add('hidden');
    G.bossEscaped = (G.bossEscaped || 0) + 1;
    G.runBossEscaped = (G.runBossEscaped || 0) + 1;
    G.meta.bossEscapes = (G.meta.bossEscapes || 0) + 1;
    const rCoins = 250, rPts = 100, rScore = 5000;
    G.coins += rCoins; G.runCoins += rCoins; ACCT.add(rPts); G.score += rScore;
    bankCoins(); store.set('meta', G.meta);
    if (typeof checkAchievementsRealtime === 'function') checkAchievementsRealtime();
    if (typeof checkMissionsInRace === 'function') checkMissionsInRace();
    toast('🌀 ПОБЕГ ЧЕРЕЗ ПОРТАЛ! Босс потерял след!', 3500);
    G.nextBossAt = G.dist + 3000;
  } else if (G.bossWarningActive) {
    G.bossWarningActive = false;
    G.nextBossAt = G.dist + 3000;
  }
  G.inDimension = true;
  G.dimensionIdx = dimIdx;
  G.dimensionTime = 45.0;
  G.portalEntryAnim = 0.85;
  if (TUTORIAL_SYSTEM.active) TUTORIAL_SYSTEM.onAction('portal');
  G.flash = 0.40; // Silliq chaqnash, o'yinchining ko'zini qamashtirmaydi va mashinani yo'qotmaydi
  G.shake = 0.45;
  G.meta.portalsEntered = (G.meta.portalsEntered || 0) + 1;
  store.set('meta', G.meta);
  Sound.chord([440, 660, 880, 1320], 0.7, 0.28);
  G.biomeEventActive = false; G.biomeEventTimer = 0; G.biomeEventKey = ''; G.biomeEventName = '';
  const beh2 = el._biomeEventHud || (el._biomeEventHud = $('#biomeEventHud'));
  if (beh2) beh2.classList.add('hidden');
  toast('⚡ ВХОД В ИЗМЕРЕНИЕ: ' + dim.name + ' (45 сек.)', 3500);
  addFloatingText(G.x, 2.0, 0, '🌀 ' + dim.name, '#d946ef');
  for (const o of G.objs) {
    if (o.z > 0 && o.z < 45 && HAZARD[o.kind]) o.dead = true;
  }
  // Seed immediate rewarding coin stream so track never appears empty for 2-3s
  for (let cz = 18; cz <= 42; cz += 12) spawnRow(cz);
  buildBackdrop();
}

function exitDimension() {
  const dim = DIMENSIONS[G.dimensionIdx] || DIMENSIONS[0];
  G.inDimension = false;
  G.dimensionTime = 0;
  G.meta.dimensionsCleared = (G.meta.dimensionsCleared || 0) + 1;
  G.runDimensionsCleared = (G.runDimensionsCleared || 0) + 1;
  const bonusScore = 10000;
  const bonusCoins = 50;
  G.score += bonusScore;
  G.coins += bonusCoins;
  G.runCoins += bonusCoins;
  G.flash = 0.35; // Silliq chiqish pulsi
  G.shake = 0.35;
  G.portalExitAnim = 0.75;
  store.set('meta', G.meta);
  Sound.chord([523, 659, 784, 1046], 0.6, 0.25);
  toast('✨ ИЗМЕРЕНИЕ ПРОЙДЕНО! Награда: +' + bonusScore + ' очков, +' + bonusCoins + ' 🪙', 4000);
  addFloatingText(G.x, 2.2, 0, '✨ НАГРАДА: +' + bonusScore, '#ffd166');
  for (const o of G.objs) {
    if (o.z > 0 && o.z < 55 && HAZARD[o.kind]) o.dead = true;
  }
  // Seed return highway coin stream so player never faces a 2-3s barren road
  for (let cz = 18; cz <= 42; cz += 12) spawnRow(cz);
  G.nextPortalAt = G.dist + 800;
  G.portalSpawned = false;
  buildBackdrop();
}

function startRun() {
  hide(el.scrMenu); hide(el.scrOver); hide(el.scrCards); hide(el.scrPause); hide(el.scrRevive); hide(el.scrHow);
  for (const o of G.objs) freeObj(o);
  Object.assign(G, {
    running: true, paused: false, over: false, t: 0, dist: 0, score: 0, lives: 4, maxLives: 4,
    level: 1, nextLevelAt: 1000, levelAt: 0, levelFrom: 0, baseSpeed: 23, bestCombo: 1, speed: 23, maxSpeed: 23, boost: 0, boostOn: false,
    portalExitAnim: 0, energon: 100, energonMax: 100, nitroT: 0, magnet: 0, magnetMax: 5, shield: 0, shieldMax: 0,
    magnetPlusTimer: 0, shieldPlusTimer: 0,
    invul: 1.2, coinMult: 1, comboHold: 3.4, combo: 1, comboT: 0, jumpV: 1, smashBonus: 0, brakePow: 0,
    lane: 1, laneX: 0, x: 0, y: 0, vy: 0, onGround: true, tilt: 0, yaw: 0, runCoins: 0,
    objs: [], parts: [], texts: [], nearMisses: 0, coinStreak: 0, spawnGap: 15, shake: 0, flash: 0, upgrades: {}, revived: false,
    trackIdx: (selectedStartingBiome != null && selectedStartingBiome >= 0 && selectedStartingBiome < 8) ? (selectedStartingBiome - 1 + 8) % 8 : -1, prevTrackIdx: null, trackT: 0, trans: 99,
    trackCheckpointWait: CHECKPOINT_TRACK_GAP,
    nextBiomeDist: 1500,
    nextCheckpointAt: 1000,
    checkpointSpawned: false,
    checkpointCrossed: false,
    nextPortalAt: 650,
    portalSpawned: false,
    inDimension: false,
    dimensionTime: 0,
    dimensionIdx: 0,
    carSpeedBonus: 0,
    carAccelMul: 1,
    nitroDrainBonus: 1,
    carHandlingMul: 1,
    driftControlMul: 1,
    magnetRadiusBonus: 0,
    bossActive: false,
    bossWarningActive: false,
    bossWarningTimer: 0,
    bossTimer: 0,
    bossDist: 20,
    bossZ: 20,
    bossX: 0,
    bossLane: 1,
    bossName: '',
    bossAttackState: 'idle',
    bossAttackTimer: 0,
    bossTargetLane: 1,
    nextBossAt: 2200,
    bossEscaped: 0,
    biomeEventActive: false,
    biomeEventTimer: 0,
    biomeEventCooldown: 14.0,
    biomeEventKey: '',
    biomeEventName: '',
    biomeEventProps: '',
    drifting: false,
    driftTime: 0,
    driftScore: 0,
    nitroUses: 0,
    runCoins: 0,
    runNitroCount: 0,
    runBossEscaped: 0,
    runNearMisses: 0,
    runDimensionsCleared: 0,
    runMaxDriftCombo: 1,
    runCheckpointsPassed: 0,
    runContinuousDrift: 0
  });
  G.meta.biomesVisited = G.meta.biomesVisited || [0];
  initBiomeEventParticles();
  const beh0 = el._biomeEventHud || (el._biomeEventHud = $('#biomeEventHud'));
  if (beh0) beh0.classList.add('hidden');
  nextTrack(false);
  G.trans = 99;   // poyga boshlanishida almashuv animatsiyasi boʼlmaydi
  const c = car();
  const upg = CAR_UPG.get(c.id);
  const upgSpeed = (upg.speed || 0) * 1.5;
  const upgAccel = 1 + (upg.accel || 0) * 0.18;
  const upgNitro = (upg.nitro || 0) * 0.15;
  const upgNitroDur = (upg.nitroDuration || 0) * 0.18;
  const upgMagnet = (upg.magnet || 0) * 1.8;
  const upgShield = (upg.shield || 0) * 3.5;
  const upgHandling = 1 + (upg.handling || 0) * 0.20;
  const upgDrift = 1 + (upg.drift || 0) * 0.25;

  G.carSpeedBonus = upgSpeed;
  G.carAccelMul = upgAccel;
  G.nitroDrainBonus = 1 / (1 + upgNitroDur);
  G.carHandlingMul = upgHandling;
  G.driftControlMul = upgDrift;
  G.magnetRadiusBonus = (upg.magnet || 0) * 0.45;

  G.shield = c.shieldStart + upgShield; G.shieldMax = Math.max(6, G.shield);
  G.magnetMax = 5 * c.magnet + upgMagnet; G.boostRate = c.boost + upgNitro;
  /* --- AKKAUNT DARAJASI bonuslari (doimiy) --- */
  G.baseSpeed = Math.round(G.baseSpeed * ACCT.speedMul() * 100) / 100;
  G.coinMult = ACCT.coinMul();
  G.energonMax += ACCT.extraEnergon();
  G.maxLives += ACCT.extraLives();
  G.jumpV *= ACCT.jumpMul();
  G.shieldMax += ACCT.extraShield();
  G.shield = Math.max(G.shield, c.shieldStart + ACCT.extraShield());
  /* --- XARID QILINGAN DOIMIY KUCHLAR --- */
  for (const u of UPGRADES) { let n = PERM.n(u.k); while (n-- > 0) { try { u.fn(); } catch {} } }
  /* --- MASHINANING OʼZ IMKONIYATI (perk) --- */
  applyPerk(c.perk);
  const pt = $('#perkTag');
  if (pt) {
    const P = c.perk ? PERKS[c.perk] : null;
    pt.innerHTML = P ? '<span>' + P.ic + '</span><span>' + P.name + '</span>' : '';
    pt.title = P ? P.desc : '';
    pt.classList.toggle('hidden', !P);
  }
  G.lives = G.maxLives; G.energon = G.energonMax;
  G.speed = G.maxSpeed = G.baseSpeed;
  G.tut = !G.tutDone;
  el.legend.classList.toggle('dim', !G.tut);
  if (G.tut) setHint(0); else setHint(-1);
  buildBackdrop(); renderLives(); updateHUD();
  for (let i = 0; i < 8; i++) spawnRow(26 + i * 12);
  el.flash.style.opacity = 0;
  toast((G.tut ? '🎓 Управление на экране · ' : '🟢 Красное — опасность, цветное — очки · ') +
    '🛣 ' + currentBiome().name + ' · новая трасса через 45 секунд', 2600);
  G.meta.plays = (G.meta.plays || 0) + 1;
  Sound.ensure(); Sound.startMusic();
}

function gameOver() {
  G.running = false; G.over = true; G.magnetPlusTimer = 0; G.shieldPlusTimer = 0; G.paused = false; setHint(-1);
  G.bossActive = false; G.bossWarningActive = false;
  G.biomeEventActive = false; G.biomeEventTimer = 0; G.biomeEventKey = ''; G.biomeEventName = '';
  const beh1 = el._biomeEventHud || (el._biomeEventHud = $('#biomeEventHud'));
  if (beh1) beh1.classList.add('hidden');
  const bh = el._bossHud || (el._bossHud = $('#bossHud'));
  if (bh) bh.classList.add('hidden');
  Sound.blip(160, .45, 'sawtooth', .28); Sound.noise(.45, .3);
  Sound.engineSet(0);
  const prevBest = Math.floor(G.meta.best || 0);
  G.meta.best = Math.max(prevBest, Math.floor(G.score));
  G.meta.farthest = Math.max(G.meta.farthest || 0, Math.floor(G.dist));
  G.meta.bestLevel = Math.max(G.meta.bestLevel || 1, G.level);
  G.meta.runs = (G.meta.runs || 0) + 1;
  G.meta.totalDist = (G.meta.totalDist || 0) + Math.floor(G.dist);
  G.meta.totalTime = (G.meta.totalTime || 0) + Math.floor(G.t || 0);
  G.meta.totalCoins = (G.meta.totalCoins || 0) + Math.floor(G.runCoins || 0);
  store.set('meta', G.meta);
  /* --- ⭐ ochko va 🪙 tanga hisobga olinadi --- */
  const pts = ACCT.runPoints(G);
  const rec = Math.floor(G.score) > prevBest && G.score > 0;
  G.lastPts = pts;
  ACCT.add(pts);
  bankCoins();
  if (typeof getMissionState === 'function') {
    const mSt = getMissionState();
    MISSIONS.forEach(m => {
      const item = (mSt.items && mSt.items[m.id]) || { cur: 0, done: false, claimed: false, notified: false };
      const val = m.getVal ? m.getVal() : 0;
      item.cur = Math.max(item.cur || 0, val);
      if (item.cur >= m.goal) { item.done = true; item.notified = true; }
      if (mSt.items) mSt.items[m.id] = item;
    });
    setMissionState(mSt);
  }
  if (typeof checkAchievementsRealtime === 'function') {
    checkAchievementsRealtime(true);
  } else if (typeof getAchieveState === 'function') {
    const aSt = getAchieveState();
    ACHIEVEMENTS.forEach(a => {
      const item = aSt[a.id] || { cur: 0, done: false, claimed: false };
      const val = a.getVal ? a.getVal() : 0;
      item.cur = Math.max(item.cur || 0, val);
      if (item.cur >= a.goal) item.done = true;
      aSt[a.id] = item;
    });
    setAchieveState(aSt);
  }
  $('#newBest').classList.toggle('hidden', !rec);
  $('#overStats').innerHTML = statHTML();
  $('#overHint').textContent = tip();
  renderOverAcct(pts, rec);
  show(el.scrOver);
  YA.submit(Math.floor(G.score));
  if (G.meta.runs % 3 === 0) YA.interstitial();
}
/* Poyga oxiridagi akkount paneli */
function renderOverAcct(pts, rec) {
  $('#oPts').textContent = '+' + pts;
  $('#oAcctCap').textContent = 'АККАУНТ · УР. ' + ACCT.lvl + ' · ⭐' + ACCT.pts + ' ОЧКОВ';
  const need = ACCT.cost(ACCT.lvl);
  $('#oBar').style.width = Math.min(100, ACCT.pts / need * 100).toFixed(1) + '%';
  const btn = $('#btnOverUp');
  if (ACCT.lvl >= ACCT.maxLvl) { $('#oAcctMsg').textContent = 'Достигнут максимальный уровень 🏆'; btn.classList.add('hidden'); }
  else if (ACCT.canUp()) { $('#oAcctMsg').innerHTML = 'Уровень можно повысить за <b>⭐' + need + '</b>!'; btn.classList.remove('hidden'); }
  else { $('#oAcctMsg').textContent = 'До следующего уровня не хватает ⭐' + (need - ACCT.pts) + ' очков'; btn.classList.add('hidden'); }
  if (rec) $('#oAcctMsg').innerHTML += ' · <b>новый рекорд +40 ⭐</b>';
}
function tip() {
  const T = [
    'Совет: высокую красную стену нельзя перепрыгнуть — только сменить полосу.',
    'Совет: низкий красный барьер и конус можно перепрыгнуть клавишей SPACE.',
    'Совет: на нитро можно таранить небольшие препятствия.',
    'Совет: зелёный щит полностью защищает от одного удара — берегите его.',
    'Совет: фиолетовый магнит притягивает монеты даже в воздухе.',
    'Совет: свободная полоса всегда найдётся — избегайте красных объектов и перестраивайтесь.',
  ];
  return T[Math.floor(Math.random() * T.length)];
}
function statHTML() {
  const rows = [
    ['ОЧКИ', num(G.score)],
    ['РАССТОЯНИЕ', km(G.dist)],
    ['УРОВЕНЬ', 'УР. ' + G.level],
    ['МАКС. СКОРОСТЬ', speedToKmh(G.maxSpeed) + ' км/ч'],
    ['ЛУЧШЕЕ КОМБО', mul(G.bestCombo || 1)],
    ['МОНЕТЫ', '+' + num(G.runCoins || 0) + ' (всего ' + num(G.coins) + ')'],
    ['УЛУЧШЕНИЯ', 'получено: ' + Object.keys(G.upgrades).length]
  ];
  return rows.map(r => '<div class="gs"><small>' + r[0] + '</small><b>' + r[1] + '</b></div>').join('');
}

/* --------------------------- PAUSE / CARDS / REVIVE --------------------------- */
function togglePause() {
  if (!G.running && !G.paused) return;
  G.paused = !G.paused;
  if (G.paused) { $('#pauseStats').innerHTML = statHTML(); show(el.scrPause); if (Sound.engineGain) Sound.engineGain.gain.value = 0; }
  else { hide(el.scrPause); Sound.resume(); }
}
function offerCards() {
  G.paused = true;
  const bag = UPGRADES.slice();
  const picks = [];
  while (picks.length < 3 && bag.length) picks.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
  $('#cardList').innerHTML = picks.map((u, i) => {
    const curLvl = (G.upgrades[u.k] | 0);
    const pct = Math.min(100, Math.round((curLvl / u.max) * 100));
    const isLife = u.k === 'life';
    const tagText = isLife ? '♥ ЖИЗНЕННЫЙ МОДУЛЬ' : (u.rare ? '✦ РЕДКОЕ УЛУЧШЕНИЕ ✦' : 'ОБЫЧНОЕ');
    const amtText = isLife ? '♥ +1 ЖИЗНЬ' : (u.amt || '');
    const cls = ['upg', u.rare ? 'rare' : '', isLife ? 'upg-life' : ''].filter(Boolean).join(' ');

    return '<div class="' + cls + '" data-k="' + u.k + '">' +
      '<div class="lv">' + tagText + '</div>' +
      '<div class="upg-ic-wrap"><span class="ic">' + (isLife ? '♥' : u.ic) + '</span></div>' +
      '<b>' + u.name + '</b>' +
      '<div class="amt">' + amtText + '</div>' +
      '<p>' + u.p + '</p>' +
      '<div class="upg-progress-box">' +
        '<div class="upg-progress-row">' +
          '<span>ПРОКАЧКА</span>' +
          '<span class="rk">' + curLvl + ' / ' + u.max + '</span>' +
        '</div>' +
        '<div class="upg-progress-track">' +
          '<div class="upg-progress-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
      '</div>' +
      '<div class="upg-action-btn">ВЫБРАТЬ</div>' +
    '</div>';
  }).join('');
  show(el.scrCards);
  $('#cardList').querySelectorAll('.upg').forEach(n => n.addEventListener('click', () => pickCard(n.dataset.k, n)));
  Sound.chord([440, 660, 880], .3, .11);
}
function pickCard(k, cardEl) {
  const u = UPGRADES.find(x => x.k === k); if (!u) return;
  if (cardEl && cardEl.classList) cardEl.classList.add('selected');
  G.upgrades[k] = (G.upgrades[k] || 0) + 1;
  try { u.fn(); } catch {}
  hide(el.scrCards); G.paused = false;
  toast((u.k === 'life' ? '♥' : u.ic) + ' ' + u.name + ' усилено');
  Sound.blip(880, .12, 'square', .18);
}
/* Jon tugaganda tiriltirish. return true = o'yin davom etmoqda. */
function reviveNow(label) {
  G.revived = true; G.reviveFree = 0;
  G.lives = 1; G.shield = Math.max(G.shield, 8); G.shieldMax = Math.max(G.shieldMax, 8);
  G.invul = 3; G.running = true; G.over = false; G.paused = false; G.speed = G.baseSpeed * .6;
  for (const o of G.objs) if (o.z < 26) freeObj(o);
  G.objs = G.objs.filter(o => o.z >= 26);
  renderLives();
  toast(label || '❤ Вы выжили! Щит на 8 с', 2000);
  Sound.chord([523, 784, 1046], .3, .16);
  return true;
}
function maybeRevive() {
  // 🚑 "Tirik qolgich" peri — reklamasiz, avtomatik bir tirilish
  if (G.reviveFree > 0 && !G.revived) {
    addFloatingText(G.x, 2.1, 0, '🚑 БОНУС: ВОСКРЕШЕНИЕ', '#ff7ab8');
    return reviveNow('🚑 Бонус машины: вы выжили!');
  }
  if (G.revived) { gameOver(); return false; }
  show(el.scrRevive);
  return false;
}

/* --------------------------- HUD --------------------------- */
const _hudCache = { score: '', dist: '', coins: '', speed: '', boostW: '', magW: '', shW: '', mileW: '', lvl: -1, dimKey: '' };
function updateHUD() {
  const scStr = num(G.score);
  if (scStr !== _hudCache.score) { _hudCache.score = scStr; el.score.textContent = scStr; }
  const dstStr = km(G.dist);
  if (dstStr !== _hudCache.dist) { _hudCache.dist = dstStr; el.dist.textContent = dstStr; }
  const cnStr = num(G.coins);
  if (cnStr !== _hudCache.coins) { _hudCache.coins = cnStr; el.coins.textContent = cnStr; }
  const spdKmh = speedToKmh(G.speed);
  const spdStr = spdKmh + '<i>км/ч</i>';
  if (spdStr !== _hudCache.speed) {
    _hudCache.speed = spdStr;
    el.speed.innerHTML = spdStr;
    if (spdKmh > 280) {
      el.speed.style.color = '#ff2b43';
      el.speed.style.textShadow = '0 0 16px rgba(255,43,67,.8)';
    } else if (spdKmh > 190) {
      el.speed.style.color = '#ffd166';
      el.speed.style.textShadow = '0 0 14px rgba(255,209,102,.7)';
    } else {
      el.speed.style.color = '#fff7d6';
      el.speed.style.textShadow = '0 0 12px rgba(0,229,255,.6)';
    }
  }
  const bW = Math.round(Math.max(0, Math.min(100, G.energon / G.energonMax * 100))) + '%';
  if (bW !== _hudCache.boostW) { _hudCache.boostW = bW; el.boostBar.style.width = bW; }
  const mW = Math.round(Math.max(0, Math.min(100, G.magnet / G.magnetMax * 100))) + '%';
  if (mW !== _hudCache.magW) { _hudCache.magW = mW; el.magBar.style.width = mW; }
  const sW = Math.round(Math.max(0, Math.min(100, G.shield / Math.max(.001, G.shieldMax) * 100))) + '%';
  if (sW !== _hudCache.shW) { _hudCache.shW = sW; el.shBar.style.width = sW; }
  const boostActive = !!(G.boostOn || G.nitroT > 0);
  if (boostActive !== _hudCache.boostActive) {
    _hudCache.boostActive = boostActive;
    if (!el.pwBoost) el.pwBoost = document.querySelector('#powerRow .pw.boost');
    if (el.pwBoost) el.pwBoost.classList.toggle('active', boostActive);
  }
  const magActive = G.magnet > 0;
  if (magActive !== _hudCache.magActive) {
    _hudCache.magActive = magActive;
    if (!el.pwMag) el.pwMag = document.querySelector('#powerRow .pw.mag');
    if (el.pwMag) el.pwMag.classList.toggle('active', magActive);
  }
  const shActive = G.shield > 0;
  if (shActive !== _hudCache.shActive) {
    _hudCache.shActive = shActive;
    if (!el.pwSh) el.pwSh = document.querySelector('#powerRow .pw.sh');
    if (el.pwSh) el.pwSh.classList.toggle('active', shActive);
  }
  const shPlusActive = (G.shieldPlusTimer || 0) > 0;
  if (shPlusActive !== _hudCache.shPlusActive) {
    _hudCache.shPlusActive = shPlusActive;
    if (!el.pwSh) el.pwSh = document.querySelector('#powerRow .pw.sh');
    if (el.pwSh) {
      el.pwSh.classList.toggle('plus-active', shPlusActive);
      const lbl = el.pwSh.querySelector('span:not(.p-ic)');
      if (lbl) lbl.textContent = shPlusActive ? 'ЩИТ+ 🛡' : 'ЩИТ';
    }
  }
  const magPlusActive = (G.magnetPlusTimer || 0) > 0;
  if (magPlusActive !== _hudCache.magPlusActive) {
    _hudCache.magPlusActive = magPlusActive;
    if (!el.pwMag) el.pwMag = document.querySelector('#powerRow .pw.mag');
    if (el.pwMag) {
      el.pwMag.classList.toggle('plus-active', magPlusActive);
      const lbl = el.pwMag.querySelector('span:not(.p-ic)');
      if (lbl) lbl.textContent = magPlusActive ? 'МАГНИТ+ ⚡' : 'МАГНИТ';
    }
  }
  // Keyingi darajagacha bo'lgan yo'l — HUD tepasidagi ingichka progress chizig'i
  const from = G.levelFrom || 0, span = Math.max(1, G.nextLevelAt - from);
  const mlW = (Math.max(0, Math.min(1, (G.dist - from) / span)) * 100).toFixed(1) + '%';
  if (el.mileBar && mlW !== _hudCache.mileW) { _hudCache.mileW = mlW; el.mileBar.style.width = mlW; }
  if (_hudCache.lvl !== G.level) {
    _hudCache.lvl = G.level;
    if (el.lvlNum) el.lvlNum.textContent = G.level;
    if (el.lvlNext) el.lvlNext.textContent = G.level + ' → ' + (G.level + 1) + ' · ' + num(levelNeed(G.level)) + ' м';
  }
  const dimTag = el._dimHud || (el._dimHud = $('#dimHud'));
  if (dimTag) {
    if (G.inDimension && DIMENSIONS[G.dimensionIdx]) {
      const dim = DIMENSIONS[G.dimensionIdx];
      const sec = Math.ceil(G.dimensionTime);
      const dk = G.dimensionIdx + ':' + sec;
      if (_hudCache.dimKey !== dk) {
        _hudCache.dimKey = dk;
        dimTag.classList.remove('hidden');
        dimTag.innerHTML = '🌀 <b>' + dim.name + '</b> — <span class="dim-sec">' + sec + ' СЕК</span> · МНОЖИТЕЛЬ ×' + dim.scoreMul;
      }
    } else if (_hudCache.dimKey !== '') {
      _hudCache.dimKey = '';
      dimTag.classList.add('hidden');
    }
  }
  const evTag = el._biomeEventHud || (el._biomeEventHud = $('#biomeEventHud'));
  if (evTag) {
    if (G.biomeEventActive && !G.inDimension && !G.over) {
      const sec = Math.ceil(G.biomeEventTimer);
      const ek = G.biomeEventKey + ':' + sec;
      if (_hudCache.biomeEvKey !== ek) {
        _hudCache.biomeEvKey = ek;
        evTag.classList.remove('hidden');
        const ev = (typeof BIOME_EVENTS !== 'undefined' && BIOME_EVENTS[G.biomeEventProps]) ? BIOME_EVENTS[G.biomeEventProps] : ((typeof BIOME_EVENTS !== 'undefined') ? BIOME_EVENTS.city : null);
        if (ev) {
          const icon = ev.key === 'neon_storm' ? '⛈️' :
                       ev.key === 'crystal_storm' ? '🌪️' :
                       ev.key === 'ice_blizzard' ? '❄️' :
                       ev.key === 'magma_surge' ? '🔥' :
                       ev.key === 'spore_drift' ? '🌿' : '🌌';
          evTag.innerHTML = icon + ' <b>' + ev.name + '</b> · <span>' + sec + ' СЕК</span>';
          evTag.style.borderColor = ev.color;
          evTag.style.boxShadow = '0 0 14px ' + ev.color + '55';
        }
      }
    } else if (_hudCache.biomeEvKey !== '') {
      _hudCache.biomeEvKey = '';
      evTag.classList.add('hidden');
    }
  }
  if (typeof checkMissionsInRace === 'function') checkMissionsInRace();
  if (typeof checkAchievementsRealtime === 'function') checkAchievementsRealtime();
}
function bumpCombo(d) {
  G.combo = Math.max(1, Math.min(9, G.combo + d));
  G.comboT = G.comboHold;
  if (G.combo > (G.bestCombo || 1)) G.bestCombo = G.combo;
  el.combo.innerHTML = '<b>' + mul(G.combo) + '</b><i>' + (G.combo >= 9 ? 'МАКСИМУМ' : 'КОМБО') + '</i>';
  el.combo.style.transition = 'none'; el.combo.style.opacity = 1;
  el.combo.style.transform = 'scale(1.08)';
  requestAnimationFrame(() => {
    el.combo.style.transition = 'opacity .9s, transform .9s';
    el.combo.style.opacity = 0;
    el.combo.style.transform = 'scale(1)';
  });
}

/* --------------------------- UPDATE --------------------------- */
function update(dt) {
  if (!G.meta || typeof G.meta !== 'object') G.meta = {};
  const lv = G.level;
  const dp = diff01();
  // Base speed 23 = 120 km/h; Full upgrade caps at 400 km/h (internal speed 76.67)
  const rawWant = (G.baseSpeed + (G.carSpeedBonus || 0)) + (lv * .60 + dp * 3.8) * (G.rampMul || 1);
  const want = Math.min(56.0, rawWant);
  const brake = (keys['s'] || keys['arrowdown'] || G.touchBrake) ? .58 : 1;
  let target = want * brake;
  if (G.inDimension && DIMENSIONS[G.dimensionIdx]) target *= (1 + ((DIMENSIONS[G.dimensionIdx].speedBoost || 1.3) - 1) * 0.65);
  if (G.nitroT > 0) { G.nitroT -= dt; target *= 1.32; }
  if (G.boostOn && G.energon > 0) {
    if (TUTORIAL_SYSTEM.active) TUTORIAL_SYSTEM.onAction('nitro');
    if (!G.wasBoosting) { G.wasBoosting = true; G.runNitroCount = (G.runNitroCount || 0) + 1; }
    target *= (G.nitroT > 0 ? 1.15 : 1.36);
    G.boost = Math.min(1, G.boost + dt * 2.8);
    G.energon = Math.max(0, G.energon - dt * 14 * (G.drainMul || 1) * (G.nitroDrainBonus || 1) / (G.boostRate || 1));
  } else {
    G.wasBoosting = false;
    G.boost = Math.max(0, G.boost - dt * 2.0);
  }
  // Cap maximum speed at 400 km/h (76.65 internal units) so full upgrades are fast yet controllable
  target = Math.min(76.65, target);
  G.maxSpeed = Math.max(G.maxSpeed, target);
  G.speed += (target - G.speed) * Math.min(1, dt * 4.2 * (G.carAccelMul || 1));
  const kmh = speedToKmh(G.speed);
  G.meta.maxKmh = Math.max(G.meta.maxKmh || 0, kmh);
  G.dist += G.speed * dt;
  const dimScoreMul = (G.inDimension && DIMENSIONS[G.dimensionIdx]) ? DIMENSIONS[G.dimensionIdx].scoreMul : 1;
  G.score += G.speed * dt * 1.15 * G.combo * (G.scoreMul || 1) * dimScoreMul;

  // 500m Checkpoint & Biome Transition logic
  if (!G.inDimension) {
    if (G.dist >= G.nextCheckpointAt && !G.checkpointSpawned) {
      G.checkpointSpawned = true;
      const arch = allocObj('checkpoint', 0, 72);
      G.objs.push(arch);
      const nextIdx = (G.trackIdx + 1) % BIOMES.length;
      const nextBm = BIOMES[nextIdx];
      toast('🏁 КОНТРОЛЬНАЯ ТОЧКА: 500 М ДО «' + nextBm.name + '»', 3500);
      Sound.chord([523, 659, 784], .3, .16);
    }
    const cpHud = el._cpHud || (el._cpHud = $('#checkpointHud'));
    if (G.checkpointCrossed && cpHud) {
      if (G.trans < TRANS_DUR) {
        cpHud.classList.add('hidden');
      } else {
        const nextIdx = (G.trackIdx + 1) % BIOMES.length;
        const nextBm = BIOMES[nextIdx];
        const rem = Math.max(0, Math.round(G.nextBiomeDist - G.dist));
        cpHud.classList.remove('hidden');
        cpHud.innerHTML = '🏁 ДО «' + nextBm.name + '»: <b>' + rem + ' М</b>';
      }
    } else if (cpHud && !G.checkpointCrossed) {
      cpHud.classList.add('hidden');
    }
    if (G.dist >= G.nextBiomeDist) {
      nextTrack(true);
      G.checkpointSpawned = false;
      G.checkpointCrossed = false;
      if (cpHud) cpHud.classList.add('hidden');
      G.nextBiomeDist += 1500;
      G.nextCheckpointAt = G.nextBiomeDist - 500;
    }
  }

  // 3-Lane Portal System: 3 visually distinct portals aligned to the 3 lanes;
  // exactly 1 randomly selected lane leads into the 45s special dimension (`portal_active`),
  // while the other 2 lanes show non-colliding highway bypass gates (`portal_open`).
  if (!G.inDimension && G.dist >= G.nextPortalAt && !G.portalSpawned) {
    G.portalSpawned = true;
    let activeLane = Math.floor(Math.random() * 3);
    if (G.lastPortalLane != null && activeLane === G.lastPortalLane && Math.random() < 0.7) {
      activeLane = (activeLane + 1 + Math.floor(Math.random() * 2)) % 3;
    }
    G.lastPortalLane = activeLane;
    const targetDim = Math.floor(Math.random() * DIMENSIONS.length);
    const portalGroupId = (G.portalGroupSeq = (G.portalGroupSeq || 0) + 1);
    for (const o of G.objs) {
      if (Math.abs(o.z - 72) < 16) o.dead = true;
    }
    for (let l = 0; l < 3; l++) {
      if (l === activeLane) {
        const p = allocObj('portal_active', LANES[l], 72);
        p.targetDim = targetDim;
        p.activeLane = activeLane;
        p.approached = false;
        p.portalGroupId = portalGroupId;
        G.objs.push(p);
      } else {
        const p = allocObj('portal_open', LANES[l], 72);
        p.targetDim = targetDim;
        p.activeLane = activeLane;
        p.portalGroupId = portalGroupId;
        G.objs.push(p);
      }
    }

    const laneTitle = activeLane === 0 ? 'ЛЕВАЯ ПОЛОСА' : (activeLane === 1 ? 'ЦЕНТРАЛЬНАЯ ПОЛОСА' : 'ПРАВАЯ ПОЛОСА');
    toast('🌀 ПОРТАЛ ОБНАРУЖЕН: «' + DIMENSIONS[targetDim].name + '» · ' + laneTitle, 3600);
    addFloatingText(LANES[activeLane], 2.5, 42, '🌀 ПОРТАЛ ОБНАРУЖЕН', DIMENSIONS[targetDim].neon || '#d946ef');
    Sound.chord([580, 870, 1160], .4, .2);
  }

  // 45s Dimension Timer, Portal Entry Animation & Shield Ripple decay
  if (G.portalEntryAnim > 0) G.portalEntryAnim = Math.max(0, G.portalEntryAnim - dt * 1.4);
  if (G.portalExitAnim > 0) G.portalExitAnim = Math.max(0, G.portalExitAnim - dt * 1.5);
  if (G.shieldRipple > 0) G.shieldRipple = Math.max(0, G.shieldRipple - dt * 2.2);
  if (G.shieldAnim > 0) G.shieldAnim = Math.max(0, G.shieldAnim - dt * 2.2);
  if (G.nitroAnim > 0) G.nitroAnim = Math.max(0, G.nitroAnim - dt * 2.5);
  if (G.inDimension) {
    if (!G.paused) {
      G.dimensionTime = Math.max(0, G.dimensionTime - dt);
      if (G.dimensionTime <= 0) exitDimension();
    }
  }

  // Phase 5 Biome Events & Dynamic World Lifecycle
  if (!G.inDimension && !G.bossActive && !G.bossWarningActive) {
    if (G.biomeEventActive) {
      if (!G.paused) {
        G.biomeEventTimer -= dt;
        if (G.biomeEventTimer <= 0) {
          G.biomeEventActive = false;
          G.biomeEventTimer = 0;
          G.biomeEventKey = '';
          G.biomeEventName = '';
          G.biomeEventCooldown = 22.0 + Math.random() * 6.0;
        } else {
          updateBiomeEventParticles(dt);
        }
      }
    } else {
      if (!G.paused) {
        G.biomeEventCooldown -= dt;
        if (G.biomeEventCooldown <= 0 && G.trans >= TRANS_DUR) {
          const curBm = trackBiome();
          triggerBiomeEvent(curBm.props || 'city');
        }
      }
    }
  } else if (G.biomeEventActive) {
    G.biomeEventActive = false;
    G.biomeEventTimer = 0;
    G.biomeEventKey = '';
    G.biomeEventName = '';
    G.biomeEventCooldown = 18.0;
  }

  // Boss Chase System
  // 1. Pre-spawn Warning (~2.5s / 80m before boss arrival)
  if (!G.inDimension && !G.bossActive && !G.bossWarningActive && G.dist >= (G.nextBossAt || 2200) - 80) {
    G.bossWarningActive = true;
    toast('⚠️ БОСС ПРИБЛИЖАЕТСЯ!', 3000);
    Sound.bossWarning();
    G.flash = 0.35;
  }

  // 2. Boss Spawn (when dist reaches nextBossAt)
  if (!G.inDimension && !G.bossActive && G.dist >= (G.nextBossAt || 2200)) {
    G.bossActive = true;
    G.bossWarningActive = false;
    G.bossTimer = 22.0;
    G.bossDist = 20.0;
    G.bossZ = 20.0;
    G.bossLane = (typeof G.lane === 'number' && G.lane >= 0 && G.lane <= 2) ? G.lane : 1;
    G.bossX = LANES[G.bossLane];
    G.bossAttackState = 'idle';
    G.bossAttackTimer = 3.5; // First attack telegraph in 3.5s
    G.bossTargetLane = G.bossLane;
    const bNames = [
      'ПЕРЕХВАТЧИК «СПЕКТР-9»',
      'КИБЕР-КРЕЙСЕР «ОНИКС»',
      'ДРОН-ОХОТНИК «ФРОСТ»',
      'ШТУРМОВИК «МАГМА-ТИТАН»',
      'АВТОНОМНЫЙ ПАТРУЛЬ «БИО-9»',
      'КВАНТОВЫЙ ДЕСТРОЙЕР «НЕКСУС»'
    ];
    G.bossName = bNames[G.trackIdx % bNames.length] || 'ПЕРЕХВАТЧИК «СПЕКТР-9»';
    toast('🚨 БОСС-ПОГОНЯ: «' + G.bossName + '» НА ТРАССЕ! УДЕРЖИВАЙТЕ СКОРОСТЬ!', 4000);
    Sound.bossWarning();
    G.flash = 0.45; G.shake = 0.4;
  }
  if (G.bossActive) {
    if (!G.paused) {
      G.bossTimer -= dt;

      // Distance control based on player speed
      if (G.speed > 26 || G.boostOn) G.bossDist = Math.min(32, G.bossDist + dt * 2.8);
      else if (G.speed < 22) G.bossDist = Math.max(5, G.bossDist - dt * 2.2);

      G.bossZ = G.bossDist;

      // Attack State Machine: idle -> aiming (fair telegraph) -> strike -> idle
      G.bossAttackTimer -= dt;

      if (G.bossAttackState === 'idle') {
        if (Math.random() < 0.02) G.bossLane = Math.floor(Math.random() * 3);
        const targetBossX = LANES[G.bossLane];
        G.bossX += (targetBossX - G.bossX) * Math.min(1, dt * 3.5);

        if (G.bossAttackTimer <= 0) {
          G.bossAttackState = 'aiming';
          G.bossAttackTimer = 1.4; // Fair 1.4s window for player to dodge lane
          G.bossTargetLane = (typeof G.lane === 'number' && G.lane >= 0 && G.lane <= 2) ? G.lane : 1;
          Sound.blip(660, 0.12, 'square', 0.15);
          addFloatingText(LANES[G.bossTargetLane], 2.4, 18, '⚠️ ЗАХВАТ ЦЕЛИ!', '#ff2b43');
        }
      } else if (G.bossAttackState === 'aiming') {
        const targetBossX = LANES[G.bossTargetLane];
        G.bossX += (targetBossX - G.bossX) * Math.min(1, dt * 5.0);

        if (G.bossAttackTimer <= 0) {
          G.bossAttackState = 'strike';
          G.bossAttackTimer = 0.6; // strike beam display duration
          Sound.blip(220, 0.25, 'sawtooth', 0.3);

          const playerInLane = Math.abs(G.x - LANES[G.bossTargetLane]) < 0.85;
          const playerIsHighJump = G.y > 1.25;

          if (playerInLane && !playerIsHighJump && G.invul <= 0) {
            // Hit by boss strike: shield absorbs first, otherwise lose life
            if (G.shield > 0) {
              G.shield = 0;
              G.shieldPlusTimer = 0;
              G.shieldRipple = 1.0;
              G.invul = 1.2;
              bumpCombo(-1);
              Sound.noise(0.25, 0.2);
              Sound.blip(320, 0.14, 'triangle', 0.2);
              toast('🛡 Щит поглотил удар босса!', 1800);
              addFloatingText(G.x, 2.0, 0, '🛡 ЩИТ ПОГЛОТИЛ УДАР', '#00e5ff');
            } else {
              G.lives--;
              G.invul = 2.0; // Fair invulnerability window prevents instant multi-death
              G.shake = 0.8;
              G.flash = 0.5;
              bumpCombo(-1);
              Sound.noise(0.4, 0.3);
              toast('💥 УДАР БОССА! Потеряна жизнь!', 2000);
              renderLives();
              if (G.lives <= 0) maybeRevive();
            }
          } else {
            // Successfully dodged!
            toast('💨 ВЫ УКЛОНИЛИСЬ ОТ УДАРА БОССА!', 1800);
            addFloatingText(G.x, 2.2, 0, '💨 УКЛОНЕНИЕ!', '#7dff9b');
            Sound.blip(520, 0.1, 'triangle', 0.15);
            G.runNearMisses = (G.runNearMisses || 0) + 1;
            bumpCombo(1);
          }
        }
      } else if (G.bossAttackState === 'strike') {
        if (G.bossAttackTimer <= 0) {
          G.bossAttackState = 'idle';
          G.bossAttackTimer = 4.2; // 4.2s interval between attacks
        }
      }

      // Close proximity direct ram check with shield protection
      if (G.bossDist <= 5.5 && Math.abs(G.bossX - G.x) < 0.85 && G.invul <= 0) {
        if (G.shield > 0) {
          G.shield = 0;
          G.shieldPlusTimer = 0;
          G.shieldRipple = 1.0;
          G.invul = 1.2;
          G.bossDist = 14.0;
          bumpCombo(-1);
          Sound.noise(0.25, 0.2);
          toast('🛡 Щит поглотил таран босса!', 1800);
        } else {
          G.lives--;
          G.invul = 2.0;
          G.shake = 0.8;
          G.flash = 0.5;
          G.bossDist = 14.0;
          bumpCombo(-1);
          Sound.noise(0.4, 0.3);
          toast('💥 ТАРАН БОССА! Потеряна жизнь!', 2000);
          renderLives();
          if (G.lives <= 0) maybeRevive();
        }
      }

      const bh = el._bossHud || (el._bossHud = $('#bossHud'));
      if (bh) {
        bh.classList.remove('hidden');
        const bTitle = $('#bossTitle'), bSub = $('#bossSub'), bBar = $('#bossBar');
        if (bTitle) bTitle.textContent = '🚨 БОСС-ПОГОНЯ: ' + G.bossName;
        const attackHint = G.bossAttackState === 'aiming' ? ' · ⚠️ ЗАХВАТ!' : '';
        if (bSub) bSub.textContent = 'ДИСТАНЦИЯ: ' + Math.round(G.bossDist) + ' М · ВРЕМЯ: ' + Math.ceil(G.bossTimer) + ' С' + attackHint;
        if (bBar) bBar.style.width = Math.max(0, Math.min(100, (G.bossDist / 28) * 100)) + '%';
      }

      if (G.bossTimer <= 0 || G.bossDist >= 28) {
        G.bossActive = false;
        G.bossWarningActive = false;
        if (bh) bh.classList.add('hidden');
        G.bossEscaped = (G.bossEscaped || 0) + 1;
        G.runBossEscaped = (G.runBossEscaped || 0) + 1;
        G.meta.bossEscapes = (G.meta.bossEscapes || 0) + 1;
        const rCoins = 250, rPts = 100, rScore = 5000;
        G.coins += rCoins; G.runCoins += rCoins; ACCT.add(rPts); G.score += rScore;
        bankCoins(); store.set('meta', G.meta);

        // Real-time achievements & missions notification
        if (typeof checkAchievementsRealtime === 'function') checkAchievementsRealtime();
        if (typeof checkMissionsInRace === 'function') checkMissionsInRace();

        Sound.chord([523, 659, 784, 1046], .5, .25);
        toast('🏆 ПОБЕГ УСПЕШЕН! Награда: +' + rCoins + ' 🪙, +' + rPts + ' ⭐, +' + rScore + ' очков!', 4000);
        addFloatingText(G.x, 2.3, 0, '🏆 ПОБЕГ УСПЕШЕН! +250 🪙', '#ffd166');
        burst(G.bossX, 1.2, G.bossZ, 25, '#ffd166', 1.5);
        G.nextBossAt = G.dist + 2800;
        G.flash = 0.45;
      }
    }
  } else {
    const bh = el._bossHud || (el._bossHud = $('#bossHud'));
    if (bh && !bh.classList.contains('hidden')) bh.classList.add('hidden');
  }

  // Drift System (keyboard or mobile touch brake button)
  const steerInput = (keys['a'] || keys['d'] || keys['arrowleft'] || keys['arrowright'] || Math.abs(G.tilt) > 0.12);
  const brakeInput = (keys['s'] || keys['arrowdown'] || keys['shift'] || G.touchBrake);
  if ((steerInput || G.touchBrake) && brakeInput && G.speed > 16 && G.onGround) {
    if (!G.drifting) {
      G.drifting = true;
      Sound.tireSqueal();
    }
    G.driftTime = (G.driftTime || 0) + dt;
    G.runContinuousDrift = (G.runContinuousDrift || 0) + dt;
    G.meta.maxDriftSec = Math.max(G.meta.maxDriftSec || 0, Math.floor(G.runContinuousDrift || 0));
    G.runMaxDriftCombo = Math.max(G.runMaxDriftCombo || 0, G.combo || 1);
    const dPts = dt * 140 * G.combo * (G.driftControlMul || 1);
    G.driftScore = (G.driftScore || 0) + dPts;
    G.score += dPts;
    if (Math.random() < (G.quality === 'low' ? 0.25 : 0.65)) burst(G.x + (G.tilt > 0 ? -0.85 : 0.85), 0.05, -0.9, 2, car().acc || '#00e5ff', 0.45);
    G.energon = Math.min(G.energonMax, G.energon + dt * 10);
    const dtTag = el._driftTag || (el._driftTag = $('#driftTag'));
    if (dtTag) {
      dtTag.classList.remove('hidden');
      dtTag.innerHTML = '🏎 ДРИФТ ×' + G.combo + ' <b>+' + Math.round(G.driftScore) + '</b>';
    }
    if (G.driftTime > 1.0) {
      bumpCombo(1);
      G.driftTime = 0.2;
    }
  } else if (G.drifting) {
    G.drifting = false;
    G.runContinuousDrift = 0;
    const dtTag = el._driftTag || (el._driftTag = $('#driftTag'));
    if (dtTag) dtTag.classList.add('hidden');
    if (G.driftScore > 120) addFloatingText(G.x, 1.8, 0, 'ЧИСТЫЙ ДРИФТ! +' + Math.round(G.driftScore), '#00e5ff');
    G.driftScore = 0;
    G.driftTime = 0;
  }

  /* --- YO'L ALMASHINUVI: checkpointdan alohida, reja bo'yicha --- */
  G.trackT += dt;
  G.trackCheckpointWait += dt;
  if (G.trans < 90) G.trans += dt;

  if (G.dist >= G.nextLevelAt) {
    G.trackCheckpointWait = 0;
    G.levelFrom = G.levelAt; G.levelAt = G.nextLevelAt;
    G.level++; G.nextLevelAt += levelNeed(G.level);
    el.levelTag.innerHTML = '<b>УРОВЕНЬ ' + G.level + '</b><small>ДАЛЕЕ: ' + num(levelNeed(G.level)) + ' м</small>';
    el.levelTag.style.opacity = 1;
    setTimeout(() => { el.levelTag.style.opacity = 0; }, 1700);
    toast('🏁 Достигнут ' + G.level + '-й уровень! Следующий — ' + Math.round(levelNeed(G.level)) + ' м', 2200);
    Sound.chord([523, 659, 784, 1046], .35, .14);
    G.energon = Math.min(G.energonMax, G.energon + 30);
    G.spawnGap = Math.max(11.6, 15 - dp * 2.4 - G.level * .16);
    offerCards();
  }
  if (G.trackT >= TRACK_SEC && G.trackCheckpointWait >= CHECKPOINT_TRACK_GAP) nextTrack(true);

  // yon surilish
  const laneTarget = LANES[G.lane];
  const hMul = G.carHandlingMul || 1;
  G.laneX += (laneTarget - G.laneX) * Math.min(1, dt * ((8 + G.brakePow * 4) * hMul));
  G.x = G.laneX;
  G.tilt += ((laneTarget - G.laneX) * .14 - G.tilt) * Math.min(1, dt * 9);
  G.yaw = G.tilt * .45;

  // sakrash (boshqariluvchan balandlik: maksimal 1.28m)
  if (!G.onGround || G.y > 0) {
    G.vy -= 18.0 * dt;
    G.y += G.vy * dt;
    if (G.y > 1.28) { G.y = 1.28; if (G.vy > 0) G.vy = 0; }
    if (G.y <= 0) { G.y = 0; G.vy = 0; G.onGround = true; burst(G.x, .1, 0, 5, car().acc, .5); }
  }

  G.magnet = Math.max(0, G.magnet - dt);
  if (G.magnetPlusTimer > 0) G.magnetPlusTimer = Math.max(0, G.magnetPlusTimer - dt);
  G.shield = Math.max(0, G.shield - dt);
  if (G.shieldPlusTimer > 0) G.shieldPlusTimer = Math.max(0, G.shieldPlusTimer - dt);
  /* Qayta tiklanuvchi qalqon (perk) */
  if (G.shieldRegen) {
    if (G.shield <= 0) {
      G.shieldRt += dt;
      if (G.shieldRt >= 5.5) {
        G.shieldRt = 0;
        G.shield = Math.max(6, G.shieldMax * .6);
        addFloatingText(G.x, G.y + 1.4, 0, '🛡 ЩИТ ВОССТАНОВЛЕН', '#8ef9ff');
        Sound.blip(720, .16, 'sine', .18);
      }
    } else G.shieldRt = 0;
  }
  G.invul = Math.max(0, G.invul - dt);
  G.comboT -= dt; if (G.comboT <= 0 && G.combo > 1) G.combo = 1;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2.6);
  if (G.flash > 0) { G.flash -= dt * 3; el.flash.style.opacity = Math.max(0, G.flash) * .5; }
  lessonTick(dt);

  const dz = G.speed * dt;
  for (const o of G.objs) {
    o.z -= dz;
    o.rot += dt * OBJ[o.kind].spin;
    if (G.magnet > 0 && GOOD[o.kind]) {
      const ddx = G.x - o.x, dd = Math.hypot(ddx, o.z);
      const isPlus = (G.magnetPlusTimer || 0) > 0;
      const magRad = 12 + (G.magnetRadiusBonus || 0) + (isPlus ? 6 : 0);
      const pullSpeed = isPlus ? 8.0 : 5.5;
      const pullZ = isPlus ? 9.5 : 7.0;
      if (dd < magRad && o.z > 0) { o.x += ddx * dt * pullSpeed; o.z -= dt * pullZ; }
    }
  }
  let far = 0;
  for (const o of G.objs) if (!o.dead && o.z > far) far = o.z;
  let guard = 0;
  while (far < 88 && guard++ < 6) {
    const gap = (G.spawnGap || 13) + Math.random() * 2.5;
    const nz = far <= 0 ? 24 : (far < 20 ? far + 12 : far + gap);
    spawnRow(nz);
    far = Math.max(far + 6, nz);
  }
  for (let i = G.objs.length - 1; i >= 0; i--) {
    const o = G.objs[i];
    if (o.z < -7 || o.dead) { G.objs.splice(i, 1); if (POOL.length < 90) POOL.push(o); }
  }

  // toʼqnashuv va yonidan o'tish (near miss)
  for (const o of G.objs) {
    if (o.taken || o.dead) continue;
    const m = OBJ[o.kind], dx = Math.abs(o.x - G.x);

    // Yonidan o'tish (Near Miss) tekshiruvi: xavf yonidan xavfsiz tez o'tish
    if (HAZARD[o.kind] && !o.nearMissed && o.z < 0.6 && o.z > -1.2) {
      if (dx >= m.hit && dx < m.hit + 1.25) {
        o.nearMissed = true;
        G.nearMisses = (G.nearMisses || 0) + 1;
        const nPts = 150 + (G.level - 1) * 20;
        G.score += nPts * G.combo;
        G.energon = Math.min(G.energonMax, G.energon + 14);
        bumpCombo(0.5);
        addFloatingText(G.x, 1.8, 0, '⚡ БЛИЗКИЙ ПРОЛЁТ! +' + nPts, '#00e5ff');
        Sound.whoosh(0.35);
        burst(o.x > G.x ? G.x + 0.8 : G.x - 0.8, 0.4, 0, 7, '#00e5ff', 0.85);
      }
    }

    if (o.kind === 'checkpoint' && !o.taken && o.z < 1.0 && o.z > -1.2) {
      o.taken = true;
      G.checkpointCrossed = true;
      G.runCheckpointsPassed = (G.runCheckpointsPassed || 0) + 1;
      const nextIdx = (G.trackIdx + 1) % BIOMES.length;
      const nextBm = BIOMES[nextIdx];
      G.speed += 3.5;
      G.flash = 0.65;
      Sound.chord([523, 659, 784, 1046], .35, .15);
      toast('🏁 КОНТРОЛЬНАЯ ТОЧКА ПРОЙДЕНА! +УСКОРЕНИЕ', 2600);
      addFloatingText(0, 2.5, 0, '🏁 КОНТРОЛЬНАЯ ТОЧКА!', '#00e5ff');
      continue;
    }
    if (o.kind === 'portal_active' && !o.taken) {
      if (!o.approached && o.z < 30 && o.z > 4) {
        o.approached = true;
        const dim = DIMENSIONS[o.targetDim] || DIMENSIONS[0];
        addFloatingText(o.x, 2.4, o.z * 0.45, '⚡ ВХОД В ИЗМЕРЕНИЕ ⚡', dim.neon || '#00e5ff');
      }
      if (o.z < 1.15 && o.z > -1.35) {
        o.taken = true;
        // Mark all sibling gates in this portal row as taken so portal logic never runs twice
        if (o.portalGroupId) {
          for (const sib of G.objs) {
            if (sib.portalGroupId === o.portalGroupId) sib.taken = true;
          }
        }
        G.portalSpawned = false;
        G.nextPortalAt = G.dist + 750;
        if (Math.abs(o.x - G.x) < 1.25) {
          const validDim = (o.targetDim >= 0 && o.targetDim < DIMENSIONS.length) ? o.targetDim : 0;
          burst(o.x, 1.2, 0, 28, (DIMENSIONS[validDim] && DIMENSIONS[validDim].neon) || '#d946ef', 1.7);
          enterDimension(validDim);
        } else {
          addFloatingText(G.x, 1.8, 0, '🛣 ПРЯМОЙ ПУТЬ', '#94a3b8');
        }
        continue;
      }
    }
    if (o.kind === 'portal_open' && !o.taken && o.z < 1.0 && o.z > -1.2) {
      o.taken = true;
      continue;
    }

    if (o.z > 1.15 || o.z < -1.5) continue;

    if (HAZARD[o.kind]) {
      const canJump = JUMPABLE[o.kind] && G.y > (o.kind === 'bar' ? 0.22 : 0.18);
      if (dx < m.hit) {
        if (canJump) {
          if (!o.jumpedOver) {
            o.jumpedOver = true;
            G.score += 200 * G.combo;
            bumpCombo(0.5);
            addFloatingText(G.x, 2.2, 0, '🦘 ПРЫЖОК! +200', '#ffd166');
            Sound.blip(880, 0.12, 'triangle', 0.22);
          }
          continue;
        }
        if (G.boost > .45 && o.kind !== 'wall' && o.kind !== 'truck') {
          o.dead = true;
          const smashPts = 150 + G.smashBonus;
          G.score += smashPts; bumpCombo(1);
          burst(o.x, 1, o.z, 20, '#ff2fb9', 1.8); Sound.noise(.2, .35); Sound.blip(200, .12, 'square', .26);
          addFloatingText(o.x, 1.8, o.z, '💥 ТАРАН! +' + smashPts, '#ff2fb9');
          G.shake = 0.7;
          lessonEvent('avoid');
          continue;
        }
        if (G.ghost && Math.random() < .5) {
          o.dead = true;
          burst(o.x, 1, o.z, 10, '#cfe9ff', 1.1); Sound.blip(980, .1, 'sine', .16);
          addFloatingText(G.x, 1.9, 0, '👻 ПРИЗРАЧНОЕ СТОЛКНОВЕНИЕ', '#cfe9ff');
          continue;
        }
        if (G.shield > 0) {
          G.shield = 0; G.shieldPlusTimer = 0; G.shieldRipple = 1.0; o.dead = true; bumpCombo(-1); G.invul = .9;
          burst(o.x, 1, o.z, 16, '#00e5ff', 1.5); Sound.blip(660, .18, 'sine', .26);
          addFloatingText(G.x, 1.8, 0, '🛡 ЩИТ ПОГЛОТИЛ УДАР', '#00e5ff');
          toast('🛡 Щит поглотил удар');
        } else if (G.invul <= 0) {
          o.dead = true; G.lives--; bumpCombo(-1); G.shake = 1.3; G.flash = .9; G.invul = 1.9;
          G.speed = Math.max(9, G.speed * .5);
          burst(o.x, 1, o.z, 18, '#ff2b43', 1.5); Sound.noise(.4, .45);
          renderLives();
          if (G.lives <= 0) { if (!maybeRevive()) G.running = false; }
          else toast('💥 Столкновение! Жизней: ' + G.lives + ' — избегайте красного', 1700);
        } else lessonEvent('avoid');
      }
    } else if (dx < m.hit) {
      o.taken = true; o.dead = true;
      if (o.kind === KIND.COIN) {
        const v = Math.round(10 * G.coinMult);
        const currency = Math.max(1, Math.round(v * .4));
        G.coins += currency; G.runCoins += currency; G.score += v; bumpCombo(.4);
        burst(o.x, 1, o.z, 6, '#ffd166', .8);
        burst(o.x, 1.05, o.z, 3, '#ffffff', 1.0);
        G.coinStreak = (G.coinStreak || 0) + 1;
        Sound.scaleChime(G.coinStreak % 9, 0.18);
        addFloatingText(o.x, 1.3, o.z, '+' + currency, '#ffd166');
        lessonEvent('coin');
        if (TUTORIAL_SYSTEM.active) TUTORIAL_SYSTEM.onAction('coin');
      } else if (o.kind === KIND.NITRO) {
        G.energon = Math.min(G.energonMax, G.energon + 55); G.nitroT = Math.max(G.nitroT, 2.4);
        G.nitroAnim = 1.0;
        burst(o.x, 1, o.z, 14, '#00e5ff', 1.3);
        burst(o.x, 1.05, o.z, 4, '#ffffff', 1.0);
        Sound.chord([700, 1000], .22, .16); toast('⚡ НИТРО!');
        addFloatingText(o.x, 1.4, o.z, '⚡ УСКОРЕНИЕ НИТРО', '#00e5ff');
        lessonEvent('nitro');
        if (TUTORIAL_SYSTEM.active) TUTORIAL_SYSTEM.onAction('nitro');
      } else if (o.kind === KIND.SH) {
        G.shield = Math.max(G.shield, 10); G.shieldMax = Math.max(G.shieldMax, 10);
        G.shieldAnim = 1.0;
        burst(o.x, 1, o.z, 12, '#46ff8f', 1.1);
        burst(o.x, 1.05, o.z, 4, '#00e5ff', 1.0);
        Sound.chord([520, 700], .2, .15); toast('🟢 Щит на 10 с');
        addFloatingText(o.x, 1.4, o.z, '🛡 ЩИТ +10 с', '#46ff8f');
      } else if (o.kind === KIND.MAG) {
        G.magnet = Math.max(G.magnet, G.magnetMax);
        burst(o.x, 1, o.z, 12, '#a855f7', 1.2);
        burst(o.x, 1.05, o.z, 4, '#00e5ff', 1.0);
        Sound.chord([420, 620], .2, .14); toast('🟣 Магнит на ' + Math.round(G.magnetMax) + ' с');
        addFloatingText(o.x, 1.4, o.z, '🧲 МАГНИТ', '#c08cff');
      } else if (o.kind === KIND.SH_PLUS) {
        const dur = Math.min(25, Math.max(G.shield + 8, 16));
        G.shield = dur;
        G.shieldMax = Math.max(G.shieldMax, dur);
        G.shieldPlusTimer = dur;
        G.shieldAnim = 1.0;
        burst(o.x, 1, o.z, 16, '#22d3ee', 1.3);
        burst(o.x, 1.05, o.z, 6, '#ffd166', 1.1);
        Sound.chord([540, 720, 960], .25, .18);
        toast('🛡⚡ ЩИТ+ · УСИЛЕННЫЙ ЭНЕРГОЩИТ НА ' + Math.round(dur) + ' С!', 2200);
        addFloatingText(o.x, 1.4, o.z, '🛡⚡ ЩИТ+ (' + Math.round(dur) + ' с)', '#22d3ee');
      } else if (o.kind === KIND.MAG_PLUS) {
        const dur = Math.min(25, Math.max(G.magnet + 6, G.magnetMax + 6));
        G.magnet = dur;
        G.magnetPlusTimer = dur;
        burst(o.x, 1, o.z, 16, '#e879f9', 1.3);
        burst(o.x, 1.05, o.z, 6, '#ffd166', 1.1);
        Sound.chord([440, 660, 880], .25, .18);
        toast('🧲⚡ МАГНИТ+ · СВЕРХСИЛЬНЫЙ МАГНИТ НА ' + Math.round(dur) + ' С!', 2200);
        addFloatingText(o.x, 1.4, o.z, '🧲⚡ МАГНИТ+ (+50% РАДИУС)', '#e879f9');
      } else if (o.kind === KIND.LIFE_PLUS) {
        if (G.lives < G.maxLives) {
          G.lives = Math.min(G.maxLives, G.lives + 1);
          renderLives();
          G.invul = Math.max(G.invul, 1.6);
          for (let a = 0; a < 16; a++) {
            const ang = (a / 16) * Math.PI * 2;
            const hx = Math.pow(Math.sin(ang), 3) * 0.75;
            const hy = (13 * Math.cos(ang) - 5 * Math.cos(2*ang) - 2 * Math.cos(3*ang) - Math.cos(4*ang)) / 16 * 0.75;
            burst(o.x + hx * 0.7, 1.0 + hy * 0.7, o.z, 2, a % 2 === 0 ? '#f43f5e' : '#ffd166', 1.1);
          }
          if (el.lives) {
            el.lives.classList.remove('heart-plus-surge');
            void el.lives.offsetWidth;
            el.lives.classList.add('heart-plus-surge');
            setTimeout(() => { if (el.lives) el.lives.classList.remove('heart-plus-surge'); }, 1100);
          }
          Sound.chord([550, 770, 990, 1210], .35, .22);
          toast('❤⚡ СЕРДЦЕ+ · ВОССТАНОВЛЕНО (' + G.lives + '/' + G.maxLives + ')!', 2500);
          addFloatingText(o.x, 1.4, o.z, '❤⚡ СЕРДЦЕ+ (+1 ЖИЗНЬ)', '#f43f5e');
        } else {
          const bonusPts = 500 * (G.combo || 1);
          const bonusCoins = 25;
          G.score += bonusPts;
          G.coins += bonusCoins;
          G.runCoins = (G.runCoins || 0) + bonusCoins;
          G.energon = Math.min(G.energonMax, G.energon + 50);
          G.invul = Math.max(G.invul, 1.2);
          burst(o.x, 1, o.z, 14, '#ffd166', 1.2);
          burst(o.x, 1.05, o.z, 6, '#ffffff', 1.0);
          if (el.lives) {
            el.lives.classList.remove('heart-plus-surge');
            void el.lives.offsetWidth;
            el.lives.classList.add('heart-plus-surge');
            setTimeout(() => { if (el.lives) el.lives.classList.remove('heart-plus-surge'); }, 1100);
          }
          Sound.chord([660, 880, 1100, 1320], .35, .20);
          toast('❤⚡ СЕРДЦЕ+ · МАКСИМУМ ЖИЗНЕЙ! ОВЕРЧАРДЖ: +' + bonusPts + ' ОЧКОВ · +' + bonusCoins + ' 🪙', 2500);
          addFloatingText(o.x, 1.4, o.z, '❤ ОВЕРЧАРДЖ +' + bonusPts, '#ffd166');
        }
      } else if (o.kind === KIND.LIFE) {
        G.lives = Math.min(G.maxLives, G.lives + 1); renderLives();
        // Phase 6: Heart particle burst
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2;
          const hx = Math.pow(Math.sin(ang), 3) * 0.7;
          const hy = (13 * Math.cos(ang) - 5 * Math.cos(2*ang) - 2 * Math.cos(3*ang) - Math.cos(4*ang)) / 16 * 0.7;
          burst(o.x + hx * 0.6, 1.0 + hy * 0.6, o.z, 2, a % 2 === 0 ? '#ff2b43' : '#ffffff', 1.0);
        }
        Sound.chord([660, 880, 1100, 1320], .35, .20);
        toast('❤ +1 ЖИЗНЬ · СЕРДЦЕ ВОССТАНОВЛЕНО!', 2500);
        addFloatingText(o.x, 1.4, o.z, '❤ +1 ЖИЗНЬ', '#ff2b43');
      }
    }
  }

  // Havoga ergashish (slipstream / draft)
  if (G.speed > 14) {
    for (const o of G.objs) {
      if (HAZARD[o.kind] && Math.abs(o.x - G.x) < 0.7 && o.z > 1.8 && o.z < 6.5) {
        G.energon = Math.min(G.energonMax, G.energon + dt * 12);
        if (Math.random() < 0.25) burst(G.x + (Math.random() - .5) * 0.6, 0.1, -0.4, 1, '#8ef9ff', 0.3);
        break;
      }
    }
  }

  // Yon drift uchqunlari
  if (Math.abs(G.tilt) > 0.15 && G.onGround && Math.random() < 0.45) {
    burst(G.x + (G.tilt > 0 ? -0.8 : 0.8), 0.05, -1.0, 3, car().acc || '#00e5ff', 0.4);
  }

  // Politsiya sirena ovozi
  Sound.sirenTick(G.t);

  // Suzuvchi yozuvlarni yangilash (in-place compact)
  if (G.texts && G.texts.length) {
    let w = 0;
    for (let i = 0; i < G.texts.length; i++) {
      const ft = G.texts[i];
      ft.t += dt; ft.y += dt * 1.5; ft.z -= G.speed * dt * 0.25;
      if (ft.t < ft.l) G.texts[w++] = ft;
    }
    G.texts.length = w;
  }

  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt - dz * .35; p.vy -= 9 * dt;
    if (p.y < 0) { p.y = 0; p.vy *= -.4; }
    if (p.t >= p.l) {
      if (PART_POOL.length < 300) PART_POOL.push(p);
      const last = G.parts.pop();
      if (i < G.parts.length) G.parts[i] = last;
    }
  }

  CAM.x += (G.x * .30 - CAM.x) * Math.min(1, dt * 5);
  CAM.y = 2.25 + G.y * .14 + Math.sin(G.t * 2.2) * .02;
  CAM.fov = FOV_BASE + G.boost * 110;
  G.camRoll = 0;
  Sound.engineSet(Math.min(1, G.speed / 42));
  updateHUD();
}

/* --------------------------- RENDER --------------------------- */
const UIFONT = '"Orbitron","Chakra Petch","Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif';
/** Yer tekisligida toʼrtburchak (x1..x2, z1..z2) */
function quad(x1, z1, x2, z2, y, fill, stroke) {
  proj([x1, y, z1], _a); if (!_a.vis) return;
  proj([x2, y, z1], _b); if (!_b.vis) return;
  proj([x2, y, z2], _c); if (!_c.vis) return;
  proj([x1, y, z2], _d); if (!_d.vis) return;
  ctx.beginPath();
  ctx.moveTo(_a.x, _a.y); ctx.lineTo(_b.x, _b.y); ctx.lineTo(_c.x, _c.y); ctx.lineTo(_d.x, _d.y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke(); }
}
const _rgbaPrefixCache = Object.create(null);
function rgba(hex, a) {
  let prefix = _rgbaPrefixCache[hex];
  if (!prefix) {
    if (hex && hex.charCodeAt(0) === 35) {
      const r = parseInt(hex.slice(1, 3), 16) || 0;
      const g = parseInt(hex.slice(3, 5), 16) || 0;
      const b = parseInt(hex.slice(5, 7), 16) || 0;
      prefix = 'rgba(' + r + ',' + g + ',' + b + ',';
    } else {
      prefix = 'rgba(255,255,255,';
    }
    _rgbaPrefixCache[hex] = prefix;
  }
  return prefix + a + ')';
}

/* Yon manzara: har bir yo'l o'z dinamik siluet turini chizadi */
function drawSilhouette(bm, horizon, bpar) {
  const type = bm.props || 'city';
  const sil = bm.sil || '#060714';
  ctx.save();
  ctx.fillStyle = sil;
  ctx.strokeStyle = rgba(bm.neon, .38);
  ctx.lineWidth = .9;

  if (type === 'city' || type === 'grid') {
    for (let bi = 0; bi < (G.buildings || []).length; bi++) {
      const b = G.buildings[bi];
      const bx = b.x * W + bpar, bw = b.w * W, bh = b.h * H * (type === 'grid' ? .8 : 1.08), by = horizon - bh;
      if (bx < -bw - 20 || bx > W + 20) continue;
      if (type === 'grid') {
        ctx.strokeRect(bx, by, bw, bh);
        for (let r = 1; r < 5; r++) {
          const yy = by + bh * r / 5;
          ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx + bw, yy); ctx.stroke();
        }
        ctx.fillStyle = rgba(bm.neon, 0.4 + 0.3 * Math.sin(G.t * 3 + b.x * 10));
        ctx.fillRect(bx + bw * .35, by - 3, bw * .3, 3);
        ctx.fillStyle = sil;
        continue;
      }

      // Main building body with subtle side-face shading
      ctx.fillStyle = '#070a18';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#0c1328';
      ctx.fillRect(bx, by, bw * 0.24, bh);
      ctx.strokeStyle = rgba(bi % 2 === 0 ? bm.neon : (bm.curbc || '#ff2fb9'), 0.42);
      ctx.strokeRect(bx, by, bw, bh);

      // Varied architectural crowns (0: stepped setback, 1: slanted cyber-roof, 2: twin crown)
      const crownStyle = bi % 3;
      let topY = by;
      if (bh > H * 0.10) {
        if (crownStyle === 0) {
          const tw = bw * 0.64, th = bh * 0.20, tx = bx + bw * 0.18;
          topY = by - th;
          ctx.fillStyle = '#060915';
          ctx.fillRect(tx, topY, tw, th);
          ctx.strokeRect(tx, topY, tw, th);
        } else if (crownStyle === 1) {
          const th = bh * 0.18;
          topY = by - th;
          ctx.fillStyle = '#080d1e';
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.08, by);
          ctx.lineTo(bx + bw * 0.22, topY);
          ctx.lineTo(bx + bw * 0.92, topY + th * 0.35);
          ctx.lineTo(bx + bw * 0.92, by);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          const tw = bw * 0.32, th = bh * 0.18;
          topY = by - th;
          ctx.fillStyle = '#060915';
          ctx.fillRect(bx + bw * 0.10, topY, tw, th);
          ctx.fillRect(bx + bw * 0.58, topY, tw, th);
        }
      }

      // Fine architectural horizontal window strips instead of oversized square patches
      const cols = 3;
      const colW = (bw * 0.76) / cols;
      const rows = Math.min(10, Math.max(4, (bh / 14) | 0));
      const rowH = (bh * 0.82) / rows;
      for (let r = 0; r < rows; r++) {
        if (((r + bi) % 3) === 2) continue;
        const wy = by + bh * 0.08 + r * rowH;
        const pulse = Math.sin(G.t * 2.4 + r * 1.7 + b.x * 19);
        if (pulse > -0.25) {
          ctx.fillStyle = (r + bi) % 4 === 0 ? '#fde047' : ((r % 2 === 0) ? (bm.neon || '#00e5ff') : '#bae6fd');
          ctx.globalAlpha = 0.28 + 0.42 * Math.max(0, pulse);
          for (let c = 0; c < cols; c++) {
            if (((r + c + bi) & 1) === 0) {
              ctx.fillRect(bx + bw * 0.12 + c * colW, wy, colW * 0.72, Math.max(1.5, rowH * 0.36));
            }
          }
        }
      }
      ctx.globalAlpha = 1;

      // Framed rooftop holographic sign & aviation beacon
      if (b.beacon && bh > H * 0.09) {
        const signW = Math.min(bw * 0.78, 36);
        if (signW > 18) {
          const signH = 8.5;
          const signX = bx + (bw - signW) * 0.5;
          const signY = topY - signH - 3.5;
          const sCol = bi % 2 === 0 ? bm.neon : (bm.curbc || '#ff2fb9');
          // Support struts
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(signX + 4, topY); ctx.lineTo(signX + 4, signY + signH);
          ctx.moveTo(signX + signW - 4, topY); ctx.lineTo(signX + signW - 4, signY + signH);
          ctx.stroke();
          // Frame & glowing hologram panel
          ctx.fillStyle = 'rgba(8, 12, 28, 0.92)';
          ctx.fillRect(signX, signY, signW, signH);
          ctx.strokeStyle = rgba(sCol, 0.90);
          ctx.strokeRect(signX, signY, signW, signH);
          ctx.fillStyle = rgba(sCol, 0.78);
          ctx.fillRect(signX + 2.5, signY + 2, signW * 0.62, 2.2);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(signX + 2.5, signY + 5.2, signW * 0.42, 1.4);
        }
        const beaconY = topY - 12;
        ctx.strokeStyle = rgba(bm.neon, 0.55);
        ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.moveTo(bx + bw * 0.5, topY); ctx.lineTo(bx + bw * 0.5, beaconY); ctx.stroke();
        const bFlash = Math.sin(G.t * 5.2 + b.x * 28);
        if (bFlash > 0.1) {
          ctx.fillStyle = bFlash > 0.7 ? '#ffffff' : '#ff2b43';
          ctx.beginPath(); ctx.arc(bx + bw * 0.5, beaconY, 2.0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = sil;
    }
    ctx.restore(); return;
  }

  for (const s of (G.sil || [])) {
    const x = s.x * W + bpar, w = Math.max(6, s.w * W), h = s.h * H * 1.5, y = horizon;
    if (x < -60 || x > W + 60) continue;
    if (type === 'cactus') {
      // Saguaro kaktusi: qalin poya + yuqoriga qaragan ikki qo'l
      const ch = h * .85, tw = Math.max(4, w * .18), bx = x + w * .5 - tw / 2;
      ctx.fillRect(bx, y - ch, tw, ch);
      const ly = y - ch * .55;
      ctx.fillRect(bx - w * .3, ly, w * .3 + tw * .3, tw);
      ctx.fillRect(bx - w * .3, ly - ch * .3, tw, ch * .3 + tw);
      const ry = y - ch * .7;
      ctx.fillRect(bx + tw * .7, ry, w * .3, tw);
      ctx.fillRect(bx + tw * .7 + w * .3 - tw, ry - ch * .26, tw, ch * .26 + tw);
    } else if (type === 'palm') {
      ctx.save();
      ctx.translate(x + w * .5, y);
      const palmSway = Math.sin(G.t * 2.0 + s.a) * 0.08;
      ctx.rotate((s.k - .5) * .16 + palmSway);
      const th = h * .92, tw = Math.max(3, w * .11);
      ctx.beginPath();
      ctx.moveTo(-tw * 1.7, 0); ctx.lineTo(tw * 1.7, 0); ctx.lineTo(tw * .65, -th); ctx.lineTo(-tw * .65, -th);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(bm.neon, .5); ctx.lineWidth = Math.max(1.8, w * .07);
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (.06 + i * .146);
        const lx = Math.cos(a) * w * 1.25, ly = -Math.sin(a) * h * .1 + h * .05;
        ctx.beginPath(); ctx.moveTo(0, -th);
        ctx.quadraticCurveTo(lx * .55, -th - h * .13, lx, -th + ly);
        ctx.stroke();
      }
      ctx.restore();
    } else if (type === 'ice') {
      // Muz va qorli cho'qqilar (Frozen Peaks: snowy mountains, glaciers, ice needles)
      if (s.k < 0.52) {
        // 1) Qorli o'tkir tog' cho'qqisi (Sharp jagged snowy peak)
        const peakH = h * 1.35;
        const px = x + w * 0.5, py = y - peakH;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.1, y);
        ctx.lineTo(px, py);
        ctx.lineTo(x + w * 1.1, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Cho'qqidagi qor qoplami (Snow cap)
        ctx.fillStyle = rgba(bm.curbc || '#e0f2fe', 0.85);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + w * 0.22, py + peakH * 0.35);
        ctx.lineTo(px, py + peakH * 0.28);
        ctx.lineTo(px - w * 0.22, py + peakH * 0.35);
        ctx.closePath();
        ctx.fill();
        // Krio-yorug'lik qirrasi (Cold ice ridge highlight)
        ctx.strokeStyle = rgba(bm.neon, 0.65);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + w * 0.08, y);
        ctx.stroke();
        ctx.lineWidth = 0.9;
        ctx.fillStyle = sil;
      } else {
        // 2) Krio-muz nayzalari va muz bloklari (Glacial needles & ice spires)
        const spH = h * 1.25;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.2, y);
        ctx.lineTo(x + w * 0.45, y - spH);
        ctx.lineTo(x + w * 0.55, y - spH * 0.95);
        ctx.lineTo(x + w * 0.8, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(bm.neon, 0.75);
        ctx.stroke();
        // Muzning yaltiroq qirralari
        const iceGlint = Math.sin(G.t * 3.5 + s.a);
        if (iceGlint > 0.35) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x + w * 0.45, y - spH, 2.4 * iceGlint, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = sil;
        }
      }
    } else if (type === 'crystal') {
      // Yonayotgan cho'l (Burning Desert: sandstone dunes, canyon rock mesas, crystal obelisks)
      if (s.k < 0.38) {
        // 1) Qum barxanlari (Rolling desert dunes)
        ctx.beginPath();
        ctx.moveTo(x - w * 0.4, y);
        ctx.quadraticCurveTo(x + w * 0.4, y - h * 0.65, x + w * 1.4, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(bm.neon, 0.35);
        ctx.beginPath();
        ctx.moveTo(x - w * 0.4, y);
        ctx.quadraticCurveTo(x + w * 0.4, y - h * 0.65, x + w * 1.4, y);
        ctx.stroke();
      } else if (s.k < 0.68) {
        // 2) Kanyon qoyalari va tekis cho'qqili mesa (Sandstone canyon rock mesas)
        const mw = w * 1.3, mh = h * 0.9, mx = x - w * 0.15;
        ctx.beginPath();
        ctx.moveTo(mx, y);
        ctx.lineTo(mx + mw * 0.18, y - mh);
        ctx.lineTo(mx + mw * 0.82, y - mh);
        ctx.lineTo(mx + mw, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(bm.sun1 || bm.neon, 0.4);
        ctx.stroke();
        // Gorizontal geologik qatlam chiziqlari (Geological strata lines)
        ctx.strokeStyle = rgba(bm.sun0 || '#ffe08a', 0.22);
        for (let l = 1; l <= 3; l++) {
          const ly = y - mh * (l / 4);
          ctx.beginPath();
          ctx.moveTo(mx + mw * 0.18 * (1 - l / 4), ly);
          ctx.lineTo(mx + mw - mw * 0.18 * (1 - l / 4), ly);
          ctx.stroke();
        }
        ctx.strokeStyle = rgba(bm.neon, 0.38);
      } else {
        // 3) Baland yorqin kristall obeliski (Prismatic crystal monolith)
        const shim = Math.sin(G.t * 3.2 + s.a);
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y - h * 1.45);
        ctx.lineTo(x + w * 0.85, y - h * 0.5);
        ctx.lineTo(x + w * 0.65, y);
        ctx.lineTo(x + w * 0.35, y);
        ctx.lineTo(x + w * 0.15, y - h * 0.5);
        ctx.closePath();
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = rgba(bm.neon, 0.6);
        ctx.stroke();
        // Ichki nur o'qi va prizmatik nur
        ctx.strokeStyle = rgba(bm.curbc || '#fbbf24', 0.5 + 0.45 * Math.abs(shim));
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y - h * 1.45);
        ctx.lineTo(x + w * 0.5, y);
        ctx.stroke();
        // Cho'qqidagi olmos charaqlashi (Apex diamond flash)
        if (shim > 0.3) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x + w * 0.5, y - h * 1.45, 2.8 * shim, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = rgba(bm.neon, 0.38);
        ctx.fillStyle = sil;
      }
    } else if (type === 'pyramid') {
      const pw = w * 2.1, ph = h * .6, px = x + w * .5 - pw / 2;
      ctx.beginPath();
      ctx.moveTo(px, y); ctx.lineTo(px + pw * .5, y - ph); ctx.lineTo(px + pw, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba(bm.sun0 || bm.neon, .5);
      ctx.beginPath(); ctx.moveTo(px + pw * .5, y - ph); ctx.lineTo(px + pw * .68, y); ctx.stroke();
      ctx.strokeStyle = rgba(bm.neon, .38);
    } else if (type === 'lava' || type === 'volcano') {
      // Olovli vulqon va bazalt qoyalar (Volcanic obsidian crags & magma craters)
      if (s.k < 0.62) {
        const cragH = h * 1.25;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.15, y);
        ctx.lineTo(x + w * 0.35, y - cragH);
        ctx.lineTo(x + w * 0.55, y - cragH * 0.78);
        ctx.lineTo(x + w * 0.78, y - cragH * 0.92);
        ctx.lineTo(x + w * 1.15, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba('#ff4500', 0.55);
        ctx.stroke();
        ctx.strokeStyle = rgba('#fbbf24', 0.75);
        ctx.beginPath();
        ctx.moveTo(x + w * 0.35, y - cragH);
        ctx.lineTo(x + w * 0.48, y - cragH * 0.45);
        ctx.lineTo(x + w * 0.42, y);
        ctx.stroke();
        ctx.fillStyle = sil;
      } else {
        const lavaPulse = 0.5 + 0.5 * Math.sin(G.t * 3.6 + s.a);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w * 0.28, y - h * 0.82);
        ctx.lineTo(x + w * 0.72, y - h * 0.82);
        ctx.lineTo(x + w, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = rgba('#ff4500', 0.85 + lavaPulse * 0.15);
        ctx.fillRect(x + w * 0.28, y - h * 0.88, w * 0.44, Math.max(2, h * 0.08));
        ctx.fillStyle = bm.sun0 || '#fef08a';
        ctx.globalAlpha = 0.35 + 0.45 * lavaPulse;
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y - h * 0.88, w * (0.35 + lavaPulse * 0.18), Math.PI, 0);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = sil;
      }
    } else if (type === 'moon') {
      const baseY = y - h * .12, domeH = h * .46;
      ctx.fillRect(x + w * .08, baseY - h * .2, w * .84, h * .2);
      ctx.beginPath();
      ctx.moveTo(x + w * .2, baseY - h * .2);
      ctx.quadraticCurveTo(x + w * .5, baseY - domeH * 1.55, x + w * .8, baseY - h * .2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba(bm.sun0 || bm.neon, .58);
      ctx.beginPath();
      ctx.moveTo(x + w * .5, baseY - domeH * 1.08); ctx.lineTo(x + w * .5, baseY - domeH * 1.65);
      ctx.moveTo(x + w * .44, baseY - domeH * 1.55); ctx.lineTo(x + w * .56, baseY - domeH * 1.55);
      ctx.moveTo(x - w * .08, baseY - h * .24); ctx.lineTo(x + w * .08, baseY - h * .24);
      ctx.lineTo(x + w * .08, baseY - h * .4); ctx.lineTo(x - w * .08, baseY - h * .4);
      ctx.stroke();
      ctx.strokeStyle = rgba(bm.neon, .38);
    } else if (type === 'nebula') {
      const cx0 = x + w * .5;
      ctx.beginPath();
      ctx.moveTo(cx0, y); ctx.lineTo(cx0, y - h * 1.2); ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx0, y - h * 1.2, w * .35, Math.PI * .8, Math.PI * 1.8);
      ctx.stroke();
      ctx.fillStyle = bm.neon; ctx.globalAlpha = .75;
      ctx.beginPath(); ctx.arc(cx0, y - h * 1.35, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = sil;
    } else if (type === 'aurora') {
      const cx0 = x + w * .5;
      ctx.beginPath();
      ctx.moveTo(cx0, y - h * 1.3); ctx.lineTo(cx0 + w * .4, y); ctx.lineTo(cx0 - w * .4, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba(bm.neon, .6);
      for (let l = 1; l < 4; l++) {
        const ly = y - h * (1.3 - l * .35);
        ctx.beginPath(); ctx.moveTo(cx0 - w * .15 * l, ly); ctx.lineTo(cx0 + w * .15 * l, ly); ctx.stroke();
      }
      ctx.strokeStyle = rgba(bm.neon, .38);
    } else if (type === 'sakura') {
      const cx0 = x + w * .5;
      ctx.fillRect(cx0 - 3, y - h * .8, 6, h * .8);
      ctx.fillStyle = bm.curbc || bm.neon; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.arc(cx0 - w * .2, y - h * .85, w * .32, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx0 + w * .2, y - h * .92, w * .35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx0, y - h * 1.15, w * .38, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = sil;
    } else if (type === 'synth') {
      ctx.fillRect(x + w * .2, y - h * 1.1, w * .6, h * 1.1);
      ctx.strokeRect(x + w * .2, y - h * 1.1, w * .6, h * 1.1);
      ctx.strokeStyle = rgba(bm.sun1 || bm.neon, .65);
      for (let r = 1; r < 6; r++) {
        const ry = y - h * 1.1 * (r / 6);
        ctx.beginPath(); ctx.moveTo(x + w * .2, ry); ctx.lineTo(x + w * .8, ry); ctx.stroke();
      }
      ctx.strokeStyle = rgba(bm.neon, .38);
    } else if (type === 'acid') {
      ctx.fillRect(x + w * .25, y - h * .9, w * .5, h * .9);
      ctx.strokeRect(x + w * .25, y - h * .9, w * .5, h * .9);
      ctx.fillStyle = bm.neon; ctx.globalAlpha = .7;
      ctx.beginPath(); ctx.arc(x + w * .5, y - h * 1.05, w * .2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w * .5, y - h * 1.25, w * .12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = sil;
    } else if (type === 'pillar') {
      const pw = w * .45, px = x + w * .5 - pw / 2;
      ctx.fillRect(px, y - h * 1.25, pw, h * 1.25);
      ctx.strokeRect(px, y - h * 1.25, pw, h * 1.25);
      ctx.beginPath();
      ctx.moveTo(px - w * .1, y - h * 1.25); ctx.lineTo(px + pw + w * .1, y - h * 1.25);
      ctx.lineTo(px + pw * .5, y - h * 1.45); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (type === 'lightning') {
      const cx0 = x + w * .5;
      ctx.beginPath();
      ctx.moveTo(cx0 - w * .25, y); ctx.lineTo(cx0, y - h * 1.3); ctx.lineTo(cx0 + w * .25, y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.shadowColor = bm.neon; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx0, y - h * 1.35, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = sil;
    } else if (type === 'bio') {
      // Zumrad o'rmon daraxtlari (Emerald Forest: multi-tier pine & canopy trees)
      const sway = Math.sin(G.t * 1.8 + s.a) * (w * 0.08);
      const cx0 = x + w * 0.5;
      ctx.fillStyle = '#1c120c';
      ctx.fillRect(cx0 - 3, y - h * 0.35, 6, h * 0.35);
      for (let tier = 0; tier < 3; tier++) {
        const ty = y - h * (0.28 + tier * 0.28);
        const tw = w * (0.72 - tier * 0.16);
        const th = h * 0.42;
        ctx.fillStyle = tier === 2 ? '#10b981' : (tier === 1 ? '#059669' : '#064e3b');
        ctx.beginPath();
        ctx.moveTo(cx0 + sway * (tier + 1) * 0.35, ty - th);
        ctx.lineTo(cx0 + tw, ty);
        ctx.lineTo(cx0 - tw, ty);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = sil;
    } else if (type === 'cosmic' || type === 'chrono') {
      // Fazoviy anomaliya (Cosmic Void: floating quantum monoliths, jump gate rings)
      const cx0 = x + w * 0.5, cy0 = y - h * 0.8;
      if (s.k < 0.48) {
        // 1) Havoda suzuvchi kvant monolit (Floating quantum monolith)
        const floatY = cy0 + Math.sin(G.t * 2.2 + s.a) * 6;
        const mw = Math.max(8, w * 0.45), mh = h * 0.95;
        ctx.fillRect(cx0 - mw / 2, floatY - mh, mw, mh);
        ctx.strokeStyle = rgba(bm.neon, 0.75);
        ctx.strokeRect(cx0 - mw / 2, floatY - mh, mw, mh);
        // Monolitdagi yorqin kvant mikrosxema chiziqlari (Circuit tracings)
        ctx.strokeStyle = rgba(bm.curbc || '#ec4899', 0.65);
        ctx.beginPath();
        ctx.moveTo(cx0, floatY - mh + 4);
        ctx.lineTo(cx0, floatY - 4);
        ctx.stroke();
        // Gravitatsion levitatsiya nurlanishi (Anti-gravity distortion glow beneath)
        ctx.fillStyle = rgba(bm.neon, 0.25 + 0.2 * Math.sin(G.t * 4 + s.a));
        ctx.beginPath();
        ctx.ellipse(cx0, floatY + 6, mw * 0.8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = sil;
      } else {
        // 2) Kvant sakrash darvozasi halqalari (Orbital jump gate rings)
        const rot = G.t * 1.3 + s.a;
        const ringPulse = 1 + 0.12 * Math.sin(G.t * 2.8 + s.a);
        ctx.save();
        ctx.translate(cx0, cy0);
        ctx.rotate(rot);
        ctx.strokeStyle = rgba(bm.neon, 0.8);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.48 * ringPulse, h * 0.62 * ringPulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = rgba(bm.curbc || '#ec4899', 0.85);
        ctx.rotate(-rot * 1.8);
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.26, h * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Kvant yadrosi va orbitadagi uchqun (Quantum core & orbiting spark)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        const sparkAng = G.t * 3.8 + s.a;
        ctx.beginPath();
        ctx.arc(Math.cos(sparkAng) * w * 0.48 * ringPulse, Math.sin(sparkAng) * h * 0.62 * ringPulse, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = rgba(bm.neon, 0.38);
      }
    } else if (type === 'tech') {
      // Chuqur Okean (Ocean: submerged Atlantis ruins, coral reefs, undulating bioluminescent jellyfish)
      const cx0 = x + w * 0.5;
      if (s.k < 0.38) {
        // 1) Suv ostidagi qadimiy sivilizatsiya ustunlari
        const colW = Math.max(6, w * 0.32), colH = h * 1.25, colX = cx0 - colW * 0.5;
        ctx.fillRect(colX, y - colH, colW, colH);
        ctx.strokeStyle = rgba(bm.neon || '#00f0ff', 0.55);
        ctx.strokeRect(colX, y - colH, colW, colH);
        ctx.fillStyle = rgba(bm.curbc || '#2dd4bf', 0.7);
        ctx.fillRect(colX - 4, y - colH, colW + 8, 3.5);
        ctx.fillRect(colX - 2, y - 4, colW + 4, 4);
        ctx.strokeStyle = rgba(bm.neon || '#00f0ff', 0.3);
        ctx.beginPath();
        ctx.moveTo(colX + colW * 0.33, y - colH + 4); ctx.lineTo(colX + colW * 0.33, y - 4);
        ctx.moveTo(colX + colW * 0.67, y - colH + 4); ctx.lineTo(colX + colW * 0.67, y - 4);
        ctx.stroke();
        ctx.fillStyle = sil;
      } else if (s.k < 0.70) {
        // 2) Tarvaqaylagan korall riflari
        ctx.strokeStyle = rgba(bm.curbc || '#2dd4bf', 0.65);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx0, y);
        ctx.lineTo(cx0, y - h * 0.4);
        ctx.lineTo(cx0 - w * 0.28, y - h * 0.75);
        ctx.lineTo(cx0 - w * 0.42, y - h * 1.05);
        ctx.moveTo(cx0, y - h * 0.4);
        ctx.lineTo(cx0 + w * 0.12, y - h * 0.85);
        ctx.lineTo(cx0 + w * 0.08, y - h * 1.15);
        ctx.moveTo(cx0 + w * 0.12, y - h * 0.85);
        ctx.lineTo(cx0 + w * 0.35, y - h * 1.0);
        ctx.stroke();
        ctx.fillStyle = '#00f0ff';
        for (const [px, py] of [[cx0 - w * 0.42, y - h * 1.05], [cx0 + w * 0.08, y - h * 1.15], [cx0 + w * 0.35, y - h * 1.0]]) {
          ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = sil;
      } else {
        // 3) Sunken Abyssal Bastion Obelisk & Deep-Sea Plankton Drift
        const towW = Math.max(10, w * 0.36), towH = h * 1.15;
        const towX = cx0 - towW * 0.5;

        // Dark abyssal basalt silhouette body
        ctx.fillStyle = '#02121e';
        ctx.fillRect(towX, y - towH, towW, towH);

        // Stepped parapet crown
        ctx.fillStyle = '#041d30';
        ctx.fillRect(towX - towW * 0.12, y - towH, towW * 1.24, towH * 0.16);

        // Subtle vertical bioluminescent conduit vein
        ctx.strokeStyle = rgba(bm.neon || '#00f0ff', 0.45);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx0, y - towH + towH * 0.18);
        ctx.lineTo(cx0, y - 4);
        ctx.stroke();

        // Delicate, realistic bioluminescent deep-sea jellyfish drifting above spire
        const jw = Math.min(11, towW * 0.38), jh = jw * 0.75;
        const jellyY = y - towH - 12 + Math.sin(G.t * 2.4 + s.a) * 6;
        const pulse = 1.0 + 0.12 * Math.sin(G.t * 3.2 + s.a);
        ctx.fillStyle = 'rgba(45, 212, 191, 0.40)';
        ctx.beginPath();
        ctx.ellipse(cx0, jellyY, jw * pulse, jh * pulse, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(207, 250, 254, 0.65)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Fine trailing tentacles
        for (let t = -1; t <= 1; t++) {
          const tx = cx0 + t * (jw * 0.45);
          const tWave = Math.sin(G.t * 3.8 + s.a + t) * 3.5;
          ctx.beginPath();
          ctx.moveTo(tx, jellyY);
          ctx.quadraticCurveTo(tx + tWave, jellyY + jh * 1.2, tx + tWave * 1.4, jellyY + jh * 2.2);
          ctx.stroke();
        }

        ctx.fillStyle = sil;
      }
    } else if (type === 'rift') {
      // Sehrli Dunyo (Fantasy: floating sky islands, fairytale castles, glowing crystals)
      const cx0 = x + w * 0.5;
      if (s.k < 0.38) {
        // 1) Havoda muallaq suzuvchi sehrli orol
        const floatY = y - h * 0.65 + Math.sin(G.t * 2.2 + s.a) * 7;
        const iw = w * 1.25, ih = h * 0.55;
        ctx.fillStyle = sil;
        ctx.beginPath();
        ctx.moveTo(cx0 - iw * 0.5, floatY);
        ctx.lineTo(cx0 + iw * 0.5, floatY);
        ctx.lineTo(cx0 + iw * 0.25, floatY + ih * 0.75);
        ctx.lineTo(cx0, floatY + ih);
        ctx.lineTo(cx0 - iw * 0.25, floatY + ih * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(bm.curbc || '#f472b6', 0.55);
        ctx.stroke();
        ctx.fillStyle = rgba(bm.neon || '#c084fc', 0.85);
        ctx.fillRect(cx0 - iw * 0.45, floatY - 2.5, iw * 0.9, 2.5);
        ctx.strokeStyle = rgba(bm.curbc || '#f472b6', 0.4);
        for (let v = -2; v <= 2; v++) {
          const vx = cx0 + v * (iw * 0.16);
          ctx.beginPath();
          ctx.moveTo(vx, floatY + ih * 0.5);
          ctx.lineTo(vx + Math.sin(G.t * 3 + v) * 3, floatY + ih * 0.9 + (Math.abs(v) % 2) * 6);
          ctx.stroke();
        }
        ctx.fillStyle = sil;
      } else if (s.k < 0.72) {
        // 2) Ertaknamo qasr minoralari
        const tw = w * 0.42, th = h * 1.35, tx = cx0 - tw * 0.5;
        ctx.fillRect(tx, y - th * 0.7, tw, th * 0.7);
        ctx.strokeRect(tx, y - th * 0.7, tw, th * 0.7);
        ctx.beginPath();
        ctx.moveTo(tx - 2, y - th * 0.7);
        ctx.lineTo(cx0, y - th);
        ctx.lineTo(tx + tw + 2, y - th * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(bm.neon || '#c084fc', 0.7);
        ctx.stroke();
        const flagWave = Math.sin(G.t * 5.0 + s.a) * 3;
        ctx.fillStyle = bm.curbc || '#f472b6';
        ctx.beginPath();
        ctx.moveTo(cx0, y - th);
        ctx.lineTo(cx0 + 7, y - th - 3 + flagWave);
        ctx.lineTo(cx0, y - th - 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fffbeb';
        ctx.beginPath();
        ctx.arc(cx0, y - th * 0.48, 2.5, Math.PI, 0);
        ctx.rect(cx0 - 2.5, y - th * 0.48, 5, 4);
        ctx.fill();
        ctx.fillStyle = sil;
      } else {
        // 3) Qirrali ulkan sehrli kristall klasteri
        const cyH = h * 1.4;
        const cyPulse = Math.sin(G.t * 3.5 + s.a);
        ctx.beginPath();
        ctx.moveTo(cx0, y - cyH);
        ctx.lineTo(cx0 + w * 0.35, y - cyH * 0.4);
        ctx.lineTo(cx0 + w * 0.22, y);
        ctx.lineTo(cx0 - w * 0.22, y);
        ctx.lineTo(cx0 - w * 0.35, y - cyH * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(bm.neon || '#c084fc', 0.85);
        ctx.stroke();
        ctx.strokeStyle = rgba(bm.curbc || '#f472b6', 0.65 + cyPulse * 0.35);
        ctx.beginPath();
        ctx.moveTo(cx0, y - cyH);
        ctx.lineTo(cx0, y);
        ctx.stroke();
        if (cyPulse > 0.2) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx0, y - cyH, 2.6 * cyPulse, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = sil;
      }
    } else {
      ctx.fillRect(x + w * .4, y - h * .7, w * .2, h * .7);
    }
  }
  ctx.restore();
}

/* ------------------- BIOM ATMOSFERA ANIMATSIYALARI ------------------- */
/** Shimol yog'dusi / Kvant plazma to'lqinlari */
function drawSkyTraffic(bm, horizon) {
  if (G.quality === 'low') return;
  ctx.save();
  const cars = [
    // Distant high-altitude traffic stream
    { yFrac: 0.36, speed: 34, dir: 1, len: 13, h: 2.2, col: '#00e5ff', head: '#ffffff', hull: '#0f172a', dist: true },
    { yFrac: 0.30, speed: 40, dir: -1, len: 14, h: 2.4, col: '#ff2fb9', head: '#fde047', hull: '#1e1b4b', dist: true },
    // Midground detailed cyber-spinners
    { yFrac: 0.24, speed: 62, dir: 1, len: 22, h: 3.8, col: '#ff2b43', head: '#00e5ff', hull: '#162038', dist: false },
    { yFrac: 0.16, speed: 52, dir: -1, len: 19, h: 3.4, col: '#ff2fb9', head: '#ffffff', hull: '#1e1638', dist: false },
    { yFrac: 0.11, speed: 78, dir: 1, len: 24, h: 4.0, col: '#00e5ff', head: '#ffffff', hull: '#0f1c34', dist: false }
  ];
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    const y = horizon - H * c.yFrac + Math.sin(G.t * 2.4 + i * 1.9) * 2.2;
    const span = W + 180;
    const tShift = G.t * c.speed + i * 260;
    const x = c.dir > 0 ? (tShift % span) - 90 : W + 90 - (tShift % span);

    // 1) Engine light trail
    const trailLen = c.len * (c.dist ? 2.0 : 2.8);
    const tg = ctx.createLinearGradient(x - c.dir * trailLen, y, x - c.dir * c.len * 0.4, y);
    tg.addColorStop(0, 'rgba(0,0,0,0)');
    tg.addColorStop(0.65, rgba(c.col, c.dist ? 0.25 : 0.42));
    tg.addColorStop(1, rgba(c.col, c.dist ? 0.70 : 0.95));
    ctx.strokeStyle = tg;
    ctx.lineWidth = c.h * 0.75;
    ctx.beginPath();
    ctx.moveTo(x - c.dir * trailLen, y);
    ctx.lineTo(x - c.dir * c.len * 0.4, y);
    ctx.stroke();

    // 2) Angular futuristic spinner fuselage & cockpit canopy
    ctx.fillStyle = c.hull;
    ctx.beginPath();
    ctx.moveTo(x - c.dir * c.len * 0.5, y + c.h * 0.5);
    ctx.lineTo(x - c.dir * c.len * 0.42, y - c.h * 0.45);
    ctx.lineTo(x + c.dir * c.len * 0.18, y - c.h * 0.55);
    ctx.lineTo(x + c.dir * c.len * 0.55, y + c.h * 0.15);
    ctx.lineTo(x + c.dir * c.len * 0.42, y + c.h * 0.5);
    ctx.closePath();
    ctx.fill();

    if (!c.dist) {
      // Illuminated glass canopy
      ctx.fillStyle = rgba(c.head, 0.75);
      ctx.beginPath();
      ctx.moveTo(x - c.dir * c.len * 0.12, y - c.h * 0.45);
      ctx.lineTo(x + c.dir * c.len * 0.16, y - c.h * 0.45);
      ctx.lineTo(x + c.dir * c.len * 0.32, y - c.h * 0.05);
      ctx.lineTo(x - c.dir * c.len * 0.18, y - c.h * 0.05);
      ctx.closePath();
      ctx.fill();
      // Underside hover thruster glow
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(x - c.len * 0.22, y + c.h * 0.45, c.len * 0.44, 1.3);
    }

    // 3) Headlight & taillight emitters
    ctx.fillStyle = c.head;
    ctx.beginPath();
    ctx.arc(x + c.dir * c.len * 0.52, y + c.h * 0.15, c.h * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.col;
    ctx.beginPath();
    ctx.arc(x - c.dir * c.len * 0.48, y + c.h * 0.1, c.h * 0.52, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAurora(bm, horizon) {
  const t = G.t * 0.75;
  const type = bm.props || 'city';
  const colors = type === 'bio'
    ? [rgba(bm.neon || '#10b981', 0.28), rgba(bm.curbc || '#6ee7b7', 0.20), 'rgba(163, 230, 53, 0.16)']
    : (type === 'cosmic'
      ? ['rgba(168, 85, 247, 0.26)', 'rgba(236, 72, 153, 0.22)', rgba(bm.neon || '#00f5ff', 0.18)]
      : ['rgba(56, 189, 248, 0.28)', 'rgba(167, 243, 208, 0.22)', 'rgba(192, 132, 252, 0.18)']);
      
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let layer = 0; layer < 3; layer++) {
    const lOff = layer * 0.9;
    ctx.fillStyle = colors[layer];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const step = Math.max(16, W / 18);
    for (let x = 0; x <= W + step; x += step) {
      const p = x / W;
      const wave = Math.sin(p * 4.2 + t + lOff) * horizon * 0.12 +
                   Math.cos(p * 2.8 - t * 0.5 + lOff) * horizon * 0.08 +
                   Math.sin(p * 8.5 + t * 1.6) * horizon * 0.04;
      const y = horizon * (0.12 + layer * 0.09) + wave;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Waving vertical ray striations for true northern lights feel
  if (G.quality !== 'low') {
    const rayCount = 14;
    for (let r = 0; r < rayCount; r++) {
      const rx = W * (0.05 + (r / rayCount) * 0.9 + Math.sin(t * 0.5 + r * 1.7) * 0.03);
      const rProg = (rx / W);
      const rAlpha = (0.06 + 0.08 * Math.sin(t * 2.1 + r * 2.3)) * (1 + 0.3 * Math.sin(rProg * 6));
      const rh = horizon * (0.35 + 0.15 * Math.cos(rProg * 3.5 + t));
      const rg = ctx.createLinearGradient(rx, 0, rx, rh);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(0.5, rgba(bm.neon || '#00e5ff', rAlpha));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(rx - 6, 0, 12, rh);
    }
  }
  ctx.restore();
}

/** Shahar osmonidagi neon projektor nurlari */
function drawSkySearchlights(bm, horizon) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const t = G.t;
  const lights = [
    { originX: W * 0.22, angle: -Math.PI / 2 + Math.sin(t * 0.72) * 0.44, col: bm.neon },
    { originX: W * 0.76, angle: -Math.PI / 2 + Math.cos(t * 0.85) * 0.48, col: bm.curbc || bm.neon }
  ];
  for (const sl of lights) {
    const rayLen = H * 0.88;
    const spread = 0.11;
    const ax = sl.originX + Math.cos(sl.angle - spread) * rayLen;
    const ay = horizon + Math.sin(sl.angle - spread) * rayLen;
    const bx = sl.originX + Math.cos(sl.angle + spread) * rayLen;
    const by = horizon + Math.sin(sl.angle + spread) * rayLen;
    const beamGrad = ctx.createLinearGradient(sl.originX, horizon, (ax + bx) / 2, (ay + by) / 2);
    beamGrad.addColorStop(0, rgba(sl.col, 0.28));
    beamGrad.addColorStop(0.6, rgba(sl.col, 0.08));
    beamGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(sl.originX, horizon);
    ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Dinamik retro-quyosh va chaqnashlar */
function drawAnimatedSun(bm, horizon) {
  const type = bm.props || 'city';
  // Biome 6 (tech): Underwater Ocean has NO sun sphere or scanlines (deep sea)
  if (type === 'tech') return;

  const sunPulse = 1 + Math.sin(G.t * 2.2) * 0.035;
  const sunR = H * .175 * sunPulse;
  const sunX = cx - CAM.x * 24;
  const sunY = horizon - sunR * .55;

  ctx.save();

  // Biomga xos quyosh va nurlar:
  if (type === 'city' || type === 'grid') {
    // 1) NEON CITY: Stylized Urban Cyber-Sol with smog corona & sleek retrowave scanlines
    const coronaGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.65, sunX, sunY, sunR * 1.55);
    coronaGrad.addColorStop(0, rgba(bm.sun1 || '#ff2fb9', 0.46));
    coronaGrad.addColorStop(0.55, rgba(bm.sun2 || '#6d1fa0', 0.18));
    coronaGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.55, 0, Math.PI * 2);
    ctx.fill();

    const sunGrad = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
    sunGrad.addColorStop(0, bm.sun0 || '#ffe08a');
    sunGrad.addColorStop(0.5, bm.sun1 || '#ff2fb9');
    sunGrad.addColorStop(1, bm.sun2 || '#6d1fa0');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal cyber scanlines (urban retrowave smog)
    const lines = 7;
    ctx.fillStyle = bm.sky2 || '#180b3c';
    for (let i = 1; i <= lines; i++) {
      const ph = i / (lines + 1);
      const ly = sunY + sunR * (0.05 + ph * 0.90);
      const lh = Math.max(1.4, H * 0.007 * (1 + ph * 1.4));
      const chord = Math.sqrt(Math.max(0, sunR * sunR - Math.pow(ly - sunY, 2)));
      if (chord > 2) ctx.fillRect(sunX - chord, ly - lh / 2, chord * 2, lh);
    }
  } else if (type === 'crystal') {
    // 2) CRYSTAL DESERT: Blinding Desert Twin Sun / Solar Flare with Amber Corona (NO scanlines)
    const coronaGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 1.8);
    coronaGrad.addColorStop(0, 'rgba(254, 240, 138, 0.65)');
    coronaGrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.35)');
    coronaGrad.addColorStop(0.75, 'rgba(180, 83, 9, 0.12)');
    coronaGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 8-point diffraction solar spikes
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
    ctx.lineWidth = 1.6;
    for (let c = 0; c < 8; c++) {
      const ca = c * (Math.PI / 4) + G.t * 0.15;
      const clen = sunR * (1.25 + 0.25 * Math.sin(G.t * 3.2 + c));
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(ca) * (sunR * 0.7), sunY + Math.sin(ca) * (sunR * 0.7));
      ctx.lineTo(sunX + Math.cos(ca) * clen, sunY + Math.sin(ca) * clen);
      ctx.stroke();
    }

    // Blinding intense solar disk
    const sunGrad = ctx.createRadialGradient(sunX - sunR * 0.2, sunY - sunR * 0.2, sunR * 0.1, sunX, sunY, sunR);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.35, '#fef08a');
    sunGrad.addColorStop(0.7, '#f59e0b');
    sunGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 0.95, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'ice') {
    // 3) ICE ORBIT: Cold Pale Sun with Parhelion Frost Halo Ring & 4 Sun Dogs (NO scanlines)
    const coronaGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, sunR * 1.6);
    coronaGrad.addColorStop(0, 'rgba(224, 242, 254, 0.55)');
    coronaGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.22)');
    coronaGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Frost halo ring
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.35, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Sun dogs (parhelia)
    for (let d = 0; d < 4; d++) {
      const da = d * (Math.PI / 2) + 0.15;
      const dx = sunX + Math.cos(da) * sunR * 1.35;
      const dy = sunY + Math.sin(da) * sunR * 1.35;
      const dPulse = 0.5 + 0.5 * Math.sin(G.t * 3.5 + d * 1.5);
      const dogGrad = ctx.createRadialGradient(dx, dy, 0, dx, dy, 7);
      dogGrad.addColorStop(0, '#ffffff');
      dogGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.6)');
      dogGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = dogGrad;
      ctx.beginPath();
      ctx.arc(dx, dy, 7 * dPulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pale cold sun disk
    const sunGrad = ctx.createRadialGradient(sunX - sunR * 0.25, sunY - sunR * 0.25, sunR * 0.05, sunX, sunY, sunR);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.5, '#bae6fd');
    sunGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 0.92, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'lava' || type === 'volcano') {
    // 4) LAVA & MAGMA: Eruptive Plasma Coronal Loops & Fiery Flares (NO scanlines)
    const coronaGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, sunR * 1.7);
    coronaGrad.addColorStop(0, 'rgba(254, 240, 138, 0.60)');
    coronaGrad.addColorStop(0.35, 'rgba(249, 115, 22, 0.38)');
    coronaGrad.addColorStop(0.7, 'rgba(220, 38, 38, 0.16)');
    coronaGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.7, 0, Math.PI * 2);
    ctx.fill();

    // Eruptive plasma arcs
    ctx.strokeStyle = 'rgba(255, 85, 0, 0.75)';
    ctx.lineWidth = 2.8;
    for (let f = 0; f < 6; f++) {
      const fa = G.t * 0.55 + f * (Math.PI * 2 / 6);
      const fx = sunX + Math.cos(fa) * sunR;
      const fy = sunY + Math.sin(fa) * sunR;
      const flen = 18 + Math.sin(G.t * 4.2 + f * 2.2) * 14;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(
        sunX + Math.cos(fa + 0.2) * (sunR + flen * 1.3),
        sunY + Math.sin(fa + 0.2) * (sunR + flen * 1.3),
        sunX + Math.cos(fa + 0.35) * sunR,
        sunY + Math.sin(fa + 0.35) * sunR
      );
      ctx.stroke();
    }

    // Fiery sun disk
    const sunGrad = ctx.createRadialGradient(sunX, sunY - sunR * 0.3, sunR * 0.1, sunX, sunY, sunR);
    sunGrad.addColorStop(0, '#fef08a');
    sunGrad.addColorStop(0.45, '#f97316');
    sunGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'bio') {
    // 5) EMERALD FOREST: Soft Filtered Canopy Sunburst Rays scattering through leaves (NO scanlines)
    for (let r = 0; r < 8; r++) {
      const ra = r * (Math.PI / 4) + G.t * 0.12;
      const rlen = sunR * (1.6 + 0.35 * Math.sin(G.t * 2.4 + r));
      const rayGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, rlen);
      rayGrad.addColorStop(0, 'rgba(167, 243, 208, 0.35)');
      rayGrad.addColorStop(0.6, 'rgba(52, 211, 153, 0.14)');
      rayGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.arc(sunX, sunY, rlen, ra - 0.14, ra + 0.14);
      ctx.closePath();
      ctx.fill();
    }

    // Soft diffused emerald solar disc
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 1.15);
    sunGrad.addColorStop(0, 'rgba(236, 253, 245, 0.95)');
    sunGrad.addColorStop(0.35, 'rgba(110, 231, 183, 0.75)');
    sunGrad.addColorStop(0.75, 'rgba(16, 185, 129, 0.35)');
    sunGrad.addColorStop(1, 'rgba(5, 150, 105, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.15, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'cosmic' || type === 'chrono') {
    // 6) COSMIC ANOMALY: Supermassive Singularity Accretion Disk with Relativistic Doppler Warping (NO scanlines)
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(-0.28);

    // Glowing relativistic outer accretion ring
    const diskGrad = ctx.createRadialGradient(0, 0, sunR * 0.5, 0, 0, sunR * 1.95);
    diskGrad.addColorStop(0, 'rgba(254, 240, 138, 0.90)');
    diskGrad.addColorStop(0.3, 'rgba(168, 85, 247, 0.75)');
    diskGrad.addColorStop(0.65, 'rgba(126, 34, 206, 0.40)');
    diskGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = diskGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, sunR * 1.95, sunR * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();

    // Secondary warped gravitation ring
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, sunR * 2.1, sunR * 0.58, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Event Horizon Pitch-Black Void Core
    ctx.fillStyle = '#030008';
    ctx.beginPath();
    ctx.arc(0, 0, sunR * 0.62, 0, Math.PI * 2);
    ctx.fill();

    // Photon sphere bright golden rim
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.92)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, sunR * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (type === 'rift') {
    // 7) MAGIC RIFT WORLD: Preserved Stage 17 Celestial Eclipse with Runic Halo (NO scanlines)
    const haloGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 1.6);
    haloGrad.addColorStop(0, 'rgba(192, 132, 252, 0.55)');
    haloGrad.addColorStop(0.45, 'rgba(244, 114, 182, 0.28)');
    haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.32, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.lineWidth = 1.6;
    for (let r = 0; r < 6; r++) {
      const ra = r * (Math.PI / 3) + G.t * 0.35;
      const rlen = sunR * (1.25 + 0.20 * Math.sin(G.t * 3.4 + r));
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(ra) * sunR, sunY + Math.sin(ra) * sunR);
      ctx.lineTo(sunX + Math.cos(ra) * rlen, sunY + Math.sin(ra) * rlen);
      ctx.stroke();
    }

    // Eclipse dark celestial orb with violet rim
    const sunGrad = ctx.createRadialGradient(sunX - sunR * 0.2, sunY - sunR * 0.2, sunR * 0.1, sunX, sunY, sunR);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.35, '#c084fc');
    sunGrad.addColorStop(0.8, '#581c87');
    sunGrad.addColorStop(1, '#1e0538');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 0.95, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** Biom atmosfera zarrachalari (chang, qor, uchqun, spora, kvant) */
function drawBiomeParticles(bm, horizon) {
  const dt = 1 / 60;
  const type = bm.props || 'city';
  ctx.save();

  if (type === 'city' || type === 'grid') {
    // 1) Dinamik shahar droni
    const droneSpan = W * 1.4;
    for (let d = 0; d < 2; d++) {
      const droneX = ((G.t * (d === 0 ? 55 : -40) + d * 480) % droneSpan) - W * 0.2;
      const droneY = horizon * (0.24 + d * 0.32 + Math.sin(G.t * 2.5 + d * 3) * 0.04);
      ctx.fillStyle = d === 0 ? bm.neon : (bm.curbc || '#ff2fb9');
      ctx.fillRect(droneX, droneY, 15, 2.8);
      ctx.fillStyle = '#ff2b43';
      ctx.fillRect(droneX - 4, droneY + 0.5, 4, 1.8);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(droneX + 14, droneY + 0.5, 3.5, 1.8);
    }

    // 2) Tushayotgan neon ma'lumot uchqunlari
    for (const p of G.biomeAtmo) {
      p.y = (p.y + dt * (0.04 + p.seed * 0.06)) % 1;
      p.x = (p.x + Math.sin(G.t * 1.2 + p.a) * dt * 0.02 + 1) % 1;
      const px = p.x * W;
      const py = p.y * (horizon * 1.15);
      const alpha = (0.28 + 0.58 * Math.sin(G.t * 3 + p.seed * 10)) * (1 - py / (horizon * 1.2));
      if (alpha > 0.05) {
        ctx.fillStyle = p.seed > 0.5 ? bm.neon : (bm.curbc || '#fff');
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillRect(px, py, p.r, p.r * 2.2);
      }
    }
  } else if (type === 'crystal') {
    // 1) Ufqdagi prizmatik quyosh nuri ustunlari
    if (G.quality !== 'low') {
      for (let b = 0; b < 3; b++) {
        const bx = W * (0.2 + b * 0.3 + Math.sin(G.t * 0.6 + b * 2.1) * 0.06);
        const bw = W * 0.04;
        const bAlpha = 0.10 + 0.09 * Math.sin(G.t * 2.2 + b * 1.7);
        const bg = ctx.createLinearGradient(bx, 0, bx, horizon);
        bg.addColorStop(0, 'rgba(0,0,0,0)');
        bg.addColorStop(0.5, rgba(b % 2 === 0 ? bm.neon : (bm.curbc || '#fbbf24'), bAlpha));
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(bx - bw / 2, 0, bw, horizon);
      }
    }
    // 2) Cho'l issiq qum shamoli va suzuvchi kristall changi
    const dustWind = 0.24 + (G.speed / 45) * 0.28;
    for (const p of G.biomeAtmo) {
      p.x = (p.x - dt * (dustWind + p.seed * 0.16) + 1) % 1;
      p.y = (p.y - dt * (0.04 + p.seed * 0.06) + 1) % 1;
      const px = p.x * W;
      const py = p.y * horizon;
      const glint = Math.sin(G.t * 4 + p.seed * 20);
      if (glint > 0.18) {
        ctx.fillStyle = glint > 0.8 ? '#ffffff' : (p.seed > 0.5 ? (bm.curbc || '#fbbf24') : (bm.neon || '#d946ef'));
        ctx.globalAlpha = (glint - 0.18) * 0.88;
        const sz = p.r * (0.7 + glint * 0.5);
        ctx.beginPath();
        ctx.moveTo(px, py - sz * 1.4);
        ctx.lineTo(px + sz, py);
        ctx.lineTo(px, py + sz * 1.4);
        ctx.lineTo(px - sz, py);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (type === 'ice') {
    // Qor va muz bo'roni
    const windSpeed = 0.44 + (G.speed / 42) * 0.38;
    for (const p of G.biomeAtmo) {
      p.x -= dt * (windSpeed + p.seed * 0.25);
      if (p.x < 0) p.x += 1;
      p.y = (p.y + dt * (0.06 + p.seed * 0.08)) % 1;
      const px = p.x * W;
      const py = p.y * H;
      const alpha = 0.32 + 0.52 * Math.sin(G.t * 2 + p.seed * 10);
      ctx.fillStyle = p.seed > 0.6 ? '#ffffff' : (bm.neon || '#a5f3fc');
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha * 0.80));
      ctx.beginPath();
      ctx.ellipse(px, py, p.r * 2.6, p.r * 0.95, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'lava') {
    // Plazma chaqmoq chaqnashlari osmonda
    const boltPhase = (G.t * 1.8) % 4.0;
    if (boltPhase < 0.22 && G.quality !== 'low') {
      const lx0 = W * (0.25 + ((Math.floor(G.t * 1.8) * 0.37) % 0.5));
      ctx.strokeStyle = boltPhase < 0.09 ? '#ffffff' : '#ffaa00';
      ctx.lineWidth = boltPhase < 0.09 ? 2.5 : 1.4;
      ctx.globalAlpha = (1 - boltPhase / 0.22) * 0.88;
      ctx.beginPath();
      let lx = lx0, ly = horizon * 0.08;
      ctx.moveTo(lx, ly);
      for (let s = 1; s <= 5; s++) {
        lx += Math.sin(s * 7.3 + G.t * 18) * 18;
        ly = horizon * (0.08 + s * 0.17);
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }
    // Otiluvchi olovli vulqon uchqunlari va qizil cho'g'
    for (const p of G.biomeAtmo) {
      p.y -= dt * (0.11 + p.seed * 0.15);
      if (p.y < 0) { p.y += 1; p.x = Math.random(); }
      p.x = (p.x + Math.sin(G.t * 3.5 + p.a) * dt * 0.05 + 1) % 1;
      const px = p.x * W;
      const py = p.y * horizon;
      const life = 1 - p.y;
      const flick = Math.sin(G.t * 6 + p.seed * 30);
      ctx.fillStyle = life > 0.6 ? '#ff2200' : (life > 0.3 ? '#ff6600' : '#ffe066');
      ctx.globalAlpha = Math.max(0, Math.min(1, (0.5 + 0.5 * flick) * (1 - life * 0.6)));
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, p.r * (1.2 - life * 0.5)), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'bio') {
    // Suzuvchi yashil biolyuminestsent sporalar
    for (const p of G.biomeAtmo) {
      p.x = (p.x + Math.sin(G.t * 1.6 + p.a) * dt * 0.03 + 1) % 1;
      p.y = (p.y + Math.cos(G.t * 1.3 + p.seed * 15) * dt * 0.02 + 1) % 1;
      const px = p.x * W;
      const py = p.y * (horizon * 1.1);
      const pulse = 0.42 + 0.58 * Math.sin(G.t * 2.5 + p.seed * 12);
      ctx.fillStyle = p.seed > 0.5 ? (bm.neon || '#10b981') : (bm.curbc || '#6ee7b7');
      ctx.globalAlpha = pulse * 0.78;
      ctx.beginPath();
      ctx.arc(px, py, p.r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      if (G.quality !== 'low') {
        ctx.globalAlpha = pulse * 0.25;
        ctx.beginPath();
        ctx.arc(px, py, p.r * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === 'cosmic') {
    // Uchar kometa / meteor izi
    const mProg = (G.t * 0.35) % 2.4;
    if (mProg < 1.0) {
      const mx = W * (0.85 - mProg * 0.65);
      const my = horizon * (0.12 + mProg * 0.55);
      const mg = ctx.createLinearGradient(mx, my, mx + 55, my - 28);
      mg.addColorStop(0, '#ffffff');
      mg.addColorStop(0.4, bm.neon || '#8b5cf6');
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = mg;
      ctx.lineWidth = 2.4;
      ctx.globalAlpha = Math.sin(mProg * Math.PI);
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 55, my - 28); ctx.stroke();
    }
    // Gravitatsion kvant girdobi zarrachalari
    const swirlCenter = cx;
    const swirlY = horizon * 0.58;
    for (const p of G.biomeAtmo) {
      p.a += dt * (0.6 + p.seed * 0.8);
      const dist = (p.seed * 0.45 + 0.05) * Math.max(W, H);
      const px = swirlCenter + Math.cos(p.a) * dist * 1.2;
      const py = swirlY + Math.sin(p.a) * dist * 0.5;
      if (px >= 0 && px <= W && py >= 0 && py <= horizon) {
        ctx.fillStyle = p.seed > 0.5 ? bm.neon : (bm.curbc || '#ec4899');
        ctx.globalAlpha = 0.35 + 0.55 * Math.sin(p.a * 2);
        ctx.beginPath();
        ctx.arc(px, py, p.r * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === 'tech') {
    // Chuqur okean: ko'tarilayotgan havo pufakchalari va biolyuminestsent plankton
    for (const p of G.biomeAtmo) {
      p.y -= dt * (0.07 + p.seed * 0.12);
      if (p.y < 0) { p.y += 1; p.x = Math.random(); }
      p.x = (p.x + Math.sin(G.t * 2.2 + p.a) * dt * 0.03 + 1) % 1;
      const px = p.x * W;
      const py = p.y * horizon;
      const pPulse = 0.5 + 0.5 * Math.sin(G.t * 3.5 + p.seed * 18);
      ctx.strokeStyle = rgba(bm.neon || '#00f0ff', 0.55 + pPulse * 0.35);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(px, py, p.r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(px - p.r * 0.45, py - p.r * 0.45, Math.max(0.8, p.r * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'rift') {
    // Sehrli dunyo: suzuvchi sehrli yulduz changi va alvon yulduzchalar
    for (const p of G.biomeAtmo) {
      p.x = (p.x + Math.sin(G.t * 1.8 + p.a) * dt * 0.04 + 1) % 1;
      p.y = (p.y + Math.cos(G.t * 1.4 + p.seed * 16) * dt * 0.03 + 1) % 1;
      const px = p.x * W;
      const py = p.y * (horizon * 1.15);
      const glint = Math.sin(G.t * 4.2 + p.seed * 25);
      if (glint > 0.15) {
        ctx.fillStyle = glint > 0.82 ? '#ffffff' : (p.seed > 0.5 ? (bm.neon || '#c084fc') : (bm.curbc || '#f472b6'));
        ctx.globalAlpha = Math.min(1, (glint - 0.15) * 1.1);
        const sz = p.r * (0.8 + glint * 0.6);
        ctx.beginPath();
        ctx.moveTo(px, py - sz * 1.5);
        ctx.lineTo(px + sz * 0.5, py - sz * 0.4);
        ctx.lineTo(px + sz * 1.5, py);
        ctx.lineTo(px + sz * 0.5, py + sz * 0.4);
        ctx.lineTo(px, py + sz * 1.5);
        ctx.lineTo(px - sz * 0.5, py + sz * 0.4);
        ctx.lineTo(px - sz * 1.5, py);
        ctx.lineTo(px - sz * 0.5, py - sz * 0.4);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Asosiy orqa fon va dinamik ufq manzarasi */

/** Chuqur Okean (Deep Waters): suv osti nurlanishi (caustics) va uzoqdagi akula / skat siluetlari */
function drawOceanCreatures(bm, horizon) {
  if (G.quality === 'low') return;
  ctx.save();
  const rayCount = G.quality === 'medium' ? 3 : 5;
  for (let r = 0; r < rayCount; r++) {
    const rx = W * (0.15 + r * 0.20 + Math.sin(G.t * 0.8 + r * 1.5) * 0.05);
    const rw = W * (0.05 + Math.sin(G.t * 1.2 + r) * 0.02);
    const rAlpha = 0.07 + 0.06 * Math.sin(G.t * 1.5 + r * 2);
    const rg = ctx.createLinearGradient(rx, 0, rx + W * 0.04, horizon);
    rg.addColorStop(0, 'rgba(0, 240, 255, ' + rAlpha * 1.8 + ')');
    rg.addColorStop(0.6, 'rgba(45, 212, 191, ' + rAlpha + ')');
    rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(rx - rw * 0.3, 0);
    ctx.lineTo(rx + rw * 0.7, 0);
    ctx.lineTo(rx + rw * 1.6, horizon);
    ctx.lineTo(rx - rw * 0.6, horizon);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 2; i++) {
    const dir = i === 0 ? 1 : -1;
    const speed = i === 0 ? 32 : 24;
    const span = W + 240;
    const tShift = G.t * speed + i * 450;
    const sx = dir > 0 ? (tShift % span) - 120 : W + 120 - (tShift % span);
    const sy = horizon * (0.28 + i * 0.28 + Math.sin(G.t * 1.6 + i * 3) * 0.04);
    const sLen = 28 + i * 8, sH = 6 + i * 2;

    ctx.save();
    ctx.translate(sx, sy);
    if (dir < 0) ctx.scale(-1, 1);

    if (i === 0) {
      // Akula silueti
      ctx.fillStyle = 'rgba(2, 16, 36, 0.82)';
      ctx.strokeStyle = rgba(bm.neon || '#00f0ff', 0.35);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-sLen * 0.5, 0);
      ctx.quadraticCurveTo(-sLen * 0.1, -sH * 0.85, sLen * 0.35, -sH * 0.2);
      ctx.lineTo(sLen * 0.5, 0);
      ctx.quadraticCurveTo(sLen * 0.2, sH * 0.8, -sLen * 0.2, sH * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-sLen * 0.05, -sH * 0.6);
      ctx.lineTo(-sLen * 0.15, -sH * 1.8);
      ctx.lineTo(sLen * 0.05, -sH * 0.6);
      ctx.closePath();
      ctx.fill();

      const tailSway = Math.sin(G.t * 5.2) * 3;
      ctx.beginPath();
      ctx.moveTo(-sLen * 0.5, 0);
      ctx.lineTo(-sLen * 0.75, -sH * 1.1 + tailSway);
      ctx.lineTo(-sLen * 0.62, 0);
      ctx.lineTo(-sLen * 0.75, sH * 1.1 + tailSway);
      ctx.closePath();
      ctx.fill();
    } else {
      // Skat / Manta ray silueti
      ctx.fillStyle = 'rgba(2, 18, 40, 0.82)';
      ctx.strokeStyle = rgba(bm.curbc || '#2dd4bf', 0.35);
      ctx.lineWidth = 0.8;
      const wingFlap = Math.sin(G.t * 3.2) * (sH * 0.7);
      ctx.beginPath();
      ctx.moveTo(sLen * 0.4, 0);
      ctx.quadraticCurveTo(0, -sH * 1.8 + wingFlap, -sLen * 0.2, 0);
      ctx.lineTo(-sLen * 0.6, 0);
      ctx.lineTo(-sLen * 0.2, 0);
      ctx.quadraticCurveTo(0, sH * 1.8 - wingFlap, sLen * 0.4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Sehrli Dunyo (Fantasy): osmonda uchuvchi afsonaviy ajdarho va muallaq orollar */
function drawFantasySkyCreatures(bm, horizon) {
  if (G.quality === 'low') return;
  ctx.save();
  const span = W + 260;
  const dShift = G.t * 40;
  const dx = (dShift % span) - 130;
  const dy = horizon * (0.24 + Math.sin(G.t * 1.4) * 0.05);

  ctx.save();
  ctx.translate(dx, dy);

  ctx.fillStyle = 'rgba(20, 3, 34, 0.90)';
  ctx.strokeStyle = rgba(bm.curbc || '#f472b6', 0.5);
  ctx.lineWidth = 1.0;

  const wingCycle = Math.sin(G.t * 5.5);
  const wingH = 14 * wingCycle;

  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(-6, -wingH - 8);
  ctx.lineTo(8, -wingH - 12);
  ctx.lineTo(14, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.quadraticCurveTo(18, -4, 24, -2);
  ctx.lineTo(26, -5);
  ctx.lineTo(24, -2);
  ctx.lineTo(20, 2);
  ctx.lineTo(8, 3);
  ctx.closePath();
  ctx.fill();

  const tailWave = Math.sin(G.t * 4.5) * 4;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.quadraticCurveTo(-14, tailWave, -24, -tailWave);
  ctx.lineTo(-28, -tailWave - 3);
  ctx.lineTo(-24, -tailWave);
  ctx.stroke();

  ctx.fillStyle = bm.curbc || '#f472b6';
  for (let s = 1; s <= 3; s++) {
    const spX = -28 - s * 7;
    const spY = -tailWave + Math.sin(G.t * 8 + s) * 3;
    ctx.globalAlpha = 0.6 / s;
    ctx.beginPath();
    ctx.arc(spX, spY, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

/** Yam-yashil O'rmon (Forest): tog' sharsharalari va engil tuman */
function drawForestWaterfalls(bm, horizon) {
  if (G.quality === 'low') return;
  ctx.save();
  const par = -CAM.x * 8;
  const falls = [0.25, 0.72];
  for (let i = 0; i < falls.length; i++) {
    const fx = W * falls[i] + par;
    const fy = horizon * 0.42;
    const fH = horizon - fy;
    const fW = 4.5 + Math.sin(G.t * 3 + i) * 1.2;

    const wg = ctx.createLinearGradient(fx, fy, fx, horizon);
    wg.addColorStop(0, 'rgba(110, 231, 183, 0.75)');
    wg.addColorStop(0.5, 'rgba(255, 255, 255, 0.90)');
    wg.addColorStop(1, 'rgba(167, 243, 208, 0.85)');
    ctx.fillStyle = wg;
    ctx.fillRect(fx - fW / 2, fy, fW, fH);

    ctx.fillStyle = 'rgba(209, 250, 229, 0.35)';
    ctx.beginPath();
    ctx.arc(fx, horizon - 2, fW * 2.8, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
}

/** Vulqon (Volcano): otilayotgan vulqon krateri va lava favvorasi */
function drawVolcanoEruption(bm, horizon) {
  if (G.quality === 'low') return;
  ctx.save();
  const par = -CAM.x * 8;
  const vX = cx - W * 0.15 + par;
  const vY = horizon * 0.52;

  for (let b = 0; b < 4; b++) {
    const bCycle = (G.t * 0.8 + b * 0.25) % 1;
    const bArcX = vX + Math.sin(b * 3.7 + 1.2) * (bCycle * 42);
    const bArcY = vY - Math.sin(bCycle * Math.PI) * 36;
    ctx.fillStyle = bCycle < 0.5 ? '#ffe066' : '#ff4500';
    ctx.globalAlpha = (1 - bCycle * 0.6);
    ctx.beginPath();
    ctx.arc(bArcX, bArcY, Math.max(1.2, 3.2 * (1 - bCycle * 0.5)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Biomga xos uzoq gorizont relyefi (har bir biom uchun mutlaqo o'zgacha siluet) */
function drawBiomeDistantHorizon(bm, horizon, par) {
  const type = bm.props || 'city';
  ctx.save();

  if (type === 'tech') {
    // 1) UNDERWATER OCEAN: Abyssal seafloor trench ridges & oceanic seamounts (NO mountains!)
    const trenches = [
      { yOffset: 0.32, color: 'rgba(2, 14, 28, 0.92)', freq: 0.0032, amp: 24, phase: 0 },
      { yOffset: 0.18, color: 'rgba(3, 24, 46, 0.86)', freq: 0.0050, amp: 16, phase: 2.1 }
    ];
    for (let t = 0; t < trenches.length; t++) {
      const tr = trenches[t];
      ctx.fillStyle = tr.color;
      ctx.beginPath();
      ctx.moveTo(0, horizon + 20);
      for (let x = -20; x <= W + 40; x += 25) {
        const ry = horizon - H * tr.yOffset + Math.sin((x + par * 0.4) * tr.freq + tr.phase) * tr.amp;
        ctx.lineTo(x, ry);
      }
      ctx.lineTo(W + 40, horizon + 20);
      ctx.closePath();
      ctx.fill();
    }
  } else if (type === 'cosmic' || type === 'chrono') {
    // 2) COSMIC ANOMALY: Distant floating asteroid belt & shattered planetoids in zero-G (NO mountains!)
    const astCount = G.quality === 'low' ? 8 : 14;
    for (let i = 0; i < astCount; i++) {
      const astX = ((i * (W / astCount * 1.2) + par * 0.35) % (W + 80)) - 40;
      const astY = horizon - H * (0.06 + ((i * 7) % 11) * 0.022) + Math.sin(G.t * 1.6 + i) * 5;
      const astR = 3.5 + (i % 4) * 2.8;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(30, 16, 56, 0.88)' : 'rgba(48, 24, 84, 0.82)';
      ctx.beginPath();
      ctx.arc(astX, astY, astR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(astX - astR * 0.3, astY - astR * 0.3, astR * 0.7, 0, Math.PI);
      ctx.stroke();
    }
  } else if (type === 'city' || type === 'grid') {
    // 3) NEON CITY: Distant hazy industrial megacity skyline silhouettes & communication spires (NO mountains!)
    ctx.fillStyle = 'rgba(8, 12, 28, 0.76)';
    ctx.beginPath();
    ctx.moveTo(0, horizon + 20);
    const cityBlocks = [
      { x: 0.02, w: 0.09, h: 0.22 }, { x: 0.12, w: 0.07, h: 0.30, spire: true },
      { x: 0.20, w: 0.11, h: 0.18 }, { x: 0.32, w: 0.08, h: 0.34, spire: true },
      { x: 0.41, w: 0.12, h: 0.24 }, { x: 0.54, w: 0.09, h: 0.28 },
      { x: 0.64, w: 0.11, h: 0.36, spire: true }, { x: 0.76, w: 0.08, h: 0.20 },
      { x: 0.85, w: 0.12, h: 0.32, spire: true }
    ];
    for (const cb of cityBlocks) {
      const bx = cb.x * W + par * 0.3, bw = cb.w * W, bh = cb.h * H;
      ctx.fillRect(bx, horizon - bh, bw, bh + 20);
      if (cb.spire) {
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(bx + bw * 0.5, horizon - bh);
        ctx.lineTo(bx + bw * 0.5, horizon - bh - H * 0.06);
        ctx.stroke();
      }
    }
  } else if (type === 'bio') {
    // 4) EMERALD FOREST: Layered colossal forest canopy ridges & giant root silhouettes (NO sharp triangles!)
    const canopyTiers = [
      { yOffset: 0.28, color: 'rgba(2, 26, 18, 0.88)', crest: 'rgba(16, 185, 129, 0.32)' },
      { yOffset: 0.16, color: 'rgba(4, 48, 34, 0.82)', crest: 'rgba(52, 211, 153, 0.42)' }
    ];
    for (let t = 0; t < canopyTiers.length; t++) {
      const ct = canopyTiers[t];
      ctx.fillStyle = ct.color;
      ctx.beginPath();
      ctx.moveTo(0, horizon + 20);
      for (let x = -20; x <= W + 40; x += 40) {
        const canH = H * ct.yOffset + Math.sin((x + par * (0.35 + t * 0.1)) * 0.012 + t * 1.5) * 18;
        ctx.lineTo(x, horizon - canH);
      }
      ctx.lineTo(W + 40, horizon + 20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ct.crest;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  } else if (type === 'crystal') {
    // 5) CRYSTAL DESERT: Flat-topped sandstone mesas & wind-swept dune plateaus (NO sharp triangles!)
    ctx.fillStyle = 'rgba(60, 20, 24, 0.78)';
    ctx.beginPath();
    ctx.moveTo(0, horizon + 20);
    const mesas = [
      { x: 0.04, w: 0.18, h: 0.22 }, { x: 0.26, w: 0.20, h: 0.26 },
      { x: 0.52, w: 0.19, h: 0.24 }, { x: 0.76, w: 0.22, h: 0.28 }
    ];
    for (const ms of mesas) {
      const mx = ms.x * W + par * 0.35, mw = ms.w * W, mh = ms.h * H;
      ctx.lineTo(mx, horizon);
      ctx.lineTo(mx + mw * 0.12, horizon - mh * 0.75);
      ctx.lineTo(mx + mw * 0.22, horizon - mh);
      ctx.lineTo(mx + mw * 0.78, horizon - mh);
      ctx.lineTo(mx + mw * 0.88, horizon - mh * 0.75);
      ctx.lineTo(mx + mw, horizon);
    }
    ctx.lineTo(W + 40, horizon + 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.36)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else if (type === 'ice') {
    // 6) ICE ORBIT: Sharp glacial ice walls & jagged icy peaks with crystalline facet highlights
    ctx.fillStyle = 'rgba(6, 32, 60, 0.78)';
    ctx.beginPath();
    ctx.moveTo(0, horizon + 20);
    for (const m of G.mountains) {
      const mx = m.x * W + par * 0.4, mw = m.w * W, mh = m.h * H * 1.15;
      ctx.lineTo(mx, horizon);
      ctx.lineTo(mx + mw * 0.42, horizon - mh);
      ctx.lineTo(mx + mw, horizon);
    }
    ctx.lineTo(W + 40, horizon + 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else if (type === 'lava' || type === 'volcano') {
    // 7) LAVA & MAGMA: Jagged volcanic basalt caldera peaks with flowing magma rivers down flanks
    ctx.fillStyle = 'rgba(28, 10, 8, 0.82)';
    ctx.beginPath();
    ctx.moveTo(0, horizon + 20);
    for (const m of G.mountains) {
      const mx = m.x * W + par * 0.4, mw = m.w * W, mh = m.h * H;
      ctx.lineTo(mx, horizon);
      ctx.lineTo(mx + mw * 0.48, horizon - mh);
      ctx.lineTo(mx + mw, horizon);
    }
    ctx.lineTo(W + 40, horizon + 20);
    ctx.closePath();
    ctx.fill();
    const mPulse = 0.65 + 0.35 * Math.sin(G.t * 4);
    ctx.lineWidth = 1.6;
    for (const m of G.mountains) {
      const mx = m.x * W + par * 0.4, mw = m.w * W, mh = m.h * H;
      const peakX = mx + mw * 0.48, peakY = horizon - mh;
      ctx.strokeStyle = rgba('#ff5500', mPulse * 0.85);
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.quadraticCurveTo(peakX - mw * 0.12, peakY + mh * 0.5, peakX - mw * 0.22, horizon);
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffd166', mPulse * 0.65);
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.quadraticCurveTo(peakX + mw * 0.14, peakY + mh * 0.45, peakX + mw * 0.26, horizon);
      ctx.stroke();
    }
  } else if (type === 'rift') {
    // 8) MAGIC RIFT WORLD: Skip generic mountains entirely!
    // The floating astral islands, celestial ring, and stardust cascades from drawHorizonPanorama provide the pure fantasy horizon.
  }

  ctx.restore();
}

let _cachedSkyGrad = null, _cachedSkyKey = "";
let _cachedGndGrad = null, _cachedGndKey = "";
function drawBackdrop() {
  const bm = currentBiome();
  const horizon = cy;
  const type = bm.props || 'city';
  const isGravAnomaly = G.inDimension && G.dimensionIdx === 5;

  // 1) Dinamik osmon gradienti (keshlangan)
  const skyKey = bm.sky0 + bm.sky1 + bm.sky2 + horizon;
  if (_cachedSkyKey !== skyKey) {
    _cachedSkyKey = skyKey;
    _cachedSkyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
    _cachedSkyGrad.addColorStop(0, bm.sky0);
    _cachedSkyGrad.addColorStop(0.5, bm.sky1);
    _cachedSkyGrad.addColorStop(1, bm.sky2);
  }
  ctx.fillStyle = _cachedSkyGrad;
  ctx.fillRect(0, 0, W, H);

  // 2) Kosmik tumanlik (Volumetric Space Nebula) — kosmik va gravitatsion anomaliya uchun
  if (type === 'cosmic' || isGravAnomaly) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Nebula Cloud 1: Deep Violet / Magenta
    const n1X = cx - W * 0.22 - CAM.x * 6;
    const n1Y = horizon * 0.38;
    const n1R = H * 0.38;
    const ng1 = ctx.createRadialGradient(n1X, n1Y, 0, n1X, n1Y, n1R);
    ng1.addColorStop(0, 'rgba(168, 85, 247, 0.28)');
    ng1.addColorStop(0.5, 'rgba(217, 70, 239, 0.14)');
    ng1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng1;
    ctx.beginPath(); ctx.arc(n1X, n1Y, n1R, 0, Math.PI * 2); ctx.fill();

    // Nebula Cloud 2: Hyper Cyan / Blue
    const n2X = cx + W * 0.32 - CAM.x * 8;
    const n2Y = horizon * 0.28;
    const n2R = H * 0.32;
    const ng2 = ctx.createRadialGradient(n2X, n2Y, 0, n2X, n2Y, n2R);
    ng2.addColorStop(0, 'rgba(0, 229, 255, 0.22)');
    ng2.addColorStop(0.6, 'rgba(56, 189, 248, 0.10)');
    ng2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng2;
    ctx.beginPath(); ctx.arc(n2X, n2Y, n2R, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 3) Yulduzlar (pulsatsiyalanuvchi nurlanish va miltillash — chuqur okeanda yulduzlar ko'rinmaydi)
  if (type !== 'tech') {
    ctx.save();
    ctx.fillStyle = bm.star || '#dfeaff';
    for (const s of G.stars) {
      ctx.globalAlpha = (.35 + .65 * Math.abs(Math.sin(G.t * 1.6 + s.tw))) * .85;
      ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    ctx.restore();
  }

  // 4) Shimol yog'dusi / Kiber-aurora (muz, kosmik, biosfera yoki o'lchamlarda)
  if (type === 'ice' || type === 'cosmic' || type === 'bio' || G.inDimension) {
    drawAurora(bm, horizon);
  }

  // 5) Shahar kiber-projektorlari va uchar mashinalar trafigi
  if (type === 'city' || type === 'grid' || (G.inDimension && G.dimensionIdx === 3)) {
    drawSkySearchlights(bm, horizon);
    drawSkyTraffic(bm, horizon);
  }
  if (type === 'tech') {
    drawOceanCreatures(bm, horizon);
  } else if (type === 'rift') {
    drawFantasySkyCreatures(bm, horizon);
  } else if (type === 'bio') {
    drawForestWaterfalls(bm, horizon);
  } else if (type === 'lava' || type === 'volcano') {
    drawVolcanoEruption(bm, horizon);
  }

  if (typeof BIOME_3D !== 'undefined' && BIOME_3D.drawAtmosphereEffects) {
    BIOME_3D.drawAtmosphereEffects(bm, horizon);
  }

  // 6) Dinamik Quyosh (korona, chaqnashlar va skan-chiziqlar bilan)
  drawAnimatedSun(bm, horizon);

  // 7) Gravitatsion to'lqin halqalari (Gravitational Anomaly distortion waves)
  if (isGravAnomaly) {
    ctx.save();
    ctx.translate(cx - CAM.x * 24, horizon - H * 0.10);
    const ripT = (G.t * 0.6) % 1;
    for (let r = 0; r < 3; r++) {
      const prog = (ripT + r * 0.33) % 1;
      const ringRad = H * (0.18 + prog * 0.55);
      const ringA = Math.sin(prog * Math.PI) * 0.45;
      ctx.strokeStyle = r % 2 === 0 ? 'rgba(0,229,255,' + ringA + ')' : 'rgba(217,70,239,' + ringA + ')';
      ctx.lineWidth = Math.max(1, (1 - prog) * 4);
      ctx.beginPath();
      ctx.ellipse(0, 0, ringRad * 1.8, ringRad * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 8) Kosmik Void: uzoqdagi ulkan halqali gaz giganti sayyorasi (Distant ringed exoplanet)
  if (type === 'cosmic' || isGravAnomaly) {
    const pX = cx + W * 0.28 - CAM.x * 10;
    const pY = horizon - H * 0.22;
    const pR = H * 0.082;
    ctx.save();
    const pGrad = ctx.createRadialGradient(pX - pR * 0.35, pY - pR * 0.35, pR * 0.1, pX, pY, pR);
    pGrad.addColorStop(0, '#7e22ce');
    pGrad.addColorStop(0.5, '#3b0764');
    pGrad.addColorStop(1, '#060014');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(pX, pY, pR, 0, Math.PI * 2);
    ctx.fill();

    // Sayyora atmosferasi jilosi
    ctx.strokeStyle = rgba(bm.neon || '#00f5ff', 0.55);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(pX, pY, pR, 0, Math.PI * 2);
    ctx.stroke();

    // Halqalar (tilted planetary rings)
    ctx.strokeStyle = rgba(bm.neon || '#00f5ff', 0.45);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(pX, pY, pR * 2.3, pR * 0.42, -0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba(bm.curbc || '#ec4899', 0.35);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(pX, pY, pR * 2.7, pR * 0.50, -0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 9) Biomga xos uzoq gorizont relyefi (tog'lar, megapolis, kanonlar, xandaqlar)
  const par = -CAM.x * 8;
  drawBiomeDistantHorizon(bm, horizon, par);

  // 10) Biom atmosfera zarrachalari (qor, uchqun, chang, spora)
  drawBiomeParticles(bm, horizon);

  // 11) Yon manzara (har yo'l o'z animatsiyali manzarasi)
  const bpar = -CAM.x * 14;
  drawSilhouette(bm, horizon, bpar);
  if (typeof BIOME_3D !== 'undefined' && BIOME_3D.drawHorizonPanorama) {
    BIOME_3D.drawHorizonPanorama(bm, horizon, bpar);
  }

  // 12) Yer gradienti (keshlangan)
  const gndKey = (bm.gnd0 || '#100a26') + (bm.gnd1 || '#03030a') + horizon + H;
  if (_cachedGndKey !== gndKey) {
    _cachedGndKey = gndKey;
    _cachedGndGrad = ctx.createLinearGradient(0, horizon, 0, H);
    _cachedGndGrad.addColorStop(0, bm.gnd0 || '#100a26');
    _cachedGndGrad.addColorStop(1, bm.gnd1 || '#03030a');
  }
  ctx.fillStyle = _cachedGndGrad;
  ctx.fillRect(0, horizon, W, H - horizon);

  // 13) Neon gorizontal to'r (perspektiv qatlam va harakatlanuvchi impuls to'lqini)
  ctx.save();
  const gs = 8, gsc = G.dist % gs;
  for (let i = 1; i < 11; i++) {
    const z = i * gs - gsc + 4;
    proj([-48, 0, z], _a); proj([48, 0, z], _b);
    if (_a.vis && _b.vis) {
      const linePulse = 0.14 + 0.09 * Math.sin(G.t * 3.6 - z * 0.12);
      ctx.strokeStyle = rgba(bm.curbc || bm.neon, linePulse);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(_a.x, _a.y); ctx.lineTo(_b.x, _b.y); ctx.stroke();
    }
  }
  ctx.restore();
}

const _ease = (u) => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3);
function _rrect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function drawTrackTransition() {
  const t = G.trans;
  if (t == null || t < 0 || t >= TRANS_DUR) return;
  const bm = trackBiome();
  const inK = _ease(t / .35), outK = _ease((TRANS_DUR - t) / .6);
  const hold = Math.min(inK, outK);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // 1) Hyper Warp Speedlines — Giper-fazoga sakrash nurlari
  const warpProg = t / TRANS_DUR;
  const numRays = 44;
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2 + Math.sin(i * 11) * 0.1;
    const speedPhase = ((warpProg * 2.8 + i * 0.23) % 1);
    const r1 = Math.pow(speedPhase, 2.2) * Math.max(W, H) * 0.8;
    const r2 = r1 + (15 + speedPhase * 120);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    ctx.strokeStyle = i % 2 === 0 ? bm.neon : (bm.curbc || '#ffffff');
    ctx.globalAlpha = Math.sin(speedPhase * Math.PI) * 0.75 * hold;
    ctx.lineWidth = Math.max(1.2, (1 + speedPhase * 3.5));
    ctx.beginPath();
    ctx.moveTo(cos * r1, sin * r1);
    ctx.lineTo(cos * r2, sin * r2);
    ctx.stroke();
  }
  ctx.restore();

  // 2) Radial Quantum Shockwave — Ekranni qamrab oluvchi neon to'lqin halqalari
  for (let w = 0; w < 3; w++) {
    const swProg = Math.max(0, Math.min(1, (t - w * 0.22) / 1.3));
    if (swProg > 0 && swProg < 1) {
      const ringR = Math.pow(swProg, 0.8) * Math.max(W, H) * 0.95;
      const ringAlpha = Math.sin(swProg * Math.PI) * 0.55 * hold;
      ctx.strokeStyle = w === 1 ? (bm.curbc || '#fff') : bm.neon;
      ctx.lineWidth = Math.max(2, (1 - swProg) * 16);
      ctx.globalAlpha = ringAlpha;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 3) Ekranning 4 cheti bo'ylab Chromatic Pulse Vignette
  ctx.globalAlpha = 0.55 * hold;
  const edgeGlow = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, cy, Math.max(W, H) * 0.75);
  edgeGlow.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGlow.addColorStop(0.7, rgba(bm.neon, 0.18 * hold));
  edgeGlow.addColorStop(1, rgba(bm.curbc || bm.neon, 0.55 * hold));
  ctx.fillStyle = edgeGlow;
  ctx.fillRect(0, 0, W, H);

  // 4) Diagonal kiber-nur chiziqlari (zamonaviy neon sweep)
  const sweep = _ease(Math.min(1, t / 0.9));
  const bands = 9;
  ctx.fillStyle = bm.neon;
  for (let i = 0; i < bands; i++) {
    const ph = i / bands;
    const x = (-0.5 + sweep * 2.0 - ph * 0.35) * W;
    const bw = W * (0.09 - ph * 0.008);
    ctx.globalAlpha = 0.28 * Math.max(0, 1 - t / 1.2) * (1 - ph * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + bw, 0); ctx.lineTo(x + bw - H * 0.45, H); ctx.lineTo(x - H * 0.45, H);
    ctx.closePath(); ctx.fill();
  }

  // 5) 3D Holographic Cyberpunk Banner
  const fs = Math.max(18, Math.min(W * 0.088, H * 0.088));
  const sm = Math.max(11, fs * 0.42);
  const name = bm.name;
  const lab = '⚡  НОВЫЙ БИОМ ОБНАРУЖЕН  ⚡';
  const stars = '★'.repeat(bm.diff) + '☆'.repeat(Math.max(0, 4 - bm.diff));
  const sub = BAND_NAME[bm.band] + ' СЕКТОР  ·  ' + stars;

  ctx.font = '900 ' + fs + 'px ' + UIFONT;
  if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(fs * 0.07) + 'px';
  const wMain = ctx.measureText(name).width;
  ctx.font = '900 ' + sm + 'px ' + UIFONT;
  const wSub = Math.max(ctx.measureText(sub).width, ctx.measureText(lab).width);
  const pw = Math.min(W * 0.94, Math.max(wMain, wSub) + fs * 2.6);
  const ph2 = fs * 2.8;

  // Masshtab elastik tushishi (scale punch)
  const scalePunch = 1 + Math.max(0, 0.4 * (1 - _ease(Math.min(1, t / 0.4))));
  const px = cx, py = H * (H > W ? 0.30 : 0.26);

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(scalePunch, scalePunch);
  ctx.globalAlpha = hold;

  // Banner orqa foni va neon nurlanish
  ctx.shadowColor = rgba(bm.neon, 1);
  ctx.shadowBlur = fs * 1.5;
  const bgGrad = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0);
  bgGrad.addColorStop(0, 'rgba(4,7,20,0.92)');
  bgGrad.addColorStop(0.5, 'rgba(10,16,42,0.95)');
  bgGrad.addColorStop(1, 'rgba(4,7,20,0.92)');
  ctx.fillStyle = bgGrad;
  _rrect(-pw / 2, -ph2 / 2, pw, ph2, ph2 * 0.26);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Gorizontal kiber skaner chiziqlari banner ichida
  ctx.strokeStyle = rgba(bm.neon, 0.2);
  ctx.lineWidth = 1;
  for (let yl = -ph2 * 0.4; yl <= ph2 * 0.4; yl += ph2 * 0.2) {
    ctx.beginPath();
    ctx.moveTo(-pw * 0.46, yl); ctx.lineTo(pw * 0.46, yl);
    ctx.stroke();
  }

  // Banner ramkasi
  ctx.strokeStyle = rgba(bm.curbc || bm.neon, 0.95);
  ctx.lineWidth = Math.max(1.6, fs * 0.075);
  _rrect(-pw / 2, -ph2 / 2, pw, ph2, ph2 * 0.26);
  ctx.stroke();

  // Cyberpunk burchak braketlari (L-shaklli dekorativ burchaklar)
  const brk = Math.min(pw * 0.08, 22);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  // Yuqori chap
  ctx.beginPath(); ctx.moveTo(-pw / 2 + brk, -ph2 / 2); ctx.lineTo(-pw / 2, -ph2 / 2); ctx.lineTo(-pw / 2, -ph2 / 2 + brk); ctx.stroke();
  // Yuqori o'ng
  ctx.beginPath(); ctx.moveTo(pw / 2 - brk, -ph2 / 2); ctx.lineTo(pw / 2, -ph2 / 2); ctx.lineTo(pw / 2, -ph2 / 2 + brk); ctx.stroke();
  // Pastki chap
  ctx.beginPath(); ctx.moveTo(-pw / 2 + brk, ph2 / 2); ctx.lineTo(-pw / 2, ph2 / 2); ctx.lineTo(-pw / 2, ph2 / 2 - brk); ctx.stroke();
  // Pastki o'ng
  ctx.beginPath(); ctx.moveTo(pw / 2 - brk, ph2 / 2); ctx.lineTo(pw / 2, ph2 / 2); ctx.lineTo(pw / 2, ph2 / 2 - brk); ctx.stroke();

  // Matnlar: Sarlavha
  ctx.font = '900 ' + sm + 'px ' + UIFONT;
  ctx.fillStyle = rgba(bm.sun0 || '#ffd166', 1);
  ctx.shadowColor = rgba(bm.sun0 || '#ffd166', 0.8); ctx.shadowBlur = 8;
  ctx.fillText(lab, 0, -ph2 * 0.30);

  // Matnlar: Asosiy Biom Nomi
  ctx.font = '900 ' + fs + 'px ' + UIFONT;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = rgba(bm.neon, 1); ctx.shadowBlur = fs * 0.85;
  ctx.fillText(name, 0, ph2 * 0.03);

  // Matnlar: Qiyinlik va Yulduzlar
  ctx.shadowBlur = 0;
  ctx.font = '900 ' + sm + 'px ' + UIFONT;
  ctx.fillStyle = rgba(bm.curbc || bm.neon, 1);
  ctx.fillText(sub, 0, ph2 * 0.33);

  // Pastki yuklanish / energiya zaryadi chizig'i
  const chargeW = pw * 0.86 * _ease(Math.min(1, t / 0.65));
  ctx.fillStyle = rgba(bm.neon, 0.95);
  ctx.shadowColor = bm.neon; ctx.shadowBlur = 10;
  ctx.fillRect(-pw * 0.43, ph2 * 0.48, chargeW, Math.max(2.5, fs * 0.08));

  ctx.restore();

  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}

const _roadRowPool = [];
for (let rpi = 0; rpi < 64; rpi++) _roadRowPool.push({ x: 0, y: 0, half: 0, s: 0, z: 0 });

function drawRoad() {
  const bm = currentBiome();
  const type = bm.props || 'city';
  const segs = G.quality === 'low' ? 28 : (G.quality === 'medium' ? 38 : 44);
  const step = 5, scroll = G.dist % (step * 2);
  let prev = null;
  for (let i = segs; i >= 0; i--) {
    const z = i * step - scroll + 2;
    proj([0, 0, z], _a);
    if (!_a.vis) { prev = null; continue; }
    const half = ROADH * _a.s;
    const row = _roadRowPool[i] || (_roadRowPool[i] = { x: 0, y: 0, half: 0, s: 0, z: 0 });
    row.x = _a.x; row.y = _a.y; row.half = half; row.s = _a.s; row.z = z;
    if (prev) {
      const depth = 1 - Math.min(1, i / segs);
      const segIdx = Math.floor((G.dist - z) / step);
      const k = Math.floor((G.dist - z) / (step * 2)) % 2 === 0;

      // 0) 3D Perspective Terrain Shoulders, Embankments & Guardrails
      if (typeof BIOME_3D !== 'undefined' && BIOME_3D.drawRoadShoulders) {
        BIOME_3D.drawRoadShoulders(bm, prev, row, depth, segIdx);
      }

      // 1) Asosiy kiber-asfalt (Main dark futuristic asphalt quad)
      ctx.fillStyle = k ? (bm.road || '#15172b') : (bm.roadAlt || '#1c1f38');
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half, prev.y); ctx.lineTo(prev.x + prev.half, prev.y);
      ctx.lineTo(row.x + row.half, row.y); ctx.lineTo(row.x - row.half, row.y);
      ctx.closePath(); ctx.fill();

      // 2) Bo'ylama protektor yo'llari (LOD optimallashtirilgan)
      if (depth > 0.12 && (segIdx & 1) === 0) {
        ctx.fillStyle = 'rgba(5, 7, 14, ' + (0.28 * depth) + ')';
        for (const laneIdx of [0, 1, 2]) {
          const lx = LANES[laneIdx];
          for (const tx of [-0.44, 0.44]) {
            const p1x = prev.x + (lx + tx) * prev.s;
            const gw = Math.max(1.0, 2.6 * depth);
            ctx.fillRect(p1x - gw * 0.5, prev.y, gw, Math.max(1.5, row.y - prev.y + 1));
          }
        }
      }

      // 3) Dinamik energiya to'lqini (Pulsing neon energy wave across surface)
      const pulseWave = Math.sin(G.t * 6.5 - z * 0.22);
      if (pulseWave > 0.62 && G.quality !== 'low') {
        ctx.fillStyle = rgba(bm.neon || '#00e5ff', (pulseWave - 0.62) * 0.40 * depth);
        ctx.beginPath();
        ctx.moveTo(prev.x - prev.half, prev.y); ctx.lineTo(prev.x + prev.half, prev.y);
        ctx.lineTo(row.x + row.half, row.y); ctx.lineTo(row.x - row.half, row.y);
        ctx.closePath(); ctx.fill();
      }

      if (typeof BIOME_3D !== 'undefined' && BIOME_3D.drawRoadSurfaceEffects) {
        BIOME_3D.drawRoadSurfaceEffects(bm, prev, row, depth, segIdx);
      }

      // 4) Ko'p qavatli yuqori texnologik yo'l chetlari (Multi-layer neon curb borders)
      const curbPulse = 0.55 + depth * 0.45 * (0.8 + 0.2 * Math.sin(G.t * 5 - z * 0.15));
      const curbW = Math.max(2, 7.5 * depth);
      // Ichki metall kanal (Curb inner carbon channel)
      ctx.fillStyle = 'rgba(9, 13, 24, 0.75)';
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half, prev.y); ctx.lineTo(prev.x - prev.half + curbW, prev.y);
      ctx.lineTo(row.x - row.half + curbW, row.y); ctx.lineTo(row.x - row.half, row.y);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(prev.x + prev.half - curbW, prev.y); ctx.lineTo(prev.x + prev.half, prev.y);
      ctx.lineTo(row.x + row.half, row.y); ctx.lineTo(row.x + row.half - curbW, row.y);
      ctx.closePath(); ctx.fill();

      // Yorqin neon chetki liniya (Glowing neon outer curb edge)
      ctx.strokeStyle = rgba(bm.curbc || '#00e5ff', curbPulse);
      ctx.lineWidth = Math.max(1.5, 4.6 * depth);
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half, prev.y); ctx.lineTo(row.x - row.half, row.y);
      ctx.moveTo(prev.x + prev.half, prev.y); ctx.lineTo(row.x + row.half, row.y);
      ctx.stroke();

      // Chetdagi LED mayoqchalar (Periodic curb LED marker studs)
      if (segIdx % 4 === 0 && depth > 0.12) {
        const studR = Math.max(1.4, 3.6 * depth);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(prev.x - prev.half + 1, prev.y, studR * 0.55, 0, 6.283);
        ctx.arc(prev.x + prev.half - 1, prev.y, studR * 0.55, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = rgba(bm.neon || '#00e5ff', 0.85);
        ctx.beginPath();
        ctx.arc(prev.x - prev.half + 1, prev.y, studR, 0, 6.283);
        ctx.arc(prev.x + prev.half - 1, prev.y, studR, 0, 6.283);
        ctx.fill();
      }

      // 5) 3 ta aniq o'qiluvchi qatorlar (3 clearly readable lanes: dividers at lx = -1.2 and 1.2)
      if (segIdx % 2 === 0) {
        for (const lx of [-1.2, 1.2]) {
          // Neon tashqi halqa (Outer neon glow stripe) faqat yaqin masofada
          if (depth > 0.18) {
            ctx.strokeStyle = rgba(bm.neon || '#00e5ff', 0.45 * depth + 0.18);
            ctx.lineWidth = Math.max(1.6, 4.4 * depth);
            ctx.beginPath();
            ctx.moveTo(prev.x + lx * prev.s, prev.y); ctx.lineTo(row.x + lx * row.s, row.y);
            ctx.stroke();
          }

          // Ichki toza oq yadro (Crisp bright white core)
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + depth * 0.65) + ')';
          ctx.lineWidth = Math.max(0.8, 2.2 * depth);
          ctx.beginPath();
          ctx.moveTo(prev.x + lx * prev.s, prev.y); ctx.lineTo(row.x + lx * row.s, row.y);
          ctx.stroke();
        }
      }
      // O'rta yo'lak yo'naltiruvchi ingichka nur (Center lane subtle guidance pinstripe at lx = 0)
      if (G.quality !== 'low' && depth > 0.18 && segIdx % 3 === 0) {
        ctx.strokeStyle = rgba(bm.neon || '#00e5ff', 0.18 * depth);
        ctx.lineWidth = Math.max(0.6, 1.5 * depth);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y); ctx.lineTo(row.x, row.y);
        ctx.stroke();
      }

      // 6) Biomga xos jonli yo'l cheti obyektlari va ustunlari
      const propMod = G.quality === 'low' ? 4 : 2;
      if (i % propMod === 0 && depth > .09) {
        const pw = Math.max(1.5, 4.5 * depth), ph = Math.max(3, 15 * depth);
        const lx = prev.x - prev.half - 14 * depth;
        const rx = prev.x + prev.half + 10 * depth;
        const py = prev.y;

        if (type === 'city' || type === 'grid') {
          // Low-profile roadside barrier reflector posts integrated with the 3D sidewalk curb
          const postH = Math.max(2.5, 6.5 * depth);
          const postW = Math.max(1.2, 2.6 * depth);
          const pLx = prev.x - prev.half - 4.5 * depth;
          const pRx = prev.x + prev.half + 2.5 * depth;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(pLx, py - postH, postW, postH);
          ctx.fillRect(pRx, py - postH, postW, postH);
          ctx.fillStyle = (segIdx % 4 === 0) ? '#fde047' : (bm.neon || '#00e5ff');
          ctx.fillRect(pLx, py - postH * 0.85, postW, Math.max(1.2, 2.2 * depth));
          ctx.fillRect(pRx, py - postH * 0.85, postW, Math.max(1.2, 2.2 * depth));
        } else if (type === 'crystal') {
          // Yo'l bo'yidagi suzuvchi va aylanuvchi kristall obelisklar
          const bob = Math.sin(G.t * 3.4 + segIdx) * 5 * depth;
          const cyP = py - ph * 0.9 + bob;
          const cw = pw * 1.5, ch = ph * 0.85;
          ctx.fillStyle = rgba(segIdx % 2 === 0 ? bm.neon : (bm.curbc || '#38bdf8'), 0.4 + depth * 0.55);
          for (const sx of [lx, rx]) {
            ctx.beginPath();
            ctx.moveTo(sx, cyP - ch);
            ctx.lineTo(sx + cw, cyP);
            ctx.lineTo(sx, cyP + ch * 0.5);
            ctx.lineTo(sx - cw, cyP);
            ctx.closePath();
            ctx.fill();
          }
        } else if (type === 'ice') {
          // O'tkir muz nayzalari va krio-ustunlar
          ctx.fillStyle = rgba('#a5f3fc', 0.35 + depth * 0.6);
          const sh = ph * (1.2 + 0.25 * Math.sin(segIdx * 1.7));
          for (const sx of [lx, rx]) {
            ctx.beginPath();
            ctx.moveTo(sx - pw, py);
            ctx.lineTo(sx + pw * 0.3, py - sh);
            ctx.lineTo(sx + pw * 1.5, py);
            ctx.closePath();
            ctx.fill();
          }
        } else if (type === 'lava') {
          // Otilib turgan magma yoriqlari va olov ustunlari
          const jetH = ph * (0.7 + 0.65 * Math.abs(Math.sin(G.t * 5.2 + segIdx * 1.3)));
          ctx.fillStyle = rgba('#ff4500', 0.45 + depth * 0.55);
          ctx.fillRect(lx, py - jetH, pw * 1.4, jetH);
          ctx.fillRect(rx, py - jetH, pw * 1.4, jetH);
          ctx.fillStyle = '#ffe066';
          ctx.fillRect(lx + pw * 0.2, py - jetH * 1.15, pw, Math.max(2, 4 * depth));
          ctx.fillRect(rx + pw * 0.2, py - jetH * 1.15, pw, Math.max(2, 4 * depth));
        } else if (type === 'bio') {
          // Biolyuminestsent egiluvchan o'simlik poyalari va nurli g'unchalar
          const sway = Math.sin(G.t * 3.0 + segIdx * 0.9) * 6 * depth;
          ctx.strokeStyle = rgba(bm.neon || '#10b981', 0.4 + depth * 0.6);
          ctx.lineWidth = Math.max(1.4, 3.2 * depth);
          for (const sx of [lx, rx]) {
            ctx.beginPath();
            ctx.moveTo(sx, py);
            ctx.quadraticCurveTo(sx + sway, py - ph * 0.6, sx + sway * 1.4, py - ph * 1.15);
            ctx.stroke();
            ctx.fillStyle = '#6ee7b7';
            ctx.beginPath();
            ctx.arc(sx + sway * 1.4, py - ph * 1.15, Math.max(1.8, 4.2 * depth), 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (type === 'tech') {
          // Chuqur okean: suv osti gidrotermal ventlari va biolyuminestsent dengiz anemonlari
          const anemH = ph * (0.85 + 0.25 * Math.sin(G.t * 3.5 + segIdx));
          ctx.strokeStyle = rgba(bm.neon || '#00f0ff', 0.5 + depth * 0.5);
          ctx.lineWidth = Math.max(1.5, 3.2 * depth);
          for (const sx of [lx, rx]) {
            ctx.beginPath();
            ctx.moveTo(sx, py);
            ctx.quadraticCurveTo(sx + (sx === lx ? -6 : 6) * depth, py - anemH * 0.6, sx, py - anemH);
            ctx.stroke();
            ctx.fillStyle = '#2dd4bf';
            ctx.beginPath();
            ctx.arc(sx, py - anemH, Math.max(2.0, 4.5 * depth), 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, py - anemH, Math.max(0.8, 1.8 * depth), 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (type === 'rift') {
          // Sehrli dunyo: havoda muallaq turgan binafsharang sehrli kristallar
          const bob = Math.sin(G.t * 3.5 + segIdx * 1.1) * 6 * depth;
          const ryP = py - ph * 1.15 + bob;
          ctx.strokeStyle = rgba(bm.neon || '#c084fc', 0.55 + depth * 0.45);
          ctx.lineWidth = Math.max(1.4, 2.8 * depth);
          for (const sx of [lx, rx]) {
            const sz = Math.max(3, 7 * depth);
            ctx.beginPath();
            ctx.moveTo(sx, ryP - sz * 1.4);
            ctx.lineTo(sx + sz * 0.7, ryP);
            ctx.lineTo(sx, ryP + sz * 1.4);
            ctx.lineTo(sx - sz * 0.7, ryP);
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx - 1, ryP - 1, 2.5, 2.5);
          }
        } else {
          // Kosmik / Kvant halqali mayoqlar
          const orbY = py - ph * (0.95 + 0.18 * Math.sin(G.t * 4 + segIdx));
          ctx.strokeStyle = rgba(bm.neon || '#8b5cf6', 0.45 + depth * 0.55);
          ctx.lineWidth = Math.max(1.2, 2.5 * depth);
          for (const sx of [lx, rx]) {
            ctx.beginPath();
            ctx.arc(sx, orbY, Math.max(2.5, 6.5 * depth), 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx - 1, orbY - 1, 2.5, 2.5);
          }
        }
      }
    }
    prev = row;
  }
}

/** Checkpoint daraja darvozasi (3D Arch) */
function drawGate(z) {
  if (z < -3 || z > 80) return;
  proj([-ROADH - 0.4, 0, z], _a);
  proj([ROADH + 0.4, 0, z], _b);
  proj([-ROADH - 0.4, 3.8, z], _c);
  proj([ROADH + 0.4, 3.8, z], _d);
  if (!_a.vis || !_b.vis || !_c.vis || !_d.vis) return;
  ctx.save();
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = Math.max(2, 6 * _a.s * 0.01);
  ctx.beginPath();
  ctx.moveTo(_a.x, _a.y); ctx.lineTo(_c.x, _c.y);
  ctx.moveTo(_b.x, _b.y); ctx.lineTo(_d.x, _d.y);
  ctx.moveTo(_c.x, _c.y); ctx.lineTo(_d.x, _d.y);
  ctx.stroke();

  const bw = _d.x - _c.x, bh = (_a.y - _c.y) * 0.40;
  const fs = Math.max(11, Math.min(24, _a.s * 0.40));
  ctx.fillStyle = 'rgba(6,10,26,0.9)';
  _rrect(_c.x, _c.y, bw, bh, bh * 0.26); ctx.fill();
  ctx.strokeStyle = '#ff2fb9';
  ctx.lineWidth = Math.max(1.2, 3 * _a.s * 0.01);
  _rrect(_c.x, _c.y, bw, bh, bh * 0.26); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = '900 ' + fs + 'px ' + UIFONT;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,229,255,.9)'; ctx.shadowBlur = fs * .7;
  ctx.fillText('УРОВЕНЬ ' + (G.level + 1), (_c.x + _d.x) / 2, _c.y + bh * 0.44);
  ctx.shadowBlur = 0;
  ctx.font = '900 ' + Math.max(8, fs * 0.55) + 'px ' + UIFONT;
  ctx.fillStyle = '#ffd166';
  ctx.fillText('КОНТРОЛЬНАЯ ТОЧКА · ' + km(G.nextLevelAt), (_c.x + _d.x) / 2, _c.y + bh * 0.80);
  ctx.restore();
}

/** Suzuvchi 3D matnlar (+150 YONIDAN O'TISH, SAKRASH, COMBO) */
function drawFloatingTexts() {
  if (!G.texts || !G.texts.length) return;
  for (const ft of G.texts) {
    proj([ft.x, ft.y, ft.z], _a);
    if (!_a.vis) continue;
    const progress = ft.t / ft.l;
    const alpha = Math.max(0, 1 - progress);
    const scale = 1 + progress * 0.3;
    ctx.save();
    ctx.globalAlpha = alpha;
    const fontSize = Math.max(13, Math.min(32, _a.s * 0.42 * scale));
    ctx.font = '900 ' + (fontSize | 0) + 'px ' + UIFONT;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2.5, fontSize * 0.16);
    ctx.strokeStyle = 'rgba(4,5,13,.92)';
    ctx.strokeText(ft.text, _a.x, _a.y);
    if (G.quality === 'high') {
      ctx.shadowColor = ft.col || '#ffd166'; ctx.shadowBlur = fontSize * .55;
    }
    ctx.fillStyle = ft.col || '#ffd166';
    ctx.fillText(ft.text, _a.x, _a.y);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

/** Xavfli obyektning ustida qizil «!» uchburchagi, pastida qizil yoʼl dogʼi.
    Foydali obyektda rangli yuqori strelka va rangli dogʼ. */
function drawGroundPatch(o) {
  const m = OBJ[o.kind];
  const bad = !!HAZARD[o.kind];
  const col = bad ? '#ff2b43' : m.col;
  if (bad) {
    // Xavfli hudud: qizil ogohlantiruvchi yorug'lik perimetri (High-contrast red danger footprint)
    quad(o.x - m.patW, o.z - m.patL, o.x + m.patW, o.z + m.patL, .025,
      rgba('#ff2b43', .28), rgba('#ff2b43', .85));
    // Ichki xavf nuri (Internal warning core)
    quad(o.x - m.patW * .82, o.z - m.patL * .6, o.x + m.patW * .82, o.z + m.patL * .6, .027,
      rgba('#ff2b43', .16), null);
    if (JUMPABLE[o.kind]) {
      // Sakrash yo'lagi (Bright golden runway with clear jump indicator runway)
      quad(o.x - m.patW * 1.05, o.z - m.patL - .85, o.x + m.patW * 1.05, o.z - m.patL - .15, .03,
        'rgba(255, 209, 102, .58)', 'rgba(255, 209, 102, .95)');
      quad(o.x - m.patW * .55, o.z - m.patL - .65, o.x + m.patW * .55, o.z - m.patL - .35, .032,
        'rgba(255, 255, 255, .85)', null);
    }
  } else {
    // Foydali bonuslar: mayin aylanma neon aura
    quad(o.x - m.patW, o.z - m.patL, o.x + m.patW, o.z + m.patL, .025,
      rgba(col, .20), rgba(col, .75));
  }
}

/** Yumshoq neon nur — ochko beradigan narsalar yiroqdan ham ko'rinadi */
function drawGlow(pos, col, k) {
  if (G.quality === 'low' && pos[2] > 28) return;
  proj([pos[0], pos[1] + .45, pos[2]], _b);
  if (!_b.vis || _b.dz > 54) return;
  const r = _b.s * k;
  if (r < 4) return;
  ctx.save();
  if (G.quality === 'low') {
    ctx.fillStyle = rgba(col, .24);
    ctx.beginPath(); ctx.arc(_b.x, _b.y, r * 0.72, 0, 6.283); ctx.fill();
    ctx.restore();
    return;
  }
  const g = ctx.createRadialGradient(_b.x, _b.y, 0, _b.x, _b.y, r);
  g.addColorStop(0, rgba(col, .40));
  g.addColorStop(.55, rgba(col, .13));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(_b.x, _b.y, r, 0, 6.283); ctx.fill();
  ctx.restore();
}
function drawBadge(o) {
  if (o.z > 44 || o.z < -1) return;
  const m = OBJ[o.kind], bad = !!HAZARD[o.kind];
  proj([o.x, m.badY, o.z], _a);
  if (!_a.vis) return;
  const pulse = 1 + .12 * Math.sin(G.t * 7 + o.z);
  const r = Math.max(9, Math.min(26, _a.s * .30)) * pulse;
  const X = _a.x, Y = _a.y;
  if (bad) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(X, Y - r); ctx.lineTo(X + r * 1.12, Y + r * .82); ctx.lineTo(X - r * 1.12, Y + r * .82);
    ctx.closePath();
    ctx.fillStyle = '#ff2b43'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.2, r * .13); ctx.stroke();
    ctx.fillStyle = '#fff';
    const bw = r * .20, bh = r * .58;
    ctx.fillRect(X - bw / 2, Y - r * .35, bw, bh);
    ctx.beginPath(); ctx.arc(X, Y + r * .40, Math.max(1.1, r * .12), 0, 6.283); ctx.fill();
    if (JUMPABLE[o.kind]) {
      // sariq yuqori strelka: bu to'siq SAKRAB O'TILADI
      ctx.beginPath();
      ctx.moveTo(X - r * .7, Y + r * 2.05);
      ctx.lineTo(X, Y + r * 1.15);
      ctx.lineTo(X + r * .7, Y + r * 2.05);
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = Math.max(2, r * .26);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath(); ctx.arc(X, Y, r * 1.05, 0, 6.283);
    ctx.fillStyle = rgba(m.col, .16); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(X - r * .8, Y + r * .45);
    ctx.lineTo(X, Y - r * .65);
    ctx.lineTo(X + r * .8, Y + r * .45);
    ctx.strokeStyle = m.col; ctx.lineWidth = Math.max(2, r * .3);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
    if (o.kind === KIND.LIFE || o.kind === KIND.LIFE_PLUS) {
      // Draw genuine heart path inside badge
      ctx.fillStyle = o.kind === KIND.LIFE_PLUS ? '#f43f5e' : '#ff2b43';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, r * 0.14);
      const hScale = r * 0.055;
      ctx.save();
      ctx.translate(X, Y + r * 0.95);
      ctx.beginPath();
      ctx.moveTo(0, 4 * hScale);
      ctx.bezierCurveTo(-6 * hScale, -4 * hScale, -12 * hScale, 4 * hScale, 0, 14 * hScale);
      ctx.bezierCurveTo(12 * hScale, 4 * hScale, 6 * hScale, -4 * hScale, 0, 4 * hScale);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (o.kind === KIND.MAG_PLUS || o.kind === KIND.SH_PLUS || o.kind === KIND.LIFE_PLUS) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = Math.max(1, r * 0.12);
      const pw = Math.max(3, r * 0.32), ph = Math.max(1.5, r * 0.10);
      const px = X + r * 0.55, py = Y - r * 0.55;
      ctx.fillRect(px - pw / 2, py - ph / 2, pw, ph);
      ctx.fillRect(px - ph / 2, py - pw / 2, ph, pw);
      ctx.strokeRect(px - pw / 2, py - ph / 2, pw, ph);
      ctx.strokeRect(px - ph / 2, py - pw / 2, ph, pw);
      ctx.restore();
    }
    ctx.restore();
  }
}

/* --------------------------- 3-LANE PORTAL SYSTEM --------------------------- */
const PORTAL_LANE_THEMES = [
  // Lane 0: Electric Cyan / Hyper Blue Quantum Gateway
  {
    col1: '#00f5ff',
    col2: '#00b4d8',
    col3: '#ffffff',
    colAura: 'rgba(0, 245, 255, 0.45)',
    colDark: '#021c36',
    name: 'КВАНТОВЫЙ КОРИДОР',
    icon: '⚡'
  },
  // Lane 1: Deep Neon Violet / Hyper Purple Vortex
  {
    col1: '#d946ef',
    col2: '#a855f7',
    col3: '#ffffff',
    colAura: 'rgba(217, 70, 239, 0.45)',
    colDark: '#230a34',
    name: 'ГИПЕРПРОСТРАНСТВО',
    icon: '🌀'
  },
  // Lane 2: Bright Azure / Cyber Blue Rift
  {
    col1: '#38bdf8',
    col2: '#6366f1',
    col3: '#ffffff',
    colAura: 'rgba(56, 189, 248, 0.45)',
    colDark: '#0a193a',
    name: 'КИБЕР-РАЗЛОМ',
    icon: '💠'
  }
];

/** 3-Polosali Kiber-Portal — Faol Kirish Portali (`portal_active`):
 *  - Ko'p qavatli aylanuvchi energiya halqalari
 *  - Chuqurlik hissi beruvchi giper-fazoviy girdob (hyperspace depth vortex)
 *  - Neon ko'k (#00e5ff), binafsha (#a855f7) va moviy (#38bdf8) ranglar
 *  - Yaqinlashgan sari zarrachalar va yorug'lik kuchi asta ortishi
 *  - CRITICAL FIX: Mashina yaqinlashganda portal ichida dinamik teshik (aperture) ochiladi;
 *    portal hech qachon o'yinchi mashinasini va yo'lni berkitib qo'ymaydi! */
function drawPortalActive(o) {
  if (o.z > 72 || o.z < -2.5) return;
  const l = (o.lane != null) ? o.lane : (o.x < -0.8 ? 0 : (o.x > 0.8 ? 2 : 1));
  const theme = PORTAL_LANE_THEMES[l] || PORTAL_LANE_THEMES[1];
  const validDimIdx = (o.targetDim >= 0 && o.targetDim < DIMENSIONS.length) ? o.targetDim : 0;
  const dim = DIMENSIONS[validDimIdx] || DIMENSIONS[0];
  const col1 = theme.col1;
  const col2 = dim.neon || theme.col2;
  const col3 = '#ffffff';

  // 1) Yo'l polosasi bo'ylab faol energiya yo'lagi (Intense energy runway)
  // CRITICAL FIX: o.z yaqinlashganda yo'lak mashina oldida (z >= 0.6) to'xtaydi, mashina kapotiga chiqmaydi
  const trailLen = Math.min(32, Math.max(6, o.z));
  const trailStart = Math.max(0.65, o.z - trailLen);
  const trailEnd = Math.max(trailStart + 0.5, o.z + 1.2);
  if (o.z > 0.4) {
    quad(o.x - 1.15, trailStart, o.x + 1.15, trailEnd, 0.02,
      rgba(col1, 0.22 + 0.14 * Math.sin(G.t * 8)), rgba(col2, 0.65));

    // Yo'l bo'ylab yuguruvchi kiber-strelkalar (Forward energy chevrons)
    const chevSteps = G.quality === 'low' ? 3 : 5;
    for (let c = 0; c < chevSteps; c++) {
      const cz = o.z - ((G.t * 18 + c * (trailLen / chevSteps)) % trailLen);
      if (cz > 1.1 && cz < o.z - 0.7) {
        proj([o.x - 0.82, 0.04, cz], _a);
        proj([o.x, 0.04, cz + 1.2], _b);
        proj([o.x + 0.82, 0.04, cz], _c);
        if (_a.vis && _b.vis && _c.vis) {
          ctx.save();
          ctx.strokeStyle = c % 2 === 0 ? col1 : '#ffffff';
          ctx.lineWidth = Math.max(1.8, 3.5 * _b.s * 0.04);
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.moveTo(_a.x, _a.y); ctx.lineTo(_b.x, _b.y); ctx.lineTo(_c.x, _c.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Faol yo'lak chetlaridagi vertikal plazma yo'naltiruvchi mayoqlar (Pylon beacons)
    if (o.z > 2.0 && o.z < 55 && G.quality !== 'low') {
      for (const side of [-1.15, 1.15]) {
        proj([o.x + side, 0.05, o.z], _a);
        proj([o.x + side, 2.8, o.z], _b);
        if (_a.vis && _b.vis) {
          ctx.save();
          ctx.strokeStyle = col1;
          ctx.lineWidth = Math.max(1.2, 2.6 * _a.s * 0.03);
          ctx.globalAlpha = 0.45 + 0.25 * Math.sin(G.t * 10 + side);
          ctx.beginPath(); ctx.moveTo(_a.x, _a.y); ctx.lineTo(_b.x, _b.y); ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // 2) Portal markazi va o'lchami
  proj([o.x, 1.55, o.z], _a);
  if (!_a.vis) return;
  const rx = 1.28 * _a.s;
  const ry = 1.58 * _a.s;
  const cxP = _a.x, cyP = _a.y;

  // Proximity: yaqinlashgan sari energiya va zarrachalar asta kuchayadi
  const prox = Math.max(0.4, Math.min(1.6, 1.6 - (o.z / 72) * 1.1));

  // CRITICAL FIX: Mashina portalga yaqinlashganda markazda aperture (ochiq teshik) paydo bo'ladi
  // o.z <= 0.35 bo'lganda (mashina darvoza tekisligida yoki orqasida), ichki parda butunlay ochiladi
  // shunda mashina HECH QACHON ko'rinmay qolmaydi!
  const isPassing = o.z <= 0.45;
  const aperture = isPassing ? 1.0 : (o.z < 7.0 ? Math.max(0, 1 - (o.z - 0.45) / 6.55) : 0);

  ctx.save();

  // A) Tashqi dinamik neon aura (o.z > 0.45 da nozik, ekranni qoplamaydi)
  if (G.quality !== 'low' && !isPassing) {
    const auraAlpha = (1 - aperture * 0.7) * Math.min(0.70, 0.42 * prox);
    if (auraAlpha > 0.02) {
      const aura = ctx.createRadialGradient(cxP, cyP, rx * 0.2, cxP, cyP, rx * 1.55);
      aura.addColorStop(0, rgba(col1, auraAlpha));
      aura.addColorStop(0.55, rgba(col2, auraAlpha * 0.55));
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.ellipse(cxP, cyP, rx * 1.55, ry * 1.48, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // B) Chuqurlik hissi beruvchi giper-fazoviy girdob (Hyperspace Depth Vortex Rings)
  // Girdob ichkariga kirib boruvchi 4-qavatli konsentrik qatlamlardan iborat
  if (!isPassing) {
    const vortexAlpha = Math.max(0, (1 - aperture * 0.85));
    if (vortexAlpha > 0.03) {
      const coreGrad = ctx.createRadialGradient(
        cxP, cyP, rx * (0.15 + aperture * 0.65),
        cxP, cyP, Math.max(rx, ry) * 0.92
      );
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
      coreGrad.addColorStop(0.28, rgba(col3, 0.55 * vortexAlpha));
      coreGrad.addColorStop(0.62, rgba(col1, 0.68 * vortexAlpha));
      coreGrad.addColorStop(0.88, rgba(col2, 0.50 * vortexAlpha));
      coreGrad.addColorStop(1, rgba(theme.colDark || '#000', 0.18 * vortexAlpha));
      ctx.fillStyle = coreGrad;
      ctx.beginPath(); ctx.ellipse(cxP, cyP, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Aylanuvchi spiral energiya yoylari (Logarithmic Vortex Spiral Arms)
    const spinSpeed = 3.2 + prox * 2.2;
    const armCount = 3;
    ctx.save();
    ctx.translate(cxP, cyP);
    for (let a = 0; a < armCount; a++) {
      const armAng = G.t * spinSpeed + a * (Math.PI * 2 / armCount);
      ctx.strokeStyle = a === 0 ? '#ffffff' : rgba(col1, 0.80 * (1 - aperture * 0.6));
      ctx.lineWidth = Math.max(1.2, 2.6 * _a.s * 0.038);
      ctx.beginPath();
      for (let st = 0; st <= 8; st++) {
        const frac = (st / 8);
        const rStep = (aperture * 0.5 + frac * (0.88 - aperture * 0.5)) * rx;
        const thStep = armAng + frac * 2.4;
        const px = Math.cos(thStep) * rStep;
        const py = Math.sin(thStep) * (rStep * (ry / rx));
        if (st === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Aylanuvchi konsentrik energiya halqalari (Concentric Rotating Energy Rings)
    const ringCount = G.quality === 'low' ? 2 : 4;
    for (let r = 0; r < ringCount; r++) {
      const frac = 0.35 + (r / ringCount) * 0.58;
      if (frac < aperture * 0.7) continue; // Aperture ochilganda ichki halqa silliq yo'qoladi
      const rot = G.t * (r % 2 === 0 ? 3.4 : -2.8) * prox + r * 1.25;
      ctx.save();
      ctx.translate(cxP, cyP);
      ctx.scale(rx * frac, ry * frac);
      ctx.rotate(rot);
      ctx.strokeStyle = r % 2 === 0 ? '#ffffff' : col2;
      ctx.lineWidth = Math.max(0.06, 0.11 / frac);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 1.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 0.82, Math.PI, Math.PI * 2.15);
      ctx.stroke();
      ctx.restore();
    }

    // Ichkariga so'riluvchi neon kvant zarrachalar (Inward-Swirling Particles)
    const sparkCount = G.quality === 'low' ? 5 : 8;
    for (let s = 0; s < sparkCount; s++) {
      const spPhase = ((G.t * (1.3 + s * 0.18) + s * 0.37) % 1);
      const spAng = G.t * (3.0 + s * 0.5) + s * (Math.PI * 2 / sparkCount);
      const spDist = (1 - spPhase * 0.78);
      if (spDist < aperture * 0.6) continue;
      const spX = cxP + Math.cos(spAng) * rx * spDist;
      const spY = cyP + Math.sin(spAng) * ry * spDist;
      ctx.fillStyle = s % 2 === 0 ? '#ffffff' : (s % 3 === 0 ? col1 : col2);
      ctx.globalAlpha = Math.sin(spPhase * Math.PI) * 0.85;
      ctx.beginPath();
      ctx.arc(spX, spY, Math.max(1.2, 2.6 * _a.s * 0.038), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Kvant chaqmoq yoylari (faqat o'rta va yuqori sifatda)
    if (G.quality !== 'low' && o.z < 44 && o.z > 1.2) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, rx * 0.042);
      const arcCount = o.z < 20 ? 4 : 3;
      for (let a = 0; a < arcCount; a++) {
        const ang = G.t * 4.2 + a * (6.283 / arcCount);
        const x1 = cxP + Math.cos(ang) * rx * 0.92;
        const y1 = cyP + Math.sin(ang) * ry * 0.92;
        const xm = cxP + Math.cos(ang + 0.32) * rx * (0.48 + 0.2 * Math.sin(G.t * 18 + a));
        const ym = cyP + Math.sin(ang + 0.32) * ry * (0.48 + 0.2 * Math.cos(G.t * 16 + a));
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(xm, ym);
        ctx.lineTo(cxP, cyP);
        ctx.stroke();
      }
    }
  }

  ctx.restore();

  if (typeof BIOME_3D !== 'undefined' && BIOME_3D.drawPortal3DRing) {
    BIOME_3D.drawPortal3DRing(o, col1, col2, aperture, prox);
  }

  // 3) 3D Portal ustunlari va arkasi (Arka ichi ochiq, mashina erkin o'tadi)
  const mesh = MESHES.portal_active;
  if (mesh) {
    const faces = facesOf(mesh, [o.x, 0, o.z], 0, 1);
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) drawFace(f);
  }

  // 4) Holografik Entry Signage (o.z > 1.0 da ko'rinadi, yaqinda ekranni to'smaydi)
  if (o.z < 52 && o.z > 1.2) {
    proj([o.x, 3.65, o.z], _d);
    if (_d.vis) {
      ctx.save();
      const fs = Math.max(10, Math.min(20, _d.s * 0.32));
      ctx.font = '900 ' + (fs | 0) + 'px ' + UIFONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      if (G.quality === 'high') { ctx.shadowColor = col1; ctx.shadowBlur = 12; }
      ctx.fillText('🌀 ' + dim.name.toUpperCase(), _d.x, _d.y);
      ctx.font = '800 ' + Math.max(8, (fs * 0.70) | 0) + 'px ' + UIFONT;
      ctx.fillStyle = col1;
      ctx.fillText('⚡ ВХОД В ИЗМЕРЕНИЕ · ×' + dim.scoreMul.toFixed(1), _d.x, _d.y + fs * 1.05);
      const arrowFlash = Math.sin(G.t * 10);
      if (arrowFlash > 0 && o.z < 35) {
        ctx.fillStyle = '#fef08a';
        ctx.fillText('▼ ВХОД ▼', _d.x, _d.y + fs * 2.0);
      }
      ctx.restore();
    }
  }
}

/** 3-Polosali O'lcham Portali — Ochiq Trassa Tranzit Portali (`portal_open`):
 *  Xavfsiz to'g'ri yo'l ko'rsatkichi, sokin moviy energiya pardasi va yo'naltiruvchi chiziqlar bilan */
function drawPortalOpen(o) {
  if (o.z > 70 || o.z < -2.5) return;
  const l = (o.lane != null) ? o.lane : (o.x < -0.8 ? 0 : (o.x > 0.8 ? 2 : 1));
  const theme = PORTAL_LANE_THEMES[l] || PORTAL_LANE_THEMES[0];
  const col1 = theme.col1;
  const col2 = theme.col2;

  // 1) Yo'l polosasi bo'ylab tinch tranzit izi (Mashina oldiga chiqmaydi)
  if (o.z > 0.4) {
    quad(o.x - 0.98, Math.max(0.65, o.z - 12), o.x + 0.98, o.z + 0.8, 0.015,
      rgba(col1, 0.08), rgba(col1, 0.32));
  }

  // 2) Portal markazi va o'lchami
  proj([o.x, 1.48, o.z], _a);
  if (!_a.vis) return;
  const rx = 1.20 * _a.s;
  const ry = 1.50 * _a.s;
  const cxP = _a.x, cyP = _a.y;
  const isPassing = o.z <= 0.45;

  ctx.save();
  // Sokin tranzit pardasi (Mashina o'tayotganda markazi to'liq ochiq)
  if (!isPassing) {
    const memGrad = ctx.createRadialGradient(cxP, cyP, rx * 0.35, cxP, cyP, Math.max(rx, ry));
    memGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    memGrad.addColorStop(0.40, rgba(col1, 0.25));
    memGrad.addColorStop(0.80, rgba(col2, 0.12));
    memGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = memGrad;
    ctx.beginPath(); ctx.ellipse(cxP, cyP, rx * 0.90, ry * 0.90, 0, 0, Math.PI * 2); ctx.fill();

    // Aylanuvchi sokin energiya halqasi
    ctx.save();
    ctx.translate(cxP, cyP);
    ctx.rotate(G.t * 1.6);
    ctx.strokeStyle = rgba(col1, 0.55);
    ctx.lineWidth = Math.max(1, 2.2 * _a.s * 0.035);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 3) 3D Tranzit Arkasi
  const mesh = MESHES.portal_open;
  if (mesh) {
    const faces = facesOf(mesh, [o.x, 0, o.z], 0, 1);
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) drawFace(f);
  }
  ctx.restore();

  // 4) Trassa yo'nalish ko'rsatkichi
  if (o.z < 44 && o.z > 1.2) {
    proj([o.x, 3.25, o.z], _d);
    if (_d.vis) {
      ctx.save();
      const fs = Math.max(8, Math.min(14, _d.s * 0.22));
      ctx.font = '800 ' + (fs | 0) + 'px ' + UIFONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('🛣 ТРАНЗИТ ТРАССЫ', _d.x, _d.y);
      ctx.font = '700 ' + Math.max(7, (fs * 0.72) | 0) + 'px ' + UIFONT;
      ctx.fillStyle = rgba(col1, 0.85);
      ctx.fillText('[ ПРЯМОЙ ПУТЬ ]', _d.x, _d.y + fs * 0.95);
      ctx.restore();
    }
  }
}

/** Portal ichiga kirgandagi va o'lchamdan chiqqandagi silliq giper-sakrash vizual effekti */
function drawPortalEntryEffect() {
  // 1) Kirish giper-sakrash effekti (Entry hyper-warp transition)
  if (G.portalEntryAnim && G.portalEntryAnim > 0) {
    const p = G.portalEntryAnim / 0.85;
    const validDimIdx = (G.dimensionIdx >= 0 && G.dimensionIdx < DIMENSIONS.length) ? G.dimensionIdx : 0;
    const dim = DIMENSIONS[validDimIdx] || DIMENSIONS[0];
    const col1 = dim.neon || '#00f5ff';
    const col2 = dim.curbc || '#d946ef';
    ctx.save();
    ctx.translate(cx, cy);

    // Giper-tezlik nurlari (Radial speedlines)
    const rays = G.quality === 'low' ? 24 : 40;
    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2 + Math.sin(i * 7) * 0.1;
      const rayProg = ((1 - p) * 2.5 + i * 0.17) % 1;
      const r1 = Math.pow(rayProg, 1.8) * Math.max(W, H) * 0.85;
      const r2 = r1 + (20 + rayProg * 140);
      ctx.strokeStyle = i % 2 === 0 ? col1 : (i % 3 === 0 ? col2 : '#ffffff');
      ctx.lineWidth = Math.max(1.5, (1 + rayProg * 3.5));
      ctx.globalAlpha = Math.sin(rayProg * Math.PI) * p * 0.80;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
      ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
      ctx.stroke();
    }

    // Kvant to'lqin halqalari (Expanding shockwave rings)
    const rings = G.quality === 'low' ? 3 : 5;
    for (let r = 0; r < rings; r++) {
      const rp = ((1 - p) * 1.6 + r * 0.2) % 1;
      const rad = Math.pow(rp, 0.75) * Math.max(W, H) * 0.8;
      ctx.strokeStyle = r % 2 === 0 ? col1 : '#ffffff';
      ctx.lineWidth = Math.max(2, (1 - rp) * 10 * p);
      ctx.globalAlpha = Math.sin(rp * Math.PI) * p * 0.65;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 2) Chiqish silliq de-warp effekti (Exit smooth transition)
  if (G.portalExitAnim && G.portalExitAnim > 0) {
    const xp = G.portalExitAnim / 0.75;
    ctx.save();
    ctx.translate(cx, cy);
    const exitRings = G.quality === 'low' ? 2 : 4;
    for (let r = 0; r < exitRings; r++) {
      const xprog = ((1 - xp) * 1.4 + r * 0.25) % 1;
      const xrad = Math.pow(xprog, 0.85) * Math.max(W, H) * 0.7;
      ctx.strokeStyle = r % 2 === 0 ? '#38bdf8' : '#ffffff';
      ctx.lineWidth = Math.max(1.5, (1 - xprog) * 7 * xp);
      ctx.globalAlpha = Math.sin(xprog * Math.PI) * xp * 0.50;
      ctx.beginPath();
      ctx.arc(0, 0, xrad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
function drawObj(o) {
  if (o.z > 66) return;
  if (o.kind === 'portal_active') {
    drawPortalActive(o);
    return;
  }
  if (o.kind === 'portal_open') {
    drawPortalOpen(o);
    return;
  }
  drawGroundPatch(o);
  const kind = o.kind, m = OBJ[kind];
  const mesh = kind === 'car' ? MESHES.car : MESHES[kind];
  if (!mesh) return;
  const good = !!GOOD[kind];
  // foydali narsalar sekin suzadi va atrofida nur sochadi
  const bob = good && m.y > .2 ? Math.sin(G.t * 2.6 + o.z * .55) * .12 : 0;
  const pos = [o.x, m.y + bob, o.z];
  if (kind === 'shield' || kind === 'shield_plus') pos[1] = .05;
  if (good) drawGlow(pos, m.col, (kind === 'coin' || kind === 'heart_plus' || kind === 'magnet_plus' || kind === 'shield_plus') ? 1.8 : 1.7);
  const faces = facesOf(mesh, pos, o.rot, 1);
  faces.sort((a, b) => b.z - a.z);
  for (const f of faces) drawFace(f);

  // Biomga xos nozik xavf auralari va ogohlantirish effektlari (ko'rish va to'qnashuvga xalaqit bermaydi)
  if (!good && o.z < 38 && o.z > 1.2 && G.quality !== 'low') {
    const bm = currentBiome();
    const type = bm.props || 'city';
    proj([o.x, (m.badY || 1.0) * 0.75, o.z], _b);
    if (_b.vis) {
      if (type === 'lava' && Math.sin(G.t * 8 + o.z) > 0.4) {
        ctx.fillStyle = '#ff6b35';
        ctx.fillRect(_b.x + Math.sin(G.t * 12 + o.x) * 10 * _b.s, _b.y - 12 * _b.s, Math.max(2, 4 * _b.s), Math.max(2, 4 * _b.s));
      } else if (type === 'ice' && Math.cos(G.t * 6 + o.z) > 0.5) {
        ctx.fillStyle = '#a5f3fc';
        ctx.fillRect(_b.x + Math.cos(G.t * 10 + o.x) * 12 * _b.s, _b.y - 10 * _b.s, Math.max(2, 3 * _b.s), Math.max(2, 3 * _b.s));
      } else if (type === 'crystal' && Math.sin(G.t * 7 + o.x) > 0.5) {
        ctx.fillStyle = '#f5d0fe';
        ctx.fillRect(_b.x + Math.sin(G.t * 14 + o.z) * 8 * _b.s, _b.y - 14 * _b.s, Math.max(2, 3.5 * _b.s), Math.max(2, 3.5 * _b.s));
      }
    }
  }

  drawBadge(o);
}

/** Magnit faol bo'lganda yaqinlashayotgan tanga va bonuslarga elektr tortish yoylari */
function drawMagnetArcs() {
  if (G.magnet <= 0 || G.quality === 'low') return;
  proj([G.x, G.y + 0.45, 0], _a);
  if (!_a.vis) return;
  const sx = _a.x, sy = _a.y;
  const isMagPlus = (G.magnetPlusTimer || 0) > 0;
  const magRad = 12 + (G.magnetRadiusBonus || 0) + (isMagPlus ? 6 : 0);

  ctx.save();
  // Magnit qutb maydoni nuri (Magnetic polarity field glow on front hood)
  const fieldPulse = 0.45 + 0.25 * Math.sin(G.t * 10);
  ctx.globalAlpha = fieldPulse;
  ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
  ctx.beginPath(); ctx.arc(sx, sy, Math.max(6, 22 * _a.s * 0.05), 0, 6.283); ctx.fill();

  let drawn = 0;
  for (let i = 0; i < G.objs.length; i++) {
    const o = G.objs[i];
    if (o.taken || o.dead || !GOOD[o.kind] || o.z <= 0 || o.z > magRad) continue;
    const dd = Math.hypot(G.x - o.x, o.z);
    if (dd >= magRad) continue;
    proj([o.x, (OBJ[o.kind].y || 0.8), o.z], _b);
    if (!_b.vis) continue;

    const mx = (sx + _b.x) * 0.5 + Math.sin(G.t * 24 + i * 3.1) * 12;
    const my = (sy + _b.y) * 0.5 - 10 + Math.cos(G.t * 20 + i * 2.3) * 8;
    const arcCol = isMagPlus ? (drawn % 2 === 0 ? '#e879f9' : '#ffd166') : (drawn % 2 === 0 ? '#a855f7' : '#00e5ff');

    // Tashqi neon elektr yoyi (Outer electric glow arc)
    ctx.strokeStyle = arcCol;
    ctx.lineWidth = isMagPlus ? 3.4 : 2.4;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, my, _b.x, _b.y);
    ctx.stroke();

    // Ichki oq chaqmoq o'zagi (Core white-hot lightning filament)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, my, _b.x, _b.y);
    ctx.stroke();

    if (++drawn >= 4) break;
  }
  ctx.restore();
}

function drawPart(p) {
  proj([p.x, p.y, p.z], _a);
  if (!_a.vis) return;
  const k = 1 - p.t / p.l;
  ctx.globalAlpha = Math.max(0, k);
  ctx.fillStyle = p.col;
  const s = Math.max(1, p.s * _a.s * k);
  ctx.fillRect(_a.x - s / 2, _a.y - s / 2, s, s);
  ctx.globalAlpha = 1;
}

function drawShip() {
  const c = car();
  const p = c.pal || c;
  const pos = [G.x, G.y, 0];
  const faces = facesOf(c.mesh, pos, G.yaw, 1);
  faces.sort((a, b) => b.z - a.z);

  // neon osti yorug'ligi (underglow) va soya
  proj([G.x, .01, 0], _b);
  if (_b.vis) {
    ctx.save();
    const glowCol = c.underglow || p.body;
    const ug = ctx.createRadialGradient(_b.x, _b.y, 0, _b.x, _b.y, 1.8 * _b.s);
    ug.addColorStop(0, rgba(glowCol, 0.48));
    ug.addColorStop(0.6, rgba(p.acc || glowCol, 0.20));
    ug.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ug;
    ctx.beginPath(); ctx.ellipse(_b.x, _b.y, 1.9 * _b.s, 0.7 * _b.s, 0, 0, 6.283); ctx.fill();

    ctx.globalAlpha = .42 - Math.min(.32, G.y * .1); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(_b.x, _b.y, 1.25 * _b.s, .3 * _b.s, 0, 0, 6.283); ctx.fill();

    /* "SIZ" belgisi: o'yinchi mashinasi skin rangidan qat'iy nazar
       doim bitta neon halqa + chet belgilari bilan ko'rsatiladi. */
    ctx.globalAlpha = .9;
    ctx.strokeStyle = '#7dffe4'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(_b.x, _b.y, 1.58 * _b.s, .48 * _b.s, 0, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#7dffe4';
    for (const side of [-1, 1]) {
      const ex = _b.x + side * 1.58 * _b.s;
      ctx.beginPath();
      ctx.moveTo(ex, _b.y);
      ctx.lineTo(ex + side * 10, _b.y - 5.5);
      ctx.lineTo(ex + side * 10, _b.y + 5.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // Futuristik reaktiv plazma va chaqmoq alangasi (High-power Dual Cyber Plasma Exhaust)
  const isNitro = G.boost > 0.05 || (G.nitroT && G.nitroT > 0);
  const flameIntensity = isNitro ? Math.max(0.65, G.boost) : (G.running ? 0.22 : 0);
  if (flameIntensity > 0.05) {
    for (const exSx of [-0.34, 0.34]) {
      proj([G.x + exSx, 0.30 + G.y, -1.25], _c);
      if (_c.vis) {
        ctx.save();
        // Tashqi plazma aulasi (Neon Violet / Cyan Plume)
        const flR = _c.s * (isNitro ? 0.65 : 0.42) * (1 + flameIntensity * 0.75 + Math.sin(G.t * 36 + exSx * 5) * 0.15);
        const g = ctx.createRadialGradient(_c.x, _c.y, 0, _c.x, _c.y, flR);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.25, isNitro ? '#00e5ff' : (p.acc || '#00e5ff'));
        g.addColorStop(0.60, isNitro ? '#a855f7' : (p.body || '#d946ef'));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = Math.min(0.98, flameIntensity * (isNitro ? 1.35 : 1.1));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(_c.x, _c.y, flR, 0, 6.283); ctx.fill();

        // Nitro yoqilganda orqaga cho'ziluvchi yuqori haroratli plazma nuri (Plasma Jet Trail)
        if (isNitro) {
          proj([G.x + exSx * 1.05, 0.32 + G.y, -2.4 - flameIntensity * 1.8], _b);
          if (_b.vis) {
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = Math.max(1.8, 3.8 * _c.s * 0.04);
            ctx.globalAlpha = 0.85;
            ctx.beginPath(); ctx.moveTo(_c.x, _c.y); ctx.lineTo(_b.x, _b.y); ctx.stroke();
            // Ichki oq chaqmoq yadrosi
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1.0, 1.8 * _c.s * 0.04);
            ctx.beginPath(); ctx.moveTo(_c.x, _c.y); ctx.lineTo((_c.x + _b.x) * 0.5, (_c.y + _b.y) * 0.5); ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
  }

  // Old yo'l yuzasiga tushuvchi faralar yoritgichi (Headlight road pool)
  if (G.running) {
    proj([G.x, 0.02, 5.5], _c);
    if (_c.vis) {
      ctx.save();
      const beamGrad = ctx.createRadialGradient(_c.x, _c.y, 0, _c.x, _c.y, 2.8 * _c.s);
      beamGrad.addColorStop(0, 'rgba(235, 248, 255, 0.20)');
      beamGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.07)');
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.ellipse(_c.x, _c.y, 2.6 * _c.s, 1.1 * _c.s, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }
  }

  for (const f of faces) drawFace(f);
  ctx.globalAlpha = 1.0;

  // Yuqori tezlikdagi aerodinamik havo oqimlari (Slipstream wind ribbons)
  if (G.running && (G.boost > 0.08 || G.speed > 27)) {
    const streamAlpha = Math.min(0.65, (G.boost > 0.08 ? 0.35 + G.boost * 0.35 : 0.22));
    ctx.save();
    ctx.lineWidth = Math.max(1.6, 2.4 * (W / 600));
    ctx.strokeStyle = rgba(p.acc || '#00e5ff', streamAlpha);
    for (const side of [-0.68, 0.68]) {
      proj([G.x + side, 0.45 + G.y, -0.6], _b);
      proj([G.x + side * 1.05, 0.48 + G.y, -3.2 - (G.boost * 1.5)], _c);
      if (_b.vis && _c.vis) {
        ctx.beginPath();
        ctx.moveTo(_b.x, _b.y);
        ctx.lineTo(_c.x, _c.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // politsiya strob chiroqlari
  if (c.bar) {
    const strobe = Math.floor(G.t * 8) % 2 === 0;
    proj([G.x, 1.25 + G.y, -0.2], _d);
    if (_d.vis) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(G.t * 22) * 0.25;
      ctx.fillStyle = strobe ? '#ff2b43' : '#00e5ff';
      ctx.beginPath();
      ctx.arc(_d.x + (strobe ? -14 : 14), _d.y, Math.max(4, 18 * _d.s * 0.05), 0, 6.283);
      ctx.fill();
      ctx.restore();
    }
  }

  // Nitro olingandagi chaqnash va impuls effekti (Nitro pickup flash surge)
  if (G.nitroAnim && G.nitroAnim > 0) {
    proj([G.x, 0.35 + G.y, -0.8], _b);
    if (_b.vis) {
      ctx.save();
      ctx.globalAlpha = G.nitroAnim * 0.65;
      const nRad = _b.s * 1.2 * (1 + (1 - G.nitroAnim) * 0.9);
      const ng = ctx.createRadialGradient(_b.x, _b.y, 0, _b.x, _b.y, nRad);
      ng.addColorStop(0, '#ffffff');
      ng.addColorStop(0.4, '#00e5ff');
      ng.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = ng;
      ctx.beginPath(); ctx.arc(_b.x, _b.y, nRad, 0, 6.283); ctx.fill();
      ctx.restore();
    }
  }

  // qalqon halqasi (translucent cyan protective energy dome + activation & impact ripple)
  if (G.shield > 0 || (G.shieldRipple && G.shieldRipple > 0) || (G.shieldAnim && G.shieldAnim > 0)) {
    proj([G.x, .52 + G.y, 0], _d);
    if (_d.vis) {
      ctx.save();
      const rx = 1.25 * _d.s, ry = 0.96 * _d.s;
      if (G.shield > 0) {
        const pulse = .48 + .24 * Math.sin(G.t * 8);
        // Geksagonal yarim shaffof himoya gumbazi (Hexagonal translucent dome fill)
        ctx.globalAlpha = pulse * 0.32;
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath(); ctx.ellipse(_d.x, _d.y, rx, ry, 0, 0, 6.283); ctx.fill();

        // Tashqi energetik qobiq (Outer energetic field boundary)
        ctx.globalAlpha = pulse + 0.22;
        ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.ellipse(_d.x, _d.y, rx, ry, 0, 0, 6.283); ctx.stroke();

        // Aylanuvchi zumrad magnit orbita (Rotating emerald containment orbit)
        ctx.strokeStyle = '#46ff8f'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(_d.x, _d.y, rx * 0.86, ry * 0.82, G.t * 1.5, 0, 4.2); ctx.stroke();

        // Ekvatorial geks-faset halqa (Equatorial hex facet ring)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'; ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.ellipse(_d.x, _d.y, rx * 0.94, ry * 0.65, -G.t * 1.2, 0, 6.283); ctx.stroke();
        if ((G.shieldPlusTimer || 0) > 0) {
          ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.ellipse(_d.x, _d.y, rx * 1.14, ry * 1.10, G.t * 2.4, 0, 5.2); ctx.stroke();
        }
      }
      // Qalqon faollashgandagi to'lqin (Shield activation expansion ripple)
      if (G.shieldAnim && G.shieldAnim > 0) {
        const actRip = 1 + (1 - G.shieldAnim) * 0.85;
        ctx.globalAlpha = G.shieldAnim * 0.85;
        ctx.strokeStyle = '#46ff8f';
        ctx.lineWidth = Math.max(2, 4.5 * G.shieldAnim);
        ctx.beginPath();
        ctx.ellipse(_d.x, _d.y, rx * actRip, ry * actRip, 0, 0, 6.283);
        ctx.stroke();
      }
      // Zarbani to'sgandagi tarqaluvchi to'lqin (Shield impact ripple when blocking damage)
      if (G.shieldRipple && G.shieldRipple > 0) {
        const rip = 1 + (1 - G.shieldRipple) * 0.95;
        ctx.globalAlpha = G.shieldRipple * 0.9;
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = Math.max(2, 5.5 * G.shieldRipple);
        ctx.beginPath();
        ctx.ellipse(_d.x, _d.y, rx * rip, ry * rip, 0, 0, 6.283);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawBoss() {
  if (!G.bossActive || G.bossZ == null || G.bossZ < 0 || G.bossZ > 85) return;
  const bpos = [G.bossX || 0, 0, G.bossZ];
  const faces = facesOf(MESH_BOSS, bpos, G.bossYaw || 0, 1);
  faces.sort((a, b) => b.z - a.z);

  // Red underglow and ground patch for boss
  proj([G.bossX || 0, .01, G.bossZ], _b);
  if (_b.vis) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 0, 50, 0.42)';
    ctx.beginPath();
    ctx.ellipse(_b.x, _b.y, 2.6 * _b.s, 1.0 * _b.s, 0, 0, 6.283);
    ctx.fill();

    // Laser target line pointing towards target lane or player
    const isAiming = G.bossAttackState === 'aiming';
    const isStriking = G.bossAttackState === 'strike';
    const targetX = (isAiming && G.bossTargetLane != null) ? LANES[G.bossTargetLane] : G.x;
    ctx.strokeStyle = isStriking ? 'rgba(255, 255, 255, 0.95)' : (isAiming ? 'rgba(255, 20, 50, 0.95)' : 'rgba(255, 30, 60, 0.65)');
    ctx.lineWidth = Math.max(2, (isStriking ? 8 : (isAiming ? 5 : 3.5)) * _b.s * 0.05);
    ctx.beginPath();
    ctx.moveTo(_b.x, _b.y);
    proj([targetX, 0.05, 0], _c);
    if (_c.vis) {
      ctx.lineTo(_c.x, _c.y);
      ctx.stroke();
      if (isAiming) {
        ctx.strokeStyle = '#ff2b43';
        ctx.lineWidth = Math.max(2, 3 * _c.s * 0.05);
        ctx.beginPath();
        ctx.arc(_c.x, _c.y, Math.max(12, 28 * _c.s * 0.05), 0, 6.283);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Draw 3D boss faces
  for (const f of faces) drawFace(f);

  // Draw menacing red hazard badge above boss
  proj([G.bossX || 0, 2.8, G.bossZ], _d);
  if (_d.vis) {
    ctx.save();
    const pulse = 1 + 0.15 * Math.sin(G.t * 8);
    const r = Math.max(12, Math.min(30, _d.s * 0.35)) * pulse;
    ctx.fillStyle = '#ff0033';
    ctx.shadowColor = '#ff0033'; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(_d.x, _d.y, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 ' + Math.max(9, r * 0.8) + 'px ' + UIFONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('☠', _d.x, _d.y);
    ctx.restore();
  }
}

const _renderList = [];
function render() {
  drawBackdrop();
  ctx.save();
  drawRoad();

  // Checkpoint arch
  drawGate(G.nextLevelAt - G.dist);

  _renderList.length = 0;
  for (let i = 0; i < G.objs.length; i++) {
    const o = G.objs[i];
    if (o.z > -1.5 && o.z < 90 && !o.dead) _renderList.push({ z: o.z, t: 0, o });
  }
  for (let i = 0; i < G.parts.length; i++) {
    const p = G.parts[i];
    _renderList.push({ z: p.z, t: 1, p });
  }
  const curBm = currentBiome();
  const bmProps = curBm.props || 'city';
  const loopLen = 140;
  if (G.scenery3D && typeof BIOME_3D !== 'undefined') {
    for (let i = 0; i < G.scenery3D.length; i++) {
      const s = G.scenery3D[i];
      const wz = ((s.distOffset - G.dist) % loopLen + loopLen) % loopLen;
      if (wz > 0.8 && wz < 62) {
        _renderList.push({ z: wz, t: 4, s, bmProps });
      }
    }
  }
  // Player car render marker (z = 0.05, perfectly prioritized in world space)
  _renderList.push({ z: 0.05, t: 2 });
  if (G.bossActive && G.bossZ != null) _renderList.push({ z: G.bossZ, t: 3 });
  _renderList.sort((a, b) => b.z - a.z);
  for (let i = 0; i < _renderList.length; i++) {
    const d = _renderList[i];
    if (d.t === 1) drawPart(d.p);
    else if (d.t === 2) drawShip();
    else if (d.t === 3) drawBoss();
    else if (d.t === 4 && typeof BIOME_3D !== 'undefined') BIOME_3D.drawScenery(d.s, d.z, d.bmProps);
    else drawObj(d.o);
  }

  // Magnit tortish elektr yoylari (tangalar tortilganda)
  drawMagnetArcs();

  // Suzuvchi yozuvlar (Near Miss, Jump, Combo)
  drawFloatingTexts();

  // Phase 5 Biome Events & Dynamic Weather
  drawBiomeWeather(trackBiome());

  if (G.boost > .12 && G.quality !== 'low') {
    ctx.save(); ctx.globalAlpha = G.boost * .45; ctx.strokeStyle = car().acc || '#00e5ff'; ctx.lineWidth = 1.4;
    const rays = G.quality === 'medium' ? 8 : 14;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * 6.283 + G.t * 4, r0 = H * .16;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * .55);
      ctx.lineTo(cx + Math.cos(a) * H * .58, cy + Math.sin(a) * H * .32);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  // Portalga kirish giper-sakrash animatsiyasi
  drawPortalEntryEffect();

  // Biom almashganda animatsiya (kamera ta'siridan tashqarida)
  drawTrackTransition();

  if (G.shake > .01) {
    const s = G.shake * 8;
    canvas.style.transform = 'translate(' + ((Math.random() - .5) * s) + 'px,' + ((Math.random() - .5) * s) + 'px)';
  } else if (canvas.style.transform) canvas.style.transform = '';
  if (G.invul > 0 && Math.floor(G.t * 14) % 2 === 0) el.flash.style.opacity = .10;
}

/* --------------------------- MAIN LOOP --------------------------- */
function frame(ts) {
  requestAnimationFrame(frame);
  if (typeof document !== 'undefined' && document.hidden) return;
  const now = ts / 1000;
  G.dt = Math.min(.05, now - (G.last || now)); G.last = now;
  G.frame++;
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  if (!G.running || G.paused) {
    if (G.paused) return; // Paused state: freeze background canvas rendering to save mobile battery/GPU
    if (!G.running) {
      G.t += G.dt; G.dist += 5 * G.dt;
      CAM.x += (Math.sin(G.t * .35) * 1.5 - CAM.x) * .02;
      // Garaj vitrinasi sekin aylanadi (menyu + GARAJ ochiq bo'lsa)
      const sh = $('#tabShips');
      if (!showcaseDragging && G.frame % 4 === 0 && el.scrMenu && !el.scrMenu.classList.contains('hidden') &&
          ((typeof menuView !== 'undefined' && menuView === 'home') || (sh && !sh.classList.contains('hidden')))) {
        showcaseRot += .012; updateShowcase();
      }
      // When in garage sub-screens, throttle background track canvas render on low/medium quality
      if (typeof menuView !== 'undefined' && menuView !== 'home' && G.quality !== 'high' && G.frame % 3 !== 0) return;
    }
    render(); return;
  }
  G.t += G.dt;
  update(G.dt);
  render();
  if (t0) {
    const ms = performance.now() - t0;
    G.frameMs += (ms - G.frameMs) * .1;
    if (G.qualCooldown > 0) G.qualCooldown = Math.max(0, G.qualCooldown - G.dt);
    if (G.frameMs > 23 && G.quality !== 'low' && (G.qualCooldown || 0) <= 0) {
      if (++G.slowFrames > 85) {
        G.slowFrames = 0;
        G.qualCooldown = 6.0;
        G.quality = G.quality === 'high' ? 'medium' : 'low';
        syncQualityClass();
        resize();
        buildBackdrop();
        toast('⚙ Качество графики: ' + qualLabel(G.quality) + ' (автооптимизация)', 2200);
      }
    } else if (G.frameMs < 18) {
      G.slowFrames = 0;
    }
  }
  if (G.frame % 30 === 0) G.fps = Math.round(1 / Math.max(.0001, G.dt));
}

/* --------------------------- MENÜ --------------------------- */
function menuStats() {
  $('#mBest').textContent = num(G.meta.best || 0);
  $('#mLevel').textContent = G.meta.bestLevel || 1;
  const mc = $('#mCoins'); if (mc) mc.textContent = num(G.coins);
  const homeLevel = $('#homeLevel'), homeXpText = $('#homeXpText'), homeXpBar = $('#homeXpBar');
  const homeBest = $('#homeBest'), homeCoins = $('#homeCoins'), homePoints = $('#homePoints');
  const nextCost = ACCT.cost(ACCT.lvl);
  if (homeLevel) homeLevel.textContent = ACCT.lvl;
  if (homeXpText) homeXpText.textContent = ACCT.lvl >= ACCT.maxLvl ? 'МАКС. УРОВЕНЬ' : num(ACCT.pts) + ' / ' + num(nextCost) + ' ⭐';
  if (homeXpBar) homeXpBar.style.width = ACCT.lvl >= ACCT.maxLvl ? '100%' : Math.min(100, ACCT.pts / nextCost * 100).toFixed(1) + '%';
  if (homeBest) homeBest.textContent = num(G.meta.best || 0);
  if (homeCoins) homeCoins.textContent = num(G.coins);
  if (homePoints) homePoints.textContent = num(ACCT.pts);
  const homeRecord = $('#mBest'); if (homeRecord) homeRecord.textContent = num(G.meta.best || 0);
  renderAcctBar();
  $('#statList').innerHTML = [
    ['Уровень аккаунта', 'УР. ' + ACCT.lvl + ' / ' + ACCT.maxLvl],
    ['Текущие очки', '⭐ ' + num(ACCT.pts)],
    ['Всего заработано очков', '⭐ ' + num(ACCT.total)],
    ['Потрачено очков', '⭐ ' + num(ACCT.spent)],
    ['Количество гонок', G.meta.plays || 0],
    ['Лучший результат', num(G.meta.best || 0)],
    ['Максимальная дистанция', km(G.meta.farthest || 0)],
    ['Рекордный уровень гонки', 'УР. ' + (G.meta.bestLevel || 1)],
    ['Монеты', '🪙 ' + num(G.coins)],
    ['Машины в гараже', CARS.filter(ownedOf).length + ' / ' + CARS.length],
    ['Постоянные улучшения', UPGRADES.reduce(function (s, u) { return s + PERM.n(u.k); }, 0) + ' / ' +
      UPGRADES.reduce(function (s, u) { return s + PERM.rankMax(u); }, 0) + ' уровень'],
    ['Кадры/с', G.fps + ' · качество: ' + qualLabel(G.quality).toLowerCase()]
  ].map(r => '<kbd>' + r[0] + '</kbd><span>' + r[1] + '</span>').join('');
  $('#btnSnd').textContent = Sound.on ? 'ВКЛ' : 'ВЫКЛ';
  $('#btnMus').textContent = Sound.musicOn ? 'ВКЛ' : 'ВЫКЛ';
  $('#btnQual').textContent = qualLabel(G.quality);
  renderAcct();
  updateHomeCar();
}
/* Menyu tepasidagi akkount chizig'i: LVL, ochko, progress, tugma */
function renderAcctBar() {
  const need = ACCT.cost(ACCT.lvl), maxed = ACCT.lvl >= ACCT.maxLvl;
  $('#aLvl').textContent = ACCT.lvl;
  $('#aPts').textContent = ACCT.pts;
  $('#aCoins').textContent = G.coins;
  $('#aNeed').textContent = maxed ? 'ДОСТИГНУТ МАКСИМАЛЬНЫЙ УРОВЕНЬ 🏆'
    : 'СЛЕДУЮЩИЙ УРОВЕНЬ (' + (ACCT.lvl + 1) + '): ⭐' + need + ' ОЧКОВ';
  $('#aBar').style.width = Math.min(100, ACCT.pts / need * 100).toFixed(1) + '%';
  const up = $('#btnAcctUp');
  up.textContent = maxed ? '🏆 МАКС.' : '⭐ ПОВЫСИТЬ УРОВЕНЬ · ' + need;
  up.classList.toggle('ghost', !maxed && !ACCT.canUp());
}
let menuView = 'home';
let showcaseCarId = G.car || 0, showcaseRot = -0.6, showcaseDragging = false, showcaseX = 0;
/** Vitrina canvas'ini konteyner kengligiga qarab o'lchaymiz (responsiv) */
function fitShowcase(cv) {
  const dprCap = G.quality === 'low' ? 1 : (G.quality === 'medium' ? 1.25 : 1.75);
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const cssW = Math.max(160, Math.round(cv.clientWidth || cv._lw || 380));
  const cssH = Math.max(120, Math.round(cv.clientHeight || cv._lh || 184));
  cv._lw = cssW; cv._lh = cssH;
  const bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  return { w: cssW, h: cssH, dpr: dpr };
}
/** Mesh'ni aynan oynaga sig'diradi: masshtab (fov) va gorizontal markazni topadi.
    dist — kamera masofasi, camY — kamera balandligi, pad — maydonning qancha qismini egallashi. */
function frameMesh(mesh, w, h, dist, camY, pad) {
  let r = .4, yTop = .4, yBot = -.15;
  const v = (mesh && mesh.v) || [];
  for (const p of v) {
    const rr = Math.sqrt(p[0] * p[0] + p[2] * p[2]);
    if (rr > r) r = rr;
    if (p[1] > yTop) yTop = p[1];
    if (p[1] < yBot) yBot = p[1];
  }
  const dz = Math.max(.8, dist - r);            // eng yaqin nuqta — eng katta masshtab
  const s = Math.min(w * pad / (2 * r), h * pad / Math.max(.3, yTop - yBot));
  const fov = Math.max(60, Math.round(s * dz));
  const sMid = fov / Math.max(1, dist);
  return {
    fov: fov,
    cy: Math.round(h * .5 + ((yTop + yBot) / 2 - camY) * sMid)
  };
}
function drawCarShowcase(cv, c, rot, pad, platformScale) {
  if (!cv || !cv.getContext) return;
  const c2 = cv.getContext('2d');
  if (!c2) return;
  const p = c.pal || c;
  const box = fitShowcase(cv);
  c2.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
  c2.clearRect(0, 0, box.w, box.h);
  const saveCam = { x: CAM.x, y: CAM.y, z: CAM.z, fov: CAM.fov };
  const oldCtx = ctx, oldCx = cx, oldCy = cy, oldW = W, oldH = H;
  CAM.x = 0; CAM.y = .82; CAM.z = -5.0;
  const fr = frameMesh(c.mesh, box.w, box.h, -CAM.z, CAM.y, pad);
  CAM.fov = fr.fov; cx = box.w / 2; cy = fr.cy; W = box.w; H = box.h;
  ctx = c2;

  proj([0, 0, 0], _b);
  if (_b.vis) {
    c2.save();
    const rx = platformScale * _b.s, ry = platformScale * .36 * _b.s;
    const platGrad = c2.createRadialGradient(_b.x, _b.y, 0, _b.x, _b.y, platformScale * .95 * _b.s);
    platGrad.addColorStop(0, rgba(p.body, 0.48));
    platGrad.addColorStop(0.55, rgba(p.acc || '#00e5ff', 0.24));
    platGrad.addColorStop(1, 'rgba(0,0,0,0)');
    c2.fillStyle = platGrad;
    c2.beginPath(); c2.ellipse(_b.x, _b.y, rx * 1.08, ry * 1.08, 0, 0, 6.283); c2.fill();

    // Inner dark podium disc
    c2.fillStyle = 'rgba(9, 13, 24, 0.78)';
    c2.beginPath(); c2.ellipse(_b.x, _b.y, rx * 0.88, ry * 0.88, 0, 0, 6.283); c2.fill();

    // Outer neon ring
    c2.strokeStyle = p.acc || '#00e5ff'; c2.lineWidth = Math.max(1.8, box.w / 320);
    c2.beginPath(); c2.ellipse(_b.x, _b.y, rx, ry, 0, 0, 6.283); c2.stroke();

    // Inner accent ring
    c2.strokeStyle = rgba(p.body || '#a855f7', 0.72); c2.lineWidth = Math.max(1.2, box.w / 440);
    c2.beginPath(); c2.ellipse(_b.x, _b.y, rx * 0.72, ry * 0.72, 0, 0, 6.283); c2.stroke();

    // Futuristic radial holographic notches
    c2.save();
    c2.strokeStyle = rgba(p.acc || '#00e5ff', 0.42);
    c2.lineWidth = Math.max(1, box.w / 480);
    for (let a = 0; a < 6.283; a += 0.785) {
      const ca = Math.cos(a + rot * 0.35), sa = Math.sin(a + rot * 0.35);
      c2.beginPath();
      c2.moveTo(_b.x + ca * rx * 0.93, _b.y + sa * ry * 0.93);
      c2.lineTo(_b.x + ca * rx * 1.05, _b.y + sa * ry * 1.05);
      c2.stroke();
    }
    c2.restore();
    c2.restore();
  }
  const faces = facesOf(c.mesh, [0, 0, 0], rot, 1);
  faces.sort((a, b) => b.z - a.z);
  for (const f of faces) drawFace(f);
  ctx = oldCtx; cx = oldCx; cy = oldCy; W = oldW; H = oldH;
  Object.assign(CAM, saveCam);
}
function updateHomeCar() {
  const c = CARS[showcaseCarId] || CARS[0];
  const status = $('#homeCarStatus');
  const owned = ownedOf(c), selected = G.car === c.id;
  const label = $('#homeCarLabel');
  const rNames = { rare: 'РЕДКАЯ', epic: 'ЭПИЧЕСКАЯ', mythic: 'МИФИЧЕСКАЯ', legendary: 'ЛЕГЕНДАРНАЯ', common: 'РЕДКАЯ' };
  const rName = rNames[c.rarity] || 'СПОРТКАР';
  if (label) label.innerHTML = (selected ? 'ВАША МАШИНА' : 'ПРЕДПРОСМОТР МОДЕЛИ') + ' <span class="rarity-chip rarity-' + (c.rarity || 'common') + '">' + rName + '</span>';
  if ($('#homeCarName')) $('#homeCarName').textContent = c.name.toUpperCase();
  if (status) status.textContent = selected ? 'ВЫБРАНА' : owned ? 'ОТКРЫТА В ГАРАЖЕ' : !lvlOk(c) ? '🔒 УРОВЕНЬ ' + c.lvl : 'КУПИТЬ В ГАРАЖЕ';
  if ($('#homeCarBoost')) $('#homeCarBoost').textContent = mul(c.boost);
  if ($('#homeCarShield')) $('#homeCarShield').textContent = carStartingShield(c) + ' с';
  if ($('#homeCarMagnet')) $('#homeCarMagnet').textContent = (5 * c.magnet).toFixed(1).replace(/\.0$/, '') + ' с';
  if ($('#homeCarCount')) $('#homeCarCount').textContent = String(c.id + 1).padStart(2, '0') + ' / ' + String(CARS.length).padStart(2, '0');
}
function updateShowcase() {
  const cv = document.getElementById('cvShowcase');
  const c = CARS[showcaseCarId] || CARS[0];
  const garageContent = $('#garageContent');
  const garageTab = $('#tabShips');
  if (cv && garageContent && !garageContent.classList.contains('hidden') &&
      garageTab && !garageTab.classList.contains('hidden')) drawCarShowcase(cv, c, showcaseRot, .84, 2.2);
  drawCarShowcase($('#cvHeroCar'), c, showcaseRot, .84, 1.9);
  updateHomeCar();

  const owned = ownedOf(c), sel = G.car === c.id, lock = !lvlOk(c);
  const scN = $('#scName'), scT = $('#scTag'), scB = $('#scBst'), scSh = $('#scShd'), scM = $('#scMag');
  if (scN) scN.textContent = c.name;
  if (scT) {
    const rNames = { rare: 'РЕДКАЯ', epic: 'ЭПИЧЕСКАЯ', mythic: 'МИФИЧЕСКАЯ', legendary: 'ЛЕГЕНДАРНАЯ', common: 'РЕДКАЯ' };
    const rName = rNames[c.rarity] || 'СПОРТКАР';
    scT.innerHTML = '<span class="rarity-chip rarity-' + (c.rarity || 'common') + '">' + rName + '</span> ' + c.tag;
  }
  if (scB) scB.innerHTML = mul(c.boost) + '<i>экономия энергии</i>';
  if (scSh) scSh.innerHTML = carStartingShield(c) + '<i>сек.</i>';
  if (scM) scM.innerHTML = (5 * c.magnet).toFixed(1).replace(/\.0$/, '') + '<i>сек.</i>';
  const skN = $('#scSkin'), skO = $('#scOwn');
  if (skN) skN.innerHTML = '🎨 Цвет: <b>' + skinOf(c).name + '</b>';
  if (skO) skO.textContent = sel ? '✅ ВЫБРАНА' : owned ? 'ОТКРЫТА' : lock ? '🔒 УР. ' + c.lvl : '🪙 ' + num(c.cost) + ' / ⭐ ' + num(c.pcost || 0);
  const detailStatus = $('#detailStatus');
  if (detailStatus) {
    const statusText = sel ? 'ВЫБРАНА' : owned ? 'ОТКРЫТА' : lock ? 'ЗАКРЫТА' : carAffordable(c) ? 'ДОСТУПНА К ПОКУПКЕ' : 'МОЖНО ОТКРЫТЬ';
    detailStatus.innerHTML = '<span class="' + (sel ? 'status-selected' : lock ? 'status-locked' : !owned && carAffordable(c) ? 'status-available' : '') + '">' +
      statusText + '</span><span>АККАУНТ УР. ' + ACCT.lvl + '</span>';
  }
  const detailUnlock = $('#detailUnlock');
  if (detailUnlock) {
    if (lock) detailUnlock.innerHTML = 'Откроется на <strong>' + (c.lvl || 1) + '-м уровне аккаунта</strong>';
    else if (!owned) detailUnlock.innerHTML = 'Цена: <strong>🪙 ' + num(c.cost) + '</strong> или <strong>⭐ ' + num(c.pcost || 0) + '</strong>';
    else detailUnlock.textContent = c.tag;
  }
  const pk = $('#scPerk');
  if (pk) {
    const P = c.perk ? PERKS[c.perk] : null;
    pk.innerHTML = P
      ? '<span class="pic">' + P.ic + '</span><b>' + P.name + '</b><em>' + P.desc + '</em>'
      : '<span class="pic">🔰</span><b>Стандарт</b><em>Без особого бонуса, но самая простая машина</em>';
  }
  renderSkinPicker();

  const btnP = $('#btnSelectCarPts');
  if (btnP) {
    if (!owned && !lock) {
      btnP.classList.remove('hidden');
      btnP.textContent = '⭐ КУПИТЬ ЗА ' + (c.pcost || 0) + ' ОЧКОВ';
      btnP.className = 'btn sm' + (ACCT.pts >= (c.pcost || 0) ? ' pink' : ' ghost');
    } else btnP.classList.add('hidden');
  }
  const btn = $('#btnSelectCar');
  if (btn) {
    if (sel) {
      btn.textContent = '✅ ТЕКУЩАЯ МАШИНА';
      btn.className = 'btn sm ghost';
    } else if (owned) {
      btn.textContent = '🚗 ВЫБРАТЬ';
      btn.className = 'btn sm';
    } else if (lock) {
      btn.textContent = '🔒 ТРЕБУЕТСЯ УР. ' + c.lvl;
      btn.className = 'btn sm ghost';
    } else {
      btn.textContent = '🪙 КУПИТЬ ЗА ' + c.cost;
      btn.className = 'btn sm' + (G.coins >= c.cost ? '' : ' ghost');
    }
  }
}
/** Skin tanlagichi: har bir mashina uchun alohida saqlanadi */
function renderSkinPicker() {
  const box = $('#skinPicker'); if (!box) return;
  const c = CARS[showcaseCarId] || CARS[0];
  const cur = skinIdx(c);
  let h = '<span class="skin-title">ЦВЕТ</span>';
  for (let i = 0; i < SKINS.length; i++) {
    const s = SKINS[i], lock = !ACCT.can(s.lvl || 1);
    const sw = s.pal ? s.pal.body : c.body;
    h += '<button class="skin-chip' + (i === cur ? ' active' : '') + (lock ? ' lock' : '') +
      '" data-sk="' + i + '" title="' + (lock ? 'Требуется ур. ' + s.lvl : s.name) + '">' +
      '<i class="swatch" style="background:' + sw + '"></i>' + s.name + (lock ? ' 🔒' + s.lvl : '') + '</button>';
  }
  box.innerHTML = h;
}
function renderSkinGallery() {
  const gallery = $('#skinGallery');
  if (!gallery) return;
  const c = CARS[G.car] || CARS[0];
  $('#skinCarName').textContent = c.name;
  const current = skinIdx(c);
  gallery.innerHTML = SKINS.map((skin, index) => {
    const locked = !ACCT.can(skin.lvl || 1);
    const color = skin.pal ? skin.pal.body : c.body;
    const label = locked ? 'УР. ' + skin.lvl : index === current ? 'АКТИВЕН' : 'ВЫБРАТЬ';
    return '<button class="skin-option' + (index === current ? ' active' : '') + (locked ? ' locked' : '') +
      '" type="button" data-skin-index="' + index + '" aria-label="' + skin.name + (locked ? ', требуется уровень ' + skin.lvl : '') + '">' +
      '<i class="skin-swatch" style="--skin-color:' + color + '"></i><span>' + skin.name + '<small>' + label + '</small></span></button>';
  }).join('');
}
function chooseSkin(index, c) {
  const skin = SKINS[index];
  if (!skin || !c) return false;
  if (!ACCT.can(skin.lvl || 1)) {
    toast('🔒 Цвет «' + skin.name + '» откроется на ' + skin.lvl + '-м уровне аккаунта (сейчас ' + ACCT.lvl + ')');
    Sound.blip(200, .12, 'sawtooth', .18); return false;
  }
  if (skinIdx(c) === index) return true;
  store.set(skinKey(c.id), index);
  applySkin(c);
  Sound.blip(880, .08, 'triangle', .18);
  toast('🎨 «' + c.name + '» → цвет «' + skin.name + '»');
  renderSkinGallery();
  return true;
}

function ownedOf(c) { return c.cost === 0 || store.get('owned' + c.id, false); }
function lvlOk(c) { return ACCT.can(c.lvl || 1); }
/* --- Car purchase: coins or points --- */
function tryBuy(c, usePts) {
  if (!c || ownedOf(c)) return false;
  if (!lvlOk(c)) {
    toast('🔒 Для машины «' + c.name + '» нужен ' + (c.lvl || 1) + '-й уровень аккаунта (сейчас ' + ACCT.lvl + ')');
    Sound.blip(200, .12, 'sawtooth', .18); return false;
  }
  const coinOk = G.coins >= c.cost, ptOk = ACCT.pts >= (c.pcost || 0);
  if (usePts === undefined) usePts = !coinOk && ptOk;
  if (usePts) {
    if (!ptOk) {
      toast('Не хватает ' + ((c.pcost || 0) - ACCT.pts) + ' ⭐ очков — можно купить за 🪙 монеты');
      Sound.blip(200, .12, 'sawtooth', .18); return false;
    }
    ACCT.pts -= (c.pcost || 0); ACCT.spent += (c.pcost || 0); ACCT.save();
  } else {
    if (!coinOk) {
      toast('Не хватает ' + (c.cost - G.coins) + ' 🪙 монет — можно купить за ⭐ очки');
      Sound.blip(200, .12, 'sawtooth', .18); return false;
    }
    G.coins -= c.cost; store.set('coins', G.coins);
  }
  store.set('owned' + c.id, true);
  G.car = c.id; store.set('car', c.id); G.ship = c.id;
  toast('🔓 «' + c.name + '» добавлена в гараж!', 2200);
  Sound.chord([523, 784, 1046], .3, .18);
  return true;
}
function takeCar(c) {
  G.car = c.id; store.set('car', c.id); G.ship = c.id;
  toast('Выбрана машина «' + c.name + '»'); Sound.blip(700, .08, 'triangle', .18);
}
let garageDetailOpen = false;
function carAffordable(c) {
  return G.coins >= c.cost || ACCT.pts >= (c.pcost || 0);
}
function carStartingShield(c) {
  const accountShield = ACCT.extraShield();
  const permanentShield = PERM.n('shield') > 0 ? 6 : 0;
  return Math.max(c.shieldStart + accountShield, permanentShield);
}
function renderShips() {
  const list = $('#shipList'); if (!list) return;
  const rNames = { rare: 'РЕДКАЯ', epic: 'ЭПИЧЕСКАЯ', mythic: 'МИФИЧЕСКАЯ', legendary: 'ЛЕГЕНДАРНАЯ', common: 'РЕДКАЯ' };
  list.innerHTML = CARS.map(c => {
    const owned = ownedOf(c), selected = G.car === c.id, locked = !lvlOk(c);
    const affordable = !owned && !locked && carAffordable(c);
    let status = 'ОТКРЫТА';
    if (selected) status = '✓ ВЫБРАНА';
    else if (locked) status = '🔒 УРОВЕНЬ ' + (c.lvl || 1);
    else if (affordable) status = 'МОЖНО КУПИТЬ';
    else if (!owned) status = 'НУЖНА ВАЛЮТА';
    const P = c.perk ? PERKS[c.perk] : null;
    const cls = ['car-card', selected ? 'selected' : '', locked ? 'locked' : 'unlocked',
      owned ? 'owned' : affordable ? 'available' : ''].filter(Boolean).join(' ');
    const description = P ? P.ic + ' ' + P.name : c.tag;
    const rarityLabel = rNames[c.rarity] || 'ОБЫЧНАЯ';
    return '<button class="' + cls + '" data-id="' + c.id + '" type="button" aria-pressed="' + selected + '" aria-label="' + c.name + ' — ' + status + '">' +
      '<div class="car-card-top-row">' +
        '<span class="car-card-rarity rarity-' + (c.rarity || 'common') + '">' + rarityLabel + '</span>' +
        '<span class="car-card-level">УР. ' + (c.lvl || 1) + '</span>' +
      '</div>' +
      '<canvas class="carPrev car-card-preview" data-id="' + c.id + '" width="336" height="184"></canvas>' +
      '<span class="car-card-name">' + c.name + '</span>' +
      '<span class="car-card-description">' + description + '</span>' +
      (!owned && !locked ? '<span class="car-card-price">🪙 ' + num(c.cost) + ' · ⭐ ' + num(c.pcost || 0) + '</span>' : '') +
      '<span class="car-card-meta"><span class="car-card-state">' + status + '</span></span>' +
      '<span class="car-card-stats"><span>⚡ ' + mul(c.boost) + '</span><span>🧲 ' + (5 * c.magnet).toFixed(1).replace(/\.0$/, '') + ' с</span><span>🛡 ' + carStartingShield(c) + ' с</span></span>' +
      '</button>';
  }).join('');
  const nodes = list.querySelectorAll('.carPrev');
  for (let i = 0; i < nodes.length; i++) drawPrev(nodes[i]);
  $('#carOwnedCount').textContent = CARS.filter(ownedOf).length;
  $('#garageInventory').classList.toggle('hidden', garageDetailOpen);
  $('#garageShowcase').classList.toggle('hidden', !garageDetailOpen);
  $('#garageShowcase').classList.toggle('detail-open', garageDetailOpen);
  renderSkinGallery();
  updateShowcase();
}
/* --- KUCHLAR bo'limi: doimiy kuchaytirish (⭐ ochko evaziga) --- */
function renderPerks() {
  const n = $('#perkList'); if (!n) return;
  let h = '<div class="money" style="margin:2px 0 10px">⭐ <em>' + ACCT.pts +
    '</em> очков · аккаунт <b>УР. ' + ACCT.lvl + '</b></div>';
  for (const u of UPGRADES) {
    const rank = PERM.n(u.k), mx = PERM.rankMax(u), st = PERM.buyable(u), price = PERM.price(u);
    let ranks = '<div class="ranks">';
    for (let i = 0; i < mx; i++) ranks += '<s class="' + (i < rank ? 'on' : '') + '"></s>';
    ranks += '</div>';
    const priceTxt = st === 'max' ? 'МАКС.' : st === 'lvl' ? '🔒 УР. ' + u.pl : '⭐ ' + price;
    h += '<div class="perm ' + (st === 'max' ? 'max' : st === 'ok' ? '' : 'no') + '" data-k="' + u.k + '">' +
      '<div class="ic">' + u.ic + '</div><div class="tx"><b>' + u.name + '</b><small>' + u.p +
      ' · уровень ' + rank + '/' + mx + '</small>' + ranks + '</div>' +
      '<div class="price">' + priceTxt + '<em>' + (st === 'max' ? 'максимум' : 'след. уровень') + '</em></div></div>';
  }
  h += '<p class="sub" style="margin-top:6px;font-size:11.5px">Очки начисляются в конце гонки: очки/55 + дистанция/12 + уровень гонки×15 + монеты.</p>';
  n.innerHTML = h;
}
/* --- AKKAUNT bo'limi: daraja, bonuslar, keyingi daraja --- */
function renderAcct() {
  const n = $('#acctInfo');
  if (n) {
    const need = ACCT.cost(ACCT.lvl), maxed = ACCT.lvl >= ACCT.maxLvl;
    let h = '<div class="perkline"><span>⭐ Уровень аккаунта</span><b>' + ACCT.lvl + ' / ' + ACCT.maxLvl + '</b></div>' +
      '<div class="perkline"><span>Цена повышения</span><b>' + (maxed ? '🏆' : '⭐ ' + need) + '</b></div>';
    for (const r of ACCT.bonusRows()) h += '<div class="perkline"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    h += '<div class="perkline next"><span>Бонус за ур. ' + (maxed ? ACCT.maxLvl : ACCT.lvl + 1) + '</span><b>' +
      (maxed ? 'всё открыто' : ACCT.nextBonusText(ACCT.lvl + 1)) + '</b></div>' +
      '<div class="perkline"><span>Заработано / потрачено</span><b>⭐' + ACCT.total + ' / ⭐' + ACCT.spent + '</b></div>';
    n.innerHTML = h;
    const b2 = $('#btnAcctUp2');
    if (b2) b2.textContent = maxed ? '🏆 МАКСИМАЛЬНЫЙ УРОВЕНЬ' : '⭐ ПОВЫСИТЬ УРОВЕНЬ · ' + need;
  }
  renderPerks();
  renderAcctBar();
}
function drawPrev(cv, rotForce) {
  const c = CARS[cv && cv.dataset ? +cv.dataset.id : NaN];
  if (!c) return;
  const c2 = cv.getContext('2d'); if (!c2) return;
  c2.clearRect(0, 0, cv.width, cv.height);
  const saveCam = { x: CAM.x, y: CAM.y, z: CAM.z, fov: CAM.fov };
  const oldCtx = ctx, oldCx = cx, oldCy = cy, oldW = W, oldH = H;
  CAM.x = 0; CAM.y = .75; CAM.z = -5.2;
  const fr = frameMesh(c.mesh, cv.width, cv.height, -CAM.z, CAM.y, .96);
  CAM.fov = fr.fov; cx = cv.width / 2; cy = fr.cy; W = cv.width; H = cv.height;
  ctx = c2;
  const rot = rotForce != null ? rotForce : -0.7 + Math.sin((performance.now ? performance.now() : 0) / 1100 + c.id) * .1;
  const faces = facesOf(c.mesh, [0, 0, 0], rot, 1);
  faces.sort((a, b) => b.z - a.z);
  for (const f of faces) drawFace(f);
  ctx = oldCtx; cx = oldCx; cy = oldCy; W = oldW; H = oldH;
  Object.assign(CAM, saveCam);
}


/* --------------------------- ИНДИВИДУАЛЬНЫЙ ТЮНИНГ И СТАТИСТИКА --------------------------- */
function renderCarUpgrades(car) {
  const c = car || CARS[showcaseCarId] || CARS[0];
  const list = $('#carUpgradesList');
  if (!list) return;

  const title = $('#upgCarTitle');
  if (title) title.textContent = 'ТЮНИНГ: ' + c.name.toUpperCase();
  const rar = $('#upgCarRarity');
  if (rar) {
    const rNames = { rare: 'РЕДКАЯ', epic: 'ЭПИЧЕСКАЯ', mythic: 'МИФИЧЕСКАЯ', legendary: 'ЛЕГЕНДАРНАЯ', common: 'РЕДКАЯ' };
    rar.textContent = rNames[c.rarity] || 'СПОРТКАР';
    rar.className = 'inventory-count rarity-' + (c.rarity || 'common');
  }
  const nameEl = $('#upgCarName');
  if (nameEl) nameEl.textContent = c.name;
  const descEl = $('#upgCarDesc');
  if (descEl) descEl.textContent = c.tag || 'Спортивный болид с уникальной аэродинамикой.';

  const cv = document.getElementById('cvUpgCar');
  if (cv) drawCarShowcase(cv, c, showcaseRot, 0.85, 2.1);

  const owned = ownedOf(c);
  const upg = CAR_UPG.get(c.id);

  list.innerHTML = UPG_KEYS.map(key => {
    const def = UPG_DEFS[key];
    const lvl = (upg && upg[key] | 0) || 0;
    const isMax = lvl >= 5;
    const cost = CAR_UPG.cost(c, key, lvl);
    const ptCost = CAR_UPG.ptCost(c, key, lvl);
    const curVal = def.val(c, lvl);
    const nextVal = isMax ? curVal : def.val(c, lvl + 1);

    let pips = '<div class="upg-pips">';
    for (let i = 0; i < 5; i++) {
      pips += '<span class="pip' + (i < lvl ? ' active' : '') + '"></span>';
    }
    pips += '</div>';

    let actionButtons = '';
    if (isMax) {
      actionButtons = '<div class="upg-max-badge">✓ МАКСИМАЛЬНЫЙ УРОВЕНЬ</div>';
    } else if (!owned) {
      actionButtons = '<div class="upg-locked-badge">🔒 Сначала откройте машину в гараже</div>';
    } else {
      const canCoin = G.coins >= cost;
      const canPts = ACCT.pts >= ptCost;
      actionButtons = '<div class="upg-actions">' +
        '<button class="btn sm upg-btn upg-coin' + (canCoin ? '' : ' ghost') + '" data-upg-key="' + key + '" data-use-pts="false" type="button">🪙 ' + num(cost) + '</button>' +
        '<button class="btn sm pink upg-btn upg-pts' + (canPts ? '' : ' ghost') + '" data-upg-key="' + key + '" data-use-pts="true" type="button">⭐ ' + num(ptCost) + '</button>' +
        '</div>';
    }

    return '<div class="upg-card' + (isMax ? ' maxed' : '') + '" data-key="' + key + '">' +
      '<div class="upg-card-header">' +
        '<span class="upg-icon">' + def.ic + '</span>' +
        '<div class="upg-title-box">' +
          '<b>' + def.name + '</b>' +
          '<small>' + def.desc + '</small>' +
        '</div>' +
        '<span class="upg-lvl-text">УР. ' + lvl + ' / 5</span>' +
      '</div>' +
      pips +
      '<div class="upg-stat-row">' +
        '<span class="upg-stat-cur">' + curVal + ' ' + def.unit + '</span>' +
        (!isMax ? '<span class="upg-arrow">→</span><span class="upg-stat-next">' + nextVal + ' ' + def.unit + '</span>' : '') +
        '<span class="upg-effect-tag">' + (isMax ? 'МАКСИМУМ' : def.effect) + '</span>' +
      '</div>' +
      actionButtons +
    '</div>';
  }).join('');
}

/* --- ВИЗУАЛЬНЫЙ ТЮНИНГ (AERO, BODY, VINYL, UNDERGLOW, RIMS) --- */
const TUNE_DEFS = {
  wing: {
    title: 'АЭРОДИНАМИЧЕСКИЙ СПОЙЛЕР',
    options: [
      { val: 0, name: 'Заводской', price: 0 },
      { val: 1, name: 'Спорт GT', price: 200 },
      { val: 2, name: 'Карбон Track', price: 350 },
      { val: 3, name: 'Двойной пилон', price: 450 },
      { val: 4, name: 'Дактейл', price: 300 },
      { val: 5, name: 'Биплан Super', price: 600 }
    ]
  },
  splitter: {
    title: 'ПЕРЕДНИЙ СПЛИТТЕР',
    options: [
      { val: 0, name: 'Заводской', price: 0 },
      { val: 1, name: 'Aero Blade', price: 250 },
      { val: 2, name: 'Широкий трековый', price: 400 }
    ]
  },
  stripe: {
    title: 'ГОНОЧНЫЕ ПОЛОСЫ (ВИНИЛ)',
    options: [
      { val: 0, name: 'Без полос', price: 0 },
      { val: 1, name: 'Одинарная', price: 150 },
      { val: 2, name: 'Двойные полосы', price: 250 }
    ]
  },
  stripeColor: {
    title: 'ЦВЕТ ВИНИЛА / ПОЛОС',
    type: 'colors',
    options: [
      { val: '#00e5ff', name: 'Электрический циан', price: 0 },
      { val: '#a855f7', name: 'Неоновый фиолет', price: 150 },
      { val: '#ffc857', name: 'Энерго-золото', price: 200 },
      { val: '#ff6b35', name: 'Огненный оранж', price: 180 },
      { val: '#39ff14', name: 'Токсик-лайм', price: 180 },
      { val: '#f1f5f9', name: 'Чистый белый', price: 220 }
    ]
  },
  rimColor: {
    title: 'КОЛЁСНЫЕ ДИСКИ И ОБОДА',
    type: 'underglow',
    options: [
      { val: null, name: 'Заводские', price: 0 },
      { val: '#00e5ff', name: 'Циан Aero', price: 180 },
      { val: '#a855f7', name: 'Фиолет Неон', price: 200 },
      { val: '#ffc857', name: 'Золото GT', price: 250 },
      { val: '#ff6b35', name: 'Вулкан', price: 220 },
      { val: '#f1f5f9', name: 'Титан Белый', price: 260 }
    ]
  },
  underglow: {
    title: 'НЕОНОВАЯ ПОДСВЕТКА ДНИЩА',
    type: 'underglow',
    options: [
      { val: null, name: 'Выкл', price: 0 },
      { val: '#00e5ff', name: 'Электрический циан', price: 300 },
      { val: '#a855f7', name: 'Неоновый фиолет', price: 350 },
      { val: '#ffc857', name: 'Энерго-золото', price: 400 },
      { val: '#ff6b35', name: 'Плазма оранж', price: 350 },
      { val: '#00ff66', name: 'Био-изумруд', price: 380 }
    ]
  },
  cyberFin: {
    title: 'АКУЛИЙ КИЛЬ НА КРЫШЕ',
    options: [
      { val: false, name: 'Отключен', price: 0 },
      { val: true, name: 'Установлен', price: 350 }
    ]
  },
  widebody: {
    title: 'ТРЕКОВОЕ РАСШИРЕНИЕ (WIDEBODY)',
    options: [
      { val: false, name: 'Стандарт', price: 0 },
      { val: true, name: 'Широкий обвес', price: 750 }
    ]
  }
};

function getTuneItemId(key, val) {
  return key + '_' + String(val);
}

function getCosmeticsOwnership() {
  let owned = store.get('car_cosmetics', null);
  if (!owned || typeof owned !== 'object' || Array.isArray(owned)) {
    owned = {};
  }
  // 1. Zavod va bepul opsiyalar doim ochiq
  for (const k in TUNE_DEFS) {
    const grp = TUNE_DEFS[k];
    if (grp.options) {
      for (let i = 0; i < grp.options.length; i++) {
        const o = grp.options[i];
        if (o.price === 0 || o.val === 0 || o.val === null || o.val === false) {
          owned[getTuneItemId(k, o.val)] = true;
        }
      }
    }
  }
  // 2. Orqaga mos migratsiya: agar avval biror mashinada car_tune_<carId> da detal o\'rnatilgan bo\'lsa,
  // uni avtomatik owned deb belgilaymiz, shunda mavjud foydalanuvchidan qayta pul talab qilinmaydi!
  if (!store.get('car_cosmetics_migrated', false)) {
    for (let carId = 0; carId < CARS.length; carId++) {
      const tune = store.get('car_tune_' + carId, null);
      if (tune && typeof tune === 'object' && !Array.isArray(tune)) {
        for (const k in tune) {
          if (tune[k] !== undefined && tune[k] !== null) {
            owned[getTuneItemId(k, tune[k])] = true;
          }
        }
      }
    }
    store.set('car_cosmetics_migrated', true);
    store.set('car_cosmetics', owned);
  }
  return owned;
}

function setCosmeticsOwnership(owned) {
  if (!owned || typeof owned !== 'object' || Array.isArray(owned)) return;
  store.set('car_cosmetics', owned);
}

function isCosmeticOwned(key, val) {
  const owned = getCosmeticsOwnership();
  return !!owned[getTuneItemId(key, val)];
}

let _cosmeticConfirmState = null;
let _buyCosmeticDebounce = false;

function openCosmeticBuyModal(key, opt, car) {
  const c = car || CARS[showcaseCarId] || CARS[0];
  const group = TUNE_DEFS[key];
  if (!group || !opt) return;

  const price = opt.price || 0;
  const hasFunds = G.coins >= price;
  _cosmeticConfirmState = { key, opt, car: c, price };

  // 3D Preview: Mashinada detalni vaqtincha chizamiz
  const previewCar = Object.assign({}, c);
  const tune = Object.assign({}, CAR_TUNING.get(c.id));
  tune[key] = opt.val;
  const p = palOf(previewCar);
  previewCar.mesh = buildCar(p.body, p.roof, p.glass, p.acc, previewCar.shape, Object.assign({}, previewCar, tune));
  const cv = document.getElementById('cvUpgCar');
  if (cv) drawCarShowcase(cv, previewCar, showcaseRot, 0.85, 2.1);

  const title = group.title;
  const name = opt.name || 'Опция';

  const modalHtml = '<div class="cosmetic-confirm-modal" style="text-align:center;padding:12px 6px">' +
    '<div style="font-size:32px;margin-bottom:8px">🎨</div>' +
    '<div style="font-size:16px;font-weight:900;color:#fff;margin-bottom:4px">' + title + '</div>' +
    '<div style="font-size:13px;color:#7fe9ff;font-weight:800;margin-bottom:14px">ВЫБРАНО: ' + name + '</div>' +
    '<div style="background:rgba(12,18,40,.85);border:1px solid rgba(111,158,229,.3);border-radius:12px;padding:12px;margin-bottom:16px;text-align:left">' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;margin-bottom:8px">' +
        '<span>Стоимость детали:</span>' +
        '<b style="color:#ffd166;font-size:14px">🪙 ' + price + ' монет</b>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">' +
        '<span>Ваш текущий баланс:</span>' +
        '<b style="color:' + (hasFunds ? '#7dff9b' : '#ff2b43') + ';font-size:13px">🪙 ' + G.coins + ' монет</b>' +
      '</div>' +
    '</div>' +
    (hasFunds ?
      '<div style="display:flex;gap:10px;justify-content:center">' +
        '<button class="btn sm ghost" id="btnCancelCosmetic" type="button" style="flex:1">ОТМЕНА</button>' +
        '<button class="btn sm yellow" id="btnConfirmBuyCosmetic" type="button" style="flex:1">🪙 КУПИТЬ</button>' +
      '</div>'
      :
      '<div style="margin-bottom:14px">' +
        '<p style="color:#ff758f;font-size:12px;font-weight:800;margin-bottom:4px">❌ Недостаточно средств!</p>' +
        '<p style="color:#94a3b8;font-size:11px">Не хватает 🪙 ' + (price - G.coins) + ' монет. Заработайте монеты в заездах!</p>' +
      '</div>' +
      '<button class="btn sm ghost" id="btnCancelCosmetic" type="button" style="width:100%">ЗАКРЫТЬ</button>'
    ) +
  '</div>';

  showModal('ПОДТВЕРЖДЕНИЕ ПОКУПКИ', modalHtml);

  const btnCancel = document.getElementById('btnCancelCosmetic');
  if (btnCancel) {
    btnCancel.onclick = () => {
      cancelCosmeticPreview();
      hideModal();
    };
  }

  const btnConfirm = document.getElementById('btnConfirmBuyCosmetic');
  if (btnConfirm) {
    btnConfirm.onclick = () => {
      executeCosmeticPurchase();
    };
  }
}

function cancelCosmeticPreview() {
  _cosmeticConfirmState = null;
  const c = CARS[showcaseCarId] || CARS[0];
  applySkin(c);
  renderVisualTuning(c);
  updateShowcase();
}

function executeCosmeticPurchase() {
  if (!_cosmeticConfirmState || _buyCosmeticDebounce) return;
  const { key, opt, car, price } = _cosmeticConfirmState;
  const c = car || CARS[showcaseCarId] || CARS[0];

  // Qat\'iy himoya: agar allaqachon sotib olingan bo\'lsa, pul yechilmaydi
  if (isCosmeticOwned(key, opt.val)) {
    hideModal();
    _cosmeticConfirmState = null;
    const tune = CAR_TUNING.get(c.id);
    tune[key] = opt.val;
    CAR_TUNING.set(c.id, tune);
    applySkin(c);
    renderVisualTuning(c);
    updateShowcase();
    return;
  }

  if (G.coins < price) {
    toast('Недостаточно монет! Требуется 🪙 ' + price, 2400);
    cancelCosmeticPreview();
    hideModal();
    return;
  }

  _buyCosmeticDebounce = true;
  setTimeout(() => { _buyCosmeticDebounce = false; }, 260);

  // 1. Balansdan yechish
  G.coins -= price;
  bankCoins();

  // 2. Ownership saqlash
  const owned = getCosmeticsOwnership();
  owned[getTuneItemId(key, opt.val)] = true;
  setCosmeticsOwnership(owned);

  // 3. Mashinaga o\'rnatish
  const tune = CAR_TUNING.get(c.id);
  tune[key] = opt.val;
  CAR_TUNING.set(c.id, tune);
  applySkin(c);

  _cosmeticConfirmState = null;
  hideModal();

  Sound.chord([523, 659, 784, 1046], .4, .25);
  toast('🎉 Деталь успешно куплена и установлена!', 2600);

  renderVisualTuning(c);
  updateShowcase();
  menuStats();
}

function renderVisualTuning(car) {
  const c = car || CARS[showcaseCarId] || CARS[0];
  const list = document.getElementById('visualTuningList');
  if (!list) return;

  const cv = document.getElementById('cvUpgCar');
  if (cv) drawCarShowcase(cv, c, showcaseRot, 0.85, 2.1);

  const tune = CAR_TUNING.get(c.id);
  const owned = getCosmeticsOwnership();

  let html = '';
  for (const key in TUNE_DEFS) {
    const group = TUNE_DEFS[key];
    const curVal = tune[key];

    html += '<div class="tune-group" style="margin-bottom:14px;text-align:left">' +
      '<div class="tune-group-title">' +
        '<span>' + group.title + '</span>' +
      '</div>';

    if (group.type === 'colors' || group.type === 'underglow') {
      html += '<div class="color-swatch-row">';
      for (const opt of group.options) {
        const itemId = getTuneItemId(key, opt.val);
        const hasIt = opt.price === 0 || !!owned[itemId];
        const isSel = opt.val === curVal || (opt.val === null && !curVal);

        if (opt.val === null) {
          const btnClass = 'tune-opt-btn' + (isSel ? ' on' : '') + (!hasIt ? ' to-buy' : '');
          html += '<button class="' + btnClass + '" data-tune-key="' + key + '" data-tune-val="null" type="button">' +
            (isSel ? 'ВЫКЛ ✓' : 'ВЫКЛ') +
          '</button>';
        } else {
          const btnClass = 'color-swatch-btn' + (isSel ? ' on' : '') + (!hasIt ? ' to-buy' : '');
          const label = opt.name + (hasIt ? (isSel ? ' (Установлено)' : ' (В наличии)') : ' (🪙 ' + opt.price + ')');
          html += '<button class="' + btnClass + '" data-tune-key="' + key + '" data-tune-val="' + opt.val + '" style="background:' + opt.val + ';color:' + opt.val + '" title="' + label + '" aria-label="' + label + '" type="button"></button>';
        }
      }
      html += '</div>';
    } else {
      html += '<div class="tune-options">';
      for (const opt of group.options) {
        const itemId = getTuneItemId(key, opt.val);
        const hasIt = opt.price === 0 || !!owned[itemId];
        const isSel = String(curVal) === String(opt.val) || (curVal == null && opt.val === 0);

        let statusText = '';
        let btnClass = 'tune-opt-btn';
        if (isSel) {
          btnClass += ' on';
          statusText = ' ✓';
        } else if (hasIt) {
          btnClass += ' owned';
        } else {
          btnClass += ' to-buy';
          statusText = ' · 🪙 ' + opt.price;
        }

        html += '<button class="' + btnClass + '" data-tune-key="' + key + '" data-tune-val="' + opt.val + '" type="button">' +
          opt.name + statusText +
        '</button>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  list.innerHTML = html;
}

/* --- ЕЖЕДНЕВНЫЕ МИССИИ И ДОСТИЖЕНИЯ --- */
const MISSIONS = [
  { id: 'dist3k', title: 'ДАЛЬНИЙ ЗАЕЗД', desc: 'Преодолейте 3 000 метров в одном заезде', icon: '🛣', goal: 3000, unit: 'м', rewardCoins: 250, rewardPts: 50, getVal: () => Math.floor(G.dist || 0) },
  { id: 'coins150', title: 'НЕОНОВЫЙ КЛАД', desc: 'Соберите 150 монет за один заезд', icon: '🪙', goal: 150, unit: '', rewardCoins: 300, rewardPts: 40, getVal: () => Math.floor(G.runCoins || 0) },
  { id: 'nitro10', title: 'ФОРСАЖНЫЙ ТУРБОДРАЙВ', desc: 'Активируйте нитро-ускорение 10 раз', icon: '🔥', goal: 10, unit: 'раз', rewardCoins: 200, rewardPts: 60, getVal: () => (G.runNitroCount || 0) },
  { id: 'bossEscape', title: 'ПОБЕГ ОТ ПЕРЕХВАТЧИКА', desc: 'Успешно оторвитесь от босса-преследователя', icon: '🚨', goal: 1, unit: 'раз', rewardCoins: 500, rewardPts: 100, getVal: () => (G.runBossEscaped || 0) },
  { id: 'nearMiss20', title: 'НА ГРАНИ РИСКА', desc: 'Совершите 20 опасных обгонов вплотную к трафику', icon: '⚡', goal: 20, unit: 'раз', rewardCoins: 350, rewardPts: 70, getVal: () => (G.nearMisses || G.runNearMisses || 0) },
  { id: 'dimensionClear', title: 'ПУТЕШЕСТВЕННИК ИЗМЕРЕНИЙ', desc: 'Войдите в портал и завершите испытание измерения', icon: '🌀', goal: 1, unit: 'раз', rewardCoins: 400, rewardPts: 80, getVal: () => (G.runDimensionsCleared || 0) },
  { id: 'driftCombo5', title: 'ДРИФТ-ВИРТУОЗ', desc: 'Наберите множитель дрифта ×5', icon: '💨', goal: 5, unit: 'x', rewardCoins: 300, rewardPts: 50, getVal: () => (G.runMaxDriftCombo || 0) },
  { id: 'checkpoint2', title: 'ТРАССОВЫЙ МАСТЕР', desc: 'Пройдите 2 контрольные точки биомов в заезде', icon: '🚩', goal: 2, unit: '', rewardCoins: 450, rewardPts: 90, getVal: () => (G.runCheckpointsPassed || 0) }
];

const ACHIEVEMENTS = [
  { id: 'first_race', title: 'ПЕРВЫЙ СТАРТ', desc: 'Совершите свой первый заезд в NEON RACE', icon: '🏁', goal: 1, unit: 'гонка', rewardCoins: 150, rewardPts: 30, getVal: () => (G.meta.runs || G.meta.plays || (G.running ? 1 : 0) || 0) },
  { id: 'cars_5', title: 'КОЛЛЕКЦИОНЕР', desc: 'Соберите 5 различных спорткаров в гараже', icon: '🚗', goal: 5, unit: 'машин', rewardCoins: 500, rewardPts: 100, getVal: () => (typeof ownedOf === 'function' ? CARS.filter(ownedOf).length : 0) },
  { id: 'cars_15', title: 'ГАРАЖ МЕЧТЫ', desc: 'Соберите 15 спорткаров в своём гараже', icon: '🏎', goal: 15, unit: 'машин', rewardCoins: 1500, rewardPts: 300, getVal: () => (typeof ownedOf === 'function' ? CARS.filter(ownedOf).length : 0) },
  { id: 'coins_10k', title: 'НЕОНОВЫЙ МАГНАТ', desc: 'Заработайте суммарно 10 000 монет', icon: '🪙', goal: 10000, unit: 'монет', rewardCoins: 1000, rewardPts: 200, getVal: () => Math.max((G.meta.totalCoins || 0) + (G.runCoins || 0), G.coins || 0) },
  { id: 'speed_300', title: 'СВЕРХЗВУКОВОЙ БАРЬЕР', desc: 'Развейте скорость свыше 300 км/ч', icon: '⚡', goal: 300, unit: 'км/ч', rewardCoins: 400, rewardPts: 80, getVal: () => Math.floor(Math.max(G.meta.maxKmh || 0, typeof speedToKmh === 'function' ? speedToKmh(G.speed || 0) : ((G.speed || 0) * 3.6))) },
  { id: 'drift_master', title: 'КОРОЛЬ ЗАНОСОВ', desc: 'Проведите в непрерывном заносе более 5 секунд', icon: '💨', goal: 5, unit: 'с', rewardCoins: 450, rewardPts: 90, getVal: () => Math.floor(Math.max(G.meta.maxDriftSec || 0, G.driftSec || 0)) },
  { id: 'all_dimensions', title: 'ХОЗЯИН ИЗМЕРЕНИЙ', desc: 'Пройдите через порталы 6 раз', icon: '🌀', goal: 6, unit: 'порталов', rewardCoins: 1200, rewardPts: 250, getVal: () => (G.meta.dimensionsCleared || G.meta.portalsEntered || 0) },
  { id: 'boss_slayer', title: 'НЕУЛОВИМЫЙ ПРИЗРАК', desc: 'Успешно оторвитесь от босса-преследователя 5 раз', icon: '🚨', goal: 5, unit: 'раз', rewardCoins: 800, rewardPts: 150, getVal: () => (G.meta.bossEscapes || 0) },
  { id: 'distance_50k', title: 'МАРАФОНЕЦ ТРАССЫ', desc: 'Преодолейте суммарную дистанцию 50 000 метров', icon: '🛣', goal: 50000, unit: 'м', rewardCoins: 2000, rewardPts: 400, getVal: () => Math.floor(Math.max(G.meta.totalDist || 0, (G.meta.totalDist || 0) + (G.dist || 0))) },
  { id: 'max_upgrade', title: 'АБСОЛЮТНЫЙ ФОРСАЖ', desc: 'Прокачайте 10 параметров тюнинга', icon: '🔧', goal: 10, unit: 'улучшений', rewardCoins: 1000, rewardPts: 200, getVal: () => (G.meta.upgradesPurchased || 0) },
  { id: 'score_100k', title: 'ЛЕГЕНДАРНЫЙ СЧЁТ', desc: 'Наберите более 100 000 очков за один заезд', icon: '👑', goal: 100000, unit: 'очков', rewardCoins: 2500, rewardPts: 500, getVal: () => Math.floor(Math.max(G.meta.best || 0, G.score || 0)) },
  { id: 'acct_lvl10', title: 'МАСТЕР NEON RACE', desc: 'Достигните 10 уровня аккаунта', icon: '⭐', goal: 10, unit: 'уровень', rewardCoins: 3000, rewardPts: 600, getVal: () => (ACCT && ACCT.lvl ? ACCT.lvl : 1) }
];

/* --- ЕЖЕДНЕВНЫЕ МИССИИ (LOCAL TIME RESET AT 00:00 & MIGRATION) --- */
function getLocalDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function getMissionState() {
  const today = getLocalDateKey();
  let raw = null;
  try {
    raw = store.get('missions_state', null);
  } catch (e) {
    raw = null;
  }

  // 1. Agar ma\'lumot bo\'lmasa yoki noto\'g\'ri turda bo\'lsa
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    const fresh = { lastDate: today, items: {} };
    store.set('missions_state', fresh);
    return fresh;
  }

  // 2. Agar yangi formatda bo\'lsa (lastDate mavjud)
  if (typeof raw.lastDate === 'string') {
    if (raw.lastDate === today) {
      if (!raw.items || typeof raw.items !== 'object' || Array.isArray(raw.items)) {
        raw.items = {};
      }
      return raw;
    } else {
      // Sana almashgan! Eski kungi olinmagan mukofotlar yangi kunga ko\'chirilmasin
      const fresh = { lastDate: today, items: {} };
      store.set('missions_state', fresh);
      return fresh;
    }
  }

  // 3. Orqaga mos migratsiya (Eski format: { [id]: { cur, done, claimed } })
  // Joriy progress va bajarilgan lekin olinmagan mukofotlar bugungi kunga saqlab qolinadi
  const migratedItems = {};
  for (const k in raw) {
    if (raw[k] && typeof raw[k] === 'object' && !Array.isArray(raw[k])) {
      migratedItems[k] = {
        cur: Number(raw[k].cur) || 0,
        done: !!raw[k].done,
        claimed: !!raw[k].claimed,
        notified: !!raw[k].done
      };
    }
  }
  const migrated = { lastDate: today, items: migratedItems };
  store.set('missions_state', migrated);
  return migrated;
}

function setMissionState(st) {
  if (!st || typeof st !== 'object' || Array.isArray(st)) return;
  if (!st.lastDate) st.lastDate = getLocalDateKey();
  if (!st.items || typeof st.items !== 'object' || Array.isArray(st.items)) st.items = {};
  store.set('missions_state', st);
}

let _claimMissionDebounce = false;
function claimMission(id) {
  if (_claimMissionDebounce) return;
  const m = MISSIONS.find(x => x.id === id);
  if (!m) return;

  const st = getMissionState();
  const item = (st.items && st.items[id]) || {};
  if (!item.done || item.claimed) return;

  _claimMissionDebounce = true;
  setTimeout(() => { _claimMissionDebounce = false; }, 250);

  // Birinchi navbatda claimed holatini saqlaymiz (takroriy mukofot olishning qat\'iy oldini oladi)
  item.claimed = true;
  st.items[id] = item;
  setMissionState(st);

  // Valyutalarni berish
  G.coins += (m.rewardCoins || 0);
  ACCT.add(m.rewardPts || 0);
  bankCoins();

  Sound.chord([523, 659, 784, 1046], .4, .25);
  toast('🎉 Задание выполнено! +' + m.rewardCoins + ' 🪙 и +' + m.rewardPts + ' ⭐!', 2500);
  renderMissions();
  menuStats();
}

let _missionsTimerInterval = null;
function updateMissionsTimerUI() {
  const elTimer = document.getElementById('missionsTimerText');
  if (!elTimer) return;

  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const diff = Math.max(0, tomorrow.getTime() - now.getTime());

  const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');

  elTimer.textContent = 'СБРОС: ' + h + ':' + m + ':' + s;
}

function startMissionsTimer() {
  if (_missionsTimerInterval) return;
  updateMissionsTimerUI();
  _missionsTimerInterval = setInterval(() => {
    updateMissionsTimerUI();
    const today = getLocalDateKey();
    const raw = store.get('missions_state', null);
    if (raw && raw.lastDate && raw.lastDate !== today) {
      getMissionState();
      const tabM = document.getElementById('tabMissions');
      if (tabM && !tabM.classList.contains('hidden')) {
        renderMissions();
      }
    }
  }, 1000);
}

let _lastMissionCheckT = 0;
function checkMissionsInRace() {
  if (!G.running || G.paused) return;
  if (G.t - _lastMissionCheckT < 0.45) return;
  _lastMissionCheckT = G.t;

  if (typeof getMissionState !== 'function') return;
  const mSt = getMissionState();
  if (!mSt || !mSt.items) return;

  let changed = false;
  for (let i = 0; i < MISSIONS.length; i++) {
    const m = MISSIONS[i];
    const item = mSt.items[m.id] || { cur: 0, done: false, claimed: false, notified: false };
    const val = m.getVal ? m.getVal() : 0;
    if (val > (item.cur || 0)) {
      item.cur = val;
      changed = true;
    }
    if (item.cur >= m.goal && !item.done) {
      item.done = true;
      changed = true;
    }
    if (item.done && !item.notified) {
      item.notified = true;
      changed = true;
      toast('🎯 МИССИЯ ВЫПОЛНЕНА: ' + m.title + '! Заберите награду в меню', 3200);
      Sound.blip(880, .12, 'triangle', .2);
    }
    mSt.items[m.id] = item;
  }
  if (changed) setMissionState(mSt);
}

function getAchieveState() {
  let raw = null;
  try {
    raw = store.get('achieve_state', {});
  } catch (e) {
    raw = {};
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    raw = {};
  }
  return raw;
}

function setAchieveState(st) {
  if (!st || typeof st !== 'object' || Array.isArray(st)) return;
  store.set('achieve_state', st);
}

let _lastAchieveCheckT = -999;
function checkAchievementsRealtime(force) {
  if (!force && G && G.running && typeof G.t === 'number' && _lastAchieveCheckT >= 0) {
    if (G.t > _lastAchieveCheckT && G.t - _lastAchieveCheckT < 0.45) return;
  }
  if (G && typeof G.t === 'number') _lastAchieveCheckT = G.t;

  const st = getAchieveState();
  let changed = false;

  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const a = ACHIEVEMENTS[i];
    const item = st[a.id] || { cur: 0, done: false, claimed: false, notified: false };
    const val = a.getVal ? a.getVal() : 0;
    if (val > (item.cur || 0)) {
      item.cur = val;
      changed = true;
    }
    if (item.cur >= a.goal && !item.done) {
      item.done = true;
      changed = true;
    }
    if (item.done && !item.notified) {
      item.notified = true;
      changed = true;
      toast('🏆 ДОСТИЖЕНИЕ: «' + a.title + '»! Награда: +' + a.rewardCoins + ' 🪙 +' + a.rewardPts + ' ⭐', 3500);
      Sound.chord([523, 659, 784, 1046, 1318], .4, .22);
    }
    st[a.id] = item;
  }
  if (changed) setAchieveState(st);
}

let _claimAchieveDebounce = false;
function claimAchievement(id) {
  if (_claimAchieveDebounce) return;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  const st = getAchieveState();
  const item = st[id] || {};
  if (!item.done || item.claimed) return;

  _claimAchieveDebounce = true;
  setTimeout(() => { _claimAchieveDebounce = false; }, 260);

  // Birinchi navbatda claimed holatini saqlash (takroriy mukofot olishning qat\'iy oldini oladi)
  item.claimed = true;
  st[id] = item;
  setAchieveState(st);

  // Mukofotlarni to\'g\'ri berish (manfiy bo\'lmaslik kafolati)
  G.coins = Math.max(0, G.coins + (a.rewardCoins || 0));
  ACCT.add(a.rewardPts || 0);
  bankCoins();

  Sound.chord([523, 659, 784, 1046, 1318], .5, .25);
  toast('🏆 Награда получена! +' + a.rewardCoins + ' 🪙 и +' + a.rewardPts + ' ⭐!', 2500);
  renderAchievements();
  menuStats();
}

function renderMissions() {
  const elList = document.getElementById('missionsList');
  if (!elList) return;
  updateMissionsTimerUI();
  const st = getMissionState();
  elList.innerHTML = MISSIONS.map(m => {
    const item = (st.items && st.items[m.id]) || { cur: 0, done: false, claimed: false };
    const curVal = Math.max(item.cur || 0, m.getVal ? m.getVal() : 0);
    const isDone = item.done || curVal >= m.goal;
    if (isDone && !item.done) {
      item.done = true;
      item.cur = curVal;
      if (st.items) st.items[m.id] = item;
      setMissionState(st);
    }
    const isClaimed = !!item.claimed;
    const pct = Math.min(100, Math.round((curVal / m.goal) * 100));

    let btnHtml = '';
    if (isClaimed) {
      btnHtml = '<button class="claim-btn claimed" type="button" disabled>ВРУЧЕНО ✓</button>';
    } else if (isDone) {
      btnHtml = '<button class="claim-btn ready" data-claim-mission="' + m.id + '" type="button">ЗАБРАТЬ</button>';
    } else {
      btnHtml = '<button class="claim-btn locked" type="button" disabled>' + curVal + ' / ' + m.goal + '</button>';
    }

    return '<div class="mission-card' + (isDone ? ' done' : '') + '">' +
      '<div class="mission-icon">' + m.icon + '</div>' +
      '<div class="mission-info">' +
        '<div class="mission-title">' + m.title + '</div>' +
        '<div class="mission-desc">' + m.desc + '</div>' +
        '<div class="mission-bar-wrap"><div class="mission-bar" style="width:' + pct + '%"></div></div>' +
        '<div class="mission-meta">' +
          '<span>ПРОГРЕСС: ' + curVal + ' / ' + m.goal + ' ' + m.unit + ' (' + pct + '%)</span>' +
          '<div class="mission-rewards"><span>🪙 +' + m.rewardCoins + '</span><span>⭐ +' + m.rewardPts + '</span></div>' +
        '</div>' +
      '</div>' +
      btnHtml +
    '</div>';
  }).join('');
}

function renderAchievements() {
  const elList = document.getElementById('achieveList');
  const countEl = document.getElementById('achieveCountText');
  if (!elList) return;

  // Real vaqt holati bilan tekshiramiz
  if (typeof checkAchievementsRealtime === 'function') checkAchievementsRealtime();
  const st = getAchieveState();
  let doneCount = 0;

  elList.innerHTML = ACHIEVEMENTS.map(a => {
    const item = st[a.id] || { cur: 0, done: false, claimed: false };
    const curVal = Math.max(item.cur || 0, a.getVal ? a.getVal() : 0);
    const isDone = item.done || curVal >= a.goal;
    if (isDone) {
      doneCount++;
      if (!item.done) {
        item.done = true;
        item.cur = curVal;
        st[a.id] = item;
        setAchieveState(st);
      }
    }
    const isClaimed = !!item.claimed;
    const pct = Math.min(100, Math.round((curVal / a.goal) * 100));

    let btnHtml = '';
    let cardStatusClass = 'locked';
    if (isClaimed) {
      btnHtml = '<button class="claim-btn claimed" type="button" disabled>ПОЛУЧЕНО ✓</button>';
      cardStatusClass = 'claimed';
    } else if (isDone) {
      btnHtml = '<button class="claim-btn ready" data-claim-achieve="' + a.id + '" type="button">ЗАБРАТЬ</button>';
      cardStatusClass = 'done';
    } else {
      btnHtml = '<button class="claim-btn locked" type="button" disabled>' + curVal + ' / ' + a.goal + '</button>';
      cardStatusClass = 'locked';
    }

    return '<div class="mission-card ' + cardStatusClass + '">' +
      '<div class="mission-icon">' + a.icon + '</div>' +
      '<div class="mission-info">' +
        '<div class="mission-title">' + a.title + '</div>' +
        '<div class="mission-desc">' + a.desc + '</div>' +
        '<div class="mission-bar-wrap"><div class="mission-bar" style="width:' + pct + '%"></div></div>' +
        '<div class="mission-meta">' +
          '<span>ПРОГРЕСС: ' + curVal + ' / ' + a.goal + ' ' + (a.unit || '') + ' (' + pct + '%)</span>' +
          '<div class="mission-rewards"><span>🪙 +' + a.rewardCoins + '</span><span>⭐ +' + a.rewardPts + '</span></div>' +
        '</div>' +
      '</div>' +
      btnHtml +
    '</div>';
  }).join('');
  if (countEl) countEl.textContent = doneCount + ' / ' + ACHIEVEMENTS.length + ' ВЫПОЛНЕНО';
}

function triggerBossChase(customName) {
  if (G.bossActive) return false;
  G.bossActive = true;
  G.bossWarningActive = false;
  G.bossTimer = 22.0;
  G.bossDist = 20.0;
  G.bossZ = 20.0;
  G.bossLane = (typeof G.lane === 'number' && G.lane >= 0 && G.lane <= 2) ? G.lane : 1;
  G.bossX = LANES[G.bossLane];
  G.bossAttackState = 'idle';
  G.bossAttackTimer = 3.0;
  G.bossTargetLane = G.bossLane;
  G.bossName = customName || 'ПЕРЕХВАТЧИК «СПЕКТР-9»';
  toast('🚨 БОСС-ПОГОНЯ: «' + G.bossName + '» НА ТРАССЕ! УДЕРЖИВАЙТЕ СКОРОСТЬ!', 4000);
  Sound.bossWarning();
  const bh = el._bossHud || (el._bossHud = $('#bossHud'));
  if (bh) {
    bh.classList.remove('hidden');
    const bTitle = $('#bossTitle'), bSub = $('#bossSub'), bBar = $('#bossBar');
    if (bTitle) bTitle.textContent = '🚨 БОСС-ПОГОНЯ: ' + G.bossName;
    if (bSub) bSub.textContent = 'ДИСТАНЦИЯ: ' + Math.round(G.bossDist) + ' М · ВРЕМЯ: ' + Math.ceil(G.bossTimer) + ' С';
    if (bBar) bBar.style.width = '70%';
  }
  return true;
}
function showModal(title, contentHtml) {
  const container = document.getElementById('modalContainer');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');
  if (!container || !titleEl || !bodyEl) return;
  titleEl.textContent = title;
  bodyEl.innerHTML = contentHtml;
  container.classList.remove('hidden');
}
function hideModal() {
  const container = document.getElementById('modalContainer');
  if (container) container.classList.add('hidden');
  if (typeof cancelCosmeticPreview === 'function' && _cosmeticConfirmState) {
    cancelCosmeticPreview();
  }
}

function renderFullStatistics() {
  const statBox = $('#statList');
  if (!statBox) return;

  const totalDist = (G.meta.totalDist || 0) + (G.dist || 0);
  const totalTime = (G.meta.totalTime || 0) + (G.t || 0);
  const totalCoins = (G.meta.totalCoins || 0) + (G.runCoins || 0);
  const plays = G.meta.plays || G.meta.runs || 0;
  const bestScore = G.meta.best || 0;
  const farthest = G.meta.farthest || 0;
  const portals = G.meta.portalsEntered || 0;
  const dims = G.meta.dimensionsCleared || 0;
  const totalUpgrades = G.meta.upgradesPurchased || G.meta.totalUpgrades || 0;

  const unlockedCars = CARS.filter(ownedOf).length;
  const totalCars = CARS.length;
  const collPct = Math.round(unlockedCars / totalCars * 100);
  const timeFormatted = Math.floor(totalTime / 60) + ' мин ' + Math.floor(totalTime % 60) + ' сек';

  const cardsGrid = $('#statsCardsGrid');
  if (cardsGrid) {
    cardsGrid.innerHTML = [
      { label: 'РЕКОРДНЫЙ СЧЁТ', val: num(bestScore) },
      { label: 'ДИСТАНЦИЯ КАРЬЕРЫ', val: km(totalDist) },
      { label: 'АВТОПАРК В ГАРАЖЕ', val: unlockedCars + ' / ' + totalCars },
      { label: 'УРОВЕНЬ АККАУНТА', val: 'УР. ' + ACCT.lvl },
      { label: 'УХОДОВ ОТ БОССА', val: num(G.meta.bossEscapes || 0) },
      { label: 'ПОРТАЛОВ ПРОЙДЕНО', val: num(portals) }
    ].map(card => '<div class="stat-summary-card"><small>' + card.label + '</small><b>' + card.val + '</b></div>').join('');
  }

  let h = '<div class="stat-overview-grid">' +
    '<div class="stat-hero-card">' +
      '<small>УРОВЕНЬ АККАУНТА</small>' +
      '<b>УР. ' + ACCT.lvl + ' / ' + ACCT.maxLvl + '</b>' +
      '<div class="stat-progress-bar"><div class="fill" style="width:' + Math.min(100, ACCT.pts / ACCT.cost(ACCT.lvl) * 100) + '%"></div></div>' +
      '<span>⭐ ' + num(ACCT.pts) + ' / ' + num(ACCT.cost(ACCT.lvl)) + ' очков</span>' +
    '</div>' +
    '<div class="stat-hero-card">' +
      '<small>ЛУЧШИЙ РЕКОРД</small>' +
      '<b>' + num(bestScore) + '</b>' +
      '<span>Макс. дистанция: ' + km(farthest) + '</span>' +
    '</div>' +
    '<div class="stat-hero-card">' +
      '<small>КОЛЛЕКЦИЯ МАШИН</small>' +
      '<b>' + unlockedCars + ' / ' + totalCars + '</b>' +
      '<div class="stat-progress-bar"><div class="fill" style="width:' + collPct + '%"></div></div>' +
      '<span>Открыто ' + collPct + '% автопарка</span>' +
    '</div>' +
  '</div>';

  h += '<div class="stat-metrics-grid">' +
    '<div class="stat-metric-tile"><small>ВСЕГО ЗАЕЗДОВ</small><b>' + num(plays) + '</b></div>' +
    '<div class="stat-metric-tile"><small>ОБЩАЯ ДИСТАНЦИЯ</small><b>' + km(totalDist) + '</b></div>' +
    '<div class="stat-metric-tile"><small>ВРЕМЯ В ИГРЕ</small><b>' + timeFormatted + '</b></div>' +
    '<div class="stat-metric-tile"><small>ВСЕГО МОНЕТ</small><b>🪙 ' + num(totalCoins) + '</b></div>' +
    '<div class="stat-metric-tile"><small>ТЕКУЩИЙ БАЛАНС</small><b>🪙 ' + num(G.coins) + '</b></div>' +
    '<div class="stat-metric-tile"><small>ПОРТАЛОВ ПРОЙДЕНО</small><b>🌀 ' + num(portals) + '</b></div>' +
    '<div class="stat-metric-tile"><small>ИЗМЕРЕНИЙ ЗАВЕРШЕНО</small><b>✨ ' + num(dims) + '</b></div>' +
    '<div class="stat-metric-tile"><small>КУПЛЕНО УЛУЧШЕНИЙ</small><b>⚡ ' + num(totalUpgrades) + '</b></div>' +
  '</div>';

  h += '<div class="stat-collection-section">' +
    '<h4 class="stat-sec-title">КОЛЛЕКЦИЯ СПОРТКАРОВ (30 МОДЕЛЕЙ)</h4>' +
    '<div class="stat-car-grid">';

  for (const c of CARS) {
    const owned = ownedOf(c);
    const sel = G.car === c.id;
    const upg = CAR_UPG.get(c.id);
    let totalLvl = 0;
    UPG_KEYS.forEach(k => { totalLvl += (upg && upg[k] | 0) || 0; });

    h += '<div class="stat-car-card' + (sel ? ' selected' : '') + (owned ? ' owned' : ' locked') + '">' +
      '<div class="stat-car-head">' +
        '<b>' + c.name + '</b>' +
        '<span class="stat-car-badge">' + (sel ? 'ВЫБРАНА' : owned ? 'ОТКРЫТА' : '🔒 УР. ' + c.lvl) + '</span>' +
      '</div>' +
      '<div class="stat-car-body">' +
        '<span>Редкость: ' + (c.rarity === 'legendary' ? 'Легендарная' : c.rarity === 'epic' ? 'Эпическая' : c.rarity === 'rare' ? 'Редкая' : 'Обычная') + '</span>' +
        '<span>Тюнинг: <b>' + totalLvl + ' / 40</b> ур.</span>' +
      '</div>' +
    '</div>';
  }
  h += '</div></div>';

  statBox.innerHTML = h;
}

const TABS = { ships: 'Ships', biomes: 'Biomes', carUpgrades: 'CarUpgrades', missions: 'Missions', achieve: 'Achieve', perk: 'Perk', skins: 'Skins', acct: 'Acct', stat: 'Stat', set: 'Set' };
function activateTab(name, selectedFilter) {
  const filterName = selectedFilter || (name === 'perk' ? 'upgrades' : (name === 'carUpgrades' ? 'carUpgrades' : name));
  document.querySelectorAll('.garage-filters .tab').forEach(x => {
    const active = x.dataset.tab === filterName;
    x.classList.toggle('on', active);
    x.setAttribute('aria-selected', String(active));
  });
  for (const k in TABS) hide($('#tab' + TABS[k]));
  show($('#tab' + TABS[name]));
  if (name === 'ships') {
    if (selectedFilter) garageDetailOpen = false;
    renderShips();
  }
  if (name === 'biomes') {
    renderBiomesMenu();
  }
  if (name === 'carUpgrades') {
    const c = CARS[showcaseCarId] || CARS[0];
    if ($('#subtabVisual') && $('#subtabVisual').classList.contains('on')) {
      renderVisualTuning(c);
    } else {
      renderCarUpgrades(c);
    }
  }
  if (name === 'missions') renderMissions();
  if (name === 'achieve') renderAchievements();
  if (name === 'perk' || name === 'acct') renderAcct();
  if (name === 'skins') renderSkinGallery();
  if (name === 'stat') {
    menuStats();
    renderFullStatistics();
  }
}
function setMenuView(view) {
  menuView = view;
  el.scrMenu.classList.toggle('menu-home', view === 'home');
  el.scrMenu.classList.toggle('menu-garage', view === 'garage');
  $('#homeLanding').classList.toggle('hidden', view !== 'home');
  $('#garageContent').classList.toggle('hidden', view !== 'garage');
  if (view === 'garage') $('#garageContent').scrollTop = 0;
}
function setMenuDropdown(open) {
  const button = $('#btnMenuToggle'), dropdown = $('#menuDropdown');
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  dropdown.classList.toggle('hidden', !open);
}
function cycleHomeCar(direction) {
  showcaseCarId = (showcaseCarId + direction + CARS.length) % CARS.length;
  const c = CARS[showcaseCarId];
  if (ownedOf(c)) takeCar(c);
  updateShowcase();
  menuStats();
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  Sound.ensure(); Sound.blip(620, .06, 'triangle', .14);
  const tab = t.dataset.tab;
  if (tab === 'all' || tab === 'ships') activateTab('ships', tab);
  else if (tab === 'upgrades') activateTab('perk');
  else if (tab === 'carUpgrades') activateTab('carUpgrades');
  else if (tab === 'biomes') activateTab('biomes');
  else activateTab(tab);
}));
$('#btnOpenGarage').addEventListener('click', () => {
  setMenuDropdown(false);
  setMenuView('garage');
  activateTab('ships');
});
const btnOpenTutHero = $('#btnOpenTut');
if (btnOpenTutHero) {
  btnOpenTutHero.addEventListener('click', () => {
    Sound.ensure(); Sound.resume();
    setMenuDropdown(false);
    TUTORIAL_SYSTEM.startRace(1);
  });
}
$('#btnBackHome').addEventListener('click', () => setMenuView('home'));
$('#btnBrandHome').addEventListener('click', () => setMenuView('home'));
$('#btnProfile').addEventListener('click', () => {
  setMenuView('garage');
  activateTab('acct');
});
$('#btnCarPrev').addEventListener('click', () => cycleHomeCar(-1));
$('#btnCarNext').addEventListener('click', () => cycleHomeCar(1));
$('#btnCarDetailBack').addEventListener('click', () => {
  garageDetailOpen = false;
  renderShips();
  $('#garageInventory').scrollIntoView({ block: 'start', behavior: 'smooth' });
});
$('#btnMenuToggle').addEventListener('click', () => {
  setMenuDropdown($('#menuDropdown').classList.contains('hidden'));
});
$('#menuDropdown').addEventListener('click', (e) => {
  const button = e.target.closest ? e.target.closest('[data-menu-action]') : null;
  if (!button) return;
  setMenuDropdown(false);
  const action = button.dataset.menuAction;
  if (action === 'help') {
    hide(el.scrMenu); show(el.scrHow);
  } else if (action === 'home') {
    setMenuView('home');
  } else if (action === 'garage') {
    setMenuView('garage');
    activateTab('ships');
  } else if (action === 'biomes') {
    setMenuView('garage');
    activateTab('biomes');
  } else if (action === 'tuning') {
    setMenuView('garage');
    activateTab('carUpgrades');
  } else if (action === 'missions') {
    setMenuView('garage');
    activateTab('missions');
  } else if (action === 'achieve') {
    setMenuView('garage');
    activateTab('achieve');
  } else if (action === 'stat' || action === 'set') {
    setMenuView('garage');
    activateTab(action);
  } else if (action === 'tutorial') {
    Sound.ensure(); Sound.resume();
    TUTORIAL_SYSTEM.startRace(1);
  }
});
document.addEventListener('click', (e) => {
  const tools = $('.menu-tools');
  if (!tools.contains(e.target) && !$('#menuDropdown').classList.contains('hidden')) setMenuDropdown(false);
});
/* --- Garaj: mashina olish / tanlash --- */
$('#shipList').addEventListener('click', (e) => {
  const n = e.target.closest ? e.target.closest('.car-card') : null; if (!n) return;
  const c = CARS[+n.dataset.id]; if (!c) return;
  showcaseCarId = c.id;
  if (ownedOf(c)) takeCar(c);
  garageDetailOpen = true;
  renderShips();
  updateShowcase();
  menuStats();
});
const scBtn = $('#btnSelectCar');
if (scBtn) {
  scBtn.addEventListener('click', () => {
    const c = CARS[showcaseCarId]; if (!c) return;
    if (!ownedOf(c)) tryBuy(c, false);
    else takeCar(c);
    renderShips(); menuStats();
  });
}
const scBtn2 = $('#btnSelectCarPts');
if (scBtn2) {
  scBtn2.addEventListener('click', () => {
    const c = CARS[showcaseCarId]; if (!c) return;
    if (!ownedOf(c)) tryBuy(c, true);
    else takeCar(c);
    renderShips(); menuStats();
  });
}
const scCv = document.getElementById('cvShowcase');
if (scCv) {
  scCv.addEventListener('mousedown', (e) => { showcaseDragging = true; showcaseX = e.clientX; });
  window.addEventListener('mousemove', (e) => {
    if (!showcaseDragging) return;
    showcaseRot += (e.clientX - showcaseX) * 0.02;
    showcaseX = e.clientX;
    updateShowcase();
  });
  window.addEventListener('mouseup', () => { showcaseDragging = false; });
  scCv.addEventListener('touchstart', (e) => { showcaseDragging = true; showcaseX = e.touches[0].clientX; }, { passive: true });
  scCv.addEventListener('touchmove', (e) => {
    if (!showcaseDragging) return;
    showcaseRot += (e.touches[0].clientX - showcaseX) * 0.025;
    showcaseX = e.touches[0].clientX;
    updateShowcase();
  }, { passive: true });
  scCv.addEventListener('touchend', () => { showcaseDragging = false; }, { passive: true });
  scCv.addEventListener('touchcancel', () => { showcaseDragging = false; }, { passive: true });
}
/* --- Skin tanlash: har bir mashina uchun alohida saqlanadi --- */
const skinBox = $('#skinPicker');
if (skinBox) {
  skinBox.addEventListener('click', (e) => {
    const b = e.target.closest ? e.target.closest('.skin-chip') : null; if (!b) return;
    const c = CARS[showcaseCarId] || CARS[0], i = +b.dataset.sk, s = SKINS[i];
    if (!c || !s) return;
    Sound.ensure(); Sound.resume();
    if (chooseSkin(i, c)) renderShips();
  });
}
$('#skinGallery').addEventListener('click', (e) => {
  const button = e.target.closest ? e.target.closest('.skin-option') : null;
  if (!button) return;
  Sound.ensure(); Sound.resume();
  if (chooseSkin(+button.dataset.skinIndex, CARS[G.car] || CARS[0])) {
    renderShips();
    renderSkinGallery();
  }
});
/* --- Kuchlar xaridi --- */
$('#perkList').addEventListener('click', (e) => {
  const n = e.target.closest ? e.target.closest('.perm') : null; if (!n) return;
  const u = UPGRADES.find(x => x.k === n.dataset.k); if (!u) return;
  Sound.ensure(); Sound.resume();
  if (PERM.buy(u)) { renderPerks(); renderAcct(); renderShips(); menuStats(); }
});
/* --- Akkaunt darajasini oshirish --- */
function acctUp() {
  Sound.ensure(); Sound.resume();
  if (ACCT.up()) { renderShips(); menuStats(); }
}
$('#btnAcctUp').addEventListener('click', acctUp);
$('#btnAcctUp2').addEventListener('click', acctUp);
$('#btnOverUp').addEventListener('click', () => {
  hide(el.scrOver); show(el.scrMenu); G.running = false; G.over = false;
  setMenuView('garage'); menuStats(); renderShips(); activateTab('acct');
});
$('#btnPlay').addEventListener('click', () => { Sound.ensure(); Sound.resume(); startRun(); });
$('#btnHowPlay').addEventListener('click', () => { Sound.ensure(); Sound.resume(); startRun(); });
$('#btnAgain').addEventListener('click', () => startRun());
$('#btnMenu').addEventListener('click', () => { bankCoins(); hide(el.scrOver); show(el.scrMenu); setMenuView('home'); menuStats(); renderShips(); G.running = false; G.over = false; });
$('#btnHowBack').addEventListener('click', () => { hide(el.scrHow); show(el.scrMenu); menuStats(); });
$('#btnResume').addEventListener('click', togglePause);
$('#btnQuit').addEventListener('click', () => { G.paused = false; hide(el.scrPause); G.running = false; setHint(-1); show(el.scrMenu); setMenuView('home'); menuStats(); renderShips(); });
$('#btnSnd').addEventListener('click', () => { Sound.ensure(); Sound.set(!Sound.on); menuStats(); });
$('#btnMus').addEventListener('click', () => { Sound.ensure(); Sound.setMusic(!Sound.musicOn); menuStats(); });
$('#btnQual').addEventListener('click', () => {
  const order = ['low', 'medium', 'high'];
  const nextIdx = (order.indexOf(G.quality) + 1) % order.length;
  G.quality = order[nextIdx] || 'medium';
  store.set('qual', G.quality);
  syncQualityClass();
  resize(); buildBackdrop(); renderShips(); menuStats();
  toast('⚙ Качество графики: ' + qualLabel(G.quality));
});
$('#btnCtl').addEventListener('click', () => { document.body.classList.toggle('touch'); menuStats(); });
$('#btnTut').addEventListener('click', () => { G.tutDone = false; store.set('tutDone', false); toast('🎓 Обучение начнётся в следующей гонке'); });
$('#btnReviveNo').addEventListener('click', () => { hide(el.scrRevive); gameOver(); });
$('#btnReviveAd').addEventListener('click', async () => {
  hide(el.scrRevive);
  let ok = true;
  if (YA.ready) ok = await YA.rewarded();
  if (!ok) { toast('Реклама не загрузилась — гонка окончена'); gameOver(); return; }
  reviveNow();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.running && !G.paused) togglePause(); });

/* --------------------------- START --------------------------- */
/* --- Responsiv: o'lcham yoki yo'nalish o'zgarsa hammayni qayta hisoblaymiz --- */
let resizeT = 0;
function onViewportChange() {
  resize(); buildBackdrop();
  clearTimeout(resizeT);
  resizeT = setTimeout(function () {
    if (el.scrMenu && !el.scrMenu.classList.contains('hidden')) renderShips();
  }, 140);
  if (!G.running) render();
}
window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', function () { setTimeout(onViewportChange, 280); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportChange);
resize(); buildBackdrop(); renderLives(); setMenuView('home'); menuStats(); renderShips();
TUTORIAL_SYSTEM.bindDOM();
TUTORIAL_SYSTEM.checkFirstTime();
requestAnimationFrame(frame);
setTimeout(() => el.load.classList.add('gone'), 600);
YA.init();

window.NY3D = {
  G, CAM, YA, Sound, el, LANES, KIND, HAZARD, GOOD, JUMPABLE, OBJ, LESSONS, MESHES, MESH_LIFE,
  MESH_MAGNET_PLUS, MESH_SHIELD_PLUS, MESH_HEART_PLUS, mergeMesh, CARS, SHIPS: CARS,
  UPGRADES, POOL, car, ship, keys, store, ACCT, PERM, SHAPES, SKINS, SHAPE_DEF,
  startRun, update, render, frame, spawnRow, addObj, freeObj, drawObj, drawShip, drawBadge, drawRoad, resize, onViewportChange,
  quad, proj, facesOf, drawFace, shade, meshOfBoxes, meshOfWedges, meshOfRing, meshOfPrism, meshOfOcta, meshOfCone, meshOfCoin, buildCar,
  skinIdx, skinOf, skinKey, palOf, applySkin, renderSkinPicker, updateShowcase, fitShowcase, frameMesh,
  jump, moveLane, pickCard, offerCards, togglePause, gameOver, maybeRevive, updateHUD, renderLives,
  menuStats, renderShips, renderPerks, renderAcct, renderAcctBar, renderOverAcct, activateTab, ownedOf, lvlOk,
  tryBuy, takeCar, applyPerk, PERKS, PERK_KEYS, reviveNow, BIOMES, TRACK_SEC, TRANS_DUR, BAND_NAME,
  currentBiome, trackBiome, difficultyBand, nextTrack, mixColor, drawTrackTransition,
  levelNeed, diff01, km, num, mul,
  buildBackdrop, drawBackdrop, drawSilhouette,
  drawPrev, bankCoins, statHTML, toast, burst, bumpCombo, setHint, nextLesson, lessonEvent, lessonTick,
  CAR_TUNING, CAR_UPG, UPG_DEFS, UPG_KEYS, TUNE_DEFS, renderVisualTuning,
  getTuneItemId, getCosmeticsOwnership, setCosmeticsOwnership, isCosmeticOwned, openCosmeticBuyModal, executeCosmeticPurchase, cancelCosmeticPreview,
  MISSIONS, ACHIEVEMENTS, renderMissions, renderAchievements, claimMission, claimAchievement,
  checkAchievementsRealtime, getAchieveState, setAchieveState,
  triggerBossChase,
  BIOME_EVENTS, triggerBiomeEvent, drawBiomeWeather, initBiomeEventParticles, updateBiomeEventParticles,
  getMissionState, setMissionState, getLocalDateKey, updateMissionsTimerUI, checkMissionsInRace, startMissionsTimer,
  showModal, hideModal,
  DIMENSIONS, enterDimension, exitDimension, speedToKmh, qualLabel, detectInitialQuality, syncQualityClass, drawPortalActive, drawPortalOpen, drawPortalEntryEffect, drawMagnetArcs,
  selectedStartingBiome, getSelectedStartingBiome, selectStartingBiome, renderBiomesMenu, drawBiomeCardPreview,
  DESIGN_SYSTEM, MATERIALS, ASSET_REGISTRY, BIOME_3D, TUTORIAL_SYSTEM, setMenuView
};

let upgDebounce = false;
const upgListEl = document.getElementById('carUpgradesList');
if (upgListEl) {
  upgListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.upg-btn');
    if (!btn || upgDebounce) return;
    upgDebounce = true;
    setTimeout(() => { upgDebounce = false; }, 260);

    const key = btn.dataset.upgKey;
    const usePts = btn.dataset.usePts === 'true';
    const c = CARS[showcaseCarId] || CARS[0];

    const ok = CAR_UPG.upgrade(c, key, usePts);
    if (ok) {
      renderCarUpgrades(c);
      menuStats();
      updateShowcase();
    }
  });
}

const subPerf = document.getElementById('subtabPerf');
const subVisual = document.getElementById('subtabVisual');
const perfBox = document.getElementById('perfUpgradesBox');
const visualBox = document.getElementById('visualTuningBox');
if (subPerf && subVisual && perfBox && visualBox) {
  subPerf.addEventListener('click', () => {
    subPerf.classList.add('on');
    subVisual.classList.remove('on');
    perfBox.classList.remove('hidden');
    visualBox.classList.add('hidden');
    const c = CARS[showcaseCarId] || CARS[0];
    renderCarUpgrades(c);
  });
  subVisual.addEventListener('click', () => {
    subVisual.classList.add('on');
    subPerf.classList.remove('on');
    perfBox.classList.add('hidden');
    visualBox.classList.remove('hidden');
    const c = CARS[showcaseCarId] || CARS[0];
    renderVisualTuning(c);
  });
}

const visualListEl = document.getElementById('visualTuningList');
if (visualListEl) {
  visualListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tune-key]');
    if (!btn) return;
    const key = btn.dataset.tuneKey;
    let rawVal = btn.dataset.tuneVal;
    let val = rawVal;
    if (rawVal === 'null') val = null;
    else if (rawVal === 'true') val = true;
    else if (rawVal === 'false') val = false;
    else if (!isNaN(Number(rawVal))) val = Number(rawVal);

    const c = CARS[showcaseCarId] || CARS[0];
    const group = TUNE_DEFS[key];
    if (!group) return;
    const opt = group.options.find(o => String(o.val) === String(val) || (o.val == null && val == null));
    if (!opt) return;

    const owned = getCosmeticsOwnership();
    const itemId = getTuneItemId(key, opt.val);
    const hasIt = opt.price === 0 || !!owned[itemId];

    if (hasIt) {
      // Sotib olingan — bepul o'rnatiladi
      const tune = CAR_TUNING.get(c.id);
      tune[key] = val;
      CAR_TUNING.set(c.id, tune);
      applySkin(c);
      renderVisualTuning(c);
      updateShowcase();
      Sound.blip(540, .08, 'triangle', .18);
    } else {
      // Sotib olinmagan — preview va tasdiqlash modali ochiladi
      openCosmeticBuyModal(key, opt, c);
      Sound.blip(620, .08, 'triangle', .18);
    }
  });
}

const missListEl = document.getElementById('missionsList');
if (missListEl) {
  missListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-claim-mission]');
    if (btn) claimMission(btn.dataset.claimMission);
  });
}

const achListEl = document.getElementById('achieveList');
if (achListEl) {
  achListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-claim-achieve]');
    if (btn) claimAchievement(btn.dataset.claimAchieve);
  });
}

const btnModalClose = document.getElementById('btnModalClose');
if (btnModalClose) btnModalClose.addEventListener('click', hideModal);

const modalCont = document.getElementById('modalContainer');
if (modalCont) {
  modalCont.addEventListener('click', (e) => {
    if (e.target === modalCont) hideModal();
  });
}

const btnBackToCars = document.getElementById('btnBackToCars');
if (btnBackToCars) {
  btnBackToCars.addEventListener('click', () => {
    activateTab('ships');
  });
}

const btnGoUpg = document.getElementById('btnGoCarUpgrades');
if (btnGoUpg) {
  btnGoUpg.addEventListener('click', () => {
    activateTab('carUpgrades');
  });
}

// Close dropdown on Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    setMenuDropdown(false);
    hideModal();
  }
});

const unlockAudioGesture = () => {
  Sound.ensure();
  Sound.resume();
  window.removeEventListener('pointerdown', unlockAudioGesture);
  window.removeEventListener('keydown', unlockAudioGesture);
};
window.addEventListener('pointerdown', unlockAudioGesture, { passive: true });
window.addEventListener('keydown', unlockAudioGesture, { passive: true });

startMissionsTimer();
initBiomeSelectionEvents();
