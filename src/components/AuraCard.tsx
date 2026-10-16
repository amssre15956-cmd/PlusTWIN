import React from 'react';

interface AuraCardProps {
  children: React.ReactNode;
  className?: string;
  auraIntensity?: 'subtle' | 'standard' | 'high' | 'critical' | 'warning';
  glowColor?: 'cyan-violet' | 'critical' | 'warning' | 'emerald';
  noPadding?: boolean;
  onClick?: () => void;
}

export const AuraCard: React.FC<AuraCardProps> = ({
  children,
  className = '',
  auraIntensity = 'standard',
  glowColor = 'cyan-violet',
  noPadding = false,
  onClick,
}) => {
  // Conic gradient beam definition depending on theme
  let auraGradient =
    'conic-gradient(from 0deg, transparent 0deg, rgba(56, 189, 248, 0.8) 60deg, rgba(168, 85, 247, 0.8) 120deg, rgba(56, 189, 248, 0.4) 180deg, transparent 240deg)';

  if (glowColor === 'critical' || auraIntensity === 'critical') {
    auraGradient =
      'conic-gradient(from 0deg, transparent 0deg, rgba(239, 68, 68, 0.9) 60deg, rgba(245, 158, 11, 0.85) 120deg, rgba(239, 68, 68, 0.5) 180deg, transparent 240deg)';
  } else if (glowColor === 'warning' || auraIntensity === 'warning') {
    auraGradient =
      'conic-gradient(from 0deg, transparent 0deg, rgba(245, 158, 11, 0.9) 60deg, rgba(251, 191, 36, 0.8) 120deg, rgba(245, 158, 11, 0.4) 180deg, transparent 240deg)';
  } else if (glowColor === 'emerald') {
    auraGradient =
      'conic-gradient(from 0deg, transparent 0deg, rgba(16, 185, 129, 0.85) 60deg, rgba(52, 211, 153, 0.8) 120deg, rgba(16, 185, 129, 0.4) 180deg, transparent 240deg)';
  }

  const speedClass =
    auraIntensity === 'critical'
      ? 'animate-spin-fast'
      : auraIntensity === 'high'
      ? 'animate-spin-medium'
      : 'animate-spin-slow';

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-2xl overflow-hidden p-[1px] transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:scale-[1.008]' : ''
      } ${className}`}
    >
      {/* Moving Aura Beam layer */}
      <div
        className={`absolute -inset-[100%] ${speedClass} pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity`}
        style={{
          background: auraGradient,
        }}
      />

      {/* Internal Glassmorphism Core Plate */}
      <div
        className={`relative z-10 w-full h-full rounded-[15px] bg-[#060c18]/85 backdrop-blur-2xl border border-white/10 ${
          noPadding ? '' : 'p-5'
        } shadow-[0_12px_36px_rgba(2,6,15,0.6)] flex flex-col justify-between`}
      >
        {/* Subtle interior glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none rounded-[15px]" />
        <div className="relative z-10 w-full h-full flex flex-col">{children}</div>
      </div>
    </div>
  );
};
