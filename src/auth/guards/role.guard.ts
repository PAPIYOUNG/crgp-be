import { ROLE_KEY } from '@/common/decorators/role.decorator';
import { SystemRole } from '@/database/generated/prisma/enums';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const role = this.reflector.getAllAndOverride<SystemRole[] | undefined>(
      ROLE_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (!role) {
      return true; //ถ้าไม่มี @Roles() apply ก็ให้ผ่านไปได้เลย ไม่ต้องทำต่อ
    }
    //ถ้ามี @Roles() ให้ดึง request.user=payload จาก AuthGuard มาดูข้อมูล user ต่อว่า Role ไร มีสิทธิ์ไหม
    const request = context.switchToHttp().getRequest<Request>();
    const userRole = request.user?.role;

    if (!userRole || !role.includes(userRole)) {
      throw new ForbiddenException('Role insufficient');
    }
    return true;
  }
}
