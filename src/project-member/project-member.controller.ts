import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AddProjectMemberDto } from '@/project-member/dto/add-project-member.dto';
import { EditRoleProjectMemberDto } from '@/project-member/dto/edit-role-project-member.dto';
import { ProjectMemberService } from '@/project-member/project-member.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post
} from '@nestjs/common';

@Controller('project/:projectId/member')
export class ProjectMemberController {
  constructor(private readonly projectMemberService: ProjectMemberService) {}
  @Get()
  getProjectMember(
    @CurrentUser('sub') currentUserId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string
  ) {
    return this.projectMemberService.getProjectMember(currentUserId, projectId);
  }

  @Post()
  AddProjectMember(
    @CurrentUser('sub') currentUserId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AddProjectMemberDto
  ) {
    return this.projectMemberService.AddProjectMember(
      currentUserId,
      projectId,
      dto
    );
  }

  @Patch(':userId')
  editRoleMember(
    @CurrentUser('sub') currentUserId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: EditRoleProjectMemberDto
  ) {
    return this.projectMemberService.editRoleMember(
      currentUserId,
      projectId,
      targetUserId,
      dto
    );
  }

  @Delete(':userId')
  removeProjectMember(
    @CurrentUser('sub') currentUserId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string
  ) {
    return this.projectMemberService.removeProjectMember(
      currentUserId,
      projectId,
      targetUserId
    );
  }
}
