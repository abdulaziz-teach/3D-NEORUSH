const fs = require('fs');
const lines = fs.readFileSync('game.js', 'utf8').split('\n');
console.log('Total lines:', lines.length);

lines.forEach((l, idx) => {
  const line = l.trim();
  if (line.includes("'cosmic'") || line.includes('"cosmic"') || line.includes('spaceMonolith') || line.includes('spaceAsteroid') || line.includes('КОСМИЧЕСКАЯ АНОМАЛИЯ') || line.includes('spaceTunnelArch')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
