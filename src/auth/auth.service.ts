import { AccessTokenService } from '@/infrastructure/jwt/access-token.service';
import { LoginDto } from '@/auth/dto/login.dto';
import { LoginResponseDto } from '@/auth/dto/login-response.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { BcryptService } from '@/infrastructure/hash/bcrypt.service';
import { UserService } from '@/user/user.service';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { UserResponseDto } from '@/user/types/user.response.dto';
import { ActivityLogsService } from '@/activity-logs/activity-logs.service';
import {
  ActivityAction,
  ActivityEntityType
} from '@/database/generated/prisma/enums';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly bcrypt: BcryptService,
    private readonly jwt: AccessTokenService,
    private readonly activity: ActivityLogsService
  ) {}
  async register(data: RegisterDto) {
    const user = await this.userService.createUser(data);

    await this.activity.createActivityLog(user.id, {
      action: ActivityAction.CREATE,
      entityType: ActivityEntityType.USER,
      entityId: user.id,
      description: 'User registered',
      newValues: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department
      }
    });

    return user;
  }

  async login(data: LoginDto): Promise<LoginResponseDto> {
    //console.log('login dto:', data);

    const user = await this.userService.getUserByEmail(data.email);

    if (!user) {
      throw new UnauthorizedException('Invalid Email or Password');
    }
    const isMatch = await this.bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid Email or Password');
    }
    const access_token = await this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role
    });

    await this.activity.createActivityLog(user.id, {
      action: ActivityAction.LOGIN,
      entityType: ActivityEntityType.USER,
      entityId: user.id,
      description: `User ${user.email} logged in`
    });
    return {
      access_token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        department: user.department,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    };
  }

  async getProfile(id: string): Promise<UserResponseDto> {
    const user = await this.userService.getUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
