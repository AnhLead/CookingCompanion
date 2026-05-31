-- MON-91: scope Creamy Pasta to Demo Kitchen for dev/QA household smoke.
-- Idempotent for DBs that already applied V5 with household_id NULL.

UPDATE dish
SET household_id = 'b1111111-1111-1111-1111-111111111111',
    updated_at = now()
WHERE id = 'b2222222-2222-2222-2222-222222222222'
  AND household_id IS NULL;
