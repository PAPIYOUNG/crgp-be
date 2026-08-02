import { Department, ProjectStatus } from '@/database/generated/prisma/enums';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export class FindProjectQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Department)
  businessDepartment?: Department;

  @IsOptional()
  @IsEnum(Department)
  technicalDepartment?: Department;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsIn([
    'projectName',
    'monthlyBudget',
    'status',
    'startDate',
    'endDate',
    'createdAt',
    'updatedAt'
  ])
  sortBy?:
    | 'projectName'
    | 'monthlyBudget'
    | 'status'
    | 'startDate'
    | 'endDate'
    | 'createdAt'
    | 'updatedAt';

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
