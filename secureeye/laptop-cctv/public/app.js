// ===================================================================
// SecureEye CCTV — Shinobi-Inspired Dashboard (App Logic)
// MoveNet Pose (17 keypoints) Person Detection + Alert System
// ===================================================================

// @ts-nocheck — TensorFlow/MoveNet loaded via CDN script tags

// ===== Authentication Check =====
import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js').then(({ initializeApp }) => {
    return import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js').then(({ getAuth, onAuthStateChanged, signOut }) => {
        const firebaseConfig = {
            apiKey: "AIzaSyC_mQv_KWKRb97JYp4prdexH22P8HLNONs",
            authDomain: "mailreciver-af715.firebaseapp.com",
            projectId: "mailreciver-af715",
            storageBucket: "mailreciver-af715.firebasestorage.app",
            messagingSenderId: "904479631615",
            appId: "1:904479631615:web:a778f2175ea9d8e65344ca"
        };
        
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        
        // Check authentication
        onAuthStateChanged(auth, (user) => {
            if (!user) {
                window.location.href = '/login.html';
                return;
            }
            
            // Add logout button to topbar
            const topbarRight = document.querySelector('.topbar-right');
            if (topbarRight && !document.getElementById('logoutBtn')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'logoutBtn';
                logoutBtn.className = 'icon-btn';
                logoutBtn.title = 'Logout';
                logoutBtn.textContent = '🚪';
                logoutBtn.onclick = async () => {
                    await signOut(auth);
                    window.location.href = '/login.html';
                };
                topbarRight.appendChild(logoutBtn);
            }
        });
    });
});

// ===== Configuration & State =====
const state = {
    isMonitoring: false,
    detectionThreshold: 0.7,
    cooldownMs: 30000,
    detectionsToday: 0,
    lastAlertTime: 0,
    fps: 0,
    frameCount: 0,
    lastFpsTime: Date.now(),
    personsRequired: 1,
    alerts: [],
    cameraId: generateId(),
    wsUrl: '',
    label: 'CAM-01 — Webcam',
};

// ===== DOM Elements =====
const $ = (id) => document.getElementById(id);
const videoEl = $('videoElement');
const canvasEl = $('canvasOverlay');
const canvasCtx = canvasEl.getContext('2d');
const alertOverlay = $('alertOverlay');
const primaryCamera = $('primaryCamera');

// ===== Clock =====
function updateClock() {
    const now = new Date();
    $('clock').textContent = now.toLocaleTimeString('en-US', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ===== Utilities =====
function generateId() {
    return 'cam-' + Math.random().toString(36).substring(2, 10);
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('secureeye-settings');
        if (saved) {
            const s = JSON.parse(saved);
            if (s.wsUrl) state.wsUrl = s.wsUrl;
            if (s.label) state.label = s.label;
            if (s.cameraId) state.cameraId = s.cameraId;
        }
    } catch { /* ignore */ }
}

function saveSettings() {
    localStorage.setItem('secureeye-settings', JSON.stringify({
        wsUrl: state.wsUrl,
        label: state.label,
        cameraId: state.cameraId,
    }));
}

// ===== MoveNet Pose Setup =====
let poseDetector = null;

const MOVENET_KEYPOINT_CONNECTIONS = [
    [0, 1], [0, 2], [1, 3], [2, 4],
    [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
    [5, 11], [6, 12], [11, 12],
    [11, 13], [13, 15], [12, 14], [14, 16],
];

async function initPoseModel() {
    updateStatus('detectionStatus', 'connecting');

    await tf.setBackend('webgl');
    await tf.ready();

    poseDetector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true,
        }
    );

    // ...existing code...
    updateStatus('detectionStatus', 'online');
}

