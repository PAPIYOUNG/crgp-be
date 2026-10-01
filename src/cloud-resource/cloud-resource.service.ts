import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/database/prisma.service';
import {
  ResourceProvider,
  ResourceSource,
  SystemRole
} from '@/database/generated/prisma/enums';
import {
  SyncCloudResourceInput,
  SyncCloudResourceResult
} from './types/sync-cloud-resource.type';
import { FindCloudResourceQueryDto } from '@/cloud-resource/dto/find-cloud-resource-query.dto';
import { Prisma } from '@/database/generated/prisma/client';
import { UpdateCloudResourceDto } from '@/cloud-resource/dto/update-cloud-resource.dto';
import { CreateResourceDto } from '@/cloud-resource/dto/create-resource.dto';
import {
  MANUAL_RESOURCE_TYPE_MAP,
  RESOURCE_SERVICE_MAP
} from '@/common/constant/cloud-resource.constants';

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
      where: {
        id
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const search = query.search?.trim();

    const selectedServiceTypes = query.service
      ? RESOURCE_SERVICE_MAP[query.service as keyof typeof RESOURCE_SERVICE_MAP]
      : undefined;

    const where: Prisma.CloudResourceWhereInput = {
      /*
       * หน้า List ปกติแสดงเฉพาะ Resource ที่ยังไม่ถูกลบ
       * ถ้าส่ง isDeleted=true จึงจะแสดงของที่ถูก soft delete
       */
      isDeleted: query.isDeleted ?? false,

      /*
       * ใช้ AND เพื่อไม่ให้ OR ของ permission
       * ถูก OR ของ search เขียนทับ
       */
      AND: [
        /*
         * Admin ไม่มีข้อจำกัด
         *
         * User เห็น:
         * 1. Resource ใน Project ที่ตัวเองเป็นสมาชิก
         * 2. Resource ที่ยังไม่ได้ผูก Project
         */
        ...(user.role !== SystemRole.ADMIN
          ? [
              {
                OR: [
                  {
                    project: {
                      members: {
                        some: {
                          userId: user.id
                        }
                      }
                    }
                  },
                  {
                    projectId: null
                  }
                ]
              } satisfies Prisma.CloudResourceWhereInput
            ]
          : []),

        /*
         * Search จากชื่อ, identifier และ resource type
         */
        ...(search
          ? [
              {
                OR: [
                  {
                    resourceName: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive
                    }
                  },
                  {
                    resourceIdentifier: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive
                    }
                  },
                  {
                    resourceType: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive
                    }
                  }
                ]
              } satisfies Prisma.CloudResourceWhereInput
            ]
          : [])
      ],

      ...(query.awsAccountId && {
        awsAccountId: query.awsAccountId
      }),

      ...(query.projectId && {
        projectId: query.projectId
      }),

      ...(query.ownerId && {
        ownerId: query.ownerId
      }),

      /*
       * ถ้าส่ง service ให้ service มีความสำคัญกว่า resourceType
       * ป้องกันการกำหนด resourceType ซ้ำกันใน object
       */
      ...(selectedServiceTypes
        ? {
            resourceType: {
              in: [...selectedServiceTypes]
            }
          }
        : query.resourceType
          ? {
              resourceType: query.resourceType
            }
          : {}),

      ...(query.region && {
        region: query.region
      }),

      ...(query.source && {
        source: query.source
      }),

      ...(query.provider && {
        provider: query.provider
      }),

      ...(query.environment && {
        environment: query.environment
      }),

      ...(query.unassigned === true && {
        projectId: null
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

    const [items, totalItems, allResourceTypes] = await Promise.all([
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
          },
          project: {
            select: {
              id: true,
              projectName: true,
              projectCode: true
            }
          }
        }
      }),

      this.prisma.cloudResource.count({
        where
      }),

      this.prisma.cloudResource.findMany({
        where,
        select: {
          resourceType: true
        }
      })
    ]);

    const summary = {
      EC2: 0,
      RDS: 0,
      S3: 0,
      LAMBDA: 0,
      EKS: 0,
      LOAD_BALANCER: 0,
      WAF: 0,
      CDN: 0,
      NETWORKING: 0,
      OTHER: 0
    };

    for (const resource of allResourceTypes) {
      const category = this.getResourceServiceCategory(resource.resourceType);

      summary[category]++;
    }

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
      },
      summary
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
    const resource = await this.prisma.cloudResource.findFirst({
      where: {
        id: resourceId,
        isDeleted: false,
        ...(user.role !== SystemRole.ADMIN && {
          OR: [
            {
              project: {
                members: {
                  some: {
                    userId: user.id
                  }
                }
              }
            },
            {
              projectId: null
            }
          ]
        })
      },
      select: {
        id: true,
        awsAccountId: true,
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
          id: true,
          projectAwsAccounts: {
            select: {
              awsAccountId: true
            }
          }
        }
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      // Resource ที่ไม่มี AWS Account (รันบน cloud อื่น/private cloud) ไม่ต้องเช็คการผูก Account กับ Project
      if (resource.awsAccountId !== null) {
        const accountIsLinked = project.projectAwsAccounts.some(
          (linkedAccount) =>
            linkedAccount.awsAccountId === resource.awsAccountId
        );

        if (!accountIsLinked) {
          throw new BadRequestException(
            'The AWS account of this resource is not linked to the project'
          );
        }
      }

      if (resource.projectId !== null && resource.projectId !== dto.projectId) {
        throw new BadRequestException(
          'This resource is already linked to another project'
        );
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

  async createResource(userId: string, dto: CreateResourceDto) {
    // Resource ที่ provider เป็น AWS เท่านั้นที่ต้องผูกกับ AWS Account ที่มีอยู่จริง
    // Resource ที่รันบน cloud อื่น หรือ private cloud ไม่มี AWS Account ให้ผูก
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

    const isAwsProvider = dto.provider === ResourceProvider.AWS;

    if (isAwsProvider) {
      if (!dto.awsAccountId) {
        throw new BadRequestException(
          'AWS account is required when provider is AWS'
        );
      }

      const awsAccount = await this.prisma.awsAccount.findUnique({
        where: {
          id: dto.awsAccountId
        },
        select: {
          id: true
        }
      });

      if (!awsAccount) {
        throw new NotFoundException('AWS account not found');
      }
    }

    if (dto.projectId) {
      const project = await this.prisma.project.findUnique({
        where: {
          id: dto.projectId
        },
        select: {
          id: true,
          projectAwsAccounts: {
            select: {
              awsAccountId: true
            }
          }
        }
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      // Resource ที่ไม่มี AWS Account ไม่ต้องเช็คว่า Account ถูกผูกกับ Project หรือไม่
      if (isAwsProvider) {
        const accountIsLinked = project.projectAwsAccounts.some(
          (linkedAccount) => linkedAccount.awsAccountId === dto.awsAccountId
        );

        if (!accountIsLinked) {
          throw new BadRequestException(
            'The AWS account of this resource is not linked to the project'
          );
        }
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

    const configuration =
      dto.instanceType || dto.monthlyCost
        ? {
            ...(dto.instanceType && { instanceType: dto.instanceType }),
            ...(dto.monthlyCost && { monthlyCost: dto.monthlyCost })
          }
        : undefined;

    const resource = await this.prisma.cloudResource.create({
      data: {
        awsAccountId: isAwsProvider ? dto.awsAccountId : undefined,
        // ไม่มี identifier จริงจาก AWS จึงสร้างให้ unique ต่อ resourceType เอง
        resourceIdentifier: `manual-${randomUUID()}`,
        resourceName: dto.resourceName,
        resourceType: MANUAL_RESOURCE_TYPE_MAP[dto.service],
        region: dto.region,
        resourceStatus: dto.status,
        source: ResourceSource.MANUAL,
        provider: dto.provider,
        environment: dto.environment,
        description: dto.description,
        configuration,
        projectId: dto.projectId,
        lastSyncedAt: new Date()
      },
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
      message: 'Cloud resource created successfully',
      resource
    };
  }

  private getResourceServiceCategory(
    resourceType: string
  ):
    | 'EC2'
    | 'RDS'
    | 'S3'
    | 'LAMBDA'
    | 'EKS'
    | 'LOAD_BALANCER'
    | 'WAF'
    | 'CDN'
    | 'NETWORKING'
    | 'OTHER' {
    switch (resourceType) {
      case 'AWS::EC2::Instance':
      case 'AWS::EC2::Volume':
      case 'AWS::EC2::Snapshot':
        return 'EC2';

      case 'AWS::RDS::DBInstance':
      case 'AWS::RDS::DBCluster':
      case 'AWS::RDS::DBSubnetGroup':
        return 'RDS';

      case 'AWS::S3::Bucket':
        return 'S3';

      case 'AWS::Lambda::Function':
        return 'LAMBDA';

      case 'AWS::EKS::Cluster':
      case 'AWS::EKS::Nodegroup':
        return 'EKS';

      case 'AWS::ElasticLoadBalancing::LoadBalancer':
      case 'AWS::ElasticLoadBalancingV2::LoadBalancer':
        return 'LOAD_BALANCER';

      case 'AWS::WAF::WebACL':
      case 'AWS::WAFv2::WebACL':
        return 'WAF';

      case 'AWS::CloudFront::Distribution':
        return 'CDN';

      case 'AWS::EC2::Subnet':
      case 'AWS::EC2::VPC':
      case 'AWS::EC2::RouteTable':
      case 'AWS::EC2::SubnetRouteTableAssociation':
      case 'AWS::EC2::SecurityGroup':
      case 'AWS::EC2::NetworkAcl':
      case 'AWS::EC2::InternetGateway':
      case 'AWS::EC2::NatGateway':
      case 'AWS::EC2::EIP':
      case 'AWS::Route53Resolver::ResolverRule':
      case 'AWS::Route53Resolver::ResolverRuleAssociation':
        return 'NETWORKING';

      default:
        return 'OTHER';
    }
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
