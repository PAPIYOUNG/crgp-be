import { AwsConfigResource } from '@/infrastructure/aws/aws-config.service';

export type SyncConfigResponse = {
  syncJobId: string;
  accountId: string;
  received: number;
  created: number;
  updated: number;
  restored: number;
  deleted: number;
  syncedAt: Date;
  resources: AwsConfigResource[];
};
