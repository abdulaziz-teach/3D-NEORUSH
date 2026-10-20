
"use strict";
/* =====================================================================
   NEON YARISH 3D — mashina poygasi
   Kutubxonasiz 3D renderer (canvas2d + perspektiva), WebAudio,
   Yandex Games SDK adaptatori (majburiy emas).
   Vizual qoida: QIZIL = xavf, RANGLI = ochko.
   ===================================================================== */

const store = {
  get(k, d) { try { const v = localStorage.getItem('ny3d_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
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

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, G.quality === 'low' ? 1 : 1.5);
  W = Math.max(280, window.innerWidth || 960);
  H = Math.max(240, window.innerHeight || 600);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx = W / 2;
  // Portretda gorizontni yuqoriroq qo'yamiz — yo'lga ko'proq joy qolsin.
  const portrait = H > W * 1.05;
  G.portrait = portrait;
  cy = Math.round(H * (portrait ? 0.44 : 0.52));
  // FOV: chetki qatorlar har doim ekranda sig'ishi kerak — kenglik asosiy cheklov.
  FOV_BASE = Math.round(Math.max(280, Math.min(Math.min(W * 1.02, H * (portrait ? 1.35 : 1.30)), 980)));
  CAM.fov = FOV_BASE;
  skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#070a20'); skyGrad.addColorStop(.40, '#180b3c');
  skyGrad.addColorStop(.60, '#40104a'); skyGrad.addColorStop(1, '#0a0620');
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
  const L = mesh.light || LIGHT, cols = mesh.c, em = mesh.em;
  for (let fi = 0; fi < mesh.f.length; fi++) {
    const f = mesh.f[fi], cnt = f.length;
    let zAvg = 0, ax = 0, ay = 0, bx = 0, by = 0;
    for (let i = 0; i < cnt; i++) {
      const q = vs[f[i]];
      zAvg += q[2];
      if (i === 0) { ax = q[0]; ay = q[1]; bx = q[0]; by = q[1]; }
      else { if (q[0] < ax) ax = q[0]; if (q[0] > bx) bx = q[0]; if (q[1] < ay) ay = q[1]; if (q[1] > by) by = q[1]; }
    }
    zAvg /= cnt;
    if (zAvg < CAM.z + 0.8 || bx - ax < 0.02 || by - ay < 0.02) continue;
    const a = vs[f[0]], b = vs[f[1]], c = vs[f[2]];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const ln = Math.hypot(nx, ny, nz) || 1;
    const diff = Math.abs((nx / ln) * L[0] + (ny / ln) * L[1] + (nz / ln) * L[2]);
    out.push({ f, vs, z: zAvg, col: cols[fi], l: em[fi] ? 1 : 0.34 + 0.66 * diff });
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
  if (fog > .55) {
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

function emptyMesh() { return { v: [], f: [], c: [], em: [] }; }
function mergeMesh() {
  const m = emptyMesh();
  for (let k = 0; k < arguments.length; k++) {
    const s = arguments[k]; if (!s) continue;
    const base = m.v.length;
    for (const v of s.v) m.v.push([v[0], v[1], v[2]]);
    for (let i = 0; i < s.f.length; i++) {
      m.f.push(s.f[i].map(ix => ix + base));
      m.c.push(s.c[i]); m.em.push(s.em[i]);
    }
  }
  return m;
}
/** Torisiimon (klin) blok: orqa (-z) va old (+z) kesimlari har xil o'lchamda.
    w = {p:[x,y,z], hz, rr:[hx,hy], fr:[hx,hy], ry?, fy?, c, top?, bot?, em?}
    rr/fr — yarm o'lchamlar, ry/fy — kesim markazining y surilishi.
    Yuza tartibi: 0 -z, 1 +z, 2 -y(past), 3 +y(ust), 4 -x, 5 +x */
function meshOfWedges(list) {
  const m = emptyMesh();
  for (const w of list) {
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
    }
  }
  return m;
}
/** boxes: [{p:[x,y,z], s:[hx,hy,hz], c:'#rrggbb', top?, bot?, side?, front?, back?, em?}]
    side = ±x yoqlari, front = +z (old), back = -z (ort) — g'ildirak diski va
    far/orqa chiroqlar shu orqali alohida ranglanadi. */
function meshOfBoxes(boxes) {
  const m = emptyMesh();
  for (const b of boxes) {
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
    }
  }
  return m;
}
function meshOfSportWheel(p, size, accent) {
  const m = emptyMesh(), n = 8;
  const [hx, ry, rz] = size, [px, py, pz] = p;
  const outer = [], frontInner = [], backInner = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283;
    const y = Math.cos(a), z = Math.sin(a);
    outer.push([px - hx, py + y * ry, pz + z * rz], [px + hx, py + y * ry, pz + z * rz]);
    frontInner.push([px - hx - .008, py + y * ry * .64, pz + z * rz * .64]);
    backInner.push([px + hx + .008, py + y * ry * .64, pz + z * rz * .64]);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, f = i * 2, fn = j * 2;
    m.f.push([f, fn, fn + 1, f + 1]); m.c.push('#10141e'); m.em.push(false);
    m.f.push([f, fn, 2 * n + j * 2, 2 * n + i * 2]); m.c.push(i % 2 ? '#9eabc1' : '#d9e3f5'); m.em.push(true);
    m.f.push([f + 1, fn + 1, 2 * n + j * 2 + 1, 2 * n + i * 2 + 1]); m.c.push(i % 2 ? '#9eabc1' : '#d9e3f5'); m.em.push(true);
  }
  for (let i = 0; i < n; i++) {
    m.v.push(frontInner[i], backInner[i]);
  }
  const frontHub = [], backHub = [];
  for (let i = 0; i < n; i++) {
    frontHub.push(2 * n + i * 2);
    backHub.push(2 * n + i * 2 + 1);
  }
  m.f.push(frontHub, backHub); m.c.push('#28354a', '#28354a'); m.em.push(false, false);
  for (const side of [-1, 1]) {
    const x = px + side * (hx + .014);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * 6.283, c = Math.cos(a), s = Math.sin(a), w = .045;
      const inner = .14, outerR = .56;
      const face = [
        [py + c * inner * ry - s * w * ry, pz + s * inner * rz + c * w * rz],
        [py + c * outerR * ry - s * w * ry, pz + s * outerR * rz + c * w * rz],
        [py + c * outerR * ry + s * w * ry, pz + s * outerR * rz - c * w * rz],
        [py + c * inner * ry + s * w * ry, pz + s * inner * rz - c * w * rz]
      ];
      const base = m.v.length;
      for (const v of face) m.v.push([x, v[0], v[1]]);
      m.f.push([base, base + 1, base + 2, base + 3]); m.c.push(accent); m.em.push(true);
    }
  }
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
  resume() { if (this.ac && this.ac.state === 'suspended') { try { this.ac.resume(); } catch {} } },
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
  car:    { badY: 1.75, patW: 1.25, patL: 1.5, col: '#ff2b43', hit: 1.15, spin: 0,    y: 0 },
  truck:  { badY: 2.35, patW: 1.35, patL: 1.9, col: '#ff2b43', hit: 1.25, spin: 0,    y: 0 },
  bar:    { badY: 1.15, patW: 1.30, patL: 1.1, col: '#ff2b43', hit: 1.20, spin: 0,    y: 0 },
  wall:   { badY: 3.15, patW: 1.30, patL: 0.9, col: '#ff2b43', hit: 1.25, spin: 0,    y: 0 },
  cone:   { badY: 1.35, patW: 0.85, patL: 0.9, col: '#ff5a3c', hit: 1.00, spin: 0.4,  y: 0 },
  coin:   { badY: 1.75, patW: 0.95, patL: 1.0, col: '#ffd166', hit: 1.55, spin: 2.4,  y: 1.0 },
  nitro:  { badY: 1.85, patW: 0.95, patL: 1.0, col: '#00e5ff', hit: 1.50, spin: 1.7,  y: 1.0 },
  shield: { badY: 1.85, patW: 0.95, patL: 1.0, col: '#46ff8f', hit: 1.50, spin: 1.1,  y: 0.05 },
  magnet: { badY: 1.80, patW: 0.95, patL: 1.0, col: '#c08cff', hit: 1.50, spin: 1.3,  y: 0.9 },
  life:   { badY: 1.85, patW: 0.95, patL: 1.0, col: '#ff7ab8', hit: 1.50, spin: 0.9,  y: 1.0 }
};

const G = {
  running: false, paused: false, over: false, menuMusic: true,
  t: 0, last: 0, dt: 0, fps: 60, frame: 0, frameMs: 16, slowFrames: 0,
  speed: 17, maxSpeed: 17, baseSpeed: 17, dist: 0, score: 0, coins: store.get('coins', 0),
  lives: 3, maxLives: 3, level: 1, nextLevelAt: 1000, levelAt: 0, levelFrom: 0, combo: 1, bestCombo: 1, comboT: 0, comboHold: 3.4,
  boost: 0, boostOn: false, energon: 100, energonMax: 100, nitroT: 0,
  magnet: 0, magnetMax: 5, shield: 0, shieldMax: 0, invul: 0, coinMult: 1,
  lane: 1, laneX: 0, x: 0, y: 0, vy: 0, onGround: true, tilt: 0, yaw: 0, jumpV: 1,
  spawnGap: 15, shake: 0, flash: 0, camRoll: 0, runCoins: 0, brakePow: 0, smashBonus: 0,
  objs: [], parts: [], stars: [], mountains: [], posts: [],
  trackIdx: 0, trackT: 0, prevTrackIdx: null, trans: 99,
  quality: store.get('qual', 'high'), car: store.get('car', 0), ship: store.get('car', 0),
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
    wh: [.18, .23, .39], wx: .92, wz: .81, wy: .23, bum: [.84, .08, .10], taper: .70, tuck: .30, wing: 2 }
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
  /* 6) Old oyna (qiyiq stakan): salon oldidan kaput tepasigacha tushadi */
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
  /* 9) Yon havo o'tkazgich (faqat o'tkir burunli karlarda) va yon etak */
  if (tp > .28) for (const sx of [-1, 1]) B.push({ p: [sx * (chx + .010), bodyBot + chh * .80, -(chz * .30)],
    s: [.02, chh * .34, chz * .14], c: DARK });
  for (const sx of [-1, 1]) B.push({ p: [sx * (chx * .98), bodyBot + .03, chz * .02],
    s: [.03, .03, chz * .58], c: CARB, top: DARK });
  /* 10) Old splityer + radyator tory */
  B.push({ p: [0, bodyBot + .015, chz + .02], s: [chx * .86, .026, .09], c: CARB, top: accent });
  B.push({ p: [0, S.chy + ffy - chh * .02, chz + .005], s: [chx * .40, chh * .30, .05], c: DARK });
  /* 11) LED faralar — ingichka gorizontal chiziq + vertikal kunduzgi chiroq */
  for (const sx of [-1, 1]) {
    B.push({ p: [sx * chx * .60, bodyTop - chh * .28, chz + .01], s: [.17, .045, .045], c: '#eaf4ff', em: true, front: '#ffffff' });
    B.push({ p: [sx * chx * .84, bodyTop - chh * .58, chz - .01], s: [.03, .085, .04], c: '#dfe9ff', em: true });
  }
  /* 12) Orqa bufer + to'liq kenglikdagi LED qizil chiziq (orqadan darhol taniladi) */
  B.push({ p: [0, S.chy - chh * .20, -(chz + .04)], s: S.bum, c: CARB, top: '#28324a' });
  B.push({ p: [0, bodyTop - .02, -(chz + .05)], s: [chx * .80, .035, .03], c: '#ff2b43', em: true, back: '#ff5a5a' });
  for (const sx of [-1, 1]) B.push({ p: [sx * chx * .58, bodyTop - .02, -(chz + .06)],
    s: [.14, .055, .025], c: '#ff2b43', em: true, back: '#ff7a86' });
  /* 13) Orqa diffyuzor + qanotcha (aero ko'rinish) */
  B.push({ p: [0, bodyBot - .01, -(chz + .01)], s: [chx * .70, .05, .09], c: DARK, bot: DARK });
  for (const fx of [-.44, 0, .44]) B.push({ p: [chx * fx, bodyBot - .02, -(chz + .03)], s: [.025, .05, .08], c: '#242c3d' });
  /* 14) Spoyler: 1 = oddiy, 2 = katta, 3 = poyga. Qanot deck ustunlariga mahkamlanadi */
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
  /* 18) G'ildiraklar: yon yoqlari disk rangida (ligali disklar ko'rinishi) */
  for (const sx of [-1, 1]) for (const sz of [1, -1])
    wheels.push(meshOfSportWheel([sx * S.wx, S.wy, sz * S.wz], S.wh, accent));
  for (const sx of [-1, 1]) B.push({ p: [sx * chx * .44, bodyBot + .05, -(chz + .13)],
    s: [.09, .045, .035], c: '#b7c4d8', front: '#dce7f7', back: '#8795aa', em: true });
  for (const sx of [-1, 1]) {
    B.push({ p: [sx * (chx + .014), S.chy + .015, .02], s: [.018, .075, .23], c: CARB, side: '#252d40' });
    B.push({ p: [sx * (chx + .025), S.chy + .015, .02], s: [.012, .012, .18], c: accent, em: true });
  }
  return mergeMesh(meshOfWedges(W), meshOfBoxes(B), ...wheels);
}
const MESH_TRUCK = meshOfBoxes([
  // yuki (konteyner) — qizil-op qirrali, baland va keng
  { p: [0, .80, -.75], s: [1.02, .80, 1.35], c: '#8f1227', top: '#c8203a' },
  { p: [0, 1.05, -.75], s: [1.04, .12, 1.37], c: '#ff2b43', em: true },
  // konteyner qovurg'alarining ko'rinishi (orqa panellar)
  { p: [-.62, .80, -2.12], s: [.12, .62, .05], c: '#ff8ea0' },
  { p: [0, .80, -2.12], s: [.12, .62, .05], c: '#ffe3e8' },
  { p: [.62, .80, -2.12], s: [.12, .62, .05], c: '#ff8ea0' },
  // kabina
  { p: [0, .62, 1.05], s: [.95, .48, .60], c: '#d21f3c', top: '#ff5a72' },
  { p: [0, .30, 1.10], s: [.60, .18, .30], c: '#12161f' },
  { p: [-.95, .34, 1.35], s: [.12, .12, .10], c: '#fff6c8', em: true },
  { p: [.95, .34, 1.35], s: [.12, .12, .10], c: '#fff6c8', em: true },
  // yuqori sig'inal panel — oq-qizil (sariq emas: sariq = mukofot rangi)
  { p: [0, 1.62, -.75], s: [.30, .35, .10], c: '#f3f6ff', em: true },
  { p: [0, 1.62, -.68], s: [.16, .18, .06], c: '#ff2b43', em: true },
  // g'ildiraklar
  { p: [-.9, .40, .2], s: [.20, .40, .45], c: '#0e1219' }, { p: [.9, .40, .2], s: [.20, .40, .45], c: '#0e1219' },
  { p: [-.9, .40, -1.3], s: [.20, .40, .45], c: '#0e1219' }, { p: [.9, .40, -1.3], s: [.20, .40, .45], c: '#0e1219' }
]);
/* Sakradigan to'siq: pastga o'rnatilgan, qizil-op qirralar, orqasida "sakra" strelkasi */
const MESH_BAR = meshOfBoxes([
  { p: [-1.05, .34, 0], s: [.10, .40, .16], c: '#e62540' },
  { p: [1.05, .34, 0], s: [.10, .40, .16], c: '#e62540' },
  { p: [0, .74, 0], s: [1.16, .12, .15], c: '#ff2b43', top: '#ff6d80' },
  { p: [0, .48, 0], s: [1.16, .11, .15], c: '#f3f6ff', top: '#ffffff' },
  { p: [-.55, .74, .02], s: [.20, .125, .16], c: '#f3f6ff' },
  { p: [.55, .74, .02], s: [.20, .125, .16], c: '#f3f6ff' },
  { p: [0, .96, 0], s: [.34, .06, .10], c: '#ffd166', em: true }
]);
/* Baland devor — sakrash ishlamaydi: tekis qizil panel + shaxmat chetlari */
const MESH_WALL = meshOfBoxes([
  { p: [0, 1.30, 0], s: [1.14, 1.30, .26], c: '#ff2b43', top: '#ff6d80', bot: '#a3122a' },
  { p: [0, 2.72, 0], s: [1.22, .14, .32], c: '#f3f6ff', em: true },
  { p: [0, 1.30, .02], s: [.34, .62, .30], c: '#fff0f2' },
  { p: [0, 1.05, .04], s: [.13, .16, .30], c: '#ff2b43', em: true },
  // shaxmat tekshiruvi chetlari (aniq "to'xta" belgisi)
  { p: [-.98, 2.42, .04], s: [.14, .16, .28], c: '#f3f6ff' },
  { p: [.98, 2.42, .04], s: [.14, .16, .28], c: '#f3f6ff' },
  { p: [-.98, 2.10, .04], s: [.14, .16, .28], c: '#ff2b43' },
  { p: [.98, 2.10, .04], s: [.14, .16, .28], c: '#ff2b43' },
  // pastki etek — devor yerda qattiq turadi
  { p: [0, .10, 0], s: [1.20, .10, .34], c: '#7a0c1c' }
]);
/* Konus: aniq to'q sariq + oq tasma */
const MESH_CONE = mergeMesh(
  meshOfCone(.46, 1.05, 10, '#ff7a2f', '#ffb066'),
  meshOfBoxes([
    { p: [0, .06, 0], s: [.55, .07, .55], c: '#c8341f' },
    { p: [0, .46, 0], s: [.27, .06, .27], c: '#fff3e6' },
    { p: [0, .98, 0], s: [.09, .07, .09], c: '#ffd166', em: true }
  ])
);
/* Tangа: qalin disk — qayrilganda ham yo'qolmaydi */
const MESH_COIN = meshOfCoin(.5, .16, 12, '#ffd166', '#b8862b');
const MESH_NITRO = mergeMesh(
  meshOfOcta(.44, .62, '#00e5ff'),
  meshOfBoxes([{ p: [0, 0, 0], s: [.16, .30, .16], c: '#bdf6ff' }])
);
const MESH_SHIELD = mergeMesh(
  meshOfPrism(.5, .95, 6, '#46ff8f', '#b6ffd0'),
  meshOfBoxes([
    { p: [0, .48, .01], s: [.16, .22, .06], c: '#0b3a1f' },
    { p: [0, .98, 0], s: [.30, .05, .30], c: '#b6ffd0', em: true }
  ])
);
const MESH_MAGNET = meshOfBoxes([
  { p: [-.34, .55, 0], s: [.18, .40, .20], c: '#c08cff', top: '#e3cdff' },
  { p: [.34, .55, 0], s: [.18, .40, .20], c: '#c08cff', top: '#e3cdff' },
  { p: [0, .16, 0], s: [.52, .18, .20], c: '#8b5cf6' },
  { p: [-.34, .96, 0], s: [.18, .07, .20], c: '#fff0f5', em: true },
  { p: [.34, .96, 0], s: [.18, .07, .20], c: '#fff0f5', em: true }
]);
const MESH_LIFE = meshOfBoxes([
  { p: [0, .45, 0], s: [.50, .16, .16], c: '#ff7ab8', em: true },
  { p: [0, .45, 0], s: [.16, .16, .50], c: '#ff7ab8', em: true },
  { p: [0, .82, 0], s: [.16, .38, .16], c: '#ffd3e6' },
  { p: [0, .08, 0], s: [.16, .38, .16], c: '#ffd3e6' }
]);
const MESHES = { car: null, truck: MESH_TRUCK, bar: MESH_BAR, wall: MESH_WALL, cone: MESH_CONE,
  coin: MESH_COIN, nitro: MESH_NITRO, shield: MESH_SHIELD, magnet: MESH_MAGNET, life: MESH_LIFE };

