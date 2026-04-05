// ===================================================================
// SecureEye CCTV — Electron Preload (Context Bridge)
// ===================================================================

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('secureeye', {
    // Config
    hasConfig: () => ipcRenderer.invoke('config:has'),
    getConfig: () => ipcRenderer.invoke('config:get'),
    saveConfig: (config: Record<string, unknown>) => ipcRenderer.invoke('config:save', config),
    getCameraId: () => ipcRenderer.invoke('config:getCameraId'),

    // Setup wizard
    registerCamera: (data: {
        backendApiUrl: string;
        label: string;
        location: string;
        orgId: string;
        email: string;
        password: string;
    }) => ipcRenderer.invoke('setup:register', data),

    // App events
    onCommand: (callback: (cmd: { action: string; commandId: string }) => void) => {
        ipcRenderer.on('camera:command', (_event, cmd) => callback(cmd));
    },
    onConfigUpdate: (callback: (config: Record<string, unknown>) => void) => {
        ipcRenderer.on('camera:configUpdate', (_event, config) => callback(config));
    },

    // Window controls
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
});
