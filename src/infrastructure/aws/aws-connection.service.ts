//ใช้ตรวจAssumeRole สำเร็จไหม เข้า Account ถูกไหม ยืนยันว่า AWS Account ที่ผู้ใช้กำลังจะเชื่อมต่อสามารถ AssumeRole ได้จริง และเป็น Account ที่ถูกต้อง
//Test connection

import { BadRequestException, Injectable } from '@nestjs/common';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { AwsCredentialsService } from './aws-credentials.service';

export type VerifyAwsConnectionInput = {
  expectedAwsAccountId: string;
  roleArn: string;
  externalId?: string | null;
  region: string;
};

export type VerifyAwsConnectionResult = {
  accountId: string;
  arn: string;
  userId: string;
};

@Injectable()
export class AwsConnectionService {
  constructor(private readonly awsCredentialsService: AwsCredentialsService) {}

  async verifyConnection(
    input: VerifyAwsConnectionInput
  ): Promise<VerifyAwsConnectionResult> {
    const credentials = this.awsCredentialsService.createAssumeRoleCredentials({
      roleArn: input.roleArn,
      externalId: input.externalId,
      region: input.region
    });

    const stsClient = new STSClient({
      region: input.region,
      credentials
    });

    try {
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));

      if (!identity.Account) {
        throw new BadRequestException('AWS did not return an Account ID');
      }

      if (identity.Account !== input.expectedAwsAccountId) {
        throw new BadRequestException(
          `AWS Account mismatch: expected ${input.expectedAwsAccountId}, but connected to ${identity.Account}`
        );
      }

      return {
        accountId: identity.Account,
        arn: identity.Arn ?? '',
        userId: identity.UserId ?? ''
      };
    } finally {
      stsClient.destroy();
    }
  }
}
