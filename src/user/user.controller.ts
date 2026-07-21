import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/role.decorator';
import { SystemRole } from '@/database/generated/prisma/client';
import { UserGetPayload } from '@/database/generated/prisma/internal/prismaNamespaceBrowser';
import { UserService } from '@/user/user.service';
import {
  Controller,
  Get,
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
  @Roles(SystemRole.ADMIN)
  @Get()
  getAllUser(): Promise<UserGetPayload<{ omit: { passwordHash: true } }>[]> {
    return this.userService.getAllUsers();
  }
}
