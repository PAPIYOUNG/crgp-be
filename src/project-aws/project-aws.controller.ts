import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SystemRole } from '@/database/generated/prisma/enums';
import { LinkProjectAwsAccountDto } from '@/project-aws/dto/link-project-aws-account.dto';
import { ProjectAwsService } from '@/project-aws/project-aws.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post
} from '@nestjs/common';

@Controller('project/:projectId/aws-account')
export class ProjectAwsController {
  constructor(private readonly projectAwsService: ProjectAwsService) {}
  //คนที่ดูได้ ADMIN,TECHNICAL_OWNER+Member ของ Project
  @Get()
  getProjectAwsAccounts(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: SystemRole
  ) {
    return this.projectAwsService.getProjectAwsAccounts(
      projectId,
      userId,
      role
    );
  }
  //คนที่ดูได้ ทุกคนที่เป็น member ของ Project (สำหรับ dropdown เลือก account มา link)
  @Get('available')
  getAvailableAwsAccounts(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: SystemRole
  ) {
    return this.projectAwsService.getAvailableAwsAccounts(
      projectId,
      userId,
      role
    );
  }

  //คนที่ดูได้ ADMIN,TECHNICAL_OWNER+Member ของ Project
  @Get(':accountId')
  getProjectAwsAccountById(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: SystemRole
  ) {
    return this.projectAwsService.getProjectAwsAccountById(
      projectId,
      accountId,
      userId,
      role
    );
  }
  //คนที่ทำได้ ADMIN,BUSINESS_OWNER,TECHNICAL_OWNER ของ Project
  @Post()
  linkAwsAccount(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: LinkProjectAwsAccountDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: SystemRole
  ) {
    return this.projectAwsService.linkAwsAccount(projectId, dto, userId, role);
  }

  //คนที่ทำได้ ADMIN,BUSINESS_OWNER,TECHNICAL_OWNER ของ Project
  @Delete(':accountId')
  @HttpCode(HttpStatus.OK)
  unlinkAwsAccount(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: SystemRole
  ) {
    return this.projectAwsService.unlinkAwsAccount(
      projectId,
      accountId,
      userId,
      role
    );
  }
}
