const sh = require('./shim.js');
const g = sh.sandbox.NY3D;
const G = g.G;

g.selectStartingBiome(0);
g.startRun();
G.quality = 'high';

for (let chunk = 0; chunk < 4; chunk++) {
  const t0 = Date.now();
  for (let f = 0; f < 30; f++) {
    g.update(0.016);
    g.render();
  }
  const dt = Date.now() - t0;
  console.log(`Chunk ${chunk} (frames ${chunk*30}-${(chunk+1)*30}): ${dt}ms (${(dt/30).toFixed(2)}ms/frame), objs=${G.objs.length}, parts=${G.parts.length}, speed=${G.speed.toFixed(1)}, dist=${G.dist.toFixed(1)}`);
}
process.exit(0);
