import type { IngredientLine, RecipeStep } from '../api/types';

export type LineDiffStatus = 'unchanged' | 'changed' | 'removed' | 'added';

export type IngredientLineDiff = {
  status: LineDiffStatus;
  id: string;
  beforeText?: string;
  afterText?: string;
};

export type StepLineDiff = {
  status: LineDiffStatus;
  id: string;
  order?: number;
  beforeText?: string;
  afterText?: string;
};

/** Compare persisted lines to an adjustment preview using stable `id` when possible. */
export function diffIngredientLines(
  before: IngredientLine[],
  after: IngredientLine[]
): IngredientLineDiff[] {
  const mapBefore = new Map(before.map((x) => [x.id, x]));
  const mapAfter = new Map(after.map((x) => [x.id, x]));
  const out: IngredientLineDiff[] = [];
  for (const b of before) {
    const a = mapAfter.get(b.id);
    if (!a) {
      out.push({ status: 'removed', id: b.id, beforeText: b.text });
    } else if (a.text === b.text) {
      out.push({ status: 'unchanged', id: b.id, beforeText: b.text, afterText: a.text });
    } else {
      out.push({ status: 'changed', id: b.id, beforeText: b.text, afterText: a.text });
    }
  }
  for (const a of after) {
    if (!mapBefore.has(a.id)) {
      out.push({ status: 'added', id: a.id, afterText: a.text });
    }
  }
  return out;
}

export function diffRecipeSteps(before: RecipeStep[], after: RecipeStep[]): StepLineDiff[] {
  const mapBefore = new Map(before.map((x) => [x.id, x]));
  const mapAfter = new Map(after.map((x) => [x.id, x]));
  const out: StepLineDiff[] = [];
  for (const b of before) {
    const a = mapAfter.get(b.id);
    if (!a) {
      out.push({ status: 'removed', id: b.id, order: b.order, beforeText: b.text });
    } else if (a.text === b.text) {
      out.push({
        status: 'unchanged',
        id: b.id,
        order: a.order,
        beforeText: b.text,
        afterText: a.text,
      });
    } else {
      out.push({
        status: 'changed',
        id: b.id,
        order: a.order,
        beforeText: b.text,
        afterText: a.text,
      });
    }
  }
  for (const a of after) {
    if (!mapBefore.has(a.id)) {
      out.push({ status: 'added', id: a.id, order: a.order, afterText: a.text });
    }
  }
  return out;
}
