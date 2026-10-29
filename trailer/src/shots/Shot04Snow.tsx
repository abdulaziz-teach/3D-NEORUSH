import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CyberCar3D } from '../components/CyberCar3D';
import { CyberHUD } from '../components/CyberHUD';

export const Shot04Snow: React.FC = () => {
  const frame = useCurrentFrame();

  // Dynamic low-angle tracking push
  const cameraScale = interpolate(frame, [0, 60], [1.02, 1.15], { extrapolateRight: 'clamp' });
  const cameraShake = Math.sin(frame * 1.7) * 1.5;

  // Speedometer
  const speed = interpolate(frame, [0, 60], [275, 295], { extrapolateRight: 'clamp' });

  // Road lines
  const roadDashOffset = (frame * 44) % 120;

  // Fast diagonal blizzard snow particles
  const snowFlakes = Array.from({ length: 48 }).map((_, i) => {
    const x = ((i * 43 + frame * 38) % 1920);
    const y = ((i * 59 + frame * 48) % 1080);
    const size = 3 + (i % 4) * 3;
    const opacity = 0.45 + (i % 3) * 0.25;
    return { x, y, size, opacity };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#030814',
        overflow: 'hidden',
        transform: `scale(${cameraScale}) translateY(${cameraShake}px)`,
      }}
    >
      {/* 1. Deep Glacial Twilight Sky */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 20%, #0c2d48 0%, #041426 50%, #01060f 100%)',
        }}
      />

      {/* 2. Dramatic Icy Mountain Peaks Silhouette */}
      <svg
        viewBox="0 0 1920 600"
        style={{
          position: 'absolute',
          top: '10%',
          left: 0,
          width: '100%',
          height: '50%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <linearGradient id="icePeakGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="40%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#082f49" />
          </linearGradient>
        </defs>
        {/* Jagged Mountain Ridge */}
        <polygon points="0,600 0,260 160,180 320,320 480,140 680,280 840,110 1020,290 1200,90 1380,270 1560,130 1740,290 1920,180 1920,600" fill="url(#icePeakGrad)" />
        {/* Crystalline Glacier Pillars */}
        <polygon points="120,600 160,200 240,200 280,600" fill="#0284c7" opacity="0.6" />
        <polygon points="1640,600 1680,180 1760,180 1800,600" fill="#0284c7" opacity="0.6" />
      </svg>

      {/* 3. Crystalline Ice Highway & Frost Reflections */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '52%',
          background: 'linear-gradient(180deg, #082f49 0%, #021324 100%)',
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
            background: 'linear-gradient(180deg, rgba(14,116,144,0.92) 0%, rgba(3,25,48,1) 100%)',
            boxShadow: 'inset 0 0 100px rgba(56, 189, 248, 0.45)',
          }}
        >
          {/* Icy Curbs */}
          <div
            style={{
              position: 'absolute',
              left: '28%',
              top: 0,
              bottom: 0,
              width: 9,
              background: '#38bdf8',
              boxShadow: '0 0 30px #38bdf8, 0 0 70px #0284c7',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '28%',
              top: 0,
              bottom: 0,
              width: 9,
              background: '#7dd3fc',
              boxShadow: '0 0 30px #7dd3fc, 0 0 70px #38bdf8',
            }}
          />

          {/* Center Dashed Lane Marker */}
          <div
            style={{
              position: 'absolute',
              left: '49.4%',
              top: 0,
              bottom: 0,
              width: 14,
              backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #38bdf8 60%, transparent 60%, transparent 100%)',
              backgroundSize: '14px 120px',
              backgroundPosition: `0px ${roadDashOffset}px`,
              filter: 'drop-shadow(0 0 14px #38bdf8)',
            }}
          />
        </div>
      </div>

      {/* 4. Blizzard Snow Storm Particles */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 8,
        }}
      >
        {snowFlakes.map((s, idx) => (
          <circle
            key={idx}
            cx={s.x}
            cy={s.y}
            r={s.size}
            fill="#e0f2fe"
            opacity={s.opacity}
            filter="drop-shadow(0 0 6px #bae6fd)"
          />
        ))}
      </svg>

      {/* 5. Blue Sports Car with Icy Accents */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      >
        <CyberCar3D
          primaryColor="#0369a1"
          accentColor="#38bdf8"
          underglowColor="#0284c7"
          driftAngleDeg={Math.sin(frame * 0.14) * 4}
          scale={1.22}
          speedKmh={speed}
          nitroActive={false}
        />
      </div>

      {/* 6. Broadcast Cyber HUD */}
      <CyberHUD
        stageName="ICE ORBIT // SECTOR 04"
        subText="FROST CORRIDOR · HIGH-VELOCITY BLIZZARD"
        speedKmh={Math.round(speed)}
        rpmRatio={0.88}
      />
    </AbsoluteFill>
  );
};
