import { Environment, ResourceSource } from '@/database/generated/prisma/enums';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min
} from 'class-validator';

const CLOUD_RESOURCE_SORT_FIELDS = [
  'resourceIdentifier',
  'resourceArn',
  'resourceName',
  'resourceType',
  'region',
  'availabilityZone',
  'resourceStatus',
  'source',
  'environment',
  'awsCaptureTime',
  'lastSyncedAt',
  'isDeleted',
  'deletedAt',
  'createdAt',
  'updatedAt'
] as const;

export const RESOURCE_SERVICES = [
  'EC2',
  'RDS',
  'S3',
  'LAMBDA',
  'EKS',
  'LOAD_BALANCER',
  'WAF',
  'CDN',
  'NETWORKING',
  'OTHER'
] as const;

export type ResourceService = (typeof RESOURCE_SERVICES)[number];

export type CloudResourceSortField =
  (typeof CLOUD_RESOURCE_SORT_FIELDS)[number];

export class FindCloudResourceQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  awsAccountId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsEnum(ResourceSource)
  source?: ResourceSource;

  @IsOptional()
  @IsEnum(Environment)
  environment?: Environment;

  @IsOptional()
  @Transform(({ value }): boolean => {
    if (value === 'true' || value === true) {
      return true;
    }

    if (value === 'false' || value === false) {
      return false;
    }

    return value;
  })
  @IsBoolean()
  isDeleted?: boolean;

  @IsOptional()
  @IsIn(CLOUD_RESOURCE_SORT_FIELDS)
  sortBy: CloudResourceSortField = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  unassigned?: boolean;

  @IsOptional()
  @IsIn(RESOURCE_SERVICES)
  service?: ResourceService;
}
