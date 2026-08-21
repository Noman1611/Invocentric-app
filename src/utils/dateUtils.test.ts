import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseDateSafe } from './dateUtils';

describe('parseDateSafe', () => {
  beforeEach(() => {
    // Mock the current date to ensure tests depending on new Date() are deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return current date for falsy values', () => {
    const expected = new Date('2024-01-01T12:00:00Z');
    expect(parseDateSafe(null)).toEqual(expected);
    expect(parseDateSafe(undefined)).toEqual(expected);
    expect(parseDateSafe('')).toEqual(expected);
    expect(parseDateSafe(0)).toEqual(expected); // 0 is falsy and goes to the first condition, even though it's a number
  });

  it('should parse valid ISO strings', () => {
    const isoString = '2023-05-15T08:30:00.000Z';
    const result = parseDateSafe(isoString);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(isoString);
  });

  it('should return invalid date or handle invalid strings gracefully', () => {
    const result = parseDateSafe('not-a-date');
    // date-fns parseISO returns an Invalid Date object for invalid inputs
    expect(Number.isNaN(result.getTime())).toBe(true);
  });

  it('should call toDate() if the object has it (e.g., Firebase Timestamp)', () => {
    const mockDate = new Date('2022-01-01T00:00:00Z');
    const mockTimestamp = {
      toDate: vi.fn().mockReturnValue(mockDate),
    };
    const result = parseDateSafe(mockTimestamp);
    expect(mockTimestamp.toDate).toHaveBeenCalled();
    expect(result).toBe(mockDate);
  });

  it('should create a Date from seconds (e.g., simple Timestamp)', () => {
    const seconds = 1640995200; // 2022-01-01T00:00:00Z
    const mockTimestamp = { seconds };
    const result = parseDateSafe(mockTimestamp);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2022-01-01T00:00:00.000Z');
  });

  it('should return the same Date object if passed a Date', () => {
    const date = new Date('2023-11-11T11:11:11Z');
    const result = parseDateSafe(date);
    expect(result).toBe(date);
  });

  it('should handle numbers (milliseconds)', () => {
    // 0 is handled by falsy, so we use a non-zero number
    const ms = 1640995200000; // 2022-01-01T00:00:00Z
    const result = parseDateSafe(ms);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2022-01-01T00:00:00.000Z');
  });

  it('should return current date for unsupported objects', () => {
    const expected = new Date('2024-01-01T12:00:00Z');
    const result = parseDateSafe({ random: 'data' });
    expect(result).toEqual(expected);
  });
});
