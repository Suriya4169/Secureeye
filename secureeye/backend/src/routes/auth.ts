// ===================================================================
// SecureEye Backend — Auth Routes
// ===================================================================

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import supabase from '../utils/supabase';
import logger from '../utils/logger';
import { loginRateLimit } from '../middleware/rateLimit';

const router = Router();

// POST /api/auth/verify-email — resend verification email
router.post('/verify-email', loginRateLimit, async (req: AuthRequest, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ success: false, error: 'Email is required' });
            return;
        }

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
        });

        if (error) {
            res.status(400).json({ success: false, error: error.message });
            return;
        }

        res.json({ success: true, message: 'Verification email sent' });
    } catch (err) {
        logger.error('Verify email error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to send verification email' });
    }
});

// POST /api/auth/logout — invalidate session
router.post('/logout', async (req: AuthRequest, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            await supabase.auth.admin.signOut(token);
        }

        // Remove user session
        if (req.userId) {
            await supabase
                .from('user_sessions')
                .delete()
                .eq('user_id', req.userId)
                .eq('device_info', req.headers['user-agent'] || '');
        }

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        logger.error('Logout error', { error: err });
        res.status(500).json({ success: false, error: 'Logout failed' });
    }
});

export default router;
