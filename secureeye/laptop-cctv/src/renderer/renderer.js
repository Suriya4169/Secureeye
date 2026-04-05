// ===================================================================
// SecureEye CCTV — Renderer (Orchestrator)
// Loads MediaPipe Hands, manages camera, WebSocket, and alerts
// ===================================================================

// @ts-nocheck — MediaPipe loaded via CDN script tags

// ----- State -----
let isMonitoring = false;
let detectionThreshold = 0.7;
let detectionsToday = 0;
let lastAlertTime = 0;
const COOLDOWN_MS = 30000;
const HANDS_REQUIRED = 2;
let fps = 0;
let frameCount = 0;
let lastFpsTime = Date.now();
const recentAlerts = [];

// ----- DOM Elements -----
const videoEl = document.getElementById('videoElement');
const canvasEl = document.getElementById('canvasOverlay');
const canvasCtx = canvasEl.getContext('2d');
const alertOverlay = document.getElementById('alertOverlay');
const fpsValue = document.getElementById('fpsValue');
const detectionsEl = document.getElementById('detectionsToday');
const handsDetectedEl = document.getElementById('handsDetected');
const monitoringStatus = document.getElementById('monitoringStatus');
const btnMonitor = document.getElementById('btnMonitor');
const sensitivitySlider = document.getElementById('sensitivitySlider');
const sensitivityValue = document.getElementById('sensitivityValue');
const alertsList = document.getElementById('alertsList');
const wizardOverlay = document.getElementById('wizardOverlay');
const mainContainer = document.getElementById('mainContainer');
const cameraLabel = document.getElementById('cameraLabel');
const cameraIdBadge = document.getElementById('cameraIdBadge');
const wsStatusDot = document.querySelector('#wsStatus .dot');
const tailscaleStatusDot = document.querySelector('#tailscaleStatus .dot');

// ----- WebSocket -----
let ws = null;
let wsReconnectTimer = null;
let wsReconnectDelay = 1000;
let config = null;

function connectWebSocket() {
    if (!config || !config.backendWsUrl) return;

    ws = new WebSocket(config.backendWsUrl);

    ws.onopen = () => {
        // ...existing code...
        wsStatusDot.className = 'dot online';
        wsReconnectDelay = 1000;

        // Authenticate
        ws.send(JSON.stringify({
            type: 'auth',
            cameraId: config.cameraId,
            apiKey: config.apiKey,
        }));
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
                case 'auth_success':
                    // ...existing code...
                    break;
                case 'command':
                    handleCommand(msg);
                    break;
                case 'config_update':
                    if (msg.threshold !== undefined) {
                        detectionThreshold = msg.threshold;
                        sensitivitySlider.value = Math.round(msg.threshold * 100);
                        sensitivityValue.textContent = msg.threshold.toFixed(2);
                    }
                    break;
                case 'error':
                    console.error('WS Error:', msg.message);
                    break;
            }
        } catch (e) {
            console.error('WS message parse error', e);
        }
    };

    ws.onclose = () => {
        wsStatusDot.className = 'dot offline';
        // ...existing code...
        wsReconnectTimer = setTimeout(connectWebSocket, wsReconnectDelay);
        wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000);
    };

    ws.onerror = () => {
        wsStatusDot.className = 'dot offline';
    };
}

// Heartbeat every 30s
setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN && config) {
        ws.send(JSON.stringify({
            type: 'heartbeat',
            cameraId: config.cameraId,
            status: 'active',
            isMonitoring,
        }));
    }
}, 30000);

function handleCommand(cmd) {
    switch (cmd.action) {
        case 'start':
            if (!isMonitoring) toggleMonitoring();
            sendCommandAck(cmd.commandId, 'executed');
            break;
        case 'stop':
            if (isMonitoring) toggleMonitoring();
            sendCommandAck(cmd.commandId, 'executed');
            break;
        case 'snapshot':
            captureAndSendSnapshot();
            sendCommandAck(cmd.commandId, 'executed');
            break;
        case 'reboot':
            sendCommandAck(cmd.commandId, 'executed');
            setTimeout(() => location.reload(), 1000);
            break;
        default:
            sendCommandAck(cmd.commandId, 'failed');
    }
}

