import {
  PatientId,
  MonitoringStatusResponse,
  AlertActionRequest,
  AlertActionResponse,
  ModelMetrics,
} from '../types/telemetry';

const API_BASE = 'http://localhost:8000';
const AUTH_TOKEN = 'Bearer valid_mock_token';

export const GLOBAL_DEFAULT_METRICS: ModelMetrics = {
  roc_auc: 0.892,
  brier_score: 0.088,
  precision: 0.865,
  recall: 0.812,
  f1: 0.838,
  confusion_matrix: [
    [1840, 48],
    [32, 124],
  ],
  missed_events: 2,
  calibration_type: 'isotonic',
  lead_time_mins_median: 20.0,
  lead_time_mins_p25: 15.0,
  lead_time_mins_p75: 25.0,
};

let simulationTick = 0;

export function generateSyntheticClinicalData(patientId: PatientId): MonitoringStatusResponse {
  simulationTick++;
  const now = new Date();

  let spo2 = 98.2;
  let hrv = 58.4;
  let prob = 0.08;
  let ci: [number, number] = [0.03, 0.14];
  let explanation = 'Vitals are stable. SpO2 slope is flat and within expected variance.';
  let severity: 'info' | 'warning' | 'critical' = 'info';
  let alertMsg = 'Stable physiological parameters. No intervention needed.';
  let alertId = `alt_${patientId}_001`;

  // Physiological oscillation & drift
  const wave = Math.sin(simulationTick * 0.35) * 0.4;
  const hrvWave = Math.cos(simulationTick * 0.25) * 2.0;

  if (patientId === 'patient_a') {
    spo2 = Math.min(100, Math.max(96, 98.2 + wave));
    hrv = Math.max(45, 58.4 + hrvWave);
    prob = 0.07;
    ci = [0.02, 0.12];
    explanation = 'Normal sinus rhythm. Alveolar-arterial gradient optimal.';
    severity = 'info';
    alertMsg = 'Normal vital trajectory. Continuous pulse-oximetry active.';
    alertId = `alt_patient_a_001`;
  } else if (patientId === 'patient_b') {
    // Deteriorating trajectory
    const desat = Math.min(6.5, simulationTick * 0.25);
    spo2 = Math.max(82, 88.5 - desat + wave * 0.8);
    hrv = Math.max(22, 36.2 - desat * 0.8 + hrvWave * 0.6);
    prob = Math.min(0.96, 0.78 + (simulationTick * 0.02));
    ci = [Math.max(0.65, prob - 0.08), Math.min(1.0, prob + 0.08)];
    explanation = `SpO2 slope decreased by -${(2.8 + desat * 0.3).toFixed(1)}% over 1h, increasing risk. Rapid hypoxemic trajectory detected.`;
    severity = 'critical';
    alertMsg = `Critical Hypoxemia Risk: SpO2 dropping to ${spo2.toFixed(1)}%. Model projects acute desaturation event within 30m.`;
    alertId = `alt_patient_b_882`;
  } else {
    // patient_c (COPD)
    spo2 = Math.min(94, Math.max(86, 90.6 + wave * 0.7));
    hrv = Math.max(28, 39.8 + hrvWave * 0.8);
    prob = 0.46;
    ci = [0.38, 0.55];
    explanation = 'EHR indicates active COPD, increasing baseline risk. Moderate oxygenation decline observed.';
    severity = 'warning';
    alertMsg = 'Elevated risk for COPD patient: SpO2 hovering near 90%. Watch closely for rapid decompensation.';
    alertId = `alt_patient_c_409`;
  }

  return {
    patient_id: patientId,
    timestamp: now.toISOString(),
    current_vitals: {
      spo2: Number(spo2.toFixed(1)),
      hrv_ms: Number(hrv.toFixed(1)),
    },
    prediction: {
      probability_score: Number(prob.toFixed(3)),
      approximate_uncertainty_interval_95: [Number(ci[0].toFixed(3)), Number(ci[1].toFixed(3))],
      calibrated: true,
      explanation,
    },
    alert: {
      alert_id: alertId,
      message: alertMsg,
      severity,
    },
    metrics: GLOBAL_DEFAULT_METRICS,
  };
}

export async function fetchPatientStatus(
  patientId: PatientId,
  signal?: AbortSignal
): Promise<{ data: MonitoringStatusResponse; isLiveBackend: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/patient/${patientId}/monitoring-status`, {
      headers: {
        Authorization: AUTH_TOKEN,
      },
      signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }

    const data: MonitoringStatusResponse = await res.json();
    return { data, isLiveBackend: true };
  } catch {
    // Unreachable backend, return deterministic synthetic twin
    const fallbackData = generateSyntheticClinicalData(patientId);
    return { data: fallbackData, isLiveBackend: false };
  }
}

export async function executeAlertAction(
  patientId: PatientId,
  alertId: string,
  request: AlertActionRequest,
  currentSpo2: number
): Promise<AlertActionResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/patient/${patientId}/alert/${alertId}/action`, {
      method: 'POST',
      headers: {
        Authorization: AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    const data: AlertActionResponse = await res.json();
    return data;
  } catch {
    // Client-side fallback simulation projection matching Python formula exactly
    let projected: number[] = [];
    const base = currentSpo2 || 88.5;

    for (let i = 1; i <= 6; i++) {
      let p: number;
      if (request.intervention === 'administer_o2') {
        p = Math.min(100.0, base + i * 1.5);
      } else if (request.intervention === 'bronchodilator') {
        p = Math.min(100.0, base + i * 0.5);
      } else {
        const step = base < 92 ? -0.4 * i : 0.0;
        p = Math.min(100.0, Math.max(70.0, base + step));
      }
      projected.push(Number(p.toFixed(1)));
    }

    return {
      status: 'success',
      action_logged: request.action,
      intervention: request.intervention,
      simulation: {
        projected_spo2: projected,
      },
    };
  }
}

export function generateSeedHistory(patientId: PatientId, count = 24) {
  const history: { time: string; spo2: number; hrv: number }[] = [];
  const baseS = patientId === 'patient_b' ? 92 : patientId === 'patient_c' ? 91 : 98;
  const baseH = patientId === 'patient_b' ? 44 : patientId === 'patient_c' ? 40 : 58;

  for (let i = count; i >= 0; i--) {
    const d = new Date(Date.now() - i * 5 * 60 * 1000);
    const drop = patientId === 'patient_b' ? ((count - i) / count) * 4.5 : 0;
    const noiseS = (Math.sin(i * 0.5) * 0.7);
    const noiseH = (Math.cos(i * 0.5) * 2.5);

    history.push({
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      spo2: Number(Math.min(100, Math.max(75, baseS - drop + noiseS)).toFixed(1)),
      hrv: Number(Math.max(15, baseH - drop * 0.8 + noiseH).toFixed(1)),
    });
  }

  return history;
}
