const sh = require('./shim.js');

try {
  const g = sh.sandbox.NY3D;
  const G = g.G;
  const tut = g.TUTORIAL_SYSTEM;
  if (!tut) throw new Error('TUTORIAL_SYSTEM eksport qilinmadi!');

  // 1. First-time Intro Check
  tut.showIntro();
  const introModal = sh.sandbox.document.getElementById('introModal');
  if (!introModal || introModal.classList.contains('hidden')) {
    throw new Error('Intro modal ochilmadi!');
  }
  console.log('1. Intro modal check passed.');

  // 2. Intro Skip test
  tut.skipIntro();
  if (!introModal.classList.contains('hidden')) {
    throw new Error('skipIntro() dan song introModal yopilmadi!');
  }
  if (!g.store.get('neorush_intro_seen')) {
    throw new Error('neorush_intro_seen localStorage ga saqlanmadi!');
  }
  console.log('2. Intro skip passed.');

  // 3. Start Interactive Race Tutorial (Step 1: Lane Switching)
  tut.startRace(1);
  if (!tut.active || tut.step !== 1 || !G.running || !G.isTutorial) {
    throw new Error('startRace(1) togri initsializatsiya qilinmadi: active=' + tut.active + ' step=' + tut.step);
  }
  const banner = sh.sandbox.document.getElementById('tutorialBanner');
  if (!banner || banner.classList.contains('hidden')) {
    throw new Error('Poyga tutorialida #tutorialBanner korinmadi!');
  }

  // Simulate Lane Left & Right
  g.moveLane(-1);
  g.moveLane(1);
  if (!tut.tasks.left || !tut.tasks.right) {
    throw new Error('Yolak almashtirish vazifalari bajarilmadi: left=' + tut.tasks.left + ' right=' + tut.tasks.right);
  }
  console.log('3. Step 1 (Lane switching) passed.');

  // 4. Step 2: Obstacles and Coins
  tut.setStep(2);
  if (tut.step !== 2) throw new Error('Step 2 ga otilmadi!');
  tut.onAction('coin');
  g.jump();
  if (!tut.tasks.coin || !tut.tasks.jump) {
    throw new Error('Step 2 tanga yoki sakrash bajarilmadi: coin=' + tut.tasks.coin + ' jump=' + tut.tasks.jump);
  }
  console.log('4. Step 2 (Obstacles and coins) passed.');

  // 5. Step 3: Nitro
  tut.setStep(3);
  if (tut.step !== 3) throw new Error('Step 3 ga otilmadi!');
  tut.onAction('nitro');
  if (!tut.tasks.nitro) throw new Error('Nitro amali bajarilmadi!');
  console.log('5. Step 3 (Nitro) passed.');

  // 6. Step 4: Shield and Lives
  tut.setStep(4);
  if (G.shield <= 0) throw new Error('Step 4 da qalqon berilmadi!');
  if (G.maxLives < 4) throw new Error('Step 4 da 4 ta hayot bolishi kerak!');
  console.log('6. Step 4 (Shield and Lives) passed.');

  // 7. Step 5: Portals and Biomes
  tut.setStep(5);
  const portalObjs = G.objs.filter(o => o.kind.startsWith('portal_'));
  if (portalObjs.length < 3) throw new Error('Step 5 da 3-yolakli portal guruhi yaratilmadi: ' + portalObjs.length);
  tut.onAction('portal');
  if (!tut.tasks.portal) throw new Error('Portal kirish amali bajarilmadi!');
  console.log('7. Step 5 (Portals and Biomes) passed.');

  // 8. Garage Tutorial Step
  const coinsBefore = G.coins;
  tut.startGarage();
  if (tut.step !== 6 || G.running) throw new Error('Garaj tutoriali ochilmadi!');
  if (G.coins !== coinsBefore) throw new Error('Tutorialda tangalar sarflandi!');
  console.log('8. Garage tutorial step passed.');

  // 9. Tuning Tutorial Step
  tut.startTuning();
  if (tut.step !== 7) throw new Error('Tuning tutoriali ochilmadi!');
  console.log('9. Tuning tutorial step passed.');

  // 10. Complete Modal
  tut.showComplete();
  const compModal = sh.sandbox.document.getElementById('tutorialCompleteModal');
  if (!compModal || compModal.classList.contains('hidden')) {
    throw new Error('Yakuniy modal ochilmadi!');
  }
  if (!g.store.get('tutDone')) throw new Error('tutDone saqlanmadi!');
  console.log('10. Completion modal passed.');

  // 11. Mobile 320px check
  sh.win.innerWidth = 320; sh.win.innerHeight = 568;
  g.render();
  tut.hideComplete();
  console.log('11. Mobile 320px rendering passed.');

  console.log('\n--- ALL TUTORIAL SUITE TESTS PASSED (100%) ---');
  process.exit(0);

} catch (err) {
  console.error('TUTORIAL TEST FAILED:', err);
  process.exit(1);
}
