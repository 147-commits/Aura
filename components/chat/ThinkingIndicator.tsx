/**
 * ThinkingIndicator — multi-step status display while Aura processes.
 * Shows shimmer, search status, source pills, and composing state.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated as RNAnimated, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AnimatedRN, { FadeIn, FadeInRight, FadeOut } from "react-native-reanimated";
import Colors from "@/constants/colors";

const C = Colors.dark;

export type ThinkingStep = "thinking" | "searching" | "reading" | "composing" | "crafting";

interface ThinkingIndicatorProps {
  step: ThinkingStep;
  message?: string;
  sources?: string[];
}

const STEP_ICONS: Record<ThinkingStep, keyof typeof Ionicons.glyphMap> = {
  thinking: "sparkles-outline",
  searching: "search-outline",
  reading: "book-outline",
  composing: "create-outline",
  crafting: "hammer-outline",
};

export function ThinkingIndicator({ step, message, sources }: ThinkingIndicatorProps) {
  const icon = STEP_ICONS[step];
  const displayMessage = message || defaultMessage(step);

  return (
    <View style={styles.container}>
      <View style={styles.avatarSmall}>
        <Text style={styles.avatarA}>A</Text>
      </View>
      <View style={styles.content}>
        <AnimatedRN.View entering={FadeIn.duration(200)} key={step} style={styles.stepRow}>
          <Ionicons name={icon} size={14} color={C.accent} />
          <Text style={styles.stepText}>{displayMessage}</Text>
        </AnimatedRN.View>

        {step === "reading" && sources && sources.length > 0 && (
          <View style={styles.sourcePills}>
            {sources.map((src, i) => (
              <AnimatedRN.View
                key={src}
                entering={FadeInRight.delay(i * 200).duration(250)}
                style={styles.pill}
              >
                <Text style={styles.pillText}>{extractDomain(src)}</Text>
              </AnimatedRN.View>
            ))}
          </View>
        )}

        {(step === "thinking" || step === "composing") && (
          <ShimmerLines />
        )}
      </View>
    </View>
  );
}

function ShimmerLines() {
  const shimmer = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.timing(shimmer, { toValue: 1, duration: 1500, useNativeDriver: false })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  return (
    <View style={styles.shimmerWrap}>
      <RNAnimated.View style={[styles.shimmerLine, { width: "100%", opacity }]} />
      <RNAnimated.View style={[styles.shimmerLine, { width: "75%", opacity }]} />
      <RNAnimated.View style={[styles.shimmerLine, { width: "50%", opacity }]} />
    </View>
  );
}

function defaultMessage(step: ThinkingStep): string {
  switch (step) {
    case "thinking": return "Understanding your question...";
    case "searching": return "Searching the web...";
    case "reading": return "Reading sources...";
    case "composing": return "Putting it all together...";
    case "crafting": return "Crafting your document...";
  }
}

function extractDomain(url: string): string {
  try {
    const domain = url.replace(/^https?:\/\//, "").split("/")[0];
    return domain.length > 20 ? domain.slice(0, 20) + "..." : domain;
  } catch {
    return url.slice(0, 20);
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 3,
    paddingHorizontal: 0,
  },
  avatarSmall: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.accentGlow,
    alignItems: "center", justifyContent: "center",
    marginRight: 7, borderWidth: 1,
    borderColor: C.accentGlowStrong,
    flexShrink: 0,
  },
  avatarA: { fontSize: 12, fontFamily: "Inter_700Bold", color: C.accent, marginTop: -1 },
  content: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  sourcePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  pillText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  shimmerWrap: { gap: 6, marginTop: 2 },
  shimmerLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: C.surfaceSecondary,
  },
});
