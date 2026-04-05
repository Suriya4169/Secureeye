// screens/SignupScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "../config/firebase";

export default function SignupScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1 = register form, 2 = verify OTP prompt
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignup = async () => {
    setError("");
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      // Send verification email
      await sendEmailVerification(userCredential.user);
      setStep(2);
    } catch (err) {
      switch (err.code) {
        case "auth/email-already-in-use":
          setError("This email is already registered.");
          break;
        case "auth/invalid-email":
          setError("Invalid email address.");
          break;
        case "auth/weak-password":
          setError("Password is too weak.");
          break;
        default:
          setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setLoading(true);
    setError("");
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setSuccess("Email verified! You can now log in.");
        setTimeout(() => navigation.navigate("Login"), 1500);
      } else {
        setError("Email not yet verified. Please check your inbox and click the link.");
      }
    } catch (err) {
      setError("Could not check verification. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    try {
      await sendEmailVerification(auth.currentUser);
      setSuccess("Verification email resent!");
    } catch {
      setError("Failed to resend. Please wait a moment and try again.");
    }
  };

  if (step === 2) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner}>
          <View style={styles.otpBox}>
            <Text style={styles.otpEmoji}>🛡️</Text>
            <Text style={styles.otpTitle}>Verify Operator Email</Text>
            <Text style={styles.otpSub}>
              We sent a verification link to:
            </Text>
            <Text style={styles.otpEmail}>{email}</Text>
            <Text style={styles.otpInstruction}>
              Open your email, click the verification link, then return to activate SecureEye access.
            </Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <TouchableOpacity
              style={styles.button}
              onPress={handleCheckVerification}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>I've Verified My Email ✓</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={resendVerification}>
              <Text style={styles.linkText}>
                Didn't get it?{" "}
                <Text style={styles.linkHighlight}>Resend Email</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => navigation.navigate("Login")}
            >
              <Text style={styles.linkText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoBox}>
          <Text style={styles.logo}>🛡️</Text>
          <Text style={styles.appName}>SecureEye</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Create Operator Account</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Min. 6 characters"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter your password"
            placeholderTextColor="#aaa"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.linkText}>
              Already have an account?{" "}
              <Text style={styles.linkHighlight}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  inner: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoBox: { alignItems: "center", marginBottom: 32 },
  logo: { fontSize: 56 },
  appName: { fontSize: 28, fontWeight: "800", color: "#fff", marginTop: 8 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 24,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  label: { color: "#94a3b8", fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#334155",
  },
  button: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#94a3b8", fontSize: 14 },
  linkHighlight: { color: "#818cf8", fontWeight: "700" },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
    backgroundColor: "#450a0a",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  successText: {
    color: "#4ade80",
    fontSize: 13,
    textAlign: "center",
    backgroundColor: "#052e16",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  // OTP / Verification step styles
  otpBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  otpEmoji: { fontSize: 72, marginBottom: 16 },
  otpTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
  },
  otpSub: { color: "#94a3b8", fontSize: 15 },
  otpEmail: {
    color: "#818cf8",
    fontWeight: "700",
    fontSize: 16,
    marginVertical: 8,
  },
  otpInstruction: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
});
