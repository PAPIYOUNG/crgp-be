import { AccessTokenPayload } from '@/infrastructure/jwt/jwt-payload.type';
import 'express';

declare module 'express' {
  interface Request {
    user?: AccessTokenPayload;
  }
}
