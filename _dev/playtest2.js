// Yangi (mashina) o'yin uchun moslashtirilgan testlar to'plami.
const sh = require('./shim.js');
const { run, results, win } = sh;
const out = [];
function T(label, code) { const r = run(label, code); out.push(label + ': ' + r); return r; }

const N = sh.sandbox.NY3D;
out.push('handle: ' + (N ? 'OK' : 'YO\'Q'));
if (!N) { console.log(out.join('\n') + '\n' + results.join('\n')); process.exit(1); }
out.push('initial: running=' + N.G.running + ' objs=' + N.G.objs.length + ' coins=' + N.G.coins + ' best=' + N.G.meta.best);
T('render-menu', 'NY3D.render(); "ok"');

// 1) uzoq sessiya
T('longrun', `(() => {
  const g = NY3D, G = g.G;
  g.startRun();
  let i = 0, err = null, levels = 0, cards = 0, collisions = 0, maxObjs = 0, maxFaces = 0, restarts = 0;
  const kinds = {};
  try {
    for (i = 0; i < 6000; i++) {
      if (G.paused) { g.pickCard(g.UPGRADES[(Math.random()*g.UPGRADES.length)|0].k); cards++; }
      if (!G.running) { G.lives = 3; g.startRun(); restarts++; }
      G.lives = Math.max(G.lives, 2);
      if (i % 19 === 0) g.moveLane(Math.random() < .5 ? -1 : 1);
      if (i % 37 === 0) g.jump();
      if (i % 91 === 0) G.boostOn = !G.boostOn;
      const before = G.lives;
      g.update(1/60);
      if (G.lives < before) collisions++;
      for (const o of G.objs) kinds[o.kind] = 1;
      maxObjs = Math.max(maxObjs, G.objs.length);
      levels = Math.max(levels, G.level);
      if (i % 6 === 0) { g.render(); }
    }
  } catch (e) { err = e.message + ' @' + i; }
  return JSON.stringify({ frames: i, err, dist: Math.round(G.dist), score: Math.round(G.score), levels, cards,
    collisions, restarts, coins: G.runCoins, maxObjs, kinds: Object.keys(kinds).sort().join(','),
    tut: G.tut, lesson: G.lesson, kmh: Math.round(G.maxSpeed * 3.6) });
})()`);

// 2) spawn qoidasi: har qatorda kamida bitta bo'sh yo'lak, dastlab faqat tangа
T('spawn-invariant', `(() => {
  const g = NY3D, G = g.G;
  g.startRun();
  let badRows = 0, hazardEarly = 0, rows = 0;
  for (let r = 0; r < 900; r++) {
    const z = 200 + r * 14;
    G.dist = 120 + r * 6;            // 110 m dan o'tgan rejim
    const before = G.objs.length;
    g.spawnRow(z);
    const added = G.objs.slice(before);
    const lanes = [0, 1, 2].map(l => added.some(o => o.lane === l && g.HAZARD[o.kind]));
    if (lanes.every(Boolean)) badRows++;
    rows++;
    G.objs.length = before;
  }
  G.dist = 20; G.objs.length = 0;
  for (let r = 0; r < 60; r++) { g.spawnRow(30 + r * 12); }
  for (const o of G.objs) if (g.HAZARD[o.kind] && o.kind !== 'bar' && o.kind !== 'wall') hazardEarly++;
  const earlyKinds = Array.from(new Set(G.objs.map(o => o.kind))).sort().join(',');
  return JSON.stringify({ rows, fullyBlockedRows: badRows, firstPhaseKinds: earlyKinds, badEarly: hazardEarly });
})()`);

// 3) xavf/mukofot vizual tili: har tur uchun badge + patch xatosiz chiziladi
T('semantics', `(() => {
  const g = NY3D, G = g.G;
  g.startRun(); G.objs.length = 0;
  const seen = { hazard: [], good: [] };
  for (const k of Object.keys(g.OBJ)) {
    const o = { kind: k, x: 0, z: 12, y: g.OBJ[k].y, rot: 0.4, lane: 1, taken: false, dead: false };
    g.drawObj(o);
    (g.HAZARD[k] ? seen.hazard : seen.good).push(k);
  }
  const missingMesh = Object.keys(g.OBJ).filter(k => k !== 'car' && !g.MESHES[k]);
  return JSON.stringify({ hazard: seen.hazard.join(','), good: seen.good.join(','), missingMesh });
})()`);

// 4) o'lim yo'li (qizil mashina) -> revive
T('deathpath', `(() => {
  const g = NY3D, G = g.G;
  g.startRun();
  G.lives = 1; G.shield = 0; G.invul = 0; G.boost = 0; G.boostOn = false; G.nitroT = 0; G.paused = false; G.tut = false;
  G.objs.length = 0;
  G.objs.push({ kind: g.KIND.CAR, x: G.x, z: 0.4, y: 0, rot: 0, lane: G.lane, taken: false, dead: false });
  g.update(1/60);
  return JSON.stringify({ running: G.running, lives: G.lives, reviveShown: !document.querySelector('#scrRevive').classList.contains('hidden') });
})()`);

// 5) sakrab o'tish: barjer ustidan — jon ketmaydi, devor ostidan — ketadi
T('jump-rule', `(() => {
  const g = NY3D, G = g.G;
  function trial(kind, y) {
    g.startRun();
    G.lives = 3; G.shield = 0; G.invul = 0; G.boost = 0; G.nitroT = 0; G.tut = false; G.paused = false;
    G.objs.length = 0; G.y = y; G.onGround = false; G.vy = 1;
    G.objs.push({ kind, x: G.x, z: 0.4, y: 0, rot: 0, lane: G.lane, taken: false, dead: false });
    const l0 = G.lives; g.update(1/60); return l0 - G.lives;
  }
  const barJumped = trial('bar', 1.2), wallJumped = trial('wall', 1.2);
  const coneJumped = trial('cone', 1.2), barRunOver = trial('bar', 0);
  g.startRun(); G.tut = false; G.jumpV = 1; g.jump();
  let jumpPeak = G.y;
  for (let i = 0; i < 90; i++) { g.update(1/60); jumpPeak = Math.max(jumpPeak, G.y); }
  if (jumpPeak <= 1 || jumpPeak >= 1.2) throw new Error('sakrash balandligi kutilganidan tashqari: ' + jumpPeak);
  return JSON.stringify({ barJumped, wallJumped, coneJumped, barRunOver, jumpPeak });
})()`);

