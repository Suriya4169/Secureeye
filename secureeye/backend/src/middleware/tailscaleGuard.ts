// ===================================================================
// SecureEye Backend — Tailscale Guard Middleware
// ===================================================================

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

const TAILSCALE_CIDR_START = ipToLong('100.64.0.0');
const TAILSCALE_CIDR_END = ipToLong('100.127.255.255'); // /10 range

function ipToLong(ip: string): number {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isInTailscaleRange(ip: string): boolean {
    // Strip IPv6 prefix
    const cleanIp = ip.replace(/^::ffff:/, '');
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return false;

    const ipLong = ipToLong(cleanIp);
    return ipLong >= TAILSCALE_CIDR_START && ipLong <= TAILSCALE_CIDR_END;
}

export const tailscaleGuard = (req: Request, res: Response, next: NextFunction): void => {
    // Skip in development
    if (process.env.NODE_ENV === 'development') {
        next();
        return;
    }

    const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        '';

    if (!isInTailscaleRange(clientIp)) {
        logger.warn('Blocked non-Tailscale request', { ip: clientIp, path: req.path });
        res.status(403).json({
            success: false,
            error: 'Access denied: request must come from Tailscale network',
        });
        return;
    }

    next();
};

export default tailscaleGuard;
