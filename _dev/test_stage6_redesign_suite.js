const fs = require('fs');
const assert = require('assert');
const sh = require('./shim.js');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ PASS: ${desc}`);
  } catch (err) {
    failed++;
    console.error(`❌ FAIL: ${desc}`);
    console.error(`   ${err.message}`);
  }
}

console.log('=== NEORUSH STAGE 6: MISSIONS, ACHIEVEMENTS & SETTINGS REGRESSION SUITE ===');

const doc = sh.sandbox.document;
const g = sh.sandbox.NY3D;
const G = g.G;
const Sound = g.Sound;
const store = g.store;
const ACCT = g.ACCT;
const MISSIONS = g.MISSIONS;
const ACHIEVEMENTS = g.ACHIEVEMENTS;

// 1. Missions Interface
it('1.1: Missions list renders all 8 canonical daily missions', () => {
  g.setMenuView('garage');
  g.activateTab('missions');
  g.renderMissions();

  const mList = doc.getElementById('missionsList');
  assert(mList, '#missionsList must exist');
  const cardsCount = (mList.innerHTML.match(/class="[^"]*mission-card/g) || []).length;
  assert.strictEqual(cardsCount, MISSIONS.length, `Must render exactly ${MISSIONS.length} mission cards`);
});

it('1.2: Missions countdown timer element exists and updates', () => {
  const timerEl = doc.getElementById('missionsTimerText');
  assert(timerEl, '#missionsTimerText must exist');
  g.updateMissionsTimerUI();
  assert(/СБРОС:\s*\d{2}:\d{2}:\d{2}/.test(timerEl.textContent), 'Timer text must match reset format');
});

it('1.3: Mission claiming rewards coins and points correctly with single-claim protection', () => {
  const testMission = MISSIONS[0]; // dist3k
  const mSt = g.getMissionState();
  mSt.items[testMission.id] = { cur: testMission.goal, done: true, claimed: false };
  g.setMissionState(mSt);

  const startCoins = G.coins;
  const startPts = ACCT.pts;

  g.claimMission(testMission.id);
  assert.strictEqual(G.coins, startCoins + testMission.rewardCoins, 'Coins must be awarded');
  assert.strictEqual(ACCT.pts, startPts + testMission.rewardPts, 'Account points must be awarded');

  const afterSt = g.getMissionState();
  assert.strictEqual(afterSt.items[testMission.id].claimed, true, 'Mission must be marked claimed');

  // Double claim attempt must be blocked
  g.claimMission(testMission.id);
  assert.strictEqual(G.coins, startCoins + testMission.rewardCoins, 'Coins must not increase on second claim');
});

// 2. Achievements Interface
it('2.1: Achievements list renders all 12 canonical career milestones', () => {
  g.setMenuView('garage');
  g.activateTab('achieve');
  g.renderAchievements();

  const achList = doc.getElementById('achieveList');
  assert(achList, '#achieveList must exist');
  const cardsCount = (achList.innerHTML.match(/class="[^"]*achieve-card/g) || achList.innerHTML.match(/class="[^"]*mission-card/g) || []).length;
  assert.strictEqual(cardsCount, ACHIEVEMENTS.length, `Must render exactly ${ACHIEVEMENTS.length} achievement cards`);
});

it('2.2: Achievement count indicator reflects completed milestones', () => {
  const countEl = doc.getElementById('achieveCountText');
  assert(countEl, '#achieveCountText must exist');
  assert(/\d+\s*\/\s*12\s+ВЫПОЛНЕНО/i.test(countEl.textContent), 'Must display completed ratio');
});

it('2.3: Achievement claiming rewards coins and points with single-claim protection', () => {
  const testAch = ACHIEVEMENTS[0]; // first_race
  const aSt = g.getAchieveState();
  aSt[testAch.id] = { cur: testAch.goal, done: true, claimed: false };
  g.setAchieveState(aSt);

  const startCoins = G.coins;
  const startPts = ACCT.pts;

  g.claimAchievement(testAch.id);
  assert.strictEqual(G.coins, startCoins + testAch.rewardCoins, 'Coins must be awarded');
  assert.strictEqual(ACCT.pts, startPts + testAch.rewardPts, 'Account points must be awarded');

  const afterSt = g.getAchieveState();
  assert.strictEqual(afterSt[testAch.id].claimed, true, 'Achievement must be marked claimed');

  // Double claim attempt must be blocked
  g.claimAchievement(testAch.id);
  assert.strictEqual(G.coins, startCoins + testAch.rewardCoins, 'Coins must not increase on second claim');
});

// 3. Settings Interface
it('3.1: Settings panel contains all required interactive control elements', () => {
  const tabSet = doc.getElementById('tabSet');
  assert(tabSet, '#tabSet must exist');
  assert(doc.getElementById('btnSnd'), '#btnSnd must exist');
  assert(doc.getElementById('btnMus'), '#btnMus must exist');
  assert(doc.getElementById('btnQual'), '#btnQual must exist');
  assert(doc.getElementById('btnCtl'), '#btnCtl must exist');
  assert(doc.getElementById('btnTut'), '#btnTut must exist');
});

it('3.2: Sound and Music buttons toggle audio state and text correctly', () => {
  const btnSnd = doc.getElementById('btnSnd');
  const btnMus = doc.getElementById('btnMus');

  Sound.set(true);
  g.menuStats();
  assert.strictEqual(btnSnd.textContent.trim(), 'ВКЛ', 'Sound button text should be ВКЛ when Sound.on is true');

  Sound.set(false);
  g.menuStats();
  assert.strictEqual(btnSnd.textContent.trim(), 'ВЫКЛ', 'Sound button text should be ВЫКЛ when Sound.on is false');

  Sound.setMusic(true);
  g.menuStats();
  assert.strictEqual(btnMus.textContent.trim(), 'ВКЛ', 'Music button text should be ВКЛ when Sound.musicOn is true');

  Sound.setMusic(false);
  g.menuStats();
  assert.strictEqual(btnMus.textContent.trim(), 'ВЫКЛ', 'Music button text should be ВЫКЛ when Sound.musicOn is false');

  // Restore defaults
  Sound.set(true);
  Sound.setMusic(true);
  g.menuStats();
});

it('3.3: Graphics quality button cycles through low, medium, and high tiers', () => {
  const btnQual = doc.getElementById('btnQual');
  G.quality = 'high';
  g.menuStats();
  assert.strictEqual(btnQual.textContent.trim(), 'Высокая');

  G.quality = 'low';
  g.menuStats();
  assert.strictEqual(btnQual.textContent.trim(), 'Низкая');

  G.quality = 'medium';
  g.menuStats();
  assert.strictEqual(btnQual.textContent.trim(), 'Средняя');
});

it('3.4: SVG icons for settings and currency exist in defs', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert(html.includes('id="nr-ic-settings"'), 'nr-ic-settings icon must exist');
  assert(html.includes('id="nr-ic-mission"'), 'nr-ic-mission icon must exist');
  assert(html.includes('id="nr-ic-trophy"'), 'nr-ic-trophy icon must exist');
});

console.log('\n======================================================');
console.log(`STAGE 6 REGRESSION: ${passed} PASSED / ${failed} FAILED`);
console.log('======================================================');

if (failed > 0) process.exit(1);
process.exit(0);