// ===== Person Detection Results =====
function onPoseResults(poses) {
    if (!canvasEl || !canvasCtx) return;

    // Sync canvas to video dimensions
    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;
    canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // FPS counter
    state.frameCount++;
    const now = Date.now();
    if (now - state.lastFpsTime >= 1000) {
        state.fps = state.frameCount;
        state.frameCount = 0;
        state.lastFpsTime = now;
        $('fpsValue').textContent = state.fps;
    }

    const confidentPoses = (poses || []).filter((pose) => {
        const kp = (pose.keypoints || []).filter((p) => (p.score || 0) >= state.detectionThreshold);
        return kp.length >= 5;
    });
    const numPersons = confidentPoses.length;
    $('handsDetected').textContent = numPersons;

    // Update resolution display
    if (videoEl.videoWidth) {
        $('resolutionValue').textContent = `${videoEl.videoWidth}×${videoEl.videoHeight}`;
    }

    if (!state.isMonitoring) return;

    // Draw pose keypoints/skeleton
    if (confidentPoses.length > 0) {
        const isAlert = numPersons >= state.personsRequired;

        for (const pose of confidentPoses) {
            const keypoints = pose.keypoints || [];

            for (const [a, b] of MOVENET_KEYPOINT_CONNECTIONS) {
                const p1 = keypoints[a];
                const p2 = keypoints[b];
                if (!p1 || !p2 || (p1.score || 0) < state.detectionThreshold || (p2.score || 0) < state.detectionThreshold) continue;

                canvasCtx.beginPath();
                canvasCtx.moveTo(p1.x, p1.y);
                canvasCtx.lineTo(p2.x, p2.y);
                canvasCtx.strokeStyle = isAlert ? '#ef4444' : '#10b981';
                canvasCtx.lineWidth = 3;
                canvasCtx.stroke();
            }

            for (const point of keypoints) {
                if ((point.score || 0) < state.detectionThreshold) continue;
                canvasCtx.beginPath();
                canvasCtx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
                canvasCtx.fillStyle = isAlert ? '#ef4444' : '#10b981';
                canvasCtx.fill();
            }

            drawPoseBoundingBox(keypoints, isAlert);
        }
    }

    // Get confidence
    const avgConfidence = getAveragePoseConfidence(confidentPoses);
    $('confidenceValue').textContent = avgConfidence > 0 ? (avgConfidence * 100).toFixed(0) + '%' : '--';

    // Trigger alert if person detected
    if (numPersons >= state.personsRequired) {
        if (avgConfidence >= state.detectionThreshold && now - state.lastAlertTime > state.cooldownMs) {
            triggerAlert(avgConfidence, confidentPoses, numPersons);
        }

        // Flash the camera card
        primaryCamera.classList.add('alerting');
        updateStatus('detectionStatus', 'alert');
    } else {
        primaryCamera.classList.remove('alerting');
        if (state.isMonitoring) updateStatus('detectionStatus', 'online');
    }
}

// ===== Drawing Helpers =====
function drawPoseBoundingBox(keypoints, isAlert) {
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    let validPoints = 0;
    for (const pt of keypoints) {
        if ((pt.score || 0) < state.detectionThreshold) continue;
        validPoints++;
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
    }

    if (validPoints === 0) return;

    const pad = 12;

    canvasCtx.strokeStyle = isAlert ? '#ef4444' : '#10b981';
    canvasCtx.lineWidth = 2;
    canvasCtx.setLineDash([6, 4]);
    canvasCtx.strokeRect(
        Math.max(0, minX - pad),
        Math.max(0, minY - pad),
        (maxX - minX) + pad * 2,
        (maxY - minY) + pad * 2
    );
    canvasCtx.setLineDash([]);

    // Label
    canvasCtx.fillStyle = isAlert ? '#ef4444' : '#10b981';
    canvasCtx.font = '600 12px Inter, sans-serif';
    canvasCtx.fillText(
        isAlert ? '⚠ PERSON' : '✓ PERSON',
        minX - 6,
        minY - 6
    );
}

function getAveragePoseConfidence(poses) {
    if (!poses || poses.length === 0) return 0;
    let total = 0;
    let count = 0;

    for (const pose of poses) {
        for (const point of pose.keypoints || []) {
            const score = point.score || 0;
            if (score >= state.detectionThreshold) {
                total += score;
                count += 1;
            }
        }
    }

    return count === 0 ? 0 : total / count;
}

