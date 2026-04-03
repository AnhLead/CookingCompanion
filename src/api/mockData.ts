import type { Dish, RecipeVariantDetail } from './types';

const d1 = 'dish-demo-1';
const d2 = 'dish-demo-2';

export const MOCK_DISHES: Dish[] = [
  { id: d1, name: 'Chili con carne', tags: ['dinner', 'beef'] },
  { id: d2, name: 'Masoor dal', tags: ['vegan', 'lentils'] },
];

function variant(
  id: string,
  dishId: string,
  title: string,
  opts: Partial<RecipeVariantDetail> & Pick<RecipeVariantDetail, 'ingredients' | 'steps'>
): RecipeVariantDetail {
  return {
    id,
    dishId,
    title,
    yields: opts.yields ?? '4 servings',
    totalTimeMin: opts.totalTimeMin ?? 45,
    isCanonical: opts.isCanonical ?? false,
    sourceAttribution: opts.sourceAttribution ?? 'Demo seed',
    ingredients: opts.ingredients,
    steps: opts.steps,
    source: opts.source ?? {
      type: 'manual',
      attribution: 'Offline demo',
    },
  };
}

export const MOCK_VARIANTS: Record<string, RecipeVariantDetail> = {
  'var-chili-1': variant('var-chili-1', d1, 'Classic stovetop', {
    isCanonical: true,
    ingredients: [
      { id: 'i1', text: 'Ground beef', quantity: { amount: 500, unit: 'g' } },
      { id: 'i2', text: 'Kidney beans, drained', quantity: { amount: 400, unit: 'g' } },
      { id: 'i3', text: 'Diced tomatoes', quantity: { amount: 400, unit: 'g' } },
    ],
    steps: [
      { id: 's1', order: 1, text: 'Brown beef in a deep pan over medium-high heat.', timerSec: 600 },
      { id: 's2', order: 2, text: 'Add tomatoes and beans; simmer 25 minutes.', timerSec: 1500 },
      { id: 's3', order: 3, text: 'Season to taste and serve.' },
    ],
    source: {
      type: 'web',
      url: 'https://example.com/chili',
      attribution: 'example.com',
    },
  }),
  'var-chili-2': variant('var-chili-2', d1, 'Mild (kid-friendly)', {
    ingredients: [
      { id: 'i1', text: 'Ground turkey', quantity: { amount: 500, unit: 'g' } },
      { id: 'i2', text: 'Black beans', quantity: { amount: 400, unit: 'g' } },
    ],
    steps: [
      { id: 's1', order: 1, text: 'Cook turkey until no longer pink.' },
      { id: 's2', order: 2, text: 'Stir in beans and a splash of stock; simmer gently.' },
    ],
  }),
  'var-dal-1': variant('var-dal-1', d2, 'Pressure cooker', {
    isCanonical: true,
    ingredients: [
      { id: 'i1', text: 'Red lentils', quantity: { amount: 200, unit: 'g' } },
      { id: 'i2', text: 'Tomato', quantity: { amount: 1, unit: 'whole' } },
    ],
    steps: [
      { id: 's1', order: 1, text: 'Rinse lentils; combine with spices and water.' },
      { id: 's2', order: 2, text: 'Pressure cook 8 minutes; natural release.' },
    ],
  }),
};

export function mockVariantsForDish(dishId: string): RecipeVariantDetail[] {
  return Object.values(MOCK_VARIANTS).filter((v) => v.dishId === dishId);
}

export function getMockAuthHeader(): Record<string, string> {
  return {};
}
