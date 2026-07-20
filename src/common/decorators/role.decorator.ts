import { SystemRole } from '@/database/generated/prisma/enums';
import { SetMetadata } from '@nestjs/common';

export const ROLE_KEY = 'ROLES';

export function Roles(...roles: SystemRole[]) {
  return SetMetadata(ROLE_KEY, roles);
}
