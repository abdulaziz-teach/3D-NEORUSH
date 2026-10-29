const sh = require('./shim.js');
const g = sh.sandbox.NY3D;
const G = g.G;

for (let b = 0; b < 8; b++) {
  // Fresh environment
  const freshSh = require('./shim.js');
  const freshG = freshSh.sandbox.NY3D;
  freshG.selectStartingBiome(b);
  freshG.startRun();
  for (let f = 0; f < 30; f++) {
    freshG.update(0.016);
    freshG.render();
  }
  freshG.gameOver();

  // Now run City benchmark
  freshG.selectStartingBiome(0);
  freshG.startRun();
  freshG.G.quality = 'high';
  const t0 = Date.now();
  for (let f = 0; f < 60; f++) {
    freshG.update(0.016);
    freshG.render();
  }
  const dt = Date.now() - t0;
  console.log(`After biome ${b} (${freshG.BIOMES[b].name}): 60 frames = ${dt}ms (${(dt/60).toFixed(2)} ms/frame)`);
}
process.exit(0);