/* --------------------------- GARAJ: 15 MASHINA ---------------------------
   cost = 🪙 tanga, pcost = ⭐ ochko (ikkala usul ham ishlaydi),
   lvl = ⭐ akkaunt darajasi talabi, perk = mashinaning maxsus kuchi.
   DIQQAT: 15 ta mashina va 15 ta noyub perk — hech bir perk takrorlanmaydi,
   har bir perk o'yin mantig'ida haqiqiy ta'sirga ega (applyPerk + update). */
const PERKS = {
  steady:   { ic: '🌱', name: 'Плавный старт', desc: 'Скорость растёт на 30% медленнее — проще начать' },
  drain:    { ic: '⚡', name: 'Экономное нитро', desc: 'Энергия расходуется на 45% медленнее' },
  score:    { ic: '🏆', name: 'Рекордсмен', desc: 'На 28% больше очков за каждый метр' },
  coin:     { ic: '🪙', name: 'Золотая жила', desc: 'Каждая монета приносит больше' },
  magnetup: { ic: '🧲', name: 'Долгий магнит', desc: 'Магнит работает на 6 секунд дольше' },
  turbo:    { ic: '🚀', name: 'Турбодвигатель', desc: 'Выше базовая скорость и мощнее нитро' },
  armor:    { ic: '❤', name: 'Броня', desc: 'Начинайте гонку с дополнительной жизнью' },
  luck:     { ic: '🍀', name: 'Удача', desc: 'На трассе чаще появляются бонусы' },
  combo:    { ic: '🔥', name: 'Мастер комбо', desc: 'Комбо угасает на 50% медленнее' },
  smash:    { ic: '💥', name: 'Мощный бампер', desc: 'Тараньте препятствия на нитро и получайте +250 очков' },
  brakes:   { ic: '🛑', name: 'Точный поворот', desc: 'Быстрее перестраивайтесь между полосами' },
  sregen:   { ic: '♻', name: 'Восстановление щита', desc: 'Щит восстанавливается после окончания' },
  djump:    { ic: '🦘', name: 'Двойной прыжок', desc: 'Можно прыгнуть ещё раз в воздухе' },
  revive:   { ic: '🚑', name: 'Второй шанс', desc: 'Один раз воскресните без рекламы' },
  ghost:    { ic: '👻', name: 'Призрак', desc: 'Иногда позволяет проскочить сквозь препятствие' }
};
const PERK_KEYS = Object.keys(PERKS);
const CARS = [
  { id: 0, name: 'Неон', cost: 0, pcost: 0, lvl: 1, shape: 'sport', body: '#00e5ff', roof: '#0b2e46', glass: '#bff5ff', acc: '#7dff9b',
    boost: 1.00, shieldStart: 0, magnet: 1.0, tag: 'Стартовая машина', perk: 'steady' },
  { id: 1, name: 'Розовый ветер', cost: 450, pcost: 90, lvl: 2, shape: 'sport', body: '#ff2fb9', roof: '#3a0d2c', glass: '#ffd9f2', acc: '#ffd166',
    boost: 1.25, shieldStart: 0, magnet: 1.10, tag: 'Мощное нитро', perk: 'drain' },
  { id: 2, name: 'Золотой шанс', cost: 900, pcost: 180, lvl: 3, shape: 'muscle', body: '#ffd166', roof: '#3b2e10', glass: '#fff6d8', acc: '#fff3c4',
    boost: 1.15, shieldStart: 6, magnet: 1.30, tag: 'Больше очков со старта', perk: 'score' },
  { id: 3, name: 'Жёлтое такси', cost: 1400, pcost: 280, lvl: 4, shape: 'sport', body: '#ffc21a', roof: '#2b2205', glass: '#fff4cf', acc: '#1a1a1a', sign: 1,
    boost: 1.20, shieldStart: 3, magnet: 1.45, tag: 'Собирает больше монет', perk: 'coin' },
  { id: 4, name: 'Зелёный фантом', cost: 2200, pcost: 440, lvl: 6, shape: 'sport', body: '#7dff9b', roof: '#0e3320', glass: '#dcffe4', acc: '#00e5ff',
    boost: 1.10, shieldStart: 8, magnet: 1.60, tag: 'Магнит работает дольше', perk: 'magnetup' },
  { id: 5, name: 'Молния', cost: 3400, pcost: 680, lvl: 8, shape: 'racer', body: '#c8d6ff', roof: '#16204a', glass: '#8ef9ff', acc: '#ff2fb9',
    boost: 1.60, shieldStart: 0, magnet: 1.20, tag: 'Самая быстрая машина', perk: 'turbo' },
  { id: 6, name: 'Крепость GT', cost: 4800, pcost: 960, lvl: 11, shape: 'muscle', body: '#9fb4ff', roof: '#1b2352', glass: '#e6eeff', acc: '#ffd166',
    boost: 1.05, shieldStart: 16, magnet: 1.35, tag: 'Тяжёлая броня: +1 жизнь', perk: 'armor' },
  { id: 7, name: 'Патрульный', cost: 6500, pcost: 1300, lvl: 14, shape: 'sport', body: '#f2f6ff', roof: '#10131f', glass: '#cfe9ff', acc: '#0b1020', bar: 1,
    boost: 1.40, shieldStart: 10, magnet: 1.70, tag: 'Хранитель порядка', perk: 'luck' },
  { id: 8, name: 'Титан', cost: 9000, pcost: 1800, lvl: 18, shape: 'muscle', body: '#ff6d2f', roof: '#3a1200', glass: '#ffd9c2', acc: '#ffe066',
    boost: 1.55, shieldStart: 12, magnet: 1.95, tag: 'Мощный двигатель', perk: 'combo' },
  { id: 9, name: 'Синий GT', cost: 12000, pcost: 2400, lvl: 20, shape: 'hyper', body: '#3b8cff', roof: '#0a1b3a', glass: '#cfe4ff', acc: '#7dff9b',
    boost: 1.25, shieldStart: 10, magnet: 1.50, tag: 'Тараньте препятствия ради очков', perk: 'smash' },
  { id: 10, name: 'Серебряная молния', cost: 15000, pcost: 3000, lvl: 22, shape: 'racer', body: '#dfe8ff', roof: '#2b3550', glass: '#9fe8ff', acc: '#00e5ff',
    boost: 1.70, shieldStart: 4, magnet: 1.30, tag: 'Быстрая смена полосы', perk: 'brakes' },
  { id: 11, name: 'Огненный щит', cost: 18500, pcost: 3700, lvl: 24, shape: 'muscle', body: '#ff3b30', roof: '#3a0a06', glass: '#ffd7c2', acc: '#ffb02e', scoop: 1,
    boost: 1.45, shieldStart: 18, magnet: 1.60, tag: 'Восстанавливающийся щит', perk: 'sregen' },
  { id: 12, name: 'Ветер', cost: 23000, pcost: 4600, lvl: 26, shape: 'hyper', body: '#7dff9b', roof: '#04140c', glass: '#e6fff2', acc: '#00e5ff', wing: 2,
    boost: 1.65, shieldStart: 8, magnet: 1.75, tag: 'Двойной прыжок в воздухе', perk: 'djump' },
  { id: 13, name: 'Золотой GT', cost: 28000, pcost: 5600, lvl: 28, shape: 'sport', body: '#ffd166', roof: '#4a3208', glass: '#fff6d8', acc: '#ff9a3c',
    boost: 1.30, shieldStart: 22, magnet: 2.10, tag: 'Одно воскрешение после потери жизней', perk: 'revive' },
  { id: 14, name: 'Легенда F1', cost: 35000, pcost: 7000, lvl: 30, shape: 'hyper', body: '#00e5ff', roof: '#06121f', glass: '#bff5ff', acc: '#ff2fb9', wing: 3, nose: 1,
    boost: 1.85, shieldStart: 12, magnet: 1.85, tag: 'ЛЕГЕНДА — самая мощная машина', perk: 'ghost' }
];
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
  c.mesh = buildCar(p.body, p.roof, p.glass, p.acc, c.shape, c);
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

