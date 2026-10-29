const sh = require('./shim.js');
const g = sh.sandbox.NY3D;
const G = g.G;

// Replicate lines 1-112 of test_stage_8biomes_3d.js
for (const bm of [
  { id: 0, props: 'city', name: 'NEON CITY' },
  { id: 1, props: 'crystal', name: 'CRYSTAL DESERT' },
  { id: 2, props: 'ice', name: 'ICE ORBIT' },
  { id: 3, props: 'lava', name: 'LAVA & MAGMA' },
  { id: 4, props: 'bio', name: 'EMERALD FOREST' },
  { id: 5, props: 'cosmic', name: 'COSMIC ANOMALY' },
  { id: 6, props: 'tech', name: 'UNDERWATER OCEAN' },
  { id: 7, props: 'rift', name: 'MAGIC RIFT WORLD' },
]) {
  const mesh0 = g.BIOME_3D.getMesh(bm.props, 0, '#00e5ff', '#ff2fb9');
  const mesh1 = g.BIOME_3D.getMesh(bm.props, 1, '#00e5ff', '#ff2fb9');
  g.facesOf(mesh0, [8.0, 0, 25.0], 0, 1.0);
}

const portalRing = g.BIOME_3D.models.quantumPortalRing('#00e5ff', '#d946ef');
g.facesOf(portalRing, [0, 0, 15.0], 1.2, 1.0);

g.buildBackdrop();
G.quality = 'low';
g.buildBackdrop();
G.quality = 'medium';
g.buildBackdrop();
G.quality = 'high';
g.buildBackdrop();

for (let bIdx = 0; bIdx < 8; bIdx++) {
  g.selectStartingBiome(bIdx);
  g.startRun();
  for (let f = 0; f < 30; f++) {
    g.update(0.016);
    g.render();
  }
  g.gameOver();
}

// Now replicate line 114:
g.selectStartingBiome(0); // City
g.startRun();
G.quality = 'high';

console.log('Props before benchmark:', {
  scenery3D: G.scenery3D.length,
  objs: G.objs.length,
  parts: G.parts.length,
  speed: G.speed,
  dist: G.dist,
  trackIdx: G.trackIdx
});

let tUpdate = 0;
let tRender = 0;
let frameTimes = [];

for (let f = 0; f < 120; f++) {
  const t0 = Date.now();
  g.update(0.016);
  const t1 = Date.now();
  g.render();
  const t2 = Date.now();
  tUpdate += (t1 - t0);
  tRender += (t2 - t1);
  frameTimes.push(t2 - t0);
}
console.log(`Total 120 frames: update=${tUpdate}ms, render=${tRender}ms (avg=${((tUpdate+tRender)/120).toFixed(2)}ms)`);
console.log(`First 10 frames avg: ${(frameTimes.slice(0, 10).reduce((a,b)=>a+b,0)/10).toFixed(2)}ms`);
console.log(`Last 10 frames avg: ${(frameTimes.slice(110).reduce((a,b)=>a+b,0)/10).toFixed(2)}ms`);
process.exit(0);
