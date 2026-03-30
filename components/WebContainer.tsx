import React from "react";
import { View, StyleSheet, Platform, useWindowDimensions } from "react-native";

const WEB_BREAKPOINT = 768;

export function useIsWideWeb() {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= WEB_BREAKPOINT;
}

export default function WebContainer({
  children,
  maxWidth = 720,
  noPadding = false,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  noPadding?: boolean;
}) {
  const isWide = useIsWideWeb();

  if (!isWide) {
    return <View style={styles.mobileContainer}>{children}</View>;
  }

  return (
    <View style={styles.webOuter}>
      <View style={[styles.webInner, { maxWidth }, noPadding && { paddingHorizontal: 0 }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileContainer: {
    flex: 1,
  },
  webOuter: {
    flex: 1,
    alignItems: "center",
  },
  webInner: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 16,
  },
});
