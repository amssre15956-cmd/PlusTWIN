import React from 'react';
import { ModelMetrics } from '../types/telemetry';

interface EvaluationMetricsPanelProps {
  metrics: ModelMetrics;
}

export const EvaluationMetricsPanel: React.FC<EvaluationMetricsPanelProps> = ({ metrics }) => {
  return (
    <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6">
      {/* 6 Core ML KPIs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 w-full md:flex-1">
        <div className="flex flex-col">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">ROC-AUC</span>
          <span className="text-xl font-bold font-mono text-cyan-300">
            {metrics.roc_auc.toFixed(3)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Brier Score</span>
          <span className="text-xl font-bold font-mono text-slate-200">
            {metrics.brier_score.toFixed(3)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Precision</span>
          <span className="text-xl font-bold font-mono text-emerald-400">
            {metrics.precision.toFixed(3)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Recall</span>
          <span className="text-xl font-bold font-mono text-cyan-400">
            {metrics.recall.toFixed(3)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">F1 Score</span>
          <span className="text-xl font-bold font-mono text-purple-300">
            {metrics.f1.toFixed(3)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Missed</span>
          <span className="text-xl font-bold font-mono text-amber-400">
            {metrics.missed_events}
          </span>
        </div>
      </div>

      {/* Warning Lead Time */}
      <div className="flex flex-col border-t md:border-t-0 md:border-l border-slate-700/60 pt-3 md:pt-0 md:pl-6 min-w-[190px]">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
          Warning Lead Time
        </span>
        <div className="text-sm font-mono text-white flex items-baseline gap-2 mt-0.5">
          <span className="text-lg font-bold text-cyan-400">
            {metrics.lead_time_mins_median.toFixed(0)}m median
          </span>
          <span className="text-[11px] text-slate-400">
            (p25: {metrics.lead_time_mins_p25}m)
          </span>
        </div>
      </div>

      {/* 2x2 Confusion Matrix */}
      <div className="flex flex-col border-t md:border-t-0 md:border-l border-slate-700/60 pt-3 md:pt-0 md:pl-6 min-w-[210px]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Confusion Matrix
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
            {metrics.calibration_type}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[11px] font-mono bg-slate-950/70 p-2 rounded-lg border border-slate-800">
          <div className="flex justify-between px-1">
            <span className="text-slate-500">TN:</span>
            <span className="text-slate-200 font-semibold">{metrics.confusion_matrix[0][0]}</span>
          </div>
          <div className="flex justify-between px-1">
            <span className="text-slate-500">FP:</span>
            <span className="text-amber-400 font-semibold">{metrics.confusion_matrix[0][1]}</span>
          </div>
          <div className="flex justify-between px-1">
            <span className="text-slate-500">FN:</span>
            <span className="text-red-400 font-semibold">{metrics.confusion_matrix[1][0]}</span>
          </div>
          <div className="flex justify-between px-1">
            <span className="text-slate-500">TP:</span>
            <span className="text-emerald-400 font-semibold">{metrics.confusion_matrix[1][1]}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
