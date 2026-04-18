import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated as RNAnimated,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const C = Colors.dark;

function PulsingOrb({ size = 120 }: { size?: number }) {
  const scale = useRef(new RNAnimated.Value(1)).current;
  const opacity = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.parallel([
          RNAnimated.timing(scale, { toValue: 1.15, duration: 2800, useNativeDriver: Platform.OS !== "web" }),
          RNAnimated.timing(opacity, { toValue: 0.55, duration: 2800, useNativeDriver: Platform.OS !== "web" }),
        ]),
        RNAnimated.parallel([
          RNAnimated.timing(scale, { toValue: 1, duration: 2800, useNativeDriver: Platform.OS !== "web" }),
          RNAnimated.timing(opacity, { toValue: 0.3, duration: 2800, useNativeDriver: Platform.OS !== "web" }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const outerSize = size;
  const middleSize = size * 0.633;
  const coreSize = size * 0.3;

  return (
    <View style={{ width: outerSize, height: outerSize, alignItems: "center", justifyContent: "center" }}>
      <RNAnimated.View
        style={{
          position: "absolute", width: outerSize, height: outerSize, borderRadius: outerSize / 2,
          backgroundColor: "rgba(59, 130, 246, 0.08)",
          borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.2)",
          transform: [{ scale }], opacity,
        }}
      />
      <RNAnimated.View
        style={{
          position: "absolute", width: middleSize, height: middleSize, borderRadius: middleSize / 2,
          backgroundColor: "rgba(59, 130, 246, 0.15)",
          borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.35)",
          transform: [{ scale }], opacity,
        }}
      />
      <View
        style={{
          width: coreSize, height: coreSize, borderRadius: coreSize / 2,
          backgroundColor: C.accent,
          shadowColor: C.accent, shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6, shadowRadius: 20,
        }}
      />
    </View>
  );
}

const INTENTS = [
  { label: "Daily planning", icon: "📋", value: "planning" },
  { label: "Creative thinking", icon: "💡", value: "creative" },
  { label: "Coding & building", icon: "⚡", value: "coding" },
  { label: "Research & decisions", icon: "🔍", value: "research" },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"welcome" | "intent">("welcome");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("aura:onboarded").then((val) => {
      if (val === "true") {
        router.replace("/(tabs)/aura" as any);
      }
    });
  }, []);

  const handleStart = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep("intent");
  };

  const handleIntent = async (value: string) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelected(value);
    await AsyncStorage.setItem("aura:onboarded", "true");
    await AsyncStorage.setItem("aura:primary_intent", value);
    setTimeout(() => {
      router.replace("/(tabs)/aura" as any);
    }, 400);
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem("aura:onboarded", "true");
    router.replace("/(tabs)/aura" as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      {step === "welcome" ? (
        <>
          <View style={styles.spacer} />
          <Animated.View entering={FadeIn.duration(800)} style={styles.center}>
            <PulsingOrb size={120} />
            <Animated.View entering={FadeInDown.duration(600).delay(300)}>
              <Text style={styles.title}>Aura</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.duration(600).delay(500)}>
              <Text style={styles.subtitle}>Your truth-first thinking partner.</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.duration(600).delay(700)}>
              <Text style={styles.description}>
                Not a chatbot. Not a tracker.{"\n"}
                A companion that remembers, reasons, and respects your privacy.
              </Text>
            </Animated.View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(900)} style={styles.bottomSection}>
            <Pressable onPress={handleStart} style={styles.ctaButton}>
              <Text style={styles.ctaText}>Get Started</Text>
            </Pressable>
            <View style={styles.trustBadges}>
              <View style={styles.trustBadge}>
                <View style={[styles.trustDot, { backgroundColor: C.success }]} />
                <Text style={styles.trustText}>Encrypted at rest</Text>
              </View>
              <View style={styles.trustBadge}>
                <View style={[styles.trustDot, { backgroundColor: C.accentWarm }]} />
                <Text style={styles.trustText}>No account needed</Text>
              </View>
            </View>
          </Animated.View>
        </>
      ) : (
        <>
          <View style={styles.spacer} />
          <Animated.View entering={FadeIn.duration(400)} style={styles.intentSection}>
            <Text style={styles.intentTitle}>What brings you to Aura?</Text>
            <Text style={styles.intentSubtitle}>This helps me be more useful from the start.</Text>
            <View style={styles.intentGrid}>
              {INTENTS.map((intent, i) => (
                <Animated.View key={intent.value} entering={FadeInDown.duration(400).delay(i * 100)}>
                  <Pressable
                    onPress={() => handleIntent(intent.value)}
                    style={[
                      styles.intentCard,
                      selected === intent.value && styles.intentCardSelected,
                    ]}
                  >
                    <Text style={styles.intentIcon}>{intent.icon}</Text>
                    <Text style={styles.intentLabel}>{intent.label}</Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.duration(400).delay(500)} style={styles.bottomSection}>
            <Pressable onPress={handleSkip}>
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 32,
    justifyContent: "space-between",
  },
  spacer: { flex: 0.3 },
  center: {
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 48,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -1.5,
    marginTop: 24,
  },
  subtitle: {
    fontSize: 18,
    color: C.textSecondary,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    color: C.textTertiary,
    textAlign: "center",
    lineHeight: 24,
    marginTop: 8,
  },
  bottomSection: {
    alignItems: "center",
    gap: 20,
    paddingBottom: 12,
  },
  ctaButton: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  trustBadges: {
    flexDirection: "row",
    gap: 20,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trustDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trustText: {
    fontSize: 12,
    color: C.textTertiary,
  },

  // Intent selection
  intentSection: {
    alignItems: "center",
    gap: 12,
  },
  intentTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  intentSubtitle: {
    fontSize: 15,
    color: C.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  intentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
  },
  intentCard: {
    width: 150,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    gap: 8,
  },
  intentCardSelected: {
    borderColor: C.accent,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
  },
  intentIcon: {
    fontSize: 28,
  },
  intentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
    textAlign: "center",
  },
  skipText: {
    fontSize: 14,
    color: C.textTertiary,
  },
});
