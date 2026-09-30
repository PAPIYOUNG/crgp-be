import { Injectable } from '@nestjs/common';
import {
  fromNodeProviderChain, //โหลด credentials จาก env (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY) ก่อน ถ้าไม่มีค่อยใช้ ~/.aws ตาม AWS_PROFILE
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
  createAssumeRoleCredentials(
    connection: AssumeRoleConnection
  ): RuntimeConfigAwsCredentialIdentityProvider {
    const baseCredentials = fromNodeProviderChain();

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
