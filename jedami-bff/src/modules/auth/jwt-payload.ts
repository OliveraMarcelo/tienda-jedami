// src/modules/auth/jwt-payload.ts
export interface JwtUserPayload {
  id: number;
  email: string;
  roles: string[];
}
