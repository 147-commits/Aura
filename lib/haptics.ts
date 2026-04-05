/**
 * Centralized haptic feedback helper.
 * Only triggers on iOS/Android — silently no-ops on web.
 */

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export const haptic = {
  /** Light tap — for selections, toggles, taps */
  light: () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Medium tap — for completing actions, regenerate */
  medium: () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /** Heavy tap — use sparingly */
  heavy: () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  /** Success — for confirmations (copy, download, save) */
  success: () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** Warning — for caution states */
  warning: () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  /** Error — for failures */
  error: () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  /** Selection — for picker/selection changes */
  selection: () => isNative && Haptics.selectionAsync(),
};
