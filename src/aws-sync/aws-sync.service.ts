import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  AwsConfigResource,
  AwsConfigService
} from '@/infrastructure/aws/aws-config.service';
import { PrismaService } from '@/database/prisma.service';
import {
  AwsConnectionStatus,
  Environment,
  SyncStatus,
  SyncType
} from '@/database/generated/prisma/enums';
import { CloudResourceService } from '@/cloud-resource/cloud-resource.service';
import { SyncCloudResourceInput } from '@/cloud-resource/types/sync-cloud-resource.type';
import { SyncConfigResponse } from '@/aws-sync/types/sync-config-response';
import { CostExplorerService } from '@/infrastructure/aws/aws-cost-explorer.service';
import { SyncAbleAwsAccount } from '@/aws-sync/types/sync-able-awsaccount';
import { Prisma } from '@/database/generated/prisma/client';
import { TagService } from '@/infrastructure/aws/aws-tag.service';

@Injectable()
export class AwsSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly awsConfigService: AwsConfigService,
    private readonly cloudResourceService: CloudResourceService,
    private readonly costExplorerService: CostExplorerService,
    private readonly tagService: TagService
  ) {}

  async syncConfig(
    awsAccountId: string,
    currentUserId: string
  ): Promise<SyncConfigResponse> {
    const account = await this.checkAwsAccountBeforeSync(awsAccountId);

    //สร้างประวัติการ Sync ก่อนเรียก AWS
    //ถ้าระหว่างทางเกิด Error เราจะมี SyncJob เดิมสำหรับเปลี่ยนสถานะเป็น FAILED
    const syncJob = await this.prisma.syncJob.create({
      data: {
        awsAccountId: account.id,
        syncType: SyncType.AWS_CONFIG,
        status: SyncStatus.RUNNING,
        region: account.defaultRegion,
        triggeredById: currentUserId
      },
      select: {
        id: true
      }
    });
    //start
    try {
      const awsResources = await this.awsConfigService.getResources({
        roleArn: account.roleArn,
        externalId: account.externalId,
        region: account.defaultRegion
      });

      const resources: SyncCloudResourceInput[] = awsResources.map(
        (resource: AwsConfigResource) => ({
          resourceIdentifier: resource.resourceId,
          resourceArn: resource.arn ?? null,
          resourceName: resource.resourceName ?? null,
          resourceType: resource.resourceType,
          region: resource.awsRegion ?? account.defaultRegion
        })
      );

      const syncResult = await this.cloudResourceService.syncAwsResources(
        account.id,
        resources
      );

      const syncedAt = new Date();

      //อัปเดตทั้ง AWS Account และ SyncJob
      //lastConfigSyncedAt จะเปลี่ยนเฉพาะตอน Sync สำเร็จ
      //ใช้ transaction ไม่ให้จบครึ่งๆกลางๆ
      //Transaction Array=$transaction([...]) >>Prisma ส่งทั้งหมดใน Transaction เดียว แต่ละ Query ห้ามอ้างผลลัพธ์ของ Query ก่อนหน้า
      await this.prisma.$transaction([
        this.prisma.awsAccount.update({
          where: {
            id: account.id
          },
          data: {
            lastConfigSyncedAt: syncedAt
          }
        }),

        this.prisma.syncJob.update({
          where: {
            id: syncJob.id
          },
          data: {
            status: SyncStatus.SUCCESS,
            completedAt: syncedAt,
            recordsReceived: syncResult.received,
            recordsCreated: syncResult.created,
            //ค่า restore และ soft delete เก็บที่ recordsUpdated
            recordsUpdated:
              syncResult.updated + syncResult.restored + syncResult.deleted,
            recordsFailed: 0,
            errorMessage: null
          }
        })
      ]);

      return {
        syncJobId: syncJob.id,
        accountId: account.awsAccountId,
        ...syncResult,
        syncedAt,
        resources: awsResources
      };
    } catch (error: unknown) {
      const completedAt = new Date();
      const errorMessage = this.getErrorMessage(error);

      //เก็บประวัติการ Sync ที่ล้มเหลว
      //update failure log ก่อน แล้วจึง throw error เดิมออกไป

      await this.prisma.syncJob.update({
        where: {
          id: syncJob.id
        },
        data: {
          status: SyncStatus.FAILED,
          completedAt,
          recordsFailed: 1,
          errorMessage
        }
      });

      throw error;
    }
  }

  async syncCost(awsAccountId: string, currentUserId: string) {
    const account = await this.checkAwsAccountBeforeSync(awsAccountId);

    const syncJob = await this.prisma.syncJob.create({
      data: {
        awsAccountId: account.id,
        syncType: SyncType.COST_EXPLORER,
        status: SyncStatus.RUNNING,
        region: 'us-east-1',
        triggeredById: currentUserId
      },
      select: {
        id: true
      }
    });

    try {
      const { startDate, endDate } = this.getCurrentMonthPeriod();
      const awsCosts = await this.costExplorerService.getCost({
        roleArn: account.roleArn,
        externalId: account.externalId,
        startDate,
        endDate
      });
      const syncedAt = new Date();
      //ใช้ transaction ไม่ให้จบครึ่งๆกลางๆ
      //Interactive Transaction (Callback)=$transaction(async tx => {})>>มีการใช่ result จาก Query ก่อนหน้า
      await this.prisma.$transaction(async (tx) => {
        await tx.costRecord.deleteMany({
          where: {
            awsAccountId: account.id,
            periodStart: {
              gte: this.toUtcDate(startDate) //วันเเรกของเดือน
            },
            periodEnd: {
              lte: this.toUtcDate(endDate) //ช่วงถึงวันนี้หรือวันก่อนๆ
            }
          }
        });

        if (awsCosts.length > 0) {
          await tx.costRecord.createMany({
            data: awsCosts.map((cost) => ({
              awsAccountId: account.id,

              resourceId: null,

              periodStart: this.toUtcDate(cost.periodStart),
              periodEnd: this.toUtcDate(cost.periodEnd),

              service: cost.service,
              region: cost.operation,

              amount: new Prisma.Decimal(cost.amount),

              currency: cost.currency,
              isEstimated: cost.isEstimated,

              syncedAt
            }))
          });
        }

        await tx.awsAccount.update({
          where: {
            id: account.id
          },
          data: {
            lastCostSyncedAt: syncedAt
          }
        });

        await tx.syncJob.update({
          where: {
            id: syncJob.id
          },
          data: {
            status: SyncStatus.SUCCESS,
            completedAt: syncedAt,
            recordsReceived: awsCosts.length,
            recordsCreated: awsCosts.length,
            recordsUpdated: 0,
            recordsFailed: 0,
            errorMessage: null
          }
        });
      });

      return {
        syncJobId: syncJob.id,
        accountId: account.awsAccountId,
        periodStart: startDate,
        periodEnd: endDate,
        received: awsCosts.length,
        created: awsCosts.length,
        updated: 0,
        failed: 0,
        syncedAt,
        costs: awsCosts
      };
    } catch (error: unknown) {
      const completedAt = new Date();
      const errorMessage = this.getErrorMessage(error);

      await this.prisma.syncJob.update({
        where: {
          id: syncJob.id
        },
        data: {
          status: SyncStatus.FAILED,
          completedAt,
          recordsFailed: 1,
          errorMessage
        }
      });

      throw error;
    }
  }

  async syncTags(awsAccountId: string, currentUserId: string) {
    const account = await this.checkAwsAccountBeforeSync(awsAccountId);
    const syncJob = await this.prisma.syncJob.create({
      data: {
        awsAccountId: account.id,
        syncType: SyncType.TAGS,
        status: SyncStatus.RUNNING,
        region: account.defaultRegion,
        triggeredById: currentUserId
      },
      select: {
        id: true
      }
    });
    //start
    try {
      const awsTag = await this.tagService.getTags({
        awsAccountId,
        roleArn: account.roleArn,
        externalId: account.externalId,
        region: account.defaultRegion
      });
      const syncedAt = new Date();

      await this.prisma.$transaction([
        this.prisma.awsAccount.update({
          where: {
            id: account.id
          },
          data: {
            lastTagSyncedAt: syncedAt
          }
        }),

        this.prisma.syncJob.update({
          where: {
            id: syncJob.id
          },
          data: {
            status: SyncStatus.SUCCESS,
            completedAt: syncedAt,
            recordsReceived: awsTag.received,
            recordsCreated: awsTag.created,
            recordsUpdated: awsTag.updated,
            recordsFailed: 0,
            errorMessage: null
          }
        })
      ]);
      return {
        syncJobId: syncJob.id,
        accountId: account.awsAccountId,
        ...awsTag,
        syncedAt
      };
    } catch (error) {
      const completedAt = new Date();
      const errorMessage = this.getErrorMessage(error);

      await this.prisma.syncJob.update({
        where: {
          id: syncJob.id
        },
        data: {
          status: SyncStatus.FAILED,
          completedAt,
          recordsFailed: 1,
          errorMessage
        }
      });

      throw error;
    }
  }

  async syncAll(awsAccountId: string, currentUserId: string) {
    const startedAt = new Date();

    //  1. Config: สร้าง/อัปเดต Resource ก่อน
    //   2. Tags: ใช้ Resource ARN ที่อยู่ใน Database เพื่อจับคู่
    //  3. Cost: ไม่ได้พึ่ง Resource ทำเป็นลำดับสุดท้าย

    const configResult = await this.syncConfig(awsAccountId, currentUserId);

    const tagResult = await this.syncTags(awsAccountId, currentUserId);

    const costResult = await this.syncCost(awsAccountId, currentUserId);

    const completedAt = new Date();

    return {
      message: 'AWS synchronization completed successfully',
      awsAccountId,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),

      results: {
        config: configResult,
        tags: tagResult,
        cost: costResult
      }
    };
  }

  //ส่วนย่อย
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error occurred during AWS Config sync';
  }

  private async checkAwsAccountBeforeSync(
    awsAccountId: string
  ): Promise<SyncAbleAwsAccount> {
    const account = await this.prisma.awsAccount.findUnique({
      where: {
        id: awsAccountId
      }
    });

    //check1
    if (!account) {
      throw new NotFoundException('AWS account not found');
    }
    //check2
    if (!account.isActive) {
      throw new BadRequestException('AWS account is inactive');
    }
    //check3
    if (account.connectionStatus !== AwsConnectionStatus.CONNECTED) {
      throw new BadRequestException(
        'AWS account connection must be verified before syncing'
      );
    }
    //check4
    if (!account.roleArn) {
      throw new BadRequestException('Role ARN is required before syncing');
    }
    //check5
    if (!account.externalId) {
      throw new BadRequestException('External ID is required before syncing');
    }
    return account as SyncAbleAwsAccount;
  }

  private getCurrentMonthPeriod(): {
    startDate: string;
    endDate: string;
  } {
    const now = new Date();

    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) //วันแรกของเดือน
    );

    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) //วันนี้
    );

    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toUtcDate(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private mapEnvironment(
    tags: {
      key: string;
      value: string;
    }[]
  ): Environment | null {
    const environmentTag = tags.find((tag) => {
      const key = tag.key.trim().toLowerCase();

      return key === 'env' || key === 'environment';
    });

    if (!environmentTag) {
      return null;
    }

    switch (environmentTag.value.trim().toLowerCase()) {
      case 'dev':
      case 'development':
        return Environment.DEV;

      case 'test':
      case 'testing':
        return Environment.TEST;

      case 'uat':
        return Environment.UAT;

      case 'stage':
      case 'staging':
        return Environment.STAGING;

      case 'prod':
      case 'production':
        return Environment.PROD;

      default:
        return null;
    }
  }
}
