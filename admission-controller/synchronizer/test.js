import k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

const main = async () => {
    try {
        const informer = k8s.makeInformer(kc, `/api/v1/secrets`, () => k8sApi.listNamespacedSecret('monokle-admission-controller'));

        informer.on('add', (obj) => {
            console.log(`Secret ${obj.metadata.name} added`);
        });

        informer.on('update', (obj) => {
            console.log(`Secret ${obj.metadata.name} updated`);
        });

        informer.on('delete', (obj) => {
            console.log(`Secret ${obj.metadata.name} deleted`);
        });

        informer.on('error', (err) => {
            console.error(err);
        });

        await informer.start();

    } catch (err) {
        console.error(err);
    }
};

main();

setInterval(() => {}, 1000);