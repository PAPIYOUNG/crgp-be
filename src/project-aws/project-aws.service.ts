import { ActivityLogsService } from '@/activity-logs/activity-logs.service';
import { Prisma } from '@/database/generated/prisma/client';
import {
  ActivityAction,
  ProjectMemberRole,
  SystemRole
} from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { LinkProjectAwsAccountDto } from '@/project-aws/dto/link-project-aws-account.dto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

@Injectable()
export class ProjectAwsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService
  ) {}

  async getProjectAwsAccounts(
    projectId: string,
    userId: string,
    role: SystemRole
  ) {
    await this.checkViewPermission(projectId, userId, role);
    const projectAwsAccounts = await this.prisma.projectAwsAccount.findMany({
      where: {
        projectId
      },
      select: {
        id: true,
        linkedAt: true,

        awsAccount: {
          select: {
            id: true,
            awsAccountId: true,
            accountName: true,
            ownerDepartment: true,
            defaultRegion: true,
            isActive: true,
            lastConfigSyncedAt: true,
            lastCostSyncedAt: true,
            createdAt: true,
            updatedAt: true
          }
        },

        linkedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        linkedAt: 'desc'
      }
    });

    const data = projectAwsAccounts.map((item) => ({
      linkId: item.id,

      id: item.awsAccount.id,
      awsAccountId: item.awsAccount.awsAccountId,
      accountName: item.awsAccount.accountName,
      ownerDepartment: item.awsAccount.ownerDepartment,
      defaultRegion: item.awsAccount.defaultRegion,
      isActive: item.awsAccount.isActive,
      lastConfigSyncedAt: item.awsAccount.lastConfigSyncedAt,
      lastCostSyncedAt: item.awsAccount.lastCostSyncedAt,
      createdAt: item.awsAccount.createdAt,
      updatedAt: item.awsAccount.updatedAt,

      linkedAt: item.linkedAt,
      linkedBy: item.linkedBy
    }));

    return {
      data,
      total: data.length
    };
  }

  async getProjectAwsAccountById(
    projectId: string,
    accountId: string,
    userId: string,
    role: SystemRole
  ) {
    await this.checkViewPermission(projectId, userId, role);

    const projectAwsAccount = await this.prisma.projectAwsAccount.findUnique({
      where: {
        projectId_awsAccountId: {
          projectId,
          awsAccountId: accountId
        }
      },
      select: {
        id: true,
        linkedAt: true,

        project: {
          select: {
            id: true,
            projectCode: true,
            projectName: true,
            status: true
          }
        },

        awsAccount: {
          select: {
            id: true,
            awsAccountId: true,
            accountName: true,
            ownerDepartment: true,
            defaultRegion: true,
            isActive: true,
            lastConfigSyncedAt: true,
            lastCostSyncedAt: true,
            createdAt: true,
            updatedAt: true
          }
        },

        linkedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!projectAwsAccount) {
      throw new NotFoundException('AWS account is not linked to this project');
    }

    return {
      linkId: projectAwsAccount.id,
      linkedAt: projectAwsAccount.linkedAt,
      linkedBy: projectAwsAccount.linkedBy,
      project: projectAwsAccount.project,
      awsAccount: projectAwsAccount.awsAccount
    };
  }

  async getAvailableAwsAccounts(
    projectId: string,
    userId: string,
    role: SystemRole
  ) {
    await this.checkViewPermission(projectId, userId, role);

    const data = await this.prisma.awsAccount.findMany({
      where: {
        isActive: true,
        projectAwsAccounts: {
          none: {
            projectId
          }
        }
      },
      select: {
        id: true,
        awsAccountId: true,
        accountName: true,
        ownerDepartment: true,
        defaultRegion: true
      },
      orderBy: {
        accountName: 'asc'
      }
    });

    return { data };
  }

  async linkAwsAccount(
    projectId: string,
    dto: LinkProjectAwsAccountDto,
    userId: string,
    role: SystemRole
  ) {
    await this.checkManagePermission(projectId, userId, role);

    const awsAccount = await this.prisma.awsAccount.findUnique({
      where: {
        id: dto.awsAccountId
      },
      select: {
        id: true,
        awsAccountId: true,
        accountName: true,
        ownerDepartment: true,
        defaultRegion: true,
        isActive: true
      }
    });

    if (!awsAccount) {
      throw new NotFoundException('AWS account not found');
    }

    try {
      const projectAwsAccount = await this.prisma.projectAwsAccount.create({
        data: {
          projectId,
          awsAccountId: dto.awsAccountId,
          linkedById: userId
        },
        select: {
          id: true,
          linkedAt: true,

          project: {
            select: {
              id: true,
              projectCode: true,
              projectName: true
            }
          },

          awsAccount: {
            select: {
              id: true,
              awsAccountId: true,
              accountName: true,
              ownerDepartment: true,
              defaultRegion: true,
              isActive: true
            }
          },

          linkedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      //activity log
      await this.activityLogsService.createActivityLog(userId, {
        action: ActivityAction.LINK_AWS_ACCOUNT,
        entityType: 'PROJECT_AWS_ACCOUNT',
        entityId: projectAwsAccount.id,
        description: `${projectAwsAccount.linkedBy.email} linked AWS account "${projectAwsAccount.awsAccount.accountName}" to project "${projectAwsAccount.project.projectName}".`,
        //ตอนlink ไม่มีค่า oldValues ให้เก็บ
        newValues: {
          projectId,
          projectName: projectAwsAccount.project.projectName,

          awsAccountId: projectAwsAccount.awsAccount.id,
          awsAccountNumber: projectAwsAccount.awsAccount.awsAccountId,
          accountName: projectAwsAccount.awsAccount.accountName
        }
      });

      return {
        message: 'Link AWS account to project successfully',
        data: projectAwsAccount
      };
    } catch (error) {
      //@@unique([projectId, awsAccountId])ห้ามผูกซ้ำ

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'AWS account is already linked to this project'
        );
      }

      //กรณี projectId, awsAccountId หรือ linkedById ไม่มีอยู่จริง

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException('Project, AWS account, or user not found');
      }

      throw error;
    }
  }
  async unlinkAwsAccount(
    projectId: string,
    accountId: string,
    userId: string,
    role: SystemRole
  ) {
    await this.checkManagePermission(projectId, userId, role);

    const projectAwsAccount = await this.prisma.projectAwsAccount.findUnique({
      where: {
        projectId_awsAccountId: {
          projectId,
          awsAccountId: accountId
        }
      },
      select: {
        id: true,
        linkedAt: true,

        linkedBy: {
          select: {
            id: true,
            email: true
          }
        },

        project: {
          select: {
            id: true,
            projectName: true
          }
        },

        awsAccount: {
          select: {
            id: true,
            awsAccountId: true,
            accountName: true
          }
        }
      }
    });

    if (!projectAwsAccount) {
      throw new NotFoundException('AWS account is not linked to this project');
    }
    //เช็คก่อนเอา aws account ออก ต้องไม่มี resource ผูกเเล้ว
    const linkedResourceCount = await this.prisma.cloudResource.count({
      where: {
        projectId,
        awsAccountId: accountId,
        isDeleted: false
      }
    });

    if (linkedResourceCount > 0) {
      throw new ConflictException(
        `Cannot unlink this AWS account because ${linkedResourceCount} resource(s) from this account are still linked to the project`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.projectAwsAccount.delete({
        where: {
          projectId_awsAccountId: {
            projectId,
            awsAccountId: accountId
          }
        }
      });

      await this.activityLogsService.createActivityLog(userId, {
        action: ActivityAction.UNLINK_AWS_ACCOUNT,
        entityType: 'PROJECT_AWS_ACCOUNT',
        entityId: projectAwsAccount.id,
        description: `${projectAwsAccount.linkedBy.email} unlinked AWS account "${projectAwsAccount.awsAccount.accountName}" from project "${projectAwsAccount.project.projectName}".`,
        oldValues: {
          projectId,
          awsAccountId: projectAwsAccount.awsAccount.id,
          awsAccountNumber: projectAwsAccount.awsAccount.awsAccountId,
          accountName: projectAwsAccount.awsAccount.accountName
        }
      });
    });

    return {
      message: 'AWS account unlinked from project successfully'
    };
  }

  //ส่วนย่อย///
  private async checkViewPermission(
    projectId: string,
    userId: string,
    role: SystemRole
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (role === SystemRole.ADMIN) {
      return;
    }

    const projectMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      },
      select: {
        id: true
      }
    });

    if (!projectMember) {
      throw new ForbiddenException(
        'You do not have permission to access this project'
      );
    }
  }

  private async checkManagePermission(
    projectId: string,
    userId: string,
    role: SystemRole
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (role === SystemRole.ADMIN) {
      return;
    }

    const projectMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      },
      select: {
        memberRole: true
      }
    });

    if (!projectMember) {
      throw new ForbiddenException('You are not a member of this project');
    }

    if (
      projectMember.memberRole !== ProjectMemberRole.TECHNICAL_OWNER &&
      projectMember.memberRole !== ProjectMemberRole.BUSINESS_OWNER
    ) {
      throw new ForbiddenException(
        'Only the business owner, technical owner, or admin can manage project AWS accounts'
      );
    }
  }
}
