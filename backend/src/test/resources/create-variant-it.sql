-- Personal-scope dish for auth-only createVariant tests (household seed dish requires X-Household-Id after V7).
INSERT INTO dish (id, name, tags, owner_user_id, household_id, created_at, updated_at)
VALUES (
        'c2222222-2222-2222-2222-222222222222',
        'Personal Test Dish',
        '[]'::jsonb,
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        null,
        now(),
        now())
ON CONFLICT (id) DO NOTHING;
