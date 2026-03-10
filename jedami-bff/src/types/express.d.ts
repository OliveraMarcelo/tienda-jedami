import { JwtUserPayload } from '../modules/auth/jwt-payload.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export {};
