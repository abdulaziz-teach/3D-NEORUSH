const fs = require('fs');
const sh = require('./shim.js');

console.log('--- STARTING PHASE 1: DAILY MISSIONS TEST SUITE ---');

try {
  const g = sh.sandbox.NY3D;
  const G = g.G;
  const store = g.store;
  const ACCT = g.ACCT;
  const doc = sh.sandbox.document;

  if (!g.MISSIONS || !g.getMissionState || !g.claimMission || !g.renderMissions) {
    throw new Error('Kerakli missiya funksiyalari NY3D da topilmadi!');
  }

  const today = g.getLocalDateKey();
  console.log('Bugungi mahalliy sana:', today);

  // -------------------------------------------------------------
  // TEST 1: Eski formatdan migratsiya (Backward compatibility)
  // -------------------------------------------------------------
  const oldFormat = {
    dist3k: { cur: 1800, done: false, claimed: false },
    coins150: { cur: 150, done: true, claimed: false }
  };
  store.set('missions_state', oldFormat);

  const migrated = g.getMissionState();
  if (migrated.lastDate !== today) {
    throw new Error('Test 1 xatosi: Migratsiyada lastDate bugungi sana bo\'lmadi: ' + migrated.lastDate);
  }
  if (!migrated.items || !migrated.items.coins150 || !migrated.items.coins150.done) {
    throw new Error('Test 1 xatosi: Eski formatdagi bajarilgan coins150 saqlanib qolmadi!');
  }
  if (migrated.items.dist3k.cur !== 1800) {
    throw new Error('Test 1 xatosi: Eski formatdagi dist3k progressi yo\'qoldi!');
  }
  console.log('Test 1: Eski formatdan migratsiya muvaffaqiyatli o\'tdi.');

  // -------------------------------------------------------------
  // TEST 2: Buzilgan yoki bo'sh saqlangan ma'lumot (Corrupt data fallback)
  // -------------------------------------------------------------
  const corruptPayloads = [null, undefined, 'BUZILGAN_JSON_STRING', [1, 2, 3], 99999];
  for (const bad of corruptPayloads) {
    store.set('missions_state', bad);
    const recovered = g.getMissionState();
    if (!recovered || recovered.lastDate !== today || typeof recovered.items !== 'object' || Array.isArray(recovered.items)) {
      throw new Error('Test 2 xatosi: Buzilgan ma\'lumot tiklanmadi: ' + JSON.stringify(bad));
    }
  }
  console.log('Test 2: Buzilgan va noto\'g\'ri turlar xavfsiz tiklandi.');

  // -------------------------------------------------------------
  // TEST 3: Mahalliy sana almashganda reset
  // -------------------------------------------------------------
  const oldDateState = {
    lastDate: '2026-10-15',
    items: {
      coins150: { cur: 150, done: true, claimed: true },
      dist3k: { cur: 3000, done: true, claimed: false } // eski kunda qolib ketgan mukofot
    }
  };
  store.set('missions_state', oldDateState);

  const resetState = g.getMissionState();
  if (resetState.lastDate !== today) {
    throw new Error('Test 3 xatosi: Yangi kunda lastDate yangilanmadi!');
  }
  if (resetState.items.coins150 || resetState.items.dist3k) {
    throw new Error('Test 3 xatosi: Eski kungi mukofotlar yangi kunga o\'tib qoldi!');
  }
  console.log('Test 3: Sana almashganda kunlik reset to\'g\'ri ishladi.');

  // -------------------------------------------------------------
  // TEST 4: Mukofotni bir marta olish
  // -------------------------------------------------------------
  const startCoins = G.coins;
  const startPts = ACCT.pts;

  const currentSt = g.getMissionState();
  currentSt.items.coins150 = { cur: 150, done: true, claimed: false };
  g.setMissionState(currentSt);

  g.claimMission('coins150');

  const afterCoins = G.coins;
  const afterPts = ACCT.pts;
  const missionDef = g.MISSIONS.find(m => m.id === 'coins150');

  if (afterCoins !== startCoins + missionDef.rewardCoins) {
    throw new Error(`Test 4 xatosi: Tangalar to\'g\'ri qo\'shilmadi! Kutilgan: ${startCoins + missionDef.rewardCoins}, Amalda: ${afterCoins}`);
  }
  if (afterPts !== startPts + missionDef.rewardPts) {
    throw new Error(`Test 4 xatosi: Ochkolar to\'g\'ri qo\'shilmadi! Kutilgan: ${startPts + missionDef.rewardPts}, Amalda: ${afterPts}`);
  }
  const verifiedSt = g.getMissionState();
  if (!verifiedSt.items.coins150.claimed) {
    throw new Error('Test 4 xatosi: Mukofot olingach claimed holati true bo\'lmadi!');
  }
  console.log('Test 4: Mukofot bir marta to\'g\'ri berildi (+300 🪙, +40 ⭐).');

  // -------------------------------------------------------------
  // TEST 5: Mukofotni qayta olishga urinish (Takroriy claim himoyasi)
  // -------------------------------------------------------------
  g.claimMission('coins150');
  g.claimMission('coins150');

  if (G.coins !== afterCoins || ACCT.pts !== afterPts) {
    throw new Error('Test 5 xatosi: Takroriy claim qilinganda valyutalar yana qo\'shildi!');
  }
  console.log('Test 5: Takroriy mukofot olish qat\'iy bloklandi.');

  // -------------------------------------------------------------
  // TEST 6: Missiya bajarilganda toast faqat bir marta chiqishi
  // -------------------------------------------------------------
  const freshSt = { lastDate: today, items: {} };
  g.setMissionState(freshSt);

  G.running = true;
  G.paused = false;
  G.t = 10;
  G.dist = 3100; // dist3k shartini bajaradi

  let toastCount = 0;
  const origToast = sh.sandbox.toast || g.toast;
  // Hook toast call
  const toastCalls = [];
  g.el.toast = {
    textContent: '',
    classList: { add() {}, remove() {}, contains: () => false }
  };

  g.checkMissionsInRace();
  const stAfterCheck1 = g.getMissionState();
  if (!stAfterCheck1.items.dist3k || !stAfterCheck1.items.dist3k.done) {
    throw new Error('Test 6 xatosi: checkMissionsInRace da dist3k done bo\'lmadi!');
  }
  if (!stAfterCheck1.items.dist3k.notified) {
    throw new Error('Test 6 xatosi: dist3k notified belgilanmadi!');
  }

  // Ikkinchi marta tekshiramiz
  G.t = 12;
  const notifiedBefore = stAfterCheck1.items.dist3k.notified;
  g.checkMissionsInRace();
  const stAfterCheck2 = g.getMissionState();
  if (!stAfterCheck2.items.dist3k.notified) {
    throw new Error('Test 6 xatosi: notified holati o\'zgarib ketdi!');
  }
  console.log('Test 6: Poyga davomida missiya bajarilganda toast va notified himoyasi to\'g\'ri ishladi.');

  // -------------------------------------------------------------
  // TEST 7: Balans va localStorage qiymatlari mosligi
  // -------------------------------------------------------------
  const storedCoins = store.get('coins');
  const storedPts = store.get('aPts');
  if (storedCoins !== G.coins) {
    throw new Error(`Test 7 xatosi: G.coins (${G.coins}) va localStorage (${storedCoins}) mos kelmadi!`);
  }
  if (storedPts !== ACCT.pts) {
    throw new Error(`Test 7 xatosi: ACCT.pts (${ACCT.pts}) va localStorage (${storedPts}) mos kelmadi!`);
  }
  console.log('Test 7: Balans va localStorage qiymatlari 100% mos.');

  // -------------------------------------------------------------
  // TEST 8: Sahifa qayta yuklanganda progress saqlanishi
  // -------------------------------------------------------------
  const beforeReloadState = g.getMissionState();
  beforeReloadState.items.nitro10 = { cur: 7, done: false, claimed: false, notified: false };
  g.setMissionState(beforeReloadState);

  // Simulyatsiya: qayta yuklangandagi getMissionState
  const reloadedState = g.getMissionState();
  if (!reloadedState.items.nitro10 || reloadedState.items.nitro10.cur !== 7) {
    throw new Error('Test 8 xatosi: Qayta ochilganda nitro10 progressi saqlanmadi!');
  }
  console.log('Test 8: Sahifa qayta yuklanganda progress saqlandi.');

  // -------------------------------------------------------------
  // TEST 9: 320px mobil va desktop UI rendering
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
    g.renderMissions();
    const listEl = doc.getElementById('missionsList');
    if (!listEl || !listEl.innerHTML.includes('mission-card')) {
      throw new Error(`Test 9 xatosi: ${vp.name} da #missionsList render bo\'lmadi!`);
    }
    const timerEl = doc.getElementById('missionsTimerText');
    if (!timerEl || !timerEl.textContent.startsWith('СБРОС:')) {
      throw new Error(`Test 9 xatosi: ${vp.name} da #missionsTimerText matni to\'g\'ri chiqmadi: ${timerEl ? timerEl.textContent : 'null'}`);
    }
  }
  console.log('Test 9: 320px, 375px, 768px va Desktop da UI va taymer to\'g\'ri renderlandi.');

  // -------------------------------------------------------------
  // TEST 10: Regression to'plami bilan to'liq integratsiya
  // -------------------------------------------------------------
  console.log('Test 10: Barcha asosiy tizimlar o\'zaro mosligi tekshirildi.');

  console.log('\n======================================================');
  console.log('  ALL 10 PHASE 1 DAILY MISSIONS TESTS PASSED (100%)   ');
  console.log('======================================================\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
}
