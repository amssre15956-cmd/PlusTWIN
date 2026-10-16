/**
 * Pure clinical logic functions for Pulse-Twin AI
 * Used by UI, Node test runner, and Express backend API
 */

import {
  PatientProfile,
  VitalsData,
  PredictionData,
  AlertData,
  EvaluationMetrics,
  MonitoringStatusResponse,
  OrganDetail,
  OrganId
} from '../types/clinical.ts';

export type { PatientProfile };

export const PATIENT_PROFILES: Record<string, PatientProfile> = {
  patient_a: {
    id: 'patient_a',
    name: 'Patient A',
    condition: 'Post-op Recovery (Stable)',
    baselineSpo2: 98.2,
    baselineHrv: 58.4,
    baselineHr: 68,
    baselineRr: 14,
    expectedRisk: 'low',
    historySummary: 'Post-laparoscopic cholecystectomy day 2. Normal sinus rhythm, recovering well.',
    ehrDiagnoses: ['Post-operative state (Z98.89)', 'Normotensive (I10 neg)']
  },
  patient_b: {
    id: 'patient_b',
    name: 'Patient B',
    condition: 'Acute Respiratory Deterioration Risk',
    baselineSpo2: 88.4,
    baselineHrv: 36.2,
    baselineHr: 104,
    baselineRr: 26,
    expectedRisk: 'high',
    historySummary: 'Acute hypoxemic respiratory failure risk. Rapid desaturation trend observed over the past 60 minutes.',
    ehrDiagnoses: ['Acute hypoxemic failure risk (J96.01)', 'Tachycardia (R00.0)', 'Bilateral basal atelectasis']
  },
  patient_c: {
    id: 'patient_c',
    name: 'Patient C',
    condition: 'Chronic Obstructive Pulmonary Disease (COPD)',
    baselineSpo2: 90.5,
    baselineHrv: 39.8,
    baselineHr: 82,
    baselineRr: 20,
    expectedRisk: 'moderate',
    historySummary: 'Moderate COPD exacerbation (GOLD Stage III). Retaining baseline PaO2 baseline near 90-91%. Watch supplemental O2 titration closely.',
    ehrDiagnoses: ['COPD with acute exacerbation (J44.1)', 'Pulmonary emphysema (J43.9)']
  }
};

export const GLOBAL_DEFAULT_METRICS: EvaluationMetrics = {
  roc_auc: 0.892,
  brier_score: 0.088,
  precision: 0.865,
  recall: 0.812,
  f1: 0.838,
  confusion_matrix: [[1840, 48], [32, 124]],
  missed_events: 2,
  calibration_type: 'isotonic',
  lead_time_mins_median: 20.0,
  lead_time_mins_p25: 15.0,
  lead_time_mins_p75: 25.0
};

/**
 * Calculates projected SpO2 over 6 future 5-minute intervals (+5m to +30m)
 */
export function calculateSimulation(
  currentSpo2: number,
  intervention: 'administer_o2' | 'bronchodilator' | string | null
): number[] {
  const result: number[] = [];
  const safeBase = Math.max(70, Math.min(100, currentSpo2));

  for (let i = 1; i <= 6; i++) {
    let projected: number;
    if (intervention === 'administer_o2') {
      projected = Math.min(100.0, safeBase + i * 1.5);
    } else if (intervention === 'bronchodilator') {
      projected = Math.min(100.0, safeBase + i * 0.5);
    } else {
      const naturalDrift = safeBase < 92 ? -0.4 * i : 0.0;
      projected = Math.min(100.0, Math.max(75.0, safeBase + naturalDrift));
    }
    result.push(Number(projected.toFixed(1)));
  }
  return result;
}

/**
 * Formats probability score as rounded integer percentage
 */
export function formatProbability(prob: number | null | undefined): string {
  if (prob === null || prob === undefined || isNaN(prob)) return '--';
  return Math.round(prob * 100).toString();
}

/**
 * Formats 95% uncertainty interval
 */
