/**
 * NEORUSH Stage 5 Comprehensive Audit & Verification Suite
 * - In-race HUD polish & PLUS distinction (MAGNET+, SHIELD+, HEART+ surge)
 * - Garage polish, 30 cars, economy invariance
 * - Multi-viewport responsiveness (320px, 375px, 480px, 768px, 1024px, 1366px, 1920px)
 * - Safe-area insets, touch targets (>= 40-44px), zero overflow
 * - Biome selection menu & 8 biomes integrity
 */

const fs = require('fs');
const assert = require('assert');

let testsPassed = 0;
let testsFailed = 0;

function it(desc, fn) {
  try {
    fn();
    testsPassed++;
  } catch (err) {
    testsFailed++;
    console.error(`  FAIL: ${desc}`);
    console.error(`    ${err.message}`);
  }
}

console.log('--- STAGE 5 AUDIT & VERIFICATION SUITE ---');

const gameSrc = fs.readFileSync('game.js', 'utf8');
const htmlSrc = fs.readFileSync('index.html', 'utf8');

// Section 1: HUD PLUS Distinction
it('1.1: updateHUD toggles MAGNET+ label and plus-active class', () => {
  assert(gameSrc.includes("lbl.textContent = magPlusActive ? 'МАГНИТ+ ⚡' : 'МАГНИТ'"), 'Missing dynamic MAGNET+ text toggle in updateHUD');
  assert(gameSrc.includes("el.pwMag.classList.toggle('plus-active', magPlusActive)"), 'Missing pwMag plus-active toggle');
});

it('1.2: updateHUD toggles SHIELD+ label and plus-active class', () => {
  assert(gameSrc.includes("lbl.textContent = shPlusActive ? 'ЩИТ+ 🛡' : 'ЩИТ'"), 'Missing dynamic SHIELD+ text toggle in updateHUD');
  assert(gameSrc.includes("el.pwSh.classList.toggle('plus-active', shPlusActive)"), 'Missing pwSh plus-active toggle');
});

it('1.3: HEART PLUS triggers heart-plus-surge pulse animation on #lives', () => {
  assert(gameSrc.includes("el.lives.classList.add('heart-plus-surge')"), 'Missing heart-plus-surge addition on lives');
  assert(htmlSrc.includes('#lives.heart-plus-surge'), 'Missing #lives.heart-plus-surge CSS rule');
  assert(htmlSrc.includes('@keyframes heartSurgePulse'), 'Missing @keyframes heartSurgePulse');
});

it('1.4: PLUS badges have distinct neon glow styles in CSS', () => {
  assert(htmlSrc.includes('#powerRow .pw.mag.plus-active'), 'Missing mag.plus-active styling');
  assert(htmlSrc.includes('#powerRow .pw.sh.plus-active'), 'Missing sh.plus-active styling');
  assert(htmlSrc.includes('border-color:#e879f9'), 'Missing magenta border for mag plus');
  assert(htmlSrc.includes('border-color:#22d3ee'), 'Missing cyan border for shield plus');
});

// Section 2: Garage Integrity & Economy Invariance
it('2.1: Exactly 30 cars exist with 4 rarity tiers and zero common tier', () => {
  const carsMatch = gameSrc.match(/const CARS = \[\s*([\s\S]*?)\s*\];/);
  assert(carsMatch, 'Could not find CARS array');
  const allowedRarities = new Set(['rare', 'epic', 'mythic', 'legendary']);
  
  // Extract cars
  const carObjects = eval(`([${carsMatch[1]}])`);
  assert.strictEqual(carObjects.length, 30, 'Must have exactly 30 cars');
  
  for (let i = 0; i < carObjects.length; i++) {
    const car = carObjects[i];
    assert(allowedRarities.has(car.rarity), `Car ${car.id} has invalid rarity: ${car.rarity}`);
    assert.strictEqual(car.id, i, `Car index ${i} must have id ${i}`);
    assert.strictEqual(typeof car.name, 'string', `Car ${car.id} has invalid name`);
    assert(car.name === car.name.toUpperCase(), `Car ${car.id} name must be uppercase: ${car.name}`);
    assert(typeof car.cost === 'number', `Car ${car.id} has invalid cost`);
    assert(typeof car.perk === 'string', `Car ${car.id} has invalid perk`);
  }
});

it('2.2: Free car invariant: Only starter car SHADOW is free (cost 0), all others cost coins or points', () => {
  const carsMatch = gameSrc.match(/const CARS = \[\s*([\s\S]*?)\s*\];/);
  const carObjects = eval(`([${carsMatch[1]}])`);
  const freeCars = carObjects.filter(c => (c.cost === 0 && (!c.pcost || c.pcost === 0) && (!c.lvl || c.lvl <= 1)));
  assert.strictEqual(freeCars.length, 1, 'Only exactly 1 car (starter) should be completely free');
  assert.strictEqual(freeCars[0].id, 0, 'Starter car ID must be 0');
  assert.strictEqual(freeCars[0].name, 'SHADOW', 'Starter car name must be SHADOW');
});

