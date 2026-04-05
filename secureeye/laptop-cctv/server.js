// ===================================================================
// SecureEye CCTV — Web Server (Shinobi-Inspired Dashboard)
// Email Alerts via Gmail SMTP
// ===================================================================

const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

// Load .env from project root (secureeye/.env)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT = process.env.CCTV_PORT || 5000;
const app = express();

// Parse JSON bodies (for alert snapshots)
app.use(express.json({ limit: '5mb' }));

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Default route - serve login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ===== Gmail SMTP Setup =====
const ALERT_EMAIL = 'dharsaunsuriya10@gmail.com';
const GMAIL_USER = process.env.GMAIL_USER || ALERT_EMAIL;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || '';
const ALERT_CALL_COOLDOWN_MS = Number(process.env.ALERT_CALL_COOLDOWN_MS || 120000);
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';
const TWILIO_TO_NUMBER = process.env.TWILIO_TO_NUMBER || '';
const TWILIO_TWIML_URL = process.env.TWILIO_TWIML_URL || '';

let transporter = null;

if (GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_APP_PASSWORD,
        },
    });
    // ...existing code...
} else {
    // ...existing code...
    // ...existing code...
    // ...existing code...
}

// Track last email time to avoid spam
let lastEmailTime = 0;
const EMAIL_COOLDOWN_MS = 60000; // 1 minute between emails
let lastCallTime = 0;

// ===== Live Frame Store (in-memory for mobile app) =====
const liveFrames = new Map(); // cameraId → { imageBase64, timestamp, label }
let globalStatus = {
    isMonitoring: false,
    fps: 0,
    handsDetected: 0,
    confidence: 0,
    detectionsToday: 0,
    lastAlertTime: null,
};

// Remote monitoring control (mobile app -> browser dashboard)
let controlState = {
    desiredMonitoring: null, // true | false | null
    updatedAt: null,
    source: null,
};

// ===== API Routes =====

// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'secureeye-cctv',
        emailEnabled: !!transporter,
        webhookEnabled: !!ALERT_WEBHOOK_URL,
        voiceCallEnabled: !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER && TWILIO_TO_NUMBER && TWILIO_TWIML_URL),
    });
});

async function triggerWebhookAlert(payload) {
    if (!ALERT_WEBHOOK_URL) {
        return { sent: false, reason: 'ALERT_WEBHOOK_URL not configured' };
    }

    try {
        const response = await fetch(ALERT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            return { sent: false, reason: `Webhook HTTP ${response.status}` };
        }

        return { sent: true };
    } catch (error) {
        return { sent: false, reason: error.message };
    }
}

async function triggerVoiceCall({ detectedPeople, confidence }) {
    const twilioEnabled = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER && TWILIO_TO_NUMBER && TWILIO_TWIML_URL);

    if (!twilioEnabled) {
        return { sent: false, reason: 'Twilio voice call not configured' };
    }

    const now = Date.now();
    if (now - lastCallTime < ALERT_CALL_COOLDOWN_MS) {
        const remaining = Math.ceil((ALERT_CALL_COOLDOWN_MS - (now - lastCallTime)) / 1000);
        return { sent: false, reason: `Call cooldown: ${remaining}s remaining` };
    }

    const confidencePct = (confidence * 100).toFixed(1);
    const params = new URLSearchParams({
        To: TWILIO_TO_NUMBER,
        From: TWILIO_FROM_NUMBER,
        Url: TWILIO_TWIML_URL,
        StatusCallbackEvent: 'initiated ringing answered completed',
    });

    try {
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        if (!response.ok) {
            const body = await response.text();
            return { sent: false, reason: `Twilio HTTP ${response.status}: ${body}` };
        }

        lastCallTime = now;
        // ...existing code...
        return { sent: true };
    } catch (error) {
        return { sent: false, reason: error.message };
    }
}

