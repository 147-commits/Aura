import React from "react";
import { Text, View, ScrollView, StyleSheet, Platform, Pressable } from "react-native";
import { C } from "./types";

/**
 * FormattedText — renders AI markdown responses with professional typography.
 * Handles: bold, italic, code blocks, inline code, headers, bullets, links, blockquotes.
 */
export function FormattedText({
  text,
  style,
  isUser,
}: {
  text: string;
  style?: any;
  isUser?: boolean;
}) {
  if (isUser) {
    return <Text style={style}>{text}</Text>;
  }

  // Parse markdown blocks
  const blocks = parseMarkdown(text);

  return (
    <View style={style}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </View>
  );
}

// ── Markdown parser ─────────────────────────────────────────────────────────

type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "blockquote"; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "numbered"; items: string[] };

function parseMarkdown(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", language: lang || "code", code: codeLines.join("\n") });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      blocks.push({ type: "blockquote", text: line.slice(2) });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*→•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*→•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*→•]\s+/, ""));
        i++;
      }
      blocks.push({ type: "bullet", items });
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "numbered", items });
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-empty lines)
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("```") && !lines[i].startsWith("#") && !lines[i].startsWith("> ") && !/^[-*→•]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join(" ") });
    }
  }

  return blocks;
}

// ── Block renderers ─────────────────────────────────────────────────────────

function renderBlock(block: Block, key: number): React.ReactElement {
  switch (block.type) {
    case "heading":
      const fontSize = block.level === 1 ? 22 : block.level === 2 ? 19 : 17;
      return (
        <Text key={key} style={[mdStyles.heading, { fontSize, marginTop: block.level === 1 ? 16 : 12 }]}>
          {renderInline(block.text)}
        </Text>
      );

    case "code":
      return (
        <View key={key} style={mdStyles.codeBlock}>
          <Text style={mdStyles.codeLang}>{block.language}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={mdStyles.codeText} selectable>{block.code}</Text>
          </ScrollView>
        </View>
      );

    case "blockquote":
      return (
        <View key={key} style={mdStyles.blockquote}>
          <Text style={mdStyles.blockquoteText}>{renderInline(block.text)}</Text>
        </View>
      );

    case "bullet":
      return (
        <View key={key} style={mdStyles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={mdStyles.listItem}>
              <Text style={mdStyles.bulletDot}>→</Text>
              <Text style={mdStyles.listItemText}>{renderInline(item)}</Text>
            </View>
          ))}
        </View>
      );

    case "numbered":
      return (
        <View key={key} style={mdStyles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={mdStyles.listItem}>
              <Text style={mdStyles.bulletDot}>{i + 1}.</Text>
              <Text style={mdStyles.listItemText}>{renderInline(item)}</Text>
            </View>
          ))}
        </View>
      );

    case "paragraph":
    default:
      return (
        <Text key={key} style={mdStyles.paragraph}>
          {renderInline(block.text)}
        </Text>
      );
  }
}

// ── Inline rendering (bold, italic, code, links) ────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const segments = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*|\[([^\]]+)\]\([^)]+\)|→)/g);
  return segments.filter(Boolean).map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return <Text key={i} style={{ fontWeight: "700" }}>{seg.slice(2, -2)}</Text>;
    }
    if (seg.startsWith("`") && seg.endsWith("`")) {
      return <Text key={i} style={mdStyles.inlineCode}>{seg.slice(1, -1)}</Text>;
    }
    if (seg.startsWith("*") && seg.endsWith("*") && !seg.startsWith("**")) {
      return <Text key={i} style={{ fontStyle: "italic" }}>{seg.slice(1, -1)}</Text>;
    }
    if (seg === "→") {
      return <Text key={i} style={{ fontWeight: "700", color: C.accent }}>→</Text>;
    }
    // Link: [text](url)
    const linkMatch = seg.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      return <Text key={i} style={{ color: C.accent, textDecorationLine: "underline" }}>{linkMatch[1]}</Text>;
    }
    return seg;
  });
}

// ── Styles ──────────────────────────────────────────────────────────────────

const mdStyles = StyleSheet.create({
  heading: {
    fontWeight: "700",
    color: C.text,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
    color: C.text,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
  },
  codeBlock: {
    backgroundColor: "#1E1E22",
    borderRadius: 10,
    padding: 14,
    marginVertical: 8,
    gap: 6,
  },
  codeLang: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  codeText: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#E0E0E0",
    lineHeight: 20,
  },
  inlineCode: {
    backgroundColor: C.surfaceSecondary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    color: C.accent,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    paddingLeft: 12,
    marginVertical: 6,
    opacity: 0.85,
  },
  blockquoteText: {
    fontSize: 15,
    lineHeight: 22,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  list: { marginBottom: 8, gap: 4 },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingRight: 8,
  },
  bulletDot: {
    fontSize: 15,
    fontWeight: "700",
    color: C.accent,
    fontFamily: "Inter_700Bold",
    width: 18,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: C.text,
    fontFamily: "Inter_400Regular",
  },
});
