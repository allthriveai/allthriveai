import { describe, it, expect } from 'vitest';
import { snakeToCamel, camelToSnake, keysToCamel, keysToSnake } from './caseTransform';

describe('caseTransform', () => {
  describe('snakeToCamel', () => {
    it('converts snake_case to camelCase', () => {
      expect(snakeToCamel('first_name')).toBe('firstName');
      expect(snakeToCamel('last_name')).toBe('lastName');
      expect(snakeToCamel('avatar_url')).toBe('avatarUrl');
      expect(snakeToCamel('date_joined')).toBe('dateJoined');
    });

    it('handles already camelCase strings', () => {
      expect(snakeToCamel('firstName')).toBe('firstName');
    });
  });

  describe('camelToSnake', () => {
    it('converts camelCase to snake_case', () => {
      expect(camelToSnake('firstName')).toBe('first_name');
      expect(camelToSnake('lastName')).toBe('last_name');
      expect(camelToSnake('avatarUrl')).toBe('avatar_url');
      expect(camelToSnake('dateJoined')).toBe('date_joined');
    });

    it('handles already snake_case strings', () => {
      expect(camelToSnake('first_name')).toBe('first_name');
    });
  });

  describe('keysToCamel', () => {
    it('transforms object keys from snake_case to camelCase', () => {
      const input = {
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: 'http://example.com/avatar.png',
        date_joined: '2025-01-01',
      };

      const expected = {
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'http://example.com/avatar.png',
        dateJoined: '2025-01-01',
      };

      expect(keysToCamel(input)).toEqual(expected);
    });

    it('handles nested objects', () => {
      const input = {
        user_profile: {
          first_name: 'John',
          social_connections: [
            { provider_name: 'github', profile_url: 'http://github.com/john' },
          ],
        },
      };

      const expected = {
        userProfile: {
          firstName: 'John',
          socialConnections: [
            { providerName: 'github', profileUrl: 'http://github.com/john' },
          ],
        },
      };

      expect(keysToCamel(input)).toEqual(expected);
    });

    it('handles null and undefined', () => {
      expect(keysToCamel(null)).toBe(null);
      expect(keysToCamel(undefined)).toBe(undefined);
    });
  });

  describe('keysToSnake', () => {
    it('transforms object keys from camelCase to snake_case', () => {
      const input = {
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: 'http://example.com/avatar.png',
        dateJoined: '2025-01-01',
      };

      const expected = {
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: 'http://example.com/avatar.png',
        date_joined: '2025-01-01',
      };

      expect(keysToSnake(input)).toEqual(expected);
    });

    it('handles nested objects', () => {
      const input = {
        userProfile: {
          firstName: 'John',
          socialConnections: [
            { providerName: 'github', profileUrl: 'http://github.com/john' },
          ],
        },
      };

      const expected = {
        user_profile: {
          first_name: 'John',
          social_connections: [
            { provider_name: 'github', profile_url: 'http://github.com/john' },
          ],
        },
      };

      expect(keysToSnake(input)).toEqual(expected);
    });

    it('handles null and undefined', () => {
      expect(keysToSnake(null)).toBe(null);
      expect(keysToSnake(undefined)).toBe(undefined);
    });
  });
});