// 6) o'qitish (lessons) ketma-ketligi
T('tutorial', `(() => {
  const g = NY3D, G = g.G;
  g.store.set('tutDone', false); G.tutDone = false;
  g.startRun();
  const seq = [];
  const read = () => seq.push(G.lesson + (document.querySelector('#hint').classList.contains('on') ? '*' : '-'));
  read();
  ['lane', 'lane', 'coin', 'coin', 'jump', 'avoid', 'nitro'].forEach(e => { g.lessonEvent(e); read(); });
  const tut = G.tut;
  for (let i = 0; i < 60 * 20; i++) g.lessonTick(1/60);
  return JSON.stringify({ seq: seq.join('>'), finished: !G.tut, tutAfterEvents: tut, legendDim: document.querySelector('#legend').classList.contains('dim') });
})()`);

// 7) garaj: daraja talabi bilan mashina olish / tanlash
T('shop', `(() => {
  const g = NY3D, G = g.G;
  g.ACCT.lvl = 1; g.ACCT.save();
  G.coins = 5000;
  const click = id => document.querySelector('#shipList').dispatch('click',
    { target: { closest: () => ({ dataset: { id: String(id) } }) } });
  click(3);
  const blocked = { car: G.car, owned3: g.store.get('owned3', false), coins: G.coins };
  g.ACCT.lvl = 20; g.ACCT.save();
  click(3);
  const bought = { car: G.car, coins: G.coins, owned: g.store.get('owned3', false) };
  click(1);
  g.renderShips();
  g.ACCT.lvl = 1; g.ACCT.pts = 0; g.ACCT.total = 0; g.ACCT.spent = 0; g.ACCT.save();
  g.store.set('owned1', false); g.store.set('owned3', false); g.store.set('car', 0); G.car = 0;
  return JSON.stringify({ blocked, bought, afterSelect: G.car, persisted: g.store.get('car', -1) });
})()`);

// 8) barcha kuchaytirishlar
T('allUpgrades', `(() => {
  const g = NY3D, G = g.G;
  g.startRun();
  g.UPGRADES.forEach(u => g.pickCard(u.k));
  return JSON.stringify({ n: Object.keys(G.upgrades).length, baseSpeed: +G.baseSpeed.toFixed(1), energonMax: G.energonMax,
    magnetMax: Math.round(G.magnetMax), jumpV: +G.jumpV.toFixed(2), coinMult: +G.coinMult.toFixed(2),
    maxLives: G.maxLives, lives: G.lives, smashBonus: G.smashBonus, brakePow: +G.brakePow.toFixed(2) });
})()`);

// 9) klaviatura + touch
T('keys', `(() => {
  const g = NY3D, G = g.G;
  g.startRun();
  const lane0 = G.lane;
  const kd = k => window.dispatch('keydown', { key: k, preventDefault() {} });
  const ku = k => window.dispatch('keyup', { key: k, preventDefault() {} });
  kd('ArrowLeft'); kd('ArrowLeft'); ku('ArrowLeft'); kd('a'); ku('a');
  kd(' '); ku(' '); kd('Shift');
  for (let i = 0; i < 40; i++) g.update(1/60);
  ku('Shift'); kd('p'); ku('p'); kd('p'); ku('p'); kd('m'); ku('m');
  const lane1 = G.lane;
  kd('ArrowRight'); kd('d'); ku('d'); kd('s'); ku('s');
  window.dispatch('resize', {});
  return JSON.stringify({ lane0, lane1, boostOn: G.boostOn, paused: G.paused, sound: g.Sound.on, jump: !G.onGround });
})()`);

// 10) menyu / pause / restart sikli
T('screens', `(() => {
  const g = NY3D, G = g.G;
  g.startRun(); g.togglePause(); g.togglePause();
  document.querySelector('#btnQuit').dispatch('click', {});
  document.querySelector('#btnHow').dispatch('click', {});
  document.querySelector('#btnHowBack').dispatch('click', {});
  document.querySelector('#btnPlay').dispatch('click', {});
  const a = { running: G.running };
  g.gameOver();
  document.querySelector('#btnMenu').dispatch('click', {});
  g.startRun(); g.render(); g.menuStats(); g.renderShips();
  for (let i = 0; i < 200; i++) { g.update(1/60); if (i % 4 === 0) g.render(); }
  return JSON.stringify({ afterPlay: a, over: G.over, running: G.running, fps: G.fps, frameMs: Math.round(G.frameMs * 10) / 10 });
})()`);

// 11) akkount iqtisodi: poygadan ochko, daraja oshirish, doimiy bonuslar
T('acct-economy', `(() => {
  const g = NY3D, G = g.G, A = g.ACCT;
  A.lvl = 1; A.pts = 0; A.total = 0; A.spent = 0; A.save();
  g.startRun();
  G.score = 12000; G.dist = 900; G.level = 5; G.runCoins = 120; G.meta.best = 1000;
  const want = A.runPoints(G);
  g.gameOver();
  const afterRun = { want, pts: A.pts, total: A.total, banked: g.store.get('coins', -1) >= 0 };
  A.pts = 500; A.save();
  const c1 = A.cost(1), ok = A.up();
  const afterUp = { ok, lvl: A.lvl, pts: A.pts, spent: A.spent, c1 };
  g.startRun();
  const lvl2 = { baseSpeed: +G.baseSpeed.toFixed(2), coinMult: +G.coinMult.toFixed(3) };
  A.lvl = 30; g.startRun();
  const maxed = { baseSpeed: +G.baseSpeed.toFixed(2), maxLives: G.maxLives, lives: G.lives,
    energonMax: G.energonMax, jumpV: +G.jumpV.toFixed(3), shieldMax: G.shieldMax };
  const noPts = (function () { A.lvl = 1; A.pts = 10; A.save(); return { up: A.up(), lvl: A.lvl }; })();
  A.lvl = 1; A.pts = 0; A.total = 0; A.spent = 0; A.save();
  return JSON.stringify({ afterRun, afterUp, lvl2, maxed, noPts });
})()`);

