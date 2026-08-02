import { ProjectMemberRole } from '@/database/generated/prisma/enums';
import { IsEnum, IsUUID } from 'class-validator';

export class AddProjectMemberDto {
  @IsUUID()
  userId: string;

  @IsEnum(ProjectMemberRole)
  memberRole: ProjectMemberRole;
}
