import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from 'remotion';
import { CyberHUD } from '../components/CyberHUD';

export const Shot04PortalLeap: React.FC = () => {
  const frame = useCurrentFrame();

  // Local frame 0 to 180 (6 seconds)
  const localFrame = frame;

  // Camera shake intensifies as the car nears the quantum singularity
  const cameraShake = interpolate(localFrame, [0, 130, 175], [1.5, 4.5, 12.0], {
    extrapolateRight: 'clamp',
  });
  const shakeX = Math.sin(localFrame * 1.6) * cameraShake;
  const shakeY = Math.cos(localFrame * 1.9) * cameraShake;

  // Camera focal length warp push
  const cameraScale = interpolate(localFrame, [0, 140, 178], [1.02, 1.25, 2.4], {
    extrapolateRight: 'clamp',
  });

  // Dimensional Flash at moment of leap (frames 155 to 180)
  const flashOpacity = interpolate(localFrame, [150, 168, 180], [0, 0.95, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Speedometer progression (295 km/h accelerating past the sound barrier to 380 km/h)
  const speed = interpolate(localFrame, [0, 120, 175], [298, 335, 384], {
    extrapolateRight: 'clamp',
  });

  // Road animation at hyper-velocity
  const roadDashOffset = (localFrame * 52) % 120;

  // Car position: steer back into Center Lane for the portal jump
  const laneAlign = spring({
    frame: localFrame - 10,
    fps: 30,
    config: { damping: 14, stiffness: 120, mass: 0.9 },
  });
  // Starts from Left Lane (-240px) from Shot 3, slides smoothly into Center Lane (0px)
  const carX = interpolate(laneAlign, [0, 1], [-240, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const carRoll = interpolate(laneAlign, [0, 0.5, 1], [-6, 3, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Car leap: as portal approaches (frame 120+), car lifts off the asphalt
  const carLiftY = interpolate(localFrame, [115, 150, 175], [0, -45, -90], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const carPerspectiveScale = interpolate(localFrame, [115, 160, 178], [1, 0.92, 0.65], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Portal Vortex ring rotation angles
  const ringRot1 = (localFrame * 4.2) % 360;
  const ringRot2 = (-localFrame * 5.8) % 360;
  const ringRot3 = (localFrame * 7.5) % 360;

  // Portal scale grows as we approach
  const portalScale = interpolate(localFrame, [0, 80, 165], [0.35, 0.75, 2.6], {
    extrapolateRight: 'clamp',
  });
  const portalOpacity = interpolate(localFrame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#040612',
        overflow: 'hidden',
        transform: `scale(${cameraScale}) translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* 1. Hyper-Space Warp Sky Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #09021a 0%, #170732 40%, #2f0854 70%, #060818 100%)',
        }}
      />

      {/* 2. Quantum Tunnel Speed Streaks */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 48%, rgba(0, 245, 255, 0.22) 0%, rgba(217, 70, 239, 0.18) 40%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Distant Cyber City Pillars on the event horizon */}
      <div
        style={{
          position: 'absolute',
          bottom: '50%',
          left: 0,
          right: 0,
          height: 180,
          display: 'flex',
          justifyContent: 'space-around',
          opacity: 0.45,
          filter: 'blur(1px)',
        }}
      >
        {[60, 120, 80, 140, 95, 160, 110, 75, 130, 90].map((h, i) => (
          <div
            key={i}
            style={{
              width: 32 + (i % 3) * 16,
              height: h,
              background: 'linear-gradient(180deg, #00e5ff 0%, #150930 90%)',
              borderTop: '2px solid #00e5ff',
              boxShadow: '0 0 15px rgba(0, 229, 255, 0.4)',
            }}
          />
        ))}
      </div>

      {/* 3. 3-Lane Highway with Quantum Grid */}
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
            background: 'linear-gradient(180deg, #081024 0%, #101835 100%)',
            borderLeft: '16px solid #00f5ff',
            borderRight: '16px solid #00f5ff',
            boxShadow: '0 0 60px #00f5ff, inset 0 0 40px rgba(217, 70, 239, 0.3)',
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
                'repeating-linear-gradient(180deg, #00e5ff 0px, #00e5ff 50px, transparent 50px, transparent 110px)',
              backgroundPosition: `0px ${roadDashOffset * 2.2}px`,
              filter: 'drop-shadow(0 0 12px #00e5ff)',
            }}
          />

          {/* Lane Divider 2 */}
          <div
            style={{
              position: 'absolute',
              right: '33.3%',
              top: 0,
              bottom: 0,
              width: 8,
              backgroundImage:
                'repeating-linear-gradient(180deg, #00e5ff 0px, #00e5ff 50px, transparent 50px, transparent 110px)',
              backgroundPosition: `0px ${roadDashOffset * 2.2}px`,
              filter: 'drop-shadow(0 0 12px #00e5ff)',
            }}
          />

          {/* Center Lane Quantum Runway Glow */}
          <div
            style={{
              position: 'absolute',
              left: '34%',
              right: '34%',
              top: 0,
              bottom: 0,
              background: 'linear-gradient(180deg, rgba(217, 70, 239, 0.35) 0%, rgba(0, 245, 255, 0.15) 100%)',
              borderLeft: '2px solid rgba(217, 70, 239, 0.7)',
              borderRight: '2px solid rgba(217, 70, 239, 0.7)',
            }}
          />
        </div>
      </div>

      {/* 4. QUANTUM PORTAL ARCHWAY & SINGULARITY (Center Lane Horizon) */}
      <div
        style={{
          position: 'absolute',
          top: '46%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${portalScale})`,
          transformOrigin: 'center center',
          width: 440,
          height: 440,
          opacity: portalOpacity,
          pointerEvents: 'none',
        }}
      >
        {/* Holographic Dimensional Portal HUD Banner */}
        <div
          style={{
            position: 'absolute',
            top: -65,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(8, 12, 28, 0.92)',
            border: '2px solid #00f5ff',
            borderRadius: 8,
            padding: '6px 20px',
            color: '#00f5ff',
            fontFamily: "'Orbitron', monospace",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: '0.22em',
            whiteSpace: 'nowrap',
            boxShadow: '0 0 25px rgba(0, 245, 255, 0.6), inset 0 0 10px rgba(217, 70, 239, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18, color: '#d946ef' }}>🌀</span>
          <span>QUANTUM REALM // MULTIPLIER ×2.0</span>
          <span style={{ fontSize: 14, color: '#facc15' }}>⚡</span>
        </div>

        {/* Outer Hexagonal Transit Arch */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: '8px solid #00f5ff',
            borderRadius: '50%',
            boxShadow: '0 0 50px #00f5ff, inset 0 0 40px #00f5ff',
            transform: `rotate(${ringRot1}deg)`,
            borderStyle: 'dashed',
          }}
        />

        {/* Mid Energy Ring */}
        <div
          style={{
            position: 'absolute',
            inset: 35,
            border: '6px solid #d946ef',
            borderRadius: '50%',
            boxShadow: '0 0 40px #d946ef, inset 0 0 30px #d946ef',
            transform: `rotate(${ringRot2}deg)`,
            borderStyle: 'dotted',
          }}
        />

        {/* Inner Singularity Vortex Ring */}
        <div
          style={{
            position: 'absolute',
            inset: 70,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #ffffff 0%, #00f5ff 35%, #d946ef 70%, #040612 100%)',
            boxShadow: '0 0 80px #00f5ff, 0 0 120px #d946ef',
            transform: `rotate(${ringRot3}deg)`,
          }}
        />

        {/* Radiant Core Flare */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 140,
            height: 140,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: '0 0 60px #ffffff, 0 0 100px #00f5ff, 0 0 160px #d946ef',
          }}
        />

        {/* Vertical Quantum Ejection Beams */}
        <div
          style={{
            position: 'absolute',
            top: '-200%',
            bottom: '-200%',
            left: '50%',
            width: 8,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, transparent, #ffffff, #00f5ff, transparent)',
            boxShadow: '0 0 30px #00f5ff',
          }}
        />
      </div>

      {/* 5. HERO CYBER SPORTCAR — Dynamic Leap towards Singularity */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: '50%',
          transform: `translateX(calc(-50% + ${carX}px)) translateY(${carLiftY}px) scale(${carPerspectiveScale}) rotate(${carRoll}deg)`,
          width: 320,
          height: 145,
          zIndex: 40,
        }}
      >
        {/* Plasma Thruster Exhaust Trails */}
        <div
          style={{
            position: 'absolute',
            bottom: -25,
            left: '26%',
            width: 24,
            height: 90,
            background: 'linear-gradient(180deg, #ffffff 0%, #00e5ff 40%, transparent 100%)',
            borderRadius: '0 0 12px 12px',
            filter: 'blur(3px)',
            boxShadow: '0 0 25px #00e5ff',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -25,
            right: '26%',
            width: 24,
            height: 90,
            background: 'linear-gradient(180deg, #ffffff 0%, #00e5ff 40%, transparent 100%)',
            borderRadius: '0 0 12px 12px',
            filter: 'blur(3px)',
            boxShadow: '0 0 25px #00e5ff',
          }}
        />

        {/* Chassis Body Rear Silhouette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, #101524 0%, #080b15 65%, #05060d 100%)',
            borderRadius: '16px 16px 8px 8px',
            border: '2px solid rgba(0, 229, 255, 0.45)',
            boxShadow: '0 0 35px rgba(0, 229, 255, 0.35)',
            clipPath: 'polygon(15% 0%, 85% 0%, 100% 75%, 92% 100%, 8% 100%, 0% 75%)',
          }}
        />

        {/* Aerodynamic Carbon Spoiler Wing */}
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: '10%',
            right: '10%',
            height: 12,
            background: '#0d1322',
            border: '1.5px solid #00e5ff',
            boxShadow: '0 0 15px #00e5ff',
            borderRadius: 4,
          }}
        />

        {/* Full-Width Neon Cyber Taillight Blade */}
        <div
          style={{
            position: 'absolute',
            top: 42,
            left: '12%',
            right: '12%',
            height: 8,
            backgroundColor: '#00e5ff',
            borderRadius: 4,
            boxShadow: '0 0 25px #00e5ff, 0 0 45px #00e5ff',
          }}
        />

        {/* Titanium Exhaust Ports */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: '24%',
            width: 28,
            height: 18,
            border: '2px solid #00e5ff',
            borderRadius: 4,
            backgroundColor: '#050a16',
            boxShadow: '0 0 18px #00e5ff',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: '24%',
            width: 28,
            height: 18,
            border: '2px solid #00e5ff',
            borderRadius: 4,
            backgroundColor: '#050a16',
            boxShadow: '0 0 18px #00e5ff',
          }}
        />

        {/* Ground Underglow Halo */}
        <div
          style={{
            position: 'absolute',
            bottom: -30,
            left: '10%',
            right: '10%',
            height: 50,
            background: 'radial-gradient(ellipse, #00f5ff 0%, #d946ef 50%, transparent 75%)',
            filter: 'blur(16px)',
            opacity: 0.85,
          }}
        />
      </div>

      {/* 6. TELEMETRY HUD OVERLAY */}
      <CyberHUD
        speedKmh={speed}
        rpmRatio={0.98}
        stageName="SECTOR 04 · QUANTUM GATEWAY"
        subText="DIMENSIONAL SINGULARITY // 380 KM/H"
      />

      {/* 7. CINEMATIC DIMENSIONAL WARP FLASH (Transitions into Shot 5) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#ffffff',
          opacity: flashOpacity,
          zIndex: 100,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
