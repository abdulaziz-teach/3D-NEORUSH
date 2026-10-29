const sh = require('./shim.js');
const g = sh.sandbox.NY3D;
const G = g.G;

g.selectStartingBiome(0); // City
g.startRun();
G.quality = 'high';

for (let f = 0; f < 120; f++) {
  g.update(0.016);
  g.render();
  if (f % 20 === 0) {
    console.log(`Frame ${f}:`, {
      dist: G.dist.toFixed(1),
      objs: G.objs.length,
      parts: G.parts.length,
      texts: G.texts.length,
      scenery3D: G.scenery3D.length,
    });
  }
}
process.exit(0);
