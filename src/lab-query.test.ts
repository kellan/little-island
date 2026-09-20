import { describe, expect, it } from 'vitest';
import { count } from './lab-query';

describe('lab counts from the URL', () => {
  it('takes zero as a count, not as a missing parameter', () => {
    expect(count('0', 10000, 50000)).toBe(0);
  });
  it('falls back when the parameter is absent or empty', () => {
    expect(count(null, 10000, 50000)).toBe(10000);
    expect(count('', 10000, 50000)).toBe(10000);
    expect(count('   ', 10000, 50000)).toBe(10000);
  });
  it('falls back when the parameter is not a number', () => {
    expect(count('lots', 500, 5000)).toBe(500);
    expect(count('NaN', 500, 5000)).toBe(500);
  });
  it('clamps to the slider range', () => {
    expect(count('99999', 500, 5000)).toBe(5000);
    expect(count('-20', 500, 5000)).toBe(0);
    expect(count('Infinity', 500, 5000)).toBe(500);
  });
  it('keeps counts whole', () => {
    expect(count('123.7', 500, 5000)).toBe(124);
  });
});
