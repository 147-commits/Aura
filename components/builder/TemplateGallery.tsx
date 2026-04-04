/**
 * TemplateGallery — 5 website templates for one-tap project creation.
 */

import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const C = Colors.dark;

export interface BuilderTemplate {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  prompt: string;
}

export const BUILDER_TEMPLATES: BuilderTemplate[] = [
  {
    id: "portfolio",
    name: "Personal Portfolio",
    description: "Dark, minimal, developer-focused",
    icon: "person-outline",
    prompt: "Build a personal portfolio website. Dark theme, minimal design, developer-focused. Include: hero section with name and title, about section, skills/technologies grid, featured projects with thumbnails, and a contact section. Use a monospace font accent.",
  },
  {
    id: "landing",
    name: "Landing Page",
    description: "Hero, features, CTA, pricing",
    icon: "rocket-outline",
    prompt: "Build a SaaS landing page. Include: large hero section with headline and CTA button, feature grid (3-4 features with icons), social proof/testimonials, pricing table (3 tiers), and footer with links. Modern and professional.",
  },
  {
    id: "blog",
    name: "Blog",
    description: "Clean reading experience",
    icon: "book-outline",
    prompt: "Build a blog homepage. Clean reading experience with article cards, featured post hero, category navigation, sidebar with recent posts and tags, and newsletter signup. Elegant typography focused.",
  },
  {
    id: "restaurant",
    name: "Restaurant / Business",
    description: "Menu, hours, location, contact",
    icon: "restaurant-outline",
    prompt: "Build a restaurant website. Include: hero with restaurant photo, about section, menu with categories and prices, hours of operation, location with map placeholder, reservation form, and contact info. Warm, inviting design.",
  },
  {
    id: "coming-soon",
    name: "Coming Soon",
    description: "Email capture, countdown, social",
    icon: "time-outline",
    prompt: "Build a coming soon page. Large centered heading, brief description, email capture input with submit button, social media links, and a subtle animated background. Minimal and elegant.",
  },
  // Mobile app templates
  {
    id: "todo-app",
    name: "Todo App",
    description: "List, add, complete, delete tasks",
    icon: "checkbox-outline",
    prompt: "Build a Todo app with React Native. Features: add tasks with a text input, mark tasks complete with a checkbox, delete tasks with swipe or button, task counter showing completed/total. Clean minimal design with a header.",
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Grid layout, basic operations",
    icon: "calculator-outline",
    prompt: "Build a Calculator app with React Native. Grid layout of number buttons (0-9), operations (+, -, ×, ÷), equals, clear, and decimal point. Display showing current input and result. Dark theme with rounded buttons.",
  },
  {
    id: "profile-card",
    name: "Profile Card",
    description: "Avatar, bio, social links, gradient",
    icon: "person-circle-outline",
    prompt: "Build a Profile Card app with React Native. Features: large avatar image at top, name and title, bio paragraph, social media link buttons (GitHub, Twitter, LinkedIn), stats row (followers, projects, stars). Gradient header background.",
  },
];

export function TemplateGallery({
  onSelect,
}: {
  onSelect: (template: BuilderTemplate) => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
      {BUILDER_TEMPLATES.map((t) => (
        <Pressable
          key={t.id}
          style={styles.card}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelect(t);
          }}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={t.icon} size={24} color={C.accent} />
          </View>
          <Text style={styles.name}>{t.name}</Text>
          <Text style={styles.desc}>{t.description}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10, paddingBottom: 20 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.accentGlow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary },
});
