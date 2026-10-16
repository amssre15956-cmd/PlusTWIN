import React, { ReactNode } from 'react';

interface Web3AuraCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose';
  intensity?: 'subtle' | 'vibrant' | 'critical';
  title?: ReactNode;
  badge?: ReactNode;
  id?: string;
}

export const Web3AuraCard: React.FC<Web3AuraCardProps> = ({
  children,
  className = '',
  glowColor = 'cyan',
  intensity = 'subtle',
  title,
  badge,
  id
}) => {
  const colorGradients = {
    cyan: 'from-cyan-500/20 via-sky-400/40 to-blue-600/10',
    violet: 'from-purple-500/20 via-violet-400/40 to-indigo-600/10',
    emerald: 'from-emerald-500/20 via-teal-400/40 to-green-600/10',
    amber: 'from-amber-500/20 via-orange-400/40 to-yellow-600/10',
    rose: 'from-rose-500/25 via-red-500/40 to-pink-600/15'
  };

  const auraBeamGradients = {
    cyan: '#38bdf8, #818cf8, #06b6d4',
    violet: '#a855f7, #ec4899, #6366f1',
    emerald: '#10b981, #06b6d4, #34d399',
    amber: '#f59e0b, #fbbf24, #f97316',
    rose: '#f43f5e, #ef4444, #e11d48'
  };

  return (
    <div
      id={id}
      className={`relative group rounded-2xl bg-gradient-to-b from-slate-900/75 to-slate-950/85 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 hover:border-white/20 ${className}`}
      style={{
        '--aura-color': auraBeamGradients[glowColor]
      } as React.CSSProperties}
    >
      {/* Animated Aura Beam that sweeps around the component perimeter */}
      <div
        className="pointer-events-none absolute -inset-[1px] rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 aura-beam-wrapper"
        aria-hidden="true"
      />

      {/* Ambient background soft glow */}
      <div
        className={`pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r ${colorGradients[glowColor]} opacity-25 blur-xl group-hover:opacity-45 transition-opacity duration-500`}
        aria-hidden="true"
      />

      {/* Card Content Container */}
      <div className="relative z-10 p-5 h-full flex flex-col">
        {(title || badge) && (
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
            {typeof title === 'string' ? (
              <h3 className="text-sm font-semibold tracking-wide text-slate-100 uppercase flex items-center gap-2">
                {title}
              </h3>
            ) : (
              title
            )}
            {badge}
          </div>
        )}
        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    </div>
  );
};
