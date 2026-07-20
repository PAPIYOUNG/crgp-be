import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '@/user/user.module';
import { HashModule } from '@/infrastructure/hash/hash.module';
import { JwtModule } from '@/infrastructure/jwt/jwt.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [UserModule, HashModule, JwtModule]
})
export class AuthModule {}
