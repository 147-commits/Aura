/**
 * StreamBuffer — smooths out SSE chunk bursts into consistent character flow.
 * Prevents the jarring "burst then pause" effect during AI streaming.
 */

export class StreamBuffer {
  private buffer: string = "";
  private displayedLength: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onUpdate: ((fullText: string) => void) | null = null;
  private charsPerFrame: number = 3;

  /** Add raw SSE chunk to buffer */
  addChunk(text: string): void {
    this.buffer += text;
  }

  /** Start draining buffer at smooth pace */
  startDraining(onUpdate: (fullText: string) => void, intervalMs: number = 16): void {
    this.onUpdate = onUpdate;
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      if (this.displayedLength < this.buffer.length) {
        // Release characters at consistent rate
        const remaining = this.buffer.length - this.displayedLength;
        const toRelease = Math.min(this.charsPerFrame, remaining);
        this.displayedLength += toRelease;
        this.onUpdate?.(this.buffer.slice(0, this.displayedLength));
      }
    }, intervalMs);
  }

  /** Stop draining and flush all remaining text */
  flush(): string {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.displayedLength = this.buffer.length;
    this.onUpdate?.(this.buffer);
    return this.buffer;
  }

  /** Reset for next message */
  reset(): void {
    this.flush();
    this.buffer = "";
    this.displayedLength = 0;
    this.onUpdate = null;
  }

  /** Get current buffer content */
  getBuffer(): string {
    return this.buffer;
  }
}
