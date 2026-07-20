import {
  IsAlphanumeric,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength
} from 'class-validator';
import { Trim } from '@/common/decorators/trim.decorator';
import { Department } from '@/database/generated/prisma/browser';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Trim()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @Trim()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  @IsString()
  email: string;

  @MinLength(4)
  @IsAlphanumeric()
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(Department)
  @IsNotEmpty()
  @IsString()
  department: Department;
}
