/**
 * Link Utilities — URL detection, parsing, and opening.
 */

import { Linking } from "react-native";

/**
 * Opens a URL in the device's default browser.
 * Auto-prepends https:// if missing.
 */
export async function openLink(url: string): Promise<void> {
  let finalUrl = url.trim();
  if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
    finalUrl = "https://" + finalUrl;
  }
  try {
    const canOpen = await Linking.canOpenURL(finalUrl);
    if (canOpen) {
      await Linking.openURL(finalUrl);
    }
  } catch (error) {
    console.error("Failed to open URL:", error);
  }
}

export interface TextSegment {
  type: "text" | "link";
  content: string;
  url?: string;
}

/**
 * Detects bare URLs in text that aren't already inside markdown link syntax.
 * Returns an array of segments: plain text or link objects.
 */
export function parseLinksInText(text: string): TextSegment[] {
  const urlRegex = /(?:https?:\/\/)[^\s\)\]>]+|(?:www\.)[^\s\)\]>]+|(?<![\/\w@])([a-zA-Z0-9][-a-zA-Z0-9]*\.(?:com|org|net|io|co|dev|app|ai|edu|gov|me|info|biz|us|uk|ca|tech|xyz)(?:\/[^\s\)\]>]*)?)/gi;

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlRegex)) {
    const matchStart = match.index!;
    const matchEnd = matchStart + match[0].length;

    // Skip if it looks like an email
    if (matchStart > 0 && text[matchStart - 1] === "@") continue;

    // Don't include trailing punctuation
    let url = match[0];
    while (url.endsWith(".") || url.endsWith(",") || url.endsWith(";") || url.endsWith(":") || url.endsWith("!") || url.endsWith("?")) {
      url = url.slice(0, -1);
    }

    // Add text before this match
    if (matchStart > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, matchStart) });
    }

    // Add the link
    let fullUrl = url;
    if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
      fullUrl = "https://" + fullUrl;
    }
    segments.push({ type: "link", content: url, url: fullUrl });

    lastIndex = matchStart + url.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  // If no links found, return single text segment
  if (segments.length === 0) {
    segments.push({ type: "text", content: text });
  }

  return segments;
}
