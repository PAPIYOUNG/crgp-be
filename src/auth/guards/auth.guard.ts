import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Request } from 'express';

import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AccessTokenService } from '@/infrastructure/jwt/access-token.service';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const [bearer, token] = request.headers.authorization?.split(' ') ?? [];
    if (bearer !== 'Bearer' || !token) {
      throw new BadRequestException('Invalid authorization header');
    }
    try {
      const payload = await this.accessTokenService.verify(token);
      request.user = payload;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('Token has been expired');
      }
      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('Token is invalid');
      }
      throw error;
    }
    return true;
  }
}
