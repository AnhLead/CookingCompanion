CREATE TABLE household (
    id UUID PRIMARY KEY,
    name VARCHAR(512) NOT NULL,
    invite_code VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_household_invite_code UNIQUE (invite_code)
);

CREATE TABLE household_member (
    household_id UUID NOT NULL REFERENCES household (id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (household_id, user_id)
);

CREATE INDEX idx_household_member_user ON household_member (user_id);

ALTER TABLE dish
    ADD COLUMN household_id UUID REFERENCES household (id) ON DELETE SET NULL;

CREATE INDEX idx_dish_household ON dish (household_id);
