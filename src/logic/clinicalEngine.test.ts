import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSimulation,
  formatProbability,
  formatUncertaintyInterval,
  formatLeadTimeString,
  parseConfusionMatrix,
  generateHistorySvgPaths,
  generateSimulationSvgPaths,
  PATIENT_PROFILES
} from './clinicalEngine.ts';

test('PATIENT_PROFILES contains valid baseline configurations', () => {
  assert.ok(PATIENT_PROFILES.patient_a);
  assert.ok(PATIENT_PROFILES.patient_b);
  assert.ok(PATIENT_PROFILES.patient_c);
  assert.equal(PATIENT_PROFILES.patient_a.expectedRisk, 'low');
  assert.equal(PATIENT_PROFILES.patient_b.expectedRisk, 'high');
  assert.equal(PATIENT_PROFILES.patient_c.expectedRisk, 'moderate');
});

test('calculateSimulation handles administer_o2 with +1.5 step up to 100 max', () => {
  const result = calculateSimulation(88.0, 'administer_o2');
  assert.equal(result.length, 6);
  assert.equal(result[0], 89.5);
  assert.equal(result[1], 91.0);
  assert.equal(result[2], 92.5);
  assert.equal(result[3], 94.0);
  assert.equal(result[4], 95.5);
  assert.equal(result[5], 97.0);

  // Ceiling clamp check
  const capped = calculateSimulation(98.0, 'administer_o2');
  assert.equal(capped[0], 99.5);
  assert.equal(capped[1], 100.0);
  assert.equal(capped[5], 100.0);
});

test('calculateSimulation handles bronchodilator with +0.5 step', () => {
  const result = calculateSimulation(90.0, 'bronchodilator');
  assert.equal(result.length, 6);
  assert.equal(result[0], 90.5);
  assert.equal(result[1], 91.0);
  assert.equal(result[5], 93.0);
});

test('formatProbability properly converts 0-1 scores to percentages', () => {
  assert.equal(formatProbability(0.78), '78');
  assert.equal(formatProbability(0.08), '8');
  assert.equal(formatProbability(0.463), '46');
  assert.equal(formatProbability(null), '--');
});

test('formatUncertaintyInterval formats [low, high] bounds correctly', () => {
  assert.equal(formatUncertaintyInterval([0.69, 0.86]), 'Approx. uncertainty: [69% – 86%]');
  assert.equal(formatUncertaintyInterval(null), 'Approx. uncertainty: --');
});

test('formatLeadTimeString displays median and IQR', () => {
  const formatted = formatLeadTimeString(20.0, 15.0, 25.0);
  assert.equal(formatted, '20m (IQR: 15–25m)');
});

test('parseConfusionMatrix extracts TN, FP, FN, TP safely', () => {
  const parsed = parseConfusionMatrix([[1840, 48], [32, 124]]);
  assert.deepEqual(parsed, { tn: '1840', fp: '48', fn: '32', tp: '124' });

  const empty = parseConfusionMatrix(null);
  assert.deepEqual(empty, { tn: '--', fp: '--', fn: '--', tp: '--' });
});

test('generateHistorySvgPaths constructs valid svg coordinates and threshold', () => {
  const history = [
    { spo2: 95.0, hrv: 50.0 },
    { spo2: 92.0, hrv: 45.0 },
    { spo2: 89.0, hrv: 40.0 }
  ];
  const { spo2Path, hrvPath, thresholdY } = generateHistorySvgPaths(history, 600, 240);
  assert.ok(spo2Path.startsWith('M '));
  assert.ok(hrvPath.startsWith('M '));
  assert.ok(thresholdY > 0 && thresholdY < 240);
});

test('generateSimulationSvgPaths generates line and enclosed area path', () => {
  const sim = [89.5, 91.0, 92.5, 94.0, 95.5, 97.0];
  const { linePath, areaPath, points } = generateSimulationSvgPaths(sim, 600, 240);
  assert.ok(linePath.startsWith('M '));
  assert.ok(areaPath.includes('Z'));
  assert.equal(points.length, 6);
  assert.equal(points[0].label, '+5m');
  assert.equal(points[5].label, '+30m');
});
