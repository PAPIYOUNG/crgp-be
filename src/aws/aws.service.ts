import { CreateAwsAccountDto } from '@/aws/dto/create-aws.dto';
import { UpdateAwsAccountDto } from '@/aws/dto/edit-aws.dto';
import { PrismaService } from '@/database/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { FindAwsAccountQueryDto } from '@/aws/dto/find-aws-account-query.dto';
import {
  AwsConnectionStatus,
  SystemRole
} from '@/database/generated/prisma/enums';
import { Prisma } from '@/database/generated/prisma/client';
import { AwsConnectionService } from '@/infrastructure/aws/aws-connection.service';
import { randomUUID } from 'node:crypto';
@Injectable()
export class AwsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly awsConnectionService: AwsConnectionService
  ) {}

  async createAwsAccount(data: CreateAwsAccountDto) {
    try {
      const externalId = `crgp-${randomUUID()}`;

      const createdAccount = await this.prisma.awsAccount.create({
        data: {
          ...data,
          externalId,
          connectionStatus: AwsConnectionStatus.PENDING,
          verifiedAt: null,
          connectionError: null
        }
      });
      console.log('created account:', createdAccount);

      return createdAccount;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('AWS account already exists');
      }

      throw error;
    }
  }

  async editAwsAccount(id: string, data: UpdateAwsAccountDto) {
    const aws = await this.prisma.awsAccount.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!aws) {
      throw new NotFoundException('Not Found AWS account');
    }

    const connectionChanged =
      data.awsAccountId !== undefined ||
      data.roleArn !== undefined ||
      data.defaultRegion !== undefined;
    try {
      await this.prisma.awsAccount.update({
        where: { id },
        data: {
          ...data,
          ...(connectionChanged && {
            connectionStatus: AwsConnectionStatus.PENDING,
            verifiedAt: null,
            connectionError: null
          })
        }
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('AWS account ID already exists');
      }

      throw error;
    }
  }

  async verifyAwsAccount(id: string) {
    const account = await this.prisma.awsAccount.findUnique({
      where: { id }
    });

    if (!account) {
      throw new NotFoundException('AWS Account not found');
    }

    if (!account.isActive) {
      throw new BadRequestException('AWS Account is inactive');
    }

    if (!account.roleArn) {
      throw new BadRequestException('Role ARN is required before verification');
    }

    if (!account.externalId) {
      throw new BadRequestException('External ID is missing');
    }

    try {
      const identity = await this.awsConnectionService.verifyConnection({
        expectedAwsAccountId: account.awsAccountId,
        roleArn: account.roleArn,
        externalId: account.externalId,
        region: account.defaultRegion
      });

      const verifiedAt = new Date();

      await this.prisma.awsAccount.update({
        where: { id },
        data: {
          connectionStatus: AwsConnectionStatus.CONNECTED,
          verifiedAt,
          connectionError: null
        }
      });

      return {
        message: 'AWS connection verified successfully',
        account: {
          id: account.id,
          awsAccountId: account.awsAccountId,
          accountName: account.accountName,
          connectionStatus: AwsConnectionStatus.CONNECTED,
          verifiedAt
        },
        identity
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);

      await this.prisma.awsAccount.update({
        where: { id },
        data: {
          connectionStatus: AwsConnectionStatus.FAILED,
          verifiedAt: null,
          connectionError: errorMessage
        }
      });

      throw new BadRequestException({
        message: 'AWS connection verification failed',
        reason: errorMessage
      });
    }
  }

  async getAllAwsAccount(currentUserId: string, query: FindAwsAccountQueryDto) {
    console.log('currentUserId', currentUserId);
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

    const where = {
      ...(user.role !== SystemRole.ADMIN && {
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
      }),

      ...(query.department && {
        ownerDepartment: query.department
      }),

      ...(query.isActive !== undefined && {
        isActive: query.isActive
      }),

      ...(query.search && {
        OR: [
          {
            accountName: {
              contains: query.search,
              mode: Prisma.QueryMode.insensitive
            }
          },
          {
            awsAccountId: {
              contains: query.search
            }
          }
        ]
      })
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';

    //[sortBy] ทำให้เป็น key
    const orderBy: Prisma.AwsAccountOrderByWithRelationInput = {
      [sortBy]: order
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const now = new Date();

    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );

    const [items, totalItems] = await Promise.all([
      this.prisma.awsAccount.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              resources: true
            }
          }
        }
      }),

      this.prisma.awsAccount.count({
        where
      })
    ]);

    //หน้า front ต้องเอา cost ของแต่ละ AWS Account ไปแสดงด้วย ดึงจากตรงนี้รวมไปเลย
    const awsAccountIds = items.map((account) => account.id);
    const [costMtdGroups, totalCostGroups] =
      awsAccountIds.length > 0
        ? await Promise.all([
            // Cost ของเดือนปัจจุบัน
            this.prisma.costRecord.groupBy({
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
            }),

            // Cost รวมทั้งหมดที่มีอยู่ในฐานข้อมูล
            this.prisma.costRecord.groupBy({
              by: ['awsAccountId', 'currency'],
              where: {
                awsAccountId: {
                  in: awsAccountIds
                }
              },
              _sum: {
                amount: true
              }
            })
          ])
        : [[], []];

    const costMtdMap = new Map<string, Prisma.Decimal>();
    const totalCostMap = new Map<string, Prisma.Decimal>();

    for (const group of costMtdGroups) {
      const key = `${group.awsAccountId}:${group.currency}`;

      costMtdMap.set(key, group._sum.amount ?? new Prisma.Decimal(0));
    }

    for (const group of totalCostGroups) {
      const key = `${group.awsAccountId}:${group.currency}`;

      totalCostMap.set(key, group._sum.amount ?? new Prisma.Decimal(0));
    }

    const itemsWithCost = items.map((account) => {
      const key = `${account.id}:USD`;

      const costMtd = costMtdMap.get(key) ?? new Prisma.Decimal(0);

      const totalCost = totalCostMap.get(key) ?? new Prisma.Decimal(0);

      return {
        ...account,
        costMtd: costMtd.toFixed(2),
        totalCost: totalCost.toFixed(2),
        costCurrency: 'USD'
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

  async getOneAwsAccount(id: string, currentUserId: string) {
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
    //ADMIN
    if (user.role === SystemRole.ADMIN) {
      const awsAccount = await this.prisma.awsAccount.findUnique({
        where: {
          id
        },
        include: {
          _count: {
            select: {
              resources: true
            }
          }
        }
      });

      if (!awsAccount) {
        throw new NotFoundException('AWS account not found');
      }

      return awsAccount;
    }
    //USER
    const awsAccount = await this.prisma.awsAccount.findFirst({
      where: {
        id,
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
      include: {
        _count: {
          select: {
            resources: true
          }
        }
      }
    });
    if (!awsAccount) {
      throw new NotFoundException('AWS account not found');
    }
    return awsAccount;
  }

  async deleteAwsAccount(id: string): Promise<void> {
    const awsAccount = await this.prisma.awsAccount.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true
      }
    });

    if (!awsAccount) {
      throw new NotFoundException('AWS account not found');
    }

    if (!awsAccount.isActive) {
      throw new BadRequestException('AWS account is already inactive');
    }

    await this.prisma.awsAccount.update({
      where: { id },
      data: {
        isActive: false
      }
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }
}
