/**
 * SpinnerMorph — rotating brand spinner for any "Aura is working" state.
 *
 * Cross-platform: uses react-native-svg (already installed) for the path
 * and react-native-reanimated for the rotation. The original source
 * component used SVG SMIL (`<animate>`, `<animateTransform>`) for both
 * rotation AND a path morph; SMIL works in browsers but is unsupported
 * by react-native-svg on iOS/Android. We render ONE path (the middle
 * "yin-yang swirl" frame from the source's morph cycle) and animate
 * only the rotation. At typical chat sizes (24–40px) the morph would
 * not be visually perceptible anyway; the rotation carries the brand.
 *
 * If you want the full morph effect on web later, add a Platform.OS
 * branch that renders raw HTML <svg><animate /></svg> via React.createElement.
 */

import React, { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { G, Path, Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

const C = Colors.dark;

// One frame from the source's morph cycle — the "swirl" path. The original
// has 3 keyframes; this is the middle one, which is the most visually
// distinctive shape. Coordinates are in a 240×240 viewBox.
const SWIRL_PATH =
  "M152.61,168.71 L155.59,166.04 L158.45,163.07 L161.15,159.79 L163.66,156.20 L165.93,152.31 L167.91,148.12 L169.55,143.65 L170.80,138.93 L171.61,133.99 L171.93,128.88 L171.71,123.65 L170.91,118.38 L169.49,113.14 L167.43,108.03 L164.74,103.15 L161.42,98.61 L157.51,94.53 L153.08,91.01 L148.21,88.15 L143.02,86.04 L137.63,84.74 L132.19,84.28 L126.86,84.66 L121.78,85.85 L117.09,87.77 L112.89,90.32 L109.26,93.38 L106.24,96.81 L103.82,100.47 L101.95,104.22 L100.56,107.96 L98.51,109.37 L96.54,110.35 L94.64,110.84 L92.81,110.81 L91.09,110.23 L89.53,109.10 L88.19,107.45 L87.13,105.32 L86.42,102.76 L86.10,99.85 L86.22,96.68 L86.81,93.34 L87.87,89.92 L89.39,86.51 L91.35,83.19 L93.71,80.03 L96.43,77.09 L99.46,74.41 L102.75,72.03 L106.24,69.97 L109.88,68.24 L113.62,66.85 L117.41,65.79 L121.20,65.05 L125.01,64.62 L128.80,64.48 L132.54,64.61 L136.20,65.00 L139.76,65.74 L143.20,66.50 L146.51,67.30 L149.68,68.28 L152.85,69.27 L156.04,70.26 L159.23,71.25 L162.42,72.24 L165.61,73.23 Z";

// Optional bg circle padding from the edge of the viewBox
const BG_RADIUS = 118;
const BG_CENTER = 120;

const AnimatedG = Animated.createAnimatedComponent(G);

export interface SpinnerMorphProps {
  /** Pixel diameter. Default 24 (tuned for inline chat use). */
  size?: number;
  /** Fill color of the spinner shape. Defaults to the brand accent. */
  fill?: string;
  /** Background circle color. Pass "transparent" or undefined to skip. */
  bg?: string;
  /** Full-rotation duration string. Accepts "6s", "1500ms", etc. */
  rotateDur?: string;
  /**
   * Kept for API compatibility with the source component. Ignored —
   * morphing is not supported in this cross-platform implementation.
   */
  morphDur?: string;
  /** Optional wrapper style passthrough. */
  style?: ViewStyle;
  /** Pause the animation (e.g. during reduced-motion preferences). */
  paused?: boolean;
}

function parseDurationMs(dur: string | undefined, fallbackMs: number): number {
  if (!dur) return fallbackMs;
  const trimmed = dur.trim().toLowerCase();
  if (trimmed.endsWith("ms")) {
    const n = parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(n) && n > 0 ? n : fallbackMs;
  }
  if (trimmed.endsWith("s")) {
    const n = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(n) && n > 0 ? n * 1000 : fallbackMs;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) && n > 0 ? n : fallbackMs;
}

export function SpinnerMorph({
  size = 24,
  fill = C.accent,
  bg,
  rotateDur = "6s",
  morphDur: _morphDur, // accepted, deliberately unused
  style,
  paused = false,
}: SpinnerMorphProps): React.ReactElement {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (paused) return;
    const durationMs = parseDurationMs(rotateDur, 6000);
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, { duration: durationMs, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(rotation);
  }, [paused, rotateDur, rotation]);

  // react-native-svg accepts a string `transform` prop — drive it from a
  // shared value so reanimated can mutate without touching the React tree.
  const animatedProps = useAnimatedProps(() => ({
    transform: `rotate(${rotation.value} ${BG_CENTER} ${BG_CENTER})`,
  }));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 240 240">
        {bg && bg !== "transparent" ? (
          <Circle cx={BG_CENTER} cy={BG_CENTER} r={BG_RADIUS} fill={bg} />
        ) : null}
        <AnimatedG animatedProps={animatedProps}>
          <Path d={SWIRL_PATH} fill={fill} />
        </AnimatedG>
      </Svg>
    </View>
  );
}

export default SpinnerMorph;
