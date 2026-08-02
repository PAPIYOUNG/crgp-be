import { Injectable, Logger } from '@nestjs/common';
import {
  ConfigServiceClient, //ตัวกลาง (Client) ที่ส่ง Request ไปหา AWS Config
  SelectResourceConfigCommand,
  SelectResourceConfigCommandOutput
} from '@aws-sdk/client-config-service';
import { AwsCredentialsService } from '@/infrastructure/aws/aws-credentials.service';

const MAX_PAGES = 500; //กันไม่ให้ loop ยาวจนเกินไปหากบัญชีมี resource จำนวนมาก (500 * 100 = 50,000 resources)

export type AwsConfigResource = {
  accountId: string;
  awsRegion: string;
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  arn?: string;
};

export type GetAwsConfigResourcesInput = {
  roleArn: string;
  externalId: string;
  region: string;
};

@Injectable()
export class AwsConfigService {
  private readonly logger = new Logger(AwsConfigService.name);

  constructor(private readonly awsCredentialsService: AwsCredentialsService) {}

  async getResources(
    input: GetAwsConfigResourcesInput
  ): Promise<AwsConfigResource[]> {
    const credentials = this.awsCredentialsService.createAssumeRoleCredentials({
      roleArn: input.roleArn,
      externalId: input.externalId,
      region: input.region
    });

    const client = new ConfigServiceClient({
      region: input.region,
      credentials
    });

    const resources: AwsConfigResource[] = [];
    let nextToken: string | undefined;
    let page = 0;

    try {
      do {
        page += 1;
        if (page > MAX_PAGES) {
          this.logger.warn(
            `Stopped fetching AWS Config resources for region ${input.region} after ${MAX_PAGES} pages (${resources.length} resources); results may be incomplete`
          );
          break;
        }

        const response: SelectResourceConfigCommandOutput = await client.send(
          new SelectResourceConfigCommand({
            Expression: `
                SELECT
                  accountId,
                  awsRegion,
                  resourceType,
                  resourceId,
                  resourceName,
                  arn
              `,
            Limit: 100,
            NextToken: nextToken //Token ที่ AWS สร้างขึ้นเพื่อบอกว่า "ดึงข้อมูลถึงตรงนี้แล้ว"
          })
        );

        for (const item of response.Results ?? []) {
          try {
            resources.push(JSON.parse(item) as AwsConfigResource);
          } catch {
            this.logger.warn(
              `Skipped unparseable AWS Config result item for region ${input.region}`
            );
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
      // console.log(
      //   resources.map((resource) => ({
      //     resourceType: resource.resourceType,
      //     resourceId: resource.resourceId,
      //     arn: resource.arn
      //   }))
      // );
      return resources;
    } finally {
      client.destroy();
    }
  }
}
