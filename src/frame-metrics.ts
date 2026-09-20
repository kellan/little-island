export type FrameSummary = { fps: number; mean: number; p95: number; worst: number; budget: 'good' | 'warn' | 'bad' };
// Real elapsed frame time, never clamped: a benchmark that cannot report a number
// worse than its own clamp is not measuring the frames that matter.
export class FrameMetrics {
  private samples: number[] = [];
  constructor(private limit = 600) {}
  get count(): number { return this.samples.length; }
  push(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    if (this.samples.length >= this.limit) this.samples.shift();
    this.samples.push(ms);
  }
  reset(): void { this.samples.length = 0; }
  summary(): FrameSummary | null {
    const n = this.samples.length;
    if (!n) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mean = this.samples.reduce((a, b) => a + b, 0) / n;
    return {
      fps: mean > 0 ? 1000 / mean : 0, mean,
      p95: sorted[Math.min(n - 1, Math.max(0, Math.ceil(n * .95) - 1))], worst: sorted[n - 1],
      budget: mean <= 16.7 ? 'good' : mean <= 33 ? 'warn' : 'bad',
    };
  }
}
