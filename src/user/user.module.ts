import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { HashModule } from '@/infrastructure/hash/hash.module';
import { UploadModule } from '@/infrastructure/upload/upload.module';

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
  imports: [HashModule, UploadModule]
})
export class UserModule {}
