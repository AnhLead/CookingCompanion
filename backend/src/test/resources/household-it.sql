-- Household platform integration fixtures (see HouseholdApiIntegrationTest)
INSERT INTO household (id, name, invite_code, created_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Integration Home', 'JOINIT01', now());

INSERT INTO household_member (household_id, user_id, role, created_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner', now());

INSERT INTO household_member (household_id, user_id, role, created_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member', now());

INSERT INTO dish (id, name, tags, hero_image_url, owner_user_id, household_id, created_at, updated_at)
VALUES (
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'Household scoped dish',
        '[]'::jsonb,
        null,
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        now(),
        now());
