
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
  const cs = Math.cos(rotY), sn = Math.sin(rotY), out = [];
  const mv = mesh.v, n = mv.length, vs = mesh._vs || (mesh._vs = new Array(n));
  for (let i = 0; i < n; i++) {
    const p = mv[i];
    const x = p[0] * S, y = p[1] * S, z = p[2] * S;
    vs[i] || (vs[i] = [0, 0, 0]);
    vs[i][0] = pos[0] + x * cs - z * sn;
    vs[i][1] = pos[1] + y;
    vs[i][2] = pos[2] + x * sn + z * cs;
  }
  const L = mesh.light || LIGHT, cols = mesh.c, em = mesh.em, mats = mesh.mat;
  const qCfg = DESIGN_SYSTEM.getQualityConfig();
  const fcPool = mesh._fc || (mesh._fc = new Array(mesh.f.length));
  for (let fi = 0; fi < mesh.f.length; fi++) {
    const f = mesh.f[fi], cnt = f.length;
    let zAvg = 0;
    for (let i = 0; i < cnt; i++) {
      zAvg += vs[f[i]][2];
    }
    zAvg /= cnt;
    if (zAvg < CAM.z + 0.8) continue;
    const a = vs[f[0]], b = vs[f[1]], c = vs[f[2]];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const ln = Math.hypot(nx, ny, nz) || 1;
    const diff = Math.abs((nx / ln) * L[0] + (ny / ln) * L[1] + (nz / ln) * L[2]);
    let fc = fcPool[fi];
    if (!fc) fc = fcPool[fi] = { f, vs, z: zAvg, col: cols[fi], l: 1 };
    fc.f = f; fc.vs = vs; fc.z = zAvg; fc.col = cols[fi];
    if (em[fi]) {
      fc.l = 1.06;
    } else {
      const matObj = mats && mats[fi] ? MATERIALS[mats[fi]] : null;
      const spec = (matObj && matObj.metalness > 0.6 && diff > 0.72) ? (diff - 0.72) * qCfg.specularBoost * matObj.metalness : 0;
      fc.l = 0.34 + 0.66 * diff + spec;
    }
    out.push(fc);
  }
  return out;
}

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
  const fog = Math.max(0, Math.min(1, 1.04 - (fc.z - CAM.z) / 58));
  ctx.globalAlpha = fog;
  ctx.fillStyle = shade(fc.col, fc.l);
  ctx.fill();
  const q = (typeof G !== 'undefined' && G.quality) || 'high';
  if (q === 'high' ? fog > .55 : (q === 'medium' && fc.z < 18)) {
    ctx.strokeStyle = shade(fc.col, fc.l * 1.14);
    ctx.lineWidth = 0.7;
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
  if (shadeCache.size < 5000) shadeCache.set(key, out2);
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
const GOOD = { coin: 1, nitro: 1, shield: 1, magnet: 1, life: 1 };
const JUMPABLE = { bar: 1, cone: 1 };
const KIND = { CAR: 'car', TRUCK: 'truck', BAR: 'bar', WALL: 'wall', CONE: 'cone',
  COIN: 'coin', NITRO: 'nitro', SH: 'shield', MAG: 'magnet', LIFE: 'life' };

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
/* Active portal frame on single lane */
const MESH_PORTAL_ACTIVE = meshOfBoxes([
  { p: [-1.22, 1.45, 0], s: [.16, 1.45, .22], c: '#1e1038', top: '#a855f7' },
  { p: [1.22, 1.45, 0], s: [.16, 1.45, .22], c: '#1e1038', top: '#a855f7' },
  { p: [0, 2.85, 0], s: [1.36, .16, .22], c: '#2e1065', top: '#00e5ff' },
  { p: [0, 3.05, 0], s: [.46, .09, .12], c: '#ffc857', em: true }
]);
/* Open highway arch on non-portal lanes */
const MESH_PORTAL_OPEN = meshOfBoxes([
  { p: [-1.18, 1.35, 0], s: [.11, 1.35, .16], c: '#0d1725', top: '#00e5ff' },
  { p: [1.18, 1.35, 0], s: [.11, 1.35, .16], c: '#0d1725', top: '#00e5ff' },
  { p: [0, 2.72, 0], s: [1.28, .10, .16], c: '#1e293b', top: '#38bdf8' },
  { p: [0, 2.72, .04], s: [.85, .05, .06], c: '#00e5ff', em: true }
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
const MESH_LIFE = meshOfBoxes([
  { p: [0, .45, 0], s: [.50, .16, .16], c: '#ff7ab8', em: true },
  { p: [0, .45, 0], s: [.16, .16, .50], c: '#ff7ab8', em: true },
  { p: [0, .82, 0], s: [.16, .38, .16], c: '#ffd3e6' },
  { p: [0, .08, 0], s: [.16, .38, .16], c: '#ffd3e6' }
]);
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
  checkpoint: ASSET_REGISTRY.registerMesh('checkpoint', MESH_CHECKPOINT),
  portal_active: ASSET_REGISTRY.registerMesh('portal_active', MESH_PORTAL_ACTIVE),
  portal_open: ASSET_REGISTRY.registerMesh('portal_open', MESH_PORTAL_OPEN),
  boss: ASSET_REGISTRY.registerMesh('boss', MESH_BOSS)
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
  // 1. Неон Апекс (Обычная, УР. 1)
  { id: 0, name: 'Неон Апекс', rarity: 'common', cost: 0, pcost: 0, lvl: 1, shape: 'sport',
    body: '#00e5ff', roof: '#071826', glass: '#bff5ff', acc: '#7dff9b',
    stripe: 1, stripeColor: '#7dff9b', underglow: '#00e5ff', cyberFin: true, wing: 4, splitter: 1, headlights: 'laser',
    boost: 1.25, shieldStart: 0, magnet: 1.15, tag: 'Кибер-спорткар: неон + лазер', perk: 'steady' },

  // 2. Розовая Валькирия (Обычная, УР. 2)
  { id: 1, name: 'Розовая Валькирия', rarity: 'common', cost: 450, pcost: 90, lvl: 2, shape: 'sport',
    body: '#ff2fb9', roof: '#2c0822', glass: '#ffd9f2', acc: '#ffd166',
    stripe: 2, stripeColor: '#ffd166', underglow: '#ff2fb9', canards: 1, wing: 2, headlights: 'quad',
    boost: 1.45, shieldStart: 0, magnet: 1.25, tag: 'Двойные полосы и каналы нитро', perk: 'drain' },

  // 3. Золотой Зверь (Обычная, УР. 3)
  { id: 2, name: 'Золотой Зверь', rarity: 'common', cost: 900, pcost: 180, lvl: 3, shape: 'muscle',
    body: '#ffd166', roof: '#2e2107', glass: '#fff6d8', acc: '#ff9a3c',
    blower: 1, widebody: 1, underglow: '#ffd166', sideExhaust: 1, wing: 1, splitter: 1,
    boost: 1.40, shieldStart: 6, magnet: 1.40, tag: 'Турбо-компрессор и выхлоп', perk: 'score' },

  // 4. Кибер Такси 2099 (Обычная, УР. 4)
  { id: 3, name: 'Кибер Такси 2099', rarity: 'common', cost: 1400, pcost: 280, lvl: 4, shape: 'sport',
    body: '#ffc21a', roof: '#1a1403', glass: '#fff4cf', acc: '#00e5ff', sign: 1, rails: 1,
    stripe: 1, stripeColor: '#1a1403', underglow: '#ffc21a', widebody: 1,
    boost: 1.42, shieldStart: 4, magnet: 1.55, tag: 'Светящийся шашечный стиль', perk: 'coin' },

  // 5. Электро Шторм (Обычная, УР. 5)
  { id: 4, name: 'Электро Шторм', rarity: 'common', cost: 1800, pcost: 360, lvl: 5, shape: 'sport',
    body: '#38bdf8', roof: '#082f49', glass: '#e0f2fe', acc: '#facc15',
    stripe: 2, stripeColor: '#facc15', underglow: '#38bdf8', wing: 1,
    boost: 1.46, shieldStart: 8, magnet: 1.45, tag: 'Электрический форсированный хэтч', perk: 'energy' },

  // 6. Токсичный Вайпер (Редкая, УР. 6)
  { id: 5, name: 'Токсичный Вайпер', rarity: 'rare', cost: 2400, pcost: 480, lvl: 6, shape: 'sport',
    body: '#39ff14', roof: '#05220c', glass: '#dcffe4', acc: '#00e5ff',
    roofScoop: 1, canards: 1, underglow: '#39ff14', wing: 2, splitter: 2, headlights: 'laser',
    boost: 1.48, shieldStart: 8, magnet: 1.70, tag: 'Аэродинамический яд', perk: 'magnetup' },

  // 7. Квантовый Спектр (Редкая, УР. 7)
  { id: 6, name: 'Квантовый Спектр', rarity: 'rare', cost: 3000, pcost: 600, lvl: 7, shape: 'sport',
    body: '#a855f7', roof: '#1f0d38', glass: '#f3e8ff', acc: '#38bdf8',
    stripe: 1, stripeColor: '#38bdf8', underglow: '#a855f7', wing: 1, headlights: 'laser',
    boost: 1.55, shieldStart: 6, magnet: 1.60, tag: 'Квантовое излучение и скорость', perk: 'photon' },

  // 8. Гипер Молния (Редкая, УР. 8)
  { id: 7, name: 'Гипер Молния', rarity: 'rare', cost: 3800, pcost: 760, lvl: 8, shape: 'racer',
    body: '#d5e4ff', roof: '#0e173b', glass: '#8ef9ff', acc: '#ff2fb9',
    nose: 1, wing: 3, cyberFin: true, underglow: '#7dffff', stripe: 2, stripeColor: '#ff2fb9',
    boost: 1.90, shieldStart: 2, magnet: 1.35, tag: 'Сверхзвуковой болид GT', perk: 'turbo' },

  // 9. Турбо Самурай (Редкая, УР. 9)
  { id: 8, name: 'Турбо Самурай', rarity: 'rare', cost: 4600, pcost: 920, lvl: 9, shape: 'drift',
    body: '#e11d48', roof: '#26040d', glass: '#ffe4e6', acc: '#fbbf24',
    wing: 4, canards: 1, underglow: '#e11d48', sideExhaust: 1, splitter: 2,
    boost: 1.62, shieldStart: 4, magnet: 1.50, tag: 'Мастер точного заноса', perk: 'driftking' },

  // 10. Крепость GT (Редкая, УР. 10)
  { id: 9, name: 'Крепость GT', rarity: 'rare', cost: 5500, pcost: 1100, lvl: 10, shape: 'muscle',
    body: '#8ea6db', roof: '#141d3d', glass: '#e6eeff', acc: '#ffd166', rails: 1,
    widebody: 1, blower: 1, underglow: '#8ea6db', diffuser: 2,
    boost: 1.35, shieldStart: 18, magnet: 1.45, tag: 'Тяжёлый броневик с защитой', perk: 'armor' },

  // 11. Кибер Патруль (Редкая, УР. 12)
  { id: 10, name: 'Кибер Патруль', rarity: 'rare', cost: 7000, pcost: 1400, lvl: 12, shape: 'sport',
    body: '#f4f7ff', roof: '#090d18', glass: '#cfe9ff', acc: '#00e5ff', bar: 1,
    stripe: 1, stripeColor: '#ff2b43', underglow: '#3b8cff', canards: 1, wing: 1, headlights: 'laser',
    boost: 1.65, shieldStart: 12, magnet: 1.80, tag: 'Импульсные маячки закона', perk: 'luck' },

  // 12. Теневой Страйкер (Редкая, УР. 13)
  { id: 11, name: 'Теневой Страйкер', rarity: 'rare', cost: 8200, pcost: 1640, lvl: 13, shape: 'coupe',
    body: '#1e293b', roof: '#020617', glass: '#94a3b8', acc: '#00e5ff',
    underglow: '#00e5ff', diffuser: 2, splitter: 1, wing: 4, headlights: 'laser',
    boost: 1.68, shieldStart: 12, magnet: 1.60, tag: 'Стелс-карбон для ночных гонок', perk: 'slipstream' },

  // 13. Огненный Титан (Редкая, УР. 14)
  { id: 12, name: 'Огненный Титан', rarity: 'rare', cost: 9500, pcost: 1900, lvl: 14, shape: 'muscle',
    body: '#ff5500', roof: '#2c0b00', glass: '#ffd9c2', acc: '#ffe066',
    blower: 2, widebody: 1, sideExhaust: 1, underglow: '#ff5500', wing: 4, splitter: 2,
    boost: 1.80, shieldStart: 14, magnet: 2.05, tag: 'Двойной нагнетатель и огонь', perk: 'combo' },

  // 14. Вортекс R (Редкая, УР. 15)
  { id: 13, name: 'Вортекс R', rarity: 'rare', cost: 11000, pcost: 2200, lvl: 15, shape: 'rally',
    body: '#059669', roof: '#022c22', glass: '#d1fae5', acc: '#fbbf24',
    widebody: 1, rails: 1, underglow: '#059669', wing: 2, headlights: 'quad',
    boost: 1.72, shieldStart: 14, magnet: 1.75, tag: 'Раллийный полноприводный зверь', perk: 'titan' },

  // 15. Апекс Сапфир GT (Редкая, УР. 16)
  { id: 14, name: 'Апекс Сапфир GT', rarity: 'rare', cost: 13000, pcost: 2600, lvl: 16, shape: 'hyper',
    body: '#1a75ff', roof: '#05122b', glass: '#cfe4ff', acc: '#7dff9b',
    roofScoop: 1, canards: 1, wing: 5, underglow: '#1a75ff', stripe: 1, stripeColor: '#7dff9b',
    boost: 1.70, shieldStart: 12, magnet: 1.65, tag: 'Би-план крыло и воздухозаборник', perk: 'smash' },

  // 16. Серебряный Призрак (Эпическая, УР. 18)
  { id: 15, name: 'Серебряный Призрак', rarity: 'epic', cost: 15500, pcost: 3100, lvl: 18, shape: 'racer',
    body: '#e8edf7', roof: '#202a42', glass: '#9fe8ff', acc: '#00e5ff',
    nose: 1, wing: 3, underglow: '#00e5ff', splitter: 2, cyberFin: true,
    boost: 1.95, shieldStart: 6, magnet: 1.45, tag: 'Стреловидный монокок', perk: 'brakes' },

  // 17. Солнечный Ветер (Эпическая, УР. 19)
  { id: 16, name: 'Солнечный Ветер', rarity: 'epic', cost: 17500, pcost: 3500, lvl: 19, shape: 'speedster',
    body: '#f59e0b', roof: '#451a03', glass: '#fef3c7', acc: '#ef4444',
    roofScoop: 1, cyberFin: true, underglow: '#f59e0b', wing: 2, headlights: 'laser',
    boost: 1.85, shieldStart: 10, magnet: 1.80, tag: 'Солнечная батарея и ускорение', perk: 'goldrush' },

  // 18. Магма Дестроер (Эпическая, УР. 20)
  { id: 17, name: 'Магма Дестроер', rarity: 'epic', cost: 19500, pcost: 3900, lvl: 20, shape: 'muscle',
    body: '#ff1f3a', roof: '#280407', glass: '#ffd7c2', acc: '#ffaa00', scoop: 1,
    blower: 1, widebody: 1, underglow: '#ff1f3a', wing: 2, sideExhaust: 1, diffuser: 2,
    boost: 1.75, shieldStart: 20, magnet: 1.70, tag: 'Вулканический термощит', perk: 'sregen' },

  // 19. Ночной Ястреб (Эпическая, УР. 21)
  { id: 18, name: 'Ночной Ястреб', rarity: 'epic', cost: 21500, pcost: 4300, lvl: 21, shape: 'muscle',
    body: '#312e81', roof: '#0f0e2a', glass: '#c7d2fe', acc: '#f43f5e',
    blower: 1, canards: 1, wing: 5, underglow: '#4338ca', sideExhaust: 1,
    boost: 1.88, shieldStart: 16, magnet: 1.90, tag: 'Тёмный перехватчик с антикрылом', perk: 'overdrive' },

  // 20. Аэро Зефир (Эпическая, УР. 22)
  { id: 19, name: 'Аэро Зефир', rarity: 'epic', cost: 24000, pcost: 4800, lvl: 22, shape: 'hyper',
    body: '#00ffaa', roof: '#022115', glass: '#e6fff2', acc: '#00e5ff',
    wing: 5, canards: 1, roofScoop: 1, underglow: '#00ffaa', splitter: 2,
    boost: 1.90, shieldStart: 10, magnet: 1.85, tag: 'Двойное антикрыло вихря', perk: 'djump' },

  // 21. Атомный Спринт (Эпическая, УР. 23)
  { id: 20, name: 'Атомный Спринт', rarity: 'epic', cost: 26500, pcost: 5300, lvl: 23, shape: 'speedster',
    body: '#06b6d4', roof: '#083344', glass: '#cffafe', acc: '#ec4899',
    nose: 1, cyberFin: true, underglow: '#06b6d4', splitter: 2, wing: 3,
    boost: 1.98, shieldStart: 8, magnet: 1.70, tag: 'Ультралёгкий атомный родстер', perk: 'aero' },

  // 22. Королевский GT (Эпическая, УР. 24)
  { id: 21, name: 'Королевский GT', rarity: 'epic', cost: 29000, pcost: 5800, lvl: 24, shape: 'sport',
    body: '#ffd700', roof: '#2f2302', glass: '#fff6d8', acc: '#ffffff',
    widebody: 1, stripe: 2, stripeColor: '#ffffff', underglow: '#ffd700', wing: 2, cyberFin: true,
    boost: 1.75, shieldStart: 24, magnet: 2.20, tag: 'Императорский золотой суперкар', perk: 'revive' },

  // 23. Громовержец GT (Эпическая, УР. 25)
  { id: 22, name: 'Громовержец GT', rarity: 'epic', cost: 31500, pcost: 6300, lvl: 25, shape: 'muscle',
    body: '#4f46e5', roof: '#1e1b4b', glass: '#e0e7ff', acc: '#f59e0b',
    blower: 2, widebody: 1, underglow: '#6366f1', sideExhaust: 1, diffuser: 2, wing: 4,
    boost: 1.92, shieldStart: 22, magnet: 2.10, tag: 'Тройной компрессор молнии', perk: 'shockwave' },

  // 24. Зенит F1 Монарх (Легендарная, УР. 26)
  { id: 23, name: 'Зенит F1 Монарх', rarity: 'legendary', cost: 35000, pcost: 7000, lvl: 26, shape: 'hyper',
    body: '#00f0ff', roof: '#030b14', glass: '#bff5ff', acc: '#ff00aa',
    wing: 3, nose: 1, stripe: 1, stripeColor: '#ff00aa', underglow: '#ff00aa', roofScoop: 1, diffuser: 2, splitter: 2,
    boost: 2.25, shieldStart: 16, magnet: 2.00, tag: 'АБСОЛЮТНАЯ ЛЕГЕНДА ФОРМУЛЫ 1', perk: 'ghost' },

  // 25. Плазменный Форсаж (Эпическая, УР. 27)
  { id: 24, name: 'Плазменный Форсаж', rarity: 'epic', cost: 34000, pcost: 6800, lvl: 27, shape: 'hyper',
    body: '#ec4899', roof: '#500724', glass: '#fce7f3', acc: '#06b6d4',
    roofScoop: 1, canards: 1, wing: 5, underglow: '#ec4899', stripe: 1, stripeColor: '#06b6d4',
    boost: 2.05, shieldStart: 14, magnet: 2.00, tag: 'Плазменные инжекторы нитро', perk: 'boostmaster' },

  // 26. Кибер Спидстер (Эпическая, УР. 28)
  { id: 25, name: 'Кибер Спидстер', rarity: 'epic', cost: 37000, pcost: 7400, lvl: 28, shape: 'speedster',
    body: '#14b8a6', roof: '#042f2e', glass: '#ccfbf1', acc: '#f43f5e',
    splitter: 2, underglow: '#14b8a6', wing: 2, cyberFin: true, headlights: 'laser',
    boost: 2.08, shieldStart: 12, magnet: 1.95, tag: 'Аэродинамический открытый болид', perk: 'collector' },

  // 27. Инферно RS (Легендарная, УР. 29)
  { id: 26, name: 'Инферно RS', rarity: 'legendary', cost: 41000, pcost: 8200, lvl: 29, shape: 'racer',
    body: '#dc2626', roof: '#450a0a', glass: '#fee2e2', acc: '#fbbf24',
    nose: 1, wing: 3, sideExhaust: 1, underglow: '#ef4444', diffuser: 2, splitter: 2,
    boost: 2.30, shieldStart: 18, magnet: 2.15, tag: 'Легенда трека с адским нитро', perk: 'warp' },

  // 28. Галактический Рейсер (Легендарная, УР. 29)
  { id: 27, name: 'Галактический Рейсер', rarity: 'legendary', cost: 45000, pcost: 9000, lvl: 29, shape: 'hyper',
    body: '#8b5cf6', roof: '#2e1065', glass: '#ede9fe', acc: '#00f5ff',
    roofScoop: 1, wing: 5, canards: 1, underglow: '#8b5cf6', cyberFin: true, diffuser: 2,
    boost: 2.35, shieldStart: 20, magnet: 2.25, tag: 'Антигравитационный корпус будущего', perk: 'hyperdrive' },

  // 29. Хроно Монолит (Легендарная, УР. 30)
  { id: 28, name: 'Хроно Монолит', rarity: 'legendary', cost: 49000, pcost: 9800, lvl: 30, shape: 'muscle',
    body: '#64748b', roof: '#0f172a', glass: '#f1f5f9', acc: '#38bdf8',
    blower: 2, widebody: 1, underglow: '#38bdf8', wing: 4, rails: 1, diffuser: 2,
    boost: 2.20, shieldStart: 26, magnet: 2.30, tag: 'Титановый монолит времени', perk: 'specter' },

  // 30. Омега Прототип (Легендарная, УР. 30)
  { id: 29, name: 'Омега Прототип', rarity: 'legendary', cost: 55000, pcost: 11000, lvl: 30, shape: 'hyper',
    body: '#facc15', roof: '#172554', glass: '#ffffff', acc: '#ec4899',
    nose: 1, wing: 5, roofScoop: 1, underglow: '#facc15', stripe: 2, stripeColor: '#ec4899', diffuser: 2, splitter: 2,
    boost: 2.45, shieldStart: 22, magnet: 2.40, tag: 'ВЕРШИНА ИНЖЕНЕРНОЙ МЫСЛИ 2099', perk: 'apex' }
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
    const base = 120 + curLvl * 90;
    const tierMul = car.rarity === 'legendary' ? 2.0 : (car.rarity === 'epic' ? 1.5 : (car.rarity === 'rare' ? 1.2 : 1.0));
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
  scrOver: $('#scrOver'), scrRevive: $('#scrRevive')
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

function moveLane(d) {
  if (!G.running || G.paused) return;
  const n = Math.max(0, Math.min(2, G.lane + d));
  if (n !== G.lane) { G.lane = n; G.tilt = d * .5; Sound.blip(500 + n * 130, .05, 'triangle', .13); lessonEvent('lane'); }
}
function jump() {
  if (!G.running || G.paused) return;
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
    if (extra < .3) k = KIND.NITRO; else if (extra < .55) k = KIND.SH; else if (extra < .64) k = KIND.MAG;
    if (k && portalLane < 0) addObj(k, open, z + 5);
  }
  if (portalLane >= 0) return;
  // boʼsh yoʼlakka mukofot
  const luck = G.luck ? .12 : 0;
  const rr = Math.random();
  if (rr < .62 - luck) { const n = 4 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) addObj(KIND.COIN, open, z + i * 2.2); }
  else if (rr < .78 - luck) addObj(KIND.NITRO, open, z);
  else if (rr < .88 - luck) addObj(KIND.SH, open, z);
  else if (rr < .905 - luck) addObj(KIND.MAG, open, z);
  else if (lv >= 2) addObj(KIND.LIFE, open, z);
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
    sky0: '#180424', sky1: '#3d0d38', sky2: '#781c3e',
    sun0: '#fff3b0', sun1: '#ff5c47', sun2: '#8c1650',
    road: 'rgba(36,18,48,0.86)', roadAlt: 'rgba(48,24,62,0.86)',
    neon: '#d946ef', curbc: '#fbbf24', sil: '#14041c',
    gnd0: '#260a36', gnd1: '#0a0110', star: '#fed7aa'
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
    name: 'БИОСФЕРА БУДУЩЕГО',
    props: 'bio',
    sky0: '#011610', sky1: '#042e1e', sky2: '#0a5a3c',
    sun0: '#ecfdf5', sun1: '#34d399', sun2: '#059669',
    road: 'rgba(10,34,24,0.88)', roadAlt: 'rgba(16,46,34,0.88)',
    neon: '#10b981', curbc: '#6ee7b7', sil: '#02160d',
    gnd0: '#083824', gnd1: '#010f08', star: '#d1fae5'
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
    road: 'rgba(20,10,40,0.92)', roadAlt: 'rgba(32,16,58,0.92)',
    neon: '#00f5ff', curbc: '#ec4899', sil: '#090118',
    gnd0: '#1c0836', gnd1: '#04000c', star: '#ffffff'
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
}

/* --------------------------- RUN --------------------------- */
function bankCoins() { store.set('coins', G.coins); }

function enterDimension(dimIdx) {
  const dim = DIMENSIONS[dimIdx] || DIMENSIONS[0];
  G.inDimension = true;
  G.dimensionIdx = dimIdx;
  G.dimensionTime = 45.0;
  G.portalEntryAnim = 0.85;
  G.flash = 0.95;
  G.shake = 0.8;
  G.meta.portalsEntered = (G.meta.portalsEntered || 0) + 1;
  store.set('meta', G.meta);
  Sound.chord([440, 660, 880, 1320], 0.7, 0.28);
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
  G.flash = 0.85;
  G.shake = 0.6;
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
    invul: 1.2, coinMult: 1, comboHold: 3.4, combo: 1, comboT: 0, jumpV: 1, smashBonus: 0, brakePow: 0,
    lane: 1, laneX: 0, x: 0, y: 0, vy: 0, onGround: true, tilt: 0, yaw: 0, runCoins: 0,
    objs: [], parts: [], texts: [], nearMisses: 0, coinStreak: 0, spawnGap: 15, shake: 0, flash: 0, upgrades: {}, revived: false,
    trackIdx: -1, prevTrackIdx: null, trackT: 0, trans: 99,
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
    bossTimer: 0,
    bossDist: 20,
    bossZ: 20,
    bossX: 0,
    bossLane: 1,
    bossName: '',
    nextBossAt: 2200,
    bossEscaped: 0,
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
  G.running = false; G.over = true; G.paused = false; setHint(-1);
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
      const item = mSt[m.id] || { cur: 0, done: false, claimed: false };
      const val = m.getVal ? m.getVal() : 0;
      item.cur = Math.max(item.cur || 0, val);
      if (item.cur >= m.goal) item.done = true;
      mSt[m.id] = item;
    });
    setMissionState(mSt);
  }
  if (typeof getAchieveState === 'function') {
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
  $('#cardList').innerHTML = picks.map((u, i) =>
    '<div class="upg ' + (u.rare ? 'rare' : '') + '" data-k="' + u.k + '">' +
    '<div class="lv">' + (u.rare ? '✦ РЕДКОЕ' : 'ОБЫЧНОЕ') + '</div>' +
    '<div class="ic">' + u.ic + '</div><b>' + u.name + '</b>' +
    '<div class="amt">' + (u.amt || '') + '</div>' +
    '<p>' + u.p + '</p>' +
    '<div class="rk">' + (G.upgrades[u.k] | 0) + ' / ' + u.max + '</div></div>').join('');
  show(el.scrCards);
  $('#cardList').querySelectorAll('.upg').forEach(n => n.addEventListener('click', () => pickCard(n.dataset.k)));
  Sound.chord([440, 660, 880], .3, .11);
}
function pickCard(k) {
  const u = UPGRADES.find(x => x.k === k); if (!u) return;
  G.upgrades[k] = (G.upgrades[k] || 0) + 1;
  try { u.fn(); } catch {}
  hide(el.scrCards); G.paused = false;
  toast(u.ic + ' ' + u.name + ' усилено');
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
  if (spdStr !== _hudCache.speed) { _hudCache.speed = spdStr; el.speed.innerHTML = spdStr; }
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

  // Boss Chase System
  if (!G.inDimension && !G.bossActive && G.dist >= (G.nextBossAt || 2200)) {
    G.bossActive = true;
    G.bossTimer = 22.0;
    G.bossDist = 20.0;
    G.bossZ = 20.0;
    G.bossX = LANES[1];
    G.bossLane = 1;
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
    G.flash = 0.6; G.shake = 0.5;
  }
  if (G.bossActive) {
    if (!G.paused) {
      G.bossTimer -= dt;
      if (Math.random() < 0.02) G.bossLane = Math.floor(Math.random() * 3);
      const targetBossX = LANES[G.bossLane];
      G.bossX += (targetBossX - G.bossX) * Math.min(1, dt * 3.5);

      if (G.speed > 26 || G.boostOn) G.bossDist = Math.min(32, G.bossDist + dt * 2.8);
      else if (G.speed < 22) G.bossDist = Math.max(5, G.bossDist - dt * 2.2);

      G.bossZ = G.bossDist;

      const bh = el._bossHud || (el._bossHud = $('#bossHud'));
      if (bh) {
        bh.classList.remove('hidden');
        const bTitle = $('#bossTitle'), bSub = $('#bossSub'), bBar = $('#bossBar');
        if (bTitle) bTitle.textContent = '🚨 БОСС-ПОГОНЯ: ' + G.bossName;
        if (bSub) bSub.textContent = 'ДИСТАНЦИЯ: ' + Math.round(G.bossDist) + ' М · ВРЕМЯ: ' + Math.ceil(G.bossTimer) + ' С';
        if (bBar) bBar.style.width = Math.max(0, Math.min(100, (G.bossDist / 28) * 100)) + '%';
      }

      if (G.bossTimer <= 0 || G.bossDist >= 28) {
        G.bossActive = false;
        if (bh) bh.classList.add('hidden');
        G.bossEscaped = (G.bossEscaped || 0) + 1;
        G.runBossEscaped = (G.runBossEscaped || 0) + 1;
        G.meta.bossEscapes = (G.meta.bossEscapes || 0) + 1;
        const rCoins = 250, rPts = 100, rScore = 5000;
        G.coins += rCoins; G.runCoins += rCoins; ACCT.add(rPts); G.score += rScore;
        bankCoins(); store.set('meta', G.meta);
        Sound.chord([523, 659, 784, 1046], .5, .25);
        toast('🏆 ПОБЕГ УСПЕШЕН! Награда: +' + rCoins + ' 🪙, +' + rPts + ' ⭐, +' + rScore + ' очков!', 4000);
        addFloatingText(G.x, 2.3, 0, '🏆 ПОБЕГ УСПЕШЕН! +250 🪙', '#ffd166');
        burst(G.bossX, 1.2, G.bossZ, 25, '#ffd166', 1.5);
        G.nextBossAt = G.dist + 2800;
        G.flash = 0.6;
      } else if (G.bossDist <= 5.5 && Math.abs(G.bossX - G.x) < 0.9 && G.invul <= 0) {
        G.lives--;
        G.invul = 2.0;
        G.shake = 0.8;
        G.bossDist = 14.0;
        Sound.noise(.4, .3);
        toast('💥 СТОЛКНОВЕНИЕ С БОССОМ! Потеряна жизнь!', 2000);
        renderLives();
        if (G.lives <= 0) maybeRevive();
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
  G.shield = Math.max(0, G.shield - dt);
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
      const magRad = 12 + (G.magnetRadiusBonus || 0);
      if (dd < magRad && o.z > 0) { o.x += ddx * dt * 5.5; o.z -= dt * 7; }
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
          G.shield = 0; G.shieldRipple = 1.0; o.dead = true; bumpCombo(-1); G.invul = .9;
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
      } else if (o.kind === KIND.NITRO) {
        G.energon = Math.min(G.energonMax, G.energon + 55); G.nitroT = Math.max(G.nitroT, 2.4);
        G.nitroAnim = 1.0;
        burst(o.x, 1, o.z, 14, '#00e5ff', 1.3);
        burst(o.x, 1.05, o.z, 4, '#ffffff', 1.0);
        Sound.chord([700, 1000], .22, .16); toast('⚡ НИТРО!');
        addFloatingText(o.x, 1.4, o.z, '⚡ УСКОРЕНИЕ НИТРО', '#00e5ff');
        lessonEvent('nitro');
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
      } else if (o.kind === KIND.LIFE) {
        G.lives = Math.min(G.maxLives, G.lives + 1); renderLives();
        Sound.chord([660, 880, 1100], .3, .18); toast('❤ +1 жизнь');
        addFloatingText(o.x, 1.4, o.z, '❤ +1 ЖИЗНЬ', '#ff7ab8');
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
const UIFONT = '"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif';
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
function rgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
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
    for (const b of (G.buildings || [])) {
      const bx = b.x * W + bpar, bw = b.w * W, bh = b.h * H * (type === 'grid' ? .8 : 1), by = horizon - bh;
      if (type === 'grid') {
        // Kiber matritsa — neon kontur va pulsatsiyalanuvchi to'r
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
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      // Baland osmono'par binolar uchun kaskadli toj (Tiered stepped setback)
      if (bh > H * 0.12) {
        const tw = bw * 0.6, th = bh * 0.22, tx = bx + bw * 0.2, ty = by - th;
        ctx.fillRect(tx, ty, tw, th);
        ctx.strokeRect(tx, ty, tw, th);
      }
      
      // Dinamik miltillovchi kiber derazalar
      const ww = bw / 4, wh = Math.max(2, bh / 9);
      for (const wpos of b.wins) {
        const pulse = Math.sin(G.t * 3.2 + wpos[0] * 3.1 + wpos[1] * 2.2 + b.x * 18);
        if (pulse > -0.2) {
          ctx.fillStyle = pulse > 0.65 ? (bm.curbc || '#ffffff') : (wpos[0] === 1 ? '#ffe08a' : bm.neon);
          ctx.globalAlpha = 0.35 + 0.55 * Math.max(0, pulse);
          ctx.fillRect(bx + ww * (wpos[0] + .4), by + wh * (wpos[1] + 1.2), ww * .5, wh * .6);
        }
      }
      ctx.globalAlpha = 1;

      // Bino tomidagi gologramma reklama lavhasi (Holographic rooftop billboard)
      if (b.beacon && bh > H * 0.09) {
        const signW = Math.min(bw * 0.82, 38);
        if (signW > 18) {
          const signH = 9;
          const signX = bx + (bw - signW) * 0.5;
          const signY = by - (bh > H * 0.12 ? bh * 0.22 : 0) - signH - 3;
          const signText = b.x < 0.25 ? 'CYBER' : (b.x < 0.55 ? 'NEON' : (b.x < 0.8 ? '2099' : 'METRO'));
          ctx.fillStyle = 'rgba(6, 7, 20, 0.90)';
          ctx.fillRect(signX, signY, signW, signH);
          ctx.strokeStyle = rgba(b.x > 0.5 ? bm.neon : (bm.curbc || '#ff2fb9'), 0.85);
          ctx.lineWidth = 1;
          ctx.strokeRect(signX, signY, signW, signH);
          ctx.fillStyle = b.x > 0.5 ? bm.neon : (bm.curbc || '#ff2fb9');
          ctx.font = 'bold 7px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(signText, signX + signW * 0.5, signY + signH * 0.5);
          ctx.textAlign = 'left';
        }
      }

      // Bino tomidagi animatsiyali mayoq va radio-antennalar
      if (b.beacon && bh > H * 0.08) {
        const beaconY = by - (bh > H * 0.12 ? bh * 0.22 : 0) - 10;
        ctx.strokeStyle = rgba(bm.neon, 0.65);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(bx + bw * 0.5, by); ctx.lineTo(bx + bw * 0.5, beaconY); ctx.stroke();
        const bFlash = Math.sin(G.t * 6.5 + b.x * 32);
        if (bFlash > 0.15) {
          ctx.fillStyle = bFlash > 0.7 ? '#ffffff' : (b.x > 0.5 ? '#ff2b43' : (bm.curbc || '#00e5ff'));
          ctx.beginPath(); ctx.arc(bx + bw * 0.5, beaconY, 2.2, 0, Math.PI * 2); ctx.fill();
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
      // Kiber-Zavod va Magma (Cyber Factory: industrial smokestacks, cooling towers, magma craters)
      if (s.k < 0.42) {
        // 1) Sanoat zavod quvuri / mo'ri (Industrial exhaust smokestack & pilot flare)
        const sw = Math.max(5, w * 0.28), sh = h * 1.25, sx = x + w * 0.5 - sw / 2;
        ctx.fillRect(sx, y - sh, sw, sh);
        ctx.strokeRect(sx, y - sh, sw, sh);
        // Texnik xavfsizlik maydonchasi (Catwalk gantry ring)
        ctx.fillStyle = rgba(bm.curbc || '#fbbf24', 0.65);
        ctx.fillRect(sx - 3, y - sh * 0.6, sw + 6, 2.5);
        // Mo'ri tepasidagi pulsatsiyalanuvchi avia-mayoq (Hazard red strobe beacon)
        const strobe = Math.sin(G.t * 8.5 + s.a * 15);
        if (strobe > 0.2) {
          ctx.fillStyle = strobe > 0.7 ? '#ffffff' : '#ff2200';
          ctx.beginPath();
          ctx.arc(sx + sw * 0.5, y - sh - 3, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        // Olovli mash'ala alangasi (Venting pilot flame)
        const flameH = 8 + Math.sin(G.t * 14 + s.a) * 6;
        ctx.fillStyle = '#ff7700';
        ctx.beginPath();
        ctx.moveTo(sx, y - sh);
        ctx.lineTo(sx + sw * 0.5, y - sh - flameH);
        ctx.lineTo(sx + sw, y - sh);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = sil;
      } else if (s.k < 0.72) {
        // 2) Sovitish minorasi va sanoat kompleksi (Industrial cooling tower)
        const tw = w * 1.1, th = h * 0.95, tx = x + w * 0.5 - tw / 2;
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.quadraticCurveTo(tx + tw * 0.2, y - th * 0.5, tx + tw * 0.15, y - th);
        ctx.lineTo(tx + tw * 0.85, y - th);
        ctx.quadraticCurveTo(tx + tw * 0.8, y - th * 0.5, tx + tw, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(bm.neon, 0.45);
        ctx.stroke();
        // Sariq ogohlantirish chizig'i (Warning stripe)
        ctx.fillStyle = rgba(bm.curbc || '#fbbf24', 0.4);
        ctx.fillRect(tx + tw * 0.2, y - th * 0.45, tw * 0.6, 2.5);
        ctx.fillStyle = sil;
      } else {
        // 3) Magma vulqon krateri (Volcanic caldera & boiling magma pool)
        const lavaPulse = 0.5 + 0.5 * Math.sin(G.t * 3.6 + s.a);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w * 0.28, y - h * 0.82);
        ctx.lineTo(x + w * 0.72, y - h * 0.82);
        ctx.lineTo(x + w, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Qaynayotgan magma ko'li (Boiling magma pool)
        ctx.fillStyle = rgba('#ff4500', 0.85 + lavaPulse * 0.15);
        ctx.fillRect(x + w * 0.28, y - h * 0.88, w * 0.44, Math.max(2, h * 0.08));
        ctx.fillStyle = bm.sun0 || '#fef08a';
        ctx.globalAlpha = 0.35 + 0.45 * lavaPulse;
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y - h * 0.88, w * (0.35 + lavaPulse * 0.18), Math.PI, 0);
        ctx.fill();
        // Kraterdan ko'tarilayotgan uchqun
        const sparkY = y - h * .88 - ((G.t * 26 + s.a * 32) % (h * 0.5));
        ctx.fillStyle = '#ffe066';
        ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.arc(x + w * .5 + Math.sin(G.t * 4 + s.a) * 4, sparkY, 1.8, 0, Math.PI * 2); ctx.fill();
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
      // Biosfera (Alien Forest: bioluminescent plants, undulating fungal canopies, glowing bulbs)
      const sway = Math.sin(G.t * 2.2 + s.a) * (w * 0.18);
      const cx0 = x + w * 0.5;
      if (s.k < 0.55) {
        // 1) Gigant biolyuminestsent qo'ziqorin daraxti (Giant alien fungal tree)
        ctx.beginPath();
        ctx.moveTo(cx0 - 3.5, y);
        ctx.quadraticCurveTo(cx0 - 2 + sway * 0.5, y - h * 0.45, cx0 - 2 + sway, y - h * 0.9);
        ctx.lineTo(cx0 + 2 + sway, y - h * 0.9);
        ctx.quadraticCurveTo(cx0 + 2 + sway * 0.5, y - h * 0.45, cx0 + 3.5, y);
        ctx.closePath();
        ctx.fill();
        // Qo'ziqorin soyaboni (Mushroom bioluminescent canopy)
        const bioPulse = 0.7 + 0.3 * Math.sin(G.t * 2.8 + s.a);
        ctx.fillStyle = rgba(bm.neon || '#10b981', bioPulse);
        ctx.beginPath();
        ctx.ellipse(cx0 + sway, y - h * 0.95, w * 0.52, h * 0.28, sway * 0.05, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        // Pastki biolyuminestsent to'r nuri
        ctx.fillStyle = rgba(bm.curbc || '#6ee7b7', 0.65);
        ctx.beginPath();
        ctx.ellipse(cx0 + sway, y - h * 0.95, w * 0.45, h * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
        // Osilib turgan nurli spora tomchilari (Dripping bio-light droplets)
        for (let sp = -1; sp <= 1; sp += 0.8) {
          const dropY = y - h * 0.92 + Math.sin(G.t * 3.5 + s.a + sp) * 6 + 6;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx0 + sway + sp * w * 0.32, dropY, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = sil;
      } else {
        // 2) Spiral biolyuminestsent poya va energiya g'unchasi (Spore tendril & bulb)
        ctx.beginPath();
        ctx.moveTo(cx0 - 2, y);
        ctx.quadraticCurveTo(cx0 + sway * 1.2, y - h * 0.6, cx0 + sway * 0.5, y - h * 1.15);
        ctx.lineTo(cx0 + 2 + sway * 0.5, y - h * 1.15);
        ctx.quadraticCurveTo(cx0 + 2 + sway * 1.2, y - h * 0.6, cx0 + 2, y);
        ctx.closePath();
        ctx.fill();
        // Yorqin energetik g'uncha (Glowing bulb apex)
        const pulse2 = 0.6 + 0.4 * Math.cos(G.t * 3.2 + s.a);
        ctx.fillStyle = bm.curbc || '#6ee7b7';
        ctx.globalAlpha = pulse2;
        ctx.beginPath();
        ctx.arc(cx0 + sway * 0.5, y - h * 1.18, w * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx0 + sway * 0.5, y - h * 1.18, w * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = sil;
      }
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
    { yFrac: 0.28, speed: 65, dir: 1, len: 18, h: 3.2, col: '#ff2b43', head: '#00e5ff' },
    { yFrac: 0.18, speed: 45, dir: -1, len: 15, h: 2.6, col: '#ff2fb9', head: '#ffe08a' },
    { yFrac: 0.36, speed: 85, dir: 1, len: 22, h: 3.8, col: '#ff2b43', head: '#ffffff' },
    { yFrac: 0.12, speed: 38, dir: -1, len: 13, h: 2.2, col: '#00e5ff', head: '#ffffff' }
  ];
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    const y = horizon - H * c.yFrac;
    const span = W + 160;
    const tShift = G.t * c.speed + i * 290;
    const x = c.dir > 0 ? (tShift % span) - 80 : W + 80 - (tShift % span);
    
    // Trailing light streak
    const tg = ctx.createLinearGradient(x - c.dir * c.len * 2.2, y, x, y);
    tg.addColorStop(0, 'rgba(0,0,0,0)');
    tg.addColorStop(0.7, rgba(c.col, 0.45));
    tg.addColorStop(1, rgba(c.col, 0.95));
    ctx.strokeStyle = tg;
    ctx.lineWidth = c.h;
    ctx.beginPath();
    ctx.moveTo(x - c.dir * c.len * 2.2, y);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Sleek chassis
    ctx.fillStyle = 'rgba(8, 12, 24, 0.92)';
    ctx.fillRect(x - c.len / 2, y - c.h / 2, c.len, c.h);

    // Headlight glow
    ctx.fillStyle = c.head;
    ctx.beginPath();
    ctx.arc(x + c.dir * (c.len / 2 + 1), y, c.h * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Taillight dot
    ctx.fillStyle = c.col;
    ctx.beginPath();
    ctx.arc(x - c.dir * (c.len / 2), y, c.h * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Dinamik Shimol yog'dusi (Aurora Borealis) — ko'p qavatli va vertikal nurlanish bilan */
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
  const sunPulse = 1 + Math.sin(G.t * 2.2) * 0.035;
  const sunR = H * .175 * sunPulse;
  const sunX = cx - CAM.x * 24;
  const sunY = horizon - sunR * .55;
  const type = bm.props || 'city';

  // Tashqi neon korona nurlanishi
  ctx.save();
  const coronaGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.65, sunX, sunY, sunR * 1.55);
  coronaGrad.addColorStop(0, rgba(bm.sun1 || bm.neon, 0.46));
  coronaGrad.addColorStop(0.55, rgba(bm.sun2 || bm.neon, 0.18));
  coronaGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = coronaGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 1.55, 0, Math.PI * 2);
  ctx.fill();

  // Biomga xos quyosh xususiyatlari:
  if (type === 'lava' || (G.inDimension && G.dimensionIdx === 4)) {
    // Vulqon/Sanoat: Quyosh tojidan otiluvchi plazma nurlar va chaqnashlar
    ctx.strokeStyle = rgba(bm.sun0 || '#ff5500', 0.65);
    ctx.lineWidth = 2.6;
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
  } else if (type === 'ice') {
    // Qutb nuri / Parhelion krio-halqasi (Frost halo ring + 4 sun dogs)
    ctx.strokeStyle = rgba(bm.neon || '#38bdf8', 0.38);
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.35, 0, Math.PI * 2);
    ctx.stroke();
    // 4 Parhelion olmos chaqnashlari
    for (let d = 0; d < 4; d++) {
      const da = d * (Math.PI / 2);
      const dx = sunX + Math.cos(da) * sunR * 1.35;
      const dy = sunY + Math.sin(da) * sunR * 1.35;
      const dPulse = 0.5 + 0.5 * Math.sin(G.t * 3.5 + d * 1.5);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dx, dy, 2.5 * dPulse, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'bio') {
    // Tirik biosfera toji (Living coronal filaments)
    ctx.strokeStyle = rgba(bm.neon || '#10b981', 0.42);
    ctx.lineWidth = 2.0;
    for (let b = 0; b < 7; b++) {
      const ba = G.t * 0.45 + b * (Math.PI * 2 / 7);
      const blen = sunR * (1.20 + 0.18 * Math.sin(G.t * 3.2 + b));
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(ba) * sunR, sunY + Math.sin(ba) * sunR);
      ctx.lineTo(sunX + Math.cos(ba) * blen, sunY + Math.sin(ba) * blen);
      ctx.stroke();
    }
  } else if (type === 'cosmic') {
    // Singulyarlik relyativistik akkresiya diski (Relativistic accretion disk)
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(-0.28);
    ctx.strokeStyle = rgba(bm.curbc || '#ec4899', 0.55);
    ctx.lineWidth = sunR * 0.18;
    ctx.beginPath();
    ctx.ellipse(0, 0, sunR * 1.70, sunR * 0.40, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba(bm.neon || '#00f5ff', 0.35);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, sunR * 1.88, sunR * 0.46, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (type === 'crystal') {
    // Yonayotgan cho'l quyosh chaqnashi
    ctx.strokeStyle = rgba(bm.curbc || '#fbbf24', 0.35);
    ctx.lineWidth = 1.6;
    for (let c = 0; c < 8; c++) {
      const ca = c * (Math.PI / 4) + G.t * 0.2;
      const clen = sunR * (1.15 + 0.15 * Math.sin(G.t * 2.8 + c));
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(ca) * sunR, sunY + Math.sin(ca) * sunR);
      ctx.lineTo(sunX + Math.cos(ca) * clen, sunY + Math.sin(ca) * clen);
      ctx.stroke();
    }
  }

  // Quyoshning asosiy tanasi
  const sunGrad = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
  sunGrad.addColorStop(0, bm.sun0 || '#ffe08a');
  sunGrad.addColorStop(0.5, bm.sun1 || '#ff2fb9');
  sunGrad.addColorStop(1, bm.sun2 || '#6d1fa0');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Retro synthwave gorizontal qora skan-chiziqlar (Pastki yarmi)
  const lines = 7;
  ctx.fillStyle = bm.sky2 || '#180b3c';
  for (let i = 1; i <= lines; i++) {
    const ph = i / (lines + 1);
    const ly = sunY + sunR * (0.05 + ph * 0.90);
    const lh = Math.max(1.4, H * 0.007 * (1 + ph * 1.4));
    const chord = Math.sqrt(Math.max(0, sunR * sunR - Math.pow(ly - sunY, 2)));
    if (chord > 2) ctx.fillRect(sunX - chord, ly - lh / 2, chord * 2, lh);
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
  }
  ctx.restore();
}

/** Asosiy orqa fon va dinamik ufq manzarasi */
function drawBackdrop() {
  const bm = currentBiome();
  const horizon = cy;
  const type = bm.props || 'city';
  const isGravAnomaly = G.inDimension && G.dimensionIdx === 5;

  // 1) Dinamik osmon gradienti
  const sg = ctx.createLinearGradient(0, 0, 0, horizon);
  sg.addColorStop(0, bm.sky0);
  sg.addColorStop(0.5, bm.sky1);
  sg.addColorStop(1, bm.sky2);
  ctx.fillStyle = sg;
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

  // 3) Yulduzlar (pulsatsiyalanuvchi nurlanish va miltillash)
  ctx.save();
  ctx.fillStyle = bm.star || '#dfeaff';
  for (const s of G.stars) {
    ctx.globalAlpha = (.35 + .65 * Math.abs(Math.sin(G.t * 1.6 + s.tw))) * .85;
    ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
  }
  ctx.restore();

  // 4) Shimol yog'dusi / Kiber-aurora (muz, kosmik, biosfera yoki o'lchamlarda)
  if (type === 'ice' || type === 'cosmic' || type === 'bio' || G.inDimension) {
    drawAurora(bm, horizon);
  }

  // 5) Shahar kiber-projektorlari va uchar mashinalar trafigi
  if (type === 'city' || type === 'grid' || (G.inDimension && G.dimensionIdx === 3)) {
    drawSkySearchlights(bm, horizon);
    drawSkyTraffic(bm, horizon);
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

  // 9) Uzoq tog'lar (neon qirra to'lqini bilan)
  const par = -CAM.x * 8;
  ctx.save();
  ctx.globalAlpha = .62;
  ctx.fillStyle = bm.sky1;
  ctx.beginPath(); ctx.moveTo(0, horizon + 2);
  for (const m of G.mountains) {
    const mx = m.x * W + par, mw = m.w * W, mh = m.h * H;
    ctx.lineTo(mx, horizon); ctx.lineTo(mx + mw / 2, horizon - mh); ctx.lineTo(mx + mw, horizon);
  }
  ctx.lineTo(W + 40, horizon); ctx.lineTo(W + 40, horizon + 30); ctx.lineTo(0, horizon + 30);
  ctx.closePath(); ctx.fill();

  // Tog' cho'qqilari bo'ylab oquvchi neon nur to'lqini
  const crestPulse = 0.22 + 0.16 * Math.sin(G.t * 2.4);
  ctx.strokeStyle = rgba(bm.neon, crestPulse);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Lava biomi uchun: tog' yonbag'irlari bo'ylab oquvchi magma daryolari
  if (type === 'lava' || type === 'volcano') {
    const mPulse = 0.65 + 0.35 * Math.sin(G.t * 4);
    ctx.lineWidth = 1.6;
    for (const m of G.mountains) {
      const mx = m.x * W + par, mw = m.w * W, mh = m.h * H;
      const peakX = mx + mw / 2, peakY = horizon - mh;
      ctx.strokeStyle = rgba('#ff6600', mPulse * 0.85);
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
  }
  ctx.restore();

  // 10) Biom atmosfera zarrachalari (qor, uchqun, chang, spora)
  drawBiomeParticles(bm, horizon);

  // 11) Yon manzara (har yo'l o'z animatsiyali manzarasi)
  const bpar = -CAM.x * 14;
  drawSilhouette(bm, horizon, bpar);

  // 12) Yer gradienti
  const gnd = ctx.createLinearGradient(0, horizon, 0, H);
  gnd.addColorStop(0, bm.gnd0 || '#100a26'); gnd.addColorStop(1, bm.gnd1 || '#03030a');
  ctx.fillStyle = gnd; ctx.fillRect(0, horizon, W, H - horizon);

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

  ctx.font = '900 ' + fs + 'px system-ui, "Segoe UI", Arial';
  if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(fs * 0.07) + 'px';
  const wMain = ctx.measureText(name).width;
  ctx.font = '900 ' + sm + 'px system-ui, "Segoe UI", Arial';
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
  ctx.font = '900 ' + sm + 'px system-ui, "Segoe UI", Arial';
  ctx.fillStyle = rgba(bm.sun0 || '#ffd166', 1);
  ctx.shadowColor = rgba(bm.sun0 || '#ffd166', 0.8); ctx.shadowBlur = 8;
  ctx.fillText(lab, 0, -ph2 * 0.30);

  // Matnlar: Asosiy Biom Nomi
  ctx.font = '900 ' + fs + 'px system-ui, "Segoe UI", Arial';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = rgba(bm.neon, 1); ctx.shadowBlur = fs * 0.85;
  ctx.fillText(name, 0, ph2 * 0.03);

  // Matnlar: Qiyinlik va Yulduzlar
  ctx.shadowBlur = 0;
  ctx.font = '900 ' + sm + 'px system-ui, "Segoe UI", Arial';
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

function drawRoad() {
  const bm = currentBiome();
  const type = bm.props || 'city';
  const segs = G.quality === 'low' ? 28 : (G.quality === 'medium' ? 38 : 48);
  const step = 5, scroll = G.dist % (step * 2);
  let prev = null;
  for (let i = segs; i >= 0; i--) {
    const z = i * step - scroll + 2;
    proj([0, 0, z], _a);
    if (!_a.vis) { prev = null; continue; }
    const half = ROADH * _a.s;
    const row = { x: _a.x, y: _a.y, half, s: _a.s, z };
    if (prev) {
      const depth = 1 - Math.min(1, i / segs);
      const segIdx = Math.floor((G.dist - z) / step);
      const k = Math.floor((G.dist - z) / (step * 2)) % 2 === 0;

      // 1) Asosiy kiber-asfalt (Main dark futuristic asphalt quad)
      ctx.fillStyle = k ? (bm.road || '#15172b') : (bm.roadAlt || '#1c1f38');
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half, prev.y); ctx.lineTo(prev.x + prev.half, prev.y);
      ctx.lineTo(row.x + row.half, row.y); ctx.lineTo(row.x - row.half, row.y);
      ctx.closePath(); ctx.fill();

      // 2) Bo'ylama protektor yo'llari va yuzadagi mikro-tekstura (Tire track groove depth)
      if (depth > 0.06) {
        ctx.fillStyle = 'rgba(5, 7, 14, ' + (0.24 * depth) + ')';
        for (const laneIdx of [0, 1, 2]) {
          const lx = LANES[laneIdx];
          for (const tx of [-0.44, 0.44]) {
            const gx = lx + tx;
            const p1x = prev.x + gx * prev.s;
            const gw = Math.max(0.9, 2.4 * depth);
            ctx.fillRect(p1x - gw / 2, prev.y, gw, Math.max(1, row.y - prev.y + 0.5));
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
          // Neon tashqi halqa (Outer neon glow stripe)
          ctx.strokeStyle = rgba(bm.neon || '#00e5ff', 0.45 * depth + 0.18);
          ctx.lineWidth = Math.max(1.6, 4.4 * depth);
          ctx.beginPath();
          ctx.moveTo(prev.x + lx * prev.s, prev.y); ctx.lineTo(row.x + lx * row.s, row.y);
          ctx.stroke();

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
          // Kiber-ustunlar va ko'ndalang lazer nuri
          ctx.fillStyle = rgba(bm.neon || '#ff2fb9', 0.3 + depth * 0.7);
          ctx.fillRect(lx, py - ph * 1.35, pw, ph * 1.35);
          ctx.fillRect(rx, py - ph * 1.35, pw, ph * 1.35);
          const nodeY = py - ph * 1.35 + ((G.t * 18 + segIdx * 5) % Math.max(1, ph * 1.2));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(lx - 0.5, nodeY, pw + 1, Math.max(1.5, 3 * depth));
          ctx.fillRect(rx - 0.5, nodeY, pw + 1, Math.max(1.5, 3 * depth));
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
    if (o.kind === KIND.LIFE) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.4, r * .18);
      ctx.beginPath(); ctx.moveTo(X, Y + r * .75); ctx.lineTo(X, Y + r * 1.25);
      ctx.moveTo(X - r * .25, Y + r); ctx.lineTo(X + r * .25, Y + r); ctx.stroke();
    }
    ctx.restore();
  }
}

/* --------------------------- 3-LANE PORTAL SYSTEM --------------------------- */
const PORTAL_LANE_THEMES = [
  // Lane 0: Electric Cyan Quantum Gate
  {
    col1: '#00f5ff',
    col2: '#38bdf8',
    col3: '#ffffff',
    colDark: 'rgba(0, 35, 55, 0.92)',
    name: 'КВАНТОВЫЙ КОРИДОР',
    icon: '⚡'
  },
  // Lane 1: Neon Violet Hyperspace Rift
  {
    col1: '#d946ef',
    col2: '#a855f7',
    col3: '#ffffff',
    colDark: 'rgba(38, 10, 58, 0.92)',
    name: 'ГИПЕРПРОСТРАНСТВО',
    icon: '🌀'
  },
  // Lane 2: Molten Solar Amber Plasma Gate
  {
    col1: '#ff6b35',
    col2: '#f59e0b',
    col3: '#ffffff',
    colDark: 'rgba(55, 20, 4, 0.92)',
    name: 'ПЛАЗМЕННЫЙ ШЛЮЗ',
    icon: '🔥'
  }
];

/** 3-Polosali O'lcham Portali — Faol Kirish Portali (`portal_active`):
    Intensiv aylanuvchi kvant girdobi, 3 xil rang dizayni (Sian / Binafsha / Olovrang),
    konsentrik aylanuvchi energiya halqalari, yo'l polosasi bo'ylab yuguruvchi strelkalar va chaqmoqlar */
function drawPortalActive(o) {
  if (o.z > 68 || o.z < -2) return;
  const l = (o.lane != null) ? o.lane : (o.x < -0.8 ? 0 : (o.x > 0.8 ? 2 : 1));
  const theme = PORTAL_LANE_THEMES[l] || PORTAL_LANE_THEMES[1];
  const validDimIdx = (o.targetDim >= 0 && o.targetDim < DIMENSIONS.length) ? o.targetDim : 0;
  const dim = DIMENSIONS[validDimIdx] || DIMENSIONS[0];
  const col1 = theme.col1;
  const col2 = dim.neon || theme.col2;
  const col3 = '#ffffff';

  // 1) Yo'l polosasi bo'ylab faol energiya yo'lagi (Intense energy runway)
  const trailLen = Math.min(28, Math.max(8, o.z));
  quad(o.x - 1.15, Math.max(0.5, o.z - trailLen), o.x + 1.15, o.z + 1.2, 0.02,
    rgba(col1, 0.28 + 0.16 * Math.sin(G.t * 8)), rgba(col2, 0.85));

  // Yo'l ustida portalga chorlovchi yuguruvchi strelkalar (Forward-moving entry chevrons)
  const chevSteps = G.quality === 'low' ? 3 : 5;
  for (let c = 0; c < chevSteps; c++) {
    const cz = o.z - ((G.t * 16 + c * (trailLen / chevSteps)) % trailLen);
    if (cz > 1.0 && cz < o.z - 0.8) {
      proj([o.x - 0.78, 0.04, cz], _a);
      proj([o.x, 0.04, cz + 1.2], _b);
      proj([o.x + 0.78, 0.04, cz], _c);
      if (_a.vis && _b.vis && _c.vis) {
        ctx.save();
        ctx.strokeStyle = c % 2 === 0 ? col1 : '#ffffff';
        ctx.lineWidth = Math.max(1.8, 3.8 * _b.s * 0.04);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(_a.x, _a.y); ctx.lineTo(_b.x, _b.y); ctx.lineTo(_c.x, _c.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // 2) Portal markazi va o'lchami (Yaqinlashgan sari energiya intensivligi ortadi)
  const prox = Math.max(0.4, Math.min(2.0, 2.0 - (o.z / 72) * 1.5));
  proj([o.x, 1.48, o.z], _a);
  if (!_a.vis) return;
  const rx = 1.22 * _a.s;
  const ry = 1.52 * _a.s;
  const cxP = _a.x, cyP = _a.y;

  ctx.save();
  // Tashqi dinamik neon aura nurlanishi
  if (G.quality !== 'low') {
    const aura = ctx.createRadialGradient(cxP, cyP, rx * 0.2, cxP, cyP, rx * 1.85 * prox);
    aura.addColorStop(0, rgba(col1, Math.min(0.88, 0.60 * prox)));
    aura.addColorStop(0.55, rgba(col2, Math.min(0.55, 0.32 * prox)));
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.ellipse(cxP, cyP, rx * 1.85 * prox, ry * 1.75 * prox, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Ichki kvant girdobi sirti (Swirling Vortex Surface)
  const coreGrad = ctx.createRadialGradient(cxP, cyP, 0, cxP, cyP, Math.max(rx, ry));
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.24, rgba(col3, 0.95));
  coreGrad.addColorStop(0.58, rgba(col1, 0.90));
  coreGrad.addColorStop(0.85, rgba(col2, 0.65));
  coreGrad.addColorStop(1, rgba(theme.colDark || '#000', 0.25));
  ctx.fillStyle = coreGrad;
  ctx.beginPath(); ctx.ellipse(cxP, cyP, rx * 0.94, ry * 0.94, 0, 0, Math.PI * 2); ctx.fill();

  // Aylanuvchi spiral energiya yoylari (Logarithmic Vortex Spiral Arms)
  const spinSpeed = 3.6 + prox * 2.8;
  const armCount = 3;
  ctx.save();
  ctx.translate(cxP, cyP);
  for (let a = 0; a < armCount; a++) {
    const armAng = G.t * spinSpeed + a * (Math.PI * 2 / armCount);
    ctx.strokeStyle = a === 0 ? '#ffffff' : rgba(col1, 0.85);
    ctx.lineWidth = Math.max(1.2, 2.8 * _a.s * 0.04);
    ctx.beginPath();
    for (let st = 0; st <= 8; st++) {
      const frac = st / 8;
      const rStep = frac * rx * 0.88;
      const thStep = armAng + frac * 2.2;
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
    const frac = 0.32 + (r / ringCount) * 0.65;
    const rot = G.t * (r % 2 === 0 ? 3.8 : -3.2) * prox + r * 1.3;
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

  // Ichkariga so'riluvchi nazorat qilingan kvant zarrachalar (Controlled Inward-Swirling Particles)
  const sparkCount = G.quality === 'low' ? 5 : 8;
  for (let s = 0; s < sparkCount; s++) {
    const spPhase = ((G.t * (1.2 + s * 0.18) + s * 0.37) % 1);
    const spAng = G.t * (3.0 + s * 0.5) + s * (Math.PI * 2 / sparkCount);
    const spDist = (1 - spPhase * 0.78);
    const spX = cxP + Math.cos(spAng) * rx * spDist;
    const spY = cyP + Math.sin(spAng) * ry * spDist;
    ctx.fillStyle = s % 2 === 0 ? '#ffffff' : col1;
    ctx.globalAlpha = Math.sin(spPhase * Math.PI) * 0.85;
    ctx.beginPath();
    ctx.arc(spX, spY, Math.max(1.2, 2.8 * _a.s * 0.04), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Elektr chaqmoq yoylar (faqat o'rta va yuqori sifatda)
  if (G.quality !== 'low' && o.z < 46) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.2, rx * 0.048 * prox);
    const arcCount = o.z < 22 ? 4 : 3;
    for (let a = 0; a < arcCount; a++) {
      const ang = G.t * 4.5 + a * (6.283 / arcCount);
      const x1 = cxP + Math.cos(ang) * rx * 0.95;
      const y1 = cyP + Math.sin(ang) * ry * 0.95;
      const xm = cxP + Math.cos(ang + 0.35) * rx * (0.45 + 0.2 * Math.sin(G.t * 19 + a));
      const ym = cyP + Math.sin(ang + 0.35) * ry * (0.45 + 0.2 * Math.cos(G.t * 17 + a));
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(xm, ym);
      ctx.lineTo(cxP, cyP);
      ctx.stroke();
    }
  }
  ctx.restore();

  // 3) 3D Portal ustunlari va arkasi
  const mesh = MESHES.portal_active;
  if (mesh) {
    const faces = facesOf(mesh, [o.x, 0, o.z], 0, 1);
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) drawFace(f);
  }

  // 4) Portal tepasida o'lcham nomi, multiplikator va yorqin ko'rsatkich (Overhead Holographic Entry Signage)
  if (o.z < 52 && o.z > 0.5) {
    proj([o.x, 3.42, o.z], _d);
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
    Xavfsiz to'g'ri yo'l ko'rsatkichi, har bir polosa o'z rangli portal dizayniga ega (Sian / Binafsha / Olovrang),
    xotirjam aylanuvchi energiya pardasi va yo'l yo'naltiruvchi chiziqlari bilan */
function drawPortalOpen(o) {
  if (o.z > 66 || o.z < -2) return;
  const l = (o.lane != null) ? o.lane : (o.x < -0.8 ? 0 : (o.x > 0.8 ? 2 : 1));
  const theme = PORTAL_LANE_THEMES[l] || PORTAL_LANE_THEMES[0];
  const col1 = theme.col1;
  const col2 = theme.col2;

  // 1) Yo'l polosasi bo'ylab tinch tranzit izi
  quad(o.x - 0.98, Math.max(0.5, o.z - 12), o.x + 0.98, o.z + 0.8, 0.015,
    rgba(col1, 0.09), rgba(col1, 0.38));

  // 2) Portal markazi va o'lchami
  proj([o.x, 1.42, o.z], _a);
  if (!_a.vis) return;
  const rx = 1.15 * _a.s;
  const ry = 1.45 * _a.s;
  const cxP = _a.x, cyP = _a.y;

  ctx.save();
  // Yarim-shaffof xotirjam energiya pardasi (Translucent Shimmering Energy Membrane)
  const memGrad = ctx.createRadialGradient(cxP, cyP, 0, cxP, cyP, Math.max(rx, ry));
  memGrad.addColorStop(0, 'rgba(255,255,255,0.65)');
  memGrad.addColorStop(0.35, rgba(col1, 0.38));
  memGrad.addColorStop(0.75, rgba(col2, 0.18));
  memGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = memGrad;
  ctx.beginPath(); ctx.ellipse(cxP, cyP, rx * 0.90, ry * 0.90, 0, 0, Math.PI * 2); ctx.fill();

  // Aylanuvchi sokin energiya halqasi (Smooth Concentric Ring)
  ctx.save();
  ctx.translate(cxP, cyP);
  ctx.rotate(G.t * 1.8);
  ctx.strokeStyle = rgba(col1, 0.65);
  ctx.lineWidth = Math.max(1, 2.5 * _a.s * 0.04);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 3) 3D Tranzit Arkasi
  const mesh = MESHES.portal_open;
  if (mesh) {
    const faces = facesOf(mesh, [o.x, 0, o.z], 0, 1);
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) drawFace(f);
  }
  ctx.restore();

  // 4) Trassa yo'nalish ko'rsatkichi (Overhead Highway Transit Signage)
  if (o.z < 44 && o.z > 1.0) {
    proj([o.x, 3.12, o.z], _d);
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
      ctx.globalAlpha = Math.sin(rayProg * Math.PI) * p * 0.85;
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
      ctx.lineWidth = Math.max(2, (1 - rp) * 12 * p);
      ctx.globalAlpha = Math.sin(rp * Math.PI) * p * 0.75;
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
      ctx.lineWidth = Math.max(1.5, (1 - xprog) * 8 * xp);
      ctx.globalAlpha = Math.sin(xprog * Math.PI) * xp * 0.6;
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
  if (kind === 'shield') pos[1] = .05;
  if (good) drawGlow(pos, m.col, kind === 'coin' ? 1.5 : 1.7);
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
  const magRad = 12 + (G.magnetRadiusBonus || 0);

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
    const arcCol = drawn % 2 === 0 ? '#a855f7' : '#00e5ff';

    // Tashqi neon elektr yoyi (Outer electric glow arc)
    ctx.strokeStyle = arcCol;
    ctx.lineWidth = 2.4;
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

  // qosh turbo raketali alangalar
  for (const exSx of [-0.34, 0.34]) {
    const flameIntensity = G.boost > 0.05 ? G.boost : (G.running ? 0.22 : 0);
    if (flameIntensity > 0.05) {
      proj([G.x + exSx, 0.3 + G.y, -1.25], _c);
      if (_c.vis) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.95, flameIntensity * 1.2);
        const flR = _c.s * 0.45 * (1 + flameIntensity * 0.8 + Math.sin(G.t * 30 + exSx) * 0.15);
        const g = ctx.createRadialGradient(_c.x, _c.y, 0, _c.x, _c.y, flR);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, p.acc || '#00e5ff');
        g.addColorStop(0.7, p.body || '#ff2fb9');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(_c.x, _c.y, flR, 0, 6.283); ctx.fill();
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

    // Laser target line pointing towards player
    ctx.strokeStyle = 'rgba(255, 30, 60, 0.65)';
    ctx.lineWidth = Math.max(2, 4 * _b.s * 0.05);
    ctx.beginPath();
    ctx.moveTo(_b.x, _b.y);
    proj([G.x, 0.05, 0], _c);
    if (_c.vis) {
      ctx.lineTo(_c.x, _c.y);
      ctx.stroke();
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
    if (o.z > -1 && o.z < 90 && !o.dead) _renderList.push({ z: o.z, t: 0, o });
  }
  for (let i = 0; i < G.parts.length; i++) {
    const p = G.parts[i];
    _renderList.push({ z: p.z, t: 1, p });
  }
  _renderList.push({ z: .1, t: 2 });
  if (G.bossActive && G.bossZ != null) _renderList.push({ z: G.bossZ, t: 3 });
  _renderList.sort((a, b) => b.z - a.z);
  for (let i = 0; i < _renderList.length; i++) {
    const d = _renderList[i];
    if (d.t === 1) drawPart(d.p);
    else if (d.t === 2) drawShip();
    else if (d.t === 3) drawBoss();
    else drawObj(d.o);
  }

  // Magnit tortish elektr yoylari (tangalar tortilganda)
  drawMagnetArcs();

  // Suzuvchi yozuvlar (Near Miss, Jump, Combo)
  drawFloatingTexts();

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
  const rNames = { common: 'ОБЫЧНАЯ', rare: 'РЕДКАЯ', epic: 'ЭПИЧЕСКАЯ', legendary: 'ЛЕГЕНДАРНАЯ' };
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
    const rNames = { common: 'ОБЫЧНАЯ', rare: 'РЕДКАЯ', epic: 'ЭПИЧЕСКАЯ', legendary: 'ЛЕГЕНДАРНАЯ' };
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
  const rNames = { common: 'ОБЫЧНАЯ', rare: 'РЕДКАЯ', epic: 'ЭПИЧЕСКАЯ', legendary: 'ЛЕГЕНДАРНАЯ' };
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
    const rNames = { common: 'ОБЫЧНАЯ', rare: 'РЕДКАЯ', epic: 'ЭПИЧЕСКАЯ', legendary: 'ЛЕГЕНДАРНАЯ' };
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

/* --- ВИЗУАЛЬНЫЙ ТЮНИНГ (AERO, BODY, VINYL, UNDERGLOW) --- */
const TUNE_DEFS = {
  wing: {
    title: 'АЭРОДИНАМИЧЕСКИЙ СПОЙЛЕР',
    options: [
      { val: 0, name: 'Заводской' },
      { val: 1, name: 'Спорт GT' },
      { val: 2, name: 'Карбон Track' },
      { val: 3, name: 'Двойной пилон' },
      { val: 4, name: 'Дактейл' },
      { val: 5, name: 'Биплан Super' }
    ]
  },
  splitter: {
    title: 'ПЕРЕДНИЙ СПЛИТТЕР',
    options: [
      { val: 0, name: 'Заводской' },
      { val: 1, name: 'Aero Blade' },
      { val: 2, name: 'Широкий трековый' }
    ]
  },
  stripe: {
    title: 'ГОНОЧНЫЕ ПОЛОСЫ (ВИНИЛ)',
    options: [
      { val: 0, name: 'Без полос' },
      { val: 1, name: 'Одинарная' },
      { val: 2, name: 'Двойные полосы' }
    ]
  },
  stripeColor: {
    title: 'ЦВЕТ ВИНИЛА / ПОЛОС',
    type: 'colors',
    options: [
      { val: '#00e5ff', name: 'Электрический циан' },
      { val: '#a855f7', name: 'Неоновый фиолет' },
      { val: '#ffc857', name: 'Энерго-золото' },
      { val: '#ff6b35', name: 'Огненный оранж' },
      { val: '#39ff14', name: 'Токсик-лайм' },
      { val: '#f1f5f9', name: 'Чистый белый' }
    ]
  },
  rimColor: {
    title: 'КОЛЁСНЫЕ ДИСКИ И ОБОДА',
    type: 'underglow',
    options: [
      { val: null, name: 'Заводские' },
      { val: '#00e5ff', name: 'Циан Aero' },
      { val: '#a855f7', name: 'Фиолет Неон' },
      { val: '#ffc857', name: 'Золото GT' },
      { val: '#ff6b35', name: 'Вулкан' },
      { val: '#f1f5f9', name: 'Титан Белый' }
    ]
  },
  underglow: {
    title: 'НЕОНОВАЯ ПОДСВЕТКА ДНИЩА',
    type: 'underglow',
    options: [
      { val: null, name: 'Выкл' },
      { val: '#00e5ff', name: 'Электрический циан' },
      { val: '#a855f7', name: 'Неоновый фиолет' },
      { val: '#ffc857', name: 'Энерго-золото' },
      { val: '#ff6b35', name: 'Плазма оранж' },
      { val: '#00ff66', name: 'Био-изумруд' }
    ]
  },
  cyberFin: {
    title: 'АКУЛИЙ КИЛЬ НА КРЫШЕ',
    options: [
      { val: false, name: 'Отключен' },
      { val: true, name: 'Установлен' }
    ]
  },
  widebody: {
    title: 'ТРЕКОВОЕ РАСШИРЕНИЕ (WIDEBODY)',
    options: [
      { val: false, name: 'Стандарт' },
      { val: true, name: 'Широкий обвес' }
    ]
  }
};

function renderVisualTuning(car) {
  const c = car || CARS[showcaseCarId] || CARS[0];
  const list = document.getElementById('visualTuningList');
  if (!list) return;

  const cv = document.getElementById('cvUpgCar');
  if (cv) drawCarShowcase(cv, c, showcaseRot, 0.85, 2.1);

  const tune = CAR_TUNING.get(c.id);

  let html = '';
  for (const key in TUNE_DEFS) {
    const group = TUNE_DEFS[key];
    const curVal = tune[key];

    html += '<div class="tune-group" style="margin-bottom:14px;text-align:left">' +
      '<div style="font-size:11px;font-weight:900;letter-spacing:.08em;color:#7fe9ff;margin-bottom:6px">' + group.title + '</div>';

    if (group.type === 'colors' || group.type === 'underglow') {
      html += '<div class="color-swatch-row">';
      for (const opt of group.options) {
        const isSel = opt.val === curVal || (opt.val === null && !curVal);
        if (opt.val === null) {
          html += '<button class="tune-opt-btn' + (isSel ? ' on' : '') + '" data-tune-key="' + key + '" data-tune-val="null" type="button">ВЫКЛ</button>';
        } else {
          html += '<button class="color-swatch-btn' + (isSel ? ' on' : '') + '" data-tune-key="' + key + '" data-tune-val="' + opt.val + '" style="background:' + opt.val + ';color:' + opt.val + '" title="' + opt.name + '" type="button"></button>';
        }
      }
      html += '</div>';
    } else {
      html += '<div class="tune-options">';
      for (const opt of group.options) {
        const isSel = String(curVal) === String(opt.val) || (curVal == null && opt.val === 0);
        html += '<button class="tune-opt-btn' + (isSel ? ' on' : '') + '" data-tune-key="' + key + '" data-tune-val="' + opt.val + '" type="button">' + opt.name + '</button>';
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
  { id: 'first_race', title: 'ПЕРВЫЙ СТАРТ', desc: 'Совершите свой первый заезд в NEON RACE', icon: '🏁', goal: 1, unit: 'гонка', rewardCoins: 150, rewardPts: 30, getVal: () => (G.meta.runs || G.meta.plays || 0) },
  { id: 'cars_5', title: 'КОЛЛЕКЦИОНЕР', desc: 'Соберите 5 различных спорткаров в гараже', icon: '🚗', goal: 5, unit: 'машин', rewardCoins: 500, rewardPts: 100, getVal: () => CARS.filter(ownedOf).length },
  { id: 'cars_15', title: 'ГАРАЖ МЕЧТЫ', desc: 'Соберите 15 спорткаров в своём гараже', icon: '🏎', goal: 15, unit: 'машин', rewardCoins: 1500, rewardPts: 300, getVal: () => CARS.filter(ownedOf).length },
  { id: 'coins_10k', title: 'НЕОНОВЫЙ МАГНАТ', desc: 'Заработайте суммарно 10 000 монет', icon: '🪙', goal: 10000, unit: 'монет', rewardCoins: 1000, rewardPts: 200, getVal: () => (G.meta.totalCoins || 0) + (G.coins || 0) },
  { id: 'speed_300', title: 'СВЕРХЗВУКОВОЙ БАРЬЕР', desc: 'Развейте скорость свыше 300 км/ч', icon: '⚡', goal: 300, unit: 'км/ч', rewardCoins: 400, rewardPts: 80, getVal: () => Math.floor(G.meta.maxKmh || 0) },
  { id: 'drift_master', title: 'КОРОЛЬ ЗАНОСОВ', desc: 'Проведите в непрерывном заносе более 5 секунд', icon: '💨', goal: 5, unit: 'с', rewardCoins: 450, rewardPts: 90, getVal: () => Math.floor(G.meta.maxDriftSec || 0) },
  { id: 'all_dimensions', title: 'ХОЗЯИН ИЗМЕРЕНИЙ', desc: 'Пройдите через порталы 6 раз', icon: '🌀', goal: 6, unit: 'порталов', rewardCoins: 1200, rewardPts: 250, getVal: () => (G.meta.dimensionsCleared || G.meta.portalsEntered || 0) },
  { id: 'boss_slayer', title: 'НЕУЛОВИМЫЙ ПРИЗРАК', desc: 'Успешно оторвитесь от босса-преследователя 5 раз', icon: '🚨', goal: 5, unit: 'раз', rewardCoins: 800, rewardPts: 150, getVal: () => (G.meta.bossEscapes || 0) },
  { id: 'distance_50k', title: 'МАРАФОНЕЦ ТРАССЫ', desc: 'Преодолейте суммарную дистанцию 50 000 метров', icon: '🛣', goal: 50000, unit: 'м', rewardCoins: 2000, rewardPts: 400, getVal: () => Math.floor(G.meta.totalDist || 0) },
  { id: 'max_upgrade', title: 'АБСОЛЮТНЫЙ ФОРСАЖ', desc: 'Прокачайте 10 параметров тюнинга', icon: '🔧', goal: 10, unit: 'улучшений', rewardCoins: 1000, rewardPts: 200, getVal: () => (G.meta.upgradesPurchased || 0) },
  { id: 'score_100k', title: 'ЛЕГЕНДАРНЫЙ СЧЁТ', desc: 'Наберите более 100 000 очков за один заезд', icon: '👑', goal: 100000, unit: 'очков', rewardCoins: 2500, rewardPts: 500, getVal: () => Math.floor(G.meta.best || 0) },
  { id: 'acct_lvl10', title: 'МАСТЕР NEON RACE', desc: 'Достигните 10 уровня аккаунта', icon: '⭐', goal: 10, unit: 'уровень', rewardCoins: 3000, rewardPts: 600, getVal: () => (ACCT.lvl || 1) }
];

function getMissionState() {
  return store.get('missions_state', {});
}
function setMissionState(st) {
  store.set('missions_state', st);
}
function claimMission(id) {
  const m = MISSIONS.find(x => x.id === id);
  if (!m) return;
  const st = getMissionState();
  const item = st[id] || {};
  if (!item.done || item.claimed) return;
  item.claimed = true;
  st[id] = item;
  setMissionState(st);
  G.coins += m.rewardCoins;
  ACCT.pts += m.rewardPts;
  bankCoins();
  ACCT.save();
  Sound.chord([523, 659, 784, 1046], .4, .25);
  toast('🎉 Задание выполнено! +' + m.rewardCoins + ' 🪙 и +' + m.rewardPts + ' ⭐!');
  renderMissions();
  menuStats();
}

function getAchieveState() {
  return store.get('achieve_state', {});
}
function setAchieveState(st) {
  store.set('achieve_state', st);
}
function claimAchievement(id) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  const st = getAchieveState();
  const item = st[id] || {};
  if (!item.done || item.claimed) return;
  item.claimed = true;
  st[id] = item;
  setAchieveState(st);
  G.coins += a.rewardCoins;
  ACCT.pts += a.rewardPts;
  bankCoins();
  ACCT.save();
  Sound.chord([523, 659, 784, 1046, 1318], .5, .25);
  toast('🏆 Достижение получено! +' + a.rewardCoins + ' 🪙 и +' + a.rewardPts + ' ⭐!');
  renderAchievements();
  menuStats();
}

function renderMissions() {
  const elList = document.getElementById('missionsList');
  if (!elList) return;
  const st = getMissionState();
  elList.innerHTML = MISSIONS.map(m => {
    const item = st[m.id] || { cur: 0, done: false, claimed: false };
    const curVal = Math.max(item.cur || 0, m.getVal ? m.getVal() : 0);
    const isDone = item.done || curVal >= m.goal;
    if (isDone && !item.done) {
      item.done = true;
      item.cur = curVal;
      st[m.id] = item;
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
    if (isClaimed) {
      btnHtml = '<button class="claim-btn claimed" type="button" disabled>ВРУЧЕНО ✓</button>';
    } else if (isDone) {
      btnHtml = '<button class="claim-btn ready" data-claim-achieve="' + a.id + '" type="button">ЗАБРАТЬ</button>';
    } else {
      btnHtml = '<button class="claim-btn locked" type="button" disabled>' + curVal + ' / ' + a.goal + '</button>';
    }

    return '<div class="mission-card' + (isDone ? ' done' : '') + '">' +
      '<div class="mission-icon">' + a.icon + '</div>' +
      '<div class="mission-info">' +
        '<div class="mission-title">' + a.title + '</div>' +
        '<div class="mission-desc">' + a.desc + '</div>' +
        '<div class="mission-bar-wrap"><div class="mission-bar" style="width:' + pct + '%"></div></div>' +
        '<div class="mission-meta">' +
          '<span>ПРОГРЕСС: ' + curVal + ' / ' + a.goal + ' ' + a.unit + ' (' + pct + '%)</span>' +
          '<div class="mission-rewards"><span>🪙 +' + a.rewardCoins + '</span><span>⭐ +' + a.rewardPts + '</span></div>' +
        '</div>' +
      '</div>' +
      btnHtml +
    '</div>';
  }).join('');
  if (countEl) countEl.textContent = doneCount + ' / ' + ACHIEVEMENTS.length + ' ВЫПОЛНЕНО';
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

const TABS = { ships: 'Ships', carUpgrades: 'CarUpgrades', missions: 'Missions', achieve: 'Achieve', perk: 'Perk', skins: 'Skins', acct: 'Acct', stat: 'Stat', set: 'Set' };
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
  else activateTab(tab);
}));
$('#btnOpenGarage').addEventListener('click', () => {
  setMenuDropdown(false);
  setMenuView('garage');
  activateTab('ships');
});
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
requestAnimationFrame(frame);
setTimeout(() => el.load.classList.add('gone'), 600);
YA.init();

window.NY3D = {
  G, CAM, YA, Sound, el, LANES, KIND, HAZARD, GOOD, JUMPABLE, OBJ, LESSONS, MESHES, CARS, SHIPS: CARS,
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
  MISSIONS, ACHIEVEMENTS, renderMissions, renderAchievements, claimMission, claimAchievement,
  showModal, hideModal,
  DIMENSIONS, enterDimension, exitDimension, speedToKmh, qualLabel, detectInitialQuality, syncQualityClass, drawPortalActive, drawPortalOpen, drawPortalEntryEffect, drawMagnetArcs,
  DESIGN_SYSTEM, MATERIALS, ASSET_REGISTRY
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
    const tune = CAR_TUNING.get(c.id);
    tune[key] = val;
    CAR_TUNING.set(c.id, tune);
    applySkin(c);

    renderVisualTuning(c);
    updateShowcase();
    Sound.blip(540, .08, 'triangle', .18);
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
