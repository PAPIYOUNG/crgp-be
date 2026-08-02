export type SyncCloudResourceInput = {
  resourceIdentifier: string;
  resourceArn: string | null;
  resourceName: string | null;
  resourceType: string;
  region: string | null;
};

export type SyncCloudResourceResult = {
  received: number;
  created: number;
  updated: number;
  restored: number;
  deleted: number;
};
