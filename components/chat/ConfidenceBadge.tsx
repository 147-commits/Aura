import React from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { C, CONFIDENCE_COLORS, CONFIDENCE_DESCRIPTIONS, type Confidence } from "./types";

export function ConfidenceBadge({
  confidence,
  reason,
  onPress,
}: {
  confidence: Confidence;
  reason?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.badge, { borderColor: CONFIDENCE_COLORS[confidence] + "44" }]}
    >
      <View style={[styles.dot, { backgroundColor: CONFIDENCE_COLORS[confidence] }]} />
      <Text style={[styles.text, { color: CONFIDENCE_COLORS[confidence] }]}>
        {confidence} confidence
      </Text>
    </Pressable>
  );
}

export function ConfidencePopup({
  visible,
  confidence,
  reason,
  onClose,
}: {
  visible: boolean;
  confidence: Confidence;
  reason: string;
  onClose: () => void;
}) {
  const color = CONFIDENCE_COLORS[confidence];
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.popup}>
          <View style={[styles.popupHeader, { borderBottomColor: color + "20" }]}>
            <View style={[styles.popupDot, { backgroundColor: color }]} />
            <Text style={[styles.popupLevel, { color }]}>{confidence} Confidence</Text>
          </View>
          <Text style={styles.popupDesc}>{CONFIDENCE_DESCRIPTIONS[confidence]}</Text>
          {reason ? (
            <View style={styles.popupReasonBox}>
              <Text style={styles.popupReasonLabel}>Why this level:</Text>
              <Text style={styles.popupReason}>{reason}</Text>
            </View>
          ) : null}
          <Text style={styles.popupHint}>Tap anywhere to dismiss</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 10, fontFamily: "Inter_500Medium" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  popup: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  popupHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  popupDot: { width: 8, height: 8, borderRadius: 4 },
  popupLevel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  popupDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  popupReasonBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  popupReasonLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: C.textTertiary,
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  popupReason: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.text,
    lineHeight: 19,
  },
  popupHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
    textAlign: "center" as const,
  },
});
