import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule as NestJwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { EnvVariableType } from '@/config/env.validate';
import { AccessTokenService } from '@/infrastructure/jwt/access-token.service';

@Module({
  imports: [
    NestJwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvVariableType, true>
      ): JwtModuleOptions => ({
        secret: configService.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRE_IN', {
            infer: true
          })
        }
      })
    })
  ],
  providers: [AccessTokenService],
  exports: [AccessTokenService]
})
export class JwtModule {}
