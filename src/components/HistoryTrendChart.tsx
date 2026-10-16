import React, { useState } from 'react';
import { HistoryPoint } from '../types/telemetry';

interface HistoryTrendChartProps {
  history: HistoryPoint[];
}

export const HistoryTrendChart: React.FC<HistoryTrendChartProps> = ({ history }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 600;
  const height = 220;
  const pad = { top: 20, right: 25, bottom: 32, left: 45 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const yMin = 80;
  const yMax = 100;

  const mapSpo2Y = (val: number) => {
    const clamped = Math.min(yMax, Math.max(yMin, val));
    return pad.top + innerH - ((clamped - yMin) / (yMax - yMin)) * innerH;
  };

  const mapHrvY = (val: number) => {
    // Map HRV 20ms to 80ms to same inner height
    const clamped = Math.min(80, Math.max(20, val));
    return pad.top + innerH - ((clamped - 20) / (80 - 20)) * innerH;
  };

  const thresholdY = mapSpo2Y(90);

  if (!history || history.length === 0) {
    return (
      <div className="w-full h-full min-h-[180px] flex items-center justify-center text-sm font-mono text-slate-500">
        Awaiting live telemetry stream...
      </div>
    );
  }

  const stepX = innerW / Math.max(1, history.length - 1);

  let dSpo2 = '';
  let dHrv = '';

  history.forEach((pt, i) => {
    const x = pad.left + i * stepX;
    const yS = mapSpo2Y(pt.spo2);
    const yH = mapHrvY(pt.hrv);

    if (i === 0) {
      dSpo2 += `M ${x.toFixed(1)} ${yS.toFixed(1)}`;
      dHrv += `M ${x.toFixed(1)} ${yH.toFixed(1)}`;
    } else {
      dSpo2 += ` L ${x.toFixed(1)} ${yS.toFixed(1)}`;
      dHrv += ` L ${x.toFixed(1)} ${yH.toFixed(1)}`;
    }
  });

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div className="relative w-full h-[180px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible select-none"
          role="img"
          aria-label="Recent SpO2 and HRV monitoring trend"
        >
          {/* Subtle Gridlines */}
          {[85, 90, 95, 100].map((v) => {
            const y = mapSpo2Y(v);
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

          {/* Hypoxemia 90% Threshold */}
          <line
            x1={pad.left}
            y1={thresholdY}
            x2={pad.left + innerW}
            y2={thresholdY}
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.85"
          />
          <text
            x={pad.left + innerW}
            y={thresholdY - 5}
            textAnchor="end"
            className="fill-red-400 text-[10px] font-mono font-medium"
          >
            90% Hypoxemia Threshold
          </text>

          {/* HRV Curve (Violet) */}
          <path
            d={dHrv}
            fill="none"
            stroke="#a855f7"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />

          {/* SpO2 Curve (Cyan) */}
          <path
            d={dSpo2}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Hover Markers */}
          {history.map((pt, i) => {
            const x = pad.left + i * stepX;
            const yS = mapSpo2Y(pt.spo2);
            return (
              <g
                key={i}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={x}
                  cy={yS}
                  r={hoverIndex === i ? 5 : 2.5}
                  className={`transition-all ${
                    hoverIndex === i
                      ? 'fill-white stroke-cyan-400 stroke-2'
                      : 'fill-cyan-400 opacity-60'
                  }`}
                />
              </g>
            );
          })}

          {/* Time axis marks */}
          <text x={pad.left} y={height - 8} className="fill-slate-500 text-[10px] font-mono">
            {history[0]?.time || '-2h'}
          </text>
          <text
            x={pad.left + innerW / 2}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-500 text-[10px] font-mono"
          >
            {history[Math.floor(history.length / 2)]?.time || '-1h'}
          </text>
          <text
            x={pad.left + innerW}
            y={height - 8}
            textAnchor="end"
            className="fill-slate-400 text-[10px] font-mono font-semibold"
          >
            Now
          </text>
        </svg>

        {/* Floating Value Tag on Hover */}
        {hoverIndex !== null && history[hoverIndex] && (
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700 text-xs font-mono text-slate-200 pointer-events-none shadow-lg backdrop-blur-md flex items-center gap-3"
          >
            <span>Time: {history[hoverIndex].time}</span>
            <span className="text-cyan-400 font-bold">SpO2: {history[hoverIndex].spo2}%</span>
            <span className="text-purple-400 font-bold">HRV: {history[hoverIndex].hrv}ms</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" />
          <span>SpO2 Pulse Oximetry</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7]" />
          <span>HRV Spectral (ms)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 border-b border-dashed border-red-500" />
          <span>Threshold 90%</span>
        </div>
      </div>
    </div>
  );
};
