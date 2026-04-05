// ===================================================================
// SecureEye CCTV — Electron Main Process
// ===================================================================

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { hasConfig, getConfig, saveConfig, getOrCreateCameraId } from './configManager';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'SecureEye CCTV',
        backgroundColor: '#0a0a0a',
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ----- IPC Handlers -----

// Config
ipcMain.handle('config:has', () => hasConfig());
ipcMain.handle('config:get', () => getConfig());
ipcMain.handle('config:save', (_event, config) => {
    saveConfig(config);
    return true;
});
ipcMain.handle('config:getCameraId', () => getOrCreateCameraId());

// Setup wizard — register camera with backend
ipcMain.handle('setup:register', async (_event, data) => {
    const { backendApiUrl, label, location, orgId } = data;
    const cameraId = getOrCreateCameraId();

    try {
        // Get Tailscale IP (best effort)
        let tailscaleIp = '100.0.0.1'; // placeholder
        try {
            const { execSync } = require('child_process');
            const output = execSync('tailscale ip -4').toString().trim();
            if (output.startsWith('100.')) {
                tailscaleIp = output;
            }
        } catch {
            console.warn('Could not get Tailscale IP, using placeholder');
        }

        const response = await fetch(`${backendApiUrl}/api/cameras/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cameraId,
                tailscaleIp,
                label,
                location,
                orgId,
            }),
        });

        const result = await response.json();

        if (result.success) {
            saveConfig({
                cameraId,
                apiKey: result.data.apiKey,
                label,
                location,
                backendWsUrl: backendApiUrl.replace('http', 'ws').replace('/api', '') + ':3001/ws',
                backendApiUrl,
                orgId,
            });
            return { success: true, cameraId, apiKey: result.data.apiKey };
        } else {
            return { success: false, error: result.error };
        }
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

// Window controls
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});
ipcMain.handle('window:close', () => mainWindow?.close());

// ----- App Lifecycle -----

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
