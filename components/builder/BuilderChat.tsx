/**
 * BuilderChat — compact chat input for iterating on builder projects.
 */

import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const C = Colors.dark;

const SUGGESTIONS = [
  "Make it more modern",
  "Add a contact form",
  "Change colors to blue",
  "Add a pricing section",
  "Make the hero bigger",
];

export function BuilderChat({
  onSend,
  isGenerating,
  history,
}: {
  onSend: (prompt: string) => void;
  isGenerating: boolean;
  history: { role: "user" | "assistant"; content: string }[];
}) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    setInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(text);
  };

  return (
    <View style={styles.container}>
      {/* Conversation history */}
      {history.length > 0 && (
        <ScrollView style={styles.history} showsVerticalScrollIndicator={false}>
          {history.map((msg, i) => (
            <View key={i} style={[styles.historyItem, msg.role === "user" && styles.historyUser]}>
              <Text style={[styles.historyText, msg.role === "user" && styles.historyTextUser]} numberOfLines={2}>
                {msg.content}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Suggestion chips */}
      {history.length === 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <Pressable key={s} style={styles.chip} onPress={() => onSend(s)}>
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Typing indicator */}
      {isGenerating && (
        <View style={styles.typing}>
          <Text style={styles.typingText}>Aura is building...</Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Describe changes..."
          placeholderTextColor={C.textTertiary}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={!isGenerating}
          {...(Platform.OS === "web" ? {
            onKeyPress: (e: any) => {
              if (e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            },
          } : {})}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || isGenerating) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isGenerating}
        >
          <Ionicons name="arrow-up" size={16} color={input.trim() && !isGenerating ? "#fff" : C.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  history: { maxHeight: 80 },
  historyItem: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  historyUser: { alignItems: "flex-end" },
  historyText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  historyTextUser: { color: C.accent },
  suggestions: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 6,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  typing: { paddingHorizontal: 8, paddingVertical: 2 },
  typingText: { fontSize: 11, color: C.accent, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  input: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: 60,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: C.surfaceTertiary },
});
