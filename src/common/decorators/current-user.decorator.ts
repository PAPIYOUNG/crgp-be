import { AccessTokenPayload } from '@/infrastructure/jwt/jwt-payload.type';
import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException
} from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (data: keyof AccessTokenPayload, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const currentUser = request.user;
    if (!currentUser) {
      throw new InternalServerErrorException(
        'Current user must be authenticated'
      );
    }
    return data ? currentUser[data] : currentUser;
  }
);
