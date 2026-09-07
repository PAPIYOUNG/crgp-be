import { Prisma } from '@/database/generated/prisma/client';
import {
  ProjectMemberRole,
  SystemRole,
  UserStatus
} from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { AddProjectMemberDto } from '@/project-member/dto/add-project-member.dto';
import { EditRoleProjectMemberDto } from '@/project-member/dto/edit-role-project-member.dto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

@Injectable()
export class ProjectMemberService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectMember(currentUserId: string, projectId: string) {
    const currentUser = await this.checkUser(currentUserId);
    await this.checkProject(projectId);

    if (currentUser.role !== SystemRole.ADMIN) {
      await this.checkMember(
        currentUser.id,
        projectId,
        'You do not have access to this project'
      );
    }

    const member = await this.prisma.projectMember.findMany({
      where: { projectId },
      orderBy: [
        {
          memberRole: 'asc'
        },
        {
          joinedAt: 'asc'
        }
      ],
      select: {
        id: true,
        memberRole: true,
        joinedAt: true,

        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            role: true,
            status: true,
            avatarUrl: true
          }
        }
      }
    });

    return {
      projectId,
      totalMembers: member.length,
      member
    };
  }
  //ADMIN, TECHNICAL_OWNER, BUSINESS_OWNER มีสิทธิ์ add member
  async AddProjectMember(
    currentUserId: string,
    projectId: string,
    dto: AddProjectMemberDto
  ) {
    const currentUser = await this.checkUser(currentUserId);
    const project = await this.checkProject(projectId);
    await this.checkRoleToManageProjectMember(
      currentUserId,
      currentUser.role,
      projectId
    );

    //เช็ค user ที่จะ add
    const targetUser = await this.prisma.user.findUnique({
      where: {
        id: dto.userId
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        status: true
      }
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }
    if (targetUser.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        'Inactive user cannot be added to a project'
      );
    }
    //เช็ค user ที่จะ add ว่าเคยมีอยู่เเล้วไหม
    const existingMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: dto.userId
        }
      },
      select: {
        id: true
      }
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this project');
    }

    try {
      const member = await this.prisma.projectMember.create({
        data: {
          projectId,
          userId: dto.userId,
          memberRole: dto.memberRole
        },
        select: {
          id: true,
          memberRole: true,
          joinedAt: true,

          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              status: true,
              avatarUrl: true
            }
          }
        }
      });
      return {
        message: 'Project member added successfully',
        project: {
          id: project.id,
          projectName: project.projectName,
          projectCode: project.projectCode
        },
        member
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User is already a member of this project');
      }

      throw error;
    }
  }

  //ADMIN, TECHNICAL_OWNER, BUSINESS_OWNER มีสิทธิ์ edit role member
  async editRoleMember(
    currentUserId: string,
    projectId: string,
    targetUserId: string,
    dto: EditRoleProjectMemberDto
  ) {
    const currentUser = await this.checkUser(currentUserId);
    await this.checkProject(projectId);
    await this.checkRoleToManageProjectMember(
      currentUserId,
      currentUser.role,
      projectId
    );

    //เช็ค user ที่จะ add
    const targetMembership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      select: { id: true, memberRole: true }
    });

    if (!targetMembership) {
      throw new NotFoundException('Project member not found');
    }

    //เช็คว่าจะเป็นการเปลี่ยนTechnical owner คนสุดท้ายไหม
    if (
      targetMembership.memberRole === ProjectMemberRole.TECHNICAL_OWNER &&
      dto.memberRole !== ProjectMemberRole.TECHNICAL_OWNER
    ) {
      await this.checkLastTechOwnerRole(projectId);
    }

    const updatedMember = await this.prisma.projectMember.update({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId
        }
      },
      data: {
        memberRole: dto.memberRole
      },
      select: {
        id: true,
        memberRole: true,
        joinedAt: true,

        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            status: true,
            avatarUrl: true
          }
        }
      }
    });

    return {
      message: 'Project member role updated successfully',
      member: updatedMember
    };
  }

  //ADMIN, TECHNICAL_OWNER, BUSINESS_OWNER มีสิทธิ์ remove member
  async removeProjectMember(
    currentUserId: string,
    projectId: string,
    targetUserId: string
  ) {
    const currentUser = await this.checkUser(currentUserId);
    await this.checkProject(projectId);
    await this.checkRoleToManageProjectMember(
      currentUserId,
      currentUser.role,
      projectId
    );

    //เช็ค user ที่จะ remove
    const targetMembership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId
        }
      },
      select: {
        id: true,
        memberRole: true,

        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!targetMembership) {
      throw new NotFoundException('Project member not found');
    }

    //เช็คว่าจะเป็นการremove Technical owner คนสุดท้ายไหม
    if (targetMembership.memberRole === ProjectMemberRole.TECHNICAL_OWNER) {
      await this.checkLastTechOwnerRole(projectId);
    }

    await this.prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId
        }
      }
    });

    return {
      message: 'Project member removed successfully',
      removedMember: targetMembership.user
    };
  }

  //ส่วนย่อย///
  private async checkUser(currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        role: true,
        status: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async checkProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectName: true,
        projectCode: true,
        status: true
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async checkMember(
    currentUserId: string,
    projectId: string,
    message: string
  ) {
    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: currentUserId
        }
      },
      select: {
        id: true,
        memberRole: true
      }
    });
    if (!member) {
      throw new ForbiddenException(message);
    }

    return member;
  }

  private async checkRoleToManageProjectMember(
    currentUserId: string,
    systemRole: SystemRole,
    projectId: string
  ) {
    if (systemRole === SystemRole.ADMIN) {
      return;
    }
    const memberShip = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: currentUserId
        }
      },
      select: { memberRole: true }
    });

    if (
      !memberShip ||
      (memberShip.memberRole !== ProjectMemberRole.TECHNICAL_OWNER &&
        memberShip.memberRole !== ProjectMemberRole.BUSINESS_OWNER)
    ) {
      throw new ForbiddenException(
        'Only an admin, business owner, or technical owner can manage project members'
      );
    }
  }

  private async checkLastTechOwnerRole(projectId: string) {
    const countTechOwnerRole = await this.prisma.projectMember.count({
      where: { projectId, memberRole: ProjectMemberRole.TECHNICAL_OWNER }
    });

    if (countTechOwnerRole <= 1) {
      throw new ConflictException(
        'The last technical owner cannot be removed or changed to another role'
      );
    }
  }
}
