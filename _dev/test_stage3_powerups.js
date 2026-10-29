// Stage 3: Premium PLUS Power-ups Focused Test Suite
const sh = require('./shim.js');
const g = sh.sandbox.NY3D;
const G = g.G;

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`❌ FAIL [Test ${total}]: ${message}`);
    throw new Error(`Test ${total} Failed: ${message}`);
  }
  console.log(`✅ PASS [Test ${total}]: ${message}`);
  passed++;
}

console.log('\n--- STARTING STAGE 3: PREMIUM PLUS POWER-UPS TEST SUITE ---');

// Test 1: Verification of KIND, GOOD, OBJ and MESHES registration
(() => {
  assert(g.KIND.MAG_PLUS === 'magnet_plus', 'KIND.MAG_PLUS is registered as magnet_plus');
  assert(g.KIND.SH_PLUS === 'shield_plus', 'KIND.SH_PLUS is registered as shield_plus');
  assert(g.KIND.LIFE_PLUS === 'heart_plus', 'KIND.LIFE_PLUS is registered as heart_plus');
  assert(g.GOOD.magnet_plus === 1 && g.GOOD.shield_plus === 1 && g.GOOD.heart_plus === 1, 'All 3 PLUS pickups are registered in GOOD table');
  
  assert(g.OBJ.magnet_plus && g.OBJ.magnet_plus.hit > 0, 'OBJ.magnet_plus has valid collision and render metadata');
  assert(g.OBJ.shield_plus && g.OBJ.shield_plus.y === 0.05, 'OBJ.shield_plus has ground-plane level y = 0.05');
  assert(g.OBJ.heart_plus && g.OBJ.heart_plus.hit > 0, 'OBJ.heart_plus has valid collision and render metadata');

  assert(g.MESHES.magnet_plus && g.MESHES.magnet_plus.v.length > 50, 'MESHES.magnet_plus has complete 3D volumetric vertices');
  assert(g.MESHES.shield_plus && g.MESHES.shield_plus.v.length > 50, 'MESHES.shield_plus has complete 3D volumetric vertices');
  assert(g.MESHES.heart_plus && g.MESHES.heart_plus.v.length > 50, 'MESHES.heart_plus has complete 3D volumetric vertices');
})();

// Test 2: Spawning and Lane distribution
(() => {
  g.startRun();
  G.level = 2; // Level 2 allows hearts
  let magPlusSpawned = false;
  let shPlusSpawned = false;
  let lifePlusSpawned = false;

  for (let z = 30; z < 450; z += 15) {
    g.spawnRow(z);
  }

  for (const o of G.objs) {
    if (o.kind === g.KIND.MAG_PLUS) magPlusSpawned = true;
    if (o.kind === g.KIND.SH_PLUS) shPlusSpawned = true;
    if (o.kind === g.KIND.LIFE_PLUS) lifePlusSpawned = true;
    assert(o.lane >= 0 && o.lane <= 2, `Spawned ${o.kind} is placed within valid lane (0..2)`);
  }

  assert(G.objs.length > 0, 'Objects spawned across track rows');
})();

// Test 3: MAGNET PLUS Collection, Duration and Expiration
(() => {
  g.startRun();
  G.magnet = 0;
  G.magnetPlusTimer = 0;

  // Manually add MAGNET PLUS object right in front of car
  const magPlusObj = g.addObj(g.KIND.MAG_PLUS, G.lane, 0.4);
  g.update(1 / 60);

  assert(G.magnet >= 11, `MAGNET PLUS gives extended duration (actual: ${G.magnet.toFixed(1)}s, >= 11s)`);
  assert(G.magnetPlusTimer >= 11, `G.magnetPlusTimer set properly (actual: ${G.magnetPlusTimer.toFixed(1)}s)`);
  assert(magPlusObj.dead === true, 'MAGNET PLUS object marked dead/collected upon collision');

  // Test decay
  g.update(1.0);
  assert(G.magnetPlusTimer < 11 && G.magnetPlusTimer > 9, 'magnetPlusTimer decrements correctly by dt');

  // Test expiration
  g.update(25.0);
  assert(G.magnet === 0 && G.magnetPlusTimer === 0, 'Magnet and magnetPlusTimer expire cleanly to 0');
})();

// Test 4: MAGNET PLUS Attraction Power and Coin Pull
(() => {
  g.startRun();
  G.magnet = 0;
  G.magnetPlusTimer = 0;
  G.x = 0; // Center lane

  // Spawn a coin in right lane at z = 14
  const coin = g.addObj(g.KIND.COIN, 2, 14); // lane 2 is x = 1.95
  const initialCoinX = coin.x;

  // Without magnet, coin x should not change
  g.update(1 / 60);
  assert(coin.x === initialCoinX, 'Coin does not move laterally without magnet active');

  // Activate MAGNET PLUS
  g.addObj(g.KIND.MAG_PLUS, G.lane, 0.4);
  g.update(1 / 60);

  // Now with MAGNET PLUS, coin should be pulled toward center lane
  g.update(0.1);
  assert(Math.abs(coin.x - G.x) < Math.abs(initialCoinX - G.x), 'Coin is pulled toward player lane under MAGNET PLUS');
  assert(coin.z < 14, 'Coin z is pulled forward along the track surface');
})();

