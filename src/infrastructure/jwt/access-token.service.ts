import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from '@/infrastructure/jwt/jwt-payload.type';

@Injectable()
export class AccessTokenService {
  constructor(private readonly jwt: JwtService) {}
  sign(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload);
  }

  verify(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync(token);
  }
}
