import pino from 'pino';
import k8s, { V1Namespace } from '@kubernetes/client-node';

export class NamespaceGetter {
  private _k8sApi: k8s.CoreV1Api;

  constructor(
    private readonly _logger: ReturnType<typeof pino>,
  ) {
    const kc = new k8s.KubeConfig();
    kc.loadFromCluster();

    this._k8sApi = kc.makeApiClient(k8s.CoreV1Api);
  }

  async getNamespace(name: string): Promise<V1Namespace | undefined> {
    try {
      const result = await this._k8sApi.readNamespace(name);
      return result.body;
    } catch (err: any) {
      this._logger.error({msg: 'NamespaceGetter: Failed to get namespace', name, err});
      return undefined;
    }
  }
}
