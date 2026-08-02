import { Module } from '@nestjs/common';
import { AwsConfigService } from './aws-config.service';
import { AwsConnectionService } from './aws-connection.service';
import { AwsCredentialsService } from './aws-credentials.service';
import { CostExplorerService } from '@/infrastructure/aws/aws-cost-explorer.service';
import { TagService } from '@/infrastructure/aws/aws-tag.service';

@Module({
  providers: [
    AwsCredentialsService,
    AwsConnectionService,
    AwsConfigService,
    CostExplorerService,
    TagService
  ],
  exports: [
    AwsCredentialsService,
    AwsConnectionService,
    AwsConfigService,
    CostExplorerService,
    TagService
  ]
})
export class AwsInfrastructureModule {}
