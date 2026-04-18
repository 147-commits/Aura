/**
 * CraftStreamManager — accumulates streaming chunks for live HTML/React preview.
 *
 * During AI streaming, detects when content is building toward an HTML or React craft,
 * feeds chunks to the LivePreview component in real-time, and finalizes on completion.
 */

export type CraftStreamKind = "html" | "react" | null;

export interface CraftStreamState {
  /** Whether we're currently accumulating craft content */
  isStreaming: boolean;
  /** Detected craft kind (html or react) */
  kind: CraftStreamKind;
  /** Accumulated content so far */
  content: string;
  /** Whether the craft is complete */
  isComplete: boolean;
}

const INITIAL_STATE: CraftStreamState = {
  isStreaming: false,
  kind: null,
  content: "",
  isComplete: false,
};

/**
 * Creates a craft stream manager instance.
 * Call `processChunk()` with each SSE content chunk during streaming.
 * Call `onCraftEvent()` when a type:"craft" SSE event arrives.
 */
export function createCraftStreamManager(
  onUpdate: (state: CraftStreamState) => void
) {
  let state: CraftStreamState = { ...INITIAL_STATE };

  function emit() {
    onUpdate({ ...state });
  }

  function reset() {
    state = { ...INITIAL_STATE };
    emit();
  }

  /**
   * Process a streaming content chunk.
   * Detects HTML/React patterns and starts accumulating.
   */
  function processChunk(fullContent: string) {
    // Check if content looks like HTML being generated
    const lower = fullContent.toLowerCase();
    const looksLikeHtml =
      lower.includes("<!doctype html") ||
      lower.includes("<html") ||
      (lower.includes("<div") && lower.includes("<style")) ||
      (lower.includes("<head>") && lower.includes("<body"));

    const looksLikeReact =
      lower.includes("function app()") ||
      lower.includes("const app =") ||
      lower.includes("export default function") ||
      (lower.includes("react") && lower.includes("return ("));

    if (!state.isStreaming && (looksLikeHtml || looksLikeReact)) {
      state.isStreaming = true;
      state.kind = looksLikeReact ? "react" : "html";
    }

    if (state.isStreaming) {
      state.content = fullContent;
      emit();
    }
  }

  /**
   * Called when a complete craft SSE event arrives (type: "craft").
   * Finalizes the stream with the complete content.
   */
  function onCraftEvent(craft: { kind: string; content?: string }) {
    if (craft.kind === "html" || craft.kind === "react") {
      state.isStreaming = false;
      state.isComplete = true;
      state.kind = craft.kind as CraftStreamKind;
      if (craft.content) {
        state.content = craft.content;
      }
      emit();
    }
  }

  return { processChunk, onCraftEvent, reset, getState: () => ({ ...state }) };
}

/**
 * Simple throttle — limits function calls to once per `delay` ms.
 */
export function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  }) as T;
}
