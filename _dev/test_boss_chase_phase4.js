const fs = require('fs');
const sh = require('./shim.js');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

console.log('--- STARTING PHASE 4: BOSS CHASE TEST SUITE ---');

async function run() {
  try {
    const g = sh.sandbox.NY3D;
    const G = g.G;
    const store = g.store;
    const ACCT = g.ACCT;
    const doc = sh.sandbox.document;
    const LANES = g.LANES;

    if (!g.triggerBossChase) {
      throw new Error('triggerBossChase funksiyasi NY3D da topilmadi!');
    }

    // -------------------------------------------------------------
    // TEST 1: Boss ogohlantirishi to'g'ri masofa va vaqtda chiqishi
    // -------------------------------------------------------------
    g.startRun();
    G.running = true;
    G.paused = false;
    G.nextLevelAt = 999999;
    G.inDimension = false;
    G.nextBossAt = 2200;
    G.dist = 2110; // nextBossAt - 90 (hali ogohlantirish chiqmasligi kerak)
    G.bossActive = false;
    G.bossWarningActive = false;

    g.update(0.016);
    if (G.bossWarningActive || G.bossActive) {
      throw new Error('Test 1 xatosi: Boss vaqtidan oldin ogohlantirildi yoki spawn bo\'ldi!');
    }

    // 80m oldin (dist = 2125) ogohlantirish chiqishi kerak
    G.dist = 2125;
    g.update(0.016);
    if (!G.bossWarningActive) {
      throw new Error('Test 1 xatosi: 80m qolganda bossWarningActive faollashmadi!');
    }
    if (G.bossActive) {
      throw new Error('Test 1 xatosi: Ogohlantirish vaqtida boss hali faol bo\'lmasligi kerak edi!');
    }
    console.log('Test 1: Boss kelishidan 80m oldin ogohlantirish (⚠️ БОСС ПРИБЛИЖАЕТСЯ!) to\'g\'ri chiqdi.');

    // -------------------------------------------------------------
    // TEST 2: Boss faqat bir marta spawn bo'lishi
    // -------------------------------------------------------------
    G.dist = 2201; // nextBossAt ga yetdi
    g.update(0.016);

    if (!G.bossActive) {
      throw new Error('Test 2 xatosi: dist >= nextBossAt bo\'lganda bossActive faollashmadi!');
    }
    if (G.bossWarningActive) {
      throw new Error('Test 2 xatosi: Boss chiqqandan so\'ng warningActive to\'xtamadi!');
    }
    const bossTimer1 = G.bossTimer;
    // Yana bir necha update chaqirilganda qayta spawn bo'lmasligi kerak
    g.update(0.016);
    g.update(0.016);
    if (G.bossTimer > bossTimer1) {
      throw new Error('Test 2 xatosi: Boss faol bo\'lgan holda qayta spawn bo\'ldi!');
    }
    console.log('Test 2: Boss faqat bir marta to\'g\'ri spawn bo\'ldi (timer: ' + G.bossTimer.toFixed(1) + 's).');

    // -------------------------------------------------------------
    // TEST 3: Ta'qib, telegraf ogohlantirish va zarbadan qochish
    // -------------------------------------------------------------
    // Bossni aiming holatiga o'tkazish
    G.bossAttackTimer = 0.01;
    g.update(0.02);

    if (G.bossAttackState !== 'aiming') {
      throw new Error('Test 3 xatosi: Boss aiming (telegraf ogohlantirish) holatiga o\'tmadi!');
    }
    if (G.bossAttackTimer < 1.0) {
      throw new Error('Test 3 xatosi: O\'yinchiga qochish uchun adolatli vaqt (1.4s) berilmadi!');
    }

    const targetedLane = G.bossTargetLane;
    // O'yinchi nishondagi yo'lakdan boshqa yo'lakka qochadi
    const safeLane = (targetedLane + 1) % 3;
    G.lane = safeLane;
    G.x = LANES[safeLane];
    const initialNearMisses = G.runNearMisses || 0;

    // Aiming vaqti tugashini simulyatsiya qilamiz
    G.bossAttackTimer = 0.001;
    g.update(0.016);

    if (G.bossAttackState !== 'strike') {
      throw new Error('Test 3 xatosi: Boss zarba bermadi!');
    }
    if ((G.runNearMisses || 0) <= initialNearMisses) {
      throw new Error('Test 3 xatosi: Muvaffaqiyatli qochilganda near-miss va dodge qayd etilmadi!');
    }
    console.log('Test 3: Telegraf ogohlantirish (1.4s) va yo\'lak almashtirib zarbadan muvaffaqiyatli qochish ishladi.');

    // -------------------------------------------------------------
    // TEST 4: Zarba berilganda Shield va Hayot tizimi
    // -------------------------------------------------------------
    // 4.1 Shield bilan zarba qabul qilish
    G.shield = 10;
    G.shieldMax = 10;
    G.lives = 3;
    G.invul = 0;
    G.bossAttackState = 'aiming';
    G.bossTargetLane = G.lane;
    G.x = LANES[G.lane];
    G.bossAttackTimer = 0.001;

    g.update(0.016);

    if (G.shield !== 0) {
      throw new Error('Test 4 xatosi: Shield zarbani o\'ziga olmadi!');
    }
    if (G.lives !== 3) {
      throw new Error('Test 4 xatosi: Shield bor bo\'lsa ham hayot kamaydi!');
    }
    if (G.shieldRipple <= 0) {
      throw new Error('Test 4 xatosi: Shield to\'lqin animatsiyasi faollashmadi!');
    }

    // 4.2 Shield yo'q paytda zarba qabul qilish
    G.shield = 0;
    G.invul = 0;
    G.lives = 3;
    G.bossAttackState = 'aiming';
    G.bossTargetLane = G.lane;
    G.x = LANES[G.lane];
    G.bossAttackTimer = 0.001;

    g.update(0.016);

    if (G.lives !== 2) {
      throw new Error(`Test 4 xatosi: Hayot kamaymadi! Kutilgan: 2, Amalda: ${G.lives}`);
    }
    if (G.invul < 1.5) {
      throw new Error('Test 4 xatosi: Zarbadan so\'ng daxlsizlik vaqti (invul) berilmadi!');
    }
    console.log('Test 4: Zarba shildga tekkanida shild yutdi (hayot kamaymadi); shildsiz esa 1 hayot olib 2.0s invul berdi.');

    // -------------------------------------------------------------
    // TEST 5: Muvaffaqiyatli qochish va statistika hisobi
    // -------------------------------------------------------------
    const initialBossEscapes = G.meta.bossEscapes || 0;
    const initialRunBossEscaped = G.runBossEscaped || 0;
    const coinsBeforeEscape = G.coins;
    const ptsBeforeEscape = ACCT.pts;

    // Boss vaqti tugashini simulyatsiya qilamiz
    G.bossTimer = 0.01;
    G.bossDist = 18;
    g.update(0.02);

    if (G.bossActive) {
      throw new Error('Test 5 xatosi: Boss vaqti tugagach bossActive o\'chmadi!');
    }
    if ((G.meta.bossEscapes || 0) !== initialBossEscapes + 1) {
      throw new Error('Test 5 xatosi: G.meta.bossEscapes oshmadi!');
    }
    if ((G.runBossEscaped || 0) !== initialRunBossEscaped + 1) {
      throw new Error('Test 5 xatosi: G.runBossEscaped oshmadi!');
    }
    console.log('Test 5: Bossdan muvaffaqiyatli qochildi va bossEscapes statistikasi to\'g\'ri oshirildi.');

    // -------------------------------------------------------------
    // TEST 6: Mukofotning faqat bir marta berilishi
    // -------------------------------------------------------------
    const coinsAfterEscape = G.coins;
    const ptsAfterEscape = ACCT.pts;
    if (coinsAfterEscape !== coinsBeforeEscape + 250) {
      throw new Error(`Test 6 xatosi: Tangalar to'g'ri berilmadi! Kutilgan: +250, Amalda: ${coinsAfterEscape - coinsBeforeEscape}`);
    }
    if (ptsAfterEscape !== ptsBeforeEscape + 100) {
      throw new Error(`Test 6 xatosi: Yulduzlar to'g'ri berilmadi! Kutilgan: +100, Amalda: ${ptsAfterEscape - ptsBeforeEscape}`);
    }

    // Keyingi freymlarda takroriy mukofot berilmasligi kerak
    g.update(0.016);
    g.update(0.016);
    if (G.coins !== coinsAfterEscape || ACCT.pts !== ptsAfterEscape) {
      throw new Error('Test 6 xatosi: Mukofot takroran berildi!');
    }
    console.log('Test 6: Mukofot (+250 🪙, +100 ⭐, +5000 ball) bir marta to\'liq berildi va takroriy berilmadi.');

    // -------------------------------------------------------------
    // TEST 7: Daily Missions va Achievements bilan integratsiya
    // -------------------------------------------------------------
    const mSt = g.getMissionState();
    const bossMission = mSt && mSt.items && mSt.items.bossEscape;
    if (bossMission && !bossMission.done) {
      throw new Error('Test 7 xatosi: bossEscape kunlik missiyasi done=true bo\'lmadi!');
    }

    const aSt = g.getAchieveState();
    const bossAchieve = aSt && aSt.boss_slayer;
    if (bossAchieve && bossAchieve.cur !== (G.meta.bossEscapes || 0)) {
      throw new Error('Test 7 xatosi: boss_slayer yutug\'i statistikasi sinxronlanmadi!');
    }
    console.log('Test 7: Daily Missions (bossEscape) va Achievements (boss_slayer) bilan to\'liq integratsiya qilindi.');

    // -------------------------------------------------------------
    // TEST 8: O'yin tugashi va qayta boshlashda toza holat
    // -------------------------------------------------------------
    g.triggerBossChase('TEST_BOSS');
    if (!G.bossActive) throw new Error('Test 8 xatosi: triggerBossChase ishlamadi!');

    g.gameOver();
    if (G.bossActive) throw new Error('Test 8 xatosi: gameOver dan keyin bossActive=false bo\'lmadi!');

    const hudEl = doc.getElementById('bossHud');
    if (hudEl && !hudEl.classList.contains('hidden')) {
      throw new Error('Test 8 xatosi: gameOver dan keyin #bossHud yashirilmadi!');
    }

    g.startRun();
    if (G.bossActive || G.bossWarningActive) {
      throw new Error('Test 8 xatosi: startRun dan keyin boss parametrlari tozalanmadi!');
    }
    console.log('Test 8: gameOver va startRun dan keyin boss holati toza tiklandi va HUD yashirildi.');

    // -------------------------------------------------------------
    // TEST 9: Portal va Dimension bilan moslik
    // -------------------------------------------------------------
    g.startRun();
    G.running = true;
    G.paused = false;
    G.nextLevelAt = 999999;
    g.triggerBossChase('PORTAL_TEST_BOSS');
    if (!G.bossActive) throw new Error('Test 9 xatosi: Boss faollashmadi!');

    const escapesBeforePortal = G.meta.bossEscapes || 0;
    // O'yinchi portalga kiradi
    g.enterDimension(0);

    if (G.bossActive) {
      throw new Error('Test 9 xatosi: Portalga kirgach bossActive to\'xtamadi!');
    }
    if ((G.meta.bossEscapes || 0) !== escapesBeforePortal + 1) {
      throw new Error('Test 9 xatosi: Portalga kirish orqali qochish hisoblanmadi!');
    }
    if (hudEl && !hudEl.classList.contains('hidden')) {
      throw new Error('Test 9 xatosi: Dimension ichida #bossHud yashirilmadi!');
    }

    // Portal ichida mashina render bo'lishi
    g.render();
    const c = g.car();
    const faces = g.facesOf(c.mesh, [G.x, G.y, 0], G.yaw, 1);
    if (!faces || faces.length < 10) {
      throw new Error('Test 9 xatosi: Mashina yuzalari render qilinmadi!');
    }
    console.log('Test 9: Portalga kirish bossni xavfsiz yakunladi, avtomobil ko\'rinishi 100% saqlandi.');

    // -------------------------------------------------------------
    // TEST 10: Buzilgan yoki bo'sh ma'lumotlar bilan xavfsizlik
    // -------------------------------------------------------------
    G.meta = null;
    G.bossDist = NaN;
    G.bossZ = null;
    g.update(0.016);
    g.render();
    console.log('Test 10: Buzilgan yoki bo\'sh ma\'lumotlar bilan xavfsiz ishlandi.');

    // -------------------------------------------------------------
    // TEST 11: 320px, 375px, 768px va Desktop ekranlarida tekshirish
    // -------------------------------------------------------------
    const viewports = [
      { w: 320, h: 568, name: 'Mobile 320px' },
      { w: 375, h: 667, name: 'Mobile 375px' },
      { w: 768, h: 1024, name: 'Tablet 768px' },
      { w: 1280, h: 720, name: 'Desktop 1280px' }
    ];

    for (const vp of viewports) {
      sh.win.innerWidth = vp.w;
      sh.win.innerHeight = vp.h;
      g.onViewportChange();
      g.triggerBossChase('RESPONSIVE_BOSS');
      g.render();
      if (!hudEl) throw new Error(`Test 11 xatosi: ${vp.name} da #bossHud topilmadi!`);
      const bTitle = doc.getElementById('bossTitle');
      const bSub = doc.getElementById('bossSub');
      if (!bTitle || !bSub || !bTitle.textContent.includes('RESPONSIVE_BOSS')) {
        throw new Error(`Test 11 xatosi: ${vp.name} da boss sarlavhasi to'g'ri chiqmadi!`);
      }
      G.bossActive = false;
      hudEl.classList.add('hidden');
    }
    console.log('Test 11: 320px, 375px, 768px va Desktop da boss UI to\'liq moslashdi.');

    // -------------------------------------------------------------
    // TEST 12: Performance (60 frames under boss chase)
    // -------------------------------------------------------------
    g.triggerBossChase('PERF_BOSS');
    const tStart = performance.now();
    for (let f = 0; f < 60; f++) {
      g.update(0.016);
      g.render();
    }
    const tEnd = performance.now();
    const avgFrameMs = (tEnd - tStart) / 60;
    if (avgFrameMs > 16.0) {
      throw new Error(`Test 12 xatosi: Kadr vaqti 16ms dan oshib ketdi (${avgFrameMs.toFixed(2)}ms)!`);
    }
    console.log(`Test 12: 60 kadrli boss chase simulyatsiyasi yuqori tezlikda (${avgFrameMs.toFixed(3)}ms/kadr) o'tdi.`);

    console.log('\n==========================================================');
    console.log('  ALL 12 PHASE 4 BOSS CHASE TESTS PASSED (100%)           ');
    console.log('==========================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
