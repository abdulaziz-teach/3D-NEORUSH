/**
 * NEORUSH — Deterministic Procedural Cinematic Audio Generator
 * Generates 4 original 48,000 Hz, 16-bit PCM Stereo WAV stems for the cinematic trailer.
 * Pure Node.js built-ins only (fs, path). 100% deterministic, zero external dependencies.
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 48000;
const NUM_CHANNELS = 2; // Stereo
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const BLOCK_ALIGN = NUM_CHANNELS * BYTES_PER_SAMPLE;
const BYTE_RATE = SAMPLE_RATE * BLOCK_ALIGN;

// Deterministic PRNG (Linear Congruential Generator) for reproducible texture/noise
let _seed = 42;
function resetSeed(s = 42) {
  _seed = s >>> 0;
}
function lcgRandom() {
  _seed = (1664525 * _seed + 1013904223) >>> 0;
  return (_seed / 4294967296) * 2 - 1; // Range [-1.0, 1.0]
}

/**
 * Builds a valid 44-byte RIFF/WAVE header buffer
 */
function createWavHeader(numFrames) {
  const dataSize = numFrames * BLOCK_ALIGN;
  const buffer = Buffer.alloc(44);

  // RIFF Chunk Descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // "fmt " Sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  buffer.writeUInt16LE(1, 20);  // AudioFormat 1 = PCM
  buffer.writeUInt16LE(NUM_CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(BYTE_RATE, 28);
  buffer.writeUInt16LE(BLOCK_ALIGN, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);

  // "data" Sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

/**
 * Clamps float sample in [-1.0, 1.0] to signed 16-bit int [-32767, 32767]
 */
function floatTo16BitPcm(val) {
  const clamped = Math.max(-1, Math.min(1, val));
  return clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
}

/**
 * Soft saturation curve to tame harsh peaks smoothly
 */
function softClip(x) {
  return Math.tanh(x);
}

/**
 * 1. AMBIENT: Dark futuristic atmospheric drone (30.0 seconds)
 * Deep sub fundamental (55 Hz A1), fifth (82.4 Hz E2), slow stereo chorusing,
 * low-frequency breathing filter envelope.
 */
function generateAmbient(durationSec = 20.0) {
  resetSeed(101);
  const numFrames = Math.round(durationSec * SAMPLE_RATE);
  const buffer = Buffer.alloc(numFrames * BLOCK_ALIGN);

  let peakL = 0;
  let peakR = 0;

  for (let i = 0; i < numFrames; i++) {
    const t = i / SAMPLE_RATE;

    // Fade-in (1.5s) and Fade-out (2.0s) envelope
    let env = 1.0;
    if (t < 1.5) {
      env = 0.5 * (1 - Math.cos((Math.PI * t) / 1.5));
    } else if (t > durationSec - 2.0) {
      const rem = durationSec - t;
      env = 0.5 * (1 - Math.cos((Math.PI * rem) / 2.0));
    }

    // Slow atmospheric breathing modulation (0.15 Hz and 0.23 Hz)
    const lfo1 = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.15 * t);
    const lfo2 = 0.70 + 0.30 * Math.sin(2 * Math.PI * 0.23 * t + 1.2);

    // Fundamental tones: 55Hz (A1) + detuned 55.3Hz, plus E2 (82.4Hz)
    const subA = Math.sin(2 * Math.PI * 55.0 * t);
    const subAdetuneL = Math.sin(2 * Math.PI * 54.7 * t);
    const subAdetuneR = Math.sin(2 * Math.PI * 55.3 * t);
    const fifth = Math.sin(2 * Math.PI * 82.4 * t);
    const octave = Math.sin(2 * Math.PI * 110.0 * t) * 0.4;

    // Shimmering micro-texture (filtered deterministic noise)
    const texture = lcgRandom() * 0.04 * lfo1;

    // Combine left and right with subtle spatial width
    let sampleL = (subA * 0.45 + subAdetuneL * 0.35 + fifth * 0.25 + octave * 0.15 + texture) * env * lfo1 * 0.55;
    let sampleR = (subA * 0.45 + subAdetuneR * 0.35 + fifth * 0.25 + octave * 0.15 - texture) * env * lfo2 * 0.55;

    sampleL = softClip(sampleL);
    sampleR = softClip(sampleR);

    peakL = Math.max(peakL, Math.abs(sampleL));
    peakR = Math.max(peakR, Math.abs(sampleR));

    buffer.writeInt16LE(floatTo16BitPcm(sampleL), i * BLOCK_ALIGN);
    buffer.writeInt16LE(floatTo16BitPcm(sampleR), i * BLOCK_ALIGN + 2);
  }

  return { name: 'ambient.wav', buffer, numFrames, durationSec, peakL, peakR };
}

/**
 * 2. PULSE: Restrained electronic rhythmic pulse (24.0 seconds)
 * 135 BPM cinematic electro pulse (beat every ~0.444s).
 * Low electro kick/bass thump with pitch drop + filtered rhythmic hi-hat accent.
 */
function generatePulse(durationSec = 17.5) {
  resetSeed(202);
  const numFrames = Math.round(durationSec * SAMPLE_RATE);
  const buffer = Buffer.alloc(numFrames * BLOCK_ALIGN);

  const bpm = 135;
  const beatDuration = 60 / bpm; // ~0.4444s
  const sixteenth = beatDuration / 4; // ~0.1111s

  let peakL = 0;
  let peakR = 0;

  for (let i = 0; i < numFrames; i++) {
    const t = i / SAMPLE_RATE;

    // Global envelope: smooth 1.0s fade-in, 1.5s fade-out
    let globalEnv = 1.0;
    if (t < 1.0) {
      globalEnv = 0.5 * (1 - Math.cos((Math.PI * t) / 1.0));
    } else if (t > durationSec - 1.5) {
      const rem = durationSec - t;
      globalEnv = 0.5 * (1 - Math.cos((Math.PI * rem) / 1.5));
    }

    // Time inside current beat
    const beatTime = t % beatDuration;
    // Time inside current 16th note
    const subBeatTime = t % sixteenth;

    // 1. Kick/Pulse Bass: Thump pitch drops from 105Hz down to 44Hz over 140ms
    let kick = 0;
    if (beatTime < 0.28) {
      const kickEnv = Math.exp(-beatTime * 14.0);
      const freq = 44 + 61 * Math.exp(-beatTime * 35.0);
      const phase = 2 * Math.PI * freq * beatTime;
      kick = (Math.sin(phase) + 0.3 * Math.sin(phase * 2)) * kickEnv;
    }

    // 2. Electro Sub-Bass Note (driving 8th-note offbeat syncopation)
    const offbeatTime = (t - beatDuration * 0.5) % beatDuration;
    let bass = 0;
    if (offbeatTime >= 0 && offbeatTime < 0.22) {
      const bassEnv = Math.exp(-offbeatTime * 12.0);
      bass = Math.sin(2 * Math.PI * 55.0 * t) * bassEnv * 0.65;
    }

    // 3. Subtle tick/hat on 16th notes
    let hat = 0;
    if (subBeatTime < 0.035) {
      const hatEnv = Math.exp(-subBeatTime * 140.0);
      hat = lcgRandom() * hatEnv * 0.12;
    }

    let sampleL = (kick * 0.60 + bass * 0.40 + hat * 0.15) * globalEnv * 0.68;
    let sampleR = (kick * 0.60 + bass * 0.40 - hat * 0.15) * globalEnv * 0.68;

    sampleL = softClip(sampleL);
    sampleR = softClip(sampleR);

    peakL = Math.max(peakL, Math.abs(sampleL));
    peakR = Math.max(peakR, Math.abs(sampleR));

    buffer.writeInt16LE(floatTo16BitPcm(sampleL), i * BLOCK_ALIGN);
    buffer.writeInt16LE(floatTo16BitPcm(sampleR), i * BLOCK_ALIGN + 2);
  }

  return { name: 'pulse.wav', buffer, numFrames, durationSec, peakL, peakR };
}

/**
 * 3. RISER: Gradual tension build for transitions (6.0 seconds)
 * Exponential frequency sweep (120 Hz to 880 Hz) + filtered rising noise wind,
 * smooth exponential swell, sharp cut at 6.0s.
 */
function generateRiser(durationSec = 3.0) {
  resetSeed(303);
  const numFrames = Math.round(durationSec * SAMPLE_RATE);
  const buffer = Buffer.alloc(numFrames * BLOCK_ALIGN);

  let peakL = 0;
  let peakR = 0;
  let phaseL = 0;
  let phaseR = 0;

  for (let i = 0; i < numFrames; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / durationSec; // 0.0 to 1.0

    // Exponential volume swell: slow start, massive surge in final 2 seconds
    const swell = Math.pow(progress, 2.4);

    // Fade-in over initial 0.3s to prevent entrance pop
    const inTaper = Math.min(1.0, t / 0.3);
    // Smooth micro-taper in final 25ms to prevent exit click
    const outTaper = Math.min(1.0, (durationSec - t) / 0.025);

    // Exponential pitch curve: 120Hz up to 880Hz
    const freq = 120 * Math.pow(880 / 120, progress);

    phaseL += (2 * Math.PI * freq) / SAMPLE_RATE;
    phaseR += (2 * Math.PI * (freq * 1.004)) / SAMPLE_RATE; // slight stereo spread

    const toneL = (Math.sin(phaseL) + 0.35 * Math.sin(phaseL * 2) + 0.15 * Math.sin(phaseL * 3)) * 0.55;
    const toneR = (Math.sin(phaseR) + 0.35 * Math.sin(phaseR * 2) + 0.15 * Math.sin(phaseR * 3)) * 0.55;

    // Filtered aerodynamic noise whoosh swelling with pitch
    const noise = lcgRandom() * 0.35 * progress;

    let sampleL = (toneL + noise) * swell * inTaper * outTaper * 0.70;
    let sampleR = (toneR - noise) * swell * inTaper * outTaper * 0.70;

    sampleL = softClip(sampleL);
    sampleR = softClip(sampleR);

    peakL = Math.max(peakL, Math.abs(sampleL));
    peakR = Math.max(peakR, Math.abs(sampleR));

    buffer.writeInt16LE(floatTo16BitPcm(sampleL), i * BLOCK_ALIGN);
    buffer.writeInt16LE(floatTo16BitPcm(sampleR), i * BLOCK_ALIGN + 2);
  }

  return { name: 'riser.wav', buffer, numFrames, durationSec, peakL, peakR };
}

/**
 * 4. IMPACT: Short, cinematic synthetic impact for title reveal (3.5 seconds)
 * 808 sub-drop (95Hz down to 32Hz) + metallic titanium click transient decaying into sub rumble.
 */
function generateImpact(durationSec = 3.5) {
  resetSeed(404);
  const numFrames = Math.round(durationSec * SAMPLE_RATE);
  const buffer = Buffer.alloc(numFrames * BLOCK_ALIGN);

  let peakL = 0;
  let peakR = 0;

  for (let i = 0; i < numFrames; i++) {
    const t = i / SAMPLE_RATE;

    // 1. Initial High-Frequency Metallic Transient (first 40ms)
    let click = 0;
    if (t < 0.04) {
      const clickEnv = Math.exp(-t * 160.0);
      click = lcgRandom() * clickEnv * 0.5;
    }

    // 2. Resonant Titanium Ring (340 Hz and 680 Hz decaying over 400ms)
    let ring = 0;
    if (t < 0.6) {
      const ringEnv = Math.exp(-t * 9.0);
      ring = (Math.sin(2 * Math.PI * 340 * t) + 0.5 * Math.sin(2 * Math.PI * 680 * t)) * ringEnv * 0.35;
    }

    // 3. Heavy Sub-Bass Boom: 95 Hz drops to 32 Hz over 1.8s
    const subEnv = Math.exp(-t * 1.8);
    const subFreq = 32 + 63 * Math.exp(-t * 4.5);
    const subPhase = 2 * Math.PI * subFreq * t;
    const sub = (Math.sin(subPhase) + 0.35 * Math.sin(subPhase * 0.5)) * subEnv * 0.75;

    // Smooth overall tail fade-out
    const tailTaper = Math.min(1.0, (durationSec - t) / 0.1);

    let sampleL = (click * 0.4 + ring * 0.3 + sub * 0.65) * tailTaper * 0.75;
    let sampleR = (click * 0.4 - ring * 0.3 + sub * 0.65) * tailTaper * 0.75;

    sampleL = softClip(sampleL);
    sampleR = softClip(sampleR);

    peakL = Math.max(peakL, Math.abs(sampleL));
    peakR = Math.max(peakR, Math.abs(sampleR));

    buffer.writeInt16LE(floatTo16BitPcm(sampleL), i * BLOCK_ALIGN);
    buffer.writeInt16LE(floatTo16BitPcm(sampleR), i * BLOCK_ALIGN + 2);
  }

  return { name: 'impact.wav', buffer, numFrames, durationSec, peakL, peakR };
}

/**
 * Main execution runner
 */
function main() {
  const outputDir = path.join(__dirname, '..', 'public', 'audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('--- NEORUSH PROCEDURAL CINEMATIC AUDIO GENERATOR ---');
  console.log(`Format: 48,000 Hz | 16-bit PCM | Stereo (2 channels)`);
  console.log(`Output Directory: ${outputDir}\n`);

  const generators = [generateAmbient, generatePulse, generateRiser, generateImpact];
  const results = [];

  for (const gen of generators) {
    const item = gen();
    const filePath = path.join(outputDir, item.name);
    const header = createWavHeader(item.numFrames);

    // Combine 44-byte header and PCM data
    const fullBuffer = Buffer.concat([header, item.buffer]);
    fs.writeFileSync(filePath, fullBuffer);

    const stats = fs.statSync(filePath);
    const peakDbL = (20 * Math.log10(Math.max(1e-5, item.peakL))).toFixed(1);
    const peakDbR = (20 * Math.log10(Math.max(1e-5, item.peakR))).toFixed(1);

    results.push({
      file: item.name,
      duration: `${item.durationSec.toFixed(1)}s`,
      frames: item.numFrames,
      bytes: stats.size,
      peak: `L: ${peakDbL} dBFS, R: ${peakDbR} dBFS`,
    });
  }

  console.table(results);
  console.log('✓ All 4 WAV stems generated successfully.');
}

if (require.main === module) {
  main();
}

module.exports = { generateAmbient, generatePulse, generateRiser, generateImpact };
