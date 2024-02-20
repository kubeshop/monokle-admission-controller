import { Injectable } from '@nestjs/common';
import { ClientService } from './client.service';
import k8s from '@kubernetes/client-node';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class WatcherService {
  public static WATCH_PREFIX = 'kubernetes-client:watch';

  constructor(
    private readonly $client: ClientService,
    private readonly $events: EventEmitter2,
  ) {}

  public static getEventsKey(group: string, version: string, plural: string) {
    return `${WatcherService.WATCH_PREFIX}:${group}:${version}:${plural}`;
  }

  async watch<TValue extends k8s.KubernetesObject>(
    group: string,
    version: string,
    plural: string,
  ) {
    const informer = this.$client.watch<TValue>(group, version, plural);

    informer.on(
      'connect',
      this.$events.emit.bind(
        this.$events,
        `${WatcherService.getEventsKey(group, version, plural)}:connect`,
      ),
    );
    informer.on(
      'change',
      this.$events.emit.bind(
        this.$events,
        `${WatcherService.getEventsKey(group, version, plural)}:change`,
      ),
    );
    informer.on(
      'add',
      this.$events.emit.bind(
        this.$events,
        `${WatcherService.getEventsKey(group, version, plural)}:add`,
      ),
    );
    informer.on(
      'update',
      this.$events.emit.bind(
        this.$events,
        `${WatcherService.getEventsKey(group, version, plural)}:update`,
      ),
    );
    informer.on(
      'delete',
      this.$events.emit.bind(
        this.$events,
        `${WatcherService.getEventsKey(group, version, plural)}:delete`,
      ),
    );

    await informer.start();
    return informer;
  }
}
