// ===================================================================
// SecureEye Backend — Alert Service
// ===================================================================

import supabase from '../utils/supabase';
import logger from '../utils/logger';
import { uploadSnapshot } from './storageService';
import { sendPushNotifications } from './pushService';
import type { BoundingBox } from '@secureeye/shared';

// Server-side cooldown tracking
const alertCooldowns = new Map<string, number>();
const COOLDOWN_MS = 30_000; // 30 seconds

export interface ProcessAlertData {
    cameraId: string;
    imageBase64: string;
    confidence: number;
    boundingBox: BoundingBox;
    detectionClass: string;
}

export async function processAlert(data: ProcessAlertData): Promise<string | null> {
    const { cameraId, imageBase64, confidence, boundingBox, detectionClass } = data;

    // Server-side cooldown check
    const lastAlert = alertCooldowns.get(cameraId) || 0;
    if (Date.now() - lastAlert < COOLDOWN_MS) {
        logger.debug('Alert cooldown active, skipping', { cameraId });
        return null;
    }
    alertCooldowns.set(cameraId, Date.now());

    try {
        // Get camera and org info
        const { data: camera, error: camError } = await supabase
            .from('cameras')
            .select('org_id, label')
            .eq('id', cameraId)
            .single();

        if (camError || !camera) {
            logger.error('Camera not found for alert', { cameraId });
            return null;
        }

        // Upload snapshot to storage
        const snapshotUrl = await uploadSnapshot(imageBase64, cameraId);

        // Insert alert record
        const { data: alert, error: alertError } = await supabase
            .from('alerts')
            .insert({
                camera_id: cameraId,
                org_id: camera.org_id,
                snapshot_url: snapshotUrl,
                confidence,
                detection_class: detectionClass,
                bounding_box: boundingBox,
            })
            .select()
            .single();

        if (alertError) {
            logger.error('Alert insert failed', { error: alertError.message });
            return null;
        }

        // Log audit
        await supabase.from('audit_logs').insert({
            org_id: camera.org_id,
            action: 'alert_created',
            metadata: { cameraId, alertId: alert.id, confidence, detectionClass },
        });

        // Send push notifications (non-blocking)
        sendPushNotifications({
            orgId: camera.org_id,
            alertId: alert.id,
            cameraLabel: camera.label,
            confidence,
            snapshotUrl,
        }).catch((err) => logger.error('Push notification failed', { error: err }));

        logger.info('Alert processed', { alertId: alert.id, cameraId, confidence });
        return alert.id;
    } catch (err) {
        logger.error('Alert processing error', { cameraId, error: err });
        return null;
    }
}