MESHES.car = buildCar('#ff2b43', '#2a0710', '#ffd7dd', '#ff8ea0');

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
function toast(msg, ms = 1500) {
  el.toast.textContent = msg; el.toast.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.toast.classList.remove('on'), ms);
}
function renderLives() {
  el.lives.innerHTML = '';
  for (let i = 0; i < G.maxLives; i++) {
    const s = document.createElement('i');
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
  if (G.onGround) { G.vy = 5.8 * (G.jumpV || 1); G.onGround = false; G.jumpsLeft = G.extraJumps || 0; Sound.blip(300, .12, 'sine', .18); lessonEvent('jump'); }
  else if ((G.jumpsLeft || 0) > 0) {
    G.jumpsLeft--;
    G.vy = 5.2 * (G.jumpV || 1);
    Sound.blip(560, .12, 'triangle', .2);
    addFloatingText(G.x, G.y + 1.1, 0, 'ДВОЙНОЙ ПРЫЖОК!', '#7dffe4');
    burst(G.x, G.y, 0, 12, '#7dffe4', .55);
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
  const t = e.touches[0], dx = t.clientX - tx0, dy = t.clientY - ty0;
  if (!swiped && Math.abs(dx) > 44) { moveLane(dx > 0 ? 1 : -1); swiped = true; tx0 = t.clientX; }
  else if (!swiped && dy < -46) { jump(); swiped = true; }
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!swiped && performance.now() - tt0 < 420) {
    const x = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : tx0);
    moveLane(x > W / 2 ? 1 : -1);
  }
}, { passive: true });
const bind = (id, dn, up) => {
  const n = document.getElementById(id); if (!n) return;
  n.addEventListener('touchstart', (e) => { e.preventDefault(); Sound.ensure(); dn(); }, { passive: false });
  n.addEventListener('touchend', (e) => { e.preventDefault(); if (up) up(); }, { passive: false });
  n.addEventListener('mousedown', dn); n.addEventListener('mouseup', up); n.addEventListener('mouseleave', up);
};
bind('tL', () => moveLane(-1)); bind('tR', () => moveLane(1)); bind('tJ', () => jump());
bind('tB', () => { G.boostOn = true; }, () => { G.boostOn = false; });
$('#tP').addEventListener('click', togglePause);
canvas.addEventListener('click', () => { Sound.ensure(); Sound.resume(); if (G.paused) togglePause(); });

