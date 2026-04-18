import React, { useState } from "react";
import { Text, View, ScrollView, StyleSheet, Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { C } from "./types";
import { openLink, parseLinksInText } from "@/lib/link-utils";

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
  | { type: "numbered"; items: string[] }
  | { type: "hr" }
  | { type: "table"; headers: string[]; rows: string[][] };

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

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Table (detect | header | header | pattern)
    if (line.includes("|") && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
      const headers = line.split("|").map((h) => h.trim()).filter(Boolean);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter(Boolean));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
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
      return <CodeBlock key={key} language={block.language} code={block.code} />;

    case "hr":
      return <View key={key} style={mdStyles.hr} />;

    case "table":
      return (
        <ScrollView key={key} horizontal showsHorizontalScrollIndicator={false} style={mdStyles.tableWrap}>
          <View>
            <View style={mdStyles.tableHeaderRow}>
              {block.headers.map((h, hi) => (
                <Text key={hi} style={mdStyles.tableHeader}>{h}</Text>
              ))}
            </View>
            {block.rows.map((row, ri) => (
              <View key={ri} style={[mdStyles.tableRow, ri % 2 === 1 && mdStyles.tableRowAlt]}>
                {row.map((cell, ci) => (
                  <Text key={ci} style={mdStyles.tableCell}>{cell}</Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
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

// ── Code Block with copy button ─────────────────────────────────────────────

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={mdStyles.codeBlock}>
      <View style={mdStyles.codeHeader}>
        <Text style={mdStyles.codeLang}>{language}</Text>
        <Pressable onPress={handleCopy} hitSlop={8} style={mdStyles.codeCopyBtn}>
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={copied ? "#6EE7B7" : "#888"} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={mdStyles.codeText} selectable>{code}</Text>
      </ScrollView>
    </View>
  );
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
    // Markdown link: [text](url)
    const linkMatch = seg.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      return (
        <Text
          key={i}
          style={mdStyles.link}
          onPress={() => openLink(linkMatch[2])}
        >
          {linkMatch[1]}
        </Text>
      );
    }
    // Plain text: detect bare URLs and make them tappable
    return renderTextWithLinks(seg, i);
  });
}

/** Render plain text with bare URLs detected and made tappable */
function renderTextWithLinks(text: string, key: number): React.ReactNode {
  const segments = parseLinksInText(text);
  if (segments.length === 1 && segments[0].type === "text") {
    return segments[0].content;
  }
  return (
    <Text key={key}>
      {segments.map((seg, j) => {
        if (seg.type === "link" && seg.url) {
          return (
            <Text
              key={`${key}-${j}`}
              style={mdStyles.link}
              onPress={() => openLink(seg.url!)}
            >
              {seg.content}
            </Text>
          );
        }
        return seg.content;
      })}
    </Text>
  );
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
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  codeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeLang: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  codeCopyBtn: {
    padding: 4,
  },
  codeText: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#E0E0E0",
    lineHeight: 20,
  },
  link: {
    color: C.accent,
    textDecorationLine: "underline" as const,
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
  hr: {
    height: 0.5,
    backgroundColor: C.border,
    marginVertical: 12,
  },
  tableWrap: { marginVertical: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.accent,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  tableHeader: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    minWidth: 80,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableRowAlt: {
    backgroundColor: C.surfaceSecondary,
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.text,
    minWidth: 80,
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
