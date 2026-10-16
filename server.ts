import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  generateMonitoringStatus,
  calculateSimulation,
  PATIENT_PROFILES,
  GLOBAL_DEFAULT_METRICS
} from './src/logic/clinicalEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory event store matching Python backend
interface StoredEvent {
  timestamp: string;
  patient_id: string;
  alert_id: string;
  action: string;
  intervention: string | null;
}

const EVENT_STORE: StoredEvent[] = [];
const ALERT_STORE: Record<string, any> = {};

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS middleware for safety
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check endpoint (compatible with backend/main.py)
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'aadhyunik-upchar-api',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // Patient profiles catalog
  app.get('/api/v1/patients', (req: Request, res: Response) => {
    res.json(Object.values(PATIENT_PROFILES));
  });

  // Clinical Monitoring Status endpoint (compatible with backend/main.py)
  app.get('/api/v1/patient/:patient_id/monitoring-status', (req: Request, res: Response) => {
    const patientId = req.params.patient_id;
    const statusData = generateMonitoringStatus(patientId, true);

    ALERT_STORE[statusData.alert.alert_id] = {
      alert_id: statusData.alert.alert_id,
      patient_id: patientId,
      severity: statusData.alert.severity,
      message: statusData.alert.message,
      status: 'active'
    };

    res.json(statusData);
  });

  // Alert Action endpoint (compatible with backend/main.py)
  app.post('/api/v1/patient/:patient_id/alert/:alert_id/action', (req: Request, res: Response) => {
    const { patient_id, alert_id } = req.params;
    const { action, intervention } = req.body;

    if (!action || !['acknowledge', 'escalate', 'mute'].includes(action)) {
      res.status(400).json({ detail: 'Invalid action type. Expected acknowledge, escalate, or mute.' });
      return;
    }

    const prof = PATIENT_PROFILES[patient_id] || PATIENT_PROFILES.patient_a;
    const baseSpo2 = prof.baselineSpo2;

    const projected = calculateSimulation(baseSpo2, intervention);

    EVENT_STORE.push({
      timestamp: new Date().toISOString(),
      patient_id,
      alert_id,
      action,
      intervention: intervention || null
    });

    if (ALERT_STORE[alert_id]) {
      ALERT_STORE[alert_id].status = action === 'acknowledge' ? 'acknowledged' : action === 'mute' ? 'muted' : 'escalated';
    }

    res.json({
      status: 'success',
      action_logged: action,
      intervention: intervention || null,
      simulation: {
        projected_spo2: projected
      }
    });
  });

  // Event audit log endpoint
  app.get('/api/v1/events', (req: Request, res: Response) => {
    res.json({
      total: EVENT_STORE.length,
      events: EVENT_STORE
    });
  });

  // Model global evaluation metrics endpoint
  app.get('/api/v1/model/metrics', (req: Request, res: Response) => {
    res.json(GLOBAL_DEFAULT_METRICS);
  });

  // Frontend Serving:
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Vite middleware for rapid HMR / dev experience
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Pulse-Twin AI] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Pulse-Twin AI] Server failed to start:', err);
  process.exit(1);
});
