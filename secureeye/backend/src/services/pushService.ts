// ===================================================================
// SecureEye Backend — Push Notification Service (Firebase Admin FCM)
// ===================================================================

import admin from 'firebase-admin';
import logger from '../utils/logger';
import supabase from '../utils/supabase';

// Initialize Firebase Admin
let firebaseInitialized = false;

if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
        firebaseInitialized = true;
        logger.info('Firebase Admin initialized');
    } catch (err) {
        logger.warn('Firebase Admin init failed', { error: err });
    }
} else {
    logger.warn('Firebase credentials not set — push notifications disabled');
}

export interface PushAlertData {
    orgId: string;
    alertId: string;
    cameraLabel: string;
    confidence: number;
    snapshotUrl: string;
}

export async function sendPushNotifications(data: PushAlertData): Promise<void> {
    if (!firebaseInitialized) {
        logger.warn('Firebase not initialized, skipping push notification');
        return;
    }

    const { orgId, alertId, cameraLabel, confidence, snapshotUrl } = data;

    try {
        // Get all org members' FCM tokens
        const { data: members, error: membersError } = await supabase
            .from('org_members')
            .select('user_id')
            .eq('org_id', orgId);

        if (membersError || !members?.length) {
            logger.warn('No org members found for push', { orgId });
            return;
        }

        const userIds = members.map((m) => m.user_id);

        const { data: sessions, error: sessionsError } = await supabase
            .from('user_sessions')
            .select('fcm_token')
            .in('user_id', userIds)
            .not('fcm_token', 'is', null);

        if (sessionsError || !sessions?.length) {
            logger.warn('No FCM tokens found', { orgId });
            return;
        }

        const tokens = sessions
            .map((s) => s.fcm_token)
            .filter((t): t is string => !!t);

        if (tokens.length === 0) return;

        const message: admin.messaging.MulticastMessage = {
            tokens,
            notification: {
                title: `🚨 Alert: ${cameraLabel}`,
                body: `Detection confidence: ${(confidence * 100).toFixed(1)}%`,
                imageUrl: snapshotUrl,
            },
            data: {
                type: 'alert',
                alertId,
                cameraLabel,
                confidence: confidence.toString(),
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'secureeye_alerts',
                    priority: 'max',
                    sound: 'default',
                },
            },
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        logger.info('Push notifications sent', {
            success: response.successCount,
            failure: response.failureCount,
        });
    } catch (err) {
        logger.error('Push notification error', { error: err });
    }
}
