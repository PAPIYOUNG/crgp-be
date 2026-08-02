import { Environment } from '@/database/generated/prisma/enums';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf
} from 'class-validator';

export class UpdateCloudResourceDto {
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  ownerId?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsEnum(Environment)
  environment?: Environment | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}
