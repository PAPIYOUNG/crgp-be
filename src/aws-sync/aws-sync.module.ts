import { Module } from '@nestjs/common';
import { AwsSyncController } from './aws-sync.controller';
import { AwsSyncService } from './aws-sync.service';
import { AwsInfrastructureModule } from '@/infrastructure/aws/aws-infrastructure.module';
import { DatabaseModule } from '@/database/database.module';
import { CloudResourceModule } from '@/cloud-resource/cloud-resource.module';

@Module({
  imports: [DatabaseModule, AwsInfrastructureModule, CloudResourceModule],
  controllers: [AwsSyncController],
  providers: [AwsSyncService]
})
export class AwsSyncModule {}
