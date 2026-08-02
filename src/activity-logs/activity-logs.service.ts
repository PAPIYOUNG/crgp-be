import { CreateActivityLogsDto } from '@/activity-logs/dto/create-activity-log.dto';
import { PrismaService } from '@/database/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createActivityLog(currentUserId: string, data: CreateActivityLogsDto) {
    return this.prisma.activityLog.create({
      data: {
        ...data,
        userId: currentUserId
      }
    });
  }
}
