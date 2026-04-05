// ===================================================================
// SecureEye Backend — Camera Routes
// ===================================================================

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import authMiddleware from '../middleware/auth';
import tailscaleGuard from '../middleware/tailscaleGuard';
import { validate } from '../middleware/validate';
import supabase from '../utils/supabase';
import logger from '../utils/logger';
import { registerCamera } from '../services/cameraService';
import {
    registerCameraSchema,
    updateCameraSchema,
    cameraCommandSchema,
} from '@secureeye/shared';

const router = Router();

// POST /api/cameras/register — register new camera (from laptop, Tailscale-only)
router.post(
    '/register',
    tailscaleGuard,
    validate(registerCameraSchema),
    async (req: AuthRequest, res: Response) => {
        try {
            const result = await registerCamera(req.body);
            res.status(201).json({ success: true, data: result });
        } catch (err: any) {
            logger.error('Camera register error', { error: err });
            res.status(500).json({ success: false, error: err.message });
        }
    }
);

// --- All routes below require auth ---
router.use(authMiddleware);

// GET /api/cameras — list all cameras in user's org
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const orgId = req.query.orgId as string;

        if (!orgId) {
            // Get user's first org
            const { data: membership } = await supabase
                .from('org_members')
                .select('org_id')
                .eq('user_id', req.userId!)
                .limit(1)
                .single();

            if (!membership) {
                res.json({ success: true, data: [] });
                return;
            }

            const { data: cameras, error } = await supabase
                .from('cameras')
                .select('*')
                .eq('org_id', membership.org_id)
                .order('created_at', { ascending: false });

            if (error) {
                res.status(500).json({ success: false, error: error.message });
                return;
            }

            res.json({ success: true, data: cameras });
            return;
        }

        const { data: cameras, error } = await supabase
            .from('cameras')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false });

        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }

        res.json({ success: true, data: cameras });
    } catch (err) {
        logger.error('List cameras error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to list cameras' });
    }
});

// PATCH /api/cameras/:id — update camera settings
router.patch('/:id', validate(updateCameraSchema), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data: camera, error } = await supabase
            .from('cameras')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }

        res.json({ success: true, data: camera });
    } catch (err) {
        logger.error('Update camera error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to update camera' });
    }
});

// DELETE /api/cameras/:id — remove camera
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('cameras').delete().eq('id', id);

        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }

        res.json({ success: true, message: 'Camera deleted' });
    } catch (err) {
        logger.error('Delete camera error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to delete camera' });
    }
});

// POST /api/cameras/:id/command — send command to camera
router.post(
    '/:id/command',
    validate(cameraCommandSchema),
    async (req: AuthRequest, res: Response) => {
        try {
            const { id } = req.params;
            const { action } = req.body;

            const { data: command, error } = await supabase
                .from('commands')
                .insert({
                    camera_id: id,
                    issued_by: req.userId,
                    action,
                })
                .select()
                .single();

            if (error) {
                res.status(500).json({ success: false, error: error.message });
                return;
            }

            // Audit
            await supabase.from('audit_logs').insert({
                org_id: (await supabase.from('cameras').select('org_id').eq('id', id).single()).data
                    ?.org_id,
                user_id: req.userId,
                action: 'command_issued',
                metadata: { cameraId: id, commandId: command.id, commandAction: action },
            });

            res.json({ success: true, data: command });
        } catch (err) {
            logger.error('Send command error', { error: err });
            res.status(500).json({ success: false, error: 'Failed to send command' });
        }
    }
);

// GET /api/cameras/:id/snapshot — get latest snapshot URL
router.get('/:id/snapshot', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const { data: alert, error } = await supabase
            .from('alerts')
            .select('snapshot_url, created_at')
            .eq('camera_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !alert) {
            res.status(404).json({ success: false, error: 'No snapshot found' });
            return;
        }

        res.json({ success: true, data: { snapshotUrl: alert.snapshot_url, takenAt: alert.created_at } });
    } catch (err) {
        logger.error('Get snapshot error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to get snapshot' });
    }
});

export default router;
