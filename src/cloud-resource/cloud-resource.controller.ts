import { CloudResourceService } from '@/cloud-resource/cloud-resource.service';
import { FindCloudResourceQueryDto } from '@/cloud-resource/dto/find-cloud-resource-query.dto';
import { UpdateCloudResourceDto } from '@/cloud-resource/dto/update-cloud-resource.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query
} from '@nestjs/common';

@Controller('cloud-resource')
export class CloudResourceController {
  constructor(private readonly cloudResourceService: CloudResourceService) {}

  @Get('')
  getAllResource(
    @CurrentUser('sub') id: string,
    @Query() query: FindCloudResourceQueryDto
  ) {
    return this.cloudResourceService.getAllResource(id, query);
  }

  @Get(':id')
  getOneResource(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) resourceId: string
  ) {
    return this.cloudResourceService.getOneResource(userId, resourceId);
  }

  @Patch(':id')
  updateResource(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) resourceId: string,
    @Body() dto: UpdateCloudResourceDto
  ) {
    return this.cloudResourceService.editResource(userId, resourceId, dto);
  }
}
