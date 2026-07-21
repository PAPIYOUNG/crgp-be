import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '@/database/prisma.service';
import { BcryptService } from '@/infrastructure/hash/bcrypt.service';
import { ConflictException, Injectable } from '@nestjs/common';
import { UserCreateInput } from './types/user.type';
import { User } from '@/database/generated/prisma/client';
import { UserGetPayload } from '@/database/generated/prisma/internal/prismaNamespaceBrowser';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcrypt: BcryptService,
    private readonly cloudinary: CloudinaryService
  ) {}

  async createUser(input: UserCreateInput): Promise<void> {
    const { password, ...userData } = input;
    const passwordHash = await this.bcrypt.hash(password);

    try {
      await this.prisma.user.create({
        data: {
          ...userData,
          passwordHash
        }
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Email already exists');
        }
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

  async getAllUsers(): Promise<
    UserGetPayload<{ omit: { passwordHash: true } }>[]
  > {
    return this.prisma.user.findMany({
      omit: { passwordHash: true }
    });
  }
}
