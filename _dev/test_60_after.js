const sh = require('./shim.js');
const g = sh.sandbox.NY3D;
const G = g.G;

for (let bIdx = 0; bIdx < 8; bIdx++) {
  g.selectStartingBiome(bIdx);
  g.startRun();
  for (let f = 0; f < 30; f++) {
    g.update(0.016);
    g.render();
  }
  g.gameOver();
}

g.selectStartingBiome(0); // City
g.startRun();
G.quality = 'high';
const benchStart = Date.now();
const testFrames = 60;
for (let f = 0; f < testFrames; f++) {
  g.update(0.016);
  g.render();
}
const benchDuration = Date.now() - benchStart;
const msPerFrame = benchDuration / testFrames;
console.log(`60 frames after 8 biomes: ${benchDuration}ms (${msPerFrame.toFixed(3)} ms/frame)`);
process.exit(0);
