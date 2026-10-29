const sh = require('./shim.js');
const g = sh.sandbox.NY3D;
const G = g.G;

g.selectStartingBiome(0);
g.startRun();
G.quality = 'high';

// Test optimizing facesOf
const fs = require('fs');
let code = fs.readFileSync('game.js', 'utf8');

// Measure 120 frames time
let t0 = Date.now();
for (let f = 0; f < 120; f++) {
  g.update(0.016);
  g.render();
}
console.log('Current 120 frames:', Date.now() - t0, 'ms');
process.exit(0);
