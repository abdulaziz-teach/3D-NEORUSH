import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CyberHUD } from '../components/CyberHUD';

export const Shot01Ignition: React.FC = () => {
  const frame = useCurrentFrame();

  // Camera slow push-in
  const cameraScale = interpolate(frame, [0, 120], [1.03, 1.16], { extrapolateRight: 'clamp' });
  const cameraPanX = interpolate(frame, [0, 120], [20, -10], { extrapolateRight: 'clamp' });

  // Whip-pan exit blur (frames 110-120)
  const exitWhip = interpolate(frame, [110, 120], [0, -400], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(frame, [114, 120], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Underglow ignition flash at frame 38
  const underglowPulse = interpolate(frame, [38, 48, 80, 120], [0, 1, 0.75, 0.95], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Wheel rotation angle (starts slow, spools up aggressively)
  const wheelAngle = interpolate(frame, [0, 40, 120], [0, 12, 540], { extrapolateRight: 'clamp' });

  // Telemetry speed and RPM
  const speed = interpolate(frame, [0, 45, 120], [0, 0, 68], { extrapolateRight: 'clamp' });
  const rpmRatio = interpolate(frame, [0, 40, 120], [0.1, 0.15, 0.72], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#050711',
        overflow: 'hidden',
        transform: `translateX(${exitWhip}px) scale(${cameraScale})`,
        opacity: exitOpacity,
      }}
    >
      {/* Dynamic Background Asphalt & Distant Sky Silhouette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 60%, #0d1728 0%, #050712 70%, #020308 100%)',
        }}
      />

      {/* Road Grid Perspective */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '-20%',
          right: '-20%',
          height: '55%',
          backgroundImage:
            'linear-gradient(rgba(0, 229, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          transform: 'perspective(400px) rotateX(68deg)',
          transformOrigin: '50% 100%',
        }}
      />

      {/* Underglow Ground Reflection Pool */}
      <div
        style={{
          position: 'absolute',
          bottom: '18%',
          left: '32%',
          width: 720,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(0, 229, 255, 0.65) 0%, rgba(168, 85, 247, 0.25) 45%, transparent 72%)',
          filter: 'blur(28px)',
          opacity: underglowPulse,
          transform: 'translate(-50%, 0)',
        }}
      />

      {/* 3D-Styled Sportcar Rear Wheel & Fender Macro Artwork */}
      <div
        style={{
          position: 'absolute',
          left: `calc(38% + ${cameraPanX}px)`,
          top: '32%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          height: 520,
        }}
      >
        {/* Car Carbon Fender Arch */}
        <svg width="520" height="520" viewBox="0 0 520 520" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id="carbonBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e2638" />
              <stop offset="50%" stopColor="#0d1322" />
              <stop offset="100%" stopColor="#080c16" />
            </linearGradient>
            <linearGradient id="neonTrim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00e5ff" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          {/* Aerodynamic Widebody Fender Flare */}
          <path
            d="M 60 480 C 70 240, 220 90, 460 70 L 510 110 C 270 120, 150 250, 140 480 Z"
            fill="url(#carbonBody)"
            stroke="url(#neonTrim)"
            strokeWidth="3"
            filter="drop-shadow(0 15px 30px rgba(0,0,0,0.8))"
          />
          {/* Cyan Aero Line Accent */}
          <path
            d="M 120 480 C 130 260, 250 140, 480 120"
            fill="none"
            stroke="#00e5ff"
            strokeWidth="2.5"
            strokeDasharray="8 4"
            opacity={underglowPulse}
          />
        </svg>

        {/* Rotating Alloy Turbine Wheel */}
        <div
          style={{
            position: 'absolute',
            left: 120,
            top: 140,
            width: 320,
            height: 320,
            borderRadius: '50%',
            transform: `rotate(${wheelAngle}deg)`,
            transformOrigin: 'center center',
          }}
        >
          <svg width="320" height="320" viewBox="0 0 320 320">
            <defs>
              <radialGradient id="tireGrad" cx="50%" cy="50%" r="50%">
                <stop offset="78%" stopColor="#141824" />
                <stop offset="90%" stopColor="#0a0d14" />
                <stop offset="100%" stopColor="#04060a" />
              </radialGradient>
              <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="60%" stopColor="#475569" />
                <stop offset="100%" stopColor="#1e293b" />
              </radialGradient>
            </defs>

            {/* Rubber Tire Outer Ring */}
            <circle cx="160" cy="160" r="150" fill="url(#tireGrad)" stroke="#1e293b" strokeWidth="6" />

            {/* Tire Tread Grooves */}
            {[...Array(16)].map((_, idx) => {
              const ang = (idx * 360) / 16;
              return (
                <line
                  key={idx}
                  x1="160"
                  y1="14"
                  x2="160"
                  y2="28"
                  stroke="#0a0d14"
                  strokeWidth="5"
                  transform={`rotate(${ang} 160 160)`}
                />
              );
            })}

            {/* Alloy Rim Lip with Neon Underglow Highlight */}
            <circle
              cx="160"
              cy="160"
              r="120"
              fill="none"
              stroke="#00e5ff"
              strokeWidth="4"
              style={{
                filter: underglowPulse > 0.5 ? 'drop-shadow(0 0 10px #00e5ff)' : 'none',
              }}
            />

            {/* Brake Rotor Disc with Perforated Holes */}
            <circle cx="160" cy="160" r="95" fill="#334155" stroke="#1e293b" strokeWidth="2" />

            {/* Red Brembo-Style Cyber Brake Caliper */}
            <path
              d="M 230 110 C 255 135, 255 185, 230 210 L 210 200 C 230 180, 230 140, 210 120 Z"
              fill="#ff2b43"
              stroke="#ffffff"
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255, 43, 67, 0.6))' }}
            />

            {/* 5-Spoke Alloy Turbine Blades */}
            {[0, 72, 144, 216, 288].map((rot, i) => (
              <g key={i} transform={`rotate(${rot} 160 160)`}>
                <polygon
                  points="152,160 168,160 178,55 142,55"
                  fill="url(#rimGrad)"
                  stroke="#00e5ff"
                  strokeWidth="1.5"
                />
                <line x1="160" y1="160" x2="160" y2="55" stroke="#ffffff" strokeWidth="2" opacity="0.8" />
              </g>
            ))}

            {/* Center Chrome Hub */}
            <circle cx="160" cy="160" r="28" fill="#0f172a" stroke="#00e5ff" strokeWidth="3" />
            <polygon points="160,146 172,166 148,166" fill="#00e5ff" />
          </svg>
        </div>
      </div>

      {/* Cinematic Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(2, 4, 10, 0.75) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Cyberpunk Telemetry HUD */}
      <CyberHUD
        speedKmh={speed}
        rpmRatio={rpmRatio}
        stageName="HANGAR 01 · POWER ON"
        subText={frame > 40 ? "IGNITION: SYSTEM ENGAGED" : "INITIALIZING SYSTEMS..."}
      />
    </AbsoluteFill>
  );
};
