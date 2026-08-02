import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { MessageResponseDto } from '@/common/dto/message-response.sto';
import { CreateProjectDto } from '@/project/dto/create-project.dto';
import { EditProjectDto } from '@/project/dto/edit-project.dto';
import { FindProjectQueryDto } from '@/project/dto/find-project-query.dto';
import { ProjectService } from '@/project/project.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query
} from '@nestjs/common';

@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  getAllProject(
    @CurrentUser('sub') currentUserId: string,
    @Query() query: FindProjectQueryDto
  ) {
    //console.log('query', query);
    return this.projectService.getAllProject(currentUserId, query);
  }

  @Get(':id')
  getOneProject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') currentUserId: string
  ) {
    return this.projectService.getOneProject(currentUserId, id);
  }

  @Post()
  async createProject(
    @CurrentUser('sub') currentUserId: string,
    @Body() dto: CreateProjectDto
  ): Promise<MessageResponseDto> {
    await this.projectService.createProject(currentUserId, dto);
    return { message: 'Create Project successfully' };
  }

  @Patch(':id')
  async editProject(
    @CurrentUser('sub') currentUserId: string,
    @Body() dto: EditProjectDto,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<MessageResponseDto> {
    await this.projectService.editProject(currentUserId, dto, id);
    return { message: 'Update Project data successfully' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProject(
    @CurrentUser('sub') currentUserId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    await this.projectService.deleteProject(currentUserId, id);
  }
}