// 12) doimiy kuchlar: narx, daraja talabi, startRun'ga ta'siri, saqlanish
T('perm-upgrades', `(() => {
  const g = NY3D, G = g.G, A = g.ACCT, P = g.PERM;
  A.lvl = 1; A.pts = 0; A.spent = 0; A.save(); P.reset();
  g.startRun(); const b0 = +G.baseSpeed.toFixed(2);
  const noMoney = P.buyable(g.UPGRADES[0]);
  A.pts = 3000; A.save();
  const p1 = P.price(g.UPGRADES[0]), bought = P.buy(g.UPGRADES[0]);
  const blockedByLvl = P.buyable(g.UPGRADES.find(u => u.k === 'life'));
  g.startRun();
  const after = { baseSpeed: +G.baseSpeed.toFixed(2), rank: P.n('speed'), nextPrice: P.price(g.UPGRADES[0]),
    persisted: JSON.stringify(g.store.get('perm', null)) };
  A.lvl = 8; g.startRun();
  const before = G.maxLives, okLife = P.buy(g.UPGRADES.find(u => u.k === 'life'));
  g.startRun();
  const lives = { before: before, maxLives: G.maxLives, lives: G.lives };
  // maksimal rankdan keyin sotib bo'lmaydi
  let guard = 0; while (P.buyable(g.UPGRADES.find(u => u.k === 'brake')) === 'ok' && guard++ < 10) P.buy(g.UPGRADES.find(u => u.k === 'brake'));
  const maxedState = P.buyable(g.UPGRADES.find(u => u.k === 'brake'));
  P.reset(); A.lvl = 1; A.pts = 0; A.spent = 0; A.save();
  return JSON.stringify({ b0, noMoney, p1, bought, blockedByLvl, after, okLife, lives, maxedState });
})()`);

// 13) garaj ma'lumotlari: 9 mashina, har xil shakl, o'sib boruvchi narx/daraja
T('garage-data', `(() => {
  const g = NY3D;
  const bad = [];
  g.CARS.forEach((c, i) => {
    if (c.id !== i) bad.push('id@' + i);
    if (!(c.lvl >= 1)) bad.push('lvl@' + i);
    if (!(c.cost >= 0)) bad.push('cost@' + i);
    if (!(c.pcost >= 0)) bad.push('pcost@' + i);
    if (c.id !== 0 && !c.perk) bad.push('perk@' + i);
    if (c.perk && !g.PERKS[c.perk]) bad.push('perkDef@' + i);
    if (!g.SHAPES[c.shape]) bad.push('shape@' + i);
    if (!c.mesh || !c.mesh.f || !c.mesh.f.length) bad.push('mesh@' + i);
    if (!c.name || !c.tag) bad.push('txt@' + i);
    if (!(c.boost > 0 && c.magnet > 0)) bad.push('stat@' + i);
  });
  let mono = true;
  for (let i = 1; i < g.CARS.length; i++)
    if (g.CARS[i].cost <= g.CARS[i - 1].cost || g.CARS[i].lvl <= g.CARS[i - 1].lvl ||
      g.CARS[i].pcost <= g.CARS[i - 1].pcost) mono = false;
  const shapes = {}; g.CARS.forEach(c => { shapes[c.shape] = (shapes[c.shape] || 0) + 1; });
  g.ACCT.lvl = 1; g.ACCT.save(); g.G.coins = 0; g.renderShips();
  const html = document.querySelector('#shipList').innerHTML;
  g.ACCT.lvl = 30; g.G.coins = 99999; g.renderShips();
  const html2 = document.querySelector('#shipList').innerHTML;
  g.ACCT.lvl = 1; g.ACCT.save();
  return JSON.stringify({ cars: g.CARS.length, bad, monotonic: mono, shapes,
    lockChips: (html.match(/KERAK/g) || []).length,
    buyChips: (html2.match(/🪙/g) || []).length, ptsChips: (html2.match(/⭐/g) || []).length,
    perkChips: (html2.match(/cperk/g) || []).length });
})()`);

// 14) progress UI oqimi: game-over paneli, daraja tugmasi, kuchlar bo'limi
T('progress-ui', `(() => {
  const g = NY3D, G = g.G, A = g.ACCT;
  A.lvl = 1; A.pts = 0; A.total = 0; A.spent = 0; A.save(); g.PERM.reset();
  g.menuStats(); g.renderShips(); g.renderAcct(); g.renderPerks();
  const perkHtml = document.querySelector('#perkList').innerHTML;
  const acctHtml = document.querySelector('#acctInfo').innerHTML;
  G.coins = 900;
  g.startRun(); G.score = 5000; G.dist = 400; G.level = 3; G.runCoins = 50; G.meta.best = 999999; G.tut = false;
  g.gameOver();
  const over = { pts: document.querySelector('#oPts').textContent, cap: document.querySelector('#oAcctCap').textContent,
    bar: document.querySelector('#oBar').style.width, upShown: !document.querySelector('#btnOverUp').classList.contains('hidden') };
  document.querySelector('#btnOverUp').dispatch('click', {});
  const backToMenu = !document.querySelector('#scrMenu').classList.contains('hidden') && !G.over;
  A.pts = 100; A.save(); g.menuStats();
  document.querySelector('#btnAcctUp').dispatch('click', {});
  const lvlAfterBtn = A.lvl, ptsAfter = A.pts;
  A.pts = 3000; A.save();
  document.querySelector('#perkList').dispatch('click', { target: { closest: () => ({ dataset: { k: 'speed' } }) } });
  const rank = g.PERM.n('speed');
  ['perk', 'acct', 'ships', 'stat', 'set'].forEach(t => g.activateTab(t));
  const tabsOk = !document.querySelector('#tabSet').classList.contains('hidden') &&
    document.querySelector('#tabShips').classList.contains('hidden');
  g.activateTab('ships');
  g.startRun(); g.render(); g.menuStats();
  const clean = { lvl: A.lvl, perm: g.PERM.n('speed') };
  A.lvl = 1; A.pts = 0; A.total = 0; A.spent = 0; A.save(); g.PERM.reset();
  g.store.set('owned1', false); g.store.set('owned3', false); g.store.set('car', 0);
  return JSON.stringify({ perkRanks: /class="ranks"/.test(perkHtml), acctRows: (acctHtml.match(/perkline/g) || []).length,
    over, backToMenu, lvlAfterBtn, ptsAfter, rank, tabsOk, clean });
})()`);


