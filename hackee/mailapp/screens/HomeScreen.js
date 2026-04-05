import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

export default function HomeScreen({ navigation }) {
  const user = auth.currentUser;

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome</Text>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>🛡️</Text>
          <Text style={styles.heroTitle}>SecureEye Command Center</Text>
          <Text style={styles.heroSub}>
            Monitor live cameras, review incidents, and track detection status in real time.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate("CCTV")}
          >
            <Text style={styles.primaryButtonText}>Open Live Monitoring</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What you can do</Text>
          <Text style={styles.infoText}>• View all active camera feeds</Text>
          <Text style={styles.infoText}>• Track incident timeline and alerts</Text>
          <Text style={styles.infoText}>• Start or stop detection workflow</Text>
          <Text style={styles.infoText}>• Check monitoring status and performance</Text>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Quick Start</Text>
          <Text style={styles.tipText}>1. Start laptop CCTV server on port 5000</Text>
          <Text style={styles.tipText}>2. Set your Tailscale URL in config/cctv.js</Text>
          <Text style={styles.tipText}>3. Open Live Monitoring to view streams</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 50,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  greeting: { color: "#94a3b8", fontSize: 13 },
  email: { color: "#fff", fontWeight: "700", fontSize: 15, maxWidth: 220 },
  logoutBtn: {
    backgroundColor: "#450a0a",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: { color: "#f87171", fontWeight: "700", fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  heroCard: {
    backgroundColor: "#1e293b",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 16,
  },
  heroIcon: { fontSize: 38, marginBottom: 8 },
  heroTitle: { color: "#f8fafc", fontSize: 21, fontWeight: "800", marginBottom: 8 },
  heroSub: { color: "#94a3b8", fontSize: 14, lineHeight: 21, marginBottom: 16 },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  infoCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 16,
  },
  infoTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  infoText: { color: "#cbd5e1", fontSize: 13, lineHeight: 21 },
  tipCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  tipTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  tipText: { color: "#93c5fd", fontSize: 13, lineHeight: 20 },
});
