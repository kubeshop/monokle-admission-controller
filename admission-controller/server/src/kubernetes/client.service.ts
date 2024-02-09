import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import k8s from '@kubernetes/client-node';

@Injectable()
export class ClientService implements OnModuleInit {
  private readonly log = new Logger(ClientService.name);
  private readonly _kubeconfig: k8s.KubeConfig;

  constructor() {
    this._kubeconfig = new k8s.KubeConfig();
  }

  async onModuleInit(): Promise<any> {
    try {
      if (process.env.KUBE_CONTEXT) {
        this._kubeconfig.loadFromDefault();
        this._kubeconfig.setCurrentContext(process.env.KUBE_CONTEXT);
      } else {
        this._kubeconfig.loadFromCluster();
      }
    } catch (e) {
      console.warn('Failed to load kubeconfig from file');
    }

    await this._kubeconfig
      .makeApiClient(k8s.CoreV1Api)
      .listNamespace()
      .then(() => this.log.log(`Connected to k8s Api Server`))
      .catch((err) => {
        throw new Error(`Failed bootstrap check, list namespaces: ${err}`);
      });
  }

  api<T extends k8s.ApiType>(api: new () => T): T {
    return this._kubeconfig.makeApiClient(api);
  }

  watch<TValue extends k8s.KubernetesObject>(
    group: string,
    version: string,
    plural: string,
  ) {
    const cr = `${group}/${version}/${plural}`;
    const api = this.api(k8s.CustomObjectsApi);

    const informer = k8s.makeInformer<TValue>(
      this._kubeconfig,
      `/apis/${cr}`,
      async () => {
        this.log.debug(`Building initial inventory of ${cr}`);
        const result = (await api.listClusterCustomObject(
          group,
          version,
          plural,
        )) as any;
        return result;
      },
    );

    this.log.log(`Watching for changes in ${cr}`);

    informer.on('error', (err) => {
      setTimeout(async () => {
        this.log.warn(err);
        await informer.start();
      }, 500);
    });

    return informer;
  }
}
