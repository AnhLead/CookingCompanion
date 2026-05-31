/** Wire shapes from `openapi/openapi.yaml` auth schemas. */
export type AuthLoginRequest = {
  email: string;
  password: string;
};

export type AuthTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
};

/** Stored session — subset of `AuthTokenResponse`. */
export type AuthTokens = Pick<AuthTokenResponse, 'accessToken' | 'refreshToken'>;

export type RefreshTokenRequest = {
  refreshToken: string;
};

export type RefreshTokenResponse = AuthTokenResponse;
