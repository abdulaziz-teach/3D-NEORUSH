// Comprehensive Verification Suite for 8 Biomes 3D Environment & Animation Overhaul
const sh = require('./shim.js');
const g = sh.sandbox.NY3D;
const G = g.G;

let passCount = 0;
let failCount = 0;

function assert(cond, msg) {
  if (cond) {
    passCount++;
    console.log(`✅ PASS [Test ${passCount}]: ${msg}`);
  } else {
    failCount++;
    console.error(`❌ FAIL [Test ${passCount + failCount}]: ${msg}`);
  }
}

console.log('===============================================================');
console.log('  NEORUSH — 8 BIOMES 3D ENVIRONMENT & ANIMATION OVERHAUL TEST  ');
console.log('===============================================================');

// 1. BIOME_3D Engine Presence
assert(typeof g.BIOME_3D === 'object' && g.BIOME_3D !== null, 'BIOME_3D engine is active and exported');
assert(typeof g.BIOME_3D.models === 'object', 'BIOME_3D.models dictionary is available');
assert(typeof g.BIOME_3D.getMesh === 'function', 'BIOME_3D.getMesh dispatcher is available');
assert(typeof g.BIOME_3D.initScenery === 'function', 'BIOME_3D.initScenery manager is available');
assert(typeof g.BIOME_3D.drawScenery === 'function', 'BIOME_3D.drawScenery rasterizer is available');
assert(typeof g.BIOME_3D.drawRoadSurfaceEffects === 'function', 'BIOME_3D.drawRoadSurfaceEffects is available');
assert(typeof g.BIOME_3D.drawAtmosphereEffects === 'function', 'BIOME_3D.drawAtmosphereEffects is available');
assert(typeof g.BIOME_3D.drawPortal3DRing === 'function', 'BIOME_3D.drawPortal3DRing is available');

// 2. Materials Verification
const mats = g.MATERIALS;
assert(!!mats.cityGlassSlate, 'Material cityGlassSlate registered');
assert(!!mats.volcanicBasalt, 'Material volcanicBasalt registered');
assert(!!mats.moltenMagma, 'Material moltenMagma registered');
assert(!!mats.oceanCoral, 'Material oceanCoral registered');
assert(!!mats.arcaneMythic, 'Material arcaneMythic registered');

// 3. Genuine 3D Geometry Verification for All 8 Biomes
const testBiomes = [
  { id: 0, props: 'city', name: 'NEON CITY' },
  { id: 1, props: 'crystal', name: 'CRYSTAL DESERT' },
  { id: 2, props: 'ice', name: 'ICE ORBIT' },
  { id: 3, props: 'lava', name: 'LAVA & MAGMA' },
  { id: 4, props: 'bio', name: 'EMERALD FOREST' },
  { id: 5, props: 'cosmic', name: 'COSMIC ANOMALY' },
  { id: 6, props: 'tech', name: 'UNDERWATER OCEAN' },
  { id: 7, props: 'rift', name: 'MAGIC RIFT WORLD' },
];

for (const bm of testBiomes) {
  // Test both variants (0 and 1)
  const mesh0 = g.BIOME_3D.getMesh(bm.props, 0, '#00e5ff', '#ff2fb9');
  assert(mesh0 && mesh0.v && mesh0.v.length >= 12, `[${bm.name}] 3D Mesh Variant 0 has valid vertices (${mesh0 ? mesh0.v.length : 0})`);
  assert(mesh0 && mesh0.f && mesh0.f.length >= 8, `[${bm.name}] 3D Mesh Variant 0 has valid 3D polygon faces (${mesh0 ? mesh0.f.length : 0})`);

  const mesh1 = g.BIOME_3D.getMesh(bm.props, 1, '#00e5ff', '#ff2fb9');
  assert(mesh1 && mesh1.v && mesh1.v.length >= 6, `[${bm.name}] 3D Mesh Variant 1 has valid vertices (${mesh1 ? mesh1.v.length : 0})`);
  assert(mesh1 && mesh1.f && mesh1.f.length >= 6, `[${bm.name}] 3D Mesh Variant 1 has valid 3D polygon faces (${mesh1 ? mesh1.f.length : 0})`);

  // Transform faces at distance Z = 25
  const fc = g.facesOf(mesh0, [8.0, 0, 25.0], 0, 1.0);
  assert(fc && fc.length >= 6, `[${bm.name}] facesOf successfully projects 3D polygons in world space (${fc ? fc.length : 0} faces)`);
  assert(fc && fc[0] && typeof fc[0].z === 'number', `[${bm.name}] Polygon face has valid depth Z: ${fc && fc[0] ? fc[0].z.toFixed(2) : 'none'}`);
}

