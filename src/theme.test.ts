import { describe, expect, it } from 'vitest';
import { THEMES, chooseTheme } from './theme.ts';

describe('choosing a theme', () => {
  it('takes the fork from either spelling in the URL', () => {
    expect(chooseTheme('?goblin')).toBe('goblin');
    expect(chooseTheme('?theme=goblin')).toBe('goblin');
  });
  it('falls back to the bright island', () => {
    expect(chooseTheme('')).toBe('island');
    expect(chooseTheme('?theme=swamp')).toBe('island');
    expect(chooseTheme('', 'nonsense')).toBe('island');
  });
  it('remembers the last choice when the URL says nothing', () => {
    expect(chooseTheme('', 'goblin')).toBe('goblin');
    expect(chooseTheme('?lab', 'goblin')).toBe('goblin');
  });
  // A shared link has to open the island it promised, whatever this browser last wore.
  it('lets the URL overrule what the browser remembers', () => {
    expect(chooseTheme('?theme=island', 'goblin')).toBe('island');
    expect(chooseTheme('?goblin', 'island')).toBe('goblin');
  });
});

describe('the two dressings', () => {
  // A missing line of copy is a blank label on screen, which no other test would catch.
  it('say the same things in their own words', () => {
    const shape = (value: unknown): unknown =>
      Array.isArray(value) ? 'list' : typeof value === 'object' && value ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])) : typeof value;
    expect(shape(THEMES.goblin.copy)).toEqual(shape(THEMES.island.copy));
    expect(shape(THEMES.goblin.scene)).toEqual(shape(THEMES.island.scene));
  });
  it('never leaves a string empty', () => {
    for (const theme of Object.values(THEMES))
      for (const [key, value] of Object.entries(theme.copy))
        if (typeof value === 'string') expect(value.trim(), `${theme.id}.${key}`).not.toBe('');
  });
  it('each points at the other', () => {
    expect(THEMES.island.copy.switchTo).toBe('goblin');
    expect(THEMES.goblin.copy.switchTo).toBe('island');
  });
});
