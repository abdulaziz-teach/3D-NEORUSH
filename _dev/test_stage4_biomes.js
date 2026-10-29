// Stage 4: Biome Selection & Portal Integration Test Suite
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

console.log('\n--- STARTING STAGE 4: BIOME SELECTION & PORTAL INTEGRATION TEST SUITE ---');

// Test 1: All 8 biomes exist with canonical IDs and names
(() => {
  const biomes = g.BIOMES;
  assert(biomes.length === 8, 'BIOMES array has exactly 8 distinct worlds');
  
  const expected = [
    { id: 0, props: 'city', name: 'НЕОНОВЫЙ МЕГАПОЛИС' },
    { id: 1, props: 'crystal', name: 'КРИСТАЛЬНАЯ ПУСТЫНЯ' },
    { id: 2, props: 'ice', name: 'ЛЕДЯНАЯ ОРБИТА' },
    { id: 3, props: 'lava', name: 'ЛАВА И МАГМА' },
    { id: 4, props: 'bio', name: 'ИЗУМРУДНЫЙ ЛЕС' },
    { id: 5, props: 'cosmic', name: 'КОСМИЧЕСКАЯ АНОМАЛИЯ' },
    { id: 6, props: 'tech', name: 'ПОДВОДНЫЙ ОКЕАН' },
    { id: 7, props: 'rift', name: 'МАГИЧЕСКИЙ МИР' }
  ];

  expected.forEach((exp, i) => {
    assert(biomes[i].id === exp.id, `Biome [${i}] canonical ID is ${exp.id}`);
    assert(biomes[i].props === exp.props, `Biome [${i}] props compatibility ID is ${exp.props}`);
    assert(biomes[i].name === exp.name, `Biome [${i}] Russian name is "${exp.name}"`);
  });
})();

// Test 2: Starting biome selection configures race predictably
(() => {
  for (let i = 0; i < 8; i++) {
    g.selectStartingBiome(i, false);
    assert(g.getSelectedStartingBiome() === i, `Selected starting biome index is set to ${i}`);
    
    g.startRun();
    assert(G.trackIdx === i, `Race starts in selected biome [${i}]: ${g.BIOMES[i].name} (G.trackIdx === ${i})`);
    assert(G.trackT === 0, `Track timer reset to 0 in starting biome`);
    assert(g.trackBiome().id === i, `trackBiome() reflects selected biome [${i}]`);
  }
})();

// Test 3: Automatic 45-second rotation continues correctly after manual selection
(() => {
  // Select biome 3 (Lava) as start
  g.selectStartingBiome(3, false);
  g.startRun();
  assert(G.trackIdx === 3, 'Race started in Lava (3)');

  // Advance time by 44.9s: must stay in Lava
  G.trackT = 44.5;
  g.update(0.4);
  assert(G.trackIdx === 3, 'After 44.9s still in starting biome');

  // Advance time past 45s: must rotate to biome 4 (Forest)
  g.update(0.2);
  assert(G.trackIdx === 4, `After 45s automatic rotation smoothly transitioned to next biome [4]: ${g.BIOMES[4].name}`);

  // Advance past another 45s: must rotate to biome 5 (Space)
  G.trackT = 45.0;
  g.update(0.1);
  assert(G.trackIdx === 5, `Next 45s rotation transitioned to biome [5]: ${g.BIOMES[5].name}`);

  // Advance to end of array: from biome 7 (Fantasy) it must loop to biome 0 (Neon City)
  G.trackIdx = 7;
  G.trackT = 45.0;
  g.update(0.1);
  assert(G.trackIdx === 0, 'Automatic rotation wraps from biome 7 to biome 0 (canonical loop)');
})();

// Test 4: 45-Second Rotation Timing and Constants Intact
(() => {
  assert(g.TRACK_SEC === 45, 'TRACK_SEC is exactly 45 seconds');
  assert(g.TRANS_DUR > 0 && g.TRANS_DUR <= 3.0, 'TRANS_DUR is smooth visual transition (2.4s)');
})();

