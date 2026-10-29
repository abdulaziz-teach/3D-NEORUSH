import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, staticFile, Img } from 'remotion';

export const Shot05TitleCard: React.FC = () => {
  const frame = useCurrentFrame();

  // Local frame 0 to 150 (5.0 seconds)
  const localFrame = frame;

  // 1. Initial White Flash recovery from Shot 4 singularity
  const initialFlash = interpolate(localFrame, [0, 16], [1, 0], {
    extrapolateRight: 'clamp',
  });

  // 2. Camera slow cinematic push
  const cameraZoom = interpolate(localFrame, [0, 150], [1.0, 1.06], {
    extrapolateRight: 'clamp',
  });

  // 3. Logo & Title spring entrance
  const titleSpring = spring({
    frame: localFrame - 4,
    fps: 30,
    config: { damping: 12, stiffness: 130, mass: 0.8 },
  });
  const titleScale = interpolate(titleSpring, [0, 1], [0.82, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 4. Badges staggered entry (frames 25 to 55)
  const badgesSpring = spring({
    frame: localFrame - 25,
    fps: 30,
    config: { damping: 14, stiffness: 140 },
  });

  // 5. CTA button spring entrance (frames 45 to 75)
  const ctaSpring = spring({
    frame: localFrame - 45,
    fps: 30,
    config: { damping: 11, stiffness: 120 },
  });

  // 6. Turntable rotation of pedestal
  const turntableAngle = localFrame * 0.45;

  // 7. Pulse glow for CTA
  const ctaPulse = Math.sin(localFrame * 0.18) * 0.15 + 0.85;

  // 8. Final Fade to pure Obsidian Black (frames 132 to 150)
  const fadeToBlack = interpolate(localFrame, [130, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const badges = [
    { icon: '⚡', label: '8 BIOMES' },
    { icon: '🏎️', label: '30 CYBER CARS' },
    { icon: '🌀', label: '6 QUANTUM REALMS' },
    { icon: '🌐', label: 'ZERO INSTALL' },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#04060f',
        overflow: 'hidden',
        transform: `scale(${cameraZoom})`,
      }}
    >
      {/* Dynamic Deep Space Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(26, 12, 60, 0.7) 0%, rgba(6, 10, 24, 0.95) 60%, #03040a 100%)',
        }}
      />

      {/* Cyberpunk Grid Pedestal Floor */}
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-20%',
          right: '-20%',
          height: '60%',
          backgroundImage:
            'linear-gradient(rgba(0, 229, 255, 0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.14) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          transform: 'perspective(500px) rotateX(72deg)',
          transformOrigin: '50% 100%',
        }}
      />

      {/* Center Stage Glowing Turntable Pedestal */}
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: '50%',
          transform: `translate(-50%, -50%) rotateX(68deg) rotateZ(${turntableAngle}deg)`,
          width: 580,
          height: 580,
          borderRadius: '50%',
          border: '3px solid rgba(0, 245, 255, 0.5)',
          boxShadow: '0 0 60px rgba(0, 245, 255, 0.4), inset 0 0 50px rgba(217, 70, 239, 0.3)',
          background: 'radial-gradient(circle, rgba(0, 229, 255, 0.15) 0%, rgba(217, 70, 239, 0.08) 60%, transparent 80%)',
        }}
      >
        {/* Turntable Crosshairs & Radial Marks */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: 'rgba(0, 229, 255, 0.35)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: 'rgba(0, 229, 255, 0.35)',
          }}
        />
      </div>

      {/* Hero Showcase Cyber Sportcar Silhouette */}
      <div
        style={{
          position: 'absolute',
          top: '52%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 360,
          height: 120,
          zIndex: 10,
        }}
      >
        {/* Underbody Cyan Aura */}
        <div
          style={{
            position: 'absolute',
            bottom: -15,
            left: '15%',
            right: '15%',
            height: 35,
            background: 'radial-gradient(ellipse, #00f5ff 0%, #d946ef 55%, transparent 75%)',
            filter: 'blur(15px)',
            opacity: 0.8,
          }}
        />

        {/* Aerodynamic 3D Vector Car Profile */}
        <svg
          viewBox="0 0 360 120"
          style={{
            width: '100%',
            height: '100%',
            filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.85)) drop-shadow(0 0 20px rgba(0, 229, 255, 0.35))',
          }}
        >
          <defs>
            <linearGradient id="showcaseBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="45%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
            <linearGradient id="neonCyanStripe" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00f5ff" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="cockpitGlass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00f5ff" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#1e1b4b" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#090d18" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Low-slung Cockpit Roof */}
          <polygon
            points="90,48 140,24 235,24 285,48"
            fill="url(#cockpitGlass)"
            stroke="#00f5ff"
            strokeWidth="1.5"
          />

          {/* Aerodynamic Body Shell */}
          <polygon
            points="20,80 40,55 90,48 285,48 335,62 355,80 340,92 20,92"
            fill="url(#showcaseBodyGrad)"
            stroke="rgba(0, 245, 255, 0.6)"
            strokeWidth="2"
          />

          {/* Neon Accent Beltline */}
          <path
            d="M 25 78 L 100 74 L 260 74 L 345 78"
            fill="none"
            stroke="url(#neonCyanStripe)"
            strokeWidth="3.5"
            filter="drop-shadow(0 0 8px #00f5ff)"
          />

          {/* Carbon Fiber Splitter */}
          <rect x="15" y="90" width="330" height="6" rx="2" fill="#020617" stroke="#334155" strokeWidth="1" />

          {/* Wheel Arch & Alloy Rims (Front & Rear) */}
          {/* Front Wheel */}
          <circle cx="75" cy="88" r="22" fill="#030712" stroke="#00f5ff" strokeWidth="2.5" />
          <circle cx="75" cy="88" r="14" fill="#0f172a" stroke="#d946ef" strokeWidth="1.5" />
          <circle cx="75" cy="88" r="5" fill="#00f5ff" />

          {/* Rear Wheel */}
          <circle cx="285" cy="88" r="22" fill="#030712" stroke="#00f5ff" strokeWidth="2.5" />
          <circle cx="285" cy="88" r="14" fill="#0f172a" stroke="#d946ef" strokeWidth="1.5" />
          <circle cx="285" cy="88" r="5" fill="#00f5ff" />

          {/* Laser Headlight Projector */}
          <polygon points="340,64 355,72 342,75" fill="#00f5ff" filter="drop-shadow(0 0 10px #00f5ff)" />
          {/* Laser Taillight Edge */}
          <line x1="22" y1="70" x2="22" y2="84" stroke="#ff2fb9" strokeWidth="3" filter="drop-shadow(0 0 8px #ff2fb9)" />
        </svg>
      </div>

      {/* Main Brand Title Container */}
      <div
        style={{
          position: 'absolute',
          top: 70,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          zIndex: 20,
        }}
      >
        {/* Game Logo Emblem Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            marginBottom: 14,
            filter: 'drop-shadow(0 0 20px rgba(0, 229, 255, 0.75))',
          }}
        >
          <Img
            src={staticFile('logo.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>

        {/* Brand Display Wordmark */}
        <h1
          style={{
            fontFamily: "'Orbitron', system-ui, sans-serif",
            fontSize: 78,
            fontWeight: 900,
            letterSpacing: '0.14em',
            margin: 0,
            lineHeight: 1,
            textTransform: 'uppercase',
            background: 'linear-gradient(180deg, #ffffff 15%, #d1f7ff 50%, #00e5ff 85%, #a855f7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 35px rgba(0, 229, 255, 0.55)) drop-shadow(0 15px 40px rgba(0,0,0,0.9))',
          }}
        >
          NEORUSH
        </h1>

        {/* Subtitle / Genre Descriptor */}
        <p
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.36em',
            color: '#a5f3fc',
            margin: '12px 0 0 0',
            textTransform: 'uppercase',
            textShadow: '0 0 16px rgba(0, 229, 255, 0.7)',
          }}
        >
          HYPER-VELOCITY 3D CYBER RACER
        </p>
      </div>

      {/* Feature Pills / Badges Strip */}
      <div
        style={{
          position: 'absolute',
          bottom: 155,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          opacity: badgesSpring,
          transform: `translateY(${interpolate(badgesSpring, [0, 1], [25, 0])}px)`,
          zIndex: 20,
        }}
      >
        {badges.map((b, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 24,
              backgroundColor: 'rgba(8, 14, 30, 0.85)',
              border: '1px solid rgba(0, 229, 255, 0.35)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(0, 229, 255, 0.1)',
              fontFamily: "'Orbitron', monospace",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#e0f2fe',
            }}
          >
            <span style={{ fontSize: 15 }}>{b.icon}</span>
            <span>{b.label}</span>
          </div>
        ))}
      </div>

      {/* Call To Action Button Banner */}
      <div
        style={{
          position: 'absolute',
          bottom: 70,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: ctaSpring,
          transform: `scale(${ctaSpring})`,
          zIndex: 25,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 42px',
            borderRadius: 50,
            background: 'linear-gradient(135deg, #00f5ff 0%, #0284c7 60%, #9333ea 100%)',
            boxShadow: `0 0 ${30 * ctaPulse}px rgba(0, 245, 255, ${0.75 * ctaPulse}), 0 12px 35px rgba(0,0,0,0.8)`,
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: '0.22em',
            color: '#030712',
            textTransform: 'uppercase',
            border: '2px solid #ffffff',
          }}
        >
          <span>PLAY NOW IN BROWSER</span>
          <span style={{ fontSize: 20 }}>▶</span>
        </div>
      </div>

      {/* Initial Singularity White Flash Recovery */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#ffffff',
          opacity: initialFlash,
          pointerEvents: 'none',
          zIndex: 50,
        }}
      />

      {/* Final Cinematic Fade To Obsidian Black */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#04060f',
          opacity: fadeToBlack,
          pointerEvents: 'none',
          zIndex: 100,
        }}
      />
    </AbsoluteFill>
  );
};