// ===== Alert Pipeline =====
function triggerAlert(confidence, poses, numPersons) {
    state.lastAlertTime = Date.now();
    state.detectionsToday++;
    $('detectionsToday').textContent = state.detectionsToday;

    // Show alert overlay for 3 seconds
    alertOverlay.classList.add('active');
    setTimeout(() => {
        alertOverlay.classList.remove('active');
    }, 3000);

    // Capture snapshot
    const snapshot = captureSnapshot();

    // Compute bounding box
    const boundingBox = computePoseBoundingBox(poses);

    // Send via WebSocket (if connected)
    sendWSAlert(snapshot, confidence, boundingBox);

    // Send email alert
    sendEmailAlert(snapshot, confidence, numPersons);

    // Add to timeline
    addAlertToTimeline(snapshot, confidence, numPersons);

    // Sound (short beep)
    playAlertSound();

    // ...existing code...
}

function captureSnapshot() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoEl.videoWidth || 640;
    tempCanvas.height = videoEl.videoHeight || 480;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    ctx.drawImage(canvasEl, 0, 0);
    return tempCanvas.toDataURL('image/jpeg', 0.7);
}

function computePoseBoundingBox(poses) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const pose of poses) {
        for (const pt of pose.keypoints || []) {
            if ((pt.score || 0) < state.detectionThreshold) continue;
            const nx = pt.x / (videoEl.videoWidth || 1);
            const ny = pt.y / (videoEl.videoHeight || 1);
            if (nx < minX) minX = nx;
            if (ny < minY) minY = ny;
            if (nx > maxX) maxX = nx;
            if (ny > maxY) maxY = ny;
        }
    }

    if (maxX <= minX || maxY <= minY) {
        return { x: 0, y: 0, width: 1, height: 1 };
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function playAlertSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
    } catch { /* ignore audio errors */ }
}

// ===== Alert Timeline =====
function addAlertToTimeline(snapshot, confidence, numPersons) {
    const alert = {
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        confidence,
        numHands: numPersons,
        image: snapshot,
    };
    state.alerts.unshift(alert);
    if (state.alerts.length > 20) state.alerts.pop();

    $('alertCount').textContent = state.alerts.length;
    renderAlerts();
}

function renderAlerts() {
    const list = $('alertsList');
    if (state.alerts.length === 0) {
        list.innerHTML = `
            <div class="empty-alerts">
                <span class="empty-icon">🔇</span>
                <span>No alerts yet</span>
                <span class="empty-hint">Start monitoring to detect people</span>
            </div>`;
        return;
    }

    list.innerHTML = state.alerts.map((a, i) => `
        <div class="alert-item" style="animation-delay: ${i * 50}ms">
            <img class="alert-thumb" src="${a.image}" alt="Alert snapshot" />
            <div class="alert-info">
                <span class="alert-time">${a.time}</span>
                <span class="alert-confidence">${(a.confidence * 100).toFixed(1)}%</span>
                <span class="alert-hands">${a.numHands} person(s) detected</span>
            </div>
        </div>
    `).join('');
}

// ===== Email Alerts =====
async function sendEmailAlert(snapshot, confidence, numPersons) {
    try {
        const response = await fetch('/api/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                confidence,
                numHands: numPersons,
                numPeople: numPersons,
                imageBase64: snapshot,
                timestamp: new Date().toISOString(),
            }),
        });
        const result = await response.json();
        if (result.sent) {
            // ...existing code...
        } else {
            // ...existing code...
        }
    } catch (err) {
        console.warn('[SecureEye] 📧 Email request failed:', err.message);
    }
}

// ===== WebSocket (optional — works without backend) =====
let ws = null;

function connectWebSocket() {
    if (!state.wsUrl) {
        updateStatus('backendStatus', 'offline');
        return;
    }

    updateStatus('backendStatus', 'connecting');

    try {
        ws = new WebSocket(state.wsUrl);

        ws.onopen = () => {
            // ...existing code...
            updateStatus('backendStatus', 'online');

            // Authenticate
            ws.send(JSON.stringify({
                type: 'auth',
                cameraId: state.cameraId,
                apiKey: 'demo-key',
            }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'auth_success') {
                    // ...existing code...
                }
            } catch { /* ignore */ }
        };

        ws.onclose = () => {
            updateStatus('backendStatus', 'offline');
            // Reconnect after 5s
            setTimeout(() => connectWebSocket(), 5000);
        };

        ws.onerror = () => {
            updateStatus('backendStatus', 'offline');
        };
    } catch {
        updateStatus('backendStatus', 'offline');
    }
}

