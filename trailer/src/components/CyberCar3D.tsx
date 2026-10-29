import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export interface CyberCar3DProps {
  primaryColor?: string;
  accentColor?: string;
  underglowColor?: string;
  driftAngleDeg?: number;
  scale?: number;
  viewAngle?: 'rear' | 'low-rear' | 'side-rear' | 'front-3q';
  speedKmh?: number;
  nitroActive?: boolean;
  headlightsOn?: boolean;
}

export const CyberCar3D: React.FC<CyberCar3DProps> = ({
  primaryColor = '#0f172a',
  accentColor = '#00e5ff',
  underglowColor = '#00e5ff',
  driftAngleDeg = 0,
  scale = 1.0,
  viewAngle = 'low-rear',
  speedKmh = 180,
  nitroActive = false,
  headlightsOn = true,
}) => {
  const frame = useCurrentFrame();

  // Natural high-speed chassis micro-vibration
  const vibrationY = Math.sin(frame * 1.8) * 1.2;
  const vibrationRot = Math.cos(frame * 1.5) * 0.25;

  // Suspension squat and roll
  const suspensionSquat = interpolate(speedKmh, [0, 350], [0, 4], { extrapolateRight: 'clamp' });
  const rollAngle = driftAngleDeg * 0.35 + vibrationRot;

  // Dynamic wheel spin angle
  const wheelSpin = (frame * (speedKmh * 0.18)) % 360;

  // Exhaust afterburner flicker
  const exhaustFlicker = Math.sin(frame * 2.2) * 0.15 + 0.85;
  const exhaustLength = nitroActive ? 140 * exhaustFlicker : 65 * exhaustFlicker;

  return (
    <div
      style={{
        position: 'relative',
        width: 640 * scale,
        height: 320 * scale,
        transform: `translateY(${vibrationY + suspensionSquat}px) rotate(${rollAngle}deg) skewX(${driftAngleDeg * 0.2}deg)`,
        transformOrigin: '50% 85%',
        filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.85))',
      }}
    >
      {/* 1. UNDERGLOW GROUND ILLUMINATION */}
      <div
        style={{
          position: 'absolute',
          bottom: 25 * scale,
          left: '10%',
          right: '10%',
          height: 90 * scale,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${underglowColor} 0%, ${accentColor}44 40%, transparent 75%)`,
          filter: 'blur(22px)',
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      />

      {/* 2. DUAL EXHAUST AFTERBURNERS (LOW REAR) */}
      <div
        style={{
          position: 'absolute',
          bottom: 74 * scale,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 220 * scale,
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 40px',
          zIndex: 1,
        }}
      >
        {/* Left Exhaust Plume */}
        <div style={{ position: 'relative', width: 28 * scale, height: exhaustLength * scale }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: (nitroActive ? 32 : 18) * scale,
              height: exhaustLength * scale,
              borderRadius: '50% 50% 20% 20%',
              background: nitroActive
                ? 'linear-gradient(180deg, #ffffff 0%, #00f5ff 35%, #a855f7 70%, transparent 100%)'
                : 'linear-gradient(180deg, #ffffff 0%, #ff6b35 30%, #ff2b43 70%, transparent 100%)',
              filter: `blur(${nitroActive ? 6 : 4}px)`,
              opacity: exhaustFlicker,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 8 * scale,
              height: (exhaustLength * 0.55) * scale,
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              boxShadow: `0 0 16px ${nitroActive ? '#00f5ff' : '#ff9f1c'}`,
            }}
          />
        </div>

        {/* Right Exhaust Plume */}
        <div style={{ position: 'relative', width: 28 * scale, height: exhaustLength * scale }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: (nitroActive ? 32 : 18) * scale,
              height: exhaustLength * scale,
              borderRadius: '50% 50% 20% 20%',
              background: nitroActive
                ? 'linear-gradient(180deg, #ffffff 0%, #00f5ff 35%, #a855f7 70%, transparent 100%)'
                : 'linear-gradient(180deg, #ffffff 0%, #ff6b35 30%, #ff2b43 70%, transparent 100%)',
              filter: `blur(${nitroActive ? 6 : 4}px)`,
              opacity: exhaustFlicker,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 8 * scale,
              height: (exhaustLength * 0.55) * scale,
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              boxShadow: `0 0 16px ${nitroActive ? '#00f5ff' : '#ff9f1c'}`,
            }}
          />
        </div>
      </div>

      {/* 3. DETAILED 3D SPORTS CAR REAR CHASSIS (SVG VECTOR MESH) */}
      <svg
        viewBox="0 0 640 320"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          zIndex: 2,
          position: 'relative',
        }}
      >
        <defs>
          {/* Carbon body gradient */}
          <linearGradient id={`carBody-${primaryColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#252f44" />
            <stop offset="25%" stopColor={primaryColor} />
            <stop offset="70%" stopColor="#080c16" />
            <stop offset="100%" stopColor="#020408" />
          </linearGradient>

          {/* Roof glass gradient */}
          <linearGradient id="canopyGlass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#0f172a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#020617" stopOpacity="1" />
          </linearGradient>

          {/* Diffuser carbon gradient */}
          <linearGradient id="diffuserGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          {/* Specular highlight curve */}
          <linearGradient id="specularGleam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* --- REAR WHEEL TIRES (WIDE TIRES) --- */}
        {/* Left Wheel */}
        <rect x="70" y="170" width="75" height="115" rx="16" fill="#050810" stroke="#1e293b" strokeWidth="3" />
        {/* Left Rim */}
        <ellipse cx="107" cy="227" rx="28" ry="46" fill="#0b1120" stroke={accentColor} strokeWidth="3.5" />
        <ellipse cx="107" cy="227" rx="14" ry="24" fill="#020617" stroke="#94a3b8" strokeWidth="2" />
        {/* Rim Spokes */}
        <line x1="107" y1="185" x2="107" y2="269" stroke={accentColor} strokeWidth="2" strokeDasharray="6 4" />
        <line x1="82" y1="227" x2="132" y2="227" stroke={accentColor} strokeWidth="2" strokeDasharray="6 4" />

        {/* Right Wheel */}
        <rect x="495" y="170" width="75" height="115" rx="16" fill="#050810" stroke="#1e293b" strokeWidth="3" />
        {/* Right Rim */}
        <ellipse cx="533" cy="227" rx="28" ry="46" fill="#0b1120" stroke={accentColor} strokeWidth="3.5" />
        <ellipse cx="533" cy="227" rx="14" ry="24" fill="#020617" stroke="#94a3b8" strokeWidth="2" />
        {/* Rim Spokes */}
        <line x1="533" y1="185" x2="533" y2="269" stroke={accentColor} strokeWidth="2" strokeDasharray="6 4" />
        <line x1="508" y1="227" x2="558" y2="227" stroke={accentColor} strokeWidth="2" strokeDasharray="6 4" />

        {/* --- WIDEBODY REAR FENDERS & LOWER BUMPER --- */}
        <path
          d="M 60,240 L 90,170 L 170,140 L 470,140 L 550,170 L 580,240 L 560,265 L 490,260 L 460,278 L 180,278 L 150,260 L 80,265 Z"
          fill={`url(#carBody-${primaryColor})`}
          stroke="#334155"
          strokeWidth="2.5"
        />

        {/* --- REAR AERODYNAMIC DIFFUSER TUNNEL --- */}
        <path
          d="M 180,250 L 460,250 L 450,285 L 190,285 Z"
          fill="url(#diffuserGrad)"
          stroke="#0f172a"
          strokeWidth="2"
        />
        {/* Diffuser vertical fins */}
        <line x1="230" y1="250" x2="225" y2="285" stroke={accentColor} strokeWidth="3" />
        <line x1="280" y1="250" x2="277" y2="285" stroke="#475569" strokeWidth="2" />
        <line x1="320" y1="250" x2="320" y2="285" stroke={accentColor} strokeWidth="4" />
        <line x1="360" y1="250" x2="363" y2="285" stroke="#475569" strokeWidth="2" />
        <line x1="410" y1="250" x2="415" y2="285" stroke={accentColor} strokeWidth="3" />

        {/* --- DUAL EXHAUST TIPS (TITANIUM CHROME RINGS) --- */}
        <ellipse cx="255" cy="242" rx="18" ry="11" fill="#020617" stroke="#e2e8f0" strokeWidth="3" />
        <ellipse cx="255" cy="242" rx="14" ry="8" fill="#000" stroke={accentColor} strokeWidth="2" />
        <ellipse cx="385" cy="242" rx="18" ry="11" fill="#020617" stroke="#e2e8f0" strokeWidth="3" />
        <ellipse cx="385" cy="242" rx="14" ry="8" fill="#000" stroke={accentColor} strokeWidth="2" />

        {/* --- CABIN COCKPIT CANOPY (AERODYNAMIC TEARDROP) --- */}
        <path
          d="M 195,140 L 225,65 L 415,65 L 445,140 Z"
          fill="url(#canopyGlass)"
          stroke="#1e293b"
          strokeWidth="2"
        />
        {/* Cockpit rear window defroster grid lines */}
        <line x1="238" y1="85" x2="402" y2="85" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" />
        <line x1="230" y1="105" x2="410" y2="105" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" />
        <line x1="220" y1="125" x2="420" y2="125" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" />

        {/* Canopy center spine ridge */}
        <line x1="320" y1="65" x2="320" y2="140" stroke={accentColor} strokeWidth="2" strokeOpacity="0.8" />

        {/* --- HIGH-LEVEL GT WING / CYBER SPOILER --- */}
        {/* Left Stanchion */}
        <polygon points="180,140 190,140 185,92 175,92" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
        {/* Right Stanchion */}
        <polygon points="450,140 460,140 465,92 455,92" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
        {/* Carbon Wing Blade */}
        <path
          d="M 120,92 L 140,84 L 500,84 L 520,92 L 515,98 L 490,92 L 150,92 L 125,98 Z"
          fill="#050812"
          stroke={accentColor}
          strokeWidth="2.5"
        />
        {/* Wing Endplates */}
        <polygon points="116,74 135,74 128,108 108,108" fill="#0f172a" stroke={accentColor} strokeWidth="2" />
        <polygon points="505,74 524,74 532,108 512,108" fill="#0f172a" stroke={accentColor} strokeWidth="2" />

        {/* --- CONTINUOUS CYBER TAILLIGHT LED STRIP (NEON LIGHTBAR) --- */}
        <path
          d="M 140,162 L 200,154 L 320,154 L 440,154 L 500,162 L 495,170 L 435,163 L 320,163 L 205,163 L 145,170 Z"
          fill="#ff2b43"
          stroke="#ff6b81"
          strokeWidth="2"
          filter="drop-shadow(0 0 14px #ff2b43)"
        />
        {/* Inner bright laser core */}
        <path
          d="M 148,165 L 202,158 L 320,158 L 438,158 L 492,165"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
        />

        {/* --- METALLIC BODY SPECULAR GLEAMS --- */}
        <path
          d="M 175,142 L 320,142 L 465,142"
          fill="none"
          stroke="url(#specularGleam)"
          strokeWidth="3.5"
        />
        <path
          d="M 95,173 L 170,144"
          fill="none"
          stroke="url(#specularGleam)"
          strokeWidth="2"
        />
        <path
          d="M 545,173 L 470,144"
          fill="none"
          stroke="url(#specularGleam)"
          strokeWidth="2"
        />

        {/* Cyber Trim Accents on rear bumper */}
        <line x1="160" y1="205" x2="220" y2="205" stroke={accentColor} strokeWidth="2.5" strokeOpacity="0.85" />
        <line x1="420" y1="205" x2="480" y2="205" stroke={accentColor} strokeWidth="2.5" strokeOpacity="0.85" />
      </svg>
    </div>
  );
};
