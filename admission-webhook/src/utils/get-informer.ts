import k8s from '@kubernetes/client-node';

export type Informer<TValue extends k8s.KubernetesObject> = k8s.Informer<TValue> & k8s.ObjectCache<TValue>;

export type InformerWrapper<TValue extends k8s.KubernetesObject> = {
  informer: Informer<TValue>,
  start: () => Promise<void>
}

const ERROR_RESTART_INTERVAL = 500;

export async function getInformer<TValue extends k8s.KubernetesObject>(
  group: string, version: string, plural: string, onError?: k8s.ErrorCallback
): Promise<InformerWrapper<TValue>> {
  const informer = await createInformer<TValue>(group, version, plural, onError);
  const start = createInformerStarter(informer, onError);

  return {informer, start}
}

function createInformerStarter(informer: Informer<any>, onError?: k8s.ErrorCallback) { // not sure if can try to start informer multiple times
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

async function createInformer<TValue extends k8s.KubernetesObject>(group: string, version: string, plural: string, onError?: k8s.ErrorCallback) {
  const kc = new k8s.KubeConfig();
  kc.loadFromCluster();

  const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi)
  const listFn = () => k8sApi.listClusterCustomObject(group, version, plural);
  const informer = k8s.makeInformer<TValue>(kc, `/apis/${group}/${version}/${plural}`, listFn as any);

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