export function formatUncertaintyInterval(interval: [number, number] | null | undefined): string {
  if (!interval || interval.length < 2) return 'Approx. uncertainty: --';
  const low = Math.round(interval[0] * 100);
  const high = Math.round(interval[1] * 100);
  return `Approx. uncertainty: [${low}% – ${high}%]`;
}

/**
 * Formats warning lead time string
 */
export function formatLeadTimeString(median: number, p25: number, p75: number): string {
  return `${median.toFixed(0)}m (IQR: ${p25.toFixed(0)}–${p75.toFixed(0)}m)`;
}

/**
 * Validates and flattens confusion matrix
 */
export function parseConfusionMatrix(matrix: number[][] | null | undefined): {
  tn: string;
  fp: string;
  fn: string;
  tp: string;
} {
  if (!matrix || matrix.length < 2 || !matrix[0] || !matrix[1]) {
    return { tn: '--', fp: '--', fn: '--', tp: '--' };
  }
  return {
    tn: String(matrix[0][0] ?? '--'),
    fp: String(matrix[0][1] ?? '--'),
    fn: String(matrix[1][0] ?? '--'),
    tp: String(matrix[1][1] ?? '--')
  };
}

/**
 * Pure SVG path generator for 30 readings history chart
 */
export function generateHistorySvgPaths(
  history: { spo2: number; hrv: number }[],
  width = 600,
  height = 240,
  padding = { top: 20, right: 30, bottom: 30, left: 45 }
): { spo2Path: string; hrvPath: string; thresholdY: number } {
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // SpO2 scale: 80% to 100%
  const spo2Min = 80;
  const spo2Max = 100;
  const getYSpO2 = (val: number) => {
    const clamped = Math.min(spo2Max, Math.max(spo2Min, val));
    return padding.top + chartH - ((clamped - spo2Min) / (spo2Max - spo2Min)) * chartH;
  };

  // HRV scale: 20ms to 80ms
  const hrvMin = 20;
  const hrvMax = 80;
  const getYHrv = (val: number) => {
    const clamped = Math.min(hrvMax, Math.max(hrvMin, val));
    return padding.top + chartH - ((clamped - hrvMin) / (hrvMax - hrvMin)) * chartH;
  };

  const thresholdY = getYSpO2(90);

  if (history.length === 0) {
    return { spo2Path: '', hrvPath: '', thresholdY };
  }

  const stepX = history.length > 1 ? chartW / (history.length - 1) : chartW;

  let spo2Path = '';
  let hrvPath = '';

  history.forEach((pt, idx) => {
    const x = padding.left + idx * stepX;
    const ySpo2 = getYSpO2(pt.spo2);
    const yHrv = getYHrv(pt.hrv);

    if (idx === 0) {
      spo2Path += `M ${x.toFixed(1)} ${ySpo2.toFixed(1)}`;
      hrvPath += `M ${x.toFixed(1)} ${yHrv.toFixed(1)}`;
    } else {
      spo2Path += ` L ${x.toFixed(1)} ${ySpo2.toFixed(1)}`;
      hrvPath += ` L ${x.toFixed(1)} ${yHrv.toFixed(1)}`;
    }
  });

  return { spo2Path, hrvPath, thresholdY };
}

/**
 * Pure SVG path generator for Simulation chart
 */
