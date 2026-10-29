import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, staticFile, Img } from 'remotion';
import { CyberCar3D } from '../components/CyberCar3D';
import { CyberHUD } from '../components/CyberHUD';

export const Shot09HeroPortal: React.FC = () => {
  const frame = useCurrentFrame();

  // Part 1: Frames 0 to 32 -> Quantum Portal Warp Leap (17.0s - 18.0s)
  // Part 2: Frames 30 to 90 -> Colossal NEORUSH Logo Reveal & Hero Showcase (18.0s - 20.0s)

  // Camera Shake for warp approach (frames 0 to 30)
  const warpShake = interpolate(frame, [0, 28], [2.0, 10.0], { extrapolateRight: 'clamp' });
  const shakeX = frame < 32 ? Math.sin(frame * 1.8) * warpShake : 0;
  const shakeY = frame < 32 ? Math.cos(frame * 2.1) * warpShake : 0;

  // Car leap trajectory
  const carLiftY = interpolate(frame, [0, 20, 30], [0, -35, -80], { extrapolateRight: 'clamp' });
  const carScale = interpolate(frame, [0, 20, 30], [1.22, 1.1, 0.75], { extrapolateRight: 'clamp' });
  const speed = interpolate(frame, [0, 30], [395, 480], { extrapolateRight: 'clamp' });

  // Quantum Portal Rings rotation
  const ringRot1 = (frame * 6.5) % 360;
  const ringRot2 = (-frame * 8.0) % 360;
  const portalScale = interpolate(frame, [0, 28], [0.8, 3.2], { extrapolateRight: 'clamp' });

  // Dimensional Flash at frame 28-34
  const flashOpacity = interpolate(frame, [25, 29, 36], [0, 0.95, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Showcase phase (frame 30+)
  const showcaseSpring = spring({
    frame: frame - 30,
    fps: 30,
    config: { damping: 13, stiffness: 120, mass: 0.9 },
  });
  const logoScale = interpolate(showcaseSpring, [0, 1], [0.85, 1], { extrapolateRight: 'clamp' });
  const logoOpacity = interpolate(showcaseSpring, [0, 1], [0, 1], { extrapolateRight: 'clamp' });

  // Badges staggered entry (frame 42+)
  const badgesSpring = spring({
    frame: frame - 42,
    fps: 30,
    config: { damping: 14, stiffness: 130 },
  });

  // CTA button spring (frame 52+)
  const ctaSpring = spring({
    frame: frame - 52,
    fps: 30,
    config: { damping: 12, stiffness: 120 },
  });
  const ctaPulse = Math.sin(frame * 0.22) * 0.12 + 0.88;

  // Final Cinematic Fade to Black (frames 82 to 90)
  const fadeToBlack = interpolate(frame, [82, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const badges = [
    { icon: '🌌', label: '8 DISTINCT BIOMES' },
    { icon: '🏎️', label: '30 HIGH-TECH CARS' },
    { icon: '⚡', label: '60 FPS BROWSER ENGINE' },
    { icon: '🔥', label: 'PLAY FREE NOW' },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#030208',
        overflow: 'hidden',
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* ======================================================== */}
      {/* PHASE 1: HYPERSPACE PORTAL APPROACH (FRAMES 0 TO 32)   */}
      {/* ======================================================== */}
      {frame <= 32 && (
        <AbsoluteFill>
          {/* Deep Space Warp Sky */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 50% 50%, #4c1d95 0%, #0f0728 60%, #020108 100%)',
            }}
          />

          {/* Speed Warp Streaks */}
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i * 10 * Math.PI) / 180;
            const dist = 120 + ((frame * 45 + i * 28) % 850);
            const x = 960 + Math.cos(angle) * dist;
            const y = 540 + Math.sin(angle) * dist;
            const len = 40 + (i % 4) * 35;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: len,
                  height: 3,
                  backgroundColor: i % 2 === 0 ? '#00f5ff' : '#ec4899',
                  boxShadow: `0 0 12px ${i % 2 === 0 ? '#00f5ff' : '#ec4899'}`,
                  transform: `rotate(${(angle * 180) / Math.PI}deg)`,
                  transformOrigin: '0% 50%',
                  opacity: 0.75,
                }}
              />
            );
          })}

          {/* Colossal Quantum Portal Rings */}
          <div
            style={{
              position: 'absolute',
              top: '46%',
              left: '50%',
              transform: `translate(-50%, -50%) scale(${portalScale})`,
              width: 500,
              height: 500,
              pointerEvents: 'none',
            }}
          >
            {/* Outer Hexagonal Ring */}
            <svg
              viewBox="0 0 500 500"
              style={{
                position: 'absolute',
                inset: 0,
                transform: `rotate(${ringRot1}deg)`,
                filter: 'drop-shadow(0 0 25px #00f5ff)',
              }}
            >
              <polygon
                points="250,20 450,135 450,365 250,480 50,365 50,135"
                fill="none"
                stroke="#00f5ff"
                strokeWidth="8"
              />
            </svg>

            {/* Inner Counter-Rotating Hexagon */}
            <svg
              viewBox="0 0 500 500"
              style={{
                position: 'absolute',
                inset: 0,
                transform: `rotate(${ringRot2}deg) scale(0.72)`,
                filter: 'drop-shadow(0 0 30px #d946ef)',
              }}
            >
              <polygon
                points="250,20 450,135 450,365 250,480 50,365 50,135"
                fill="none"
                stroke="#d946ef"
                strokeWidth="10"
              />
            </svg>

            {/* Portal Core Event Horizon Vortex */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: 'radial-gradient(circle, #ffffff 0%, #38bdf8 30%, #a855f7 65%, #000000 100%)',
                boxShadow: '0 0 80px #00f5ff, 0 0 140px #ec4899',
              }}
            />
          </div>

          {/* Car in Overdrive Nitro Leap */}
          <div
            style={{
              position: 'absolute',
              bottom: '12%',
              left: '50%',
              transform: `translateX(-50%) translateY(${carLiftY}px) scale(${carScale})`,
            }}
          >
            <CyberCar3D
              primaryColor="#0f172a"
              accentColor="#00f5ff"
              underglowColor="#00f5ff"
              speedKmh={speed}
              nitroActive={true}
              scale={1.22}
            />
          </div>

          {/* HUD Warning */}
          <CyberHUD
            speedKmh={Math.round(speed)}
            rpmRatio={1.0}
            stageName="EVENT HORIZON // КВАНТОВЫЙ ПОРТАЛ"
            subText="QUANTUM WARP IN PROGRESS"
            showWarning={true}
            warningText="PORTAL SINGULARITY BREACH // HOLD VELOCITY"
          />
        </AbsoluteFill>
      )}

      {/* ======================================================== */}
      {/* PHASE 2: HERO SHOWCASE & NEORUSH LOGO REVEAL (30 TO 90) */}
      {/* ======================================================== */}
      {frame >= 28 && (
        <AbsoluteFill style={{ opacity: logoOpacity }}>
          {/* Deep Cyber Void Gradient */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 50% 40%, rgba(30, 16, 70, 0.75) 0%, rgba(6, 10, 25, 0.96) 65%, #020108 100%)',
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
                'linear-gradient(rgba(0, 229, 255, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.16) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              transform: 'perspective(500px) rotateX(72deg)',
              transformOrigin: '50% 100%',
            }}
          />

          {/* Rotating Pedestal Ring */}
          <div
            style={{
              position: 'absolute',
              top: '55%',
              left: '50%',
              transform: `translate(-50%, -50%) rotateX(68deg) rotateZ(${frame * 0.5}deg)`,
              width: 580,
              height: 580,
              borderRadius: '50%',
              border: '3px solid rgba(0, 245, 255, 0.5)',
              boxShadow: '0 0 60px rgba(0, 245, 255, 0.4), inset 0 0 50px rgba(217, 70, 239, 0.3)',
              background:
                'radial-gradient(circle, rgba(0, 229, 255, 0.15) 0%, rgba(217, 70, 239, 0.08) 60%, transparent 80%)',
            }}
          />

          {/* Hero Cyber Sportscar Silhouette */}
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
            {/* Underbody Cyan Glow */}
            <div
              style={{
                position: 'absolute',
                bottom: -15,
                left: '15%',
                right: '15%',
                height: 35,
                background: 'radial-gradient(ellipse, #00f5ff 0%, #d946ef 55%, transparent 75%)',
                filter: 'blur(15px)',
                opacity: 0.85,
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
                <linearGradient id="heroBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="45%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#020617" />
                </linearGradient>
                <linearGradient id="heroCyanStripe" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00f5ff" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
                <linearGradient id="heroGlass" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00f5ff" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#1e1b4b" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#090d18" stopOpacity="0.95" />
                </linearGradient>
              </defs>

              {/* Roof */}
              <polygon points="90,48 140,24 235,24 285,48" fill="url(#heroGlass)" stroke="#00f5ff" strokeWidth="1.5" />
              {/* Body */}
              <polygon
                points="20,80 40,55 90,48 285,48 335,62 355,80 340,92 20,92"
                fill="url(#heroBodyGrad)"
                stroke="rgba(0, 245, 255, 0.6)"
                strokeWidth="2"
              />
              {/* Accent Line */}
              <path
                d="M 25 78 L 100 74 L 260 74 L 345 78"
                fill="none"
                stroke="url(#heroCyanStripe)"
                strokeWidth="3.5"
                filter="drop-shadow(0 0 8px #00f5ff)"
              />
              {/* Splitter */}
              <rect x="15" y="90" width="330" height="6" rx="2" fill="#020617" stroke="#334155" strokeWidth="1" />
              {/* Wheels */}
              <circle cx="75" cy="88" r="22" fill="#030712" stroke="#00f5ff" strokeWidth="2.5" />
              <circle cx="75" cy="88" r="14" fill="#0f172a" stroke="#d946ef" strokeWidth="1.5" />
              <circle cx="75" cy="88" r="5" fill="#00f5ff" />
              <circle cx="285" cy="88" r="22" fill="#030712" stroke="#00f5ff" strokeWidth="2.5" />
              <circle cx="285" cy="88" r="14" fill="#0f172a" stroke="#d946ef" strokeWidth="1.5" />
              <circle cx="285" cy="88" r="5" fill="#00f5ff" />
              {/* Headlight Projector */}
              <polygon points="340,64 355,72 342,75" fill="#00f5ff" filter="drop-shadow(0 0 10px #00f5ff)" />
              {/* Taillight */}
              <line x1="22" y1="70" x2="22" y2="84" stroke="#ff2fb9" strokeWidth="3" filter="drop-shadow(0 0 8px #ff2fb9)" />
            </svg>
          </div>

          {/* Brand Logo & Title Container */}
          <div
            style={{
              position: 'absolute',
              top: 65,
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `scale(${logoScale})`,
              zIndex: 20,
            }}
          >
            {/* Logo Emblem Icon */}
            <div
              style={{
                width: 72,
                height: 72,
                marginBottom: 12,
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

            {/* NEORUSH Title */}
            <h1
              style={{
                fontFamily: "'Orbitron', system-ui, sans-serif",
                fontSize: 82,
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

            {/* Subtitle */}
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

          {/* Feature Badges Strip */}
          <div
            style={{
              position: 'absolute',
              bottom: 145,
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

          {/* Call To Action Banner */}
          <div
            style={{
              position: 'absolute',
              bottom: 60,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              opacity: ctaSpring,
              transform: `translateY(${interpolate(ctaSpring, [0, 1], [20, 0])}px)`,
              zIndex: 20,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 44px',
                borderRadius: 32,
                background: 'linear-gradient(90deg, #00e5ff 0%, #3b82f6 50%, #9333ea 100%)',
                boxShadow: `0 0 ${35 * ctaPulse}px rgba(0, 229, 255, 0.8), 0 10px 30px rgba(0, 0, 0, 0.8)`,
                color: '#ffffff',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 16,
                fontWeight: 900,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              <span>ENTER THE GRID // PLAY NOW</span>
              <span style={{ fontSize: 18 }}>►</span>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Dimensional Transition Flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#ffffff',
          opacity: flashOpacity,
          pointerEvents: 'none',
          zIndex: 50,
        }}
      />

      {/* Final Fade To Black */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#000000',
          opacity: fadeToBlack,
          pointerEvents: 'none',
          zIndex: 100,
        }}
      />
    </AbsoluteFill>
  );
};
