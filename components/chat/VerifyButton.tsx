/**
 * VerifyButton — "Verify" button next to factual claims.
 * Triggers deeper verification (CoVe) on a specific claim.
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const C = Colors.dark;

type VerifyState = "idle" | "checking" | "verified" | "uncertain" | "contradicted";

const STATE_CONFIG: Record<VerifyState, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  idle: { icon: "shield-checkmark-outline", color: C.textTertiary, label: "Verify" },
  checking: { icon: "hourglass-outline", color: C.accent, label: "Checking..." },
  verified: { icon: "checkmark-circle", color: C.confidenceHigh, label: "Verified" },
  uncertain: { icon: "alert-circle", color: C.confidenceMedium, label: "Uncertain" },
  contradicted: { icon: "close-circle", color: C.confidenceLow, label: "Contradicted" },
};

export function VerifyButton({
  claim,
  onVerify,
}: {
  claim: string;
  onVerify?: (claim: string) => Promise<"verified" | "uncertain" | "contradicted">;
}) {
  const [state, setState] = useState<VerifyState>("idle");
  const config = STATE_CONFIG[state];

  const handlePress = async () => {
    if (state !== "idle") return;
    setState("checking");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (onVerify) {
        const result = await onVerify(claim);
        setState(result);
      } else {
        // Simulate verification if no handler provided
        await new Promise((r) => setTimeout(r, 1500));
        setState("uncertain");
      }
    } catch {
      setState("uncertain");
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <Pressable style={styles.button} onPress={handlePress} disabled={state === "checking"}>
      <Ionicons name={config.icon} size={12} color={config.color} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
});
