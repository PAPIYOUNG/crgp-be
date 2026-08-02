import type { AwsAccount } from '@/database/generated/prisma/client';

export type SyncAbleAwsAccount = AwsAccount & {
  roleArn: string;
  externalId: string;
};
