const sh = require('./shim.js');
const g = sh.sandbox.NY3D;

// Test creating cosmic meshes
console.log('Testing cosmic model construction...');

// We will inspect how game.js builds meshes
const fs = require('fs');
const gameCode = fs.readFileSync('game.js', 'utf8');

console.log('Game code length:', gameCode.length);