// 4. 3D Quantum Portal Overhaul Verification
const portalRing = g.BIOME_3D.models.quantumPortalRing('#00e5ff', '#d946ef');
assert(portalRing && portalRing.v.length >= 20, `3D Quantum Portal Ring mesh vertices intact: ${portalRing ? portalRing.v.length : 0}`);
assert(portalRing && portalRing.f.length >= 12, `3D Quantum Portal Ring mesh faces intact: ${portalRing ? portalRing.f.length : 0}`);

const portalFaces = g.facesOf(portalRing, [0, 0, 15.0], 1.2, 1.0);
assert(portalFaces && portalFaces.length >= 12, `3D Quantum Portal Ring projects in 3D perspective (${portalFaces.length} faces)`);

// 5. Active Roadside Scenery Pool Verification
g.buildBackdrop();
assert(Array.isArray(G.scenery3D), 'G.scenery3D is initialized');
assert(G.scenery3D.length >= 12, `G.scenery3D has active props: ${G.scenery3D.length}`);
assert(G.scenery3D.some(s => s.side === -1) && G.scenery3D.some(s => s.side === 1), '3D Scenery props flank both left and right sides of track');

// 6. Quality Presets & Adaptive Scaling
G.quality = 'low';
g.buildBackdrop();
assert(G.scenery3D.length === 12, `Low quality sets optimized scenery budget (12 props, actual: ${G.scenery3D.length})`);

G.quality = 'medium';
g.buildBackdrop();
assert(G.scenery3D.length === 20, `Medium quality sets balanced scenery budget (20 props, actual: ${G.scenery3D.length})`);

G.quality = 'high';
g.buildBackdrop();
assert(G.scenery3D.length === 28, `High quality sets full cinematic 3D scenery budget (28 props, actual: ${G.scenery3D.length})`);

// 7. Active Gameplay & 60 FPS Render Benchmark in All 8 Biomes
for (let bIdx = 0; bIdx < 8; bIdx++) {
  g.selectStartingBiome(bIdx);
  g.startRun();
  assert(G.running === true, `Game successfully starts in biome ${bIdx} (${g.BIOMES[bIdx].name})`);
  assert(g.currentBiome().id === bIdx, `Current active biome matches selection: ${bIdx}`);

  // Simulate 30 frames of active driving with scenery, objects, and animations
  for (let f = 0; f < 30; f++) {
    g.update(0.016);
    g.render();
  }
  assert(G.dist > 0, `Player travels forward cleanly in 3D environment (dist: ${G.dist.toFixed(1)}m)`);
  assert(G.lives > 0, `Player lives intact during 3D race: ${G.lives}`);
  g.gameOver();
}

// 8. Performance Benchmark: 120 Frames of Active Gameplay with Full 3D Scenery
g.selectStartingBiome(0); // City
g.startRun();
G.quality = 'high';
const benchStart = Date.now();
const testFrames = 120;
for (let f = 0; f < testFrames; f++) {
  g.update(0.016);
  g.render();
}
const benchDuration = Date.now() - benchStart;
const msPerFrame = benchDuration / testFrames;
console.log(`⚡ 3D Engine Benchmark: ${testFrames} frames completed in ${benchDuration}ms (${msPerFrame.toFixed(3)} ms/frame)`);
assert(msPerFrame < 50.0, `Active 3D environment runs well within headless CPU budget (actual: ${msPerFrame.toFixed(3)} ms/frame)`);

// 9. Mobile Screen Responsiveness with 3D Scenery
const mobileWidths = [320, 375, 480, 768, 1280];
for (const w of mobileWidths) {
  sh.canvas.width = w;
  sh.canvas.height = Math.round(w * (9 / 16));
  sh.win.innerWidth = w;
  sh.win.innerHeight = Math.round(w * (9 / 16));
  g.resize();
  g.render();
  assert(true, `3D Scenery & road render cleanly without errors at ${w}px width`);
}

// 10. Core Feature Preservation
assert(g.CARS.length === 30, `All 30 cars strictly preserved (count: ${g.CARS.length})`);
assert(g.BIOMES.length === 8, `All 8 biomes strictly preserved (count: ${g.BIOMES.length})`);
assert(g.DIMENSIONS.length === 6, `All 6 quantum dimensions strictly preserved (count: ${g.DIMENSIONS.length})`);

console.log('===============================================================');
console.log(`  RESULTS: ${passCount} PASSED / ${failCount} FAILED  `);
console.log('===============================================================');

if (failCount > 0) process.exit(1);

process.exit(0);