function sendWSAlert(snapshot, confidence, boundingBox) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
        type: 'alert',
        cameraId: state.cameraId,
        imageBase64: snapshot.split(',')[1],
        confidence,
        boundingBox,
        detectionClass: 'person',
    }));
}

// ===== Status Helpers =====
function updateStatus(elementId, status) {
    const pill = $(elementId);
    if (!pill) return;
    const dot = pill.querySelector('.status-dot');
    if (!dot) return;
    dot.className = 'status-dot ' + status;

    if (status === 'online') pill.classList.add('active');
    else pill.classList.remove('active');
}

// ===== Camera =====
let mediaStream = null;

async function startCamera() {
    try {
        updateStatus('cameraStatus', 'connecting');

        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
            audio: false,
        });

        videoEl.srcObject = mediaStream;
        await videoEl.play();

        updateStatus('cameraStatus', 'online');

        // Start processing frames
        if (poseDetector) {
            const processFrame = async () => {
                if (videoEl.readyState >= 2) {
                    const poses = await poseDetector.estimatePoses(videoEl, {
                        maxPoses: 3,
                        flipHorizontal: false,
                    });
                    onPoseResults(poses);
                }
                requestAnimationFrame(processFrame);
            };
            requestAnimationFrame(processFrame);
        }

        // ...existing code...
    } catch (err) {
        console.error('[SecureEye] Camera access failed:', err);
        updateStatus('cameraStatus', 'offline');
    }
}

// ===== Monitoring Toggle =====
function toggleMonitoring() {
    state.isMonitoring = !state.isMonitoring;
    const btn = $('btnMonitor');
    const statusEl = $('monitoringStatus');
    const recDot = $('recDot');

    if (state.isMonitoring) {
        btn.innerHTML = '<span class="btn-icon">⏹</span><span class="btn-label">Stop Monitoring</span>';
        btn.classList.add('active');
        statusEl.textContent = 'ON';
        statusEl.className = 'stat-number monitoring-on';
        recDot.classList.add('active');
        updateStatus('detectionStatus', 'online');
    } else {
        btn.innerHTML = '<span class="btn-icon">▶</span><span class="btn-label">Start Monitoring</span>';
        btn.classList.remove('active');
        statusEl.textContent = 'OFF';
        statusEl.className = 'stat-number monitoring-off';
        recDot.classList.remove('active');
        alertOverlay.classList.remove('active');
        primaryCamera.classList.remove('alerting');
        canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        updateStatus('detectionStatus', 'offline');
    }
}

// ===== Event Listeners =====
$('btnMonitor').addEventListener('click', toggleMonitoring);

$('sensitivitySlider').addEventListener('input', (e) => {
    state.detectionThreshold = parseInt(e.target.value) / 100;
    $('sensitivityValue').textContent = state.detectionThreshold.toFixed(2);
});

$('cooldownSlider').addEventListener('input', (e) => {
    state.cooldownMs = parseInt(e.target.value) * 1000;
    $('cooldownValue').textContent = e.target.value + 's';
});

// Settings modal
$('btnSettings').addEventListener('click', () => {
    $('settingWsUrl').value = state.wsUrl;
    $('settingLabel').value = state.label;
    $('settingCameraId').value = state.cameraId;
    $('settingsModal').classList.add('active');
});

$('closeSettings').addEventListener('click', () => $('settingsModal').classList.remove('active'));
$('closeSettingsBtn').addEventListener('click', () => $('settingsModal').classList.remove('active'));

$('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.wsUrl = $('settingWsUrl').value;
    state.label = $('settingLabel').value;
    $('cameraLabel').textContent = state.label;
    saveSettings();
    $('settingsModal').classList.remove('active');
    connectWebSocket();
});

