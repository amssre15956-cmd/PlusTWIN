export type PatientId = 'patient_a' | 'patient_b' | 'patient_c';

export interface Vitals {
  spo2: number;
  hrv_ms: number;
}

export interface Prediction {
  probability_score: number;
  approximate_uncertainty_interval_95: [number, number];
  calibrated: boolean;
  explanation: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  alert_id: string;
  message: string;
  severity: AlertSeverity;
}

export interface ModelMetrics {
  roc_auc: number;
  brier_score: number;
  precision: number;
  recall: number;
  f1: number;
  confusion_matrix: [[number, number], [number, number]];
  missed_events: number;
  calibration_type: string;
  lead_time_mins_median: number;
  lead_time_mins_p25: number;
  lead_time_mins_p75: number;
}

export interface MonitoringStatusResponse {
  patient_id: string;
  timestamp: string;
  current_vitals: Vitals;
  prediction: Prediction;
  alert: Alert | null;
  metrics: ModelMetrics;
}

export type AlertAction = 'acknowledge' | 'escalate' | 'mute';
export type InterventionType = 'administer_o2' | 'bronchodilator' | null;

export interface AlertActionRequest {
  action: AlertAction;
  intervention: InterventionType;
}

export interface SimulationResult {
  projected_spo2: number[];
}

export interface AlertActionResponse {
  status: string;
  action_logged: AlertAction;
  intervention: InterventionType;
  simulation?: SimulationResult;
}

export interface HistoryPoint {
  time: string;
  spo2: number;
  hrv: number;
}

export type AnatomicalLayer = 'all' | 'cardiac' | 'respiratory' | 'vascular';

export interface OrganInspectionInfo {
  id: string;
  name: string;
  system: 'Cardiovascular' | 'Pulmonary' | 'Systemic Vascular' | 'Microvascular';
  description: string;
  perfusionSat: number;
  dynamicState: string;
  clinicalImplication: string;
}
