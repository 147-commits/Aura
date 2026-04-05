/**
 * MessageActions — always-visible action row below AI responses.
 * Copy, Thumbs Up, Thumbs Down, Regenerate.
 */

import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const C = Colors.dark;

export function MessageActions({
  messageText,
  messageId,
  deviceId,
  onRegenerate,
}: {
  messageText: string;
  messageId?: string;
  deviceId: string;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(messageText);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = async (rating: "up" | "down") => {
    if (feedback === rating) return; // Already selected
    setFeedback(rating);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const baseUrl = getApiUrl();
      await fetch(new URL("/api/feedback", baseUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ messageId, rating }),
      });
    } catch {}
  };

  const handleRegenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRegenerate?.();
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={handleCopy} style={styles.btn} hitSlop={6}>
        <Ionicons
          name={copied ? "checkmark" : "copy-outline"}
          size={16}
          color={copied ? C.accent : C.textTertiary}
        />
      </Pressable>

      <Pressable onPress={() => handleFeedback("up")} style={styles.btn} hitSlop={6}>
        <Ionicons
          name={feedback === "up" ? "thumbs-up" : "thumbs-up-outline"}
          size={16}
          color={feedback === "up" ? C.accent : C.textTertiary}
        />
      </Pressable>

      <Pressable onPress={() => handleFeedback("down")} style={styles.btn} hitSlop={6}>
        <Ionicons
          name={feedback === "down" ? "thumbs-down" : "thumbs-down-outline"}
          size={16}
          color={feedback === "down" ? C.error : C.textTertiary}
        />
      </Pressable>

      {onRegenerate && (
        <Pressable onPress={handleRegenerate} style={styles.btn} hitSlop={6}>
          <Ionicons name="refresh-outline" size={16} color={C.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    paddingLeft: 2,
  },
  btn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
});