// Section 3: Viewport & Responsiveness
it('3.1: CSS contains targeted media queries for mobile viewports (320px..768px)', () => {
  assert(htmlSrc.includes('@media(max-width:360px)'), 'Missing 360px breakpoint');
  assert(htmlSrc.includes('@media(max-width:374px)'), 'Missing 374px breakpoint');
  assert(htmlSrc.includes('@media(max-width:430px)'), 'Missing 430px breakpoint');
  assert(htmlSrc.includes('@media(max-width:767px)'), 'Missing 767px breakpoint');
  assert(htmlSrc.includes('@media(max-width:1023px)'), 'Missing 1023px breakpoint');
});

it('3.2: Wide screens (1024px, 1366px, 1920px) expand #tabBiomes and #tabShips cleanly', () => {
  assert(htmlSrc.includes('#tabShips,#tabSkins,#tabBiomes{width:min(1120px,94vw);max-width:none;min-width:0}'),
    'Missing wide container rule for tabBiomes, tabShips, tabSkins');
});

it('3.3: .car-card-stats and .biome-meta-row have flex-wrap to prevent clipping on 320px screens', () => {
  assert(htmlSrc.includes('.car-card-stats{display:flex;flex-wrap:wrap'), 'car-card-stats must have flex-wrap:wrap');
  assert(htmlSrc.includes('.biome-meta-row{\n  display:flex;\n  flex-wrap:wrap'), 'biome-meta-row must have flex-wrap:wrap');
});

it('3.4: Touch targets on mobile action buttons meet minimum sizing', () => {
  assert(htmlSrc.includes('.btn-select-biome, .btn-start-biome{\n  min-height:40px'), 'biome buttons must have min-height');
  assert(htmlSrc.includes('.tbtn{width:50px;height:50px'), 'touch controls must have >= 50px touch targets');
  assert(htmlSrc.includes('env(safe-area-inset-top'), 'safe-area-inset-top must be respected');
  assert(htmlSrc.includes('env(safe-area-inset-bottom'), 'safe-area-inset-bottom must be respected');
});

// Section 4: 8 Biomes & Portal Rotation Integrity
it('4.1: Exactly 8 biomes exist with canonical IDs and order', () => {
  const biomesMatch = gameSrc.match(/const BIOMES = \[\s*([\s\S]*?)\s*\];/);
  assert(biomesMatch, 'Could not find BIOMES array');
  const expectedIds = ['city', 'crystal', 'ice', 'lava', 'bio', 'cosmic', 'tech', 'rift'];
  const expectedNames = [
    'НЕОНОВЫЙ МЕГАПОЛИС', 'КРИСТАЛЬНАЯ ПУСТЫНЯ', 'ЛЕДЯНАЯ ОРБИТА', 'ЛАВА И МАГМА',
    'ИЗУМРУДНЫЙ ЛЕС', 'КОСМИЧЕСКАЯ АНОМАЛИЯ', 'ПОДВОДНЫЙ ОКЕАН', 'МАГИЧЕСКИЙ МИР'
  ];
  const biomeObjects = eval(`([${biomesMatch[1]}])`);
  assert.strictEqual(biomeObjects.length, 8, 'Must have exactly 8 biomes');
  for (let i = 0; i < 8; i++) {
    assert.strictEqual(biomeObjects[i].props, expectedIds[i], `Biome ${i} ID mismatch: ${biomeObjects[i].props} vs ${expectedIds[i]}`);
    assert.strictEqual(biomeObjects[i].name, expectedNames[i], `Biome ${i} Russian name mismatch: ${biomeObjects[i].name}`);
    assert(typeof biomeObjects[i].hz === 'number', `Biome ${i} missing hz difficulty`);
  }
});

it('4.2: Biome rotation timing is preserved (45 seconds per biome)', () => {
  assert(gameSrc.includes('const TRACK_SEC = 45;'), 'TRACK_SEC must be 45 seconds');
});

it('4.3: Portal continuity: Dimensions and transition system intact', () => {
  assert(gameSrc.includes('function enterDimension'), 'enterDimension must be present');
  assert(gameSrc.includes('function exitDimension'), 'exitDimension must be present');
  assert(gameSrc.includes('const DIMENSIONS = ['), 'DIMENSIONS array must be present');
});

// Section 5: Save System & Progression Safety
it('5.1: store helper preserves ny3d_ localStorage keys and data integrity', () => {
  assert(gameSrc.includes("'ny3d_' + k"), 'Must preserve ny3d_ localStorage key prefix');
  assert(gameSrc.includes('selectedStartingBiome'), 'selectedStartingBiome must be preserved in store');
});

console.log(`\nStage 5 Audit Results: ${testsPassed} passed, ${testsFailed} failed.`);
if (testsFailed > 0) {
  process.exit(1);
}
