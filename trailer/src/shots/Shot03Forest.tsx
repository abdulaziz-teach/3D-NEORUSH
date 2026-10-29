import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CyberCar3D } from '../components/CyberCar3D';
import { CyberHUD } from '../components/CyberHUD';

export const Shot03Forest: React.FC = () => {
  const frame = useCurrentFrame();

  // Low camera chase push
  const cameraScale = interpolate(frame, [0, 60], [1.05, 1.18], { extrapolateRight: 'clamp' });
  const cameraPanY = interpolate(frame, [0, 60], [15, -10], { extrapolateRight: 'clamp' });

  // Speedometer
  const speed = interpolate(frame, [0, 60], [255, 275], { extrapolateRight: 'clamp' });

  // Road lines
  const roadDashOffset = (frame * 42) % 120;

  // Bioluminescent spores and floating leaves
  const spores = Array.from({ length: 36 }).map((_, i) => {
    const x = (i * 57 + Math.sin(frame * 0.08 + i) * 60) % 1920;
    const y = (i * 37 + frame * 3) % 1080;
    const size = 6 + (i % 4) * 4;
    const opacity = 0.35 + Math.sin(frame * 0.15 + i) * 0.25;
    return { x, y, size, opacity };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#02120a',
        overflow: 'hidden',
        transform: `scale(${cameraScale})`,
      }}
    >
      {/* 1. Deep Emerald Forest Twilight Sky */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 25%, #064e3b 0%, #022c22 45%, #01140e 100%)',
        }}
      />

      {/* 2. Volumetric Sunbeams / God Rays Cutting Through Trees */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <linearGradient id="godRay1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#86efac" stopOpacity="0.35" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="godRay2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <polygon points="320,0 520,0 720,800 420,800" fill="url(#godRay1)" filter="blur(14px)" />
        <polygon points="1200,0 1440,0 1620,850 1340,850" fill="url(#godRay2)" filter="blur(16px)" />
      </svg>

      {/* 3. Massive Bioluminescent Cyber-Trees Silhouette */}
      <svg
        viewBox="0 0 1920 600"
        style={{
          position: 'absolute',
          top: '12%',
          left: 0,
          width: '100%',
          height: '48%',
          pointerEvents: 'none',
        }}
      >
        {/* Ancient Tree Trunks Left Flank */}
        <path d="M 0,600 L 140,280 L 110,60 L 180,60 L 220,290 L 320,600 Z" fill="#031f17" />
        <path d="M 120,600 L 240,220 L 210,10 L 270,10 L 310,240 L 460,600 Z" fill="#01140e" />

        {/* Ancient Tree Trunks Right Flank */}
        <path d="M 1920,600 L 1780,280 L 1810,60 L 1740,60 L 1700,290 L 1600,600 Z" fill="#031f17" />
        <path d="M 1800,600 L 1680,220 L 1710,10 L 1650,10 L 1610,240 L 1460,600 Z" fill="#01140e" />

        {/* Bioluminescent Vine Veins Pulsing */}
        <path d="M 140,280 Q 180,180 150,80" stroke="#22c55e" strokeWidth="3" fill="none" opacity={0.75 + Math.sin(frame * 0.1) * 0.25} filter="drop-shadow(0 0 10px #4ade80)" />
        <path d="M 1780,280 Q 1740,180 1770,80" stroke="#10b981" strokeWidth="3" fill="none" opacity={0.75 + Math.sin(frame * 0.1) * 0.25} filter="drop-shadow(0 0 10px #34d399)" />
      </svg>

      {/* 4. Emerald Forest Highway */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '52%',
          background: 'linear-gradient(180deg, #022c22 0%, #01140e 100%)',
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
            background: 'linear-gradient(180deg, rgba(6,78,59,0.92) 0%, rgba(2,30,20,1) 100%)',
            boxShadow: 'inset 0 0 100px rgba(34, 197, 94, 0.35)',
          }}
        >
          {/* Luminous Emerald Curbs */}
          <div
            style={{
              position: 'absolute',
              left: '28%',
              top: 0,
              bottom: 0,
              width: 8,
              background: '#22c55e',
              boxShadow: '0 0 25px #22c55e, 0 0 60px #16a34a',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '28%',
              top: 0,
              bottom: 0,
              width: 8,
              background: '#10b981',
              boxShadow: '0 0 25px #10b981, 0 0 60px #059669',
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
              backgroundImage: 'linear-gradient(180deg, #bbf7d0 0%, #22c55e 60%, transparent 60%, transparent 100%)',
              backgroundSize: '14px 120px',
              backgroundPosition: `0px ${roadDashOffset}px`,
              filter: 'drop-shadow(0 0 14px #22c55e)',
            }}
          />
        </div>
      </div>

      {/* 5. Floating Bioluminescent Spores & Dust Particles */}
      {spores.map((s, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            backgroundColor: '#86efac',
            boxShadow: '0 0 14px #4ade80, 0 0 24px #22c55e',
            opacity: s.opacity,
            pointerEvents: 'none',
            zIndex: 9,
          }}
        />
      ))}

      {/* 6. Green-Accented High-Speed Sports Car */}
      <div
        style={{
          position: 'absolute',
          bottom: `calc(12% + ${cameraPanY}px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      >
        <CyberCar3D
          primaryColor="#064e3b"
          accentColor="#4ade80"
          underglowColor="#22c55e"
          driftAngleDeg={Math.sin(frame * 0.15) * 3}
          scale={1.22}
          speedKmh={speed}
          nitroActive={false}
        />
      </div>

      {/* 7. Broadcast Cyber HUD */}
      <CyberHUD
        stageName="EMERALD FOREST // SECTOR 03"
        subText="BIOLUMINESCENT CANOPY · DENSE FOREST RUN"
        speedKmh={Math.round(speed)}
        rpmRatio={0.86}
      />
    </AbsoluteFill>
  );
};
