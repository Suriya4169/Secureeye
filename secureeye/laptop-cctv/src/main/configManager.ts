// ===================================================================
// SecureEye CCTV — Config Manager
// ===================================================================

import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';

export interface CameraConfig {
    cameraId: string;
    apiKey: string;
    label: string;
    location: string;
    detectionThreshold: number;
    backendWsUrl: string;
    backendApiUrl: string;
    orgId: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.secureeye');

const store = new Store<CameraConfig>({
    name: 'camera.config',
    cwd: CONFIG_DIR,
    defaults: {
        cameraId: '',
        apiKey: '',
        label: 'Camera',
        location: '',
        detectionThreshold: 0.7,
        backendWsUrl: '',
        backendApiUrl: '',
        orgId: '',
    },
});

export function hasConfig(): boolean {
    return !!store.get('cameraId') && !!store.get('apiKey');
}

export function getConfig(): CameraConfig {
    return {
        cameraId: store.get('cameraId'),
        apiKey: store.get('apiKey'),
        label: store.get('label'),
        location: store.get('location'),
        detectionThreshold: store.get('detectionThreshold'),
        backendWsUrl: store.get('backendWsUrl'),
        backendApiUrl: store.get('backendApiUrl'),
        orgId: store.get('orgId'),
    };
}

export function generateCameraId(): string {
    const id = uuidv4();
    store.set('cameraId', id);
    return id;
}

export function saveConfig(config: Partial<CameraConfig>): void {
    Object.entries(config).forEach(([key, value]) => {
        if (value !== undefined) {
            store.set(key as keyof CameraConfig, value);
        }
    });
}

export function getOrCreateCameraId(): string {
    let id = store.get('cameraId');
    if (!id) {
        id = generateCameraId();
    }
    return id;
}

export default { hasConfig, getConfig, saveConfig, getOrCreateCameraId, generateCameraId };
