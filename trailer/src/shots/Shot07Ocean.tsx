import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CyberCar3D } from '../components/CyberCar3D';
import { CyberHUD } from '../components/CyberHUD';

export const Shot07Ocean: React.FC = () => {
  const frame = useCurrentFrame();

  // Low tracking push with fluid camera glide
  const cameraScale = interpolate(frame, [0, 60], [1.02, 1.15], { extrapolateRight: 'clamp' });
  const cameraSway = Math.sin(frame * 1.4) * 2.2;
  const causticsWave = Math.sin(frame * 2.0) * 0.15 + 0.85;

  // Speedometer
  const speed = interpolate(frame, [0, 60], [338, 365], { extrapolateRight: 'clamp' });

  // Road lines
  const roadDashOffset = (frame * 54) % 120;

  // Rising oxygen bubbles & bioluminescent plankton
  const bubbles = Array.from({ length: 42 }).map((_, i) => {
    const x = ((i * 49 + Math.sin(frame * 0.1 + i) * 25) % 1920);
    const y = 1080 - ((i * 33 + frame * 32) % 1120);
    const size = 3 + (i % 4) * 3.5;
    const opacity = 0.4 + (i % 3) * 0.25;
    return { x, y, size, opacity };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#02181d',
        overflow: 'hidden',
        transform: `scale(${cameraScale}) translateY(${cameraSway}px)`,
      }}
    >
      {/* 1. Deep Ocean Abyss Gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 25%, #083344 0%, #032029 50%, #010d12 100%)',
        }}
      />

      {/* 2. Submerged Aquatic Spires & Glass Hydro-Tunnel Arches */}
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
          <linearGradient id="oceanSpireGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.7" />
            <stop offset="40%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#042f2e" />
          </linearGradient>
          <filter id="waterGlow">
            <feGaussianBlur stdDeviation="12" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Bioluminescent Deep-Sea Pillars */}
        <polygon points="180,600 240,180 270,180 320,600" fill="url(#oceanSpireGrad)" opacity="0.65" />
        <polygon points="450,600 480,260 510,260 540,600" fill="url(#oceanSpireGrad)" opacity="0.45" />
        <polygon points="1420,600 1450,240 1480,240 1520,600" fill="url(#oceanSpireGrad)" opacity="0.5" />
        <polygon points="1660,600 1710,160 1740,160 1790,600" fill="url(#oceanSpireGrad)" opacity="0.7" />

        {/* Hydro-Tunnel Luminous Rings */}
        <ellipse cx="960" cy="380" rx="650" ry="240" fill="none" stroke="#14b8a6" strokeWidth="4" opacity={0.35 * causticsWave} />
        <ellipse cx="960" cy="380" rx="420" ry="160" fill="none" stroke="#2dd4bf" strokeWidth="6" opacity={0.5 * causticsWave} filter="url(#waterGlow)" />
        <ellipse cx="960" cy="380" rx="200" ry="80" fill="none" stroke="#5eead4" strokeWidth="8" opacity={0.65 * causticsWave} filter="url(#waterGlow)" />
      </svg>

      {/* 3. Submerged Glass Highway & Water Caustics */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '52%',
          background: 'linear-gradient(180deg, #042f2e 0%, #011417 100%)',
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
            background: 'linear-gradient(180deg, rgba(13,148,136,0.92) 0%, rgba(2,32,41,1) 100%)',
            boxShadow: 'inset 0 0 110px rgba(45, 212, 191, 0.55)',
          }}
        >
          {/* Bioluminescent Hydro Curbs */}
          <div
            style={{
              position: 'absolute',
              left: '27%',
              top: 0,
              bottom: 0,
              width: 12,
              background: '#2dd4bf',
              boxShadow: '0 0 35px #14b8a6, 0 0 70px #0d9488',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '27%',
              top: 0,
              bottom: 0,
              width: 12,
              background: '#2dd4bf',
              boxShadow: '0 0 35px #14b8a6, 0 0 70px #0d9488',
            }}
          />

          {/* Road Surface */}
          <div
            style={{
              position: 'absolute',
              inset: '0 28%',
              background: 'linear-gradient(180deg, #022026 0%, #010d10 100%)',
              borderLeft: '4px solid #14b8a6',
              borderRight: '4px solid #14b8a6',
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
                backgroundImage: 'repeating-linear-gradient(180deg, #99f6e4 0px, #14b8a6 40px, transparent 40px, transparent 120px)',
                boxShadow: '0 0 25px rgba(45, 212, 191, 0.9)',
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Rising Oxygen Bubbles */}
      {bubbles.map((b, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: b.x,
            top: b.y,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: '1.5px solid rgba(153, 246, 228, 0.85)',
            boxShadow: '0 0 8px rgba(45, 212, 191, 0.8), inset 0 0 4px rgba(255,255,255,0.6)',
            opacity: b.opacity,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* 5. 3D Cyber Car - Aquamarine Hydro Variant */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <CyberCar3D
          primaryColor="#042f2e"
          accentColor="#14b8a6"
          underglowColor="#2dd4bf"
          speedKmh={speed}
          nitroActive={false}
          scale={1.22}
          driftAngleDeg={-1.2}
        />
      </div>

      {/* 6. Underwater Depth Vignette & Light Refraction */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(20,184,166,0.1) 0%, rgba(2,24,29,0.7) 100%)',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }}
      />

      {/* 7. Cyber HUD Telemetry */}
      <CyberHUD
        speedKmh={Math.round(speed)}
        rpmRatio={0.93}
        stageName="ABYSSAL OCEAN // ПОДВОДНЫЙ ОКЕАН"
        subText="DEPTH 4,200M // PRESSURIZED HYDRO CHASSIS"
      />
    </AbsoluteFill>
  );
};