// 15) Skinlar: ochish, saqlash, mesh qayta qurish, vitrina chip'lari
T('skins', `(() => {
  const g = NY3D, A = g.ACCT, c = g.CARS[0], c2 = g.CARS[1];
  A.lvl = 1; A.save();
  const lockedIdx = g.SKINS.findIndex(s => (s.lvl || 1) > 1);
  g.store.set(g.skinKey(c.id), lockedIdx);
  g.applySkin(c);
  const fallback = g.skinIdx(c) === 0 && c.pal.body === c.body;   // daraja past -> zavod rangi
  A.lvl = 30; A.save();
  const pick = g.SKINS.findIndex((s, i) => i > 2 && s.pal);
  g.store.set(g.skinKey(c.id), pick); g.applySkin(c);
  const applied = c.pal.body === g.SKINS[pick].pal.body;
  const inMesh = c.mesh.c.indexOf(g.SKINS[pick].pal.body) >= 0 && c.mesh.v.length > 20;
  g.store.set(g.skinKey(c2.id), 0); g.applySkin(c2);
  const independent = c2.pal.body === c2.body && c.pal.body !== c2.pal.body;
  g.G.car = 0; g.renderShips();
  // vitrinani 0-mashinaga qaratamiz (chip bosilganda shu mashinaga qo'llanadi)
  document.querySelector('#shipList').dispatch('click', { target: { closest: () => ({ dataset: { id: '0' } }) } });
  const html = document.querySelector('#skinPicker').innerHTML;
  const chips = (html.match(/skin-chip/g) || []).length;
  const hasActive = /skin-chip active/.test(html);
  g.store.set(g.skinKey(c.id), 0); g.applySkin(c); A.lvl = 1; A.save(); g.renderShips();
  const html2 = document.querySelector('#skinPicker').innerHTML;
  const lockedChips = (html2.match(/ lock/g) || []).length;
  document.querySelector('#skinPicker').dispatch('click', { target: { closest: () => ({ dataset: { sk: String(lockedIdx) } }) } });
  const blockedWhileLocked = g.store.get(g.skinKey(c.id), 0) === 0 && g.skinIdx(c) === 0;
  A.lvl = 30; A.save();
  document.querySelector('#skinPicker').dispatch('click', { target: { closest: () => ({ dataset: { sk: String(lockedIdx) } }) } });
  const unlockedApplied = g.skinIdx(c) === lockedIdx && c.pal.body === g.SKINS[lockedIdx].pal.body;
  g.store.set(g.skinKey(c.id), 0); g.store.set(g.skinKey(c2.id), 0);
  g.applySkin(c); g.applySkin(c2); g.G.car = 0; A.lvl = 1; A.save();
  return JSON.stringify({ skins: g.SKINS.length, fallback, applied, inMesh, independent, chips, hasActive,
    lockedChips, blockedWhileLocked, unlockedApplied });
})()`);

// 16) Responsiv: har xil ekran o'lchamida FOV, gorizont va chizish
T('responsive', `(() => {
  const g = NY3D, win = window, P = { x: 0, y: 0, s: 0, dz: 0, vis: true };
  const sizes = [[320, 560], [360, 740], [390, 844], [844, 390], [768, 1024], [1024, 600], [1440, 900], [1920, 1080]];
  const rows = [];
  let err = null;
  try {
    for (const s of sizes) {
      win.innerWidth = s[0]; win.innerHeight = s[1];
      g.resize();
      g.CAM.x = 0;
      const pOut = g.proj([g.LANES[2], 0, 0], P);            // chetki qator (o'yinchi balandligida)
      const lanePx = Math.abs(pOut.x - s[0] / 2);
      const hor = g.proj([0, 0, 900], P).y;                  // ufq: uzoq nuqta = cy
      g.render();
      rows.push({ w: s[0], h: s[1], fov: Math.round(g.CAM.fov), laneRatio: +(lanePx / (s[0] / 2)).toFixed(2),
        horR: +(hor / s[1]).toFixed(2), fits: lanePx <= s[0] / 2, horOk: hor > s[1] * .25 && hor < s[1] * .62 });
    }
  } catch (e) { err = e.message; }
  win.innerWidth = 390; win.innerHeight = 844; g.resize(); const portrait = g.G.portrait === true;
  win.innerWidth = 844; win.innerHeight = 390; g.resize(); const landscape = g.G.portrait === false;
  win.innerWidth = 1280; win.innerHeight = 720; g.resize();
  const cvs = document.querySelector('#cvShowcase');
  cvs.clientWidth = 300; cvs.clientHeight = 150;
  const fit1 = g.fitShowcase(cvs);
  const fit2 = g.fitShowcase(cvs);
  return JSON.stringify({ err, allFit: rows.every(r => r.fits), horizonOk: rows.every(r => r.horOk),
    lane: rows.map(r => r.w + 'x' + r.h + ':' + r.laneRatio).join(' '),
    fovRange: [Math.min.apply(0, rows.map(r => r.fov)), Math.max.apply(0, rows.map(r => r.fov))],
    portrait, landscape, fitStable: fit1.w === fit2.w && fit1.dpr === fit2.dpr, fit: fit1 });
})()`);

// 17) Tosiqlar/to'plarni chizish: xatosiz + meshlar to'liq
T('objects-draw', `(() => {
  const g = NY3D, G = g.G;
  g.startRun(); G.tut = false; g.setHint(-1); G.objs.length = 0;
  const kinds = ['car', 'truck', 'bar', 'wall', 'cone', 'coin', 'nitro', 'shield', 'magnet', 'life'];
  let err = null, drawn = 0;
  try {
    kinds.forEach((k, i) => { g.addObj(k, i % 3, 6 + i * 2); });
    for (const o of G.objs) {
      const mesh = o.kind === 'car' ? g.MESHES.car : g.MESHES[o.kind];
      if (!mesh || !g.facesOf(mesh, [o.x, 0, o.z], 0, 1).length) throw new Error('bo\\'sh mesh: ' + o.kind);
      g.drawObj(o); drawn++;
    }
    G.t = 1.2;
    for (const o of G.objs) { o.z = 40; g.drawObj(o); o.z = 2; g.drawObj(o); }
    g.render();
  } catch (e) { err = e.message; }
  const coinFaces = g.MESHES.coin.f.length;
  const zs = g.MESHES.coin.v.map(v => v[2]);
  const thickCoin = Math.max.apply(0, zs) > 0 && Math.min.apply(0, zs) < 0 && coinFaces > 12;
  // qirg'oq (edge-on) holatda ham ko'rinadigan yuzalar bo'lishi kerak
  const edgeFaces = g.facesOf(g.MESHES.coin, [0, 1, 12], Math.PI / 2, 1).length;
  const jumpable = { bar: !!g.JUMPABLE.bar, cone: !!g.JUMPABLE.cone, wall: !g.JUMPABLE.wall };
  G.objs.length = 0; G.running = false;
  return JSON.stringify({ err, drawn, coinFaces, thickCoin, edgeFaces, jumpable });
})()`);

