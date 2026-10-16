export interface PatientProfile {
  id: string;
  name: string;
  condition: string;
  baselineSpo2: number;
  baselineHrv: number;
  baselineHr: number;
  baselineRr: number;
  expectedRisk: 'low' | 'high' | 'moderate';
  historySummary: string;
  ehrDiagnoses: string[];
}

export interface VitalsData {
  spo2: number;
  hrv_ms: number;
  heart_rate: number;
  respiration_rate: number;
}

export interface PredictionData {
  probability_score: number;
  approximate_uncertainty_interval_95: [number, number];
  calibrated: boolean;
  explanation: string;
}

export interface AlertData {
  alert_id: string;
  patient_id?: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  status?: string;
}

export interface EvaluationMetrics {
  roc_auc: number;
  brier_score: number;
  precision: number;
  recall: number;
  f1: number;
  confusion_matrix: number[][];
  missed_events: number;
  calibration_type: string;
  lead_time_mins_median: number;
  lead_time_mins_p25: number;
  lead_time_mins_p75: number;
}

export interface MonitoringStatusResponse {
  patient_id: string;
  timestamp: string;
  current_vitals: VitalsData;
  prediction: PredictionData;
  alert: AlertData;
  metrics: EvaluationMetrics;
}

export interface HistoryPoint {
  spo2: number;
  hrv: number;
  heart_rate?: number;
  timestamp?: string;
}

export interface SimulationResult {
  projected_spo2: number[];
  intervention?: string | null;
}

export type OrganId = 'heart' | 'lungs' | 'vessels' | 'aorta' | 'airways';

export interface OrganDetail {
  id: OrganId;
  name: string;
  system: string;
  status: 'optimal' | 'compromised' | 'critical' | 'monitored';
  summary: string;
  metrics: { label: string; value: string; unit?: string }[];
  clinicalNote: string;
}
