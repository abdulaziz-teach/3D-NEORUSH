import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CyberCar3D } from '../components/CyberCar3D';
import { CyberHUD } from '../components/CyberHUD';

export const Shot08Fantasy: React.FC = () => {
  const frame = useCurrentFrame();

  // Low tracking push with accelerating intensity
  const cameraScale = interpolate(frame, [0, 60], [1.02, 1.18], { extrapolateRight: 'clamp' });
  const cameraShake = Math.sin(frame * 2.1) * (1.2 + frame * 0.02);

  // Speedometer surges as car prepares for quantum leap
  const speed = interpolate(frame, [0, 60], [362, 396], { extrapolateRight: 'clamp' });

  // Road lines
  const roadDashOffset = (frame * 58) % 120;

  // Arcane magical stardust particles
  const arcaneParticles = Array.from({ length: 48 }).map((_, i) => {
    const x = ((i * 47 + frame * 16) % 1920);
    const y = ((i * 61 + Math.sin(frame * 0.15 + i) * 35) % 1080);
    const size = 3 + (i % 4) * 2.5;
    const opacity = 0.45 + (i % 3) * 0.25;
    const color = i % 2 === 0 ? '#f472b6' : '#c084fc';
    return { x, y, size, opacity, color };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#11031d',
        overflow: 'hidden',
        transform: `scale(${cameraScale}) translateY(${cameraShake}px)`,
      }}
    >
      {/* 1. Arcane Twilight Gradient Sky */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 30%, #581c87 0%, #2e0854 50%, #0a0117 100%)',
        }}
      />

      {/* 2. Floating Mythical Islands & Arcane Crystal Citadels */}
      <svg
        viewBox="0 0 1920 600"
        style={{
          position: 'absolute',
          top: '6%',
          left: 0,
          width: '100%',
          height: '54%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <linearGradient id="arcaneIslandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7e22ce" />
            <stop offset="50%" stopColor="#3b0764" />
            <stop offset="100%" stopColor="#1e0538" />
          </linearGradient>
          <linearGradient id="crystalGlowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f472b6" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
          <filter id="arcaneGlow">
            <feGaussianBlur stdDeviation="10" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Floating Landmass 1 (Left) */}
        <polygon points="120,240 320,210 440,260 380,360 260,390 140,320" fill="url(#arcaneIslandGrad)" opacity="0.85" />
        {/* Crystal Spires on Island 1 */}
        <polygon points="260,210 275,80 290,210" fill="url(#crystalGlowGrad)" filter="url(#arcaneGlow)" />
        <polygon points="220,220 230,120 240,220" fill="url(#crystalGlowGrad)" opacity="0.8" />

        {/* Floating Landmass 2 (Right) */}
        <polygon points="1460,200 1720,180 1840,250 1780,350 1620,380 1480,290" fill="url(#arcaneIslandGrad)" opacity="0.85" />
        {/* Crystal Spires on Island 2 */}
        <polygon points="1640,180 1660,60 1680,180" fill="url(#crystalGlowGrad)" filter="url(#arcaneGlow)" />
        <polygon points="1710,190 1720,110 1735,190" fill="url(#crystalGlowGrad)" opacity="0.8" />

        {/* Distant Citadel Silhouette in Center */}
        <polygon points="860,350 880,160 900,350 940,120 960,350 1020,140 1040,350" fill="#2e0854" opacity="0.6" />
      </svg>

      {/* 3. Arcane Bridge Highway */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '52%',
          background: 'linear-gradient(180deg, #2e0854 0%, #0a0117 100%)',
          perspective: 480,
          perspectiveOrigin: '50% 15%',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '-30% -40%',
            transform: 'rotateX(72deg)',
            transformOrigin: '50% 100%',
            background: 'linear-gradient(180deg, rgba(126,34,206,0.92) 0%, rgba(20,3,40,1) 100%)',
            boxShadow: 'inset 0 0 110px rgba(244, 114, 182, 0.55)',
          }}
        >
          {/* Glowing Arcane Curbs */}
          <div
            style={{
              position: 'absolute',
              left: '27%',
              top: 0,
              bottom: 0,
              width: 12,
              background: '#f43f5e',
              boxShadow: '0 0 35px #ec4899, 0 0 70px #d946ef',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '27%',
              top: 0,
              bottom: 0,
              width: 12,
              background: '#f43f5e',
              boxShadow: '0 0 35px #ec4899, 0 0 70px #d946ef',
            }}
          />

          {/* Road Surface */}
          <div
            style={{
              position: 'absolute',
              inset: '0 28%',
              background: 'linear-gradient(180deg, #180326 0%, #08000f 100%)',
              borderLeft: '4px solid #d946ef',
              borderRight: '4px solid #d946ef',
              overflow: 'hidden',
            }}
          >
            {/* Speed Centerline */}
            <div
              style={{
                position: 'absolute',
                left: '49.2%',
                top: -120 + roadDashOffset,
                bottom: -120,
                width: 16,
                backgroundImage: 'repeating-linear-gradient(180deg, #fbcfe8 0px, #ec4899 40px, transparent 40px, transparent 120px)',
                boxShadow: '0 0 25px rgba(244, 63, 94, 0.9)',
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Swirling Arcane Particles */}
      {arcaneParticles.map((p, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: p.color,
            boxShadow: `0 0 12px ${p.color}, 0 0 24px #a855f7`,
            opacity: p.opacity,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* 5. 3D Cyber Car - Amethyst Mythic Variant */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <CyberCar3D
          primaryColor="#3b0764"
          accentColor="#ec4899"
          underglowColor="#f43f5e"
          speedKmh={speed}
          nitroActive={frame > 35}
          scale={1.22}
          driftAngleDeg={1.8}
        />
      </div>

      {/* 6. Arcane Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(217,70,239,0.1) 0%, rgba(10,1,23,0.7) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 7. Cyber HUD Telemetry */}
      <CyberHUD
        speedKmh={Math.round(speed)}
        rpmRatio={0.97}
        stageName="ARCANE RIFT // МАГИЧЕСКИЙ МИР"
        subText={frame > 25 ? 'WARP GATE LOCKING IN...' : 'ARCANE FIELD ACTIVE'}
        showWarning={frame > 25}
        warningText="QUANTUM PORTAL DETECTED // OVERDRIVE READY"
      />
    </AbsoluteFill>
  );
};