// 18) Mashinani ⭐ ochko bilan sotib olish (🪙 tanba — muqobil yo'l)
T('buy-points', `(() => {
  const g = NY3D, G = g.G, A = g.ACCT;
  const c5 = g.CARS[5], c6 = g.CARS[6];
  A.lvl = 30; A.pts = 9000; A.save();
  g.store.set('owned5', false); g.store.set('owned6', false);
  G.car = 0; G.coins = 100;                        // tanba yetmaydi
  const p0 = A.pts;
  const byPts = g.tryBuy(c5, true);
  const spentPts = p0 - A.pts;
  const owned5 = !!g.store.get('owned5', false) && G.car === 5;
  // avtomatik tanlov: tanba yetishmasa ochkoga o'tadi
  const p1 = A.pts; G.coins = 1;
  const auto = g.tryBuy(c6, undefined);
  const autoUsedPts = p1 - A.pts === c6.pcost;
  // tanba bilan to'lash: 7-mashina
  const c7 = g.CARS[7]; const p2 = A.pts; G.coins = 999999; const c0coins = G.coins;
  const byCoins = g.tryBuy(c7, false);
  const coinsSpent = c0coins - G.coins === c7.cost && A.pts === p2;
  // daraja to'siqi
  const c9 = g.CARS[9]; A.lvl = 1; g.store.set('owned9', false);
  const p3 = A.pts, coin3 = G.coins;
  const blocked = g.tryBuy(c9, false);
  const untouched = blocked === false && A.pts === p3 && G.coins === coin3 && !g.store.get('owned9', false);
  A.lvl = 30; A.save();
  return JSON.stringify({ byPts, spentPts, expect5: c5.pcost, owned5, auto, autoUsedPts,
    byCoins, coinsSpent, blocked: !blocked, untouched, pricePair: c5.cost === c5.pcost * 5 });
})()`);

// 19) Har bir mashinaning O'ZIGA XOS kuchi bor: 15 perk, takror yo'q, har biri amalda ishlaydi
T('car-perks', `(() => {
  const g = NY3D, G = g.G;
  const unknown = g.CARS.filter(c => c.perk && !g.PERKS[c.perk]).map(c => c.id);
  const noPerk = g.CARS.filter(c => !c.perk).map(c => c.id);
  const keys = Object.keys(g.PERKS);
  const seen = {}, dupes = [];
  g.CARS.forEach(c => { if (seen[c.perk]) dupes.push(c.id + ':' + c.perk); seen[c.perk] = 1; });
  const unused = keys.filter(k => !g.CARS.some(c => c.perk === k));
  const snap = () => ({ lives: G.maxLives, coin: G.coinMult, drain: G.drainMul, speed: G.baseSpeed,
    boost: G.boostRate, regen: G.shieldRegen, dj: G.extraJumps, luck: G.luck, ghost: G.ghost,
    hold: G.comboHold, mag: G.magnetMax, brake: G.brakePow, smash: G.smashBonus,
    ramp: G.rampMul, score: G.scoreMul, rev: G.reviveFree });
  const inert = [];
  for (const k of keys) {
    g.startRun(); g.applyPerk(null);
    const b = snap(); g.applyPerk(k); const a = snap();
    if (Object.keys(b).every(f => b[f] === a[f])) inert.push(k);
  }
  // 1) nitro tejamkorligi amalda ishlashi
  const runBoost = (p) => { g.startRun(); G.tut = false; G.boostOn = true; G.energon = 100; g.applyPerk(p);
    for (let i = 0; i < 120; i++) { G.objs.length = 0; g.update(1 / 60); } return +(100 - G.energon).toFixed(2); };
  const plainUsed = runBoost(null), drainUsed = runBoost('drain');
  // 2) steady: daraja oshganda tezlik sekinroq ko'tariladi
  const runSpeed = (p) => { g.startRun(); G.tut = false; g.applyPerk(p); G.level = 6; G.nextLevelAt = 1e9;
    G.boostOn = false; G.combo = 1;
    for (let i = 0; i < 180; i++) { G.objs.length = 0; g.update(1 / 60); } return +G.maxSpeed.toFixed(2); };
  const speedPlain = runSpeed(null), speedSteady = runSpeed('steady');
  // 3) score: xuddi shu masofada ko'proq ochko
  const runScore = (p) => { g.startRun(); G.tut = false; g.applyPerk(p); G.level = 3; G.nextLevelAt = 1e9;
    G.boostOn = false; G.combo = 1;
    for (let i = 0; i < 180; i++) { G.objs.length = 0; G.combo = 1; g.update(1 / 60); } return Math.round(G.score); };
  const scorePlain = runScore(null), scoreMore = runScore('score');
  // 4) magnetup: magnit uzoqroq
  g.startRun(); g.applyPerk(null); const magPlain = G.magnetMax; g.applyPerk('magnetup'); const magUp = G.magnetMax;
  // 5) brakes: qator almashish chaqqonroq (18 kadrda yaqonroq)
  const runLane = (p) => { g.startRun(); G.tut = false; g.applyPerk(p); G.lane = 2; G.invul = 99;
    for (let i = 0; i < 18; i++) { G.objs.length = 0; g.update(1 / 60); }
    return +Math.abs(G.laneX - g.LANES[2]).toFixed(3); };
  const lanePlain = runLane(null), laneBrakes = runLane('brakes');
  // 6) smash: bufer kuchi ochko beradi
  g.startRun(); g.applyPerk(null); const smashPlain = G.smashBonus; g.applyPerk('smash'); const smashUp = G.smashBonus;
  // 7) revive: jon tugasa reklamasiz tiriladi
  g.startRun(); G.tut = false; g.applyPerk('revive'); G.lives = 0;
  const autoRev = g.maybeRevive(); const revUsed = G.reviveFree, revRunning = G.running, revLives = G.lives;
  g.startRun(); G.tut = false; g.applyPerk(null); G.lives = 0;
  const askRev = g.maybeRevive(); const askShown = !g.el.scrRevive.classList.contains('hidden');
  // 8) djump + sregen
  g.startRun(); G.tut = false; g.applyPerk('djump'); g.jump();
  const air1 = !G.onGround; g.jump(); const dblV = +G.vy.toFixed(2);
  g.startRun(); g.applyPerk(null); g.jump(); g.jump(); const singleV = +G.vy.toFixed(2);
  g.startRun(); G.tut = false; g.applyPerk('sregen'); G.shield = 0; G.invul = 99;
  let regenTick = 0;
  for (let i = 0; i < 60 * 8; i++) { G.dist += .1; g.update(1 / 60); if (G.shield > 0) { regenTick = i; break; } }
  const nitroSaves = +(plainUsed / Math.max(.001, drainUsed)).toFixed(2);
  const bad = [];
  if (keys.length !== 30 || g.CARS.length !== 30) bad.push('son:' + keys.length + '/' + g.CARS.length);
  if (dupes.length) bad.push('takror:' + dupes.join('|'));
  if (unused.length) bad.push('ishlatilmagan:' + unused.join('|'));
  if (inert.length) bad.push("ta'sirsiz:" + inert.join("|"));
  if (noPerk.length || unknown.length) bad.push('nomalum:' + noPerk.concat(unknown).join('|'));
  if (!(speedSteady < speedPlain)) bad.push('steady');
  if (!(scoreMore > scorePlain)) bad.push('score');
  if (!(magUp > magPlain)) bad.push('magnetup');
  if (!(laneBrakes < lanePlain)) bad.push('brakes');
  if (!(smashUp > smashPlain)) bad.push('smash');
  if (!(autoRev === true && revRunning === true && revLives === 1 && revUsed === 0)) bad.push('revive');
  if (!(askRev === false && askShown === true)) bad.push('revive-screen');
  if (!(nitroSaves > 1.3)) bad.push('drain');
  if (bad.length) throw new Error('PERK XATO: ' + bad.join(', '));
  return JSON.stringify({ perks: keys.length, cars: g.CARS.length, unknown, noPerk, dupes, unused, inert,
    nitroSaves,
    steadySlower: speedSteady < speedPlain, speedPlain, speedSteady,
    scorePerkMore: scoreMore > scorePlain, scorePlain, scoreMore,
    magPlain, magUp, magnetUpWorks: magUp > magPlain,
    lanePlain, laneBrakes, brakesSnappier: laneBrakes < lanePlain,
    smashPlain, smashUp,
    autoRevive: autoRev === true && revRunning === true && revLives === 1 && revUsed === 0,
    plainAsksAd: askRev === false && askShown === true,
    air1, dblV, singleV, doubleJumpWorks: dblV > 0 && singleV > 0 && dblV !== singleV,
    shieldRegenAfter: regenTick ? +(regenTick / 60).toFixed(1) : null });
})()`);