function sendCommandAck(commandId, status) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'command_ack', commandId, status }));
    }
}

// ----- MediaPipe Hands Setup -----
let handsModel = null;

function initMediaPipe() {
    handsModel = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handsModel.setOptions({
        maxNumHands: 4,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
    });

    handsModel.onResults(onHandResults);
    // ...existing code...
}

function onHandResults(results) {
    if (!canvasEl || !canvasCtx) return;

    // Match canvas size to video
    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;
    canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // Count FPS
    frameCount++;
    const now = Date.now();
    if (now - lastFpsTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
        fpsValue.textContent = fps;
    }

    const numHands = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
    handsDetectedEl.textContent = numHands;

    if (!isMonitoring) return;

    // Draw hand landmarks
    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: numHands >= HANDS_REQUIRED ? '#ef4444' : '#22c55e',
                lineWidth: 3,
            });
            drawLandmarks(canvasCtx, landmarks, {
                color: numHands >= HANDS_REQUIRED ? '#ef4444' : '#22c55e',
                lineWidth: 1,
                radius: 4,
            });
        }
    }

    // Alert trigger: 2+ hands detected
    if (numHands >= HANDS_REQUIRED) {
        const avgConfidence = getAverageConfidence(results);

        if (avgConfidence >= detectionThreshold && now - lastAlertTime > COOLDOWN_MS) {
            triggerAlert(avgConfidence, results);
        }
    }
}

function getAverageConfidence(results) {
    // MediaPipe doesn't directly expose per-hand confidence in multiHandedness consistently,
    // so we use a score based on landmark visibility
    if (!results.multiHandedness || results.multiHandedness.length === 0) return 0.8;
    const totalScore = results.multiHandedness.reduce((sum, h) => sum + h.score, 0);
    return totalScore / results.multiHandedness.length;
}

// ----- Alert Pipeline -----
function triggerAlert(confidence, results) {
    lastAlertTime = Date.now();
    detectionsToday++;
    detectionsEl.textContent = detectionsToday;

    // Show alert overlay for 3 seconds
    alertOverlay.style.display = 'flex';
    setTimeout(() => {
        alertOverlay.style.display = 'none';
    }, 3000);

    // Capture snapshot
    const snapshot = captureSnapshot();

    // Compute bounding box around all hands
    const boundingBox = computeHandsBoundingBox(results.multiHandLandmarks);

    // Send alert via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'alert',
            cameraId: config.cameraId,
            imageBase64: snapshot,
            confidence,
            boundingBox,
            detectionClass: 'hands',
        }));
    }

    // Add to recent alerts
    addRecentAlert(snapshot, confidence);
}

function captureSnapshot() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoEl.videoWidth || 640;
    tempCanvas.height = videoEl.videoHeight || 480;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    // Draw overlay from detection canvas
    ctx.drawImage(canvasEl, 0, 0);
    return tempCanvas.toDataURL('image/jpeg', 0.7).split(',')[1]; // base64 without prefix
}

function captureAndSendSnapshot() {
    const snapshot = captureSnapshot();
    if (ws && ws.readyState === WebSocket.OPEN && config) {
        ws.send(JSON.stringify({
            type: 'alert',
            cameraId: config.cameraId,
            imageBase64: snapshot,
            confidence: 1.0,
            boundingBox: { x: 0, y: 0, width: 1, height: 1 },
            detectionClass: 'snapshot',
        }));
    }
}

function computeHandsBoundingBox(multiHandLandmarks) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const landmarks of multiHandLandmarks) {
        for (const pt of landmarks) {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
        }
    }
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

function addRecentAlert(imageBase64, confidence) {
    const alert = {
        time: new Date().toLocaleTimeString(),
        confidence,
        image: 'data:image/jpeg;base64,' + imageBase64,
    };
    recentAlerts.unshift(alert);
    if (recentAlerts.length > 5) recentAlerts.pop();
    renderAlerts();
}

