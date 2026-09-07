import { PrismaService } from '@/database/prisma.service';
import { FindProjectQueryDto } from '@/project/dto/find-project-query.dto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  Prisma,
  ProjectMemberRole,
  SystemRole
} from '@/database/generated/prisma/client';
import { CreateProjectDto } from '@/project/dto/create-project.dto';
import { EditProjectDto } from '@/project/dto/edit-project.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllProject(currentUserId: string, query: FindProjectQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: currentUserId
      },
      select: {
        id: true,
        role: true
      }
    });
    //console.log(user);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const where: Prisma.ProjectWhereInput = {
      // User เห็นเฉพาะ Project ที่ตัวเองเป็นสมาชิก
      // Admin ไม่มีเงื่อนไขนี้ จึงเห็นทั้งหมด
      ...(user.role !== SystemRole.ADMIN && {
        members: {
          some: {
            userId: currentUserId
          }
        }
      }),

      // Filter business department
      ...(query.businessDepartment && {
        businessDepartment: query.businessDepartment
      }),

      // Filter technical department
      ...(query.technicalDepartment && {
        technicalDepartment: query.technicalDepartment
      }),

      // Filter project status
      ...(query.status && {
        status: query.status
      }),

      // Search project name, project code และ description
      ...(query.search && {
        OR: [
          {
            projectName: {
              contains: query.search,
              mode: Prisma.QueryMode.insensitive
            }
          },

          {
            description: {
              contains: query.search,
              mode: Prisma.QueryMode.insensitive
            }
          }
        ]
      })
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';

    const orderBy: Prisma.ProjectOrderByWithRelationInput = {
      [sortBy]: order
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          // ต้องดึง AWS Account ที่ผูกกับ Project มาด้วย
          projectAwsAccounts: {
            select: {
              awsAccountId: true
            }
          },
          _count: {
            select: {
              members: true,
              projectAwsAccounts: true,
              resources: true
            }
          }
        }
      }),

      this.prisma.project.count({
        where
      })
    ]);
    // วันแรกของเดือนปัจจุบันแบบ UTC
    const now = new Date();

    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    // วันแรกของเดือนถัดไป
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );

    // รวม AWS Account ID จากทุก Project ในหน้าปัจจุบัน
    const awsAccountIds = [
      ...new Set(
        items.flatMap((project) =>
          project.projectAwsAccounts.map((account) => account.awsAccountId)
        )
      )
    ];

    // รวม Cost MTD แยกตาม AWS Account และสกุลเงิน
    const costGroups =
      awsAccountIds.length > 0
        ? await this.prisma.costRecord.groupBy({
            by: ['awsAccountId', 'currency'],
            where: {
              awsAccountId: {
                in: awsAccountIds
              },
              periodStart: {
                gte: monthStart,
                lt: nextMonthStart
              }
            },
            _sum: {
              amount: true
            }
          })
        : [];

    // สร้าง Map เพื่อค้นค่าใช้จ่ายของแต่ละ Account ได้เร็ว
    const costByAccountAndCurrency = new Map<string, Prisma.Decimal>();

    for (const group of costGroups) {
      const key = `${group.awsAccountId}:${group.currency}`;

      costByAccountAndCurrency.set(
        key,
        group._sum.amount ?? new Prisma.Decimal(0)
      );
    }

    const itemsWithCost = items.map((project) => {
      let costMtd = new Prisma.Decimal(0);

      for (const linkedAccount of project.projectAwsAccounts) {
        const key = `${linkedAccount.awsAccountId}:${project.budgetCurrency}`;

        const accountCost =
          costByAccountAndCurrency.get(key) ?? new Prisma.Decimal(0);

        costMtd = costMtd.add(accountCost);
      }

      const monthlyBudget = project.monthlyBudget;

      const budgetUsage =
        monthlyBudget && monthlyBudget.gt(0)
          ? Number(costMtd.div(monthlyBudget).mul(100).toFixed(2))
          : 0;

      const remainingBudget = monthlyBudget ? monthlyBudget.sub(costMtd) : null;

      // ไม่จำเป็นต้องส่ง relation นี้ไป Frontend
      const { projectAwsAccounts, ...projectData } = project;

      return {
        ...projectData,

        // ส่งเงินเป็น string เพื่อไม่เสียความแม่นยำของ Decimal
        costMtd: costMtd.toFixed(2),

        // percentage ส่งเป็น number
        budgetUsage,

        remainingBudget: remainingBudget?.toFixed(2) ?? null
      };
    });
    return {
      items: itemsWithCost,
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit)
    };
  }

  async getOneProject(currentUserId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        role: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const where: Prisma.ProjectWhereInput =
      user.role === SystemRole.ADMIN
        ? { id }
        : {
            id,
            members: {
              some: {
                userId: currentUserId
              }
            }
          };

    const project = await this.prisma.project.findFirst({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true
          }
        },

        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        },

        projectAwsAccounts: {
          include: {
            awsAccount: {
              select: {
                id: true,
                awsAccountId: true,
                accountName: true,
                defaultRegion: true
              }
            }
          }
        },

        resources: {
          select: {
            id: true,
            resourceName: true,
            resourceIdentifier: true,
            resourceType: true,
            environment: true,
            region: true,
            awsAccountId: true,
            awsAccount: {
              select: {
                id: true,
                awsAccountId: true,
                accountName: true
              }
            },
            tags: {
              select: {
                tagKey: true,
                tagValue: true
              }
            }
          }
        },

        _count: {
          select: {
            members: true,
            projectAwsAccounts: true,
            resources: true
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException(
        user.role === SystemRole.ADMIN
          ? 'Project not found'
          : 'Project not found or you are not a member of this project'
      );
    }

    const now = new Date();

    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );

    const previousMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );

    const awsAccountIds = project.projectAwsAccounts.map(
      (item) => item.awsAccountId
    );

    const [currentMonthCost, previousMonthCost] = await Promise.all([
      awsAccountIds.length > 0
        ? this.prisma.costRecord.aggregate({
            where: {
              awsAccountId: {
                in: awsAccountIds
              },
              currency: project.budgetCurrency,
              periodStart: {
                gte: monthStart,
                lt: nextMonthStart
              }
            },
            _sum: {
              amount: true
            }
          })
        : null,

      awsAccountIds.length > 0
        ? this.prisma.costRecord.aggregate({
            where: {
              awsAccountId: {
                in: awsAccountIds
              },
              currency: project.budgetCurrency,
              periodStart: {
                gte: previousMonthStart,
                lt: monthStart
              }
            },
            _sum: {
              amount: true
            }
          })
        : null
    ]);

    const costMtd = currentMonthCost?._sum.amount ?? new Prisma.Decimal(0);

    const previousCost =
      previousMonthCost?._sum.amount ?? new Prisma.Decimal(0);

    const monthlyBudget = project.monthlyBudget;

    const budgetUsedPct =
      monthlyBudget && monthlyBudget.gt(0)
        ? Number(costMtd.div(monthlyBudget).mul(100).toFixed(2))
        : 0;

    const remainingBudget = monthlyBudget ? monthlyBudget.sub(costMtd) : null;

    const costMtdChangePct = previousCost.gt(0)
      ? Number(costMtd.sub(previousCost).div(previousCost).mul(100).toFixed(2))
      : 0;

    const servicesCount = new Set(
      project.resources.map((resource) => resource.resourceType)
    ).size;

    const environments = [
      ...new Set(
        project.resources
          .map((resource) => resource.environment)
          .filter(
            (environment): environment is NonNullable<typeof environment> =>
              Boolean(environment)
          )
      )
    ];

    const tags = [
      ...new Set(
        project.resources.flatMap((resource) =>
          resource.tags.map((tag) => `${tag.tagKey}:${tag.tagValue}`)
        )
      )
    ];

    const ownersCount = project.members.filter(
      (member) =>
        member.memberRole === ProjectMemberRole.BUSINESS_OWNER ||
        member.memberRole === ProjectMemberRole.TECHNICAL_OWNER
    ).length;

    const editorsCount = project.members.filter(
      (member) => member.memberRole === ProjectMemberRole.MEMBER
    ).length;

    return {
      id: project.id,
      projectName: project.projectName,
      projectCode: project.projectCode,
      description: project.description,
      businessDepartment: project.businessDepartment,
      technicalDepartment: project.technicalDepartment,
      monthlyBudget: project.monthlyBudget?.toFixed(2) ?? null,
      budgetCurrency: project.budgetCurrency,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,

      createdBy: project.createdBy,

      environment: environments,

      tags,

      awsAccounts: project.projectAwsAccounts.map((item) => ({
        id: item.awsAccount.id,
        awsAccountId: item.awsAccount.awsAccountId,
        accountName: item.awsAccount.accountName,
        defaultRegion: item.awsAccount.defaultRegion
      })),

      members: project.members.map((member) => ({
        id: member.id,
        memberRole: member.memberRole,
        user: member.user
      })),

      resources: project.resources.map((resource) => ({
        id: resource.id,
        resourceName: resource.resourceName,
        resourceIdentifier: resource.resourceIdentifier,
        resourceType: resource.resourceType,
        region: resource.region,
        awsAccountId: resource.awsAccountId,
        environment: resource.environment,
        awsAccount: resource.awsAccount,
        tags: resource.tags.map((tag) => ({
          tagKey: tag.tagKey,
          tagValue: tag.tagValue
        }))
      })),

      stats: {
        resources: project._count.resources,
        servicesCount,
        costMtd: costMtd.toFixed(2),
        costMtdChangePct,
        membersCount: project._count.members,
        ownersCount,
        editorsCount,
        budgetUsedPct,
        remainingBudget: remainingBudget?.toFixed(2) ?? null
      }
    };
  }

  async createProject(currentUserId: string, data: CreateProjectDto) {
    //เช็คชื่อ project //ต้องบังคับที่หน้า front ด้วย
    const projectName = data.projectName.trim().replace(/\s+/g, ' '); // \s=space,tab,newline +=1ตัวขึ้นไป g=ทำทุกตำแหน่ง
    const existing = await this.prisma.project.findFirst({
      where: {
        projectName: {
          equals: projectName,
          mode: 'insensitive'
        }
      }
    });
    if (existing) {
      throw new ConflictException('Project name already exists');
    }
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ...data,
          projectName,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          createdById: currentUserId
        }
      });

      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: currentUserId,
          memberRole: ProjectMemberRole.BUSINESS_OWNER
        }
      });

      return project;
    });
  }

  async editProject(currentUserId: string, data: EditProjectDto, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: currentUserId
      },
      select: {
        role: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Prisma.ProjectUpdateInput = {
      ...(data.projectName !== undefined && {
        projectName: data.projectName.trim().replace(/\s+/g, ' ')
      }),

      ...(data.description !== undefined && {
        description: data.description || null
      }),

      ...(data.businessDepartment !== undefined && {
        businessDepartment: data.businessDepartment
      }),

      ...(data.technicalDepartment !== undefined && {
        technicalDepartment: data.technicalDepartment
      }),

      ...(data.monthlyBudget !== undefined && {
        monthlyBudget: data.monthlyBudget
      }),

      ...(data.budgetCurrency !== undefined && {
        budgetCurrency: data.budgetCurrency
      }),

      ...(data.status !== undefined && {
        status: data.status
      }),

      ...(data.startDate !== undefined && {
        startDate: data.startDate ? new Date(data.startDate) : null
      }),

      ...(data.endDate !== undefined && {
        endDate: data.endDate ? new Date(data.endDate) : null
      })
    };

    // Admin แก้ Project ได้ทุก Project
    if (user.role === SystemRole.ADMIN) {
      return this.prisma.project.update({
        where: { id },
        data: updateData
      });
    }

    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId: id,
        userId: currentUserId
      },
      select: {
        memberRole: true
      }
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this project');
    }

    // User ต้องเป็น Business Owner หรือ Technical Owner เท่านั้น
    if (
      member.memberRole !== ProjectMemberRole.TECHNICAL_OWNER &&
      member.memberRole !== ProjectMemberRole.BUSINESS_OWNER
    ) {
      throw new ForbiddenException(
        'You do not have permission to update this project'
      );
    }

    return this.prisma.project.update({
      where: { id },
      data: updateData
    });
  }

  async deleteProject(currentUserId: string, id: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            projectAwsAccounts: true,
            resources: true,
            members: true
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId: id,
        userId: currentUserId
      },
      select: {
        memberRole: true
      }
    });

    const canDelete =
      user.role === SystemRole.ADMIN ||
      member?.memberRole === ProjectMemberRole.TECHNICAL_OWNER ||
      member?.memberRole === ProjectMemberRole.BUSINESS_OWNER;

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this project'
      );
    }

    if (project._count.projectAwsAccounts > 0 || project._count.resources > 0) {
      throw new ConflictException(
        'Cannot delete project because AWS accounts or resources are still linked'
      );
    }

    await this.prisma.project.delete({
      where: { id }
    });
  }
}
