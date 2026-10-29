import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CyberCar3D } from '../components/CyberCar3D';
import { CyberHUD } from '../components/CyberHUD';

export const Shot05Volcano: React.FC = () => {
  const frame = useCurrentFrame();

  // Dynamic low tracking camera with slight road vibration
  const cameraScale = interpolate(frame, [0, 60], [1.03, 1.16], { extrapolateRight: 'clamp' });
  const cameraShake = Math.sin(frame * 1.9) * 1.8;
  const heatFlicker = Math.sin(frame * 2.5) * 0.1 + 0.9;

  // Speedometer
  const speed = interpolate(frame, [0, 60], [298, 324], { extrapolateRight: 'clamp' });

  // Road lines
  const roadDashOffset = (frame * 48) % 120;

  // Rising fiery embers & sparks
  const embers = Array.from({ length: 45 }).map((_, i) => {
    const x = ((i * 53 + frame * 8) % 1920);
    const y = 1080 - ((i * 37 + frame * 28) % 1100);
    const size = 3 + (i % 4) * 2.5;
    const opacity = 0.5 + (i % 3) * 0.25;
    const color = i % 2 === 0 ? '#ff4500' : '#ffaa00';
    return { x, y, size, opacity, color };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0302',
        overflow: 'hidden',
        transform: `scale(${cameraScale}) translateY(${cameraShake}px)`,
      }}
    >
      {/* 1. Volcanic Cavern Sky & Magma Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 30%, #450a0a 0%, #1f0404 50%, #080101 100%)',
        }}
      />

      {/* 2. Jagged Obsidian Cavern & Distant Lava Cascades */}
      <svg
        viewBox="0 0 1920 600"
        style={{
          position: 'absolute',
          top: '8%',
          left: 0,
          width: '100%',
          height: '52%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <linearGradient id="volcanoRockGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c1917" />
            <stop offset="60%" stopColor="#292524" />
            <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="lavaFallGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffedd5" />
            <stop offset="30%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <filter id="lavaGlow">
            <feGaussianBlur stdDeviation="10" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Cavern Arch & Stalactite Silhouettes */}
        <polygon points="0,0 240,0 180,180 320,120 460,220 540,60 720,180 960,110 1140,240 1320,80 1520,200 1680,100 1920,0 1920,0 0,0" fill="#0f0706" />

        {/* Distant Volcanic Crags */}
        <polygon points="0,600 0,280 220,190 380,310 580,150 780,290 960,120 1180,300 1380,140 1580,280 1780,170 1920,270 1920,600" fill="url(#volcanoRockGrad)" />

        {/* Cascading Molten Lava Rivers in the Background */}
        <path d="M 580,150 Q 600,260 620,600" stroke="url(#lavaFallGrad)" strokeWidth="18" fill="none" opacity={0.9 * heatFlicker} filter="url(#lavaGlow)" />
        <path d="M 1380,140 Q 1360,240 1340,600" stroke="url(#lavaFallGrad)" strokeWidth="22" fill="none" opacity={0.9 * heatFlicker} filter="url(#lavaGlow)" />
      </svg>

      {/* 3. Molten Magma Highway & Heat Glow */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '52%',
          background: 'linear-gradient(180deg, #1c0a07 0%, #0c0201 100%)',
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
            background: 'linear-gradient(180deg, rgba(69,10,10,0.95) 0%, rgba(24,4,4,1) 100%)',
            boxShadow: 'inset 0 0 120px rgba(239, 68, 68, 0.6)',
          }}
        >
          {/* Glowing Lava Trenches on Road Flanks */}
          <div
            style={{
              position: 'absolute',
              left: '26%',
              top: 0,
              bottom: 0,
              width: 14,
              background: '#f97316',
              boxShadow: '0 0 35px #ef4444, 0 0 70px #dc2626',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '26%',
              top: 0,
              bottom: 0,
              width: 14,
              background: '#f97316',
              boxShadow: '0 0 35px #ef4444, 0 0 70px #dc2626',
            }}
          />

          {/* Road Surface Texture with Cracked Heat Glow */}
          <div
            style={{
              position: 'absolute',
              inset: '0 28%',
              background: 'linear-gradient(180deg, #180806 0%, #0a0302 100%)',
              borderLeft: '4px solid #f97316',
              borderRight: '4px solid #f97316',
              overflow: 'hidden',
            }}
          >
            {/* Speed Dashes (Animated) */}
            <div
              style={{
                position: 'absolute',
                left: '49.2%',
                top: -120 + roadDashOffset,
                bottom: -120,
                width: 16,
                backgroundImage: 'repeating-linear-gradient(180deg, #ffedd5 0px, #f97316 40px, transparent 40px, transparent 120px)',
                boxShadow: '0 0 25px rgba(249, 115, 22, 0.8)',
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Rising Embers and Heat Spark Particles */}
      {embers.map((p, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size * 1.5,
            borderRadius: '50%',
            backgroundColor: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 12px ${p.color}, 0 0 24px #ff0000`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* 5. 3D Cyber Car - Molten Obsidian Variant */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <CyberCar3D
          primaryColor="#1c1917"
          accentColor="#f97316"
          underglowColor="#ef4444"
          speedKmh={speed}
          nitroActive={false}
          scale={1.22}
          driftAngleDeg={-1.8}
        />
      </div>

      {/* 6. Heat Vignette / Atmosphere Haze */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 60%, rgba(239, 68, 68, 0.15) 0%, rgba(0,0,0,0.65) 100%)',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }}
      />

      {/* 7. Cyber HUD Telemetry */}
      <CyberHUD
        speedKmh={Math.round(speed)}
        rpmRatio={0.88}
        stageName="VOLCANIC CHASM // ЛАВА И МАГМА"
        subText="SURFACE TEMP 1450°C // MAGMA VEIN"
      />
    </AbsoluteFill>
  );
};
