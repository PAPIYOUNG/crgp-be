import { Global, Module } from '@nestjs/common';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';

@Global()
@Module({
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService]
})
export class ActivityLogsModule {}
