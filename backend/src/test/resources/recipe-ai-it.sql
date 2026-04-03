-- Generative / flags integration fixtures (see RecipeAi*IntegrationTest)
INSERT INTO dish (id, name, tags, hero_image_url, owner_user_id, household_id, created_at, updated_at)
VALUES (
        'f1111111-1111-1111-1111-111111111111',
        'Recipe AI test dish',
        '[]'::jsonb,
        null,
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        null,
        now(),
        now());

INSERT INTO recipe_variant (
        id,
        dish_id,
        title,
        yields,
        prep_time_min,
        cook_time_min,
        source_id,
        is_canonical,
        owner_user_id,
        created_at,
        updated_at)
VALUES (
        'f2222222-2222-2222-2222-222222222222',
        'f1111111-1111-1111-1111-111111111111',
        'Test variant',
        '2 servings',
        null,
        null,
        null,
        false,
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        now(),
        now());

INSERT INTO ingredient_line (id, variant_id, sort_order, amount_numeric, unit, ingredient_text, preparation_note, alternates)
VALUES (
        'f3333333-3333-3333-3333-333333333333',
        'f2222222-2222-2222-2222-222222222222',
        1,
        2,
        'cup',
        'whole milk',
        null,
        '[]'::jsonb);

INSERT INTO recipe_step (id, variant_id, sort_order, text, timer_seconds, link_url)
VALUES (
        'f4444444-4444-4444-4444-444444444444',
        'f2222222-2222-2222-2222-222222222222',
        1,
        'Warm the milk gently.',
        null,
        null);
