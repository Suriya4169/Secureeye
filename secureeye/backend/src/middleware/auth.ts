// ===================================================================
// SecureEye Backend — Auth Middleware (Supabase JWT Verification)
// ===================================================================

import { Request, Response, NextFunction } from 'express';
import supabase from '../utils/supabase';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
    userId?: string;
    userEmail?: string;
}

export const authMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
            return;
        }

        const token = authHeader.split(' ')[1];

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token);

        if (error || !user) {
            logger.warn('Invalid JWT token attempt', { error: error?.message });
            res.status(401).json({ success: false, error: 'Invalid or expired token' });
            return;
        }

        req.userId = user.id;
        req.userEmail = user.email;
        next();
    } catch (err) {
        logger.error('Auth middleware error', { error: err });
        res.status(500).json({ success: false, error: 'Authentication failed' });
    }
};

export default authMiddleware;