// 20) Yo'l: 2 daqiqada bir almashadi, qiyinlikka qarab biom tanlanadi, almashuv animatsiyali
T('track-rotation', `(() => {
  const g = NY3D, G = g.G;
  const bad = [];
  if (typeof g.updateHUDTrack !== "undefined") bad.push("updateHUDTrack qolgan");
  if (g.TRACK_SEC !== 45) bad.push("TRACK_SEC=" + g.TRACK_SEC);

  // --- metadata: 4 band, with one extra route in the difficult band ---
  const fields = ['name','props','sky0','sky1','sky2','sun0','sun1','sun2','road','roadAlt','neon','curbc','sil','gnd0','gnd1','star','band','diff','hz'];
  const incomplete = g.BIOMES.map((b,i)=>fields.filter(f=>b[f]==null||b[f]==='').length?i:-1).filter(i=>i>=0);
  if (incomplete.length) bad.push("maydon yo'q:" + incomplete.join("|"));
  const perBand = [0,0,0,0]; g.BIOMES.forEach(b=>perBand[b.band]++);
  if (perBand.join() !== "2,2,3,2") bad.push("band:" + perBand.join(","));
  const hzAsc = g.BIOMES.every((b,i)=> i===0 || g.BIOMES[i-1].hz <= b.hz);
  if (!hzAsc) bad.push("hz o'smayapti");
  const diffAsc = g.BIOMES.every((b,i)=> i===0 || g.BIOMES[i-1].diff <= b.diff);
  if (!diffAsc) bad.push("diff o'smayapti");
  if (g.mixColor("#000000","#ffffff",.5) !== "#808080") bad.push("mixColor:" + g.mixColor("#000000","#ffffff",.5));

  // --- A) Tasodifiy tanlov butun biomlar orasida va ketma-ket takrorlanmaydi ---
  const savedRandom = Math.random;
  let unrestrictedStart = -1, randomRoute = [];
  try {
    Math.random = () => .999;
    G.level = 1; G.dist = 0; G.trackIdx = -1;
    g.nextTrack(false);
    unrestrictedStart = G.trackIdx;
    randomRoute.push(G.trackIdx);
    for (let i = 0; i < g.BIOMES.length; i++) {
      const target = i;
      const available = g.BIOMES.map((bm, idx) => idx).filter(idx => idx !== G.trackIdx);
      if (target === G.trackIdx) continue;
      Math.random = () => (available.indexOf(target) + .1) / available.length;
      g.nextTrack(false);
      randomRoute.push(G.trackIdx);
    }
  } finally {
    Math.random = savedRandom;
  }
  const routeBands = new Set(randomRoute.map(i => g.BIOMES[i].band));
  if (unrestrictedStart !== g.BIOMES.length - 1) bad.push("boshlang'ich biom random tanlanmadi:" + unrestrictedStart);
  if (randomRoute.some((idx, i) => i > 0 && idx === randomRoute[i - 1])) bad.push("ketma-ket bir xil biom");
  if (new Set(randomRoute).size !== g.BIOMES.length) bad.push("hamma biomlar random aylanishida qatnashmadi");
  if (routeBands.size !== 4) bad.push("random tanlov qiyinlik bandlari bilan cheklangan");

  // --- B) daraja qotirilgan: almashinuv 45s taymer va checkpoint oralig'i bilan ---
  g.startRun(); G.tut = false; G.level = 1; G.nextLevelAt = 1e9;
  const orderA = [G.trackIdx];
  let timerSwitchSec = null, transAtSwitch = null;
  for (let i = 0; i < 60 * 51; i++) {
    G.lives = 9; G.energon = G.energonMax;
    const before = G.trackIdx;
    g.update(1/60);
    if (G.trackIdx !== before) {
      timerSwitchSec = +((i+1)/60).toFixed(1); transAtSwitch = G.trans; orderA.push(G.trackIdx);
    }
  }
  if (orderA.length !== 2) bad.push("A almashinuv soni:" + (orderA.length - 1));
  if (timerSwitchSec !== null && Math.abs(timerSwitchSec - 45) > 1.5) bad.push("A vaqt:" + timerSwitchSec);
  if (orderA.length > 1 && orderA[1] === orderA[0]) bad.push("biom takrorlandi");
  if (transAtSwitch !== null && transAtSwitch !== 0) bad.push("A trans:" + transAtSwitch);

  // --- C) animatsiya ~TRANS_DUR dan keyin tugaydi va palitra aralashadi ---
  G.trans = 0; let fullAfter = null;
  for (let i = 0; i < 60 * 3; i++) { g.update(1/60); if (G.trans >= g.TRANS_DUR && fullAfter === null) fullAfter = +((i+1)/60).toFixed(2); }
  if (fullAfter === null || fullAfter > g.TRANS_DUR + .1) bad.push("trans tugamadi:" + fullAfter);
  G.prevTrackIdx = (G.trackIdx + 1) % g.BIOMES.length;
  G.trans = g.TRANS_DUR * .45;
  const mixed = g.currentBiome(), pure = g.trackBiome();
  const blended = mixed.neon !== pure.neon && /^#[0-9a-f]{6}$/i.test(mixed.neon) && mixed.name === pure.name;
  G.trans = g.TRANS_DUR;
  const sameAfter = g.currentBiome() === pure;
  if (!blended) bad.push("palitra aralashmadi");
  if (!sameAfter) bad.push("palitra tozalanmadi");
  let err = null;
  try {
    for (const f of [0, .18, .35, .5, .72, .9, .99]) { G.trans = g.TRANS_DUR * f; g.render(); }
    G.trans = g.TRANS_DUR; g.render();
  } catch (e) { err = e.message; }
  if (err) bad.push("render:" + err);

  // --- D) tabiiy uzoq yugurish: ketma-ket biom takrorlanmaydi ---
  g.startRun(); G.tut = false;
  const seq = [G.trackIdx], sband = [g.BIOMES[G.trackIdx].band], sat = [];
  let switches = 0, dupConsec = 0, restarts = 0, mins = 0, checkpointSwitchOverlap = 0;
  let previousLevel = G.level, lastCheckpointSec = -Infinity;
  for (let i = 0; i < 60 * 60 * 7; i++) {
    G.lives = 9; G.energon = G.energonMax;
    if (!G.running) { restarts++; break; }
    const before = G.trackIdx;
    g.update(1/60);
    const nowSec = (i + 1) / 60;
    if (G.level !== previousLevel) lastCheckpointSec = nowSec;
    if (G.trackIdx !== before) {
      switches++; seq.push(G.trackIdx); sat.push(Math.round((i+1)/60)); sband.push(g.BIOMES[G.trackIdx].band);
      if (nowSec - lastCheckpointSec < 18) checkpointSwitchOverlap++;
    }
    previousLevel = G.level;
  }
  for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i-1]) dupConsec++;
  if (restarts) bad.push("o'yin uzildi");
  if (switches < 3) bad.push("almashinuv kam:" + switches);
  if (checkpointSwitchOverlap) bad.push("checkpoint bilan biom bir vaqtda:" + checkpointSwitchOverlap);
  if (dupConsec) bad.push("takror yo'l:" + dupConsec);
  mins = Math.round((60 * 60 * 7) / 60);

  const names = g.BIOMES.map(b=>b.name+"["+["OSON","ORTA","QIYIN","EKSTREMAL"][b.band]+"\u2605".repeat(b.diff)+"]").join(" | ");
  const props = Array.from(new Set(g.BIOMES.map(b=>b.props))).sort().join(",");
  return JSON.stringify({ bad, tracks: g.BIOMES.length, sec: g.TRACK_SEC, transDur: g.TRANS_DUR,
    timerSwitchSec, orderA: orderA.join(","), seq: seq.join(","), bands: sband.join(","), atSec: sat.join(","),
    switches, dupConsec, checkpointSwitchOverlap, incomplete, hzAsc, diffAsc, perBand, blended, sameAfter,
    hzRange: [g.BIOMES[0].hz, g.BIOMES[g.BIOMES.length-1].hz], props, names, simMinutes: mins });
})()`);

