import { Module } from '@nestjs/common';
import { ProjectAwsController } from './project-aws.controller';
import { ProjectAwsService } from './project-aws.service';

@Module({
  controllers: [ProjectAwsController],
  providers: [ProjectAwsService]
})
export class ProjectAwsModule {}
