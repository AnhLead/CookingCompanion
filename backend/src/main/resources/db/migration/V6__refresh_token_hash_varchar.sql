-- Align token_hash with JPA mapping (VARCHAR) when an earlier V4 draft used CHAR(64).
ALTER TABLE refresh_token
    ALTER COLUMN token_hash TYPE VARCHAR(64);
