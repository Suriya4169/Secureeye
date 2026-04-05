// ===================================================================
// SecureEye Backend — Camera Service
// ===================================================================

import supabase from '../utils/supabase';
import logger from '../utils/logger';
import type { Camera, CameraRegistration, CameraRegistrationResponse } from '@secureeye/shared';

export async function registerCamera(
    data: CameraRegistration
): Promise<CameraRegistrationResponse> {
    // Check if camera already exists
    const { data: existing } = await supabase
        .from('cameras')
        .select('id, api_key')
        .eq('id', data.cameraId)
        .single();

    if (existing) {
        // Update existing camera
        const { data: updated, error } = await supabase
            .from('cameras')
            .update({
                tailscale_ip: data.tailscaleIp,
                label: data.label,
                location: data.location,
                last_seen: new Date().toISOString(),
                status: 'active',
            })
            .eq('id', data.cameraId)
            .select()
            .single();

        if (error) throw new Error(`Camera update failed: ${error.message}`);

        logger.info('Camera re-registered', { cameraId: data.cameraId });
        return { apiKey: existing.api_key, camera: updated as Camera };
    }

    // Create new camera
    const { data: camera, error } = await supabase
        .from('cameras')
        .insert({
            id: data.cameraId,
            org_id: data.orgId,
            tailscale_ip: data.tailscaleIp,
            label: data.label,
            location: data.location || null,
            status: 'active',
            last_seen: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw new Error(`Camera registration failed: ${error.message}`);

    // Log audit
    await supabase.from('audit_logs').insert({
        org_id: data.orgId,
        action: 'camera_registered',
        metadata: { cameraId: data.cameraId, label: data.label },
    });

    logger.info('Camera registered', { cameraId: data.cameraId, orgId: data.orgId });
    return { apiKey: camera.api_key, camera: camera as Camera };
}

export async function updateCameraStatus(
    cameraId: string,
    status: string,
    isMonitoring?: boolean
): Promise<void> {
    const update: Record<string, unknown> = {
        status,
        last_seen: new Date().toISOString(),
    };
    if (isMonitoring !== undefined) update.is_monitoring = isMonitoring;

    const { error } = await supabase.from('cameras').update(update).eq('id', cameraId);

    if (error) {
        logger.error('Camera status update failed', { cameraId, error: error.message });
    }
}

export async function verifyCameraApiKey(
    cameraId: string,
    apiKey: string
): Promise<Camera | null> {
    const { data, error } = await supabase
        .from('cameras')
        .select('*')
        .eq('id', cameraId)
        .eq('api_key', apiKey)
        .single();

    if (error || !data) return null;
    return data as Camera;
}
