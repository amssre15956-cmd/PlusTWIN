import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PatientId,
  MonitoringStatusResponse,
  HistoryPoint,
  AnatomicalLayer,
  InterventionType,
  AlertAction,
} from './types/telemetry';
import {
  fetchPatientStatus,
  executeAlertAction,
  generateSeedHistory,
  GLOBAL_DEFAULT_METRICS,
} from './logic/telemetryService';
import { AnatomySimulation3D } from './components/AnatomySimulation3D';
import { AuraCard } from './components/AuraCard';
import { HistoryTrendChart } from './components/HistoryTrendChart';
import { SimulationChart } from './components/SimulationChart';
import { EvaluationMetricsPanel } from './components/EvaluationMetricsPanel';
import {
  Activity,
  HeartPulse,
  AlertTriangle,
  ShieldCheck,
  Zap,
  TrendingDown,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Syringe,
  Wind,
  Info,
} from 'lucide-react';

export default function App() {
  const [patientId, setPatientId] = useState<PatientId>('patient_b');
  const [activeLayer, setActiveLayer] = useState<AnatomicalLayer>('all');
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Clinical Telemetry State
  const [telemetry, setTelemetry] = useState<MonitoringStatusResponse | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [projectedSpo2, setProjectedSpo2] = useState<number[] | null>([
    88.5, 90.0, 91.5, 93.0, 94.5, 96.0,
  ]);
  const [selectedIntervention, setSelectedIntervention] = useState<InterventionType>('administer_o2');
  const [pendingAction, setPendingAction] = useState<boolean>(false);
  const [actionLog, setActionLog] = useState<string>('');

  // Polling controller
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load telemetry data
  const loadData = useCallback(async (targetPatientId: PatientId, isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { data, isLiveBackend: isLive } = await fetchPatientStatus(targetPatientId, controller.signal);
      setIsLiveBackend(isLive);
      setTelemetry(data);
      setLastUpdated(new Date());

      // Update history buffer
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            spo2: data.current_vitals.spo2,
            hrv: data.current_vitals.hrv_ms,
          },
        ];
        return next.slice(-30);
      });
    } catch (err) {
      console.warn('Telemetry sync error:', err);
    } finally {
      if (isManualRefresh) setIsRefreshing(false);
    }
  }, []);

  // Initialize seed history on patient change
  useEffect(() => {
    setHistory(generateSeedHistory(patientId, 24));
    loadData(patientId);
    setActionLog('');

    // Pre-calculate initial simulated intervention
    const base = patientId === 'patient_b' ? 88.5 : patientId === 'patient_c' ? 90.5 : 98.2;
    setProjectedSpo2([
      base,
      Math.min(100, Number((base + 1.5).toFixed(1))),
      Math.min(100, Number((base + 3.0).toFixed(1))),
      Math.min(100, Number((base + 4.5).toFixed(1))),
      Math.min(100, Number((base + 6.0).toFixed(1))),
      Math.min(100, Number((base + 7.5).toFixed(1))),
    ]);

    const interval = setInterval(() => {
      loadData(patientId);
    }, 15000);

    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [patientId, loadData]);

  // Handle clinical alert actions
  const handleAction = async (action: AlertAction) => {
    if (pendingAction || !telemetry) return;
    setPendingAction(true);
    setActionLog(`Submitting ${action}...`);

    const alertId = telemetry.alert ? telemetry.alert.alert_id : `alt_${patientId}_001`;
    const res = await executeAlertAction(
      patientId,
      alertId,
      {
        action,
        intervention: selectedIntervention,
      },
      telemetry.current_vitals.spo2
    );

    const labels: Record<AlertAction, string> = {
      acknowledge: 'Acknowledged',
      escalate: 'Escalated to ICU Team',
      mute: 'Muted for 15m',
    };
    setActionLog(`Action Logged: ${labels[action]}`);

    if (res.simulation && res.simulation.projected_spo2) {
      setProjectedSpo2(res.simulation.projected_spo2);
    }

    setPendingAction(false);
  };

  // Immediate preview when changing intervention dropdown
  const handleInterventionChange = (newInter: InterventionType) => {
    setSelectedIntervention(newInter);
    const base = telemetry ? telemetry.current_vitals.spo2 : 88.5;
    const proj: number[] = [];

    for (let i = 1; i <= 6; i++) {
      let p: number;
      if (newInter === 'administer_o2') {
        p = Math.min(100.0, base + i * 1.5);
      } else if (newInter === 'bronchodilator') {
        p = Math.min(100.0, base + i * 0.5);
      } else {
        const step = base < 92 ? -0.4 * i : 0.0;
        p = Math.min(100.0, Math.max(70.0, base + step));
      }
      proj.push(Number(p.toFixed(1)));
    }
    setProjectedSpo2(proj);
  };

  const curSpo2 = telemetry ? telemetry.current_vitals.spo2 : 88.4;
  const curHrv = telemetry ? telemetry.current_vitals.hrv_ms : 36.2;
  const prob = telemetry ? telemetry.prediction.probability_score : 0.78;
  const metrics = telemetry ? telemetry.metrics : GLOBAL_DEFAULT_METRICS;
  const alert = telemetry ? telemetry.alert : null;

  const isCritical = prob > 0.6 || curSpo2 < 90;
  const isWarning = !isCritical && (prob > 0.3 || curSpo2 < 94);

  return (
    <div className="relative min-h-screen w-full bg-[#02060f] text-slate-100 flex flex-col font-['Sora',sans-serif]">
      {/* 1. Cinematic Background Video & Multi-Layer Veil */}
      <video
        className="fixed inset-0 w-full h-full object-cover object-center z-0 opacity-45 pointer-events-none"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-9449-585108a22fb5.mp4"
      />
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(140%_70%_at_50%_35%,rgba(2,6,15,0.72)_0%,rgba(2,6,15,0.92)_100%)]" />

      {/* 2. Top Navigation Bar with Aura Accent */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08]">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-violet-500/20 to-cyan-400/30 p-[1px] shadow-[0_0_16px_rgba(56,189,248,0.35)]">
            <div className="w-full h-full rounded-[11px] bg-slate-950/90 flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-lg">PULSE-TWIN</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold tracking-wider">
                CDS CONSOLE
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Clinical Digital Twin & Hypoxemia Deterioration Predictor</p>
          </div>
        </div>

        {/* Center: Cohort Switcher */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-700/60 backdrop-blur-md">
          <span className="text-xs font-mono text-slate-400 pl-2 pr-1 hidden sm:inline">Cohort:</span>
          <button
            onClick={() => setPatientId('patient_a')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              patientId === 'patient_a'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Patient A · Stable
          </button>
          <button
            onClick={() => setPatientId('patient_b')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              patientId === 'patient_b'
                ? 'bg-red-500/25 text-red-300 border border-red-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Patient B · High Risk
          </button>
          <button
            onClick={() => setPatientId('patient_c')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              patientId === 'patient_c'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Patient C · COPD
          </button>
        </div>

        {/* Right Status Indicator & Actions */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border backdrop-blur-md ${
              isLiveBackend
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveBackend ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-cyan-400 shadow-[0_0_8px_#38bdf8]'
              }`}
            />
            <span>{isLiveBackend ? 'FASTAPI LIVE' : 'SYNTHETIC TWIN'}</span>
          </div>

          <button
            onClick={() => loadData(patientId, true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-500 transition-all backdrop-blur-md disabled:opacity-50"
            title="Refresh Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* 3. Main Dashboard Workspace */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col gap-6">
        {/* TOP SECTION: 3D Anatomical Hero Stage & Primary Diagnostic Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Central 3D Cardiopulmonary Digital Twin (Takes 7 columns on desktop) */}
          <div className="lg:col-span-7 flex flex-col min-h-[500px]">
            <AuraCard
              className="h-full"
              noPadding
              auraIntensity={isCritical ? 'critical' : isWarning ? 'warning' : 'standard'}
              glowColor={isCritical ? 'critical' : isWarning ? 'warning' : 'cyan-violet'}
            >
              <AnatomySimulation3D
                spo2={curSpo2}
                hrv={curHrv}
                hypoxemiaRisk={prob}
                activeLayer={activeLayer}
                onLayerChange={setActiveLayer}
              />
            </AuraCard>
          </div>

          {/* Clinical Telemetry & Forecasting Column (Takes 5 columns on desktop) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* 1. Virtual Patient Real-Time Readout */}
            <AuraCard auraIntensity="subtle">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Live Vital Telemetry
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {lastUpdated.toLocaleTimeString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 my-1">
                {/* SpO2 */}
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-400 uppercase">SpO2 Pulse Ox</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span
                      className={`text-4xl font-extrabold font-mono tracking-tight ${
                        curSpo2 < 90
                          ? 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                          : curSpo2 < 94
                          ? 'text-amber-300'
                          : 'text-cyan-300'
                      }`}
                    >
                      {curSpo2.toFixed(1)}
                    </span>
                    <span className="text-lg font-mono text-slate-400">%</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1">
                    {curSpo2 < 90 ? 'Hypoxemic Range (<90%)' : 'Physiologic Baseline'}
                  </span>
                </div>

                {/* HRV */}
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-400 uppercase">HRV Spectral</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-4xl font-extrabold font-mono tracking-tight text-purple-300">
                      {Math.round(curHrv)}
                    </span>
                    <span className="text-lg font-mono text-slate-400">ms</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1">Autonomic Variability Index</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                <span className="text-slate-400">Profile:</span>
                <span className="font-medium text-cyan-300">
                  {patientId === 'patient_a'
                    ? 'Post-op Cardiac Surgery (Stable)'
                    : patientId === 'patient_b'
                    ? 'Acute Respiratory Failure Trajectory'
                    : 'COPD Gold Stage III Exacerbation'}
                </span>
              </div>
            </AuraCard>

            {/* 2. 30-Minute Hypoxemia Prediction */}
            <AuraCard
              auraIntensity={isCritical ? 'critical' : isWarning ? 'warning' : 'subtle'}
              glowColor={isCritical ? 'critical' : isWarning ? 'warning' : 'cyan-violet'}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <TrendingDown
                    className={`w-3.5 h-3.5 ${
                      isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-cyan-400'
                    }`}
                  />
                  30-Min Hypoxemia Risk
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                    telemetry?.prediction.calibrated
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {telemetry?.prediction.calibrated ? 'Calibrated (Isotonic)' : 'Uncalibrated'}
                </span>
              </div>

              <div className="flex items-baseline gap-3 my-1">
                <span
                  className={`text-5xl font-black font-mono tracking-tight ${
                    isCritical
                      ? 'text-red-400 drop-shadow-[0_0_18px_rgba(239,68,68,0.5)]'
                      : isWarning
                      ? 'text-amber-300'
                      : 'text-white'
                  }`}
                >
                  {(prob * 100).toFixed(1)}%
                </span>
                <span className="text-sm font-mono text-slate-400">
                  Uncertainty:{' '}
                  <strong className="text-slate-200">
                    {(
                      telemetry?.prediction.approximate_uncertainty_interval_95[0] ?? 0.05
                    ) * 100}%{' '}
                    -{' '}
                    {(
                      telemetry?.prediction.approximate_uncertainty_interval_95[1] ?? 0.15
                    ) * 100}%
                  </strong>
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mt-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                {telemetry?.prediction.explanation || 'Physiological indicators within normal variance bounds.'}
              </p>
            </AuraCard>

            {/* 3. Clinical Alert & Immediate Intervention Center */}
            <AuraCard
              auraIntensity={isCritical ? 'critical' : isWarning ? 'warning' : 'subtle'}
              glowColor={isCritical ? 'critical' : isWarning ? 'warning' : 'cyan-violet'}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <AlertTriangle
                    className={`w-3.5 h-3.5 ${
                      isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-cyan-400'
                    }`}
                  />
                  Clinical Alert Status
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                    isCritical
                      ? 'bg-red-500/25 text-red-300 border border-red-500/50'
                      : isWarning
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {alert ? alert.severity : 'NORMAL'}
                </span>
              </div>

              <p className="text-xs font-medium text-slate-200 leading-snug mb-3">
                {alert?.message || 'No active physiological alerts. Continuous monitoring stable.'}
              </p>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  onClick={() => handleAction('acknowledge')}
                  disabled={pendingAction}
                  className="px-2.5 py-2 text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => handleAction('escalate')}
                  disabled={pendingAction}
                  className="px-2.5 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-md border border-red-400/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  Escalate
                </button>
                <button
                  onClick={() => handleAction('mute')}
                  disabled={pendingAction}
                  className="px-2.5 py-2 text-xs font-semibold rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-all disabled:opacity-50"
                >
                  Mute (15m)
                </button>
              </div>

              {/* Simulated Intervention Selector */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800/80">
                <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <Wind className="w-3 h-3 text-cyan-400" />
                  Simulate Acute Intervention:
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedIntervention || ''}
                    onChange={(e) => handleInterventionChange((e.target.value as InterventionType) || null)}
                    className="flex-1 bg-slate-950/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-cyan-400"
                  >
                    <option value="">No Intervention (Spontaneous)</option>
                    <option value="administer_o2">Supplemental FiO2 (+6 L/min O2)</option>
                    <option value="bronchodilator">Inhaled Beta-2 Agonist (Bronchodilator)</option>
                  </select>
                </div>
              </div>

              {/* Action Log Status */}
              {actionLog && (
                <div className="mt-2 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {actionLog}
                </div>
              )}
            </AuraCard>
          </div>
        </div>

        {/* MIDDLE SECTION: Dual Trajectory Charts (History Trend & What-If Projection) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* History Trend Card */}
          <AuraCard auraIntensity="subtle">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  Recent Monitoring Trend (30 Samples)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">5-min Intervals</span>
            </div>
            <HistoryTrendChart history={history} />
          </AuraCard>

          {/* What-If Intervention Simulation Card */}
          <AuraCard auraIntensity="subtle">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  What-If Intervention Simulation (Next 30m)
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Forward Dynamic Trajectory
              </span>
            </div>
            <SimulationChart projectedSpo2={projectedSpo2} intervention={selectedIntervention} />
          </AuraCard>
        </div>

        {/* BOTTOM SECTION: Model Evaluation KPIs & Diagnostics */}
        <AuraCard auraIntensity="subtle">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white tracking-wide">
                Deterioration Model Evaluation Benchmarks (Test Cohort N=2,044)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Random Forest · Isotonic Calibration · 30m Window
            </span>
          </div>
          <EvaluationMetricsPanel metrics={metrics} />
        </AuraCard>
      </main>

      {/* 4. Footer & Clinical Disclaimers */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center border-t border-white/[0.08] flex flex-col gap-1.5">
        <p className="text-xs text-slate-400">
          Synthetic Digital Twin prototype — no real patient data is used or stored. FHIR synthetics & wearable PPG simulation.
        </p>
        <p className="text-[11px] font-mono tracking-wider font-semibold text-slate-500">
          NON-CLINICAL DECISION SUPPORT. NOT A MEDICAL DEVICE.
        </p>
      </footer>
    </div>
  );
}
