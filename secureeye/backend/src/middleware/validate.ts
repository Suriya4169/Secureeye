// ===================================================================
// SecureEye Backend — Zod Validation Middleware
// ===================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const data = schema.parse(req[target]);
            // Replace with parsed & sanitized data
            (req as any)[target] = data;
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                const errors = err.errors.map((e: { path: (string | number)[]; message: string }) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors,
                });
                return;
            }
            next(err);
        }
    };
}

export default validate;
