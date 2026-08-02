import { Prisma } from '@/database/generated/prisma/client';
import {
  ActivityAction,
  ActivityEntityType
} from '@/database/generated/prisma/enums';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateActivityLogsDto {
  @IsEnum(ActivityAction)
  action: ActivityAction;

  @IsEnum(ActivityEntityType)
  entityType: ActivityEntityType;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  oldValues?: Prisma.InputJsonValue;

  @IsOptional()
  newValues?: Prisma.InputJsonValue;
}
