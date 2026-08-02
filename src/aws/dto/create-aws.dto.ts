import { Department } from '@/database/generated/prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from 'class-validator';

export class CreateAwsAccountDto {
  @IsString()
  @Matches(/^\d{12}$/, {
    message: 'AWS Account ID must contain exactly 12 digits'
  })
  awsAccountId: string;

  @IsString()
  @MaxLength(150)
  accountName: string;

  @IsEnum(Department)
  ownerDepartment: Department;

  @IsString()
  @MaxLength(50)
  defaultRegion: string;

  //Admin สร้าง IAM Role ก่อนแล้วนำ Role ARN มากรอก

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
