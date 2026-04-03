CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE dish (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(512) NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    hero_image_url VARCHAR(2048),
    owner_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE source (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(32) NOT NULL,
    url VARCHAR(4096),
    raw_payload TEXT,
    attribution VARCHAR(1024),
    owner_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_source_owner_url ON source (owner_user_id, url)
    WHERE url IS NOT NULL;

CREATE TABLE recipe_variant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dish_id UUID NOT NULL REFERENCES dish (id) ON DELETE CASCADE,
    title VARCHAR(512) NOT NULL,
    yields VARCHAR(128),
    prep_time_min INTEGER,
    cook_time_min INTEGER,
    source_id UUID REFERENCES source (id) ON DELETE SET NULL,
    is_canonical BOOLEAN NOT NULL DEFAULT false,
    owner_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_variant_dish ON recipe_variant (dish_id);

CREATE TABLE ingredient_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES recipe_variant (id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    amount_numeric NUMERIC(12, 4),
    unit VARCHAR(64),
    ingredient_text VARCHAR(1024) NOT NULL,
    preparation_note VARCHAR(512),
    alternates JSONB NOT NULL DEFAULT '[]'::jsonb,
    CONSTRAINT uq_ingredient_line_order UNIQUE (variant_id, sort_order)
);

CREATE TABLE recipe_step (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES recipe_variant (id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    text TEXT NOT NULL,
    timer_seconds INTEGER,
    link_url VARCHAR(2048),
    CONSTRAINT uq_recipe_step_order UNIQUE (variant_id, sort_order)
);

CREATE TABLE variant_adjustment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES recipe_variant (id) ON DELETE CASCADE,
    profile_json JSONB NOT NULL,
    result_summary VARCHAR(1024),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_variant_adjustment_variant ON variant_adjustment (variant_id);
