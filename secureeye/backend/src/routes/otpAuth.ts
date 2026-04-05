// ===================================================================
// SecureEye Backend — OTP Auth Routes
// ===================================================================

import { Router, Request, Response } from 'express';
import { generateOtp, storeOtp, verifyOtp, sendOtpEmail, generateToken, verifyToken } from '../services/otpService';
import { loginRateLimit } from '../middleware/rateLimit';
import logger from '../utils/logger';

const router = Router();

// POST /api/auth/otp/send — Send OTP to email
router.post('/send', loginRateLimit, async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string') {
            res.status(400).json({ success: false, error: 'Valid email is required' });
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ success: false, error: 'Invalid email format' });
            return;
        }

        const otp = generateOtp();
        storeOtp(email.toLowerCase(), otp);

        await sendOtpEmail(email.toLowerCase(), otp);

        res.json({
            success: true,
            message: 'OTP sent to your email',
        });
    } catch (err) {
        logger.error('OTP send error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to send OTP. Please try again.' });
    }
});

// POST /api/auth/otp/verify — Verify OTP and return JWT
router.post('/verify', loginRateLimit, async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            res.status(400).json({ success: false, error: 'Email and OTP are required' });
            return;
        }

        const result = verifyOtp(email.toLowerCase(), otp.toString());

        if (!result.valid) {
            res.status(401).json({ success: false, error: result.error });
            return;
        }

        // Generate JWT token
        const token = generateToken(email.toLowerCase());

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { email: email.toLowerCase() },
        });
    } catch (err) {
        logger.error('OTP verify error', { error: err });
        res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

// GET /api/auth/otp/me — Get current user from JWT
router.get('/me', (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ success: false, error: 'Not authenticated' });
            return;
        }

        const token = authHeader.split(' ')[1];
        const user = verifyToken(token);

        if (!user) {
            res.status(401).json({ success: false, error: 'Invalid or expired token' });
            return;
        }

        res.json({ success: true, user });
    } catch (err) {
        logger.error('Auth me error', { error: err });
        res.status(500).json({ success: false, error: 'Authentication check failed' });
    }
});

export default router;
