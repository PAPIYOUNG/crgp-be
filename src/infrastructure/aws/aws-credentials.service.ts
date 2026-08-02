import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  fromIni, //ใช้โหลด AWS credentials จากไฟล์ config ของเครื่อง ~/.aws/credentials
  fromTemporaryCredentials //ใช้สร้าง credential provider ที่จะไปขอ Temporary Credentials ผ่าน STS AssumeRole
} from '@aws-sdk/credential-providers';
import type { RuntimeConfigAwsCredentialIdentityProvider } from '@aws-sdk/types';

export type AssumeRoleConnection = {
  roleArn: string;
  externalId?: string | null;
  region: string;
};

@Injectable()
export class AwsCredentialsService {
  constructor(private readonly configService: ConfigService) {}

  createAssumeRoleCredentials(
    connection: AssumeRoleConnection
  ): RuntimeConfigAwsCredentialIdentityProvider {
    const profile = this.configService.getOrThrow<string>('AWS_PROFILE');

    const baseCredentials = fromIni({
      profile
    });

    return fromTemporaryCredentials({
      masterCredentials: baseCredentials,

      clientConfig: {
        region: connection.region
      },

      params: {
        RoleArn: connection.roleArn,
        RoleSessionName: `crgp-${Date.now()}`, //การเข้าใช้ Role ครั้งนี้ชื่ออะไร
        ExternalId: connection.externalId ?? undefined,
        DurationSeconds: 3600 //1hr
      }
    });
  }
}

// Base Credentials (Access Key + Secret Key)
//       ↓
// STS AssumeRole
//        ↓
// AWS ตรวจ Trust Policy
//           ↓
// ออก Temporary Credentials
// {
//   accessKeyId: '...',
//   secretAccessKey: '...',
//   sessionToken: '...',
//   expiration: ...
// }
