// ===================================================================
// SecureEye Backend — Storage Service (Supabase Storage)
// ===================================================================

import sharp from 'sharp';
import supabase from '../utils/supabase';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const BUCKET = 'snapshots';
const MAX_SIZE_KB = 200;

export async function uploadSnapshot(
    imageBase64: string,
    cameraId: string
): Promise<string> {
    try {
        // Decode base64
        const buffer = Buffer.from(imageBase64, 'base64');

        // Compress with sharp to target < 200KB
        const compressed = await sharp(buffer)
            .jpeg({ quality: 70 })
            .resize({ width: 1280, height: 720, fit: 'inside', withoutEnlargement: true })
            .toBuffer();

        // If still too large, reduce quality
        let finalBuffer = compressed;
        if (compressed.length > MAX_SIZE_KB * 1024) {
            finalBuffer = await sharp(buffer)
                .jpeg({ quality: 40 })
                .resize({ width: 800, height: 600, fit: 'inside', withoutEnlargement: true })
                .toBuffer();
        }

        const fileName = `${cameraId}/${uuidv4()}.jpg`;

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(fileName, finalBuffer, {
                contentType: 'image/jpeg',
                upsert: false,
            });

        if (error) {
            throw new Error(`Storage upload failed: ${error.message}`);
        }

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

        logger.info('Snapshot uploaded', { cameraId, fileName, sizeKB: Math.round(finalBuffer.length / 1024) });
        return urlData.publicUrl;
    } catch (err) {
        logger.error('Snapshot upload error', { cameraId, error: err });
        throw err;
    }
}
