import { Module } from '@nestjs/common';
import { ClientService } from './client.service';
import { ResourceService } from './resource.service';
import { WatcherService } from './watcher.service';

@Module({
  imports: [],
  controllers: [],
  providers: [ClientService, ResourceService, WatcherService],
  exports: [ResourceService, WatcherService],
})
export class KubernetesModule {}
