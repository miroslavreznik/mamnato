import { describe, it, expect } from 'vitest';
import { encodeStatePayload, decodeStatePayload } from '../../src/store/shareLink';
import { createInitialState } from '../../src/store/wizardStore';
import type { WizardState } from '../../src/types';

describe('shareLink encode/decode', () => {
  it('round-trips a state through the URL payload', () => {
    const state: WizardState = {
      ...createInitialState(),
      mode: 'couple',
      income: { person1NetMonthly: 42000, person2NetMonthly: 38000 },
      person1Age: 31,
      goals: ['property', 'other'],
      customGoals: [{ id: 'a', name: 'Dovolená u moře', targetAmount: 120000, targetMonths: 12 }],
    };
    const decoded = decodeStatePayload(encodeStatePayload(state));
    expect(decoded).not.toBeNull();
    expect(decoded!.mode).toBe('couple');
    expect(decoded!.income.person2NetMonthly).toBe(38000);
    expect(decoded!.person1Age).toBe(31);
    expect(decoded!.goals).toEqual(['property', 'other']);
    // Diakritika v názvu cíle přežije (UTF-8)
    expect(decoded!.customGoals?.[0].name).toBe('Dovolená u moře');
  });

  it('returns null for a malformed payload', () => {
    expect(decodeStatePayload('@@not-base64@@')).toBeNull();
    expect(decodeStatePayload('')).toBeNull();
  });
});
