const sh = require('./shim.js');
const g = sh.sandbox.NY3D;
const G = g.G;

// Run 8 biomes loop
for (let bIdx = 0; bIdx < 8; bIdx++) {
  g.selectStartingBiome(bIdx);
  g.startRun();
  for (let f = 0; f < 30; f++) {
    g.update(0.016);
    g.render();
  }
  g.gameOver();
}

console.log('G.stars length:', G.stars.length);
console.log('G.scenery3D length:', G.scenery3D.length);
console.log('G.objs length:', G.objs.length);
console.log('G.parts length:', G.parts.length);
console.log('G.texts length:', G.texts.length);

// What if we reset G.stars or G.mountains or G.buildings?
g.selectStartingBiome(0);
g.startRun();
G.quality = 'high';

console.log('After startRun for City:');
console.log('G.stars length:', G.stars.length);
console.log('G.scenery3D length:', G.scenery3D.length);
console.log('G.buildings length:', G.buildings.length);
console.log('G.mountains length:', G.mountains.length);
console.log('G.sil length:', G.sil.length);

process.exit(0);