// Close modal on overlay click
$('settingsModal').addEventListener('click', (e) => {
    if (e.target === $('settingsModal')) $('settingsModal').classList.remove('active');
});

// Multi-view button
$('btnMultiView').addEventListener('click', () => {
    window.location.href = '/multi-view.html';
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'm' || e.key === 'M') toggleMonitoring();
    if (e.key === 'Escape') $('settingsModal').classList.remove('active');
});

// ===== Live Frame Streaming (for mobile app) =====
function sendLiveFrame() {
    if (!videoEl || videoEl.readyState < 2) return;

    try {
        const snapshot = captureSnapshot();
        fetch('/api/live-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cameraId: state.cameraId,
                imageBase64: snapshot,
                label: state.label,
                status: {
                    isMonitoring: state.isMonitoring,
                    fps: state.fps,
                    personsDetected: parseInt($('handsDetected').textContent) || 0,
                    confidence: parseFloat($('confidenceValue').textContent) || 0,
                    detectionsToday: state.detectionsToday,
                    lastAlertTime: state.lastAlertTime ? new Date(state.lastAlertTime).toISOString() : null,
                },
            }),
        }).catch(() => { /* silent — mobile streaming is best-effort */ });
    } catch { /* ignore errors */ }
}

// Send frames every 3 seconds
setInterval(sendLiveFrame, 3000);

// ===== Secondary Cameras (Other Devices) =====
async function updateSecondaryCameras() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        if (data.success && data.data && data.data.control) {
            const desiredMonitoring = data.data.control.desiredMonitoring;
            if (typeof desiredMonitoring === 'boolean' && desiredMonitoring !== state.isMonitoring) {
                toggleMonitoring();
            }
        }
        
        if (data.success && data.data.cameras) {
            const otherCameras = data.data.cameras.filter(cam => 
                cam.id !== state.cameraId && cam.isOnline
            );
            
            // Update up to 3 secondary camera slots
            for (let i = 0; i < 3; i++) {
                const slotNum = i + 2; // CAM-02, CAM-03, CAM-04
                const camera = otherCameras[i];
                
                if (camera) {
                    // Fetch and display this camera
                    const nameEl = $(`cam${slotNum}Name`);
                    const statusEl = $(`cam${slotNum}Status`);
                    const imgEl = $(`cam${slotNum}Image`);
                    const placeholder = imgEl.previousElementSibling;
                    
                    if (nameEl) nameEl.textContent = camera.label;
                    if (statusEl) {
                        statusEl.textContent = 'LIVE';
                        statusEl.className = 'camera-badge live';
                    }
                    
                    // Fetch frame
                    const frameResponse = await fetch(`/api/live-frame?cameraId=${camera.id}`);
                    const frameData = await frameResponse.json();
                    
                    if (frameData.success && frameData.data && imgEl) {
                        imgEl.src = frameData.data.imageBase64;
                        imgEl.style.display = 'block';
                        if (placeholder) placeholder.style.display = 'none';
                    }
                } else {
                    // No camera for this slot - show offline
                    const statusEl = $(`cam${slotNum}Status`);
                    const imgEl = $(`cam${slotNum}Image`);
                    const placeholder = imgEl && imgEl.previousElementSibling;
                    
                    if (statusEl) {
                        statusEl.textContent = 'OFFLINE';
                        statusEl.className = 'camera-badge offline';
                    }
                    if (imgEl) imgEl.style.display = 'none';
                    if (placeholder) placeholder.style.display = 'flex';
                }
            }
        }
    } catch (err) {
        console.error('[SecureEye] Failed to update secondary cameras:', err);
    }
}

// Update secondary cameras every 3 seconds
setInterval(updateSecondaryCameras, 3000);
setTimeout(updateSecondaryCameras, 1000); // Initial update after 1s

// ===== Init =====
(async () => {
    loadSettings();
    $('cameraLabel').textContent = state.label;
    await initPoseModel();
    await startCamera();
    connectWebSocket();

    // ...existing code...
    // ...existing code...
})();
