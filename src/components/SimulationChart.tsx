import React from 'react';

interface SimulationChartProps {
  projectedSpo2: number[] | null;
  intervention: string | null;
}

export const SimulationChart: React.FC<SimulationChartProps> = ({
  projectedSpo2,
  intervention,
}) => {
  const width = 600;
  const height = 220;
  const pad = { top: 20, right: 30, bottom: 32, left: 45 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const yMin = 80;
  const yMax = 100;

  const mapY = (val: number) => {
    const clamped = Math.min(yMax, Math.max(yMin, val));
    return pad.top + innerH - ((clamped - yMin) / (yMax - yMin)) * innerH;
  };

  const threshY = mapY(90);

  if (!projectedSpo2 || projectedSpo2.length === 0) {
    return (
      <div className="w-full h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <p className="text-sm font-medium text-slate-300 mb-1">No Active What-If Projection</p>
        <p className="text-xs text-slate-500 max-w-sm">
          Select an intervention from an active alert or trigger supplemental O2 / bronchodilator to project 30-minute oxygenation trajectory.
        </p>
      </div>
    );
  }

  const stepX = innerW / Math.max(1, projectedSpo2.length - 1);
  let dPath = '';

  projectedSpo2.forEach((v, i) => {
    const x = pad.left + i * stepX;
    const y = mapY(v);
    if (i === 0) dPath += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    else dPath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div className="relative w-full h-[180px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible select-none"
          role="img"
          aria-label="Projected SpO2 trajectory over the next 30 minutes"
        >
          {/* Danger zone fill under 90% */}
          <rect
            x={pad.left}
            y={threshY}
            width={innerW}
            height={height - pad.bottom - threshY}
            fill="rgba(239, 68, 68, 0.08)"
          />

          {/* Gridlines */}
          {[85, 90, 95, 100].map((v) => {
            const y = mapY(v);
            return (
              <g key={v}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + innerW}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  {v}%
                </text>
              </g>
            );
          })}

          {/* Threshold line */}
          <line
            x1={pad.left}
            y1={threshY}
            x2={pad.left + innerW}
            y2={threshY}
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.85"
          />

          {/* Projected Path */}
          <path
            d={dPath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3.0"
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Projected Marker Points */}
          {projectedSpo2.map((val, i) => {
            const x = pad.left + i * stepX;
            const y = mapY(val);
            const isSafe = val >= 90;

            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill={isSafe ? '#38bdf8' : '#ef4444'}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="shadow-md"
                />
                <text
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  className={`text-[11px] font-mono font-bold ${
                    isSafe ? 'fill-cyan-300' : 'fill-red-400'
                  }`}
                >
                  {val.toFixed(1)}%
                </text>
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  +{ (i + 1) * 5 }m
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
        <span className="text-cyan-300">
          Modeled Action: <strong className="text-white capitalize">{intervention ? intervention.replace('_', ' ') : 'Standard Support'}</strong>
        </span>
        <span className="text-slate-400">
          Target 30m: <strong className="text-emerald-400 font-bold">{projectedSpo2[projectedSpo2.length - 1]}%</strong>
        </span>
      </div>
    </div>
  );
};