/* --------------------------- OBʼYEKTLAR / SPAWN --------------------------- */
const POOL = [];
function addObj(kind, lane, z, opt) {
  const o = POOL.pop() || {};
  o.kind = kind; o.lane = lane; o.x = LANES[lane]; o.z = z; o.y = OBJ[kind].y;
  o.rot = Math.random() * 6.28; o.taken = false; o.dead = false; o.sway = 0; o.hit = 0;
  if (opt) for (const k in opt) o[k] = opt[k];
  G.objs.push(o);
  return o;
}
function freeObj(o) { if (POOL.length < 90) POOL.push(o); }

/** Qoida: har qatorda kamida BITTA yoʼlak butunlay boʼsh boʼladi. */
function spawnRow(z) {
  const lv = G.level;
  const hz = currentBiome().hz || 1;   // biom qiyinligi — tosiqlar zichligi
  const open = Math.floor(Math.random() * 3);
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
    if (k) addObj(k, open, z + 5);
  }
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
  if (G.quality === 'low' && n > 10) n = 10;
  if (G.parts.length > 240) return;
  for (let i = 0; i < n; i++) {
    G.parts.push({ x, y, z, vx: (Math.random() - .5) * 6 * pow, vy: Math.random() * 5 * pow, vz: (Math.random() - .5) * 6 * pow,
      l: .45 + Math.random() * .5, t: 0, col, s: .07 + Math.random() * .13 });
  }
}

/* --------------------------- YO'LAR (QIYINLIK BO'YICHA) ---------------------------
   OSON · O'RTA · QIYIN · EKSTREMAL
   Yo'l har TRACK_SEC soniyada almashadi, QAYSI biomsga o'tish
   poyga qiyinligiga bog'liq (daraja + masofa). hz — tosiqlar zichligi koeffitsienti,
   diff — yulduzlar soni (banner va garajda ko'rsatiladi). props — yon manzara turi. */
