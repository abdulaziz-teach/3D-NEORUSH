# NEORUSH — Procedural Cinematic Audio Stems

This directory contains the four original, mathematically synthesized cinematic audio stems for the NEORUSH 30-second trailer composition.

All stems are generated deterministically via [`trailer/scripts/gen_audio.js`](./scripts/gen_audio.js) using native Node.js built-ins (`fs`, `path`). No third-party sound libraries, downloaded files, or licensed music were used.

---

## 1. Stem Specifications

| File | Duration | Sample Rate | Channels | Bit Depth | Peak Amplitude | File Size | SHA-256 Hash |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`ambient.wav`** | `30.00s` | 48,000 Hz | 2 (Stereo) | 16-bit PCM | -5.6 dBFS (17,285) | 5,760,044 B | `d2ba539936a63cffff5880ef6d804ee2a5233f60a41257d2279eeae100abe2c2` |
| **`pulse.wav`** | `24.00s` | 48,000 Hz | 2 (Stereo) | 16-bit PCM | -7.3 dBFS (14,134) | 4,608,044 B | `ffd6ea8ce9afe7a66a448bc0a68b87b23ea94f6a0eab616a31d8b146314faeab` |
| **`riser.wav`** | `6.00s` | 48,000 Hz | 2 (Stereo) | 16-bit PCM | -4.5 dBFS (19,495) | 1,152,044 B | `2d97138d52285d922d28f102301ce8354ea7d2ca57093f3e058b6a53813076a1` |
| **`impact.wav`** | `3.50s` | 48,000 Hz | 2 (Stereo) | 16-bit PCM | -5.0 dBFS (18,359) | 672,044 B | `86e1ff5288d652a3d7c103d085502393e6b09d7eeadb02c8b927971186e179fa` |

---

## 2. Description of Stems

1. **`ambient.wav` (Dark Atmospheric Cyber Drone)**:
   - **Role**: Layer 1 background atmosphere across the entire 30-second trailer.
   - **Sound Design**: Deep sub-bass drones tuned to 55 Hz (A1) and 82.4 Hz (E2) with subtle stereo detuning (54.7 Hz Left vs 55.3 Hz Right), combined with low-frequency breathing modulators (0.15 Hz / 0.23 Hz) and filtered micro-texture. Starts with a smooth 1.5s cosine fade-in and resolves with a 2.0s fade-out.

2. **`pulse.wav` (135 BPM Cinematic Electro Pulse)**:
   - **Role**: Layer 2 driving rhythmic engine during racing action (starts at 4.0s upon launch, continuing through 28.0s).
   - **Sound Design**: Fast pitch-drop electro kick (105 Hz down to 44 Hz) on quarter-note beats, synced driving 8th-note offbeat sub-bass (55 Hz), and soft 16th-note high-frequency ticks. Restrained, punchy, and non-piercing.

3. **`riser.wav` (Tension Build Sweep)**:
   - **Role**: Layer 3 kinetic transition builder leading into the Quantum Portal crossing (19.0s to 25.0s).
   - **Sound Design**: Exponential frequency sweep climbing from 120 Hz to 880 Hz, layered with a bandpass-filtered noise wind that swells exponentially with pitch, terminating cleanly with a 25ms micro-taper before the portal penetration.

4. **`impact.wav` (Cinematic Sub-Drop & Titanium Latch)**:
   - **Role**: Layer 3 anchor impact triggered on the portal aperture flash and NEORUSH title reveal (25.0s to 28.5s).
   - **Sound Design**: Initial 40ms high-frequency metallic transient, resonant titanium ring (340 Hz & 680 Hz decaying over 400ms), and a heavy 808 sub-bass boom (95 Hz dropping to 32 Hz) with exponential decay.

---

## 3. How to Regenerate & Verify

From the repository root or `trailer/` directory:

```bash
# Generate stems
node trailer/scripts/gen_audio.js

# Audit headers, peak samples, and bit-for-bit determinism
node trailer/scripts/verify_audio.js
```

---

## 4. Known Characteristics & Limitations

- **Synthesized Architecture**: These stems are purely algorithmic (additive synthesis, exponential envelopes, and linear congruential pseudorandom noise). They provide clean, consistent, license-free cinematic cues tailored to the trailer timeline.
- **Mastering Headroom**: All stems are mastered with safe dynamic headroom (peaks between -4.5 dBFS and -7.3 dBFS) using `Math.tanh()` soft saturation so they can be summed together in Remotion without digital clipping.
- **Acoustic Fidelity**: Because they are synthesized mathematically without acoustic studio multi-mic recordings, they have a distinctly synthetic, cyberpunk aesthetic rather than orchestral acoustic instruments.
