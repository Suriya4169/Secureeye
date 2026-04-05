// ===================================================================
// SecureEye — Multi-Camera View
// ===================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

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

const $ = (id) => document.getElementById(id);
const cameraGrid = $('cameraGrid');
const activeCameras = new Map();

// Auth check
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = '/login.html';
    }
});

// Logout
$('btnLogout').onclick = async () => {
    await signOut(auth);
    window.location.href = '/login.html';
};

// Clock
function updateClock() {
    const now = new Date();
    $('clock').textContent = now.toLocaleTimeString('en-US', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// Fetch camera status
async function fetchCameraStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.success && data.data.cameras) {
            updateCameraGrid(data.data.cameras);
        }
    } catch (err) {
        console.error('Failed to fetch camera status:', err);
    }
}

// Update camera grid
function updateCameraGrid(cameras) {
    const onlineCameras = cameras.filter(cam => cam.isOnline);
    
    $('totalCameras').innerHTML = `
        <span class="status-dot ${onlineCameras.length > 0 ? 'online' : 'offline'}"></span>
        <span>${onlineCameras.length} Camera${onlineCameras.length !== 1 ? 's' : ''}</span>
    `;

    if (onlineCameras.length === 0) {
        cameraGrid.innerHTML = `
            <div class="no-cameras">
                <div class="no-cameras-icon">📷</div>
                <h2>No Cameras Connected</h2>
                <p>Open SecureEye on other devices to see them here</p>
            </div>
        `;
        return;
    }

    cameraGrid.innerHTML = '';
    
    onlineCameras.forEach(camera => {
        if (!activeCameras.has(camera.id)) {
            const card = createCameraCard(camera);
            cameraGrid.appendChild(card);
            activeCameras.set(camera.id, { element: card, lastUpdate: Date.now() });
        }
        updateCameraFeed(camera.id);
    });

    // Remove offline cameras
    activeCameras.forEach((value, cameraId) => {
        if (!onlineCameras.find(cam => cam.id === cameraId)) {
            value.element.remove();
            activeCameras.delete(cameraId);
        }
    });
}

// Create camera card
function createCameraCard(camera) {
    const card = document.createElement('div');
    card.className = 'cam-card';
    card.id = `cam-${camera.id}`;
    
    card.innerHTML = `
        <div class="cam-header">
            <span class="cam-title">${camera.label}</span>
            <span class="cam-status online">LIVE</span>
        </div>
        <div class="cam-viewport-multi">
            <div class="cam-placeholder">📷</div>
            <img id="img-${camera.id}" style="display: none;" alt="${camera.label}" />
        </div>
        <div class="cam-footer">
            <div class="cam-stat-item">
                <span class="cam-stat-label">Camera ID</span>
                <span class="cam-stat-value">${camera.id.substring(0, 8)}</span>
            </div>
            <div class="cam-stat-item">
                <span class="cam-stat-label">Last Update</span>
                <span class="cam-stat-value" id="time-${camera.id}">Just now</span>
            </div>
        </div>
    `;
    
    return card;
}

// Update camera feed
async function updateCameraFeed(cameraId) {
    try {
        const response = await fetch(`/api/live-frame?cameraId=${cameraId}`);
        const data = await response.json();
        
        if (data.success && data.data) {
            const img = document.getElementById(`img-${cameraId}`);
            if (img) {
                img.src = data.data.imageBase64;
                img.style.display = 'block';
                img.previousElementSibling.style.display = 'none';
                
                // Update timestamp
                const timeAgo = getTimeAgo(new Date(data.data.timestamp));
                const timeEl = document.getElementById(`time-${cameraId}`);
                if (timeEl) timeEl.textContent = timeAgo;
            }
        }
    } catch (err) {
        console.error(`Failed to fetch feed for ${cameraId}:`, err);
    }
}

// Get time ago
function getTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}

// Refresh feeds
setInterval(() => {
    activeCameras.forEach((_, cameraId) => {
        updateCameraFeed(cameraId);
    });
}, 2000);

// Refresh status
setInterval(fetchCameraStatus, 5000);

// Initial load
fetchCameraStatus();

// ...existing code...
