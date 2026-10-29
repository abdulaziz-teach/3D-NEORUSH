import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CyberCar3D } from '../components/CyberCar3D';
import { CyberHUD } from '../components/CyberHUD';

export const Shot01City: React.FC = () => {
  const frame = useCurrentFrame();

  // Dynamic low-angle tracking push-in
  const cameraScale = interpolate(frame, [0, 90], [1.02, 1.15], { extrapolateRight: 'clamp' });
  const cameraPanY = interpolate(frame, [0, 90], [10, -15], { extrapolateRight: 'clamp' });
  const cameraShake = Math.sin(frame * 1.6) * 1.2;

  // Speedometer progression (140 to 225 km/h)
  const speed = interpolate(frame, [0, 90], [140, 225], { extrapolateRight: 'clamp' });

  // Whip-pan transition out at end of scene (frames 82-90)
  const exitWhip = interpolate(frame, [82, 90], [0, -380], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(frame, [85, 90], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Road lines moving fast
  const roadDashOffset = (frame * 36) % 120;

  // Searchlight angle
  const searchlightRot = Math.sin(frame * 0.05) * 28;

  // Rainy streak generation
  const rainStreaks = Array.from({ length: 42 }).map((_, i) => {
    const x = ((i * 47 + frame * 32) % 1920);
    const y = ((i * 73 + frame * 54) % 1080);
    const len = 35 + (i % 5) * 12;
    return { x, y, len, opacity: 0.25 + (i % 3) * 0.15 };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#040612',
        overflow: 'hidden',
        transform: `translateX(${exitWhip}px) scale(${cameraScale}) translateY(${cameraShake}px)`,
        opacity: exitOpacity,
      }}
    >
      {/* 1. Deep Midnight Blue & Violet Metropolis Sky */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 30%, #1e0b36 0%, #080d24 55%, #03050c 100%)',
        }}
      />

      {/* 2. Sweeping Volumetric Searchlights */}
      <div
        style={{
          position: 'absolute',
          bottom: '48%',
          left: '22%',
          width: 90,
          height: 1200,
          background: 'linear-gradient(180deg, transparent, rgba(0, 229, 255, 0.18))',
          transform: `rotate(${searchlightRot - 22}deg)`,
          transformOrigin: 'bottom center',
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '48%',
          right: '25%',
          width: 90,
          height: 1200,
          background: 'linear-gradient(180deg, transparent, rgba(217, 70, 239, 0.18))',
          transform: `rotate(${-searchlightRot + 20}deg)`,
          transformOrigin: 'bottom center',
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />

      {/* 3. Futuristic Neon Skyscraper Skyline Silhouette */}
      <svg
        viewBox="0 0 1920 600"
        style={{
          position: 'absolute',
          top: '10%',
          left: 0,
          width: '100%',
          height: '52%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <linearGradient id="cityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1b2342" />
            <stop offset="60%" stopColor="#0b1022" />
            <stop offset="100%" stopColor="#050713" />
          </linearGradient>
        </defs>
        {/* Skyscrapers */}
        <rect x="80" y="140" width="110" height="460" fill="url(#cityGrad)" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.4" />
        <rect x="220" y="80" width="140" height="520" fill="url(#cityGrad)" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.5" />
        <rect x="400" y="220" width="90" height="380" fill="url(#cityGrad)" />
        <rect x="520" y="110" width="160" height="490" fill="url(#cityGrad)" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.4" />
        {/* Spire */}
        <polygon points="600,30 590,110 610,110" fill="#00e5ff" opacity="0.8" />
        <rect x="720" y="180" width="120" height="420" fill="url(#cityGrad)" stroke="#ff2fb9" strokeWidth="1" strokeOpacity="0.4" />
        <rect x="1080" y="160" width="140" height="440" fill="url(#cityGrad)" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.5" />
        <rect x="1260" y="90" width="130" height="510" fill="url(#cityGrad)" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.4" />
        <polygon points="1325,15 1315,90 1335,90" fill="#a855f7" opacity="0.8" />
        <rect x="1430" y="210" width="100" height="390" fill="url(#cityGrad)" />
        <rect x="1570" y="130" width="150" height="470" fill="url(#cityGrad)" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.4" />
        <rect x="1750" y="190" width="110" height="410" fill="url(#cityGrad)" />

        {/* Lit Neon Windows Grid */}
        {[...Array(28)].map((_, i) => (
          <rect
            key={i}
            x={100 + (i % 7) * 240}
            y={120 + Math.floor(i / 7) * 90}
            width={18}
            height={26}
            fill={i % 2 === 0 ? '#00e5ff' : '#ff2fb9'}
            opacity={0.35 + (Math.sin(frame * 0.15 + i) * 0.25)}
          />
        ))}
      </svg>

      {/* 4. Wet 3D Asphalt Highway & Neon Reflections */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '52%',
          background: 'linear-gradient(180deg, #090e1f 0%, #03050c 100%)',
          perspective: 480,
          perspectiveOrigin: '50% 15%',
          overflow: 'hidden',
        }}
      >
        {/* Road Surface Plane with Wet Sheen */}
        <div
          style={{
            position: 'absolute',
            inset: '-30% -40%',
            transform: 'rotateX(72deg)',
            transformOrigin: '50% 100%',
            background: 'linear-gradient(180deg, rgba(20,28,52,0.95) 0%, rgba(6,9,20,1) 100%)',
            boxShadow: 'inset 0 0 100px rgba(0, 229, 255, 0.25)',
          }}
        >
          {/* Wet asphalt puddles reflection gradients */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 35% 55%, rgba(0, 229, 255, 0.22) 0%, transparent 60%), radial-gradient(ellipse at 65% 50%, rgba(217, 70, 239, 0.22) 0%, transparent 60%)',
            }}
          />

          {/* Luminous Road Edges (Neon Curbs) */}
          <div
            style={{
              position: 'absolute',
              left: '28%',
              top: 0,
              bottom: 0,
              width: 8,
              background: '#00e5ff',
              boxShadow: '0 0 25px #00e5ff, 0 0 60px #00e5ff',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: '28%',
              top: 0,
              bottom: 0,
              width: 8,
              background: '#ff2fb9',
              boxShadow: '0 0 25px #ff2fb9, 0 0 60px #ff2fb9',
            }}
          />

          {/* Center Dashed Lane Marker with high-speed motion */}
          <div
            style={{
              position: 'absolute',
              left: '49.4%',
              top: 0,
              bottom: 0,
              width: 14,
              backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #00e5ff 60%, transparent 60%, transparent 100%)',
              backgroundSize: '14px 120px',
              backgroundPosition: `0px ${roadDashOffset}px`,
              filter: 'drop-shadow(0 0 12px #00e5ff)',
            }}
          />
        </div>
      </div>

      {/* 5. Rain Streaks Over Screen */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {rainStreaks.map((r, idx) => (
          <line
            key={idx}
            x1={r.x}
            y1={r.y}
            x2={r.x - 12}
            y2={r.y + r.len}
            stroke="#7dd3fc"
            strokeWidth="1.6"
            strokeOpacity={r.opacity}
          />
        ))}
      </svg>

      {/* 6. Dynamic Cyberpunk Sports Car (Low-Angle Tracking Shot) */}
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
          primaryColor="#0f172a"
          accentColor="#00e5ff"
          underglowColor="#00e5ff"
          driftAngleDeg={Math.sin(frame * 0.12) * 4}
          scale={1.22}
          speedKmh={speed}
          nitroActive={false}
        />
      </div>

      {/* 7. Wet Asphalt Water Spray Particles behind Wheels */}
      {[...Array(14)].map((_, i) => {
        const sprayX = 960 + (i % 2 === 0 ? -190 : 190) + Math.sin(frame * 2 + i) * 35;
        const sprayY = 880 + (i * 9) % 80;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: sprayX,
              top: sprayY,
              width: 12 + (i % 3) * 8,
              height: 6,
              borderRadius: '50%',
              background: 'rgba(125, 211, 252, 0.45)',
              filter: 'blur(5px)',
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {/* 8. Broadcast Cyber HUD */}
      <CyberHUD
        stageName="NEON MEGAPOLIS // SECTOR 01"
        subText="RAIN CONDITION · WET ASPHALT REFLECTIONS"
        speedKmh={Math.round(speed)}
        rpmRatio={0.78}
      />
    </AbsoluteFill>
  );
};