const BIOMES = [
  { band: 0, diff: 1, hz: .78, name: 'НЕОНОВЫЙ ГОРОД', props: 'city', sky0: '#070a20', sky1: '#180b3c', sky2: '#40104a', sun0: '#ffe08a', sun1: '#ff2fb9', sun2: '#6d1fa0', road: 'rgba(21,23,43,0.85)', roadAlt: 'rgba(28,31,56,0.85)', neon: '#00e5ff', curbc: '#00e5ff', sil: '#060714', gnd0: '#100a26', gnd1: '#03030a', star: '#dfeaff' },
  { band: 0, diff: 1, hz: .86, name: 'ПАЛЬМОВОЕ ПОБЕРЕЖЬЕ', props: 'palm', sky0: '#031a33', sky1: '#0a3f6b', sky2: '#1f8fb8', sun0: '#fff3c4', sun1: '#ffd166', sun2: '#ff8a3c', road: 'rgba(16,38,52,0.85)', roadAlt: 'rgba(22,48,64,0.85)', neon: '#7dffd0', curbc: '#4fe0ff', sil: '#04202c', gnd0: '#0a3a4a', gnd1: '#02121c', star: '#dff6ff' },
  { band: 1, diff: 2, hz: .95, name: 'КРАСНАЯ ПУСТЫНЯ', props: 'cactus', sky0: '#2a1004', sky1: '#5c2408', sky2: '#a8471a', sun0: '#fff6d8', sun1: '#ffb02e', sun2: '#a83a06', road: 'rgba(58,33,22,0.85)', roadAlt: 'rgba(74,44,28,0.85)', neon: '#ffb02e', curbc: '#ff7a2f', sil: '#2a1206', gnd0: '#4a2a12', gnd1: '#180a04', star: '#ffe6c2' },
  { band: 1, diff: 2, hz: 1.02, name: 'КИБЕРМАТРИЦА', props: 'grid', sky0: '#02181a', sky1: '#052b2f', sky2: '#083e35', sun0: '#7dff9b', sun1: '#00e5ff', sun2: '#052e3b', road: 'rgba(14,31,36,0.85)', roadAlt: 'rgba(20,42,48,0.85)', neon: '#7dff9b', curbc: '#7dff9b', sil: '#04141a', gnd0: '#062018', gnd1: '#01080a', star: '#b9ffe4' },
  { band: 2, diff: 3, hz: 1.12, name: 'ЛЕДЯНЫЕ ГОРЫ', props: 'mesa', sky0: '#0a1030', sky1: '#1b2f66', sky2: '#4a79c4', sun0: '#ffffff', sun1: '#cfe9ff', sun2: '#5b8fd6', road: 'rgba(30,40,66,0.85)', roadAlt: 'rgba(40,52,82,0.85)', neon: '#bfe6ff', curbc: '#8ec9ff', sil: '#141f3d', gnd0: '#243456', gnd1: '#070c18', star: '#ffffff' },
  { band: 2, diff: 3, hz: 1.18, name: 'ДРЕВНЯЯ ПИРАМИДА', props: 'pyramid', sky0: '#1c1204', sky1: '#4a3208', sky2: '#8a6414', sun0: '#fff8d0', sun1: '#ffe08a', sun2: '#b07a10', road: 'rgba(46,36,20,0.85)', roadAlt: 'rgba(60,48,28,0.85)', neon: '#ffe08a', curbc: '#d9a441', sil: '#241a08', gnd0: '#3a2c14', gnd1: '#0e0a04', star: '#fff0c8' },
  { band: 2, diff: 3, hz: 1.22, name: 'ЛУННАЯ БАЗА', props: 'moon', sky0: '#080d22', sky1: '#172344', sky2: '#3b4262', sun0: '#e8f3ff', sun1: '#9db8de', sun2: '#465a82', road: 'rgba(24,31,48,0.88)', roadAlt: 'rgba(34,43,64,0.88)', neon: '#8de7ff', curbc: '#b6cfff', sil: '#101a30', gnd0: '#18243a', gnd1: '#060914', star: '#e4f2ff' },
  { band: 3, diff: 4, hz: 1.26, name: 'ХРУСТАЛЬНАЯ ДОЛИНА', props: 'crystal', sky0: '#0a0322', sky1: '#26064f', sky2: '#5c1290', sun0: '#ffd6fa', sun1: '#c08cff', sun2: '#2d0a5e', road: 'rgba(26,15,48,0.85)', roadAlt: 'rgba(38,22,66,0.85)', neon: '#c08cff', curbc: '#ff2fb9', sil: '#150636', gnd0: '#251044', gnd1: '#05010f', star: '#f0d9ff' },
  { band: 3, diff: 4, hz: 1.34, name: 'ВУЛКАНИЧЕСКОЕ КОЛЬЦО', props: 'volcano', sky0: '#140509', sky1: '#2c0a12', sky2: '#5c1a10', sun0: '#ffd9a0', sun1: '#ff8a3c', sun2: '#7a1e08', road: 'rgba(18,14,16,0.88)', roadAlt: 'rgba(28,20,22,0.88)', neon: '#ff9a3c', curbc: '#ffb02e', sil: '#180a0a', gnd0: '#241016', gnd1: '#060203', star: '#ffe4cf' }
];
const BAND_NAME = ['ЛЁГКАЯ', 'СРЕДНЯЯ', 'СЛОЖНАЯ', 'ЭКСТРЕМАЛЬНАЯ'];
const TRACK_SEC = 45;           // Biomlar 45 soniyada bir almashadi
const TRANS_DUR = 1.7;          // biom almashish animatsiyasi (soniya)
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
  const available = BIOMES.map((bm, i) => i).filter(i => i !== G.trackIdx);
  const idx = available[Math.floor(Math.random() * available.length)];
  G.prevTrackIdx = G.trackIdx;
  G.trackIdx = idx;
  G.trackT = 0;
  G.trans = auto ? 0 : TRANS_DUR;
  _bmMixKey = '';
  const nb = trackBiome();
  buildBackdrop();
  if (auto) {
    G.flash = Math.max(G.flash, .5);
    toast('🛣 ' + nb.name + ' · ' + BAND_NAME[nb.band] + ' (' + '★'.repeat(nb.diff) + ')', 2800);
    Sound.chord([392, 523, 659, 784, 1046], .5, .17);
    for (let i = 0; i < 3; i++) burst((i - 1) * 1.15, .4 + i * .5, 9 + i * 4, 12, nb.neon, 1.5);
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
  const N = G.quality === 'low' ? 70 : 150;
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
    G.buildings.push({ x: bx, w: bw, h: bh, wins });
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
}

