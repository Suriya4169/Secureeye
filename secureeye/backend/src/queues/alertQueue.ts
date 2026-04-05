// ===================================================================
// SecureEye Backend — Alert Queue (Bull)
// ===================================================================

import Bull from 'bull';
import logger from '../utils/logger';
import { processAlert, ProcessAlertData } from '../services/alertService';
import { sendAlertEmail, AlertEmailData } from '../services/emailService';
import supabase from '../utils/supabase';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const alertQueue = new Bull<ProcessAlertData>('alert-processing', REDIS_URL, {
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
    },
});

alertQueue.process(async (job) => {
    const alertId = await processAlert(job.data);

    if (alertId) {
        // Queue email notification
        const { data: camera } = await supabase
            .from('cameras')
            .select('label, org_id')
            .eq('id', job.data.cameraId)
            .single();

        if (camera) {
            const { data: org } = await supabase
                .from('organizations')
                .select('name, owner_id')
                .eq('id', camera.org_id)
                .single();

            const { data: owner } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', org?.owner_id)
                .single();

            if (owner) {
                const { data: authUser } = await supabase.auth.admin.getUserById(owner.id);
                if (authUser?.user?.email) {
                    await emailQueue.add({
                        toEmail: authUser.user.email,
                        cameraLabel: camera.label,
                        confidence: job.data.confidence,
                        snapshotUrl: '', // will be set from alert record
                        timestamp: new Date().toISOString(),
                        orgName: org?.name || 'SecureEye',
                    });
                }
            }
        }
    }

    return alertId;
});

alertQueue.on('failed', (job, err) => {
    logger.error('Alert queue job failed', { jobId: job.id, error: err.message });
});

// Email queue
export const emailQueue = new Bull<AlertEmailData>('email-sending', REDIS_URL, {
    defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
    },
});

emailQueue.process(async (job) => {
    await sendAlertEmail(job.data);
});

emailQueue.on('failed', (job, err) => {
    logger.error('Email queue job failed', { jobId: job.id, error: err.message });
});

logger.info('Alert and email queues initialized');
