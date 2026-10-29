import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CyberCar3D } from '../components/CyberCar3D';
import { CyberHUD } from '../components/CyberHUD';

export const Shot02Desert: React.FC = () => {
  const frame = useCurrentFrame();

  // Entrance flash from City cut (frames 0-8)
  const enterFlash = interpolate(frame, [0, 8], [0.65, 0], { extrapolateRight: 'clamp' });

  // Camera drift tracking: wide shot moving closer
  const cameraScale = interpolate(frame, [0, 60], [1.0, 1.12], { extrapolateRight: 'clamp' });
  const cameraPanX = interpolate(frame, [0, 60], [-40, 35], { extrapolateRight: 'clamp' });

  // Car aggressive drift angle (starts tilted, counter-steers smoothly)
  const driftAngle = interpolate(frame, [0, 25, 60], [-14, -8, -12], { extrapolateRight: 'clamp' });

  // Speed telemetry
  const speed = interpolate(frame, [0, 60], [225, 255], { extrapolateRight: 'clamp' });

  // Road lines
  const roadDashOffset = (frame * 38) % 120;

  // Dust rooster tails particles behind wheels
  const dustParticles = Array.from({ length: 32 }).map((_, i) => {
    const life = ((frame * 2 + i * 4) % 60) / 60; // 0 to 1
    const x = 960 + (i % 2 === 0 ? -160 : 120) + (i % 2 === 0 ? -life * 240 : life * 280) + Math.sin(i) * 20;
    const y = 840 - life * 140;
    const size = 18 + life * 95;
    const opacity = (1 - life) * 0.55;
    return { x, y, size, opacity };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a0808',
        overflow: 'hidden',
        transform: `scale(${cameraScale}) translateX(${cameraPanX * 0.5}px)`,
      }}
    >
      {/* 1. Warm Sunset Sky Gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #3d0e14 0%, #7c2d12 40%, #c2410c 68%, #ea580c 85%, #fb923c 100%)',
        }}
      />

      {/* 2. Low Blazing Desert Sun on Horizon */}
      <div
        style={{
          position: 'absolute',
          top: '36%',
          left: '52%',
          transform: 'translate(-50%, -50%)',
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #fff7ed 0%, #fed7aa 35%, #fb923c 70%, transparent 100%)',
          boxShadow: '0 0 100px #f97316, 0 0 180px rgba(249, 115, 22, 0.6)',
        }}
      />

      {/* 3. Red Sandstone Canyon Silhouette Layer */}
      <svg
        viewBox="0 0 1920 500"
        style={{
          position: 'absolute',
          top: '18%',
          left: 0,
          width: '100%',
          height: '42%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <linearGradient id="canyonGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c2d12" />
            <stop offset="60%" stopColor="#431407" />
            <stop offset="100%" stopColor="#1c0704" />
          </linearGradient>
        </defs>
        {/* Mesa & Canyon Formations */}
        <polygon points="0,500 0,220 180,180 280,240 420,160 560,260 720,200 900,280 1100,170 1280,230 1480,150 1680,240 1920,190 1920,500" fill="url(#canyonGrad)" />
        {/* Closer Canyon Pillars */}
        <polygon points="60,500 90,140 170,140 210,500" fill="#2d0a06" />
        <polygon points="1720,500 1750,110 1840,110 1880,500" fill="#2d0a06" />
      </svg>

      {/* 4. Golden Sand Road & Desert Dunes */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '52%',
          background: 'linear-gradient(180deg, #431407 0%, #1c0704 100%)',
          perspective: 480,
          perspectiveOrigin: '50% 15%',
          overflow: 'hidden',
        }}
      >
        {/* Road Surface Plane */}
        <div
          style={{
            position: 'absolute',
            inset: '-30% -40%',
            transform: 'rotateX(72deg)',
            transformOrigin: '50% 100%',
            background: 'linear-gradient(180deg, rgba(67,20,7,0.95) 0%, rgba(20,5,3,1) 100%)',
            boxShadow: 'inset 0 0 100px rgba(251, 146, 60, 0.35)',
          }}
        >
          {/* Golden Curbs */}
          <div
            style={{
              position: 'absolute',
              left: '28%',
              top: 0,
              bottom: 0,
              width: 9,
              background: '#f59e0b',
              boxShadow: '0 0 30px #f59e0b, 0 0 60px #d97706',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '28%',
              top: 0,
              bottom: 0,
              width: 9,
              background: '#f97316',
              boxShadow: '0 0 30px #f97316, 0 0 60px #ea580c',
            }}
          />

          {/* Center Dashed Line */}
          <div
            style={{
              position: 'absolute',
              left: '49.4%',
              top: 0,
              bottom: 0,
              width: 14,
              backgroundImage: 'linear-gradient(180deg, #fef08a 0%, #f59e0b 60%, transparent 60%, transparent 100%)',
              backgroundSize: '14px 120px',
              backgroundPosition: `0px ${roadDashOffset}px`,
              filter: 'drop-shadow(0 0 14px #f59e0b)',
            }}
          />
        </div>
      </div>

      {/* 5. Sand Dust Rooster Tail Particles Behind Drift */}
      {dustParticles.map((d, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: d.x,
            top: d.y,
            width: d.size,
            height: d.size * 0.65,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251, 146, 60, 0.6) 0%, rgba(180, 83, 9, 0.3) 60%, transparent 80%)',
            filter: 'blur(8px)',
            opacity: d.opacity,
            pointerEvents: 'none',
            zIndex: 8,
          }}
        />
      ))}

      {/* 6. Drifting Golden Sports Car */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: `calc(50% + ${cameraPanX}px)`,
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      >
        <CyberCar3D
          primaryColor="#451a03"
          accentColor="#fbbf24"
          underglowColor="#f59e0b"
          driftAngleDeg={driftAngle}
          scale={1.24}
          speedKmh={speed}
          nitroActive={false}
        />
      </div>

      {/* Entrance Flash Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#ffedd5',
          opacity: enterFlash,
          pointerEvents: 'none',
          zIndex: 40,
        }}
      />

      {/* 7. Broadcast Cyber HUD */}
      <CyberHUD
        stageName="CRYSTAL DESERT // SECTOR 02"
        subText="HIGH-SPEED SAND DRIFT · CANYON CORRIDOR"
        speedKmh={Math.round(speed)}
        rpmRatio={0.84}
      />
    </AbsoluteFill>
  );
};
