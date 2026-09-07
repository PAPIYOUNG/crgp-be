import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '@/database/prisma.service';
import { BcryptService } from '@/infrastructure/hash/bcrypt.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { UserCreateInput } from './types/user.type';
import {
  SystemRole,
  User,
  UserStatus
} from '@/database/generated/prisma/client';
import { UserGetPayload } from '@/database/generated/prisma/internal/prismaNamespaceBrowser';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import {
  EditPasswordDto,
  EditProfileDto
} from '@/user/dto/update-role-status.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcrypt: BcryptService,
    private readonly cloudinary: CloudinaryService
  ) {}

  async createUser(input: UserCreateInput) {
    const { password, ...userData } = input;
    const passwordHash = await this.bcrypt.hash(password);

    try {
      const user = await this.prisma.user.create({
        data: {
          ...userData,
          passwordHash
        },
        omit: {
          passwordHash: true
        }
      });

      return user;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }

      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({ where: { email } });
  }

  async getUserById(
    id: string
  ): Promise<UserGetPayload<{ omit: { passwordHash: true } }> | null> {
    return this.prisma.user.findUnique({
      where: { id },
      omit: { passwordHash: true }
    });
  }

  async uploadAvatar(
    userId: string,
    avatar: Express.Multer.File
  ): Promise<string> {
    const avatarUrl = await this.cloudinary.upload(avatar);
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl }
    });
    return avatarUrl;
  }

  getUserOptions(): Promise<
    UserGetPayload<{ omit: { passwordHash: true } }>[]
  > {
    return this.prisma.user.findMany({
      omit: { passwordHash: true }
    });
  }
  async getAllUsers(): Promise<
    UserGetPayload<{ omit: { passwordHash: true } }>[]
  > {
    return this.prisma.user.findMany({
      omit: { passwordHash: true }
    });
  }

  async getOneUserById(
    id: string
  ): Promise<UserGetPayload<{ omit: { passwordHash: true } }>> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: { passwordHash: true }
    });
    if (!user) {
      throw new NotFoundException('Not found user');
    }
    return user;
  }

  async editRoleById(id: string, role: SystemRole): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: { role }
    });
  }

  async editStatusById(id: string, status: UserStatus): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: { status }
    });
  }

  async editProfile(currentUserId: string, dto: EditProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { id: true }
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.prisma.user.update({
      where: { id: currentUserId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        department: dto.department
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        role: true,
        status: true,
        avatarUrl: true
      }
    });
  }

  async editPassword(currentUserId: string, dto: EditPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId }
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordCorrect = await this.bcrypt.compare(
      dto.currentPassword,
      user.passwordHash
    );

    if (!isPasswordCorrect) {
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await this.bcrypt.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: currentUserId },
      data: { passwordHash }
    });
    return {
      message: 'Change password successfully'
    };
  }
}
