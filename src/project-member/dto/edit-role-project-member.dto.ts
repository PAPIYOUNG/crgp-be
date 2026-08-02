import { ProjectMemberRole } from '@/database/generated/prisma/enums';
import { IsEnum } from 'class-validator';

export class EditRoleProjectMemberDto {
  @IsEnum(ProjectMemberRole)
  memberRole: ProjectMemberRole;
}
