-- Shared unscoped dishes for GET /api/v1/dishes search (no auth headers)
INSERT INTO dish (id, name, tags, hero_image_url, owner_user_id, household_id, created_at, updated_at)
VALUES (
        'd1111111-1111-1111-1111-111111111111',
        'Alpha Curry Bowl',
        '[]'::jsonb,
        null,
        null,
        null,
        now(),
        now());

INSERT INTO dish (id, name, tags, hero_image_url, owner_user_id, household_id, created_at, updated_at)
VALUES (
        'd2222222-2222-2222-2222-222222222222',
        'Beta Salad',
        '[]'::jsonb,
        null,
        null,
        null,
        now(),
        now());
