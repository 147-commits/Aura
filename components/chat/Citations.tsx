import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import { C, type Citation, type DocumentRequest } from "./types";

export function CitationsList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <View style={styles.citationsWrap}>
      <Text style={styles.citationsLabel}>Sources</Text>
      {citations.map((c, i) => (
        <Pressable
          key={i}
          onPress={() => c.url && Linking.openURL(c.url)}
          style={styles.citationItem}
        >
          <Ionicons name="link-outline" size={11} color={C.accent} />
          <Text style={styles.citationText} numberOfLines={1}>{c.title || c.url}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function DocumentDownloadButton({
  documentRequest,
  deviceId,
}: {
  documentRequest: DocumentRequest;
  deviceId: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/export", baseUrl);
      const headers = { "Content-Type": "application/json", "x-device-id": deviceId };

      if (Platform.OS === "web") {
        const resp = await global.fetch(url.toString(), {
          method: "POST", headers,
          body: JSON.stringify(documentRequest),
        });
        if (resp.ok) {
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = documentRequest.filename || "aura-export.pdf";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }
      } else {
        const FileSystem = await import("expo-file-system");
        const Sharing = await import("expo-sharing");
        const filename = documentRequest.filename || "aura-export.pdf";
        const fileUri = FileSystem.documentDirectory + filename;
        const resp = await fetch(url.toString(), {
          method: "POST", headers,
          body: JSON.stringify(documentRequest),
        });
        if (resp.ok) {
          const arrayBuf = await resp.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: "application/pdf",
              dialogTitle: documentRequest.title,
            });
          }
        }
      }
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Pressable style={styles.downloadBtn} onPress={handleDownload} disabled={downloading}>
      <Ionicons name={downloading ? "hourglass-outline" : "document-outline"} size={14} color="#fff" />
      <Text style={styles.downloadBtnText}>
        {downloading ? "Generating..." : `Download ${documentRequest.type?.toUpperCase() || "PDF"}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  citationsWrap: { marginTop: 4, gap: 4 },
  citationsLabel: { fontSize: 10, color: C.textTertiary, fontFamily: "Inter_500Medium", marginBottom: 2 },
  citationItem: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3 },
  citationText: { fontSize: 11, color: C.accent, fontFamily: "Inter_400Regular", textDecorationLine: "underline", flex: 1 },
  downloadBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    marginTop: 8, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.accent, borderRadius: 8, alignSelf: "flex-start" as const,
  },
  downloadBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
