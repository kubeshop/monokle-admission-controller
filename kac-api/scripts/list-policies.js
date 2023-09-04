import k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi)
const listFn = () => k8sApi.listNamespacedCustomObject('monokle.com','v1', 'default', 'monoklepolicies');
const informer = k8s.makeInformer(kc, '/apis/monokle.com/v1/namespaces/default/monoklepolicies', listFn);

informer.on('add', (obj) => {
  console.log(`Added:`,  obj);
});

informer.on('update', (obj) => {
  console.log(`Updated:`,  obj);
});

informer.on('delete', (obj) => {
  console.log(`Deleted:`,  obj);
});

informer.on('error', (err) => {
  console.error(err);
  setTimeout(() => {
    console.log('Restarting informer...');
    informer.start();
  }, 5000);
});

informer.start().then(() => {
  console.log('Informer started');
});
