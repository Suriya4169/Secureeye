// ===================================================================
// SecureEye Backend — Notification Routes
// ===================================================================

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import authMiddleware from '../middleware/auth';
import { validate } from '../middleware/validate';
import supabase from '../utils/supabase';
import logger from '../utils/logger';
import { fcmTokenSchema } from '@secureeye/shared';

const router = Router();
router.use(authMiddleware);

// POST /api/notifications/token — save FCM token
router.post('/token', validate(fcmTokenSchema), async (req: AuthRequest, res: Response) => {
    try {
        const { token, deviceInfo } = req.body;

        // Upsert session with FCM token
        const { error } = await supabase.from('user_sessions').upsert(
            {
                user_id: req.userId,
                fcm_token: token,
                device_info: deviceInfo || req.headers['user-agent'] || '',
                last_active: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
        );

        if (error) {
            // If upsert fails, try insert
            await supabase.from('user_sessions').insert({
                user_id: req.userId,
                fcm_token: token,
                device_info: deviceInfo || req.headers['user-agent'] || '',
            });
        }

        logger.info('FCM token saved', { userId: req.userId });
        res.json({ success: true, message: 'FCM token saved' });
    } catch (err) {
        logger.error('Save FCM token error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to save FCM token' });
    }
});

export default router;
