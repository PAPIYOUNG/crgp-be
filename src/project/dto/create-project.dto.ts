import { Department } from '@/database/generated/prisma/enums';
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

export class CreateProjectDto {
  @IsString()
  @Length(1, 150)
  projectName: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsEnum(Department)
  businessDepartment: Department;

  @IsEnum(Department)
  technicalDepartment: Department;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monthlyBudget?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  budgetCurrency?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
