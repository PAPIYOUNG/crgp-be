import {
  Environment,
  ResourceProvider
} from '@/database/generated/prisma/enums';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf
} from 'class-validator';

export const MANUAL_RESOURCE_SERVICES = [
  'EC2',
  'RDS',
  'S3',
  'LAMBDA',
  'EKS',
  'CLOUDFRONT',
  'OTHER'
] as const;

export type ManualResourceService = (typeof MANUAL_RESOURCE_SERVICES)[number];

export const MANUAL_RESOURCE_STATUSES = [
  'RUNNING',
  'STOPPED',
  'PENDING',
  'TERMINATED'
] as const;

export type ManualResourceStatus = (typeof MANUAL_RESOURCE_STATUSES)[number];

export class CreateResourceDto {
  @IsIn(Object.values(ResourceProvider))
  provider: ResourceProvider;

  // จำเป็นเฉพาะตอน provider เป็น AWS เท่านั้น
  // resource ที่รันบน cloud อื่น หรือ private cloud ไม่มี AWS Account ให้ผูก
  @ValidateIf((dto: CreateResourceDto) => dto.provider === ResourceProvider.AWS)
  @IsUUID()
  awsAccountId?: string;

  @IsString()
  @MaxLength(255)
  resourceName: string;

  @IsIn(MANUAL_RESOURCE_SERVICES)
  service: ManualResourceService;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  instanceType?: string;

  @IsString()
  @MaxLength(50)
  region: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsIn(Object.values(Environment))
  environment?: Environment;

  @IsOptional()
  @IsIn(MANUAL_RESOURCE_STATUSES)
  status?: ManualResourceStatus;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'monthlyCost must be a valid amount, e.g. 145.90'
  })
  monthlyCost?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
