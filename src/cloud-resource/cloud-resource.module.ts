import { Module } from '@nestjs/common';
import { CloudResourceController } from './cloud-resource.controller';
import { CloudResourceService } from './cloud-resource.service';

@Module({
  controllers: [CloudResourceController],
  providers: [CloudResourceService],
  exports: [CloudResourceService]
})
export class CloudResourceModule {}
