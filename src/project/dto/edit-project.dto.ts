import { Department, ProjectStatus } from '@/database/generated/prisma/enums';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength
} from 'class-validator';

export class EditProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  projectName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsEnum(Department)
  businessDepartment?: Department;

  @IsOptional()
  @IsEnum(Department)
  technicalDepartment?: Department;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monthlyBudget?: number | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  budgetCurrency?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}
