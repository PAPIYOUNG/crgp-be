import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ResourceSource, SystemRole } from '@/database/generated/prisma/enums';
import {
  SyncCloudResourceInput,
  SyncCloudResourceResult
} from './types/sync-cloud-resource.type';
import { FindCloudResourceQueryDto } from '@/cloud-resource/dto/find-cloud-resource-query.dto';
import { Prisma } from '@/database/generated/prisma/client';
import { UpdateCloudResourceDto } from '@/cloud-resource/dto/update-cloud-resource.dto';

@Injectable()
export class CloudResourceService {
  constructor(private readonly prisma: PrismaService) {}

  async syncAwsResources(
    awsAccountId: string,
    resources: SyncCloudResourceInput[]
  ): Promise<SyncCloudResourceResult> {
    const syncedAt = new Date();

    //  ป้องกันข้อมูลซ้ำที่อาจส่งมาจาก AWS โดยใช้ key เดียวกับ
    // @@unique([awsAccountId, resourceType, resourceIdentifier])

    const incomingResourceMap = new Map<string, SyncCloudResourceInput>();

    for (const resource of resources) {
      const key = this.createResourceKey(
        resource.resourceType,
        resource.resourceIdentifier
      );

      incomingResourceMap.set(key, resource); //override ตัวซ้ำ เผื่อมี
    }
    //console.log('incomingResourceMap', incomingResourceMap);
    //เอา incomming ที่จัดการตัวซ้ำเเล้วมาใช้ต่อ
    const uniqueResources = Array.from(incomingResourceMap.values());
    //console.log('uniqueResources', uniqueResources);

    //ดึง Resource เดิมของAccount นี้
    //เลือกเฉพาะ source = AWS_CONFIG ไม่เอาเเบบ MANUAL

    const existingResources = await this.prisma.cloudResource.findMany({
      where: {
        awsAccountId,
        source: ResourceSource.AWS_CONFIG
      },
      select: {
        id: true,
        resourceType: true,
        resourceIdentifier: true,
        isDeleted: true
      }
    });

    const existingResourceMap = new Map(
      existingResources.map((resource) => [
        this.createResourceKey(
          resource.resourceType,
          resource.resourceIdentifier
        ),
        resource
      ])
    );
    //console.log('existingResourceMap', existingResourceMap);

    const resourcesToCreate: Array<{
      awsAccountId: string;
      resourceIdentifier: string;
      resourceArn: string | null;
      resourceName: string | null;
      resourceType: string;
      region: string | null;
      source: ResourceSource;
      lastSyncedAt: Date;
      isDeleted: boolean;
      deletedAt: null;
    }> = [];

    const resourcesToUpdate: Array<{
      id: string;
      data: {
        resourceArn: string | null;
        resourceName: string | null;
        region: string | null;
        lastSyncedAt: Date;
        isDeleted: false;
        deletedAt: null;
      };
    }> = [];

    let restored = 0;

    for (const resource of uniqueResources) {
      const key = this.createResourceKey(
        resource.resourceType,
        resource.resourceIdentifier
      );
      //console.log('key', key);

      //  ไม่มีใน DB → CREATE
      //  มีใน DB → UPDATE เฉพาะ field จาก AWS
      const existingResource = existingResourceMap.get(key); //ดึง Value ออกจาก Map โดยใช้ Key
      //ถ้าexstingResourceMap ด้วย key ของ unique ถ้า key ตรงแปรว่ามี resource นั้นอยู่เเล้ว

      //console.log('existingResource', existingResource);

      //ไม่มีใน database ของใหม่ๆ
      if (!existingResource) {
        resourcesToCreate.push({
          awsAccountId,
          resourceIdentifier: resource.resourceIdentifier,
          resourceArn: resource.resourceArn,
          resourceName: resource.resourceName,
          resourceType: resource.resourceType,
          region: resource.region,
          source: ResourceSource.AWS_CONFIG,
          lastSyncedAt: syncedAt,
          isDeleted: false,
          deletedAt: null
        });

        continue;
      }
      //console.log('resourcesToCreate', resourcesToCreate);

      //ของที่ isDeletedเคยเป็น true เเต่มันกลับมาใหม่
      if (existingResource.isDeleted) {
        restored++;
      }

      resourcesToUpdate.push({
        id: existingResource.id,
        data: {
          resourceArn: resource.resourceArn,
          resourceName: resource.resourceName,
          region: resource.region,
          lastSyncedAt: syncedAt,

          //ให้เปิดใช้งาน Resource เดิม ไม่สร้าง record ใหม่

          isDeleted: false,
          deletedAt: null
        }
      });
    }

    //Resource ที่มีใน DB แต่ไม่มีในผลลัพธ์ล่าสุดจาก AWS

    const resourceIdsToDelete = existingResources
      .filter((existingResource) => {
        //filter ไม่เอาตัวที่ isDelete=true
        if (existingResource.isDeleted) {
          return false;
        }
        //ตัวที่ isDelete=false เอามา Map key ต่อ
        const key = this.createResourceKey(
          existingResource.resourceType,
          existingResource.resourceIdentifier
        );

        return !incomingResourceMap.has(key); //เช็กว่าของใน database กับ incoming มีตรงกันไหม ตัวไหนที่ไม่มีในincoming เเต่มีใน database ให้ return ออกมา
      })
      .map((resource) => resource.id); //เอา resourceid มา ต้องเอาไปแก้ isDelete เป็น true

    /*
     * ใช้ Batch เพื่อลดปัญหา Transaction มี Query จำนวนมากเกินไป
     */
    const batchSize = 10;

    for (const batch of this.chunk(resourcesToCreate, batchSize)) {
      await this.prisma.cloudResource.createMany({
        data: batch
      });
    }

    for (const batch of this.chunk(resourcesToUpdate, batchSize)) {
      await this.prisma.$transaction(
        batch.map((resource) =>
          this.prisma.cloudResource.update({
            where: {
              id: resource.id
            },
            data: resource.data
          })
        )
      );
    }

    for (const idBatch of this.chunk(resourceIdsToDelete, batchSize)) {
      await this.prisma.cloudResource.updateMany({
        where: {
          id: {
            in: idBatch
          }
        },
        data: {
          isDeleted: true,
          deletedAt: syncedAt
        }
      });
    }

    return {
      received: uniqueResources.length,
      created: resourcesToCreate.length,
      updated: resourcesToUpdate.length,
      restored,
      deleted: resourceIdsToDelete.length
    };
  }