/* --------------------------- RUN --------------------------- */
function bankCoins() { store.set('coins', G.coins); }
function startRun() {
  hide(el.scrMenu); hide(el.scrOver); hide(el.scrCards); hide(el.scrPause); hide(el.scrRevive); hide(el.scrHow);
  for (const o of G.objs) freeObj(o);
  Object.assign(G, {
    running: true, paused: false, over: false, t: 0, dist: 0, score: 0, lives: 4, maxLives: 4,
    level: 1, nextLevelAt: 1000, levelAt: 0, levelFrom: 0, baseSpeed: 15, bestCombo: 1, speed: 15, maxSpeed: 15, boost: 0, boostOn: false,
    energon: 100, energonMax: 100, nitroT: 0, magnet: 0, magnetMax: 5, shield: 0, shieldMax: 0,
    invul: 1.2, coinMult: 1, comboHold: 3.4, combo: 1, comboT: 0, jumpV: 1, smashBonus: 0, brakePow: 0,
    lane: 1, laneX: 0, x: 0, y: 0, vy: 0, onGround: true, tilt: 0, yaw: 0, runCoins: 0,
    objs: [], parts: [], texts: [], nearMisses: 0, coinStreak: 0, spawnGap: 15, shake: 0, flash: 0, upgrades: {}, revived: false,
    trackIdx: -1, prevTrackIdx: null, trackT: 0, trans: 99,
    trackCheckpointWait: CHECKPOINT_TRACK_GAP
  });
  nextTrack(false);
  G.trans = 99;   // poyga boshlanishida almashuv animatsiyasi boʼlmaydi
  const c = car();
  G.shield = c.shieldStart; G.shieldMax = Math.max(6, c.shieldStart);
  G.magnetMax = 5 * c.magnet; G.boostRate = c.boost;
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
  store.set('meta', G.meta);
  /* --- ⭐ ochko va 🪙 tanga hisobga olinadi --- */
  const pts = ACCT.runPoints(G);
  const rec = Math.floor(G.score) > prevBest && G.score > 0;
  G.lastPts = pts;
  ACCT.add(pts);
  bankCoins();
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
    ['МАКС. СКОРОСТЬ', Math.round(G.maxSpeed * 3.6) + ' км/ч'],
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
  toast(u.ic + ' ' + u.name + ' kuchaytirildi');
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
function updateHUD() {
  el.score.textContent = num(G.score);
  el.dist.textContent = km(G.dist);
  el.coins.textContent = num(G.coins);
  el.speed.innerHTML = Math.round(G.speed * 3.6) + '<i>км/ч</i>';
  el.boostBar.style.width = Math.max(0, Math.min(100, G.energon / G.energonMax * 100)) + '%';
  el.magBar.style.width = Math.max(0, Math.min(100, G.magnet / G.magnetMax * 100)) + '%';
  el.shBar.style.width = Math.max(0, Math.min(100, G.shield / Math.max(.001, G.shieldMax) * 100)) + '%';
  // Keyingi darajagacha bo'lgan yo'l — HUD tepasidagi ingichka progress chizig'i
  const from = G.levelFrom || 0, span = Math.max(1, G.nextLevelAt - from);
  if (el.mileBar) el.mileBar.style.width = (Math.max(0, Math.min(1, (G.dist - from) / span)) * 100).toFixed(1) + '%';
  if (el.lvlNum) el.lvlNum.textContent = G.level;
  if (el.lvlNext) el.lvlNext.textContent = G.level + ' → ' + (G.level + 1) + ' · ' + num(levelNeed(G.level)) + ' м';
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
  const want = G.baseSpeed + (lv * .5 + dp * 3.2) * (G.rampMul || 1);
  const brake = (keys['s'] || keys['arrowdown']) ? .58 : 1;
  let target = want * brake;
  if (G.nitroT > 0) { G.nitroT -= dt; target *= 1.75; }
  if (G.boostOn && G.energon > 0) {
    target *= 1.45;
    G.boost = Math.min(1, G.boost + dt * 2.4);
    G.energon = Math.max(0, G.energon - dt * 15 * (G.drainMul || 1) / (G.boostRate || 1));
  } else G.boost = Math.max(0, G.boost - dt * 1.9);
  G.maxSpeed = Math.max(G.maxSpeed, target);
  G.speed += (target - G.speed) * Math.min(1, dt * 3.2);
  G.dist += G.speed * dt;
  G.score += G.speed * dt * 1.1 * G.combo * (G.scoreMul || 1);

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
  G.laneX += (laneTarget - G.laneX) * Math.min(1, dt * (8 + G.brakePow * 4));
  G.x = G.laneX;
  G.tilt += ((laneTarget - G.laneX) * .14 - G.tilt) * Math.min(1, dt * 9);
  G.yaw = G.tilt * .45;

  // sakrash
  if (!G.onGround || G.y > 0) {
    G.vy -= 15.5 * dt;
    G.y += G.vy * dt;
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
      if (dd < 12 && o.z > 0) { o.x += ddx * dt * 5.5; o.z -= dt * 7; }
    }
  }
  let far = 0;
  for (const o of G.objs) if (o.z > far) far = o.z;
  let guard = 0;
  while (far < 88 && guard++ < 3) { const nz = Math.max(58, far + 10 + Math.random() * 4); spawnRow(nz); far = nz + 4; }
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

    if (o.z > 1.15 || o.z < -1.5) continue;

    if (HAZARD[o.kind]) {
      const canJump = JUMPABLE[o.kind] && G.y > (o.kind === 'bar' ? .95 : .8);
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
          G.shield = 0; o.dead = true; bumpCombo(-1); G.invul = .9;
          burst(o.x, 1, o.z, 14, '#46ff8f', 1.4); Sound.blip(660, .18, 'sine', .26);
          addFloatingText(G.x, 1.8, 0, '🛡 ЩИТ СПАС', '#46ff8f');
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
        G.coinStreak = (G.coinStreak || 0) + 1;
        Sound.scaleChime(G.coinStreak % 9, 0.18);
        addFloatingText(o.x, 1.3, o.z, '+' + currency, '#ffd166');
        lessonEvent('coin');
      } else if (o.kind === KIND.NITRO) {
        G.energon = Math.min(G.energonMax, G.energon + 55); G.nitroT = Math.max(G.nitroT, 2.4);
        burst(o.x, 1, o.z, 12, '#00e5ff', 1.2); Sound.chord([700, 1000], .22, .16); toast('⚡ НИТРО!');
        addFloatingText(o.x, 1.4, o.z, '⚡ УСКОРЕНИЕ НИТРО', '#00e5ff');
        lessonEvent('nitro');
      } else if (o.kind === KIND.SH) {
        G.shield = Math.max(G.shield, 10); G.shieldMax = Math.max(G.shieldMax, 10);
        Sound.chord([520, 700], .2, .15); toast('🟢 Щит на 10 с');
        addFloatingText(o.x, 1.4, o.z, '🛡 ЩИТ +10 с', '#46ff8f');
      } else if (o.kind === KIND.MAG) {
        G.magnet = Math.max(G.magnet, G.magnetMax);
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

  // Suzuvchi yozuvlarni yangilash
  if (G.texts && G.texts.length) {
    for (const ft of G.texts) {
      ft.t += dt; ft.y += dt * 1.5; ft.z -= G.speed * dt * 0.25;
    }
    G.texts = G.texts.filter(ft => ft.t < ft.l);
  }

  for (const p of G.parts) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt - dz * .35; p.vy -= 9 * dt;
    if (p.y < 0) { p.y = 0; p.vy *= -.4; }
  }
  if (G.parts.length) G.parts = G.parts.filter(p => p.t < p.l);

  CAM.x += (G.x * .30 - CAM.x) * Math.min(1, dt * 5);
  CAM.y = 2.25 + G.y * .14 + Math.sin(G.t * 2.2) * .02;
  CAM.fov = FOV_BASE + G.boost * 110;
  G.camRoll = G.tilt * .06;
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

/* Yon manzara: har bir yo'l o'z siluet turini chizadi */
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
        // Kiber matritsa — faqat neon kontur va gorizontal to'r
        ctx.strokeRect(bx, by, bw, bh);
        for (let r = 1; r < 5; r++) {
          const yy = by + bh * r / 5;
          ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx + bw, yy); ctx.stroke();
        }
        ctx.fillStyle = rgba(bm.neon, .5);
        ctx.fillRect(bx + bw * .35, by - 3, bw * .3, 3);
        ctx.fillStyle = sil;
        continue;
      }
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = bm.neon;
      ctx.globalAlpha = .65;
      const ww = bw / 4, wh = Math.max(2, bh / 9);
      for (const wpos of b.wins) ctx.fillRect(bx + ww * (wpos[0] + .4), by + wh * (wpos[1] + 1.2), ww * .5, wh * .6);
      ctx.globalAlpha = 1; ctx.fillStyle = sil;
    }
    ctx.restore(); return;
  }

  for (const s of (G.sil || [])) {
    const x = s.x * W + bpar, w = Math.max(6, s.w * W), h = s.h * H * 1.5, y = horizon;
    if (x < -60 || x > W + 60) continue;
    if (type === 'cactus') {
      // saguaro kaktusi: qalin poya + yuqoriga qaragan ikki qo'l
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
      ctx.rotate((s.k - .5) * .16);
      const th = h * .92, tw = Math.max(3, w * .11);
      // konussimon poya (pastda qalin, tepada ingichka)
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
    } else if (type === 'mesa') {
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w * .22, y - h); ctx.lineTo(x + w * .78, y - h); ctx.lineTo(x + w, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(bm.neon, .18);
      ctx.fillRect(x + w * .22, y - h, w * .56, Math.max(2, h * .08));
      ctx.fillStyle = sil;
    } else if (type === 'crystal') {
      ctx.beginPath();
      ctx.moveTo(x + w * .5, y - h * 1.35); ctx.lineTo(x + w * .82, y - h * .45);
      ctx.lineTo(x + w * .62, y); ctx.lineTo(x + w * .34, y);
      ctx.lineTo(x + w * .16, y - h * .5); ctx.closePath();
      ctx.globalAlpha = .85; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
      ctx.strokeStyle = rgba(bm.sun1 || bm.neon, .5);
      ctx.beginPath(); ctx.moveTo(x + w * .5, y - h * 1.35); ctx.lineTo(x + w * .5, y); ctx.stroke();
      ctx.strokeStyle = rgba(bm.neon, .38);
    } else if (type === 'pyramid') {
      // keng va past qiyofa — oddiy tog' uchlaridan farq qilsin
      const pw = w * 2.1, ph = h * .6, px = x + w * .5 - pw / 2;
      ctx.beginPath();
      ctx.moveTo(px, y); ctx.lineTo(px + pw * .5, y - ph); ctx.lineTo(px + pw, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba(bm.sun0 || bm.neon, .5);
      ctx.beginPath(); ctx.moveTo(px + pw * .5, y - ph); ctx.lineTo(px + pw * .68, y); ctx.stroke();
      ctx.strokeStyle = rgba(bm.neon, .38);
    } else if (type === 'volcano') {
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w * .3, y - h * .8); ctx.lineTo(x + w * .7, y - h * .8); ctx.lineTo(x + w, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff6d2f'; ctx.globalAlpha = .9;
      ctx.fillRect(x + w * .3, y - h * .86, w * .4, Math.max(2, h * .07));
      ctx.globalAlpha = .35;
      ctx.fillStyle = bm.sun0 || '#ffb02e';
      ctx.beginPath(); ctx.arc(x + w * .5, y - h * .86, w * .45, Math.PI, 0); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = sil;
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
    } else {
      ctx.fillRect(x + w * .4, y - h * .7, w * .2, h * .7);
    }
  }
  ctx.restore();
}