// 21) Yo'l osonroq: kam tosiq, sekin tezlik o'sishi, ko'p mukofot, uzun kirish qismi
T('easier-road', `(() => {
  const g = NY3D, G = g.G;
  g.ACCT.lvl = 1; g.ACCT.pts = 0; g.ACCT.save();
  g.startRun(); G.tut = false; G.level = 1;
  let hazPer = 0, goodPer = 0, blockedAll = 0, rows = 0, coins = 0;
  for (let r = 0; r < 1500; r++) {
    G.dist = 400 + r * 6;
    const z = 300 + r * 14, before = G.objs.length;
    g.spawnRow(z);
    const added = G.objs.slice(before);
    const lanes = [0, 1, 2].map(l => added.some(o => o.lane === l && g.HAZARD[o.kind]));
    hazPer += lanes.filter(Boolean).length; goodPer += added.filter(o => g.GOOD[o.kind]).length;
    coins += added.filter(o => o.kind === 'coin').length;
    if (lanes.every(Boolean)) blockedAll++;
    if (!lanes.some(x => !x)) rows++;
    G.objs.length = before;
  }
  // kirish qismi (birinchi 140 m) faqat tangа va yengil tosiq
  g.startRun(); G.tut = false; G.objs.length = 0;
  const hard = [];
  for (let r = 0; r < 40; r++) { G.dist = 10 + r * 3; g.spawnRow(30 + r * 12); }
  for (const o of G.objs) if (g.HAZARD[o.kind] && o.kind !== 'bar') hard.push(o.kind);
  const earlyKinds = Array.from(new Set(G.objs.map(o => o.kind))).sort().join(',');
  // tezlik o'sish sur'ati
  g.startRun(); G.tut = false;
  const speed0 = Math.round(G.baseSpeed);
  for (let i = 0; i < 60 * 90; i++) { G.lives = 9; g.update(1 / 60); }
  const speedLv = { level: G.level, maxKmh: Math.round(G.maxSpeed * 3.6), lives: G.maxLives };
  return JSON.stringify({ hazPerRow: +(hazPer / 1500).toFixed(2), goodPerRow: +(goodPer / 1500).toFixed(2),
    coinPerRow: +(coins / 1500).toFixed(2), blockedAll, noSafeLane: rows,
    baseSpeed: speed0, after90s: speedLv, openingClean: hard.length === 0, earlyKinds });
})()`);

