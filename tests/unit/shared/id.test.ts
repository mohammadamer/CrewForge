import { describe, expect, it } from 'vitest';
import { generateId, generatePrefixedId } from '@crewforge/core';

describe('id generation', () => {
  it('generates unique ids', () => {
    expect(generateId()).not.toBe(generateId());
  });

  it('generates prefixed ids', () => {
    const id = generatePrefixedId('task');
    expect(id.startsWith('task-')).toBe(true);
    expect(id.length).toBe('task-'.length + 8);
  });
});