function drawBackdrop() {
  const bm = currentBiome();
  const horizon = cy;
  // Dinamik osmon gradienti
  const sg = ctx.createLinearGradient(0, 0, 0, horizon);
  sg.addColorStop(0, bm.sky0);
  sg.addColorStop(0.5, bm.sky1);
  sg.addColorStop(1, bm.sky2);
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);

  // Yulduzlar
  ctx.save();
  ctx.fillStyle = bm.star || '#dfeaff';
  for (const s of G.stars) {
    ctx.globalAlpha = (.35 + .65 * Math.abs(Math.sin(G.t * 1.6 + s.tw))) * .85;
    ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
  }
  ctx.restore();

  // Quyosh (pulsatsiya va skanlaynlar bilan)
  const sunPulse = 1 + Math.sin(G.t * 1.8) * 0.025;
  const sunR = H * .17 * sunPulse, sunX = cx - CAM.x * 24, sunY = horizon - sunR * .55;
  ctx.save();
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, 6.283); ctx.clip();
  const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sunGrad.addColorStop(0, bm.sun0); sunGrad.addColorStop(.5, bm.sun1); sunGrad.addColorStop(1, bm.sun2);
  ctx.fillStyle = sunGrad; ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const yy = sunY + sunR * .08 + i * sunR * .16;
    ctx.fillRect(sunX - sunR, yy, sunR * 2, sunR * .035 + i * 1.0);
  }
  ctx.restore();

  // Uzoq tog'lar (yon manzara ajralib tursin — yarim shaffof)
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
  ctx.strokeStyle = rgba(bm.neon, 0.25); ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();

  // Yon manzara (har yo'l o'z manzarasini chizadi)
  const bpar = -CAM.x * 14;
  drawSilhouette(bm, horizon, bpar);

  // Yer
  const gnd = ctx.createLinearGradient(0, horizon, 0, H);
  gnd.addColorStop(0, bm.gnd0 || '#100a26'); gnd.addColorStop(1, bm.gnd1 || '#03030a');
  ctx.fillStyle = gnd; ctx.fillRect(0, horizon, W, H - horizon);

  // Neon gorizontal to'r (perspektiv qatlam)
  ctx.save();
  ctx.strokeStyle = rgba(bm.curbc, 0.16); ctx.lineWidth = 1;
  const gs = 8, gsc = G.dist % gs;
  for (let i = 1; i < 11; i++) {
    const z = i * gs - gsc + 4;
    proj([-48, 0, z], _a); proj([48, 0, z], _b);
    if (_a.vis && _b.vis) { ctx.beginPath(); ctx.moveTo(_a.x, _a.y); ctx.lineTo(_b.x, _b.y); ctx.stroke(); }
  }
  ctx.strokeStyle = rgba(bm.neon, 0.14);
  for (let gx = -42; gx <= 42; gx += 7) {
    proj([gx, 0, 4], _a); proj([gx, 0, 82], _b);
    if (_a.vis && _b.vis) { ctx.beginPath(); ctx.moveTo(_a.x, _a.y); ctx.lineTo(_b.x, _b.y); ctx.stroke(); }
  }
  ctx.restore();
}

/* ------------------- BIOM ALMASHGANDA ANIMATSIYA -------------------
   Bosqichlar: 0-0.25s siyish chiziqlari ekranni qoplaydi, 0.25-1.2s banner
   (yo'l nomi + qiyinlik) turadi, 1.2-1.7s hammasi silliq chiqib ketadi. */
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
  const inK = _ease(t / .3), outK = _ease((TRANS_DUR - t) / .55);
  const hold = Math.min(inK, outK);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // 1) Diagonal siyish chiziqlari (yangi yoʼl rangida, chapdan oʼngga)
  const sweep = _ease(t / .85);
  const bands = 7;
  ctx.globalAlpha = .42 * Math.max(0, 1 - t / .95);
  ctx.fillStyle = bm.neon;
  for (let i = 0; i < bands; i++) {
    const ph = i / bands;
    const x = (-.45 + sweep * 1.85 - ph * .3) * W;
    const bw = W * (.11 - ph * .012);
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + bw, 0); ctx.lineTo(x + bw - H * .42, H); ctx.lineTo(x - H * .42, H);
    ctx.closePath(); ctx.fill();
  }

  // 2) Yuqori/past karinchalar (gorizontal zaryad)
  const barY = [H * .5 - (1 - hold) * H * .6, H * .5 + (1 - hold) * H * .6];
  ctx.globalAlpha = .85 * hold;
  ctx.fillStyle = rgba(bm.curbc || bm.neon, .85);
  ctx.fillRect(0, barY[0] - H * .004, W, H * .008);
  ctx.fillRect(0, barY[1] - H * .004, W, H * .008);

  // 3) Yumshoq vinyetka — banner o'qilishi uchun
  ctx.globalAlpha = 1;
  const vg = ctx.createLinearGradient(0, H * .12, 0, H * .58);
  vg.addColorStop(0, 'rgba(2,3,12,' + (0.72 * hold).toFixed(3) + ')');
  vg.addColorStop(1, 'rgba(2,3,12,0)');
  ctx.fillStyle = vg; ctx.fillRect(0, H * .12, W, H * .46);

  // 4) Banner
  const fs = Math.max(16, Math.min(W * .085, H * .085));
  const sm = Math.max(10, fs * .40);
  const name = bm.name;
  const lab = '🛣  НОВАЯ ТРАССА';
  const stars = '★'.repeat(bm.diff) + '☆'.repeat(Math.max(0, 4 - bm.diff));
  const sub = BAND_NAME[bm.band] + ' · ' + stars;
  ctx.font = '900 ' + fs + 'px system-ui, "Segoe UI", Arial';
  if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(fs * .06) + 'px';
  const wMain = ctx.measureText(name).width;
  ctx.font = '900 ' + sm + 'px system-ui, "Segoe UI", Arial';
  const wSub = Math.max(ctx.measureText(sub).width, ctx.measureText(lab).width);
  const pw = Math.min(W * .94, Math.max(wMain, wSub) + fs * 2.1);
  const ph2 = fs * 2.5;
  const slide = (1 - _ease(t / .42)) * W * .16;
  const px = cx + slide, py = H * (H > W ? .30 : .27);
  ctx.globalAlpha = hold;

  ctx.shadowColor = rgba(bm.neon, .9); ctx.shadowBlur = fs * 1.1;
  ctx.fillStyle = 'rgba(6,9,22,' + (.82 * hold).toFixed(3) + ')';
  _rrect(px - pw / 2, py - ph2 / 2, pw, ph2, ph2 * .28); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(bm.curbc || bm.neon, .95); ctx.lineWidth = Math.max(1.4, fs * .07);
  _rrect(px - pw / 2, py - ph2 / 2, pw, ph2, ph2 * .28); ctx.stroke();

  ctx.font = '900 ' + sm + 'px system-ui, "Segoe UI", Arial';
  ctx.fillStyle = rgba(bm.sun1 || bm.neon, 1);
  ctx.fillText(lab, px, py - ph2 * .30);
  ctx.font = '900 ' + fs + 'px system-ui, "Segoe UI", Arial';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = rgba(bm.neon, .95); ctx.shadowBlur = fs * .6;
  ctx.fillText(name, px, py + ph2 * .02);
  ctx.shadowBlur = 0;
  ctx.font = '900 ' + sm + 'px system-ui, "Segoe UI", Arial';
  ctx.fillStyle = rgba(bm.curbc || bm.neon, 1);
  ctx.fillText(sub, px, py + ph2 * .32);

  // 5) Ostidagi chiziq chapdan oʼngga chiziladi
  const lw = pw * .8 * _ease(t / .5);
  ctx.fillStyle = rgba(bm.neon, .9);
  ctx.fillRect(px - pw * .4, py + ph2 * .5, lw, Math.max(2, fs * .07));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}

