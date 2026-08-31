import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/role.decorator';
import { MessageResponseDto } from '@/common/dto/message-response.sto';
import { SystemRole, UserStatus } from '@/database/generated/prisma/client';
import { UserGetPayload } from '@/database/generated/prisma/internal/prismaNamespaceBrowser';
import {
  EditPasswordDto,
  EditProfileDto,
  UpdateRoleDto,
  UpdateStatusDto
} from '@/user/dto/update-role-status.dto';
import { UserService } from '@/user/user.service';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  uploadAvatar(
    @UploadedFile() avatar: Express.Multer.File,
    @CurrentUser('sub') userId: string
  ): Promise<string> {
    console.log('avatar', avatar);
    return this.userService.uploadAvatar(userId, avatar);

    // return {
    //   filename: file.originalname,
    //   mimetype: file.mimetype,
    //   size: file.size
    // };
  }

  @Roles(SystemRole.ADMIN, SystemRole.USER)
  @Get('options')
  getOptionUsers() {
    return this.userService.getUserOptions();
  }

  @Roles(SystemRole.ADMIN)
  @Get()
  getAllUser(): Promise<UserGetPayload<{ omit: { passwordHash: true } }>[]> {
    return this.userService.getAllUsers();
  }

  @Roles(SystemRole.ADMIN)
  @Get('/:id')
  getOneUser(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<UserGetPayload<{ omit: { passwordHash: true } }>> {
    return this.userService.getOneUserById(id);
  }

  @Roles(SystemRole.ADMIN)
  @Patch(':id/role')
  async editRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto
  ): Promise<MessageResponseDto> {
    await this.userService.editRoleById(id, dto.role);
    return { message: 'Change user role successfully' };
  }

  @Roles(SystemRole.ADMIN)
  @Patch(':id/status')
  async editStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser('sub') currentUserId: string
  ): Promise<MessageResponseDto> {
    console.log(id);
    console.log(dto);
    //ป้องกัน admin ปิด account ตัวเอง
    if (id === currentUserId && dto.status === UserStatus.INACTIVE) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    await this.userService.editStatusById(id, dto.status);
    return { message: 'Change user status successfully' };
  }

  @Patch()
  async editProfile(
    @CurrentUser('sub') currentUserId: string,
    @Body() dto: EditProfileDto
  ) {
    return await this.userService.editProfile(currentUserId, dto);
  }

  @Patch('password')
  async editPassword(
    @CurrentUser('sub') currentUserId: string,
    @Body() dto: EditPasswordDto
  ) {
    return await this.userService.editPassword(currentUserId, dto);
  }
}
