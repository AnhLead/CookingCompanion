import { describe, expect, it } from 'vitest';
import type { IngredientLine, RecipeStep } from '../api/types';
import { diffIngredientLines, diffRecipeSteps } from './recipeDiff';

describe('diffIngredientLines', () => {
  it('returns empty array when both sides are empty', () => {
    expect(diffIngredientLines([], [])).toEqual([]);
  });

  it('marks all lines as added when before is empty', () => {
    const after: IngredientLine[] = [
      { id: 'a', text: 'flour' },
      { id: 'b', text: 'water' },
    ];
    expect(diffIngredientLines([], after)).toEqual([
      { status: 'added', id: 'a', afterText: 'flour' },
      { status: 'added', id: 'b', afterText: 'water' },
    ]);
  });

  it('marks all lines as removed when after is empty', () => {
    const before: IngredientLine[] = [
      { id: 'x', text: 'salt' },
      { id: 'y', text: 'pepper' },
    ];
    expect(diffIngredientLines(before, [])).toEqual([
      { status: 'removed', id: 'x', beforeText: 'salt' },
      { status: 'removed', id: 'y', beforeText: 'pepper' },
    ]);
  });

  it('matches by stable id: unchanged when text is identical', () => {
    const line: IngredientLine = { id: 'ing-1', text: '2 cups milk' };
    expect(diffIngredientLines([line], [{ ...line }])).toEqual([
      {
        status: 'unchanged',
        id: 'ing-1',
        beforeText: '2 cups milk',
        afterText: '2 cups milk',
      },
    ]);
  });

  it('matches by stable id: changed when text differs', () => {
    const before: IngredientLine = { id: 'ing-1', text: '2 cups milk' };
    const after: IngredientLine = { id: 'ing-1', text: '2 cups whole milk' };
    expect(diffIngredientLines([before], [after])).toEqual([
      {
        status: 'changed',
        id: 'ing-1',
        beforeText: '2 cups milk',
        afterText: '2 cups whole milk',
      },
    ]);
  });

  it('treats same text with different ids as remove + add', () => {
    const before: IngredientLine = { id: 'old', text: 'sugar' };
    const after: IngredientLine = { id: 'new', text: 'sugar' };
    expect(diffIngredientLines([before], [after])).toEqual([
      { status: 'removed', id: 'old', beforeText: 'sugar' },
      { status: 'added', id: 'new', afterText: 'sugar' },
    ]);
  });

  it('orders output: before-order first, then new ids in after order', () => {
    const before: IngredientLine[] = [
      { id: '1', text: 'a' },
      { id: '2', text: 'b' },
    ];
    const after: IngredientLine[] = [
      { id: '2', text: 'b' },
      { id: '3', text: 'c' },
      { id: '1', text: 'a' },
    ];
    const result = diffIngredientLines(before, after);
    expect(result.map((d) => d.id)).toEqual(['1', '2', '3']);
    expect(result).toEqual([
      { status: 'unchanged', id: '1', beforeText: 'a', afterText: 'a' },
      { status: 'unchanged', id: '2', beforeText: 'b', afterText: 'b' },
      { status: 'added', id: '3', afterText: 'c' },
    ]);
  });
});

describe('diffRecipeSteps', () => {
  it('returns empty array when both sides are empty', () => {
    expect(diffRecipeSteps([], [])).toEqual([]);
  });

  it('marks all steps as added when before is empty', () => {
    const after: RecipeStep[] = [
      { id: 's1', order: 1, text: 'mix' },
      { id: 's2', order: 2, text: 'bake' },
    ];
    expect(diffRecipeSteps([], after)).toEqual([
      { status: 'added', id: 's1', order: 1, afterText: 'mix' },
      { status: 'added', id: 's2', order: 2, afterText: 'bake' },
    ]);
  });

  it('marks all steps as removed when after is empty', () => {
    const before: RecipeStep[] = [
      { id: 's1', order: 1, text: 'mix' },
      { id: 's2', order: 2, text: 'bake' },
    ];
    expect(diffRecipeSteps(before, [])).toEqual([
      { status: 'removed', id: 's1', order: 1, beforeText: 'mix' },
      { status: 'removed', id: 's2', order: 2, beforeText: 'bake' },
    ]);
  });

  it('uses stable id: unchanged includes after order', () => {
    const before: RecipeStep = { id: 'step-1', order: 1, text: 'whisk' };
    const after: RecipeStep = { id: 'step-1', order: 2, text: 'whisk' };
    expect(diffRecipeSteps([before], [after])).toEqual([
      {
        status: 'unchanged',
        id: 'step-1',
        order: 2,
        beforeText: 'whisk',
        afterText: 'whisk',
      },
    ]);
  });

  it('uses stable id: changed carries updated order from after', () => {
    const before: RecipeStep = { id: 'step-1', order: 1, text: 'simmer 5m' };
    const after: RecipeStep = { id: 'step-1', order: 1, text: 'simmer 10m' };
    expect(diffRecipeSteps([before], [after])).toEqual([
      {
        status: 'changed',
        id: 'step-1',
        order: 1,
        beforeText: 'simmer 5m',
        afterText: 'simmer 10m',
      },
    ]);
  });

  it('removed step includes before order', () => {
    const before: RecipeStep[] = [{ id: 'gone', order: 3, text: 'chill' }];
    expect(diffRecipeSteps(before, [])).toEqual([
      { status: 'removed', id: 'gone', order: 3, beforeText: 'chill' },
    ]);
  });
});