  private createResourceKey(
    resourceType: string,
    resourceIdentifier: string
  ): string {
    return `${resourceType}:${resourceIdentifier}`;
  }

  //แบ่งเป็น Array ย่อย ๆ
  private chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }

  async getAllResource(id: string, query: FindCloudResourceQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true
      }
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const where: Prisma.CloudResourceWhereInput = {
      ...(user.role !== SystemRole.ADMIN && {
        project: {
          members: {
            some: {
              userId: user.id
            }
          }
        }
      }),

      ...(query.awsAccountId && { awsAccountId: query.awsAccountId }),
      ...(query.projectId && { projectId: query.projectId }),
      ...(query.ownerId && { ownerId: query.ownerId }),
      ...(query.resourceType && { resourceType: query.resourceType }),
      ...(query.region && { region: query.region }),
      ...(query.source && { source: query.source }),
      ...(query.environment && { environment: query.environment }),
      ...(query.isDeleted !== undefined && {
        isDeleted: query.isDeleted
      }),

      ...(query.search && {
        OR: [
          {
            resourceName: {
              contains: query.search,
              mode: 'insensitive'
            }
          },
          {
            resourceIdentifier: {
              contains: query.search,
              mode: 'insensitive'
            }
          },
          {
            resourceType: {
              contains: query.search,
              mode: 'insensitive'
            }
          }
        ]
      })
    };
    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';
    const orderBy: Prisma.CloudResourceOrderByWithRelationInput = {
      [sortBy]: order
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      this.prisma.cloudResource.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          awsAccount: {
            select: {
              id: true,
              awsAccountId: true,
              accountName: true
            }
          }
        }
      }),
      this.prisma.cloudResource.count({
        where
      })
    ]);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  async getOneResource(userId: string, resourceId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resource = await this.prisma.cloudResource.findFirst({
      where: {
        id: resourceId,
        isDeleted: false,
        ...(user.role !== SystemRole.ADMIN && {
          project: { members: { some: { userId: user.id } } }
        })
      },
      include: {
        awsAccount: {
          select: {
            id: true,
            awsAccountId: true,
            accountName: true,
            ownerDepartment: true,
            defaultRegion: true,
            isActive: true,
            lastConfigSyncedAt: true,
            lastCostSyncedAt: true
          }
        },

        project: {
          select: {
            id: true,
            projectCode: true,
            projectName: true,
            description: true,
            businessDepartment: true,
            technicalDepartment: true,
            monthlyBudget: true,
            budgetCurrency: true,
            status: true,
            startDate: true,
            endDate: true
          }
        },

        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            avatarUrl: true
          }
        },

        tags: {
          orderBy: {
            tagKey: 'asc'
          },
          select: {
            id: true,
            tagKey: true,
            tagValue: true,
            createdAt: true,
            updatedAt: true
          }
        },

        documentation: {
          select: {
            id: true,
            purpose: true,
            runbookUrl: true,
            maintenanceWindow: true,
            warning: true,
            generalNotes: true,
            createdAt: true,
            updatedAt: true
          }
        },

        costRecords: {
          orderBy: {
            periodStart: 'desc'
          },
          take: 12,
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            service: true,
            region: true,
            amount: true,
            currency: true,
            isEstimated: true,
            syncedAt: true
          }
        },

        fileAttachments: {
          orderBy: {
            createdAt: 'desc'
          }
        },

        activityLogs: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 20
        }
      }
    });

    if (!resource) {
      throw new NotFoundException('Cloud resource not found');
    }

    return resource;
  }

  async editResource(
    userId: string,
    resourceId: string,
    dto: UpdateCloudResourceDto
  ) {
    // Admin แก้ได้ทุก Resource
    // User แก้ได้เฉพาะ Resource ที่อยู่ใน Project ที่ตัวเองเป็นสมาชิก
    // Project ที่จะเอามาผูก ต้องมีอยู่จริง
    // Owner ที่จะเอามาผูก ต้องมีอยู่จริง
    // Resource ที่ถูก soft delete ห้ามแก้
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const resource = await this.prisma.cloudResource.findUnique({
      where: {
        id: resourceId,
        isDeleted: false,
        ...(user.role !== SystemRole.ADMIN && {
          project: {
            members: {
              some: {
                userId: user.id
              }
            }
          }
        })
      },
      select: {
        id: true,
        projectId: true,
        ownerId: true
      }
    });

    if (!resource) {
      throw new NotFoundException('Cloud resource not found');
    }

    if (dto.projectId !== undefined && dto.projectId !== null) {
      const project = await this.prisma.project.findUnique({
        where: {
          id: dto.projectId
        },
        select: {
          id: true
        }
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      if (user.role !== SystemRole.ADMIN) {
        const membership = await this.prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: dto.projectId,
              userId: user.id
            }
          },
          select: {
            id: true
          }
        });

        if (!membership) {
          throw new BadRequestException(
            'You cannot assign this resource to a project that you are not a member'
          );
        }
      }
    }

    if (dto.ownerId !== undefined && dto.ownerId !== null) {
      const owner = await this.prisma.user.findUnique({
        where: {
          id: dto.ownerId
        },
        select: {
          id: true,
          status: true
        }
      });

      if (!owner) {
        throw new NotFoundException('Owner not found');
      }
    }
    const data: Prisma.CloudResourceUpdateInput = {
      ...(dto.projectId !== undefined && {
        project:
          dto.projectId === null
            ? {
                disconnect: true
              }
            : {
                connect: {
                  id: dto.projectId
                }
              }
      }),

      ...(dto.ownerId !== undefined && {
        owner:
          dto.ownerId === null
            ? {
                disconnect: true
              }
            : {
                connect: {
                  id: dto.ownerId
                }
              }
      }),
      ...(dto.environment !== undefined && {
        environment: dto.environment
      }),

      ...(dto.description !== undefined && {
        description: dto.description
      })
    };
    const updatedResource = await this.prisma.cloudResource.update({
      where: {
        id: resourceId
      },
      data,
      include: {
        awsAccount: {
          select: {
            id: true,
            awsAccountId: true,
            accountName: true
          }
        },

        project: {
          select: {
            id: true,
            projectCode: true,
            projectName: true,
            status: true
          }
        },

        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true
          }
        },

        tags: {
          select: {
            id: true,
            tagKey: true,
            tagValue: true
          }
        }
      }
    });

    return {
      message: 'Cloud resource updated successfully',
      resource: updatedResource
    };
  }
}

// const result = chunk(numbers, 3);
// [
//   [1,2,3],
//   [4,5,6],
//   [7,8,9],
//   [10]
// ]

// $transaction คือ การให้หลายคำสั่งใน Database ทำงานเป็น "ชุดเดียว" (Atomic Transaction)
// สำเร็จทั้งหมด หรือ ยกเลิกทั้งหมด
