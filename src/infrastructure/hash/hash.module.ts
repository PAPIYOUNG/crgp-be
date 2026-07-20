import { BcryptService } from '@/infrastructure/hash/bcrypt.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [BcryptService],
  exports: [BcryptService]
})
export class HashModule {}
