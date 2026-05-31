import { describe, expect, it } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('formats seconds under a minute', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(45)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(1500)).toBe('25:00');
  });

  it('clamps negative values to zero', () => {
    expect(formatDuration(-5)).toBe('0:00');
  });
});
