/**
 * MemoryNotification — subtle inline notification when memory is saved.
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import Colors from "@/constants/colors";

const C = Colors.dark;

export function MemoryNotification({
  text,
  category,
  onDismiss,
  onTap,
}: {
  text: string;
  category: string;
  onDismiss: () => void;
  onTap?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Animated.View entering={FadeInDown.duration(250).springify()} exiting={FadeOut.duration(200)} style={styles.container}>
      <Pressable style={styles.content} onPress={onTap}>
        <Ionicons name="bulb-outline" size={14} color={C.accent} />
        <Text style={styles.text} numberOfLines={1}>
          Remembered: "{text}"
        </Text>
      </Pressable>
      <Pressable onPress={() => { setVisible(false); onDismiss(); }} hitSlop={8}>
        <Ionicons name="close" size={14} color={C.textTertiary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    backgroundColor: C.accentGlow,
    borderWidth: 1,
    borderColor: C.accent + "30",
    gap: 6,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.text,
    flex: 1,
  },
});
