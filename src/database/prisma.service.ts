import { Injectable } from '@nestjs/common';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { EnvVariableType } from '../config/env.validate';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(
    private readonly configService: ConfigService<EnvVariableType, true>
  ) {
    //console.log('configService', configService);
    const adapter = new PrismaPg({
      connectionString: configService.get('DATABASE_URL', { infer: true })
    });
    super({ adapter });
  }
}
