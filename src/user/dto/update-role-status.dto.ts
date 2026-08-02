import { Trim } from '@/common/decorators/trim.decorator';
import {
  Department,
  SystemRole,
  UserStatus
} from '@/database/generated/prisma/enums';
import {
  IsAlphanumeric,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength
} from 'class-validator';

export class UpdateRoleDto {
  @IsEnum(SystemRole)
  role: SystemRole;
}

export class UpdateStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

export class EditProfileDto {
  @IsOptional()
  @IsString()
  @Trim()
  firstName: string;

  @IsOptional()
  @IsString()
  @Trim()
  lastName: string;

  @IsOptional()
  @IsEnum(Department)
  @IsString()
  department: Department;
}

export class EditPasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
