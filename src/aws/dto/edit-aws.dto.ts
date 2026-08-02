import { Department } from '@/database/generated/prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from 'class-validator';

export class UpdateAwsAccountDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, {
    message: 'AWS Account ID must contain exactly 12 digits'
  })
  awsAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  accountName?: string;

  @IsOptional()
  @IsEnum(Department)
  ownerDepartment?: Department;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  defaultRegion?: string;

  @IsOptional()
  @IsString()
  @Matches(/^arn:aws:iam::\d{12}:role\/.+$/, {
    message: 'Role ARN format is invalid'
  })
  @MaxLength(2048)
  roleArn?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
