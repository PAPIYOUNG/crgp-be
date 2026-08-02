import { Module } from '@nestjs/common';
import { AwsController } from './aws.controller';
import { AwsService } from './aws.service';
import { AwsInfrastructureModule } from '@/infrastructure/aws/aws-infrastructure.module';

@Module({
  controllers: [AwsController],
  providers: [AwsService],
  imports: [AwsInfrastructureModule],
  exports: [AwsService]
})
export class AwsModule {}
