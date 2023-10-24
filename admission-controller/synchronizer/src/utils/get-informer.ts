import {IncomingMessage} from 'http';
import k8s from '@kubernetes/client-node';

export type Informer<TValue extends k8s.KubernetesObject> = k8s.Informer<TValue> & k8s.ObjectCache<TValue>;

export type ListFn<TValue extends k8s.KubernetesObject> = () => Promise<{
  response: IncomingMessage;
  body: TValue;
}>;

export type InformerWrapper<TValue extends k8s.KubernetesObject> = {
  informer: Informer<TValue>,
  start: () => Promise<void>,
  stop: () => Promise<void>
}

const ERROR_RESTART_INTERVAL = 500;

export async function getNamespaceInformer(onError?: k8s.ErrorCallback) {
  const client = await getClient();
  return getInformer<k8s.V1Namespace>('api', '', 'v1', 'namespaces', () => client.listNamespace(), onError);
}

export async function getInformer<TValue extends k8s.KubernetesObject>(
  apiPrefix: 'api' | 'apis', group: string, version: string, plural: string, listFn: ListFn<TValue>, onError?: k8s.ErrorCallback
): Promise<InformerWrapper<TValue>> {
  const informer = await createInformer<TValue>(apiPrefix, group, version, plural, listFn, onError);
  const start = createInformerStarter(informer, onError);
  const stop = () => informer.stop();

  return {informer, start, stop}
}

function createInformerStarter(informer: Informer<any>, onError?: k8s.ErrorCallback) {
  return async () => {
    let tries = 0;
    let started = false;

    while (!started) {
      try {
        tries++;
        await informer.start();
        started = true;
      } catch (err: any) {
        if (onError) {
          onError(err);
        }

        await new Promise((resolve) => setTimeout(resolve, ERROR_RESTART_INTERVAL));
      }
    }
  }
}

async function getClient() {
  const kc = new k8s.KubeConfig();
  kc.loadFromCluster();

  return kc.makeApiClient(k8s.CoreV1Api)
}

async function createInformer<TValue extends k8s.KubernetesObject>(
  apiPrefix: 'api' | 'apis',
  group: string,
  version: string,
  plural: string,
  listFn: ListFn<TValue>,
  onError?: k8s.ErrorCallback
) {
  const kc = new k8s.KubeConfig();
  kc.loadFromCluster();

  const informer = k8s.makeInformer<TValue>(kc, `/${apiPrefix}${group ? `/${group}` : ''}/${version}/${plural}`, listFn as any);

  informer.on('error', (err) => {
    if (onError) {
      onError(err);
    }

    setTimeout(async () => {
      await informer.start();
    }, ERROR_RESTART_INTERVAL);
  });

  return informer;
}
