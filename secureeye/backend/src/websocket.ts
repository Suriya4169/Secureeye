// ===================================================================
// SecureEye Backend — WebSocket Server (Camera ↔ Backend)
// ===================================================================

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import logger from './utils/logger';
import supabase from './utils/supabase';
import { verifyCameraApiKey, updateCameraStatus } from './services/cameraService';
import { alertQueue } from './queues/alertQueue';
import type {
    WSCameraToBackend,
    WSCommandMessage,
    WSConfigUpdateMessage,
} from '@secureeye/shared';

// Active camera connections: cameraId → WebSocket
const cameraConnections = new Map<string, WebSocket>();

// Track authenticated cameras
const authenticatedCameras = new Map<WebSocket, string>(); // ws → cameraId

export function setupWebSocket(server: HTTPServer): WebSocketServer {
    const wss = new WebSocketServer({ server, path: '/ws' });

    logger.info('WebSocket server started');

    wss.on('connection', (ws: WebSocket, req) => {
        const clientIp = req.socket.remoteAddress || 'unknown';
        logger.info('WebSocket connection attempt', { ip: clientIp });

        // Set auth timeout — must authenticate within 10 seconds
        const authTimeout = setTimeout(() => {
            if (!authenticatedCameras.has(ws)) {
                logger.warn('WebSocket auth timeout', { ip: clientIp });
                ws.close(1008, 'Authentication timeout');
            }
        }, 10_000);

        ws.on('message', async (raw: Buffer) => {
            try {
                const message: WSCameraToBackend = JSON.parse(raw.toString());

                switch (message.type) {
                    case 'auth': {
                        const camera = await verifyCameraApiKey(message.cameraId, message.apiKey);
                        if (!camera) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Invalid credentials' }));
                            ws.close(1008, 'Authentication failed');
                            return;
                        }

                        clearTimeout(authTimeout);

                        // Clean up existing connection for this camera
                        const existing = cameraConnections.get(message.cameraId);
                        if (existing && existing !== ws) {
                            existing.close(1000, 'New connection established');
                        }

                        cameraConnections.set(message.cameraId, ws);
                        authenticatedCameras.set(ws, message.cameraId);

                        // Update camera status
                        await updateCameraStatus(message.cameraId, 'active');

                        logger.info('Camera authenticated', { cameraId: message.cameraId });
                        ws.send(JSON.stringify({ type: 'auth_success' }));
                        break;
                    }

                    case 'heartbeat': {
                        const cameraId = authenticatedCameras.get(ws);
                        if (!cameraId) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
                            return;
                        }

                        await updateCameraStatus(cameraId, message.status, message.isMonitoring);
                        break;
                    }

                    case 'alert': {
                        const cameraId = authenticatedCameras.get(ws);
                        if (!cameraId) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
                            return;
                        }

                        // Queue alert for processing (don't block WS handler)
                        await alertQueue.add({
                            cameraId,
                            imageBase64: message.imageBase64,
                            confidence: message.confidence,
                            boundingBox: message.boundingBox,
                            detectionClass: message.detectionClass || 'hands',
                        });

                        logger.info('Alert queued', { cameraId, confidence: message.confidence });
                        break;
                    }

                    case 'command_ack': {
                        const { commandId, status, error } = message;

                        await supabase
                            .from('commands')
                            .update({
                                status,
                                executed_at: new Date().toISOString(),
                            })
                            .eq('id', commandId);

                        if (error) {
                            logger.warn('Command failed', { commandId, error });
                        } else {
                            logger.info('Command executed', { commandId });
                        }
                        break;
                    }

                    default:
                        logger.warn('Unknown message type', { message });
                }
            } catch (err) {
                logger.error('WebSocket message error', { error: err });
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
            }
        });

        ws.on('close', async () => {
            clearTimeout(authTimeout);
            const cameraId = authenticatedCameras.get(ws);
            if (cameraId) {
                cameraConnections.delete(cameraId);
                authenticatedCameras.delete(ws);
                await updateCameraStatus(cameraId, 'offline', false);
                logger.info('Camera disconnected', { cameraId });
            }
        });

        ws.on('error', (err) => {
            logger.error('WebSocket error', { error: err });
        });
    });

    // Poll for pending commands and send to cameras
    setInterval(async () => {
        try {
            const { data: commands } = await supabase
                .from('commands')
                .select('*')
                .eq('status', 'pending');

            if (commands) {
                for (const cmd of commands) {
                    const ws = cameraConnections.get(cmd.camera_id);
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        const wsCmd: WSCommandMessage = {
                            type: 'command',
                            commandId: cmd.id,
                            action: cmd.action,
                        };
                        ws.send(JSON.stringify(wsCmd));
                        logger.info('Command sent to camera', { cameraId: cmd.camera_id, action: cmd.action });
                    }
                }
            }
        } catch (err) {
            // Silent — command polling is best-effort
        }
    }, 5000);

    return wss;
}

export function sendConfigUpdate(
    cameraId: string,
    config: Omit<WSConfigUpdateMessage, 'type'>
): boolean {
    const ws = cameraConnections.get(cameraId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'config_update', ...config }));
        return true;
    }
    return false;
}

export function getConnectedCameras(): string[] {
    return Array.from(cameraConnections.keys());
}
