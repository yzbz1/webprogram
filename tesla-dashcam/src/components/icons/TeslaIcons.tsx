import React from 'react';

interface IconProps {
  className?: string;
}

/** Authentic Tesla Model 3/Y silhouette icon for Bottom Dock Far-Left */
export const TeslaCarDockIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 36 22" fill="none" className={className}>
    <path
      d="M3.5 14.2C3.5 12.6 4.6 11.4 6.4 10.9L11.1 7.2C12.3 6.2 13.8 5.7 15.4 5.7H21.2C23.1 5.7 24.9 6.5 26.2 7.8L29.1 10.5C31.2 10.9 32.8 12.1 32.8 14.1V15.3C32.8 16.1 32.1 16.7 31.3 16.7H28.9C28.5 15.1 27.1 13.9 25.4 13.9C23.7 13.9 22.3 15.1 21.9 16.7H13.7C13.3 15.1 11.9 13.9 10.2 13.9C8.5 13.9 7.1 15.1 6.7 16.7H4.9C4.1 16.7 3.5 16.1 3.5 15.3V14.2Z"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinejoin="round"
    />
    <circle cx="10.2" cy="17.2" r="2.3" stroke="currentColor" strokeWidth="1.65" />
    <circle cx="25.4" cy="17.2" r="2.3" stroke="currentColor" strokeWidth="1.65" />
    <path
      d="M11.6 10.7H24.6"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      opacity="0.55"
    />
  </svg>
);

/** Authentic Tesla Dashcam Camera Icon with red recording indicator */
export const TeslaDashcamIcon: React.FC<IconProps & { recording?: boolean }> = ({
  className = 'w-6 h-6',
  recording = true,
}) => (
  <svg viewBox="0 0 28 28" fill="none" className={className}>
    <rect
      x="3"
      y="6.5"
      width="22"
      height="15"
      rx="3.5"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <circle cx="14" cy="14" r="4.2" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="14" cy="14" r="1.5" fill="currentColor" />
    {recording && <circle cx="20.8" cy="10.5" r="2.1" fill="#E31937" />}
  </svg>
);

/** Iconic Tesla Sentry Mode HAL-9000 Red Eye Icon */
export const TeslaSentryIcon: React.FC<IconProps & { active?: boolean }> = ({
  className = 'w-6 h-6',
  active = true,
}) => (
  <svg viewBox="0 0 28 28" fill="none" className={className}>
    <circle cx="14" cy="14" r="10.5" stroke="currentColor" strokeWidth="1.7" opacity="0.7" />
    <circle
      cx="14"
      cy="14"
      r="6.8"
      fill={active ? 'rgba(227, 25, 55, 0.22)' : 'rgba(150,150,150,0.18)'}
      stroke={active ? '#E31937' : 'currentColor'}
      strokeWidth="1.6"
    />
    <circle cx="14" cy="14" r="3" fill={active ? '#FF2A47' : 'currentColor'} />
    <circle cx="12.6" cy="12.5" r="1" fill="#FFFFFF" opacity="0.85" />
  </svg>
);

/** Authentic Tesla Seat Heater Icon (Seat silhouette + 3 wavy heat lines) */
export const TeslaSeatHeaterIcon: React.FC<IconProps & { level: 0 | 1 | 2 | 3; flipped?: boolean }> = ({
  className = 'w-6 h-6',
  level,
  flipped = false,
}) => {
  const heatColor =
    level === 3 ? '#E31937' : level === 2 ? '#F97316' : level === 1 ? '#F59E0B' : 'currentColor';
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      style={flipped ? { transform: 'scaleX(-1)' } : undefined}
    >
      {/* Seat backrest & cushion */}
      <path
        d="M11 8.5L13.5 18.5H20.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10.2" cy="5.8" r="1.5" fill="currentColor" />
      {/* 3 heat waves */}
      {[0, 1, 2].map((i) => {
        const active = level > i;
        return (
          <path
            key={i}
            d={`M${15.5 + i * 2.6} 14.5C${16.3 + i * 2.6} 13.5 ${14.9 + i * 2.6} 12.2 ${
              15.7 + i * 2.6
            } 11.2`}
            stroke={active ? heatColor : 'currentColor'}
            strokeWidth="1.45"
            strokeLinecap="round"
            opacity={active ? 1 : 0.25}
          />
        );
      })}
      {/* 3 level dots at bottom */}
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={12 + i * 3.5}
          cy={23}
          r={1.35}
          fill={level > i ? heatColor : 'currentColor'}
          opacity={level > i ? 1 : 0.22}
        />
      ))}
    </svg>
  );
};

/** Iconic Tesla -15s / +15s Circular Skip Button Icons */
export const Skip15BackIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <path
      d="M11.2 9.2A9.5 9.5 0 1 1 6.7 17.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M11.8 5.8L9.6 9.6L13.7 10.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <text
      x="16.2"
      y="20.2"
      textAnchor="middle"
      fill="currentColor"
      fontSize="9.2"
      fontWeight="600"
      fontFamily="Inter, sans-serif"
    >
      15
    </text>
  </svg>
);

export const Skip15ForwardIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className}>
    <path
      d="M20.8 9.2A9.5 9.5 0 1 0 25.3 17.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M20.2 5.8L22.4 9.6L18.3 10.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <text
      x="15.8"
      y="20.2"
      textAnchor="middle"
      fill="currentColor"
      fontSize="9.2"
      fontWeight="600"
      fontFamily="Inter, sans-serif"
    >
      15
    </text>
  </svg>
);

