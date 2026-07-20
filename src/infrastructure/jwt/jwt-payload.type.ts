import { SystemRole } from '@/database/generated/prisma/enums';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: SystemRole;
};
