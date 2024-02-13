import { Injectable } from '@nestjs/common';
import { ClientService } from './client.service';
import k8s from '@kubernetes/client-node';

@Injectable()
export class ResourceService {
  constructor(private readonly $client: ClientService) {}

  async listNamespaces() {
    const res = await this.$client.api(k8s.CoreV1Api).listNamespace();
    return res.body.items;
  }

  async getNamespace(name: string) {
    const res = await this.$client.api(k8s.CoreV1Api).readNamespace(name);
    return res.body;
  }

  async list(apiVersion: string, kind: string, namespace?: string) {
    const res = await this.$client
      .api(k8s.KubernetesObjectApi)
      .list(apiVersion, kind, namespace);
    return res.body.items;
  }

  async listCRDs() {
    const res = await this.$client
      .api(k8s.ApiextensionsV1Api)
      .listCustomResourceDefinition();
    return res.body.items;
  }

  async listAPIs() {
    const res = await this.$client.api(k8s.ApisApi).getAPIVersions();
    return res.body;
  }
}