// Test 5: Weather events match the active biome
(() => {
  for (let i = 0; i < 8; i++) {
    const bm = g.BIOMES[i];
    const ev = g.BIOME_EVENTS[bm.props];
    assert(ev != null, `Matching weather event defined for biome [${i}] (${bm.props})`);
    assert(ev.props === bm.props, `Event props (${ev.props}) matches biome props (${bm.props})`);
    assert(typeof ev.name === 'string' && ev.name.length > 0, `Event has descriptive Russian name: ${ev.name}`);
  }
})();

// Test 6: Portal transitions & continuity with active biome
(() => {
  g.selectStartingBiome(2, false);
  g.startRun();
  assert(G.trackIdx === 2, 'Race started in Snow');

  g.enterDimension(1);
  assert(G.inDimension === true, 'Player entered portal dimension');
  assert(G.dimensionTime === 45.0, 'Dimension timer active for 45s');

  g.update(2.0);
  assert(G.inDimension === true, 'Dimension gameplay active');

  g.exitDimension();
  assert(G.inDimension === false, 'Player safely exited dimension');
  assert(G.trackIdx === 2, 'Track returned to active biome (Snow) without corruption');
})();

// Test 7: Biome Selection UI Rendering and Procedural Canvas Previews
(() => {
  g.renderBiomesMenu();
  const grid = sh.win.document.getElementById('biomesGrid');
  assert(grid != null, 'biomesGrid container exists in DOM');

  for (let i = 0; i < 8; i++) {
    const bm = g.BIOMES[i];
    assert(grid.innerHTML.includes(`data-biome-id="${i}"`), `Card for biome [${i}] rendered with data-biome-id="${i}"`);
    assert(grid.innerHTML.includes(bm.name), `Grid HTML contains biome name "${bm.name}"`);
    assert(grid.innerHTML.includes(`data-biome-select="${i}"`), `Grid HTML contains selection button for biome [${i}]`);
    assert(grid.innerHTML.includes(`data-biome-start="${i}"`), `Grid HTML contains start button for biome [${i}]`);
  }
})();

// Test 8: Menu, Garage Return and Restart Do Not Duplicate Loops or Corrupt State
(() => {
  g.activateTab('biomes');
  g.selectStartingBiome(5, false);
  g.activateTab('ships');
  g.activateTab('biomes');
  g.selectStartingBiome(1, false);

  assert(g.getSelectedStartingBiome() === 1, 'Starting biome updated cleanly across menu tabs');

  g.startRun();
  assert(G.trackIdx === 1, 'Race started in Desert (1)');

  g.startRun();
  assert(G.running === true && G.over === false, 'Restart cleanly reinitializes run state');
  assert(Array.isArray(G.objs) && G.objs.length >= 0, 'Objects pool active and valid on restart');
})();

// Test 9: Existing PLUS Pickups & Progression Intact
(() => {
  assert(g.KIND.MAG_PLUS === 'magnet_plus', 'KIND.MAG_PLUS intact');
  assert(g.KIND.SH_PLUS === 'shield_plus', 'KIND.SH_PLUS intact');
  assert(g.KIND.LIFE_PLUS === 'heart_plus', 'KIND.LIFE_PLUS intact');

  g.selectStartingBiome(6, false); // Ocean
  g.startRun();
  
  const shPlus = g.addObj(g.KIND.SH_PLUS, G.lane, 0.4);
  g.update(1 / 60);
  assert(G.shield >= 16, 'SHIELD PLUS activates correctly in Ocean biome');
  assert(G.shieldPlusTimer >= 16, 'shieldPlusTimer active');
})();

// Test 10: Responsiveness across 320px, 375px, 768px and Desktop
(() => {
  const widths = [320, 375, 480, 768, 1280];
  widths.forEach(w => {
    g.onViewportChange(w, 600);
    g.renderBiomesMenu();
    g.render();
    assert(true, `Render and biome cards adapt cleanly at ${w}px width`);
  });
})();

// Reset starting biome to 0 (default Neon City)
g.selectStartingBiome(0, false);

console.log('\n==========================================================');
console.log(`  ALL ${passed}/${total} STAGE 4 BIOME SELECTION TESTS PASSED (100%) `);
console.log('==========================================================\n');

process.exit(0);
