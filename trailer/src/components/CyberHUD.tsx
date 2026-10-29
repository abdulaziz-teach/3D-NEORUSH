import React from 'react';

interface CyberHUDProps {
  speedKmh: number;
  rpmRatio?: number;
  stageName?: string;
  subText?: string;
  showWarning?: boolean;
  warningText?: string;
}

export const CyberHUD: React.FC<CyberHUDProps> = ({
  speedKmh,
  rpmRatio = 0.6,
  stageName = 'NEON HIGHWAY 01',
  subText = 'SYSTEM OPTIMAL',
  showWarning = false,
  warningText = 'HAZARD AHEAD',
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        padding: '36px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: "'JetBrains Mono', 'Orbitron', monospace",
        color: '#eaf6ff',
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Top-Left: Telemetry & Sector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              borderRadius: 6,
              background: 'rgba(0, 229, 255, 0.12)',
              border: '1px solid rgba(0, 229, 255, 0.4)',
              color: '#00f5ff',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.15em',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#7dff9b',
                boxShadow: '0 0 8px #7dff9b',
              }}
            />
            {stageName}
          </div>
          <span style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.1em' }}>{subText}</span>
        </div>

        {/* Top-Right: Status & Hazard Alert */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {showWarning ? (
            <div
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                background: 'rgba(255, 43, 67, 0.25)',
                border: '1px solid #ff2b43',
                color: '#ff6b81',
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.18em',
                boxShadow: '0 0 18px rgba(255, 43, 67, 0.45)',
              }}
            >
              ⚠ {warningText}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: '0.15em' }}>
              GRID: <b style={{ color: '#00e5ff' }}>ONLINE</b> · SYNC 60Hz
            </div>
          )}
        </div>
      </div>

      {/* Tactical Corner Brackets */}
      <div
        style={{
          position: 'absolute',
          top: 30,
          left: 30,
          width: 24,
          height: 24,
          borderTop: '2px solid rgba(0, 229, 255, 0.6)',
          borderLeft: '2px solid rgba(0, 229, 255, 0.6)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 30,
          right: 30,
          width: 24,
          height: 24,
          borderTop: '2px solid rgba(0, 229, 255, 0.6)',
          borderRight: '2px solid rgba(0, 229, 255, 0.6)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          left: 30,
          width: 24,
          height: 24,
          borderBottom: '2px solid rgba(0, 229, 255, 0.6)',
          borderLeft: '2px solid rgba(0, 229, 255, 0.6)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          right: 30,
          width: 24,
          height: 24,
          borderBottom: '2px solid rgba(0, 229, 255, 0.6)',
          borderRight: '2px solid rgba(0, 229, 255, 0.6)',
        }}
      />

      {/* Bottom Row: Speedometer & RPM Gauge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        {/* Bottom-Left: RPM Energy Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.15em' }}>PLASMA DRIVE RPM</div>
          <div
            style={{
              width: 180,
              height: 8,
              background: 'rgba(10, 16, 32, 0.85)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, rpmRatio * 100))}%`,
                height: '100%',
                background:
                  rpmRatio > 0.85
                    ? 'linear-gradient(90deg, #00e5ff, #ffd166, #ff2b43)'
                    : 'linear-gradient(90deg, #00e5ff, #7dff9b)',
                boxShadow: '0 0 12px rgba(0, 229, 255, 0.8)',
              }}
            />
          </div>
        </div>

        {/* Bottom-Right: Speedometer Digits */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6 }}>
            <span
              style={{
                fontSize: 64,
                fontWeight: 900,
                lineHeight: 1,
                color: '#ffffff',
                textShadow: '0 0 24px rgba(0, 229, 255, 0.75)',
              }}
            >
              {Math.round(speedKmh)}
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#00e5ff', letterSpacing: '0.1em' }}>
              KM/H
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
