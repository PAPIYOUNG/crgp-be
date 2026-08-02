import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '@/config/env.validate';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './user/user.module';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { RoleGuard } from '@/auth/guards/role.guard';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@/infrastructure/jwt/jwt.module';
import { AwsModule } from './aws/aws.module';
import { ProjectModule } from './project/project.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { AwsSyncModule } from './aws-sync/aws-sync.module';
import { CloudResourceModule } from './cloud-resource/cloud-resource.module';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectAwsModule } from './project-aws/project-aws.module';
import { CostModule } from './cost/cost.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validate
    }),
    AuthModule,
    DatabaseModule,
    UserModule,
    JwtModule,
    AwsModule,
    ProjectModule,
    ActivityLogsModule,
    AwsSyncModule,
    CloudResourceModule,
    ProjectMemberModule,
    ProjectAwsModule,
    CostModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard }
  ]
})
export class AppModule {}
