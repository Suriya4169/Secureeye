// ===================================================================
// SecureEye Backend — Alert Routes
// ===================================================================

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import authMiddleware from '../middleware/auth';
import supabase from '../utils/supabase';
import logger from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// GET /api/alerts — paginated alert list with filters
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            cameraId,
            startDate,
            endDate,
            minConfidence,
            maxConfidence,
            reviewed,
            page = '1',
            pageSize = '20',
            sortBy = 'newest',
            orgId,
        } = req.query;

        const pageNum = parseInt(page as string, 10);
        const size = Math.min(parseInt(pageSize as string, 10), 100);
        const offset = (pageNum - 1) * size;

        // Determine org
        let targetOrgId = orgId as string;
        if (!targetOrgId) {
            const { data: membership } = await supabase
                .from('org_members')
                .select('org_id')
                .eq('user_id', req.userId!)
                .limit(1)
                .single();
            targetOrgId = membership?.org_id;
        }

        if (!targetOrgId) {
            res.json({ success: true, data: [], total: 0, page: pageNum, pageSize: size, totalPages: 0 });
            return;
        }

        let query = supabase
            .from('alerts')
            .select('*, cameras:camera_id (label, location)', { count: 'exact' })
            .eq('org_id', targetOrgId);

        if (cameraId) query = query.eq('camera_id', cameraId);
        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);
        if (minConfidence) query = query.gte('confidence', parseFloat(minConfidence as string));
        if (maxConfidence) query = query.lte('confidence', parseFloat(maxConfidence as string));
        if (reviewed !== undefined) query = query.eq('reviewed', reviewed === 'true');

        // Sort
        if (sortBy === 'oldest') {
            query = query.order('created_at', { ascending: true });
        } else if (sortBy === 'confidence') {
            query = query.order('confidence', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        query = query.range(offset, offset + size - 1);

        const { data: alerts, error, count } = await query;

        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }

        res.json({
            success: true,
            data: alerts,
            total: count || 0,
            page: pageNum,
            pageSize: size,
            totalPages: Math.ceil((count || 0) / size),
        });
    } catch (err) {
        logger.error('List alerts error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to list alerts' });
    }
});

// GET /api/alerts/:id — alert detail
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { data: alert, error } = await supabase
            .from('alerts')
            .select('*, cameras:camera_id (label, location)')
            .eq('id', req.params.id)
            .single();

        if (error || !alert) {
            res.status(404).json({ success: false, error: 'Alert not found' });
            return;
        }

        res.json({ success: true, data: alert });
    } catch (err) {
        logger.error('Get alert error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to get alert' });
    }
});

// PATCH /api/alerts/:id/reviewed — mark as reviewed
router.patch('/:id/reviewed', async (req: AuthRequest, res: Response) => {
    try {
        const { data: alert, error } = await supabase
            .from('alerts')
            .update({
                reviewed: true,
                reviewed_by: req.userId,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }

        res.json({ success: true, data: alert });
    } catch (err) {
        logger.error('Review alert error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to mark alert as reviewed' });
    }
});

// DELETE /api/alerts/:id — delete alert
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { error } = await supabase.from('alerts').delete().eq('id', req.params.id);

        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }

        res.json({ success: true, message: 'Alert deleted' });
    } catch (err) {
        logger.error('Delete alert error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to delete alert' });
    }
});

export default router;
