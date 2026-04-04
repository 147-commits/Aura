/**
 * Snack Engine — Expo Snack integration for mobile app preview.
 *
 * Snack handles compilation and bundling in the cloud.
 * We send code, it returns a preview URL and QR code.
 */

import { Snack, SnackFiles } from "snack-sdk";

const SNACK_RUNTIME_VERSION = "54.0.0";

/** Create a new Snack project from files */
export async function createSnackProject(
  files: Record<string, string>,
  dependencies?: Record<string, { version: string }>
): Promise<{ snackId: string; webPreviewUrl: string; qrCodeUrl: string }> {
  const snackFiles: SnackFiles = {};
  for (const [name, content] of Object.entries(files)) {
    snackFiles[name] = { type: "CODE", contents: content };
  }

  const snack = new Snack({
    files: snackFiles,
    dependencies: dependencies || {
      "react-native-paper": { version: "5.*" },
    },
    sdkVersion: SNACK_RUNTIME_VERSION,
    name: "Aura App",
  });

  // Save to get a Snack ID
  const { id } = await snack.saveAsync();
  const snackId = id || "unsaved";

  return {
    snackId,
    webPreviewUrl: `https://snack.expo.dev/${snackId}`,
    qrCodeUrl: `exp://exp.host/@snack/${snackId}`,
  };
}

/** Update files in an existing Snack project */
export async function updateSnackFiles(
  snackId: string,
  files: Record<string, string>
): Promise<{ webPreviewUrl: string; qrCodeUrl: string }> {
  const snackFiles: SnackFiles = {};
  for (const [name, content] of Object.entries(files)) {
    snackFiles[name] = { type: "CODE", contents: content };
  }

  const snack = new Snack({
    files: snackFiles,
    sdkVersion: SNACK_RUNTIME_VERSION,
    name: "Aura App",
  });

  const { id } = await snack.saveAsync();
  const resolvedId = id || snackId;

  return {
    webPreviewUrl: `https://snack.expo.dev/${resolvedId}`,
    qrCodeUrl: `exp://exp.host/@snack/${resolvedId}`,
  };
}

/** Common React Native errors and suggested fixes */
export const RN_ERROR_FIXES: { pattern: string; fix: string }[] = [
  {
    pattern: "Text strings must be rendered within a <Text>",
    fix: "Wrap all text content in <Text> components. Never put raw strings inside <View>.",
  },
  {
    pattern: "undefined is not an object",
    fix: "Check that all imported modules exist and are properly imported.",
  },
  {
    pattern: "Invariant Violation",
    fix: "Make sure you're not using HTML elements like <div> or <span>. Use <View> and <Text> instead.",
  },
  {
    pattern: "Cannot read property",
    fix: "A variable or prop is undefined. Add null checks or provide default values.",
  },
];

/** Build an error-correction prompt for the AI */
export function buildErrorCorrectionPrompt(code: string, error: string): string {
  const matchedFix = RN_ERROR_FIXES.find((f) =>
    error.toLowerCase().includes(f.pattern.toLowerCase())
  );

  return `The following React Native code has an error:

ERROR: ${error}
${matchedFix ? `\nLIKELY FIX: ${matchedFix.fix}` : ""}

CURRENT CODE:
\`\`\`tsx
${code}
\`\`\`

Fix the error and return the COMPLETE corrected App.tsx. Remember:
- All text must be in <Text> components
- Use View, not div
- Use StyleSheet.create for styles
- No px units, no position: fixed, no CSS Grid`;
}
