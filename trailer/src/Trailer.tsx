import React from 'react';
import { AbsoluteFill, Series, Sequence, Audio, staticFile, interpolate } from 'remotion';
import { Shot01City } from './shots/Shot01City';
import { Shot02Desert } from './shots/Shot02Desert';
import { Shot03Forest } from './shots/Shot03Forest';
import { Shot04Snow } from './shots/Shot04Snow';
import { Shot05Volcano } from './shots/Shot05Volcano';
import { Shot06Space } from './shots/Shot06Space';
import { Shot07Ocean } from './shots/Shot07Ocean';
import { Shot08Fantasy } from './shots/Shot08Fantasy';
import { Shot09HeroPortal } from './shots/Shot09HeroPortal';

export const Trailer: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#030208',
        fontFamily: "'Orbitron', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* 1. VISUAL TIMELINE — 9 CINEMATIC BIOME SHOTS (EXACTLY 600 FRAMES / 20.00s AT 30 FPS) */}
      <Series>
        {/* SHOT 1: Neon Megapolis / City (0.0s – 3.0s | 90 frames) */}
        <Series.Sequence durationInFrames={90}>
          <Shot01City />
        </Series.Sequence>

        {/* SHOT 2: Amber Sunset Desert / Crystal Dunes (3.0s – 5.0s | 60 frames) */}
        <Series.Sequence durationInFrames={60}>
          <Shot02Desert />
        </Series.Sequence>

        {/* SHOT 3: Emerald Bioluminescent Forest (5.0s – 7.0s | 60 frames) */}
        <Series.Sequence durationInFrames={60}>
          <Shot03Forest />
        </Series.Sequence>

        {/* SHOT 4: Glacial Mountain Snow & Ice Orbit (7.0s – 9.0s | 60 frames) */}
        <Series.Sequence durationInFrames={60}>
          <Shot04Snow />
        </Series.Sequence>

        {/* SHOT 5: Volcanic Magma Chasm (9.0s – 11.0s | 60 frames) */}
        <Series.Sequence durationInFrames={60}>
          <Shot05Volcano />
        </Series.Sequence>

        {/* SHOT 6: Cosmic Nebula Orbit / Zero-G Highway (11.0s – 13.0s | 60 frames) */}
        <Series.Sequence durationInFrames={60}>
          <Shot06Space />
        </Series.Sequence>

        {/* SHOT 7: Abyssal Ocean / Submerged Glass Tunnel (13.0s – 15.0s | 60 frames) */}
        <Series.Sequence durationInFrames={60}>
          <Shot07Ocean />
        </Series.Sequence>

        {/* SHOT 8: Arcane Rift / Fantasy Citadel (15.0s – 17.0s | 60 frames) */}
        <Series.Sequence durationInFrames={60}>
          <Shot08Fantasy />
        </Series.Sequence>

        {/* SHOT 9: Quantum Portal Nitro Leap & NEORUSH Logo Climax (17.0s – 20.0s | 90 frames) */}
        <Series.Sequence durationInFrames={90}>
          <Shot09HeroPortal />
        </Series.Sequence>
      </Series>

      {/* 2. CINEMATIC LETTERBOX BARS (2.35:1 Anamorphic Framing) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          backgroundColor: '#000000',
          zIndex: 80,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 44,
          backgroundColor: '#000000',
          zIndex: 80,
          pointerEvents: 'none',
        }}
      />

      {/* 3. MULTI-LAYER CINEMATIC PROCEDURAL AUDIO ORCHESTRATION (20.00s / 600 FRAMES) */}

      {/* Layer 1: Ambient Futuristic Atmosphere Drone (0s to 20s / frames 0 to 600) */}
      <Sequence from={0} durationInFrames={600}>
        <Audio
          src={staticFile('audio/ambient.wav')}
          volume={(f) =>
            interpolate(f, [0, 25, 575, 600], [0, 0.75, 0.75, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      </Sequence>

      {/* Layer 2: Cybernetic Pulse Rhythm (frame 15 to 540 / 17.5s duration) */}
      <Sequence from={15} durationInFrames={525}>
        <Audio
          src={staticFile('audio/pulse.wav')}
          volume={(f) =>
            interpolate(f, [0, 15, 505, 525], [0, 0.85, 0.85, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      </Sequence>

      {/* Layer 3: Riser Tension Sweep (15.0s / frame 450 to 18.0s / frame 540 | 90 frames) */}
      <Sequence from={450} durationInFrames={90}>
        <Audio
          src={staticFile('audio/riser.wav')}
          volume={(f) =>
            interpolate(f, [0, 15, 80, 90], [0, 0.4, 0.95, 1.0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      </Sequence>

      {/* Layer 4: Impact Shockwave Drop on Logo Reveal (18.0s / frame 540 to 20.0s / frame 600 | 60 frames) */}
      <Sequence from={540} durationInFrames={60}>
        <Audio
          src={staticFile('audio/impact.wav')}
          volume={(f) =>
            interpolate(f, [0, 5, 45, 60], [1.0, 1.0, 0.5, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      </Sequence>
    </AbsoluteFill>
  );
};
