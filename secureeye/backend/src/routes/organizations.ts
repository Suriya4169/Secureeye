// ===================================================================
// SecureEye Backend — Organization Routes
// ===================================================================

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import authMiddleware from '../middleware/auth';
import { validate } from '../middleware/validate';
import supabase from '../utils/supabase';
import logger from '../utils/logger';
import { createOrgSchema, joinOrgSchema } from '@secureeye/shared';

const router = Router();

// All org routes require authentication
router.use(authMiddleware);

// GET /api/orgs — list user's organizations
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { data: memberships, error } = await supabase
            .from('org_members')
            .select(`
        role,
        organizations:org_id (
          id, name, invite_code, owner_id, max_cameras, max_members, plan, created_at
        )
      `)
            .eq('user_id', req.userId!);

        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }

        const orgs = memberships?.map((m: any) => ({
            ...m.organizations,
            myRole: m.role,
        })) || [];

        res.json({ success: true, data: orgs });
    } catch (err) {
        logger.error('List orgs error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to list organizations' });
    }
});

// POST /api/orgs — create organization
router.post('/', validate(createOrgSchema), async (req: AuthRequest, res: Response) => {
    try {
        const { name } = req.body;

        const { data: org, error } = await supabase
            .from('organizations')
            .insert({ name, owner_id: req.userId })
            .select()
            .single();

        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }

        // Add creator as owner member
        await supabase.from('org_members').insert({
            org_id: org.id,
            user_id: req.userId,
            role: 'owner',
        });

        // Audit log
        await supabase.from('audit_logs').insert({
            org_id: org.id,
            user_id: req.userId,
            action: 'org_created',
            metadata: { name },
        });

        logger.info('Organization created', { orgId: org.id, userId: req.userId });
        res.status(201).json({ success: true, data: org });
    } catch (err) {
        logger.error('Create org error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to create organization' });
    }
});

// POST /api/orgs/join — join via invite code
router.post('/join', validate(joinOrgSchema), async (req: AuthRequest, res: Response) => {
    try {
        const { inviteCode } = req.body;

        // Find org by invite code
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id, name, max_members')
            .eq('invite_code', inviteCode)
            .single();

        if (orgError || !org) {
            res.status(404).json({ success: false, error: 'Invalid invite code' });
            return;
        }

        // Check member count
        const { count } = await supabase
            .from('org_members')
            .select('id', { count: 'exact' })
            .eq('org_id', org.id);

        if (count && count >= org.max_members) {
            res.status(400).json({ success: false, error: 'Organization has reached maximum members' });
            return;
        }

        // Check if already a member
        const { data: existing } = await supabase
            .from('org_members')
            .select('id')
            .eq('org_id', org.id)
            .eq('user_id', req.userId!)
            .single();

        if (existing) {
            res.status(400).json({ success: false, error: 'You are already a member of this organization' });
            return;
        }

        // Add as viewer
        await supabase.from('org_members').insert({
            org_id: org.id,
            user_id: req.userId,
            role: 'viewer',
        });

        // Audit
        await supabase.from('audit_logs').insert({
            org_id: org.id,
            user_id: req.userId,
            action: 'member_joined',
            metadata: { inviteCode },
        });

        logger.info('User joined org', { orgId: org.id, userId: req.userId });
        res.json({ success: true, data: { orgId: org.id, name: org.name, role: 'viewer' } });
    } catch (err) {
        logger.error('Join org error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to join organization' });
    }
});

// GET /api/orgs/:orgId/members — list members
router.get('/:orgId/members', async (req: AuthRequest, res: Response) => {
    try {
        const { orgId } = req.params;

        const { data: members, error } = await supabase
            .from('org_members')
            .select(`
        id, role, joined_at,
        profiles:user_id (id, full_name, avatar_url, role)
      `)
            .eq('org_id', orgId);

        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }

        res.json({ success: true, data: members });
    } catch (err) {
        logger.error('List members error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to list members' });
    }
});

// DELETE /api/orgs/:orgId/members/:uid — remove member
router.delete('/:orgId/members/:uid', async (req: AuthRequest, res: Response) => {
    try {
        const { orgId, uid } = req.params;

        // Verify requester is owner
        const { data: requesterMembership } = await supabase
            .from('org_members')
            .select('role')
            .eq('org_id', orgId)
            .eq('user_id', req.userId!)
            .single();

        if (!requesterMembership || requesterMembership.role !== 'owner') {
            res.status(403).json({ success: false, error: 'Only the owner can remove members' });
            return;
        }

        // Cannot remove the owner
        if (uid === req.userId) {
            res.status(400).json({ success: false, error: 'Owner cannot remove themselves' });
            return;
        }

        const { error } = await supabase
            .from('org_members')
            .delete()
            .eq('org_id', orgId)
            .eq('user_id', uid);

        if (error) {
            res.status(500).json({ success: false, error: error.message });
            return;
        }

        await supabase.from('audit_logs').insert({
            org_id: orgId,
            user_id: req.userId,
            action: 'member_removed',
            metadata: { removedUserId: uid },
        });

        res.json({ success: true, message: 'Member removed' });
    } catch (err) {
        logger.error('Remove member error', { error: err });
        res.status(500).json({ success: false, error: 'Failed to remove member' });
    }
});

export default router;