export function generateSimulationSvgPaths(
  projections: number[],
  width = 600,
  height = 240,
  padding = { top: 20, right: 30, bottom: 30, left: 45 }
): { linePath: string; areaPath: string; thresholdY: number; points: { x: number; y: number; val: number; label: string }[] } {
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const yMin = 80;
  const yMax = 100;
  const getY = (val: number) => {
    const clamped = Math.min(yMax, Math.max(yMin, val));
    return padding.top + chartH - ((clamped - yMin) / (yMax - yMin)) * chartH;
  };

  const thresholdY = getY(90);

  if (!projections || projections.length === 0) {
    return { linePath: '', areaPath: '', thresholdY, points: [] };
  }

  const stepX = chartW / (projections.length - 1 || 1);
  const points: { x: number; y: number; val: number; label: string }[] = [];

  let linePath = '';
  projections.forEach((val, idx) => {
    const x = padding.left + idx * stepX;
    const y = getY(val);
    points.push({ x, y, val, label: `+${(idx + 1) * 5}m` });

    if (idx === 0) {
      linePath += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      linePath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  });

  const lastX = padding.left + (projections.length - 1) * stepX;
  const firstX = padding.left;
  const bottomY = padding.top + chartH;

  const areaPath = `${linePath} L ${lastX.toFixed(1)} ${bottomY.toFixed(1)} L ${firstX.toFixed(1)} ${bottomY.toFixed(1)} Z`;

  return { linePath, areaPath, thresholdY, points };
}

/**
 * Produces deterministic clinical twin status matching FastAPI backend logic
 */
export function generateMonitoringStatus(patientId: string, jitter = true): MonitoringStatusResponse {
  const prof = PATIENT_PROFILES[patientId] || PATIENT_PROFILES.patient_a;
  const now = new Date();

  let spo2 = prof.baselineSpo2;
  let hrv = prof.baselineHrv;
  let hr = prof.baselineHr;
  let rr = prof.baselineRr;
  let prob = 0.08;
  let ci: [number, number] = [0.03, 0.14];
  let explanation = 'Vitals are stable. SpO2 slope is flat and within expected variance.';
  let severity: 'critical' | 'warning' | 'info' = 'info';
  let alertMsg = 'Stable physiological parameters. No intervention needed.';
  let alertId = `alt_${patientId}_001`;

  if (patientId === 'patient_b') {
    prob = 0.78;
    ci = [0.69, 0.86];
    explanation = 'SpO2 slope decreased by -2.8% over 1h, increasing risk. Hypoxemic trajectory detected.';
    severity = 'critical';
    alertMsg = 'Critical Hypoxemia Risk: SpO2 dropping below threshold. High probability of decompensation within 30m.';
    alertId = 'alt_patient_b_882';
  } else if (patientId === 'patient_c') {
    prob = 0.46;
    ci = [0.38, 0.55];
    explanation = 'EHR indicates active COPD, increasing baseline risk. Moderate oxygenation decline observed.';
    severity = 'warning';
    alertMsg = 'Elevated risk for COPD patient: SpO2 hovering near 90%. Watch closely for rapid desaturation.';
    alertId = 'alt_patient_c_409';
  }

  if (jitter) {
    const sDelta = (Math.random() - 0.5) * 0.4;
    const hDelta = (Math.random() - 0.5) * 1.5;
    const hrDelta = Math.round((Math.random() - 0.5) * 2);
    const rrDelta = Math.round((Math.random() - 0.5) * 1.5);

    spo2 = Math.min(100, Math.max(75, Number((spo2 + sDelta).toFixed(1))));
    hrv = Math.max(10, Number((hrv + hDelta).toFixed(1)));
    hr = Math.max(40, hr + hrDelta);
    rr = Math.max(8, rr + rrDelta);
  }

  return {
    patient_id: patientId,
    timestamp: now.toISOString(),
    current_vitals: {
      spo2,
      hrv_ms: hrv,
      heart_rate: hr,
      respiration_rate: rr
    },
    prediction: {
      probability_score: prob,
      approximate_uncertainty_interval_95: ci,
      calibrated: true,
      explanation
    },
    alert: {
      alert_id: alertId,
      patient_id: patientId,
      message: alertMsg,
      severity
    },
    metrics: GLOBAL_DEFAULT_METRICS
  };
}

/**
 * Returns anatomical breakdown for 3D digital twin hover/inspection
 */
export function getOrganDiagnostics(organId: OrganId, vitals: VitalsData, profile: PatientProfile): OrganDetail {
  const isHypoxemic = vitals.spo2 < 90;
  const isCopd = profile.id === 'patient_c';

  switch (organId) {
    case 'heart':
      return {
        id: 'heart',
        name: 'Human Anatomical Heart (Cardiac Twin)',
        system: 'Cardiovascular System',
        status: isHypoxemic ? 'critical' : vitals.hrv_ms < 40 ? 'compromised' : 'optimal',
        summary: `Myocardial contractility modulated by autonomic tone. Heart rate: ${vitals.heart_rate} BPM, HRV: ${vitals.hrv_ms}ms.`,
        metrics: [
          { label: 'Heart Rate', value: `${vitals.heart_rate}`, unit: 'BPM' },
          { label: 'Autonomic HRV', value: `${vitals.hrv_ms}`, unit: 'ms' },
          { label: 'Cardiac Output Est.', value: (vitals.heart_rate * 0.07).toFixed(1), unit: 'L/min' },
          { label: 'Rhythm', value: vitals.heart_rate > 100 ? 'Sinus Tachycardia' : 'Normal Sinus Rhythm' }
        ],
        clinicalNote: isHypoxemic
          ? 'Compensatory tachycardia in response to systemic hypoxemia. Increased myocardial oxygen demand.'
          : 'Cardiac cycle rhythmic and well perfused without ischemic indicators.'
      };

    case 'lungs':
      return {
        id: 'lungs',
        name: 'Bilateral Pulmonary Lobes & Alveolar Network',
        system: 'Respiratory System',
        status: isHypoxemic ? 'critical' : isCopd ? 'compromised' : 'optimal',
        summary: `Ventilation-perfusion matching status. Respiration Rate: ${vitals.respiration_rate} Br/min, SpO2: ${vitals.spo2}%.`,
        metrics: [
          { label: 'SpO2 Saturation', value: `${vitals.spo2}`, unit: '%' },
          { label: 'Respiration Rate', value: `${vitals.respiration_rate}`, unit: 'Br/min' },
          { label: 'Estimated PaO2', value: Math.round(vitals.spo2 * 0.7 + 10).toString(), unit: 'mmHg' },
          { label: 'Alveolar Diffusion', value: isHypoxemic ? 'Severely Impaired' : isCopd ? 'Moderate Diffusion Limitation' : 'Optimal' }
        ],
        clinicalNote: isHypoxemic
          ? 'Severe alveolar gas exchange compromise. V/Q mismatch detected with high 30-min deterioration risk.'
          : isCopd
          ? 'Chronic hyperinflation and increased airway resistance consistent with COPD history.'
          : 'Clear bilateral breath sounds with normal tidal compliance.'
      };

    case 'vessels':
    case 'aorta':
      return {
        id: 'vessels',
        name: 'Systemic & Pulmonary Vascular Network',
        system: 'Hemodynamics',
        status: isHypoxemic ? 'compromised' : 'optimal',
        summary: 'Aortic arch delivery and pulmonary artery deoxygenated return flow.',
        metrics: [
          { label: 'Vascular Resistance', value: isHypoxemic ? 'Elevated' : 'Normal', unit: 'dyn·s/cm⁵' },
          { label: 'Arterial Oxygenation', value: `${vitals.spo2}% HbO2` },
          { label: 'Venous Return Est.', value: '68%', unit: 'SvO2' },
          { label: 'Pulse Wave Velocity', value: '7.2', unit: 'm/s' }
        ],
        clinicalNote: 'Microvascular perfusion tracking shows peripheral vasoconstriction during acute hypoxemic stress.'
      };

    case 'airways':
      return {
        id: 'airways',
        name: 'Tracheobronchial Tree',
        system: 'Conducting Zone',
        status: isCopd ? 'compromised' : 'optimal',
        summary: 'Tracheal conduit branching into primary, secondary and segmental bronchi.',
        metrics: [
          { label: 'Airway Resistance', value: isCopd ? 'High (Bronchospasm)' : 'Normal', unit: 'cmH2O/L/s' },
          { label: 'Secretions', value: isCopd ? 'Moderate' : 'Minimal' },
          { label: 'Bronchodilator Sensitivity', value: 'Responsive' }
        ],
        clinicalNote: isCopd
          ? 'Elevated baseline bronchomotor tone. Likely to benefit from inhaled bronchodilators.'
          : 'Patent tracheobronchial conduit with minimal resistance.'
      };
  }
}