// Alert email endpoint
app.post('/api/alert', async (req, res) => {
    const { confidence, numHands, numPeople, imageBase64, timestamp } = req.body;
    const detectedPeople = numPeople ?? numHands ?? 0;
    const now = Date.now();

    // Cooldown check
    if (now - lastEmailTime < EMAIL_COOLDOWN_MS) {
        const remaining = Math.ceil((EMAIL_COOLDOWN_MS - (now - lastEmailTime)) / 1000);
        return res.json({ sent: false, reason: `Cooldown: ${remaining}s remaining` });
    }

    lastEmailTime = now;
    let emailResult = { sent: false, reason: 'Email not configured (GMAIL_APP_PASSWORD not set)' };

    try {
        // Build email
        const timeStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const confidenceStr = (confidence * 100).toFixed(1);

        const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e4e8ef; border-radius: 12px; overflow: hidden; border: 1px solid #222;">
            <div style="background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 20px 24px;">
                <h1 style="margin: 0; font-size: 20px; color: white;">🛡️ SecureEye — Security Alert</h1>
            </div>
            <div style="padding: 24px;">
                <div style="background: rgba(239,68,68,0.1); border: 1px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                    <h2 style="margin: 0 0 8px; color: #ef4444; font-size: 18px;">⚠️ Person Detected — Possible Threat</h2>
                    <p style="margin: 0; color: #888; font-size: 14px;">Person detected in the camera feed</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #222; color: #888; font-size: 13px;">Time</td>
                        <td style="padding: 10px; border-bottom: 1px solid #222; font-weight: 600; font-size: 14px;">${timeStr}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #222; color: #888; font-size: 13px;">Persons Detected</td>
                        <td style="padding: 10px; border-bottom: 1px solid #222; font-weight: 600; font-size: 14px; color: #ef4444;">${detectedPeople}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #222; color: #888; font-size: 13px;">Confidence</td>
                        <td style="padding: 10px; border-bottom: 1px solid #222; font-weight: 600; font-size: 14px; color: #f59e0b;">${confidenceStr}%</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; color: #888; font-size: 13px;">Camera</td>
                        <td style="padding: 10px; font-weight: 600; font-size: 14px;">CAM-01 — Webcam</td>
                    </tr>
                </table>
                ${imageBase64 ? `
                <div style="margin-bottom: 16px;">
                    <p style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">📸 Snapshot at time of detection:</p>
                    <img src="cid:alertSnapshot" style="width: 100%; border-radius: 8px; border: 1px solid #222;" alt="Alert Snapshot" />
                </div>
                ` : ''}
                <p style="color: #555; font-size: 11px; text-align: center; margin-top: 20px;">
                    SecureEye — Shinobi-Inspired Surveillance System<br/>
                    This is an automated alert. Do not reply.
                </p>
            </div>
        </div>`;

        const mailOptions = {
            from: `"🛡️ SecureEye Alert" <${GMAIL_USER}>`,
            to: ALERT_EMAIL,
            subject: `⚠️ SECURITY ALERT: ${detectedPeople} Person(s) Detected (${confidenceStr}% confidence)`,
            html: htmlBody,
            attachments: imageBase64 ? [{
                filename: 'alert-snapshot.jpg',
                content: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                encoding: 'base64',
                cid: 'alertSnapshot',
            }] : [],
        };

        if (transporter) {
            await transporter.sendMail(mailOptions);
            // ...existing code...
            emailResult = { sent: true };
        }
    } catch (err) {
        console.error('📧 Email failed:', err.message);
        emailResult = { sent: false, reason: err.message };
    }

    const [callResult, webhookResult] = await Promise.all([
        triggerVoiceCall({ detectedPeople, confidence }),
        triggerWebhookAlert({
            event: 'secureeye.alert',
            timestamp: new Date().toISOString(),
            detectedPeople,
            confidence,
            camera: 'CAM-01 — Webcam',
        }),
    ]);

    storeAlertForMobile({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        confidence,
        numPeople: detectedPeople,
        imageBase64: imageBase64 ? imageBase64.substring(0, 100) + '...' : null,
        hasSnapshot: !!imageBase64,
    });

    const sent = emailResult.sent || callResult.sent || webhookResult.sent;
    res.json({
        sent,
        channels: {
            email: emailResult,
            voiceCall: callResult,
            webhook: webhookResult,
        },
    });
});

// ===== Live Frame Endpoints (for mobile app) =====

// Receive frame from browser dashboard
app.post('/api/live-frame', (req, res) => {
    const { cameraId, imageBase64, label, status } = req.body;
    if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'No image data' });
    }

    const id = cameraId || 'default';
    liveFrames.set(id, {
        imageBase64,
        timestamp: new Date().toISOString(),
        label: label || 'CAM-01',
    });

    // Update global status if provided
    if (status) {
        globalStatus = { ...globalStatus, ...status };
    }

    res.json({ success: true });
});

// Remote monitoring commands from mobile app
app.post('/api/monitoring/start', (_req, res) => {
    controlState = {
        desiredMonitoring: true,
        updatedAt: new Date().toISOString(),
        source: 'mobile-app',
    };
    res.json({ success: true, data: controlState });
});

app.post('/api/monitoring/stop', (_req, res) => {
    controlState = {
        desiredMonitoring: false,
        updatedAt: new Date().toISOString(),
        source: 'mobile-app',
    };
    res.json({ success: true, data: controlState });
});

// Serve latest frame to mobile app
app.get('/api/live-frame', (req, res) => {
    const cameraId = req.query.cameraId || 'default';
    const frame = liveFrames.get(cameraId);

    if (!frame) {
        // Check if any frame exists
        const firstFrame = liveFrames.values().next().value;
        if (firstFrame) {
            return res.json({ success: true, data: firstFrame });
        }
        return res.json({ success: false, error: 'No frames available' });
    }

    res.json({ success: true, data: frame });
});

// Camera status endpoint for mobile
app.get('/api/status', (_req, res) => {
    const cameras = [];
    for (const [id, frame] of liveFrames.entries()) {
        const age = Date.now() - new Date(frame.timestamp).getTime();
        cameras.push({
            id,
            label: frame.label,
            isOnline: age < 10000, // online if frame received within 10s
            lastFrame: frame.timestamp,
        });
    }

    res.json({
        success: true,
        data: {
            ...globalStatus,
            cameras,
            control: controlState,
            serverTime: new Date().toISOString(),
        },
    });
});

// List of recent alerts for mobile (in-memory)
const recentAlerts = [];

app.get('/api/mobile-alerts', (_req, res) => {
    res.json({ success: true, data: recentAlerts });
});

// Internal: store alerts when they happen (called from alert endpoint)
function storeAlertForMobile(alertData) {
    recentAlerts.unshift(alertData);
    if (recentAlerts.length > 50) recentAlerts.pop();
}

app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let wifiIP = 'localhost';
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('100.')) {
                wifiIP = iface.address;
                break;
            }
        }
    }
    
    // ...existing code...
    // ...existing code...
    // ...existing code...
    // ...existing code...
    // ...existing code...
    // ...existing code...
});
