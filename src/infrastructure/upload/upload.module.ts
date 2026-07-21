import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService]
})
export class UploadModule {}
