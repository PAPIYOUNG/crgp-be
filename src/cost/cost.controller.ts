import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { CostService } from './cost.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('cost')
export class CostController {
  constructor(private readonly costService: CostService) {}

  //ดึง Cost MTD ของ AWS Account ทุก Account ที่ current user มีสิทธิ์เข้าถึง
  @Get('aws-accounts')
  async getAwsAccountCostSummaries(@CurrentUser('sub') currentUserId: string) {
    return this.costService.getAwsAccountCostSummaries(currentUserId);
  }

  //ดึง Cost MTD ของ AWS Account เดียว
  @Get('aws-accounts/:awsAccountId/mtd')
  async getAwsAccountCostMtd(
    @CurrentUser('sub') currentUserId: string,
    @Param('awsAccountId', ParseUUIDPipe) awsAccountId: string
  ) {
    return this.costService.getAwsAccountCostMtd(currentUserId, awsAccountId);
  }

  //รวม Cost ทั้งหมดของ AWS Accountไม่จำกัดเฉพาะเดือนปัจจุบัน>>Phase2

  @Get('aws-accounts/:awsAccountId/total')
  async getAwsAccountTotalCost(
    @CurrentUser('sub') currentUserId: string,
    @Param('awsAccountId', ParseUUIDPipe) awsAccountId: string
  ) {
    return this.costService.getAwsAccountTotalCost(currentUserId, awsAccountId);
  }

  // ดึง Cost MTD ของ Projectโดยรวมจาก AWS Account ที่เชื่อมกับ Project

  @Get('projects/:projectId/mtd')
  async getProjectCostMtd(
    @CurrentUser('sub') currentUserId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string
  ) {
    return this.costService.getProjectCostMtd(currentUserId, projectId);
  }
}
