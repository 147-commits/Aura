/**
 * DisagreementCard — shows when sources disagree on a point.
 * This is Aura's key differentiator: transparent disagreement display.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface Position {
  summary: string;
  source: { title: string; url?: string; quality?: number };
}

export function DisagreementCard({
  topic,
  positions,
  synthesis,
}: {
  topic: string;
  positions: Position[];
  synthesis?: string;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="git-compare-outline" size={16} color={C.accentWarm} />
        <Text style={styles.headerText}>Sources disagree on this point</Text>
      </View>

      <Text style={styles.topic}>{topic}</Text>

      <View style={styles.positionsRow}>
        {positions.map((pos, i) => (
          <View key={i} style={styles.position}>
            <View style={[styles.positionBar, { backgroundColor: i === 0 ? C.accent : C.accentWarm }]} />
            <Text style={styles.positionText}>{pos.summary}</Text>
            <Text style={styles.positionSource}>
              — {pos.source.title}
              {pos.source.quality !== undefined && ` (${Math.round(pos.source.quality * 100)}%)`}
            </Text>
          </View>
        ))}
      </View>

      {synthesis && (
        <View style={styles.synthesis}>
          <Text style={styles.synthesisLabel}>Aura's take</Text>
          <Text style={styles.synthesisText}>{synthesis}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.accentWarm + "30",
    borderLeftWidth: 3,
    borderLeftColor: C.accentWarm,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.accentWarm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  topic: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.text,
  },
  positionsRow: {
    gap: 8,
  },
  position: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  positionBar: {
    width: 24,
    height: 3,
    borderRadius: 2,
    marginBottom: 2,
  },
  positionText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.text,
    lineHeight: 19,
  },
  positionSource: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  synthesis: {
    backgroundColor: C.accentGlow,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  synthesisLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: C.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  synthesisText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.text,
    lineHeight: 19,
  },
});
