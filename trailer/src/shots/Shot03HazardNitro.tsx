import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from 'remotion';
import { CyberHUD } from '../components/CyberHUD';

export const Shot03HazardNitro: React.FC = () => {
  const frame = useCurrentFrame();

  // Local frame 0 to 240
  const localFrame = frame;

  // 1. Lane change: Starts at frame 35, snaps to Left Lane (-240px) with spring physics
  const laneShift = spring({
    frame: localFrame - 35,
    fps: 30,
    config: { damping: 13, stiffness: 140, mass: 0.8 },
  });
  const carX = interpolate(laneShift, [0, 1], [0, -240], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const carRoll = interpolate(laneShift, [0, 0.4, 1], [0, -8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // 2. Nitro Boost Activation (starts at frame 90)
  const isNitro = localFrame >= 90;
  const nitroFrame = Math.max(0, localFrame - 90);
  const nitroPunch = isNitro
    ? spring({ frame: nitroFrame, fps: 30, config: { damping: 10, stiffness: 180, mass: 0.6 } })
    : 0;

  // Camera push and shake
  const cameraZoom = interpolate(localFrame, [0, 90, 240], [1.02, 1.06, 1.18], { extrapolateRight: 'clamp' });
  const nitroShake = isNitro ? Math.sin(localFrame * 1.8) * 3 : Math.sin(localFrame * 0.9) * 1.2;

  // Speedometer progression (195 km/h -> 295 km/h on Nitro)
  const speed = interpolate(localFrame, [0, 90, 240], [195, 205, 298], { extrapolateRight: 'clamp' });
  const rpmRatio = isNitro ? 0.98 : 0.82;

  // Road animation (accelerates on Nitro)
  const roadSpeed = isNitro ? 42 : 28;
  const roadDashOffset = (localFrame * roadSpeed) % 120;

  // Hazard approaching in Center Lane (frames 0 to 80)
  const hazardZ = interpolate(localFrame, [0, 80], [0.15, 1.1], { extrapolateRight: 'clamp' });
  const hazardScale = hazardZ;
  const hazardOpacity = interpolate(localFrame, [0, 15, 75, 85], [0, 1, 1, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#040612',
        overflow: 'hidden',
        transform: `scale(${cameraZoom}) translateY(${nitroShake}px)`,
      }}
    >
      {/* Background Gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isNitro
            ? 'linear-gradient(180deg, #090620 0%, #1e093c 45%, #00e5ff 160%)'
            : 'linear-gradient(180deg, #070a20 0%, #180b3c 55%, #0a0d22 100%)',
        }}
      />

      {/* Road Plane with 3 Lanes */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '54%',
          perspective: 600,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '-10% -20%',
            transform: 'rotateX(62deg)',
            transformOrigin: '50% 0%',
            background: '#0d1527',
            borderLeft: isNitro ? '16px solid #00e5ff' : '14px solid #ff2fb9',
            borderRight: isNitro ? '16px solid #00e5ff' : '14px solid #ff2fb9',
            boxShadow: isNitro ? '0 0 50px #00e5ff' : '0 0 35px #ff2fb9',
          }}
        >
          {/* Lane Divider 1 */}
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
              filter: 'drop-shadow(0 0 10px #00e5ff)',
            }}
          />
          {/* Lane Divider 2 */}
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
              filter: 'drop-shadow(0 0 10px #00e5ff)',
            }}
          />
        </div>
      </div>

      {/* Hazard: High-Voltage Plasma Laser Barrier in Center Lane */}
      {localFrame < 85 && (
        <div
          style={{
            position: 'absolute',
            bottom: `${26 + hazardZ * 26}%`,
            left: '50%',
            transform: `translate(-50%, -50%) scale(${hazardScale})`,
            opacity: hazardOpacity,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            filter: 'drop-shadow(0 0 20px #ff2b43)',
          }}
        >
          {/* Warning Emblem Badge */}
          <div
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              backgroundColor: '#ff2b43',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: '0.1em',
              marginBottom: 4,
            }}
          >
            ! HAZARD
          </div>
          {/* Laser Wall Barrier Graphic */}
          <svg width="220" height="70" viewBox="0 0 220 70">
            <rect x="10" y="5" width="20" height="60" fill="#1e293b" stroke="#ff2b43" strokeWidth="2" />
            <rect x="190" y="5" width="20" height="60" fill="#1e293b" stroke="#ff2b43" strokeWidth="2" />
            <line x1="30" y1="20" x2="190" y2="20" stroke="#ff2b43" strokeWidth="5" strokeDasharray="10 6" />
            <line x1="30" y1="40" x2="190" y2="40" stroke="#ffd166" strokeWidth="4" strokeDasharray="8 4" />
            <line x1="30" y1="55" x2="190" y2="55" stroke="#ff2b43" strokeWidth="5" strokeDasharray="10 6" />
          </svg>
        </div>
      )}

      {/* Player Car in Left/Center Lane */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: `calc(50% + ${carX}px)`,
          transform: `translate(-50%, 0) rotate(${carRoll}deg)`,
          width: 320,
          height: 160,
          filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.9))',
        }}
      >
        {/* Underglow Glow */}
        <div
          style={{
            position: 'absolute',
            bottom: -15,
            left: 20,
            right: 20,
            height: 40,
            background: isNitro
              ? 'radial-gradient(ellipse, #00f5ff 0%, rgba(0, 245, 255, 0.8) 50%, transparent 80%)'
              : 'radial-gradient(ellipse, #00e5ff 0%, rgba(0, 229, 255, 0.6) 40%, transparent 80%)',
            filter: 'blur(16px)',
          }}
        />

        {/* NITRO EXHAUST FLAMES (when Nitro active) */}
        {isNitro && (
          <>
            {/* Left Exhaust Jet */}
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                left: 70,
                width: 30,
                height: 110 + Math.sin(localFrame * 2) * 15,
                background: 'linear-gradient(180deg, #ffffff 0%, #00e5ff 40%, #a855f7 85%, transparent 100%)',
                borderRadius: '50% 50% 20% 20%',
                transform: 'translate(-50%, 100%)',
                filter: 'drop-shadow(0 0 16px #00e5ff) blur(1px)',
              }}
            />
            {/* Right Exhaust Jet */}
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                right: 70,
                width: 30,
                height: 110 + Math.cos(localFrame * 2) * 15,
                background: 'linear-gradient(180deg, #ffffff 0%, #00e5ff 40%, #a855f7 85%, transparent 100%)',
                borderRadius: '50% 50% 20% 20%',
                transform: 'translate(50%, 100%)',
                filter: 'drop-shadow(0 0 16px #00e5ff) blur(1px)',
              }}
            />
            {/* Slipstream Aerodynamic Wind Ribbons from Wingtips */}
            <div
              style={{
                position: 'absolute',
                top: 25,
                left: 30,
                width: 2,
                height: 240,
                background: 'linear-gradient(180deg, #00e5ff, transparent)',
                filter: 'blur(1px)',
                opacity: 0.85,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 25,
                right: 30,
                width: 2,
                height: 240,
                background: 'linear-gradient(180deg, #00e5ff, transparent)',
                filter: 'blur(1px)',
                opacity: 0.85,
              }}
            />
          </>
        )}

        {/* 3D Car SVG Silhouette */}
        <svg width="320" height="160" viewBox="0 0 320 160">
          <defs>
            <linearGradient id="nitroCarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="60%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
            <linearGradient id="nitroTailGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff2b43" />
              <stop offset="50%" stopColor="#00e5ff" />
              <stop offset="100%" stopColor="#ff2b43" />
            </linearGradient>
          </defs>

          {/* Wing */}
          <polygon points="40,25 280,25 295,40 25,40" fill="#0f172a" stroke="#00e5ff" strokeWidth="2" />
          <line x1="85" y1="40" x2="95" y2="70" stroke="#334155" strokeWidth="4" />
          <line x1="235" y1="40" x2="225" y2="70" stroke="#334155" strokeWidth="4" />

          {/* Cabin */}
          <polygon points="90,45 230,45 255,85 65,85" fill="#0a101f" stroke="#00e5ff" strokeWidth="1.5" />

          {/* Body */}
          <path
            d="M 30,135 L 50,85 L 270,85 L 290,135 L 275,148 L 45,148 Z"
            fill="url(#nitroCarGrad)"
            stroke={isNitro ? '#00f5ff' : '#00e5ff'}
            strokeWidth="2.5"
          />

          {/* Tail Blade */}
          <rect
            x="55"
            y="94"
            width="210"
            height="9"
            rx="4"
            fill="url(#nitroTailGrad)"
            style={{ filter: isNitro ? 'drop-shadow(0 0 14px #00f5ff)' : 'drop-shadow(0 0 8px #ff2b43)' }}
          />

          {/* Exhausts */}
          <circle cx="85" cy="142" r="8" fill="#1e293b" stroke="#00e5ff" strokeWidth="2" />
          <circle cx="235" cy="142" r="8" fill="#1e293b" stroke="#00e5ff" strokeWidth="2" />
        </svg>
      </div>

      {/* Cyberpunk Telemetry HUD */}
      <CyberHUD
        speedKmh={speed}
        rpmRatio={rpmRatio}
        stageName="SECTOR 02 · DRIFT HIGHWAY"
        subText={isNitro ? 'NITRO BOOST: MAXIMUM THRUST' : 'LANE EVASION: COMPLETED'}
        showWarning={localFrame < 80}
        warningText="LASER BARRIER DETECTED"
      />
    </AbsoluteFill>
  );
};
