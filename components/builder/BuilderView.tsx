/**
 * BuilderView — main builder interface with split preview + chat/code view.
 *
 * Top: live HTML preview (WebView or iframe)
 * Bottom: toggle between chat iteration and code view
 * Device frame toggle: mobile / tablet / desktop widths
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, Platform, TextInput, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";
import { LivePreview } from "@/components/crafts/LivePreview";
import { BuilderChat } from "./BuilderChat";
import { TemplateGallery, type BuilderTemplate } from "./TemplateGallery";

const C = Colors.dark;
const DEVICE_ID_KEY = "aura:device_id";

type BottomView = "chat" | "code";
type DeviceWidth = "mobile" | "tablet" | "desktop";

const DEVICE_WIDTHS: Record<DeviceWidth, number | "100%"> = {
  mobile: 375,
  tablet: 768,
  desktop: "100%",
};

export function BuilderView({
  initialProjectId,
  initialPrompt,
  onClose,
}: {
  initialProjectId?: string;
  initialPrompt?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [projectName, setProjectName] = useState("Untitled Website");
  const [htmlContent, setHtmlContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [bottomView, setBottomView] = useState<BottomView>("chat");
  const [deviceWidth, setDeviceWidth] = useState<DeviceWidth>("desktop");
  const [fullscreen, setFullscreen] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [showTemplates, setShowTemplates] = useState(!initialProjectId && !initialPrompt);
  const [deviceId, setDeviceId] = useState("anonymous");
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [version, setVersion] = useState(1);

  useEffect(() => {
    AsyncStorage.getItem(DEVICE_ID_KEY).then((id) => { if (id) setDeviceId(id); });
    if (initialPrompt) handleGenerate(initialPrompt);
  }, []);

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    setShowTemplates(false);
    setChatHistory((prev) => [...prev, { role: "user", content: prompt }]);

    try {
      const baseUrl = getApiUrl();
      const resp = await fetch(new URL("/api/builder/generate", baseUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({
          projectId,
          prompt,
          type: "website",
          name: projectName,
        }),
      });

      if (!resp.ok) throw new Error("Generation failed");

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullHtml = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "chunk" && parsed.content) {
              fullHtml += parsed.content;
              setHtmlContent(fullHtml);
            } else if (parsed.type === "complete" && parsed.project) {
              setProjectId(parsed.project.id);
              setProjectName(parsed.project.name);
            }
          } catch {}
        }
      }

      setVersion((v) => v + 1);
      setChatHistory((prev) => [...prev, { role: "assistant", content: "Website updated" }]);
    } catch (err) {
      console.error("Builder error:", err);
      setChatHistory((prev) => [...prev, { role: "assistant", content: "Couldn't build that — try again" }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTemplateSelect = (template: BuilderTemplate) => {
    setProjectName(template.name);
    handleGenerate(template.prompt);
  };

  if (fullscreen) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.fullscreenBar}>
          <Pressable onPress={() => setFullscreen(false)} style={styles.backBtn}>
            <Ionicons name="contract-outline" size={18} color={C.text} />
          </Pressable>
          <Text style={styles.urlBar}>preview://{projectName.toLowerCase().replace(/\s+/g, "-")}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {htmlContent ? (
            <LivePreview content={htmlContent} kind="html" isStreaming={isGenerating} />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{projectName}</Text>
          <Text style={styles.urlBar}>preview://{projectName.toLowerCase().replace(/\s+/g, "-")}</Text>
        </View>
        <View style={styles.headerActions}>
          {version > 1 && (
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>v{version}</Text>
            </View>
          )}
          {htmlContent && (
            <Pressable
              onPress={async () => {
                if (isDeploying || !projectId) return;
                setIsDeploying(true);
                try {
                  const baseUrl = getApiUrl();
                  // For MVP: prompt user for token via alert. In production: use expo-secure-store.
                  const token = Platform.OS === "web" ? prompt("Enter your Vercel token:") : null;
                  if (!token) { setIsDeploying(false); return; }
                  const resp = await fetch(new URL(`/api/builder/projects/${projectId}/deploy`, baseUrl).toString(), {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-device-id": deviceId },
                    body: JSON.stringify({ vercelToken: token }),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    setDeployUrl(data.url);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                } catch (err) {
                  console.error("Deploy error:", err);
                } finally {
                  setIsDeploying(false);
                }
              }}
              style={[styles.deployBtn, isDeploying && { opacity: 0.5 }]}
              disabled={isDeploying}
            >
              <Ionicons name={isDeploying ? "hourglass-outline" : "cloud-upload-outline"} size={14} color="#fff" />
              <Text style={styles.deployBtnText}>{isDeploying ? "Deploying..." : "Deploy"}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setFullscreen(true)} style={styles.actionBtn}>
            <Ionicons name="expand-outline" size={16} color={C.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Device frame toggle */}
      <View style={styles.deviceBar}>
        {(["mobile", "tablet", "desktop"] as DeviceWidth[]).map((d) => (
          <Pressable
            key={d}
            style={[styles.deviceBtn, deviceWidth === d && styles.deviceBtnActive]}
            onPress={() => { setDeviceWidth(d); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Ionicons
              name={d === "mobile" ? "phone-portrait-outline" : d === "tablet" ? "tablet-portrait-outline" : "desktop-outline"}
              size={14}
              color={deviceWidth === d ? C.accent : C.textTertiary}
            />
          </Pressable>
        ))}
        {isGenerating && (
          <View style={styles.buildingBadge}>
            <Text style={styles.buildingText}>Building...</Text>
          </View>
        )}
        {!isGenerating && htmlContent && (
          <View style={styles.readyBadge}>
            <Ionicons name="checkmark" size={12} color={C.confidenceHigh} />
            <Text style={styles.readyText}>Preview ready</Text>
          </View>
        )}
      </View>

      {/* Deploy URL banner */}
      {deployUrl && (
        <Pressable
          style={styles.deployBanner}
          onPress={() => { if (Platform.OS === "web") window.open(deployUrl, "_blank"); else Linking.openURL(deployUrl); }}
        >
          <Ionicons name="globe" size={14} color={C.confidenceHigh} />
          <Text style={styles.deployBannerText} numberOfLines={1}>{deployUrl}</Text>
          <Ionicons name="open-outline" size={14} color={C.accent} />
        </Pressable>
      )}

      {/* Preview area (top 60%) */}
      <View style={[styles.preview, { alignItems: "center" }]}>
        {showTemplates ? (
          <ScrollView style={{ flex: 1, width: "100%" }} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.templatesTitle}>Start with a template</Text>
            <TemplateGallery onSelect={handleTemplateSelect} />
          </ScrollView>
        ) : htmlContent ? (
          <View style={[
            styles.previewFrame,
            { maxWidth: DEVICE_WIDTHS[deviceWidth] === "100%" ? undefined : DEVICE_WIDTHS[deviceWidth], width: "100%" },
          ]}>
            <LivePreview content={htmlContent} kind="html" isStreaming={isGenerating} />
          </View>
        ) : (
          <View style={styles.emptyPreview}>
            <Ionicons name="globe-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyText}>Describe your website to start building</Text>
          </View>
        )}
      </View>

      {/* Bottom panel toggle */}
      <View style={styles.panelToggle}>
        <Pressable
          style={[styles.toggleBtn, bottomView === "chat" && styles.toggleBtnActive]}
          onPress={() => setBottomView("chat")}
        >
          <Ionicons name="chatbubble-outline" size={14} color={bottomView === "chat" ? C.accent : C.textTertiary} />
          <Text style={[styles.toggleText, bottomView === "chat" && styles.toggleTextActive]}>Chat</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, bottomView === "code" && styles.toggleBtnActive]}
          onPress={() => setBottomView("code")}
        >
          <Ionicons name="code-slash-outline" size={14} color={bottomView === "code" ? C.accent : C.textTertiary} />
          <Text style={[styles.toggleText, bottomView === "code" && styles.toggleTextActive]}>Code</Text>
        </Pressable>
      </View>

      {/* Bottom panel (40%) */}
      <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {bottomView === "chat" ? (
          <BuilderChat
            onSend={handleGenerate}
            isGenerating={isGenerating}
            history={chatHistory}
          />
        ) : (
          <ScrollView style={styles.codeView} showsVerticalScrollIndicator={false}>
            <Text style={styles.codeText} selectable>
              {htmlContent || "// No code generated yet"}
            </Text>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  backBtn: { padding: 6 },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  urlBar: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textTertiary },
  headerActions: { flexDirection: "row", gap: 4 },
  actionBtn: { padding: 6 },
  deviceBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  deviceBtn: {
    padding: 6,
    borderRadius: 6,
  },
  deviceBtnActive: { backgroundColor: C.accentGlow },
  buildingBadge: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: C.accentGlow,
  },
  buildingText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.accent },
  readyBadge: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readyText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.confidenceHigh },
  preview: { flex: 3, backgroundColor: C.surfaceSecondary },
  previewFrame: { flex: 1, borderRadius: 0 },
  emptyPreview: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textTertiary, textAlign: "center", maxWidth: 220 },
  templatesTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 16 },
  fullscreenBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  panelToggle: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 4,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: C.accentGlow },
  toggleText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textTertiary },
  toggleTextActive: { color: C.accent },
  bottomPanel: { flex: 2, paddingHorizontal: 12, paddingTop: 8 },
  codeView: { flex: 1, backgroundColor: C.surfaceSecondary, borderRadius: 10, padding: 12 },
  codeText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: C.text,
    lineHeight: 18,
  },
  versionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: C.accentGlow,
  },
  versionText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.accent },
  deployBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  deployBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  deployBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.accentGlow,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  deployBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.accent,
  },
});
