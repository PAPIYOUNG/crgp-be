import { PrismaService } from '@/database/prisma.service';
import { Prisma, SystemRole } from '@/database/generated/prisma/client';
import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

type MonthRange = {
  start: Date;
  end: Date;
};

@Injectable()
export class CostService {
  constructor(private readonly prisma: PrismaService) {}

  // ดึง Cost MTD ของ AWS Account เดียว>> ใช้หน้า AWS Account Detail

  async getAwsAccountCostMtd(currentUserId: string, awsAccountId: string) {
    await this.ensureUserCanAccessAwsAccount(currentUserId, awsAccountId);

    const { start, end } = this.getCurrentMonthRange();

    const costGroups = await this.prisma.costRecord.groupBy({
      by: ['currency'],
      where: {
        awsAccountId,
        periodStart: {
          gte: start,
          lt: end
        }
      },
      _sum: {
        amount: true
      }
    });

    //ข้อมูล AWS Cost Explorer ปกติจะเป็น USD รองรับสกุลเงินอื่น  ด้วย

    const costs = costGroups.map((group) => ({
      currency: group.currency,
      amount: (group._sum.amount ?? new Prisma.Decimal(0)).toFixed(2)
    }));

    const usdCost = costGroups.find((group) => group.currency === 'USD');

    return {
      awsAccountId,
      periodStart: start,
      periodEnd: end,
      costMtd: (usdCost?._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      currency: 'USD',
      costs
    };
  }

  //ดึง Cost MTD ของ AWS Account ทุก Accountใช้หน้า AWS Account List แยกคนเห็นด้วย projectmember

  async getAwsAccountCostSummaries(currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: currentUserId
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const accounts = await this.prisma.awsAccount.findMany({
      where:
        user.role === SystemRole.ADMIN
          ? undefined
          : {
              projectAwsAccounts: {
                some: {
                  project: {
                    members: {
                      some: {
                        userId: currentUserId
                      }
                    }
                  }
                }
              }
            },
      select: {
        id: true,
        awsAccountId: true,
        accountName: true
      }
    });

    if (accounts.length === 0) {
      return [];
    }

    const accountIds = accounts.map((account) => account.id);

    const { start, end } = this.getCurrentMonthRange();

    const costGroups = await this.prisma.costRecord.groupBy({
      by: ['awsAccountId', 'currency'],
      where: {
        awsAccountId: {
          in: accountIds
        },
        periodStart: {
          gte: start,
          lt: end
        }
      },
      _sum: {
        amount: true
      }
    });

    const costMap = new Map<string, Prisma.Decimal>();

    for (const group of costGroups) {
      const key = `${group.awsAccountId}:${group.currency}`;

      costMap.set(key, group._sum.amount ?? new Prisma.Decimal(0));
    }

    return accounts.map((account) => {
      const costMtd = costMap.get(`${account.id}:USD`) ?? new Prisma.Decimal(0);

      return {
        id: account.id,
        awsAccountId: account.awsAccountId,
        accountName: account.accountName,
        costMtd: costMtd.toFixed(2),
        currency: 'USD',
        periodStart: start,
        periodEnd: end
      };
    });
  }

  //ดึง Cost MTD ของ Project รวมจาก Cost ของ AWS Account ทุก Account ที่เชื่อมกับ Project

  async getProjectCostMtd(currentUserId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          {
            createdById: currentUserId
          },
          {
            members: {
              some: {
                userId: currentUserId
              }
            }
          }
        ]
      },
      select: {
        id: true,
        projectName: true,
        monthlyBudget: true,
        budgetCurrency: true,
        projectAwsAccounts: {
          select: {
            awsAccountId: true
          }
        }
      }
    });

    const currentUser = await this.prisma.user.findUnique({
      where: {
        id: currentUserId
      },
      select: {
        role: true
      }
    });

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    //Admin สามารถดูทุก Project ได้ User ต้องเป็นสมาชิก
    if (!project && currentUser.role !== SystemRole.ADMIN) {
      throw new NotFoundException(
        'Project not found or you do not have permission'
      );
    }

    const accessibleProject =
      project ??
      (await this.prisma.project.findUnique({
        where: {
          id: projectId
        },
        select: {
          id: true,
          projectName: true,
          monthlyBudget: true,
          budgetCurrency: true,
          projectAwsAccounts: {
            select: {
              awsAccountId: true
            }
          }
        }
      }));

    if (!accessibleProject) {
      throw new NotFoundException('Project not found');
    }

    const awsAccountIds = accessibleProject.projectAwsAccounts.map(
      (account) => account.awsAccountId
    );

    const { start, end } = this.getCurrentMonthRange();

    const aggregate =
      awsAccountIds.length > 0
        ? await this.prisma.costRecord.aggregate({
            where: {
              awsAccountId: {
                in: awsAccountIds
              },
              currency: accessibleProject.budgetCurrency,
              periodStart: {
                gte: start,
                lt: end
              }
            },
            _sum: {
              amount: true
            }
          })
        : null;

    const costMtd = aggregate?._sum.amount ?? new Prisma.Decimal(0);

    const monthlyBudget = accessibleProject.monthlyBudget;

    const budgetUsage =
      monthlyBudget && monthlyBudget.gt(0)
        ? Number(costMtd.div(monthlyBudget).mul(100).toFixed(2))
        : 0;

    const remainingBudget = monthlyBudget ? monthlyBudget.sub(costMtd) : null;

    return {
      projectId: accessibleProject.id,
      projectName: accessibleProject.projectName,
      periodStart: start,
      periodEnd: end,

      monthlyBudget: monthlyBudget?.toFixed(2) ?? null,

      costMtd: costMtd.toFixed(2),

      budgetUsage,

      remainingBudget: remainingBudget?.toFixed(2) ?? null,

      currency: accessibleProject.budgetCurrency
    };
  }

  //รวม Cost ทั้งหมดของ AWS Accountไม่จำกัดเฉพาะเดือนปัจจุบัน>>Phase2

  async getAwsAccountTotalCost(currentUserId: string, awsAccountId: string) {
    await this.ensureUserCanAccessAwsAccount(currentUserId, awsAccountId);

    const result = await this.prisma.costRecord.aggregate({
      where: {
        awsAccountId,
        currency: 'USD'
      },
      _sum: {
        amount: true
      }
    });

    const totalCost = result._sum.amount ?? new Prisma.Decimal(0);

    return {
      awsAccountId,
      currency: 'USD',
      totalCost: totalCost.toFixed(2)
    };
  }

  //ส่วนย่อย
  //ตรวจสอบว่าผู้ใช้มีสิทธิ์เข้าถึง AWS Account หรือไม่

  private async ensureUserCanAccessAwsAccount(
    currentUserId: string,
    awsAccountId: string
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: currentUserId
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const account = await this.prisma.awsAccount.findUnique({
      where: {
        id: awsAccountId
      },
      select: {
        id: true,
        projectAwsAccounts: {
          select: {
            project: {
              select: {
                members: {
                  where: {
                    userId: currentUserId
                  },
                  select: {
                    id: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!account) {
      throw new NotFoundException('AWS account not found');
    }

    if (user.role === SystemRole.ADMIN) {
      return;
    }

    //user เป็นสมาชิกของ Project ที่ผูกกับ AWS Account อย่างน้อยหนึ่ง Project
    const hasAccess = account.projectAwsAccounts.some(
      (linkedProject) => linkedProject.project.members.length > 0
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to access this AWS account'
      );
    }
  }

  //ช่วงเวลาของเดือนปัจจุบันแบบ UTC

  //start = วันที่ 1 ของเดือนปัจจุบัน
  //end   = วันที่ 1 ของเดือนถัดไป

  private getCurrentMonthRange(): MonthRange {
    const now = new Date();

    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );

    return {
      start,
      end
    };
  }
}
