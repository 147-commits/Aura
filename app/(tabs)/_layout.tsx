import React, { useState } from "react";
import { Tabs } from "expo-router";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import Colors from "@/constants/colors";

const C = Colors.dark;
const WEB_BREAKPOINT = 768;

/**
 * 4+1 Navigation Architecture (from research):
 *
 * Chat | Tasks | [+] | Memory | More
 *
 * - Chat is home (universal entry point — zero friction)
 * - Tasks consolidates today/projects/tasks into one view with segments
 * - Center FAB opens quick-create bottom sheet
 * - Memory is its own destination (key differentiator)
 * - More contains settings, exports, account
 *
 * "Today" and "Projects" become segments within Tasks tab,
 * following Things 3's temporal navigation pattern.
 */

type TabItem = {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const TAB_ITEMS: TabItem[] = [
  { name: "aura", title: "Aura", icon: "chatbubble-outline", iconActive: "chatbubble" },
  { name: "tasks", title: "Tasks", icon: "checkbox-outline", iconActive: "checkbox" },
  { name: "today", title: "", icon: "add", iconActive: "add" }, // Center FAB placeholder
  { name: "memory", title: "Memory", icon: "layers-outline", iconActive: "layers" },
  { name: "projects", title: "More", icon: "ellipsis-horizontal", iconActive: "ellipsis-horizontal" },
];

function NavItem({
  item,
  isActive,
  onPress,
}: {
  item: TabItem;
  isActive: boolean;
  onPress: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={[
        sidebarStyles.navItem,
        isActive && sidebarStyles.navItemActive,
        isHovered && !isActive && sidebarStyles.navItemHover,
      ]}
    >
      <Ionicons
        name={isActive ? item.iconActive : item.icon}
        size={20}
        color={isActive ? C.accent : C.textSecondary}
      />
      <Text
        style={[
          sidebarStyles.navLabel,
          isActive && sidebarStyles.navLabelActive,
        ]}
      >
        {item.title}
      </Text>
    </Pressable>
  );
}

function WebSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab =
    TAB_ITEMS.find((t) => pathname.includes(t.name))?.name || "aura";

  return (
    <View style={sidebarStyles.container}>
      <View style={sidebarStyles.logoSection}>
        <View style={sidebarStyles.logoOrb}>
          <View style={sidebarStyles.logoOrbInner}>
            <View style={sidebarStyles.logoOrbCore} />
          </View>
        </View>
        <Text style={sidebarStyles.logoText}>Aura</Text>
        <Text style={sidebarStyles.logoSubtext}>truth-first</Text>
      </View>

      <View style={sidebarStyles.navList}>
        {TAB_ITEMS.filter((t) => t.title !== "").map((item) => (
          <NavItem
            key={item.name}
            item={item}
            isActive={activeTab === item.name}
            onPress={() => router.push(`/(tabs)/${item.name}` as any)}
          />
        ))}
      </View>

      <View style={sidebarStyles.footer}>
        <View style={sidebarStyles.statusRow}>
          <View style={sidebarStyles.statusDot} />
          <Text style={sidebarStyles.statusText}>Encrypted</Text>
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= WEB_BREAKPOINT;

  if (isWideWeb) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: C.background }}>
        <WebSidebar />
        <View style={{ flex: 1 }}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: "none" },
            }}
          >
            {TAB_ITEMS.map((item) => (
              <Tabs.Screen
                key={item.name}
                name={item.name}
                options={{ title: item.title }}
              />
            ))}
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.tabIconDefault,
        tabBarStyle: {
          backgroundColor: C.background,
          borderTopColor: C.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 85 : 65,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="aura"
        options={{
          title: "Aura",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "chatbubble" : "chatbubble-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "checkbox" : "checkbox-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: "",
          tabBarIcon: () => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: C.accent,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: Platform.OS === "ios" ? 16 : 8,
                shadowColor: C.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="memory"
        options={{
          title: "Memory",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? "layers" : "layers-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "More",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const sidebarStyles = StyleSheet.create({
  container: {
    width: 220,
    backgroundColor: C.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: C.border,
    paddingVertical: 20,
    paddingHorizontal: 12,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  logoOrb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoOrbInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoOrbCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.accent,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -0.5,
  },
  logoSubtext: {
    fontSize: 11,
    color: C.textSecondary,
  },
  navList: {
    flex: 1,
    gap: 2,
    marginTop: 20,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
  },
  navItemHover: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  navLabel: {
    fontSize: 14,
    color: C.textSecondary,
    fontWeight: "500",
  },
  navLabelActive: {
    color: C.accent,
    fontWeight: "600",
  },
  footer: {
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.success,
  },
  statusText: {
    fontSize: 11,
    color: C.textSecondary,
  },
});