function drawRoad() {
  const bm = currentBiome();
  const segs = G.quality === 'low' ? 30 : 48;
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
      const k = Math.floor((G.dist - z) / (step * 2)) % 2 === 0;
      // asfalt
      ctx.fillStyle = k ? (bm.road || '#15172b') : (bm.roadAlt || '#1c1f38');
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half, prev.y); ctx.lineTo(prev.x + prev.half, prev.y);
      ctx.lineTo(row.x + row.half, row.y); ctx.lineTo(row.x - row.half, row.y);
      ctx.closePath(); ctx.fill();
      // yorqin neon yo'l chetlari (parvarishlovchi qirra)
      ctx.strokeStyle = rgba(bm.curbc || '#00e5ff', 0.4 + depth * 0.6);
      ctx.lineWidth = Math.max(1.2, 4.2 * depth);
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.half, prev.y); ctx.lineTo(row.x - row.half, row.y);
      ctx.moveTo(prev.x + prev.half, prev.y); ctx.lineTo(row.x + row.half, row.y);
      ctx.stroke();
      // qator ajratuvchi neon chiziqlar (uzluk-uzluk)
      if (Math.floor((G.dist - z) / step) % 2 === 0) {
        for (const lx of [-1.2, 1.2]) {
          ctx.strokeStyle = 'rgba(255,255,255,' + (.2 + depth * .65) + ')';
          ctx.lineWidth = Math.max(.7, 2.4 * depth);
          ctx.beginPath();
          ctx.moveTo(prev.x + lx * prev.s, prev.y); ctx.lineTo(row.x + lx * row.s, row.y);
          ctx.stroke();
        }
      }
      // chetdagi neon ustunchalar
      if (i % 2 === 0 && depth > .08) {
        ctx.fillStyle = rgba(bm.neon || '#ff2fb9', 0.25 + depth * 0.7);
        const pw = Math.max(1.5, 4.5 * depth), ph = Math.max(3, 14 * depth);
        ctx.fillRect(prev.x - prev.half - 12 * depth, prev.y - ph, pw, ph);
        ctx.fillRect(prev.x + prev.half + 8 * depth, prev.y - ph, pw, ph);
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
    ctx.shadowColor = ft.col || '#ffd166'; ctx.shadowBlur = fontSize * .75;
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
  quad(o.x - m.patW, o.z - m.patL, o.x + m.patW, o.z + m.patL, .025,
    rgba(col, bad ? .24 : .18), rgba(col, .7));
  if (JUMPABLE[o.kind]) {
    // sariq "sakrash chizig'i": bu to'siqdan o'tish mumkin
    quad(o.x - m.patW * 1.05, o.z - m.patL - .62, o.x + m.patW * 1.05, o.z - m.patL - .18, .03,
      'rgba(255,209,102,.62)', 'rgba(255,209,102,.95)');
  }
}
/** Yumshoq neon nur — ochko beradigan narsalar yiroqdan ham ko'rinadi */
function drawGlow(pos, col, k) {
  proj([pos[0], pos[1] + .45, pos[2]], _b);
  if (!_b.vis || _b.dz > 54) return;
  const r = _b.s * k;
  if (r < 4) return;
  ctx.save();
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

function drawObj(o) {
  if (o.z > 56) return;
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
  drawBadge(o);
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
    const ug = ctx.createRadialGradient(_b.x, _b.y, 0, _b.x, _b.y, 1.8 * _b.s);
    ug.addColorStop(0, rgba(p.body, 0.45));
    ug.addColorStop(0.6, rgba(p.acc || '#00e5ff', 0.18));
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

  for (const f of faces) drawFace(f);

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

  // qalqon halqasi
  if (G.shield > 0) {
    proj([G.x, .5 + G.y, 0], _d);
    if (_d.vis) {
      ctx.save(); ctx.globalAlpha = .45 + .25 * Math.sin(G.t * 8);
      ctx.strokeStyle = '#46ff8f'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(_d.x, _d.y, 1.22 * _d.s, 0.96 * _d.s, 0, 0, 6.283); ctx.stroke();
      ctx.restore();
    }
  }
}

function render() {
  drawBackdrop();
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(G.camRoll); ctx.translate(-cx, -cy);
  drawRoad();

  // Checkpoint arch
  drawGate(G.nextLevelAt - G.dist);

  const list = [];
  for (const o of G.objs) { if (o.z > -1 && o.z < 90 && !o.dead) list.push({ z: o.z, t: 0, o }); }
  for (const p of G.parts) list.push({ z: p.z, t: 1, p });
  list.push({ z: .1, t: 2 });
  list.sort((a, b) => b.z - a.z);
  for (const d of list) {
    if (d.t === 1) drawPart(d.p);
    else if (d.t === 2) drawShip();
    else drawObj(d.o);
  }

  // Suzuvchi yozuvlar (Near Miss, Jump, Combo)
  drawFloatingTexts();

  if (G.boost > .12 && G.quality !== 'low') {
    ctx.save(); ctx.globalAlpha = G.boost * .45; ctx.strokeStyle = car().acc || '#00e5ff'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283 + G.t * 4, r0 = H * .16;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * .55);
      ctx.lineTo(cx + Math.cos(a) * H * .58, cy + Math.sin(a) * H * .32);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

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
  const now = ts / 1000;
  G.dt = Math.min(.05, now - (G.last || now)); G.last = now;
  G.frame++;
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  if (!G.running || G.paused) {
    if (!G.running) {
      G.t += G.dt; G.dist += 5 * G.dt;
      CAM.x += (Math.sin(G.t * .35) * 1.5 - CAM.x) * .02;
      // Garaj vitrinasi sekin aylanadi (menyu + GARAJ ochiq bo'lsa)
      const sh = $('#tabShips');
      if (!showcaseDragging && G.frame % 4 === 0 && el.scrMenu && !el.scrMenu.classList.contains('hidden') &&
          ((typeof menuView !== 'undefined' && menuView === 'home') || (sh && !sh.classList.contains('hidden')))) {
          showcaseRot += .012; updateShowcase();
        }
    }
    render(); return;
  }
  G.t += G.dt;
  update(G.dt);
  render();
  if (t0) {
    const ms = performance.now() - t0;
    G.frameMs += (ms - G.frameMs) * .1;
    if (G.frameMs > 22 && G.quality !== 'low') {
      if (++G.slowFrames > 90) { G.slowFrames = 0; G.quality = 'low'; resize(); buildBackdrop(); toast('⚙ Качество графики снижено для повышения производительности', 2000); }
    } else G.slowFrames = 0;
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
    ['Кадры/с', G.fps + ' · ' + (G.quality === 'low' ? 'низкое качество' : 'высокое качество')]
  ].map(r => '<kbd>' + r[0] + '</kbd><span>' + r[1] + '</span>').join('');
  $('#btnSnd').textContent = Sound.on ? 'ВКЛ' : 'ВЫКЛ';
  $('#btnMus').textContent = Sound.musicOn ? 'ВКЛ' : 'ВЫКЛ';
  $('#btnQual').textContent = G.quality === 'low' ? 'Низкая' : 'Высокая';
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
  const dpr = Math.min(window.devicePixelRatio || 1, G.quality === 'low' ? 1 : 2);
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
    const platGrad = c2.createRadialGradient(_b.x, _b.y, 0, _b.x, _b.y, platformScale * .82 * _b.s);
    platGrad.addColorStop(0, rgba(p.body, 0.45));
    platGrad.addColorStop(0.7, rgba(p.acc || '#00e5ff', 0.2));
    platGrad.addColorStop(1, 'rgba(0,0,0,0)');
    c2.fillStyle = platGrad;
    c2.beginPath(); c2.ellipse(_b.x, _b.y, platformScale * _b.s, platformScale * .36 * _b.s, 0, 0, 6.283); c2.fill();
    c2.strokeStyle = p.acc || '#00e5ff'; c2.lineWidth = Math.max(1.5, box.w / 360);
    c2.stroke();
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
  if (label) label.textContent = selected ? 'ВАША МАШИНА' : 'ПРЕДПРОСМОТР МОДЕЛИ';
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
  if (scT) scT.textContent = c.tag;
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
    return '<button class="' + cls + '" data-id="' + c.id + '" type="button" aria-pressed="' + selected + '" aria-label="' + c.name + ' — ' + status + '">' +
      '<canvas class="carPrev car-card-preview" data-id="' + c.id + '" width="336" height="184"></canvas>' +
      '<span class="car-card-name">' + c.name + '</span>' +
      '<span class="car-card-description">' + description + '</span>' +
      (!owned && !locked ? '<span class="car-card-price">🪙 ' + num(c.cost) + ' · ⭐ ' + num(c.pcost || 0) + '</span>' : '') +
      '<span class="car-card-meta"><span class="car-card-level">УР. ' + (c.lvl || 1) + '</span><span class="car-card-state">' + status + '</span></span>' +
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

const TABS = { ships: 'Ships', perk: 'Perk', skins: 'Skins', acct: 'Acct', stat: 'Stat', set: 'Set' };
function activateTab(name, selectedFilter) {
  const filterName = selectedFilter || (name === 'perk' ? 'upgrades' : name);
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
  if (name === 'perk' || name === 'acct') renderAcct();
  if (name === 'skins') renderSkinGallery();
  if (name === 'stat') menuStats();
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
  G.quality = G.quality === 'low' ? 'high' : 'low'; store.set('qual', G.quality);
  resize(); buildBackdrop(); renderShips(); menuStats();
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
  drawPrev, bankCoins, statHTML, toast, burst, bumpCombo, setHint, nextLesson, lessonEvent, lessonTick
};
