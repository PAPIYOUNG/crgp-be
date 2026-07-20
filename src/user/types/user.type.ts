import { Department } from '@/database/generated/prisma/enums';

export type UserCreateInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  department: Department;
};
