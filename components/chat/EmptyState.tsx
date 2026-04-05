/**
 * EmptyState — shown when the conversation has no messages.
 * Displays a warm greeting + 4 randomized suggestion cards.
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { pickRandom, type Suggestion } from "@/lib/suggestions";

const C = Colors.dark;

export function EmptyState({
  onSuggestion,
}: {
  onSuggestion: (text: string, mode: string) => void;
}) {
  const suggestions = useMemo(() => pickRandom(4), []);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      {/* Aura orb */}
      <View style={styles.orb}>
        <View style={styles.orbInner}>
          <View style={styles.orbCore} />
        </View>
      </View>

      {/* Greeting */}
      <Text style={styles.greeting}>What can I help you with?</Text>
      <Text style={styles.subtitle}>Aura has 26 professional skills across 9 domains</Text>

      {/* Suggestion cards */}
      <View style={styles.grid}>
        {suggestions.map((s, i) => (
          <Animated.View key={s.text} entering={FadeIn.delay(100 + i * 80).duration(300)}>
            <Pressable
              style={styles.card}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSuggestion(s.text, s.mode);
              }}
            >
              <Ionicons name={s.icon as any} size={18} color={C.accent} />
              <Text style={styles.cardText}>{s.text}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <Text style={styles.hint}>Tap any to get started</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16,
  },
  orb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.accentGlow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.accentGlowStrong,
    marginBottom: 4,
  },
  orbInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.accentGlow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.accentGlowStrong,
  },
  orbCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.accent,
  },
  greeting: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  grid: {
    width: "100%",
    gap: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.text,
    flex: 1,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
    marginTop: 4,
  },
});
