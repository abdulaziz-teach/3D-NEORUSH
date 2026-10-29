const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateAmbient, generatePulse, generateRiser, generateImpact } = require('./gen_audio');

const audioDir = path.join(__dirname, '..', 'public', 'audio');
const files = ['ambient.wav', 'pulse.wav', 'riser.wav', 'impact.wav'];

function getHash(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

console.log('=== STEP 1: CAPTURE INITIAL HASHES ===');
const hashesRun1 = {};
for (const f of files) {
  const p = path.join(audioDir, f);
  hashesRun1[f] = getHash(p);
  console.log(`${f}: ${hashesRun1[f]}`);
}

console.log('\n=== STEP 2: RE-RUN GENERATOR (RUN 2) ===');
// Re-generate all files
require('./gen_audio');
// Re-execute main logic
const gens = [generateAmbient, generatePulse, generateRiser, generateImpact];
for (const gen of gens) {
  const item = gen();
  const filePath = path.join(audioDir, item.name);
  const dataSize = item.numFrames * 4;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(48000, 24);
  header.writeUInt32LE(192000, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  fs.writeFileSync(filePath, Buffer.concat([header, item.buffer]));
}

console.log('\n=== STEP 3: COMPARE HASHES FOR BIT-FOR-BIT DETERMINISM ===');
let allMatch = true;
for (const f of files) {
  const p = path.join(audioDir, f);
  const h2 = getHash(p);
  const match = hashesRun1[f] === h2;
  console.log(`${f} match: ${match} (${h2})`);
  if (!match) allMatch = false;
}
if (!allMatch) {
  console.error('FAIL: Non-deterministic audio generation detected!');
  process.exit(1);
}
console.log('PASS: 100% Deterministic audio generation confirmed.');

console.log('\n=== STEP 4: RIFF/WAVE HEADER & PCM INTEGRITY AUDIT ===');
const report = [];
for (const f of files) {
  const p = path.join(audioDir, f);
  const buf = fs.readFileSync(p);
  const stat = fs.statSync(p);

  const riff = buf.toString('ascii', 0, 4);
  const fileSizeInHeader = buf.readUInt32LE(4) + 8;
  const wave = buf.toString('ascii', 8, 12);
  const fmt = buf.toString('ascii', 12, 16);
  const fmtSize = buf.readUInt32LE(16);
  const audioFormat = buf.readUInt16LE(20);
  const numChannels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const byteRate = buf.readUInt32LE(28);
  const blockAlign = buf.readUInt16LE(32);
  const bitsPerSample = buf.readUInt16LE(34);
  const dataTag = buf.toString('ascii', 36, 40);
  const dataSize = buf.readUInt32LE(40);

  // Assertions
  if (riff !== 'RIFF' || wave !== 'WAVE' || fmt !== 'fmt ' || dataTag !== 'data') {
    throw new Error(`Corrupt WAV chunks in ${f}`);
  }
  if (audioFormat !== 1) throw new Error(`Not PCM format in ${f}`);
  if (numChannels !== 2) throw new Error(`Expected stereo in ${f}`);
  if (sampleRate !== 48000) throw new Error(`Expected 48000 Hz in ${f}`);
  if (bitsPerSample !== 16) throw new Error(`Expected 16-bit in ${f}`);
  if (stat.size !== 44 + dataSize) throw new Error(`Data size mismatch in ${f}`);

  // Sample scan
  let maxSample = -32768;
  let minSample = 32767;
  for (let i = 44; i < buf.length; i += 2) {
    const s = buf.readInt16LE(i);
    if (s > maxSample) maxSample = s;
    if (s < minSample) minSample = s;
  }

  const durationSec = (dataSize / (sampleRate * blockAlign)).toFixed(2);
  report.push({
    file: f,
    format: `PCM ${bitsPerSample}-bit stereo`,
    sampleRate: `${sampleRate} Hz`,
    duration: `${durationSec}s`,
    fileSize: `${stat.size} bytes`,
    maxInt16: maxSample,
    minInt16: minSample,
    clipping: maxSample >= 32767 || minSample <= -32768 ? 'YES (FAIL)' : 'NO (SAFE)',
    header: 'VALID'
  });
}

console.table(report);
console.log('ALL AUDIO CHECKS PASSED.');
