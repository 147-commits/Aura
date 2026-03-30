import React from "react";
import { Text } from "react-native";
import { C } from "./types";

export function FormattedText({
  text,
  style,
  isUser,
}: {
  text: string;
  style?: any;
  isUser?: boolean;
}) {
  const segments = text.split(/(\*\*[^*\n]+\*\*|→)/g);
  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        if (seg.startsWith("**") && seg.endsWith("**")) {
          return (
            <Text key={i} style={{ fontWeight: "700" as const }}>
              {seg.slice(2, -2)}
            </Text>
          );
        }
        if (seg === "→" && !isUser) {
          return (
            <Text key={i} style={{ fontWeight: "700" as const, color: C.accent }}>
              →
            </Text>
          );
        }
        return seg;
      })}
    </Text>
  );
}
