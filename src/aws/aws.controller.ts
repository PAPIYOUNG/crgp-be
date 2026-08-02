import { AwsService } from '@/aws/aws.service';
import { CreateAwsAccountDto } from '@/aws/dto/create-aws.dto';
import { UpdateAwsAccountDto } from '@/aws/dto/edit-aws.dto';
import { FindAwsAccountQueryDto } from '@/aws/dto/find-aws-account-query.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/role.decorator';
import { MessageResponseDto } from '@/common/dto/message-response.sto';
import { AwsAccount } from '@/database/generated/prisma/client';
import { SystemRole } from '@/database/generated/prisma/enums';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query
} from '@nestjs/common';

@Controller('aws')
export class AwsController {
  constructor(private readonly awsService: AwsService) {}

  @Roles(SystemRole.ADMIN)
  @Post()
  createAwsAccount(@Body() dto: CreateAwsAccountDto): Promise<AwsAccount> {
    return this.awsService.createAwsAccount(dto);
  }

  @Roles(SystemRole.ADMIN)
  @Patch(':id')
  async editAwsAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAwsAccountDto
  ): Promise<MessageResponseDto> {
    await this.awsService.editAwsAccount(id, dto);
    return { message: 'Update AWS account successfully' };
  }

  @Post(':id/verify')
  verifyAwsAccount(@Param('id', ParseUUIDPipe) id: string) {
    return this.awsService.verifyAwsAccount(id);
  }

  @Get()
  getAllAwsAccount(
    @CurrentUser('sub') currentUserId: string,
    @Query() query: FindAwsAccountQueryDto
  ) {
    //console.log('query', query);
    return this.awsService.getAllAwsAccount(currentUserId, query);
  }

  @Get(':id')
  getOneAwsAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') currentUserId: string
  ): Promise<AwsAccount> {
    return this.awsService.getOneAwsAccount(id, currentUserId);
  }

  @Roles(SystemRole.ADMIN)
  @Delete(':id')
  async deleteAwsAccount(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<MessageResponseDto> {
    await this.awsService.deleteAwsAccount(id);

    return {
      message: 'AWS account deactivated successfully'
    };
  }
}
