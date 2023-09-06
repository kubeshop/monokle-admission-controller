import k8s from '@kubernetes/client-node';
import { Config } from '@monokle/validation';

export type MonoklePolicy = k8s.KubernetesObject & {
  spec: Config
};

export async function getInformer(
  onAdded: k8s.ObjectCallback<MonoklePolicy>,
  onUpdated: k8s.ObjectCallback<MonoklePolicy>,
  onDeleted: k8s.ObjectCallback<MonoklePolicy>,
  namespace = 'default',
  onError?: k8s.ErrorCallback
) {
  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()

  const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi)
  const listFn = () => k8sApi.listNamespacedCustomObject('monokle.com','v1', namespace, 'monoklepolicies');
  const informer = k8s.makeInformer<MonoklePolicy>(kc, `/apis/monokle.com/v1/namespaces/${namespace}/monoklepolicies`, listFn as any);

  informer.on('add', async (obj) => await onAdded(obj));
  informer.on('update', async (obj) => await onUpdated(obj));
  informer.on('delete', async (obj) => await onDeleted(obj));

  informer.on('error', (err) => {
    if (onError) {
      onError(err);
    }

    setTimeout(async () => {
      await informer.start();
    }, 1000);
  });

  await informer.start();

  return informer;
}
