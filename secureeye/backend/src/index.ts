// ===================================================================
// SecureEye Backend — Express App Entry Point
// ===================================================================

import dotenv from 'dotenv';
import path from 'path';

// Load root .env first (has Gmail creds), then backend .env overrides
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';

import logger from './utils/logger';
import { apiRateLimit } from './middleware/rateLimit';
import { setupWebSocket } from './websocket';

// Routes
import authRoutes from './routes/auth';
import cameraRoutes from './routes/cameras';
import alertRoutes from './routes/alerts';
import orgRoutes from './routes/organizations';
import notificationRoutes from './routes/notifications';
import otpAuthRoutes from './routes/otpAuth';

// Initialize queues (side-effect: starts processing)
import './queues/alertQueue';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);

// ----- Middleware -----
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // large for base64 images
app.use(express.urlencoded({ extended: true }));
app.use(morgan('short', {
    stream: { write: (msg: string) => logger.info(msg.trim()) },
}));
app.use(apiRateLimit);

// ----- Serve Web Dashboard (static files) -----
app.use(express.static(path.join(__dirname, '../../web-dashboard')));

// ----- Health Check -----
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'secureeye-backend',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// ----- API Routes -----
app.use('/api/auth', authRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/auth/otp', otpAuthRoutes);

// ----- 404 Handler -----
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

// ----- Error Handler -----
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ----- Start Servers -----

// HTTP server (REST API)
app.listen(PORT, () => {
    logger.info(`🚀 SecureEye Backend running on port ${PORT}`);
});

// WebSocket server (camera connections)
const wsServer = createServer();
setupWebSocket(wsServer);
wsServer.listen(WS_PORT, () => {
    logger.info(`🔌 WebSocket server listening on port ${WS_PORT}`);
});

export default app;