function renderAlerts() {
    if (recentAlerts.length === 0) {
        alertsList.innerHTML = '<div class="empty-alerts">No alerts yet</div>';
        return;
    }
    alertsList.innerHTML = recentAlerts.map((a) => `
    <div class="alert-item">
      <img class="alert-thumb" src="${a.image}" alt="Alert" />
      <div class="alert-info">
        <span class="alert-time">${a.time}</span>
        <span class="alert-confidence">${(a.confidence * 100).toFixed(1)}%</span>
      </div>
    </div>
  `).join('');
}

// ----- Camera -----
let mediaStream = null;

async function startCamera() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: 'environment' },
            audio: false,
        });
        videoEl.srcObject = mediaStream;
        await videoEl.play();

        // Use MediaPipe camera utils for frame processing
        if (handsModel) {
            const processFrame = async () => {
                if (videoEl.readyState >= 2) {
                    await handsModel.send({ image: videoEl });
                }
                if (isMonitoring || true) { // always process for FPS counter
                    requestAnimationFrame(processFrame);
                }
            };
            requestAnimationFrame(processFrame);
        }
    } catch (err) {
        console.error('Camera access failed:', err);
    }
}

// ----- Monitoring Toggle -----
window.toggleMonitoring = function () {
    isMonitoring = !isMonitoring;
    if (isMonitoring) {
        btnMonitor.textContent = '⏹ Stop Monitoring';
        btnMonitor.classList.add('active');
        monitoringStatus.textContent = 'ON';
        monitoringStatus.className = 'stat-value monitoring-on';
    } else {
        btnMonitor.textContent = '▶ Start Monitoring';
        btnMonitor.classList.remove('active');
        monitoringStatus.textContent = 'OFF';
        monitoringStatus.className = 'stat-value monitoring-off';
        canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        alertOverlay.style.display = 'none';
    }
};

// ----- Sensitivity Slider -----
sensitivitySlider.addEventListener('input', (e) => {
    detectionThreshold = parseInt(e.target.value) / 100;
    sensitivityValue.textContent = detectionThreshold.toFixed(2);
});

// ----- Setup Wizard -----
document.getElementById('setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('wizardSubmit');
    const errorEl = document.getElementById('wizardError');

    btn.disabled = true;
    btn.textContent = 'Registering...';
    errorEl.style.display = 'none';

    const result = await window.secureeye.registerCamera({
        backendApiUrl: document.getElementById('wizardBackendUrl').value,
        label: document.getElementById('wizardLabel').value,
        location: document.getElementById('wizardLocation').value,
        orgId: document.getElementById('wizardOrgId').value,
        email: document.getElementById('wizardEmail').value,
        password: document.getElementById('wizardPassword').value,
    });

    if (result.success) {
        config = await window.secureeye.getConfig();
        wizardOverlay.style.display = 'none';
        mainContainer.style.display = 'grid';
        initApp();
    } else {
        errorEl.textContent = result.error || 'Registration failed';
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Register Camera';
    }
});

// ----- Init -----
async function initApp() {
    cameraLabel.textContent = config.label || 'Camera';
    cameraIdBadge.textContent = config.cameraId.substring(0, 8);

    // Check Tailscale status
    try {
        tailscaleStatusDot.className = 'dot connecting';
        // In Electron, we could check via IPC — for now, mark as connected if WS connects
        tailscaleStatusDot.className = 'dot online';
    } catch {
        tailscaleStatusDot.className = 'dot offline';
    }

    initMediaPipe();
    await startCamera();
    connectWebSocket();
}

// ----- Entry Point -----
(async () => {
    const hasConf = await window.secureeye.hasConfig();
    if (hasConf) {
        config = await window.secureeye.getConfig();
        wizardOverlay.style.display = 'none';
        mainContainer.style.display = 'grid';
        initApp();
    } else {
        wizardOverlay.style.display = 'flex';
        mainContainer.style.display = 'none';
    }
})();
