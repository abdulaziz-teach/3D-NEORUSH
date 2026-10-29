import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CyberHUD } from '../components/CyberHUD';

export const Shot02Launch: React.FC = () => {
  const frame = useCurrentFrame();

  // Local frame inside Scene 2 (0 to 210 frames)
  const localFrame = frame;

  // Camera tracking vibration and subtle speed push
  const cameraShake = Math.sin(localFrame * 0.9) * 1.5;
  const cameraScale = interpolate(localFrame, [0, 210], [1.0, 1.08], { extrapolateRight: 'clamp' });

  // Speedometer progression (70 km/h up to 195 km/h)
  const speed = interpolate(localFrame, [0, 210], [70, 195], { extrapolateRight: 'clamp' });
  const rpmRatio = interpolate(localFrame, [0, 210], [0.65, 0.92], { extrapolateRight: 'clamp' });

  // Road lines moving forward continuously
  const roadDashOffset = (localFrame * 28) % 120;

  // Car lateral sway (driving momentum)
  const carSwayX = Math.sin(localFrame * 0.08) * 18;
  const carRoll = Math.sin(localFrame * 0.08) * 1.2;

  // Searchlight sweep angle
  const searchlightAngle = Math.sin(localFrame * 0.035) * 35;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#040612',
        overflow: 'hidden',
        transform: `scale(${cameraScale}) translateY(${cameraShake}px)`,
      }}
    >
      {/* 1. Neon Sky Gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #070a20 0%, #180b3c 45%, #40104a 70%, #0c1126 100%)',
        }}
      />

      {/* 2. Striped Synthwave Sun on the Horizon */}
      <div
        style={{
          position: 'absolute',
          top: '32%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #ffe08a 0%, #ff2fb9 65%, #6d1fa0 100%)',
          boxShadow: '0 0 80px rgba(255, 47, 185, 0.6), 0 0 140px rgba(0, 229, 255, 0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Sun horizontal scanline bars */}
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              bottom: i * 14,
              left: 0,
              right: 0,
              height: 2 + i * 0.6,
              backgroundColor: '#070a20',
            }}
          />
        ))}
      </div>

      {/* 3. Sweeping Sky Searchlights */}
      <div
        style={{
          position: 'absolute',
          bottom: '50%',
          left: '25%',
          width: 80,
          height: 900,
          background: 'linear-gradient(180deg, transparent, rgba(0, 229, 255, 0.15))',
          transform: `rotate(${searchlightAngle - 25}deg)`,
          transformOrigin: 'bottom center',
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '50%',
          right: '25%',
          width: 80,
          height: 900,
          background: 'linear-gradient(180deg, transparent, rgba(217, 70, 239, 0.15))',
          transform: `rotate(${-searchlightAngle + 25}deg)`,
          transformOrigin: 'bottom center',
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />

      {/* 4. Skyscraper Silhouettes with Holographic Signage */}
      <div
        style={{
          position: 'absolute',
          bottom: '46%',
          left: 0,
          right: 0,
          height: 260,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '0 40px',
          filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.9))',
        }}
      >
        {/* Left Skyscrapers */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <div style={{ width: 110, height: 260, background: '#070b1a', borderTop: '2px solid #00e5ff' }}>
            <div style={{ padding: 8, fontSize: 9, color: '#00e5ff', fontWeight: 900, letterSpacing: '0.2em' }}>
              NEORUSH
            </div>
          </div>
          <div style={{ width: 90, height: 210, background: '#0a1024', borderTop: '2px solid #a855f7' }}>
            <div style={{ padding: 6, fontSize: 8, color: '#a855f7', fontWeight: 900 }}>2099</div>
          </div>
          <div style={{ width: 140, height: 280, background: '#050814', borderTop: '2px solid #00e5ff' }} />
        </div>

        {/* Right Skyscrapers */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <div style={{ width: 130, height: 270, background: '#050814', borderTop: '2px solid #00e5ff' }}>
            <div style={{ padding: 8, fontSize: 9, color: '#7dff9b', fontWeight: 900, letterSpacing: '0.2em' }}>
              SECTOR 01
            </div>
          </div>
          <div style={{ width: 95, height: 230, background: '#090f26', borderTop: '2px solid #ff2fb9' }} />
          <div style={{ width: 110, height: 250, background: '#060a18', borderTop: '2px solid #00e5ff' }} />
        </div>
      </div>

      {/* 5. 3-Lane Perspective Highway Canvas Simulation */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '52%',
          background: 'linear-gradient(180deg, #090e1f 0%, #03050c 100%)',
          perspective: 600,
          overflow: 'hidden',
        }}
      >
        {/* Road Surface Plane with Perspective */}
        <div
          style={{
            position: 'absolute',
            inset: '-10% -20%',
            transform: 'rotateX(62deg)',
            transformOrigin: '50% 0%',
            background: '#0d1527',
            borderLeft: '14px solid #ff2fb9',
            borderRight: '14px solid #ff2fb9',
            boxShadow: 'inset 0 0 100px rgba(0,0,0,0.9), 0 0 35px #ff2fb9',
          }}
        >
          {/* Lane Divider 1 (Left-Center) */}
          <div
            style={{
              position: 'absolute',
              left: '33.3%',
              top: 0,
              bottom: 0,
              width: 8,
              backgroundImage:
                'repeating-linear-gradient(180deg, #00e5ff 0px, #00e5ff 40px, transparent 40px, transparent 100px)',
              backgroundPosition: `0px ${roadDashOffset * 2}px`,
              filter: 'drop-shadow(0 0 8px #00e5ff)',
            }}
          />

          {/* Lane Divider 2 (Center-Right) */}
          <div
            style={{
              position: 'absolute',
              left: '66.6%',
              top: 0,
              bottom: 0,
              width: 8,
              backgroundImage:
                'repeating-linear-gradient(180deg, #00e5ff 0px, #00e5ff 40px, transparent 40px, transparent 100px)',
              backgroundPosition: `0px ${roadDashOffset * 2}px`,
              filter: 'drop-shadow(0 0 8px #00e5ff)',
            }}
          />
        </div>
      </div>

      {/* 6. High-Speed Particles / Speed Streaks */}
      {[...Array(12)].map((_, idx) => {
        const xPos = (idx * 16) + 5;
        const streakY = ((localFrame * 35 + idx * 110) % 600);
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${xPos}%`,
              bottom: streakY,
              width: 2,
              height: 45,
              background: 'linear-gradient(180deg, rgba(0, 229, 255, 0.8), transparent)',
              filter: 'blur(1px)',
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {/* 7. Player 3D Sportcar (Center Lane Rear Perspective) */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: `calc(50% + ${carSwayX}px)`,
          transform: `translate(-50%, 0) rotate(${carRoll}deg)`,
          width: 320,
          height: 160,
          filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.9))',
        }}
      >
        {/* Car Underglow Ground Glow */}
        <div
          style={{
            position: 'absolute',
            bottom: -15,
            left: 20,
            right: 20,
            height: 40,
            background: 'radial-gradient(ellipse, #00e5ff 0%, rgba(0, 229, 255, 0.6) 40%, transparent 80%)',
            filter: 'blur(14px)',
          }}
        />

        <svg width="320" height="160" viewBox="0 0 320 160">
          <defs>
            <linearGradient id="carBodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="60%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
            <linearGradient id="tailBladeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff2b43" />
              <stop offset="50%" stopColor="#ff0055" />
              <stop offset="100%" stopColor="#ff2b43" />
            </linearGradient>
          </defs>

          {/* Rear Wing / Cyber Spoiler */}
          <polygon points="40,25 280,25 295,40 25,40" fill="#0f172a" stroke="#00e5ff" strokeWidth="2" />
          <line x1="85" y1="40" x2="95" y2="70" stroke="#334155" strokeWidth="4" />
          <line x1="235" y1="40" x2="225" y2="70" stroke="#334155" strokeWidth="4" />

          {/* Cabin & Rear Glass */}
          <polygon points="90,45 230,45 255,85 65,85" fill="#0a101f" stroke="#00e5ff" strokeWidth="1.5" />
          <polygon points="105,52 215,52 235,80 85,80" fill="#1e293b" opacity="0.6" />

          {/* Main Rear Bumper & Widebody Shoulders */}
          <path
            d="M 30,135 L 50,85 L 270,85 L 290,135 L 275,148 L 45,148 Z"
            fill="url(#carBodyGrad)"
            stroke="#00e5ff"
            strokeWidth="2"
          />

          {/* Full-Width Cyberpunk Laser Tail Blade */}
          <rect
            x="55"
            y="94"
            width="210"
            height="9"
            rx="4"
            fill="url(#tailBladeGrad)"
            style={{ filter: 'drop-shadow(0 0 10px #ff2b43)' }}
          />

          {/* Rear Aerodynamic Diffuser & Strakes */}
          <rect x="110" y="140" width="100" height="10" fill="#020617" stroke="#334155" strokeWidth="1" />
          <line x1="135" y1="140" x2="135" y2="150" stroke="#00e5ff" strokeWidth="2" />
          <line x1="160" y1="140" x2="160" y2="150" stroke="#00e5ff" strokeWidth="2" />
          <line x1="185" y1="140" x2="185" y2="150" stroke="#00e5ff" strokeWidth="2" />

          {/* Twin Titanium Exhaust Tips */}
          <circle cx="85" cy="142" r="8" fill="#1e293b" stroke="#00e5ff" strokeWidth="2" />
          <circle cx="85" cy="142" r="4" fill="#00e5ff" style={{ filter: 'drop-shadow(0 0 6px #00e5ff)' }} />

          <circle cx="235" cy="142" r="8" fill="#1e293b" stroke="#00e5ff" strokeWidth="2" />
          <circle cx="235" cy="142" r="4" fill="#00e5ff" style={{ filter: 'drop-shadow(0 0 6px #00e5ff)' }} />
        </svg>
      </div>

      {/* Cyberpunk Telemetry HUD */}
      <CyberHUD
        speedKmh={speed}
        rpmRatio={rpmRatio}
        stageName="NEON MEGAPOLIS · HIGHWAY 01"
        subText="MAX VELOCITY INITIATED"
      />
    </AbsoluteFill>
  );
};
