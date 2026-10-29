import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CyberCar3D } from '../components/CyberCar3D';
import { CyberHUD } from '../components/CyberHUD';

export const Shot06Space: React.FC = () => {
  const frame = useCurrentFrame();

  // Dynamic orbital camera drift & banking
  const cameraScale = interpolate(frame, [0, 60], [1.02, 1.15], { extrapolateRight: 'clamp' });
  const cameraRoll = interpolate(frame, [0, 60], [-1.2, 1.6], { extrapolateRight: 'clamp' });
  const cameraShake = Math.sin(frame * 1.6) * 1.0;

  // Speedometer
  const speed = interpolate(frame, [0, 60], [320, 348], { extrapolateRight: 'clamp' });

  // Floating highway track offset
  const trackOffset = (frame * 52) % 120;

  // Starfield & Cosmic Dust
  const stars = Array.from({ length: 65 }).map((_, i) => {
    const x = ((i * 31 + frame * (10 + (i % 4) * 8)) % 1920);
    const y = ((i * 47) % 1080);
    const size = 1.5 + (i % 3) * 1.8;
    const opacity = 0.35 + (i % 4) * 0.2;
    const isCyan = i % 3 === 0;
    return { x, y, size, opacity, color: isCyan ? '#67e8f9' : '#ffffff' };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#02010a',
        overflow: 'hidden',
        transform: `scale(${cameraScale}) rotate(${cameraRoll}deg) translateY(${cameraShake}px)`,
      }}
    >
      {/* 1. Deep Space Nebula Sky */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 70% 30%, #3b0764 0%, #1e1b4b 40%, #030014 90%)',
        }}
      />

      {/* 2. Celestial Ringed Planet & Cosmic Void Backdrop */}
      <svg
        viewBox="0 0 1920 1080"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          {/* Planet Gradient */}
          <radialGradient id="gasPlanetGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="35%" stopColor="#7c3aed" />
            <stop offset="70%" stopColor="#4c1d95" />
            <stop offset="100%" stopColor="#0f0728" />
          </radialGradient>
          {/* Planetary Ring Gradient */}
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="30%" stopColor="#c084fc" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
          </linearGradient>
          {/* Nebula Glow */}
          <radialGradient id="nebulaGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Nebula Cloud */}
        <circle cx="1400" cy="360" r="450" fill="url(#nebulaGlow)" />
        <circle cx="480" cy="220" r="320" fill="url(#nebulaGlow)" opacity="0.6" />

        {/* Giant Ringed Planet in Background */}
        <g transform="translate(1320, 240) rotate(-22)">
          {/* Back portion of ring */}
          <ellipse cx="0" cy="0" rx="340" ry="60" fill="none" stroke="url(#ringGrad)" strokeWidth="32" opacity="0.5" />
          {/* Planet Sphere */}
          <circle cx="0" cy="0" r="140" fill="url(#gasPlanetGrad)" />
          {/* Atmospheric Rim Light */}
          <circle cx="0" cy="0" r="141" fill="none" stroke="#e879f9" strokeWidth="3" opacity="0.75" />
          {/* Front portion of ring with cutout */}
          <path
            d="M -340,0 A 340 60 0 0 0 340,0"
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="32"
            opacity="0.95"
          />
        </g>
      </svg>

      {/* 3. Starfield & Cosmic Dust Particles */}
      {stars.map((s, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            backgroundColor: s.color,
            opacity: s.opacity,
            boxShadow: `0 0 8px ${s.color}`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* 4. Anti-Gravity Luminescent Track Suspended in Space */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '52%',
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
            background: 'linear-gradient(180deg, rgba(88,28,135,0.7) 0%, rgba(15,23,42,0.95) 100%)',
            boxShadow: 'inset 0 0 100px rgba(168, 85, 247, 0.5)',
          }}
        >
          {/* Neon Floating Rails */}
          <div
            style={{
              position: 'absolute',
              left: '26%',
              top: 0,
              bottom: 0,
              width: 12,
              background: '#06b6d4',
              boxShadow: '0 0 35px #06b6d4, 0 0 70px #3b82f6',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '26%',
              top: 0,
              bottom: 0,
              width: 12,
              background: '#c084fc',
              boxShadow: '0 0 35px #c084fc, 0 0 70px #9333ea',
            }}
          />

          {/* Translucent Energy Roadbed */}
          <div
            style={{
              position: 'absolute',
              inset: '0 28%',
              background: 'linear-gradient(180deg, rgba(30,27,75,0.85) 0%, rgba(3,0,20,0.95) 100%)',
              borderLeft: '2px solid rgba(6,182,212,0.6)',
              borderRight: '2px solid rgba(192,132,252,0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Holographic Speed Lattice */}
            <div
              style={{
                position: 'absolute',
                left: '49.2%',
                top: -120 + trackOffset,
                bottom: -120,
                width: 16,
                backgroundImage: 'repeating-linear-gradient(180deg, #67e8f9 0px, #06b6d4 35px, transparent 35px, transparent 120px)',
                boxShadow: '0 0 25px rgba(6, 182, 212, 0.9)',
              }}
            />
          </div>
        </div>
      </div>

      {/* 5. 3D Cyber Car - Cosmic Indigo / Cyan Variant */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <CyberCar3D
          primaryColor="#1e1b4b"
          accentColor="#06b6d4"
          underglowColor="#c084fc"
          speedKmh={speed}
          nitroActive={false}
          scale={1.22}
          driftAngleDeg={1.5}
        />
      </div>

      {/* 6. Cosmic Ambient Glow & Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(2,1,10,0.8) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 7. Cyber HUD Telemetry */}
      <CyberHUD
        speedKmh={Math.round(speed)}
        rpmRatio={0.91}
        stageName="COSMIC ORBIT // КОСМИЧЕСКАЯ АНОМАЛИЯ"
        subText="ZERO-G ORBIT // HYPER VELOCITY"
      />
    </AbsoluteFill>
  );
};