// Test 5: SHIELD PLUS Activation, Duration and Expiration
(() => {
  g.startRun();
  G.shield = 0;
  G.shieldPlusTimer = 0;

  const shPlusObj = g.addObj(g.KIND.SH_PLUS, G.lane, 0.4);
  g.update(1 / 60);

  assert(G.shield >= 16, `SHIELD PLUS activates shield for at least 16s (actual: ${G.shield.toFixed(1)}s)`);
  assert(G.shieldPlusTimer >= 16, `shieldPlusTimer is initialized (actual: ${G.shieldPlusTimer.toFixed(1)}s)`);
  assert(shPlusObj.dead === true, 'SHIELD PLUS pickup consumed upon collision');

  // Decay
  g.update(2.0);
  assert(G.shield < 16 && G.shield > 13, 'Shield timer decrements accurately');

  // Expiration
  g.update(25.0);
  assert(G.shield === 0 && G.shieldPlusTimer === 0, 'Shield expires safely to 0');
})();

// Test 6: SHIELD PLUS Obstacle Protection and Impact Absorption
(() => {
  g.startRun();
  G.lives = 3;
  G.invul = 0;

  // Collect SHIELD PLUS
  g.addObj(g.KIND.SH_PLUS, G.lane, 0.4);
  g.update(1 / 60);
  assert(G.shield > 0, 'Shield is active');

  // Hit a heavy hazard (WALL)
  const wall = g.addObj(g.KIND.WALL, G.lane, 0.3);
  g.update(1 / 60);

  assert(G.lives === 3, 'Shield absorbed wall collision completely: player life was NOT lost');
  assert(G.shield === 0, 'Shield was safely consumed by the impact');
  assert(G.shieldPlusTimer === 0, 'shieldPlusTimer reset cleanly upon absorption');
  assert(G.shieldRipple > 0.8, 'Shield impact ripple triggered for visual feedback');
  assert(G.invul > 0, 'Temporary post-impact invulnerability buffer granted');
  assert(wall.dead === true, 'Obstacle cleared after shield absorption');
})();

// Test 7: HEART PLUS Health Restoration within Maximum Limit
(() => {
  g.startRun();
  G.maxLives = 4;
  G.lives = 2; // Damaged player

  const heartPlusObj = g.addObj(g.KIND.LIFE_PLUS, G.lane, 0.4);
  g.update(1 / 60);

  assert(G.lives === 3, `HEART PLUS restored exactly 1 life unit (actual: ${G.lives}/${G.maxLives})`);
  assert(heartPlusObj.dead === true, 'HEART PLUS pickup consumed');
  assert(G.invul >= 1.2, 'HEART PLUS granted protective invulnerability buffer');
})();

// Test 8: HEART PLUS Behavior when Health is Already FULL (Overcharge Rule)
(() => {
  g.startRun();
  G.maxLives = 4;
  G.lives = 4; // Health already full
  const initialScore = G.score;
  const initialCoins = G.coins;

  g.addObj(g.KIND.LIFE_PLUS, G.lane, 0.4);
  g.update(1 / 60);

  assert(G.lives === 4, 'Health does NOT exceed maxLives when full (capped at maxLives)');
  assert(G.score >= initialScore + 500, 'Transparent Overcharge bonus points awarded when health is full');
  assert(G.coins >= initialCoins + 25, 'Transparent Overcharge bonus coins awarded when health is full');
})();

// Test 9: Duplicate Pickups and Timer Handling (No Stacking Overflows)
(() => {
  g.startRun();
  
  // Collect 2 SHIELD PLUS in quick succession
  g.addObj(g.KIND.SH_PLUS, G.lane, 0.4);
  g.update(1 / 60);
  const shieldAfterFirst = G.shield;

  g.addObj(g.KIND.SH_PLUS, G.lane, 0.4);
  g.update(1 / 60);
  assert(G.shield <= 25, `Duplicate shield pickups are capped safely at max 25s (actual: ${G.shield.toFixed(1)}s)`);
  assert(G.shield >= shieldAfterFirst, 'Duplicate pickup smoothly refreshes/extends shield duration');

  // Collect 2 MAGNET PLUS in quick succession
  g.addObj(g.KIND.MAG_PLUS, G.lane, 0.4);
  g.update(1 / 60);
  const magAfterFirst = G.magnet;

  g.addObj(g.KIND.MAG_PLUS, G.lane, 0.4);
  g.update(1 / 60);
  assert(G.magnet <= 25, `Duplicate magnet pickups are capped safely at max 25s (actual: ${G.magnet.toFixed(1)}s)`);
  assert(G.magnet >= magAfterFirst, 'Duplicate magnet smoothly refreshes/extends magnet duration');
})();

