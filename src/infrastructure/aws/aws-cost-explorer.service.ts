import { AwsCredentialsService } from '@/infrastructure/aws/aws-credentials.service';
import { Injectable } from '@nestjs/common';
import {
  CostExplorerClient,
  GetCostAndUsageCommand
} from '@aws-sdk/client-cost-explorer';

export type GetAwsCostInput = {
  roleArn: string;
  externalId: string;
  startDate: string;
  endDate: string;
};

export type AwsCostRecord = {
  periodStart: string;
  periodEnd: string;
  service: string;
  operation: string;
  amount: string;
  currency: string;
  isEstimated: boolean;
};
@Injectable()
export class CostExplorerService {
  constructor(private readonly awsCredentialsService: AwsCredentialsService) {}

  //Cost Explorer เป็น Global Service endpoint อยู่ที่ us-east-1
  private readonly region = 'us-east-1';
  async getCost(input: GetAwsCostInput): Promise<AwsCostRecord[]> {
    const credentials = this.awsCredentialsService.createAssumeRoleCredentials({
      roleArn: input.roleArn,
      externalId: input.externalId,
      region: this.region
    });

    const client = new CostExplorerClient({
      region: this.region,
      credentials
    });

    try {
      const costs: AwsCostRecord[] = [];

      let nextPageToken: string | undefined;

      do {
        const response = await client.send(
          new GetCostAndUsageCommand({
            TimePeriod: {
              Start: input.startDate,
              End: input.endDate
            },

            Granularity: 'DAILY',

            Metrics: ['UnblendedCost'],

            GroupBy: [
              {
                Type: 'DIMENSION',
                Key: 'SERVICE'
              },
              {
                Type: 'DIMENSION',
                Key: 'OPERATION'
              }
            ],

            NextPageToken: nextPageToken
          })
        );

        for (const result of response.ResultsByTime ?? []) {
          const periodStart = result.TimePeriod?.Start;
          const periodEnd = result.TimePeriod?.End;

          if (!periodStart || !periodEnd) {
            continue;
          }

          for (const group of result.Groups ?? []) {
            const service = group.Keys?.[0] || 'Unknown';
            const operation = group.Keys?.[1] || 'Unknown';

            const unblendedCost = group.Metrics?.UnblendedCost;

            costs.push({
              periodStart,
              periodEnd,
              service,
              operation,
              amount: unblendedCost?.Amount ?? '0',
              currency: unblendedCost?.Unit ?? 'USD',
              isEstimated: result.Estimated ?? false
            });
          }
        }

        nextPageToken = response.NextPageToken;
      } while (nextPageToken);

      return costs;
    } finally {
      client.destroy();
    }
  }
}
