/**
 * MobilePreview — Snack web preview with device frame and QR code.
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const C = Colors.dark;

// Conditionally import WebView
let WebView: any = null;
try { WebView = require("react-native-webview").WebView; } catch {}

type DeviceFrame = "iphone-se" | "iphone-15" | "pixel-7";

const DEVICE_SIZES: Record<DeviceFrame, { width: number; height: number; label: string }> = {
  "iphone-se": { width: 320, height: 568, label: "iPhone SE" },
  "iphone-15": { width: 393, height: 852, label: "iPhone 15" },
  "pixel-7": { width: 412, height: 915, label: "Pixel 7" },
};

export function MobilePreview({
  previewUrl,
  qrCodeUrl,
  isLoading,
  error,
  onRetry,
}: {
  previewUrl?: string;
  qrCodeUrl?: string;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const [device, setDevice] = useState<DeviceFrame>("iphone-15");
  const [showQR, setShowQR] = useState(false);
  const size = DEVICE_SIZES[device];

  return (
    <View style={styles.container}>
      {/* Device selector */}
      <View style={styles.deviceBar}>
        {(Object.keys(DEVICE_SIZES) as DeviceFrame[]).map((d) => (
          <Pressable
            key={d}
            style={[styles.deviceBtn, device === d && styles.deviceBtnActive]}
            onPress={() => { setDevice(d); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={[styles.deviceText, device === d && styles.deviceTextActive]}>
              {DEVICE_SIZES[d].label}
            </Text>
          </Pressable>
        ))}
        {qrCodeUrl && (
          <Pressable style={styles.qrBtn} onPress={() => setShowQR(true)}>
            <Ionicons name="qr-code-outline" size={16} color={C.accent} />
          </Pressable>
        )}
      </View>

      {/* Preview frame */}
      <View style={styles.previewArea}>
        {/* Device frame border */}
        <View style={[styles.frame, { width: Math.min(size.width, 360), height: Math.min(size.height, 600) }]}>
          {/* Notch / status bar */}
          <View style={styles.statusBar}>
            <Text style={styles.statusTime}>9:41</Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingState}>
              <Ionicons name="phone-portrait-outline" size={32} color={C.textTertiary} />
              <Text style={styles.loadingText}>Building your app...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorState}>
              <Ionicons name="alert-circle-outline" size={28} color={C.confidenceLow} />
              <Text style={styles.errorText}>{error}</Text>
              {onRetry && (
                <Pressable style={styles.retryBtn} onPress={onRetry}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              )}
            </View>
          ) : previewUrl ? (
            Platform.OS === "web" ? (
              <iframe
                src={previewUrl}
                style={{ flex: 1, border: "none", width: "100%", height: "100%" } as any}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : WebView ? (
              <WebView
                source={{ uri: previewUrl }}
                style={{ flex: 1 }}
                javaScriptEnabled
              />
            ) : (
              <View style={styles.fallback}>
                <Pressable onPress={() => Linking.openURL(previewUrl)}>
                  <Text style={styles.fallbackLink}>Open in browser</Text>
                </Pressable>
              </View>
            )
          ) : (
            <View style={styles.loadingState}>
              <Ionicons name="code-slash-outline" size={32} color={C.textTertiary} />
              <Text style={styles.loadingText}>Waiting for code...</Text>
            </View>
          )}
        </View>
      </View>

      {/* QR Code Modal */}
      <Modal visible={showQR} transparent animationType="fade">
        <Pressable style={styles.qrOverlay} onPress={() => setShowQR(false)}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Open on your device</Text>
            <View style={styles.qrPlaceholder}>
              <Ionicons name="qr-code" size={120} color={C.text} />
            </View>
            <Text style={styles.qrHint}>
              Scan with Expo Go app{"\n"}for real device preview
            </Text>
            {qrCodeUrl && (
              <Pressable
                style={styles.qrLinkBtn}
                onPress={() => { Linking.openURL(qrCodeUrl); setShowQR(false); }}
              >
                <Text style={styles.qrLinkText}>Open Expo link</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  deviceBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  deviceBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  deviceBtnActive: { backgroundColor: C.accentGlow },
  deviceText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textTertiary },
  deviceTextActive: { color: C.accent },
  qrBtn: { marginLeft: "auto", padding: 6 },
  previewArea: { flex: 1, alignItems: "center", justifyContent: "center", padding: 8 },
  frame: {
    backgroundColor: "#000",
    borderRadius: 24,
    borderWidth: 3,
    borderColor: C.border,
    overflow: "hidden",
  },
  statusBar: {
    height: 28,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  statusTime: { fontSize: 12, color: "#fff", fontFamily: "Inter_600SemiBold" },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#1a1a2e" },
  loadingText: { fontSize: 13, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 16, backgroundColor: "#1a1a2e" },
  errorText: { fontSize: 12, color: C.confidenceLow, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: C.accent, marginTop: 4 },
  retryText: { fontSize: 12, color: "#fff", fontFamily: "Inter_600SemiBold" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a2e" },
  fallbackLink: { fontSize: 14, color: C.accent, fontFamily: "Inter_500Medium", textDecorationLine: "underline" },
  qrOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 32 },
  qrCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 16,
    maxWidth: 300,
    width: "100%",
  },
  qrTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: C.text },
  qrPlaceholder: { padding: 16, backgroundColor: "#fff", borderRadius: 12 },
  qrHint: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", lineHeight: 20 },
  qrLinkBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: C.accent },
  qrLinkText: { fontSize: 13, color: "#fff", fontFamily: "Inter_600SemiBold" },
});
