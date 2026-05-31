-- Demo library content for local dev / QA smoke (MON-87).
-- Idempotent: safe on re-run.

INSERT INTO app_user (id, email, password_hash)
VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'dev@example.com',
    '$2b$10$Qpgj9aL8QamKSipamjnbAu9yokAzwAMyMhZtcexNeW/PQLxQjd3MW')
ON CONFLICT (id) DO NOTHING;

INSERT INTO household (id, name, invite_code, created_at)
VALUES ('b1111111-1111-1111-1111-111111111111', 'Demo Kitchen', 'DEMOKIT1', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO household_member (household_id, user_id, role, created_at)
VALUES (
        'b1111111-1111-1111-1111-111111111111',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'owner',
        now())
ON CONFLICT (household_id, user_id) DO NOTHING;

INSERT INTO dish (id, name, tags, hero_image_url, owner_user_id, household_id, created_at, updated_at)
VALUES (
        'b2222222-2222-2222-2222-222222222222',
        'Creamy Pasta',
        '["demo","pasta"]'::jsonb,
        null,
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        null,
        now(),
        now())
ON CONFLICT (id) DO NOTHING;

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
        'b3333333-3333-3333-3333-333333333333',
        'b2222222-2222-2222-2222-222222222222',
        'Classic creamy pasta',
        '4 servings',
        10,
        20,
        null,
        true,
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        now(),
        now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO ingredient_line (id, variant_id, sort_order, amount_numeric, unit, ingredient_text, preparation_note, alternates)
VALUES
    (
        'b4444444-4444-4444-4444-444444444444',
        'b3333333-3333-3333-3333-333333333333',
        1,
        8,
        'oz',
        'fettuccine pasta',
        null,
        '[]'::jsonb),
    (
        'b5555555-5555-5555-5555-555555555555',
        'b3333333-3333-3333-3333-333333333333',
        2,
        1,
        'cup',
        'heavy cream',
        null,
        '[]'::jsonb),
    (
        'b6666666-6666-6666-6666-666666666666',
        'b3333333-3333-3333-3333-333333333333',
        3,
        2,
        'tbsp',
        'butter',
        null,
        '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO recipe_step (id, variant_id, sort_order, text, timer_seconds, link_url)
VALUES
    (
        'b7777777-7777-7777-7777-777777777777',
        'b3333333-3333-3333-3333-333333333333',
        1,
        'Boil pasta in salted water until al dente.',
        600,
        null),
    (
        'b8888888-8888-8888-8888-888888888888',
        'b3333333-3333-3333-3333-333333333333',
        2,
        'Warm cream and butter; toss with drained pasta.',
        null,
        null)
ON CONFLICT (id) DO NOTHING;
