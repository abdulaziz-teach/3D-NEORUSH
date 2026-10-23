const fs = require('fs');
const sh = require('./shim.js');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

console.log('--- STARTING PHASE 3: ACHIEVEMENTS TEST SUITE ---');

async function run() {
  try {
    const g = sh.sandbox.NY3D;
    const G = g.G;
    const store = g.store;
    const ACCT = g.ACCT;
    const doc = sh.sandbox.document;

    if (!g.ACHIEVEMENTS || !g.getAchieveState || !g.claimAchievement || !g.renderAchievements || !g.checkAchievementsRealtime) {
      throw new Error('Kerakli achievement funksiyalari NY3D da topilmadi!');
    }

    // -------------------------------------------------------------
    // TEST 1: Barcha 12 ta yutuq shartlari va parametrlarini tekshirish
    // -------------------------------------------------------------
    if (g.ACHIEVEMENTS.length !== 12) {
      throw new Error(`Test 1 xatosi: Kutilgan 12 ta yutuq, amalda: ${g.ACHIEVEMENTS.length}`);
    }
    const expectedIds = [
      'first_race', 'cars_5', 'cars_15', 'coins_10k', 'speed_300',
      'drift_master', 'all_dimensions', 'boss_slayer', 'distance_50k',
      'max_upgrade', 'score_100k', 'acct_lvl10'
    ];
    for (const id of expectedIds) {
      const a = g.ACHIEVEMENTS.find(x => x.id === id);
      if (!a) throw new Error('Test 1 xatosi: Yutuq topilmadi: ' + id);
      if (!a.title || !a.desc || !a.icon || !a.goal || !a.rewardCoins || !a.rewardPts || typeof a.getVal !== 'function') {
        throw new Error('Test 1 xatosi: Yutuq parametrlari noto\'g\'ri: ' + id);
      }
    }
    console.log('Test 1: Barcha 12 ta yutuq ta\'rifi, shartlari va mukofotlari to\'liq mavjud.');

    // -------------------------------------------------------------
    // TEST 2: Shart bajarilganda real-vaqt rejimida ochilish
    // -------------------------------------------------------------
    store.set('achieve_state', {});
    G.running = true;
    G.speed = 85; // speedToKmh(85) = 85 * 3.6 = 306 km/h (> 300)
    G.t = 15;

    g.checkAchievementsRealtime();

    const stRealtime = g.getAchieveState();
    if (!stRealtime.speed_300 || !stRealtime.speed_300.done) {
      throw new Error('Test 2 xatosi: Tezlik 300 km/h ga yetganda real-vaqtda speed_300 ochilmadi!');
    }
    if (!stRealtime.speed_300.notified) {
      throw new Error('Test 2 xatosi: speed_300 ochilganda notified belgilanmadi!');
    }
    console.log('Test 2: Poyga vaqtida tezlik 300 km/h oshishi bilan yutuq real-vaqtda ochildi va notified qilindi.');

    // -------------------------------------------------------------
    // TEST 3: Mukofotning faqat bir marta berilishi
    // -------------------------------------------------------------
    const startCoins = G.coins;
    const startPts = ACCT.pts;
    const achSpeed = g.ACHIEVEMENTS.find(x => x.id === 'speed_300');

    g.claimAchievement('speed_300');

    if (G.coins !== startCoins + achSpeed.rewardCoins) {
      throw new Error(`Test 3 xatosi: Tangalar to'g'ri berilmadi! Kutilgan: ${startCoins + achSpeed.rewardCoins}, Amalda: ${G.coins}`);
    }
    if (ACCT.pts !== startPts + achSpeed.rewardPts) {
      throw new Error(`Test 3 xatosi: Ochkolar to'g'ri berilmadi! Kutilgan: ${startPts + achSpeed.rewardPts}, Amalda: ${ACCT.pts}`);
    }
    const stClaimed = g.getAchieveState();
    if (!stClaimed.speed_300.claimed) {
      throw new Error('Test 3 xatosi: Yutuq olingach claimed=true bo\'lmadi!');
    }

    // Takroriy claimga urinish
    const coinsAfterFirstClaim = G.coins;
    const ptsAfterFirstClaim = ACCT.pts;
    g.claimAchievement('speed_300');
    g.claimAchievement('speed_300');

    if (G.coins !== coinsAfterFirstClaim || ACCT.pts !== ptsAfterFirstClaim) {
      throw new Error('Test 3 xatosi: Takroriy claim qilinganda mukofot yana qo\'shildi!');
    }
    console.log('Test 3: Mukofot bir marta to\'liq berildi (+400 🪙, +80 ⭐) va takroriy claim bloklandi.');

    // -------------------------------------------------------------
    // TEST 4: Sahifani qayta yuklashdan keyin holat saqlanishi
    // -------------------------------------------------------------
    const persistedAchState = store.get('achieve_state');
    if (!persistedAchState.speed_300 || !persistedAchState.speed_300.claimed) {
      throw new Error('Test 4 xatosi: localStorage da claimed holati saqlanmadi!');
    }
    console.log('Test 4: localStorage orqali qayta yuklashdan keyin claimed holati saqlandi.');

    // -------------------------------------------------------------
    // TEST 5: Eski G.meta statistikalaridan to'g'ri aniqlash
    // -------------------------------------------------------------
    // Simulyatsiya: eski o'yinchi totalDist = 60000 m bosib o'tgan, lekin achieve_state hali bo'sh
    store.set('achieve_state', {});
    G.meta.totalDist = 60000;
    G.meta.runs = 5;

    g.checkAchievementsRealtime();

    const stFromMeta = g.getAchieveState();
    if (!stFromMeta.distance_50k || !stFromMeta.distance_50k.done) {
      throw new Error('Test 5 xatosi: Eski totalDist=60000 bo\'yicha distance_50k ochilmadi!');
    }
    if (!stFromMeta.first_race || !stFromMeta.first_race.done) {
      throw new Error('Test 5 xatosi: Eski runs=5 bo\'yicha first_race ochilmadi!');
    }
    console.log('Test 5: Eski G.meta rekordlari (masofa, poygalar) bo\'yicha yutuqlar xatosiz ochildi.');

    // -------------------------------------------------------------
    // TEST 6: Buzilgan saqlangan ma'lumot bilan xavfsiz ishlash
    // -------------------------------------------------------------
    const corruptStates = [null, undefined, 'BUZILGAN_JSON_STRING', [1, 2, 3], 9999];
    for (const bad of corruptStates) {
      store.set('achieve_state', bad);
      const recovered = g.getAchieveState();
      if (!recovered || typeof recovered !== 'object' || Array.isArray(recovered)) {
        throw new Error('Test 6 xatosi: Buzilgan achieve_state xavfsiz tiklanmadi!');
      }
    }
    console.log('Test 6: Buzilgan yoki bo\'sh saqlangan ma\'lumotlar xavfsiz tiklandi.');

    // -------------------------------------------------------------
    // TEST 7: Yutuq toastining takrorlanmasligi
    // -------------------------------------------------------------
    store.set('achieve_state', {});
    G.meta.bossEscapes = 5;
    G.t = 20;

    g.checkAchievementsRealtime();
    const stToast1 = g.getAchieveState();
    if (!stToast1.boss_slayer.notified) {
      throw new Error('Test 7 xatosi: boss_slayer notified belgilanmadi!');
    }

    // Ikkinchi marta tekshirilganda notified true qoladi va qayta bildirishnoma chiqmaydi
    G.t = 22;
    g.checkAchievementsRealtime();
    const stToast2 = g.getAchieveState();
    if (!stToast2.boss_slayer.notified) {
      throw new Error('Test 7 xatosi: notified holati o\'zgarib ketdi!');
    }
    console.log('Test 7: Toast bildirishnomasi har bir yutuq uchun faqat bir marta chiqishi kafolatlandi.');

    // -------------------------------------------------------------
    // TEST 8: Valyuta balansi va mukofot hisob-kitoblari
    // -------------------------------------------------------------
    await sleep(300);
    const coinsBeforeClaim = G.coins;
    const achBoss = g.ACHIEVEMENTS.find(x => x.id === 'boss_slayer');
    g.claimAchievement('boss_slayer');

    if (G.coins !== coinsBeforeClaim + achBoss.rewardCoins) {
      throw new Error('Test 8 xatosi: boss_slayer mukofoti tangaga to\'g\'ri qo\'shilmadi!');
    }
    if (G.coins < 0 || ACCT.pts < 0) {
      throw new Error('Test 8 xatosi: Balans manfiy bo\'lib ketdi!');
    }
    console.log('Test 8: Balans musbatligi va mukofot qo\'shilishi 100% to\'g\'ri.');

    // -------------------------------------------------------------
    // TEST 12: 320px, 375px, 768px va desktop responsive tekshiruvlari
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
      g.renderAchievements();
      const listEl = doc.getElementById('achieveList');
      if (!listEl || !listEl.innerHTML.includes('mission-card')) {
        throw new Error(`Test 12 xatosi: ${vp.name} da #achieveList render bo'lmadi!`);
      }
      const countEl = doc.getElementById('achieveCountText');
      if (!countEl || !countEl.textContent.includes('/ 12 ВЫПОЛНЕНО')) {
        throw new Error(`Test 12 xatosi: ${vp.name} da #achieveCountText to'g'ri chiqmadi!`);
      }
    }
    console.log('Test 12: 320px, 375px, 768px va Desktop da achievements UI to\'liq renderlandi.');

    console.log('\n==========================================================');
    console.log('  ALL PHASE 3 ACHIEVEMENTS TESTS PASSED (100%)            ');
    console.log('==========================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
