import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeData } from './sanitizeUtils';

describe('sanitizeUtils', () => {
  describe('sanitizeString', () => {
    it('returns the same string if it contains no HTML', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
    });

    it('strips out simple HTML tags', () => {
      expect(sanitizeString('<b>Hello</b>')).toBe('Hello');
      expect(sanitizeString('<i>World</i>')).toBe('World');
    });

    it('removes script tags and their content', () => {
      expect(sanitizeString('<script>alert("xss")</script>Hello')).toBe('Hello');
    });

    it('removes HTML attributes', () => {
      expect(sanitizeString('<a href="https://example.com">Link</a>')).toBe('Link');
    });

    it('handles empty strings and null/undefined values gracefully', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString(null as unknown as string)).toBeNull();
      expect(sanitizeString(undefined as unknown as string)).toBeUndefined();
    });
  });

  describe('sanitizeData', () => {
    it('sanitizes strings within an object', () => {
      const input = { name: '<b>Alice</b>', age: 30 };
      const expected = { name: 'Alice', age: 30 };
      expect(sanitizeData(input)).toEqual(expected);
    });

    it('sanitizes strings within an array', () => {
      const input = ['<b>Apple</b>', 'Banana', '<script>alert()</script>Cherry'];
      const expected = ['Apple', 'Banana', 'Cherry'];
      expect(sanitizeData(input)).toEqual(expected);
    });

    it('sanitizes nested objects and arrays', () => {
      const input = {
        user: {
          profile: '<p>Bio</p>',
          hobbies: ['<i>reading</i>', 'swimming'],
        },
      };
      const expected = {
        user: {
          profile: 'Bio',
          hobbies: ['reading', 'swimming'],
        },
      };
      expect(sanitizeData(input)).toEqual(expected);
    });

    it('returns null and undefined as is', () => {
      expect(sanitizeData(null)).toBeNull();
      expect(sanitizeData(undefined)).toBeNull(); // based on the implementation, undefined becomes null
    });

    it('leaves numbers and booleans as is', () => {
      expect(sanitizeData(123)).toBe(123);
      expect(sanitizeData(true)).toBe(true);
      expect(sanitizeData(false)).toBe(false);
    });
  });
});
