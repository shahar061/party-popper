import { describe, it, expect, vi } from 'vitest';
import { generateJoinCode, isValidJoinCode, VALID_CHARS } from '../utils/join-code';

describe('Join Code Generation', () => {
  it('should generate 4-character codes', async () => {
    const mockKv = { get: vi.fn().mockResolvedValue(null) };
    const code = await generateJoinCode(mockKv as any);
    expect(code).toHaveLength(4);
  });

  it('should only use valid characters (excludes 0, O, I, L, 1)', async () => {
    const mockKv = { get: vi.fn().mockResolvedValue(null) };

    for (let i = 0; i < 100; i++) {
      const code = await generateJoinCode(mockKv as any);
      expect(code).not.toMatch(/[0OIL1]/);
      expect(code).toMatch(/^[A-Z0-9]{4}$/);
    }
  });

  it('should check for collisions and retry', async () => {
    const mockKv = {
      get: vi.fn()
        .mockResolvedValueOnce('existing-game-id')
        .mockResolvedValueOnce('existing-game-id')
        .mockResolvedValueOnce(null),
    };

    const code = await generateJoinCode(mockKv as any);

    expect(mockKv.get).toHaveBeenCalledTimes(3);
    expect(code).toHaveLength(4);
  });

  it('should throw after max attempts', async () => {
    const mockKv = {
      get: vi.fn().mockResolvedValue('always-exists'),
    };

    await expect(generateJoinCode(mockKv as any, 5)).rejects.toThrow(
      'Failed to generate unique join code after max attempts'
    );
    expect(mockKv.get).toHaveBeenCalledTimes(5);
  });

  it('should validate join code format', () => {
    expect(isValidJoinCode('ABCD')).toBe(true);
    expect(isValidJoinCode('AB23')).toBe(true);
    expect(isValidJoinCode('abcd')).toBe(false); // lowercase
    expect(isValidJoinCode('ABC')).toBe(false);  // too short
    expect(isValidJoinCode('ABCDE')).toBe(false); // too long
    expect(isValidJoinCode('AB0D')).toBe(false);  // contains 0
    expect(isValidJoinCode('ABOD')).toBe(false);  // contains O
  });
});
