// ===================================================================
// SecureEye Backend — Rate Limiting Middleware (Redis-based)
// ===================================================================

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import logger from '../utils/logger';

let redis: Redis | null = null;

try {
    if (process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
        redis.on('error', (err) => {
            logger.warn('Redis connection error (rate limiting disabled)', { error: err.message });
        });
    }
} catch {
    logger.warn('Redis not available, rate limiting disabled');
}

interface RateLimitOptions {
    windowMs: number;      // time window in ms
    maxRequests: number;   // max requests per window
    keyPrefix?: string;
}

export function rateLimit(options: RateLimitOptions) {
    const { windowMs, maxRequests, keyPrefix = 'rl' } = options;
    const windowS = Math.ceil(windowMs / 1000);

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Skip rate limiting if Redis is not available
        if (!redis) {
            next();
            return;
        }

        const clientIp =
            (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
            req.socket.remoteAddress ||
            'unknown';

        const key = `${keyPrefix}:${clientIp}:${req.path}`;

        try {
            const current = await redis.incr(key);
            if (current === 1) {
                await redis.expire(key, windowS);
            }

            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

            if (current > maxRequests) {
                const ttl = await redis.ttl(key);
                res.setHeader('Retry-After', ttl);
                res.status(429).json({
                    success: false,
                    error: 'Too many requests. Please try again later.',
                    retryAfter: ttl,
                });
                return;
            }

            next();
        } catch (err) {
            logger.error('Rate limit error', { error: err });
            // Fail open — allow request if Redis fails
            next();
        }
    };
}

export const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyPrefix: 'rl:login',
});

export const apiRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'rl:api',
});

export default rateLimit;
