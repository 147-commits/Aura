/**
 * LivePreview — WebView that renders HTML/React crafts with live streaming updates.
 *
 * Loads a shell HTML page once, then injects content updates via JavaScript
 * throttled to 250ms for smooth rendering without overwhelming the WebView.
 */

import React, { useRef, useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { throttle } from "@/lib/craft-stream";

const C = Colors.dark;

// Conditionally import WebView — not available on all platforms
let WebView: any = null;
try {
  WebView = require("react-native-webview").WebView;
} catch {
  // WebView not available (e.g., web platform without iframe fallback)
}

/** Shell HTML for standard HTML crafts */
const HTML_SHELL = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com https://cdn.tailwindcss.com; style-src 'unsafe-inline' https://cdn.tailwindcss.com; img-src data: https:; font-src https://fonts.gstatic.com;">
  <script src="https://cdn.tailwindcss.com"></script>
  <style id="dynamic-styles"></style>
</head>
<body class="bg-white text-gray-900">
  <div id="app"></div>
  <script>
    window.updatePreview = function(html, css) {
      document.getElementById('app').innerHTML = html;
      if (css) document.getElementById('dynamic-styles').textContent = css;
    };
  </script>
</body>
</html>`;

/** Shell HTML for React component previews */
const REACT_SHELL = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.tailwindcss.com; style-src 'unsafe-inline' https://cdn.tailwindcss.com; img-src data: https:; font-src https://fonts.gstatic.com;">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body class="bg-white text-gray-900">
  <div id="root"></div>
  <script>
    window.updateReactPreview = function(code) {
      try {
        var transformed = Babel.transform(code, { presets: ['react'] }).code;
        var fn = new Function('React', 'ReactDOM', transformed);
        fn(React, ReactDOM);
      } catch(e) {
        document.getElementById('root').innerHTML = '<pre style="color:red;padding:16px;font-size:12px;">' + e.message + '</pre>';
      }
    };
  </script>
</body>
</html>`;

interface LivePreviewProps {
  content: string;
  kind: "html" | "react";
  isStreaming: boolean;
  showCode?: boolean;
}

export function LivePreview({ content, kind, isStreaming, showCode = false }: LivePreviewProps) {
  const webViewRef = useRef<any>(null);
  const [showCodeView, setShowCodeView] = useState(showCode);

  // Throttled update — injects content into WebView every 250ms
  const throttledInject = useCallback(
    throttle((html: string) => {
      if (!webViewRef.current) return;
      if (kind === "react") {
        const escaped = JSON.stringify(html);
        webViewRef.current.injectJavaScript(
          `window.updateReactPreview(${escaped}); true;`
        );
      } else {
        const escaped = JSON.stringify(html);
        webViewRef.current.injectJavaScript(
          `window.updatePreview(${escaped}); true;`
        );
      }
    }, 250),
    [kind]
  );

  // Feed content updates to WebView during streaming
  useEffect(() => {
    if (content && !showCodeView) {
      throttledInject(content);
    }
  }, [content, showCodeView]);

  // Web platform fallback — use iframe
  if (Platform.OS === "web") {
    if (showCodeView) {
      return (
        <View style={styles.container}>
          <CodeToggle showCode={showCodeView} onToggle={() => setShowCodeView(!showCodeView)} isStreaming={isStreaming} />
          <View style={styles.codeContainer}>
            <Text style={styles.codeText} selectable>{content}</Text>
          </View>
        </View>
      );
    }

    const fullHtml = kind === "react"
      ? REACT_SHELL.replace("</body>", `<script type="text/babel">${content}\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App || function(){return null}));</script></body>`)
      : `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-white text-gray-900">${content}</body></html>`;

    return (
      <View style={styles.container}>
        <CodeToggle showCode={showCodeView} onToggle={() => setShowCodeView(!showCodeView)} isStreaming={isStreaming} />
        <iframe
          srcDoc={fullHtml}
          style={{ flex: 1, border: "none", borderRadius: 12, minHeight: 300, backgroundColor: "#fff" } as any}
          sandbox="allow-scripts"
        />
      </View>
    );
  }

  // Native platform — use WebView
  if (!WebView) {
    return (
      <View style={styles.container}>
        <View style={styles.fallback}>
          <Ionicons name="code-slash-outline" size={24} color={C.textTertiary} />
          <Text style={styles.fallbackText}>Preview not available</Text>
        </View>
      </View>
    );
  }

  if (showCodeView) {
    return (
      <View style={styles.container}>
        <CodeToggle showCode={showCodeView} onToggle={() => setShowCodeView(!showCodeView)} isStreaming={isStreaming} />
        <View style={styles.codeContainer}>
          <Text style={styles.codeText} selectable>{content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CodeToggle showCode={showCodeView} onToggle={() => setShowCodeView(!showCodeView)} isStreaming={isStreaming} />
      <WebView
        ref={webViewRef}
        source={{ html: kind === "react" ? REACT_SHELL : HTML_SHELL }}
        javaScriptEnabled={true}
        javaScriptCanOpenWindowsAutomatically={false}
        originWhitelist={["about:blank"]}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        onShouldStartLoadWithRequest={() => false}
        style={styles.webview}
        onLoad={() => {
          // Inject initial content after shell loads
          if (content) throttledInject(content);
        }}
      />
      {isStreaming && (
        <View style={styles.streamingBadge}>
          <View style={styles.streamingDot} />
          <Text style={styles.streamingText}>Building live...</Text>
        </View>
      )}
    </View>
  );
}

function CodeToggle({ showCode, onToggle, isStreaming }: { showCode: boolean; onToggle: () => void; isStreaming: boolean }) {
  return (
    <View style={styles.toggleBar}>
      <Pressable style={[styles.toggleBtn, !showCode && styles.toggleBtnActive]} onPress={() => { if (showCode) onToggle(); }}>
        <Ionicons name="eye-outline" size={14} color={!showCode ? C.accent : C.textTertiary} />
        <Text style={[styles.toggleText, !showCode && styles.toggleTextActive]}>Preview</Text>
      </Pressable>
      <Pressable style={[styles.toggleBtn, showCode && styles.toggleBtnActive]} onPress={() => { if (!showCode) onToggle(); }}>
        <Ionicons name="code-slash-outline" size={14} color={showCode ? C.accent : C.textTertiary} />
        <Text style={[styles.toggleText, showCode && styles.toggleTextActive]}>Code</Text>
      </Pressable>
      {isStreaming && (
        <View style={styles.liveIndicator}>
          <View style={styles.streamingDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 250 },
  webview: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12 },
  toggleBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleBtnActive: {
    backgroundColor: C.accentGlow,
    borderColor: C.accent,
  },
  toggleText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textTertiary },
  toggleTextActive: { color: C.accent },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  liveText: { fontSize: 10, fontFamily: "Inter_700Bold", color: C.error, letterSpacing: 1 },
  streamingBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  streamingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.error,
  },
  streamingText: { fontSize: 11, color: "#FFFFFF", fontFamily: "Inter_500Medium" },
  codeContainer: {
    flex: 1,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  codeText: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: C.text,
    lineHeight: 20,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 32,
  },
  fallbackText: { fontSize: 13, color: C.textTertiary, fontFamily: "Inter_400Regular" },
});