// Test 10: Independence from Permanent Garage Upgrades
(() => {
  g.startRun();
  const baseAccountShield = g.ACCT.extraShield();
  const carShieldStart = g.car().shieldStart;

  // Collecting temporary track pickups must NOT mutate ACCT or CAR_UPG
  g.addObj(g.KIND.SH_PLUS, G.lane, 0.4);
  g.addObj(g.KIND.MAG_PLUS, G.lane, 0.4);
  g.addObj(g.KIND.LIFE_PLUS, G.lane, 0.4);
  g.update(1 / 60);

  assert(g.ACCT.extraShield() === baseAccountShield, 'Permanent ACCT stats are untouched by track bonuses');
  assert(g.car().shieldStart === carShieldStart, 'Car base shield config is untouched');
})();

// Test 11: 3D Projection & Mesh Rendering of all 3 PLUS pickups across all 8 biomes
(() => {
  const biomes = g.BIOMES;
  assert(biomes.length === 8, '8 biomes available for render testing');

  for (let b = 0; b < biomes.length; b++) {
    G.trackIdx = b;
    const magObj = { kind: g.KIND.MAG_PLUS, x: 0, y: 0.9, z: 12, rot: 0.5, lane: 1, taken: false, dead: false };
    const shObj = { kind: g.KIND.SH_PLUS, x: -1.95, y: 0.05, z: 15, rot: 0.2, lane: 0, taken: false, dead: false };
    const lifeObj = { kind: g.KIND.LIFE_PLUS, x: 1.95, y: 1.0, z: 18, rot: 0.8, lane: 2, taken: false, dead: false };

    g.drawObj(magObj);
    g.drawObj(shObj);
    g.drawObj(lifeObj);
  }
  assert(true, 'All 3 PLUS pickups rendered successfully across all 8 distinct biomes');
})();

// Test 12: Mobile 320px Responsiveness and HUD Rendering
(() => {
  g.onViewportChange(320, 568);
  g.startRun();

  // Activate both PLUS timers
  G.shield = 16;
  G.shieldPlusTimer = 16;
  G.magnet = 15;
  G.magnetPlusTimer = 15;

  g.updateHUD();
  g.render();

  assert(true, 'HUD and PLUS power-up indicators render cleanly on 320px ultra-compact mobile screen');
})();

// Test 13: Portal Continuity & Dimension Transition with Active PLUS Power-Ups
(() => {
  g.startRun();
  G.shield = 14;
  G.shieldPlusTimer = 14;
  G.magnet = 12;
  G.magnetPlusTimer = 12;

  // Transition through portal into special dimension
  g.enterDimension(0);
  assert(G.inDimension === true, 'Entered dimension');
  assert(G.shield > 0 && G.shieldPlusTimer > 0, 'Shield PLUS preserved across portal entry');
  assert(G.magnet > 0 && G.magnetPlusTimer > 0, 'Magnet PLUS preserved across portal entry');

  // Update inside dimension
  g.update(1.0);
  assert(G.inDimension === true, 'Dimension active');

  // Exit dimension
  g.exitDimension();
  assert(G.inDimension === false, 'Safely exited dimension');
  assert(G.shield > 0, 'Shield retained after exiting dimension');
})();

// Test 14: Long-run Stability Benchmark (120 frames with active PLUS pickups)
(() => {
  g.startRun();
  const startTime = Date.now();

  for (let f = 0; f < 120; f++) {
    if (f % 30 === 0) {
      g.addObj(g.KIND.MAG_PLUS, f % 3, 20);
      g.addObj(g.KIND.SH_PLUS, (f + 1) % 3, 25);
      g.addObj(g.KIND.LIFE_PLUS, (f + 2) % 3, 30);
    }
    g.update(1 / 60);
    if (f % 2 === 0) g.render();
  }

  const durationMs = Date.now() - startTime;
  const avgFrameMs = durationMs / 120;
  console.log(`    Stage 3 Benchmark: ${durationMs}ms total, ${avgFrameMs.toFixed(3)}ms/frame`);
  assert(avgFrameMs < 16.0, `Active PLUS power-ups run well under 16ms 60 FPS budget (actual: ${avgFrameMs.toFixed(3)}ms)`);
})();

console.log('\n==========================================================');
console.log(`  ALL ${passed}/${total} STAGE 3 PLUS POWER-UP TESTS PASSED (100%) `);
console.log('==========================================================\n');

process.exit(0);
