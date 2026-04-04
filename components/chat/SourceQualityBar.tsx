/**
 * SourceQualityBar — horizontal bar showing source quality distribution.
 * Shows at bottom of research-mode responses.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface Source {
  sourceType?: string;
  quality?: number;
}

const TYPE_COLORS: Record<string, string> = {
  academic: "#6B8C54",
  government: "#6B8C54",
  documentation: "#38BDF8",
  news: "#E8A84C",
  blog: "#8A8884",
  user_provided: "#D4D2CD",
};

const TYPE_LABELS: Record<string, string> = {
  academic: "Academic",
  government: "Government",
  documentation: "Docs",
  news: "News",
  blog: "Blog",
  user_provided: "User",
};

export function SourceQualityBar({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  // Count by type
  const counts: Record<string, number> = {};
  for (const s of sources) {
    const type = s.sourceType || "blog";
    counts[type] = (counts[type] || 0) + 1;
  }

  const total = sources.length;
  const segments = Object.entries(counts).sort(([, a], [, b]) => b - a);

  // Build summary text
  const parts = segments.map(([type, count]) => `${count} ${TYPE_LABELS[type] || type}`);
  const summaryText = `Based on ${total} source${total !== 1 ? "s" : ""}: ${parts.join(", ")}`;

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {segments.map(([type, count]) => (
          <View
            key={type}
            style={[
              styles.segment,
              {
                flex: count / total,
                backgroundColor: TYPE_COLORS[type] || C.textTertiary,
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.summary}>{summaryText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8, gap: 4 },
  bar: {
    flexDirection: "row",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: C.surfaceTertiary,
  },
  segment: {
    height: 4,
    minWidth: 4,
  },
  summary: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
});