/** Tesla Battery Gauge Icon */
export const TeslaBatteryIcon: React.FC<{ percent: number; className?: string }> = ({
  percent,
  className = 'w-7 h-3.5',
}) => {
  const fillWidth = Math.max(2, Math.min(20, (percent / 100) * 20));
  const color = percent <= 20 ? '#E31937' : percent <= 35 ? '#F59E0B' : '#22C55E';
  return (
    <svg viewBox="0 0 30 14" fill="none" className={className}>
      <rect
        x="1"
        y="1.5"
        width="24"
        height="11"
        rx="2.4"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.7"
      />
      <rect x="3" y="3.5" width={fillWidth} height="7" rx="1.2" fill={color} />
      <rect x="26.2" y="4.5" width="2.2" height="5" rx="1" fill="currentColor" opacity="0.65" />
    </svg>
  );
};

/** Top-down sleek Tesla Model 3 silhouette for Camera Selector & Car Desktop */
export const TeslaTopDownCarSvg: React.FC<{
  className?: string;
  activeCamera?: string;
  sentryActive?: boolean;
  onSelectCamera?: (cam: 'front' | 'back' | 'left_repeater' | 'right_repeater') => void;
}> = ({ className = 'w-24 h-44', activeCamera, sentryActive, onSelectCamera }) => {
  const coneFill = (cam: string) =>
    activeCamera === cam ? 'rgba(62, 106, 225, 0.55)' : 'rgba(255, 255, 255, 0.12)';
  const coneStroke = (cam: string) =>
    activeCamera === cam ? '#60A5FA' : 'rgba(255, 255, 255, 0.25)';

  return (
    <svg viewBox="0 0 140 220" fill="none" className={className}>
      {/* Interactive FOV cones */}
      {onSelectCamera && (
        <>
          {/* Front FOV */}
          <path
            d="M70 50 L36 6 L104 6 Z"
            fill={coneFill('front')}
            stroke={coneStroke('front')}
            strokeWidth="1.2"
            className="cursor-pointer transition-all hover:opacity-90"
            onClick={() => onSelectCamera('front')}
          />
          {/* Rear FOV */}
          <path
            d="M70 172 L40 214 L100 214 Z"
            fill={coneFill('back')}
            stroke={coneStroke('back')}
            strokeWidth="1.2"
            className="cursor-pointer transition-all hover:opacity-90"
            onClick={() => onSelectCamera('back')}
          />
          {/* Left Repeater FOV (aimed slightly rearward just like real Tesla!) */}
          <path
            d="M44 92 L8 122 L12 170 L44 134 Z"
            fill={coneFill('left_repeater')}
            stroke={coneStroke('left_repeater')}
            strokeWidth="1.2"
            className="cursor-pointer transition-all hover:opacity-90"
            onClick={() => onSelectCamera('left_repeater')}
          />
          {/* Right Repeater FOV */}
          <path
            d="M96 92 L132 122 L128 170 L96 134 Z"
            fill={coneFill('right_repeater')}
            stroke={coneStroke('right_repeater')}
            strokeWidth="1.2"
            className="cursor-pointer transition-all hover:opacity-90"
            onClick={() => onSelectCamera('right_repeater')}
          />
        </>
      )}

      {/* Subtle ambient glow under car */}
      <ellipse
        cx="70"
        cy="112"
        rx="34"
        ry="66"
        fill={sentryActive ? 'rgba(227, 25, 55, 0.14)' : 'rgba(62, 106, 225, 0.14)'}
      />

      {/* Car Body Shell (Model 3 Highland inspired) */}
      <path
        d="M70 46C85 46 95 54 97 68L98 150C97 166 86 175 70 175C54 175 43 166 42 150L43 68C45 54 55 46 70 46Z"
        fill="url(#teslaBodyGrad)"
        stroke="rgba(255,255,255,0.38)"
        strokeWidth="1.5"
      />
      {/* Side Mirrors */}
      <path d="M43 82L34 86L35 91L43 89Z" fill="#D4D7DE" />
      <path d="M97 82L106 86L105 91L97 89Z" fill="#D4D7DE" />

      {/* Panoramic Glass Roof + Windshield + Rear Glass */}
      <path
        d="M70 67C80 67 87 72 89 83L89 144C87 154 80 159 70 159C60 159 53 154 51 144L51 83C53 72 60 67 70 67Z"
        fill="url(#teslaGlassGrad)"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1"
      />
      {/* Roof cross rib */}
      <path d="M52 104H88" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
      <path d="M52 132H88" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

      {/* Headlights */}
      <path d="M49 52C53 49 57 48.5 60 49" stroke="#E0F2FE" strokeWidth="2" strokeLinecap="round" />
      <path d="M91 52C87 49 83 48.5 80 49" stroke="#E0F2FE" strokeWidth="2" strokeLinecap="round" />

      {/* Taillights */}
      <path d="M49 170C53 172 58 173 61 172.5" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
      <path d="M91 170C87 172 82 173 79 172.5" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />

      <defs>
        <linearGradient id="teslaBodyGrad" x1="42" y1="46" x2="98" y2="175" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F3F4F6" />
          <stop offset="50%" stopColor="#B8BEC9" />
          <stop offset="100%" stopColor="#858C99" />
        </linearGradient>
        <linearGradient id="teslaGlassGrad" x1="70" y1="67" x2="70" y2="159" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="45%" stopColor="#090D16" />
          <stop offset="100%" stopColor="#172033" />
        </linearGradient>
      </defs>
    </svg>
  );
};