// 22) Mashina shakllari geometriyasi: g'ildirak korpusdan chiqmasin, kaput/salon qo'shmasin
T('car-shapes', `(() => {
  const g = NY3D, D = g.SHAPE_DEF, S = g.SHAPES;
  const bad = [];
  for (const name of Object.keys(S)) {
    if (!S[name]) continue;
    const s = Object.assign({}, D, S[name]);
    const bodyTop = s.chy + s.ch[1];
    if (s.wy + s.wh[1] > bodyTop + .02) bad.push(name + ':gil-ustida');
    if (s.wx - s.wh[0] > bodyHalf(s)) bad.push(name + ':gil-tashqarida');
    const ho = [s.hoodz - s.hood[2] / 2, s.hoodz + s.hood[2] / 2];
    const ca = [s.cabz - s.cab[2] / 2, s.cabz + s.cab[2] / 2];
    const ov = Math.min(ho[1], ca[1]) - Math.max(ho[0], ca[0]);
    if (ov > .05) bad.push(name + ':kaput-salon-qoshish:' + ov.toFixed(2));
    if (s.hody + s.hood[1] < bodyTop - .06) bad.push(name + ':kaput-botqoq');
    if (s.caby - s.cab[1] > bodyTop + .12) bad.push(name + ':salon-osilgan');
    if (s.caby + s.cab[1] <= s.hody + s.hood[1]) bad.push(name + ':salon-past');
  }
  function bodyHalf(s) { return s.ch[0]; }
  g.CARS.forEach(c => g.applySkin(c));
  const meshBad = [];
  for (const c of g.CARS) {
    const xs = c.mesh.v.map(v => Math.abs(v[0])), zs = c.mesh.v.map(v => Math.abs(v[2])), ys = c.mesh.v.map(v => v[1]);
    const mx = Math.max.apply(0, xs), mz = Math.max.apply(0, zs), my = Math.max.apply(0, ys), ny = Math.min.apply(0, ys);
    if (mx > 1.25) meshBad.push(c.id + ':keng:' + mx.toFixed(2));
    if (mz > 1.75) meshBad.push(c.id + ':uzun:' + mz.toFixed(2));
    if (my > 1.7) meshBad.push(c.id + ':baland:' + my.toFixed(2));
    if (ny < -.05) meshBad.push(c.id + ':yerga-kirgan:' + ny.toFixed(2));
    if (!c.mesh.f.length) meshBad.push(c.id + ':yuzasiz');
  }
  return JSON.stringify({ shapes: Object.keys(S).length, bad, meshBad, cars: g.CARS.length });
})()`);

// 23) Audit fixes verification: Spawning continuity, transitions, toast queue, corrupted storage, audio safety
T('audit-fixes', `(() => {
  const g = NY3D, G = g.G;
  const bad = [];

  // A. Object spawning continuity: no huge voids (> 24m) along active road
  g.startRun();
  for (let f = 0; f < 120; f++) g.update(1/60);
  const zs = G.objs.filter(o => !o.dead && o.z > 0 && o.z < 65).map(o => o.z).sort((a,b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < zs.length; i++) {
    const gap = zs[i] - zs[i - 1];
    if (gap > maxGap) maxGap = gap;
  }
  if (zs.length < 3 || maxGap > 25) bad.push('spawn-gap:max=' + maxGap.toFixed(1) + ',count=' + zs.length);

  // B. Portal transition continuity: verify objs populated immediately after enterDimension
  g.enterDimension(0);
  const dimObjs = G.objs.filter(o => !o.dead && o.z > 0 && o.z < 50);
  if (dimObjs.length < 2) bad.push('dimension-objs-empty:' + dimObjs.length);
  g.exitDimension();
  const exitObjs = G.objs.filter(o => !o.dead && o.z > 0 && o.z < 50);
  if (exitObjs.length < 2) bad.push('exit-objs-empty:' + exitObjs.length);

  // C. Toast queue safety
  try {
    g.toast('TEST_1', 500);
    g.toast('TEST_2', 500);
    g.toast('TEST_2', 500); // duplicate suppressed
  } catch (e) {
    bad.push('toast-err:' + e.message);
  }

  // D. Corrupted storage resilience
  try {
    localStorage.setItem('ny3d_test_corrupt', '{bad json');
    const safeObj = g.store.get('test_corrupt', { ok: 1 });
    if (!safeObj || safeObj.ok !== 1) bad.push('corrupt-fallback-failed');

    localStorage.setItem('ny3d_car_upg_99', JSON.stringify({ speed: 999, accel: -5, nitro: 'NaN' }));
    const validated = g.CAR_UPG.get(99);
    if (validated.speed !== 5 || validated.accel !== 0 || validated.nitro !== 0) {
      bad.push('upg-clamp-failed:' + JSON.stringify(validated));
    }

    localStorage.setItem('ny3d_perm', 'not-an-object');
    const permN = g.PERM.n('speed');
    if (typeof permN !== 'number' || isNaN(permN)) bad.push('perm-corrupt-failed');
  } catch (e) {
    bad.push('storage-err:' + e.message);
  }

  // E. Audio resume safety
  try {
    if (g.Sound && typeof g.Sound.resume === 'function') {
      g.Sound.resume();
    }
  } catch (e) {
    bad.push('sound-resume-err:' + e.message);
  }

  if (bad.length) throw new Error('AUDIT FIXES XATO: ' + bad.join(', '));
  return JSON.stringify({
    ok: true,
    maxSpawnGap: +maxGap.toFixed(1),
    activeObjs: zs.length,
    dimTransitObjs: dimObjs.length,
    exitTransitObjs: exitObjs.length
  });
})()`);

console.log(out.join('\n'));
if (results.length) console.log('\n--- FAILURES ---\n' + results.join('\n'));
process.exit(results.length ? 1 : 0);
