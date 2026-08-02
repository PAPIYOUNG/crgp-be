import { PrismaService } from '@/database/prisma.service';
import { AwsCredentialsService } from '@/infrastructure/aws/aws-credentials.service';
import { Injectable, Logger } from '@nestjs/common';
import {
  GetResourcesCommand,
  ResourceGroupsTaggingAPIClient,
  ResourceTagMapping
} from '@aws-sdk/client-resource-groups-tagging-api';

type SyncTagsInput = {
  awsAccountId: string;
  roleArn: string;
  externalId: string;
  region: string;
};

type SyncTagsResult = {
  received: number;
  created: number;
  updated: number;
  failed: number;
  deleted: number;
  skipped: number;
  matched: number;
};

@Injectable()
export class TagService {
  private readonly logger = new Logger(TagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly awsCredentialsService: AwsCredentialsService
  ) {}

  async getTags(input: SyncTagsInput): Promise<SyncTagsResult> {
    const credentials = this.awsCredentialsService.createAssumeRoleCredentials({
      roleArn: input.roleArn,
      externalId: input.externalId,
      region: input.region
    });

    const client = new ResourceGroupsTaggingAPIClient({
      region: input.region,
      credentials
    });

    try {
      const mappings = await this.getAllResourceTags(client);
      //console.log('mappings', mappings);
      // ได้ค่า mappings [{
      //ResourceARN: 'arn:aws:ec2:ap-southeast-1:050670790796:subnet/subnet-03b96319b37faa53f', >>resource_arn+resource_identifier
      //Tags: [ [Object] ]}, >> อย่าลืมเรื่องที่ resource ไม่มี resourceArn awsจะไม่ส่ง tag ให้ ต้องดึง specific
      const result: SyncTagsResult = {
        received: mappings.length,
        matched: 0,
        created: 0,
        updated: 0,
        deleted: 0,
        skipped: 0,
        failed: 0
      };

      //ดึง Resource ใน DB มาก่อนรอบเดียว
      const cloudResources = await this.prisma.cloudResource.findMany({
        where: {
          awsAccountId: input.awsAccountId,
          resourceArn: {
            not: null // เลือกเฉพาะข้อมูลที่ resourceArn ไม่เป็น null
          },
          isDeleted: false
        },
        select: {
          id: true,
          resourceArn: true
        }
      });

      const resourceByArn = new Map(
        cloudResources
          .filter(
            (resource): resource is { id: string; resourceArn: string } =>
              resource.resourceArn !== null //
          )
          .map((resource) => [resource.resourceArn, resource]) // เอาของจาก db mapเป็น [key, value]
      );

      for (const mapping of mappings) {
        const resourceArn = mapping.ResourceARN;

        if (!resourceArn) {
          result.skipped++;
          continue;
        }

        const cloudResource = resourceByArn.get(resourceArn);
        //AWS ส่ง resource มา แต่ใน cloud_resources database ของเรายังไม่มี ให้ skip
        if (!cloudResource) {
          result.skipped++;

          this.logger.debug(
            `Skip tags because resource ARN does not exist in database: ${resourceArn}`
          );

          continue;
        }

        result.matched++;

        try {
          const tagResult = await this.syncResourceTags(
            cloudResource.id,
            mapping.Tags ?? []
          );

          result.created += tagResult.created;
          result.updated += tagResult.updated;
          result.deleted += tagResult.deleted;
        } catch (error) {
          result.failed++;

          this.logger.error(
            `Failed to sync tags for ${resourceArn}`,
            error instanceof Error ? error.stack : String(error)
          );
        }
      }

      return result;
    } finally {
      client.destroy();
    }
  }

  //ส่วนย่อย
  private async getAllResourceTags(
    client: ResourceGroupsTaggingAPIClient
  ): Promise<ResourceTagMapping[]> {
    const mappings: ResourceTagMapping[] = [];
    let paginationToken: string | undefined;

    //รอบแรก paginationToken=undefine >> AWS เข้าใจว่าขอหน้าแรก
    do {
      const response = await client.send(
        new GetResourcesCommand({
          PaginationToken: paginationToken,
          ResourcesPerPage: 100
        })
      );

      mappings.push(...(response.ResourceTagMappingList ?? []));

      paginationToken = response.PaginationToken || undefined; //ถ้ามี Token แปลว่ายังมีหน้าถัดไป / ถ้าไม่มี PaginationToken = undefined แปลว่าจบเเล้ว
    } while (paginationToken);

    return mappings;
  }

  //     Sync tag ของ resource หนึ่งตัว
  //    1. tag ที่ AWS มี แต่ DB ไม่มี      -> create
  //    2. tag key เดิม value เปลี่ยน      -> update
  //    3. tag ที่ DB มี แต่ AWS ไม่มีแล้ว -> delete

  private async syncResourceTags(
    resourceId: string,
    awsTags: Array<{
      Key?: string;
      Value?: string;
    }>
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
  }> {
    const normalizedTags = awsTags
      .filter(
        (
          tag
        ): tag is {
          Key: string;
          Value?: string;
        } => typeof tag.Key === 'string' && tag.Key.length > 0
      )
      .map((tag) => ({
        tagKey: tag.Key,
        tagValue: tag.Value ?? ''
      }));

    //ป้องกัน key ซ้ำจากข้อมูลต้นทาง

    const uniqueTags = Array.from(
      new Map(normalizedTags.map((tag) => [tag.tagKey, tag])).values()
    );

    return this.prisma.$transaction(async (tx) => {
      const existingTags = await tx.resourceTag.findMany({
        where: {
          resourceId
        },
        select: {
          id: true,
          tagKey: true,
          tagValue: true
        }
      });

      const existingByKey = new Map(
        existingTags.map((tag) => [tag.tagKey, tag])
      );

      const awsTagKeys = new Set(uniqueTags.map((tag) => tag.tagKey));

      let created = 0;
      let updated = 0;
      let deleted = 0;

      //Create หรือ Update

      for (const tag of uniqueTags) {
        const existingTag = existingByKey.get(tag.tagKey);

        if (!existingTag) {
          await tx.resourceTag.create({
            data: {
              resourceId,
              tagKey: tag.tagKey,
              tagValue: tag.tagValue
            }
          });

          created++;
          continue;
        }

        if (existingTag.tagValue !== tag.tagValue) {
          await tx.resourceTag.update({
            where: {
              id: existingTag.id
            },
            data: {
              tagValue: tag.tagValue
            }
          });

          updated++;
        }
      }

      //ลบ tag ที่ AWS ไม่มีแล้ว
      const tagsToDelete = existingTags.filter(
        (tag) => !awsTagKeys.has(tag.tagKey)
      );

      if (tagsToDelete.length > 0) {
        const deleteResult = await tx.resourceTag.deleteMany({
          where: {
            id: {
              in: tagsToDelete.map((tag) => tag.id)
            }
          }
        });

        deleted = deleteResult.count;
      }

      return {
        created,
        updated,
        deleted
      };
    });
  }
}
