CREATE TABLE import_preview (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    owner_user_id UUID,
    source_url VARCHAR(4096),
    payload_json TEXT NOT NULL,
    consumed_at TIMESTAMPTZ
);

CREATE INDEX idx_import_preview_expires ON import_preview (expires_at)
    WHERE consumed_at IS NULL;

CREATE TABLE import_commit_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(256) NOT NULL UNIQUE,
    variant_id UUID NOT NULL REFERENCES recipe_variant (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
