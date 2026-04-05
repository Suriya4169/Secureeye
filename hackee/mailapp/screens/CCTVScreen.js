// screens/CCTVScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";
import { CCTV_SERVER_URL } from "../config/cctv";

export default function CCTVScreen({ navigation }) {
  const user = auth.currentUser;
  const [cameras, setCameras] = useState([]);
  const [incidentAlerts, setIncidentAlerts] = useState([]);
  const [globalStatus, setGlobalStatus] = useState({
    isMonitoring: false,
    fps: 0,
    detectionsToday: 0,
    lastAlertTime: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingDetection, setStartingDetection] = useState(false);
  const intervalRef = useRef(null);
  const alertsRefreshTick = useRef(0);

  // Fetch camera status and live frames
  const fetchCameraStatus = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`${CCTV_SERVER_URL}/api/status`);
      const result = await response.json();

      if (result.success) {
        setGlobalStatus({
          isMonitoring: result.data.isMonitoring || false,
          fps: result.data.fps || 0,
          detectionsToday: result.data.detectionsToday || 0,
          lastAlertTime: result.data.lastAlertTime,
        });

        // Get camera list
        const cameraList = result.data.cameras || [];
        
        // If no cameras from status, check for default camera
        if (cameraList.length === 0) {
          const frameResponse = await fetch(`${CCTV_SERVER_URL}/api/live-frame`);
          const frameResult = await frameResponse.json();
          
          if (frameResult.success && frameResult.data) {
            setCameras([{
              id: 'default',
              label: frameResult.data.label || 'CAM-01',
              isOnline: true,
              lastFrame: frameResult.data.timestamp,
              imageBase64: frameResult.data.imageBase64,
            }]);
          }
        } else {
          // Fetch frames for each camera
          const camerasWithFrames = await Promise.all(
            cameraList.map(async (cam) => {
              try {
                const frameResponse = await fetch(
                  `${CCTV_SERVER_URL}/api/live-frame?cameraId=${cam.id}`
                );
                const frameResult = await frameResponse.json();
                
                return {
                  ...cam,
                  imageBase64: frameResult.success ? frameResult.data.imageBase64 : null,
                };
              } catch {
                return { ...cam, imageBase64: null };
              }
            })
          );
          setCameras(camerasWithFrames);
        }

        alertsRefreshTick.current += 1;
        if (showLoading || alertsRefreshTick.current % 6 === 0) {
          const alertsResponse = await fetch(`${CCTV_SERVER_URL}/api/mobile-alerts`);
          const alertsResult = await alertsResponse.json();
          if (alertsResult.success && Array.isArray(alertsResult.data)) {
            setIncidentAlerts(alertsResult.data);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch camera status:", err);
      if (showLoading) {
        Alert.alert(
          "Connection Error",
          `Cannot connect to CCTV server at ${CCTV_SERVER_URL}. Make sure the laptop-cctv server is running.`,
          [{ text: "OK" }]
        );
      }
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  // Start live polling
  useEffect(() => {
    fetchCameraStatus(true);
    
    // Poll every 500ms for live updates
    intervalRef.current = setInterval(() => {
      fetchCameraStatus(false);
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCameraStatus(false);
  };

  const startAllCamerasDetection = async () => {
    setStartingDetection(true);
    try {
      const response = await fetch(`${CCTV_SERVER_URL}/api/monitoring/start`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.error || "Server rejected start command");
      }

      Alert.alert(
        "Detection Started",
        "Start command sent. Cameras will begin monitoring automatically.",
        [{ text: "OK", style: "default" }]
      );

      fetchCameraStatus(false);
    } catch (err) {
      Alert.alert("Error", "Failed to start detection: " + err.message);
    } finally {
      setStartingDetection(false);
    }
  };

  const stopAllCamerasDetection = async () => {
    try {
      const response = await fetch(`${CCTV_SERVER_URL}/api/monitoring/stop`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.error || "Server rejected stop command");
      }

      Alert.alert("Detection Stopped", "Stop command sent to all cameras.", [{ text: "OK" }]);
      fetchCameraStatus(false);
    } catch (err) {
      Alert.alert("Error", "Failed to stop detection: " + err.message);
    }
  };

  const openFullDashboard = async () => {
    try {
      const supported = await Linking.canOpenURL(CCTV_SERVER_URL);
      if (supported) {
        await Linking.openURL(CCTV_SERVER_URL);
      } else {
        Alert.alert("Error", `Cannot open URL: ${CCTV_SERVER_URL}`);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to open dashboard");
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🛡️ SecureEye CCTV</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Connecting to cameras...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🛡️ SecureEye CCTV</Text>
          <Text style={styles.headerSubtitle}>{user?.email}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={() => navigation.navigate("Home")}
          >
            <Text style={styles.iconBtnText}>📧</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
            <Text style={styles.iconBtnText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
      >
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <View
                  style={[
                    styles.statusDot,
                    globalStatus.isMonitoring ? styles.statusDotActive : {},
                  ]}
                />
                <Text style={styles.statusValue}>
                  {globalStatus.isMonitoring ? "Monitoring" : "Idle"}
                </Text>
              </View>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>FPS</Text>
              <Text style={styles.statusValue}>{globalStatus.fps}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Detections</Text>
              <Text style={styles.statusValue}>
                {globalStatus.detectionsToday}
              </Text>
            </View>
          </View>

          {/* Control Buttons */}
          <View style={styles.controlButtons}>
            {!globalStatus.isMonitoring ? (
              <TouchableOpacity
                style={[styles.controlBtn, styles.startBtn]}
                onPress={startAllCamerasDetection}
                disabled={startingDetection}
              >
                {startingDetection ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.controlBtnText}>▶️ Start Detection</Text>
                    <Text style={styles.controlBtnSubtext}>All Cameras</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.controlBtn, styles.stopBtn]}
                onPress={stopAllCamerasDetection}
              >
                <Text style={styles.controlBtnText}>⏹️ Stop Detection</Text>
                <Text style={styles.controlBtnSubtext}>All Cameras</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.controlBtn, styles.dashboardBtn]}
              onPress={openFullDashboard}
            >
              <Text style={styles.controlBtnText}>🌐 Open Full Dashboard</Text>
              <Text style={styles.controlBtnSubtext}>View in Browser</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Camera Grid */}
        <View style={styles.camerasSection}>
          <Text style={styles.sectionTitle}>
            📹 Live Cameras ({cameras.length})
          </Text>

          {cameras.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📹</Text>
              <Text style={styles.emptyText}>No cameras online</Text>
              <Text style={styles.emptySubText}>
                Open the CCTV dashboard on your laptop to start streaming
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => fetchCameraStatus(true)}
              >
                <Text style={styles.retryBtnText}>🔄 Retry Connection</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraGrid}>
              {cameras.map((camera) => (
                <View key={camera.id} style={styles.cameraCard}>
                  <View style={styles.cameraHeader}>
                    <Text style={styles.cameraLabel}>{camera.label}</Text>
                    <View
                      style={[
                        styles.onlineBadge,
                        camera.isOnline && styles.onlineBadgeActive,
                      ]}
                    >
                      <Text style={styles.onlineBadgeText}>
                        {camera.isOnline ? "● LIVE" : "● OFFLINE"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cameraPreview}>
                    {camera.imageBase64 ? (
                      <Image
                        source={{
                          uri: camera.imageBase64.startsWith("data:")
                            ? camera.imageBase64
                            : `data:image/jpeg;base64,${camera.imageBase64}`,
                        }}
                        style={styles.cameraImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.noPreview}>
                        <Text style={styles.noPreviewText}>📹</Text>
                        <Text style={styles.noPreviewSubtext}>
                          No frame available
                        </Text>
                      </View>
                    )}
                  </View>

                  {camera.lastFrame && (
                    <Text style={styles.cameraTimestamp}>
                      Updated: {new Date(camera.lastFrame).toLocaleTimeString()}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Last Alert */}
        {globalStatus.lastAlertTime && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>⚠️ Last Alert</Text>
            <Text style={styles.alertTime}>
              {new Date(globalStatus.lastAlertTime).toLocaleString()}
            </Text>
          </View>
        )}

        {/* Incident Timeline */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineTitle}>🕒 Incident Timeline</Text>
            <Text style={styles.timelineCount}>{incidentAlerts.length} events</Text>
          </View>

          {incidentAlerts.length === 0 ? (
            <View style={styles.timelineEmptyWrap}>
              <Text style={styles.timelineEmptyText}>No incidents yet</Text>
              <Text style={styles.timelineEmptySubText}>
                When alerts are triggered, they will appear here.
              </Text>
            </View>
          ) : (
            incidentAlerts.slice(0, 20).map((item) => {
              const happenedAt = item.timestamp
                ? new Date(item.timestamp).toLocaleString()
                : "Unknown time";
              const confidencePct =
                typeof item.confidence === "number"
                  ? `${(item.confidence * 100).toFixed(1)}%`
                  : "-";

              return (
                <View key={item.id} style={styles.timelineItem}>
                  <View style={styles.timelineItemRow}>
                    <Text style={styles.timelineItemTitle}>⚠️ Person Detected</Text>
                    <Text style={styles.timelineItemConfidence}>{confidencePct}</Text>
                  </View>
                  <Text style={styles.timelineItemMeta}>
                    Persons: {item.numPeople || item.numHands || "-"} • Snapshot: {item.hasSnapshot ? "Yes" : "No"}
                  </Text>
                  <Text style={styles.timelineItemTime}>{happenedAt}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Instructions */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ How it Works</Text>
          <Text style={styles.infoText}>
            1. Open the CCTV dashboard on your laptop (port 5000){"\n"}
            2. Allow camera access in your browser{"\n"}
            3. Click "Start Monitoring" in the dashboard{"\n"}
            4. Person detection runs automatically in frame{"\n"}
            5. View live feeds here in real-time
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  headerRight: {
    flexDirection: "row",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: {
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: "#94a3b8",
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  statusCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statusItem: {
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#64748b",
  },
  statusDotActive: {
    backgroundColor: "#10b981",
  },
  controlButtons: {
    gap: 12,
  },
  controlBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  startBtn: {
    backgroundColor: "#10b981",
  },
  stopBtn: {
    backgroundColor: "#ef4444",
  },
  dashboardBtn: {
    backgroundColor: "#6366f1",
  },
  controlBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  controlBtnSubtext: {
    fontSize: 12,
    color: "#ffffff99",
    marginTop: 4,
  },
  camerasSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 16,
  },
  cameraGrid: {
    gap: 16,
  },
  cameraCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cameraHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cameraLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f1f5f9",
  },
  onlineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#334155",
  },
  onlineBadgeActive: {
    backgroundColor: "#10b98120",
  },
  onlineBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  cameraPreview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#0f172a",
  },
  cameraImage: {
    width: "100%",
    height: "100%",
  },
  noPreview: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noPreviewText: {
    fontSize: 48,
    opacity: 0.3,
  },
  noPreviewSubtext: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 8,
  },
  cameraTimestamp: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 8,
    textAlign: "right",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  emptyEmoji: {
    fontSize: 64,
    opacity: 0.3,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f1f5f9",
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#6366f1",
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  alertCard: {
    backgroundColor: "#7f1d1d",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fca5a5",
    marginBottom: 8,
  },
  alertTime: {
    fontSize: 13,
    color: "#fca5a5",
  },
  timelineCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  timelineCount: {
    fontSize: 12,
    color: "#94a3b8",
  },
  timelineEmptyWrap: {
    paddingVertical: 10,
  },
  timelineEmptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e2e8f0",
    marginBottom: 4,
  },
  timelineEmptySubText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  timelineItem: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 10,
  },
  timelineItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  timelineItemTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  timelineItemConfidence: {
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "700",
  },
  timelineItemMeta: {
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 4,
  },
  timelineItemTime: {
    color: "#64748b",
    fontSize: 11,
  },
  infoCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f1f5f9",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 20,
  },
});
