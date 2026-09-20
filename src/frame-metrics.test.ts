import { describe, expect, it } from 'vitest';
import { FrameMetrics } from './frame-metrics.ts';

const fill = (samples: number[]) => { const m = new FrameMetrics(); for (const s of samples) m.push(s); return m; };

describe('frame metrics', () => {
  it('reports nothing until it has a sample', () => {
    const m = new FrameMetrics();
    expect(m.summary()).toBeNull();
    expect(m.count).toBe(0);
  });
  it('reports a smooth run inside the 60 FPS budget', () => {
    const s = fill(Array(120).fill(16))!.summary()!;
    expect(s.fps).toBeCloseTo(62.5, 1);
    expect(s.mean).toBeCloseTo(16, 6);
    expect(s.budget).toBe('good');
  });
  it('does not clamp a frame that blew the budget', () => {
    const s = fill([1400])!.summary()!;
    expect(s.p95).toBe(1400);
    expect(s.worst).toBe(1400);
    expect(s.fps).toBeCloseTo(0.71, 2);
    expect(s.budget).toBe('bad');
  });
  it('keeps a long stall visible in the average rather than flattering it', () => {
    const s = fill([...Array(59).fill(16), 4000])!.summary()!;
    expect(s.mean).toBeGreaterThan(80);
    expect(s.worst).toBe(4000);
    expect(s.fps).toBeLessThan(13);
  });
  it('takes p95 by nearest rank', () => {
    const s = fill(Array.from({ length: 100 }, (_, i) => i + 1))!.summary()!;
    expect(s.p95).toBe(95);
    expect(fill([10])!.summary()!.p95).toBe(10);
    expect(fill([10, 20])!.summary()!.p95).toBe(20);
  });
  it('grades against the frame budgets', () => {
    expect(fill(Array(10).fill(16.7))!.summary()!.budget).toBe('good');
    expect(fill(Array(10).fill(20))!.summary()!.budget).toBe('warn');
    expect(fill(Array(10).fill(33))!.summary()!.budget).toBe('warn');
    expect(fill(Array(10).fill(33.1))!.summary()!.budget).toBe('bad');
  });
  it('ignores impossible samples', () => {
    const m = fill([NaN, -3, Infinity, 16]);
    expect(m.count).toBe(1);
    expect(m.summary()!.mean).toBe(16);
  });
  it('starts a fresh window on reset', () => {
    const m = fill([100, 200]);
    m.reset();
    expect(m.count).toBe(0);
    expect(m.summary()).toBeNull();
  });
  it('bounds how many samples it retains', () => {
    const m = new FrameMetrics(8);
    for (let i = 0; i < 500; i++) m.push(16);
    expect(m.count).toBeLessThanOrEqual(8);
    expect(m.summary()!.mean).toBe(16);
  });
});
