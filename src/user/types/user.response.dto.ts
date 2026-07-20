import {
  Department,
  SystemRole,
  UserStatus
} from '@/database/generated/prisma/enums';

export class UserResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  role: SystemRole;
  department: Department;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}
