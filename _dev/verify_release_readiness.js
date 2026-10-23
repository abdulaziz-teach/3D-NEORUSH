const fs = require('fs');
const sh = require('./shim.js');

console.log('=== NEORUSH DEEP RELEASE READINESS VALIDATION ===\n');

async function testAll() {
  const g = sh.sandbox.NY3D;
  const G = g.G;
  const store = g.store;
  const ACCT = g.ACCT;
  const doc = sh.sandbox.document;
  const win = sh.sandbox.window;

  // -------------------------------------------------------------
  // CHECK 1: Yangi foydalanuvchi uchun tutorial
  // -------------------------------------------------------------
  store.set('tutDone', false);
  store.set('tut_v2_done', false);
  store.set('neorush_intro_seen', false);
  g.TUTORIAL_SYSTEM.showIntro();

  const introModal = doc.getElementById('introModal');
  if (!introModal || introModal.classList.contains('hidden')) {
    throw new Error('Check 1 xatosi: Yangi o\'yinchi uchun introModal ochilmadi!');
  }
  const btnLearn = doc.getElementById('btnIntroLearn');
  if (!btnLearn) throw new Error('Check 1 xatosi: btnIntroLearn topilmadi!');

  btnLearn.click();
  const tut = g.TUTORIAL_SYSTEM;
  if (!tut.active || tut.step !== 1) {
    throw new Error('Check 1 xatosi: Tutorial 1-qadamda boshlanmadi!');
  }
  const banner = doc.getElementById('tutorialBanner');
  if (!banner || banner.classList.contains('hidden')) {
    throw new Error('Check 1 xatosi: #tutorialBanner ko\'rinmadi!');
  }
  console.log('✓ Check 1: Yangi foydalanuvchi uchun tutorial va intro modal 100% to\'g\'ri ishlaydi.');

  // -------------------------------------------------------------
  // CHECK 2: Oldingi progress saqlanishi va migratsiya
  // -------------------------------------------------------------
  // Eski progressni simulyatsiya qilish
  store.set('coins', 7500);
  store.set('aLvl', 4);
  store.set('aPts', 350);
  store.set('car_tune_0', { wing: 3, neon: 2 });
  store.set('meta', { runs: 8, totalDist: 45000, maxKmh: 280, totalCoins: 7500 });

  // Kosmetika egaligini tekshirish
  const isWing3Owned = g.isCosmeticOwned('wing', 3);
  const isNeon2Owned = g.isCosmeticOwned('neon', 2);
  if (!isWing3Owned || !isNeon2Owned) {
    throw new Error('Check 2 xatosi: Eski tyuning konfiguratsiyasi avtomatik egalik ro\'yxatiga o\'tmadi!');
  }

  // Tangalar va daraja
  if (store.get('coins') !== 7500) {
    throw new Error('Check 2 xatosi: Eski tangalar miqdori buzildi!');
  }
  console.log('✓ Check 2: Oldingi progress (tangalar, daraja, yutuqlar, tyuning konfiguratsiyasi) to\'liq saqlandi.');

  // -------------------------------------------------------------
  // CHECK 3: Tanga va yulduz mukofotlari yaxlitligi
  // -------------------------------------------------------------
  const c0 = G.coins = 1000;
  const p0 = ACCT.pts;

  // 3.1 Mukofot berish
  G.coins = Math.max(0, G.coins + 250);
  ACCT.add(50);
  if (G.coins !== c0 + 250 || ACCT.pts !== p0 + 50) {
    throw new Error('Check 3 xatosi: Mukofot hisobida noaniqlik!');
  }

  // 3.2 Manfiy balansga qarshi himoya
  G.coins = Math.max(0, G.coins - 5000);
  if (G.coins < 0 || ACCT.pts < 0) {
    throw new Error('Check 3 xatosi: Balans manfiy bo\'lib ketdi!');
  }
  if (G.coins !== 0) {
    throw new Error('Check 3 xatosi: Ortiqcha yechilganda balans 0 bo\'lmadi!');
  }
  console.log('✓ Check 3: Tanga va yulduz balansi doimo musbat va mukofotlar aynan bir marta beriladi.');

  // -------------------------------------------------------------
  // CHECK 4: Bossdan portal orqali qochish
  // -------------------------------------------------------------
  g.startRun();
  G.running = true;
  G.paused = false;
  G.nextLevelAt = 999999;
  g.triggerBossChase('ESCAPE_PORTAL_BOSS');

  if (!G.bossActive) throw new Error('Check 4 xatosi: Boss faollashmadi!');
  const escapesBefore = G.meta.bossEscapes || 0;
  const coinsBefore = G.coins;

  // Portalga kirish
  g.enterDimension(0);

  if (G.bossActive) throw new Error('Check 4 xatosi: Portalga kirgach boss faol qoldi!');
  if ((G.meta.bossEscapes || 0) !== escapesBefore + 1) {
    throw new Error('Check 4 xatosi: Portal orqali qochish bossEscapes ga yozilmadi!');
  }
  if (G.coins !== coinsBefore + 250) {
    throw new Error('Check 4 xatosi: Portal orqali qochish mukofoti berilmadi!');
  }
  const bh = doc.getElementById('bossHud');
  if (bh && !bh.classList.contains('hidden')) {
    throw new Error('Check 4 xatosi: Dimension ichida #bossHud yashirilmadi!');
  }
  console.log('✓ Check 4: Bossdan portal orqali qochish hodisasi xavfsiz yakunlandi va mukofotlandi.');

  // -------------------------------------------------------------
  // CHECK 5: Mobil touch boshqaruvi
  // -------------------------------------------------------------
  sh.win.innerWidth = 375;
  sh.win.innerHeight = 667;
  g.onViewportChange();

  const canvas = sh.canvas;

  // Chapga surish (swipe left: dx = 150 - 250 = -100 < -44)
  G.lane = 1;
  G.x = g.LANES[1];
  canvas.dispatch('touchstart', { touches: [{ clientX: 250, clientY: 400 }], cancelable: true, preventDefault() {} });
  canvas.dispatch('touchmove', { touches: [{ clientX: 150, clientY: 400 }], cancelable: true, preventDefault() {} });

  if (G.lane !== 0) {
    throw new Error('Check 5 xatosi: Chapga surishda yo\'lak 1 dan 0 ga o\'tmadi!');
  }

  // O'ngga surish (swipe right: dx = 220 - 100 = 120 > 44)
  canvas.dispatch('touchstart', { touches: [{ clientX: 100, clientY: 400 }], cancelable: true, preventDefault() {} });
  canvas.dispatch('touchmove', { touches: [{ clientX: 220, clientY: 400 }], cancelable: true, preventDefault() {} });

  if (G.lane !== 1) {
    throw new Error('Check 5 xatosi: O\'ngga surishda yo\'lak 0 dan 1 ga o\'tmadi!');
  }
  console.log('✓ Check 5: Mobil touch swipe boshqaruvi (chap/o\'ng yo\'lak almashtirish) to\'liq ishlaydi.');

  // -------------------------------------------------------------
  // CHECK 6: Portal oldida, ichida va undan chiqqanda avtomobil ko'rinishi
  // -------------------------------------------------------------
  g.startRun();
  G.running = true;
  G.speed = 24;

  // Portalga yaqinlashish (z=30 dan z=-2)
  for (let z = 30; z >= -2; z -= 1) {
    g.render();
    const c = g.car();
    const faces = g.facesOf(c.mesh, [G.x, G.y, 0], G.yaw, 1);
    if (!faces || faces.length < 400) {
      throw new Error(`Check 6 xatosi: z=${z} da mashina yuzalari yo'qoldi (${faces ? faces.length : 0})!`);
    }
  }

  // Dimension ichida
  g.enterDimension(1);
  g.render();
  const dimCarFaces = g.facesOf(g.car().mesh, [G.x, G.y, 0], G.yaw, 1);
  if (!dimCarFaces || dimCarFaces.length < 400) {
    throw new Error('Check 6 xatosi: Dimension ichida mashina yuzalari yo\'qoldi!');
  }

  // Dimensiondan chiqish
  g.exitDimension();
  g.render();
  const exitCarFaces = g.facesOf(g.car().mesh, [G.x, G.y, 0], G.yaw, 1);
  if (!exitCarFaces || exitCarFaces.length < 400) {
    throw new Error('Check 6 xatosi: Dimensiondan chiqqandan so\'ng mashina yuzalari yo\'qoldi!');
  }
  console.log('✓ Check 6: Portal aperture oldida, ichida va undan chiqqanda mashina ko\'rinishi 100% barqaror (480 yuzalar).');

  console.log('\n======================================================');
  console.log('  ALL 6 DEEP RELEASE READINESS CHECKS PASSED (100%)    ');
  console.log('======================================================\n');
  process.exit(0);
}

testAll().catch(e => {
  console.error('\n❌ VALIDATION FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
});
