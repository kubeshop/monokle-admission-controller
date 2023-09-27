import k8s from '@kubernetes/client-node';
import {Config} from '@monokle/validation';

export type MonoklePolicy = k8s.KubernetesObject & {
  spec: Config
};

const ERROR_RESTART_INTERVAL = 500;

export async function getInformer(
  onAdded: k8s.ObjectCallback<MonoklePolicy>,
  onUpdated: k8s.ObjectCallback<MonoklePolicy>,
  onDeleted: k8s.ObjectCallback<MonoklePolicy>,
  onError?: k8s.ErrorCallback,
) {
  let informer: Awaited<ReturnType<typeof createInformer>> | null = null;

  let tries = 0;
  while (!informer) {
    try {
      tries++;
      informer = await createInformer(onAdded, onUpdated, onDeleted, onError);
      return informer;
    } catch (err: any) {
      if (onError) {
        onError(err);
      }

      await new Promise((resolve) => setTimeout(resolve, ERROR_RESTART_INTERVAL));
    }
  }

  return informer;
}

async function createInformer(
  onAdded: k8s.ObjectCallback<MonoklePolicy>,
  onUpdated: k8s.ObjectCallback<MonoklePolicy>,
  onDeleted: k8s.ObjectCallback<MonoklePolicy>,
  onError?: k8s.ErrorCallback
) {
  const kc = new k8s.KubeConfig();
  kc.loadFromCluster();

  const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi)
  const listFn = () => k8sApi.listClusterCustomObject('monokle.com','v1', 'policies');
  const informer = k8s.makeInformer<MonoklePolicy>(kc, `/apis/monokle.com/v1/policies`, listFn as any);

  informer.on('add', async (obj) => await onAdded(obj));
  informer.on('update', async (obj) => await onUpdated(obj));
  informer.on('delete', async (obj) => await onDeleted(obj));

  informer.on('error', (err) => {
    if (onError) {
      onError(err);
    }

    setTimeout(async () => {
      await informer.start();
    }, ERROR_RESTART_INTERVAL);
  });

  await informer.start();

  return informer;
}
