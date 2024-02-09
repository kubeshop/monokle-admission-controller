import { Injectable } from '@nestjs/common';
import { ClientService } from './client.service';
import k8s from '@kubernetes/client-node';

@Injectable()
export class ResourceService {
  constructor(private readonly $client: ClientService) {}

  listNamespaces() {
    return this.$client
      .api(k8s.CoreV1Api)
      .listNamespace()
      .then((res) => res.body.items);
  }

  getNamespace(name: string) {
    return this.$client
      .api(k8s.CoreV1Api)
      .readNamespace(name)
      .then((res) => res.body);
  }
}
