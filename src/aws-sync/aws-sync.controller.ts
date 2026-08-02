import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post
} from '@nestjs/common';
import { AwsSyncService } from './aws-sync.service';
import { Roles } from '@/common/decorators/role.decorator';
import { SystemRole } from '@/database/generated/prisma/enums';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Roles(SystemRole.ADMIN)
@Controller('aws-sync')
export class AwsSyncController {
  constructor(private readonly awsSyncService: AwsSyncService) {}

  @Post('config/:id')
  syncConfig(
    @Param('id', ParseUUIDPipe) accountId: string,
    @CurrentUser('sub') currentUserId: string
  ) {
    return this.awsSyncService.syncConfig(accountId, currentUserId);
  }

  @Post('cost/:id')
  syncCost(
    @Param('id', ParseUUIDPipe) accountId: string,
    @CurrentUser('sub') currentUserId: string
  ) {
    return this.awsSyncService.syncCost(accountId, currentUserId);
  }

  @Post('tags/:id')
  @HttpCode(HttpStatus.OK)
  syncTags(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') currentUserId: string
  ) {
    return this.awsSyncService.syncTags(id, currentUserId);
  }
}
