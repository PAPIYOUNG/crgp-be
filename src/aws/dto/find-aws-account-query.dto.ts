import { Department } from '@/database/generated/prisma/enums';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export class FindAwsAccountQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Department)
  department?: Department;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;

    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['accountName', 'awsAccountId', 'createdAt', 'updatedAt'])
  sortBy?: 'accountName' | 'awsAccountId' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

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
}
