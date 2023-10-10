import k8s from '@kubernetes/client-node';
import forge from 'node-forge';

// -----
// Read cert from secret
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

k8sApi.listNamespacedSecret('monokle-admission-controller').then((res) => {
    const body = res.body;// as k8s.V1SecretList;

    body.items.forEach((item) => {
        // console.log(item.metadata);
        // console.log(item.data);

        if (item.data?.['tls.crt']) {
            console.log(item.data['tls.crt']);
            console.log(Buffer.from(item.data['tls.crt'], 'base64').toString('utf8'))

            const crt = forge.pki.certificateFromPem(Buffer.from(item.data['tls.crt'], 'base64').toString('utf8'));
            console.log(crt);

            console.log(crt.validity);
        }
    });
});

// -----
// Write cert to secret
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

k8sApi.createNamespacedSecret('monokle-admission-controller', {
    apiVersion: 'v1',
    kind: 'Secret',
    type: 'kubernetes.io/tls',
    metadata: {
        name: 'monokle-webhook-server-cert',
    },
    data: {
        'tls.crt': Buffer.from('test').toString('base64'),
        'tls.key': Buffer.from('test').toString('base64'),
    },
}).then((res) => {
    console.log(res.body);
});

// -----
// Update 'ValidatingWebhookConfiguration' with new cert
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.AdmissionregistrationV1Api);
const client = k8s.KubernetesObjectApi.makeApiClient(kc);

k8sApi.listValidatingWebhookConfiguration().then((res) => {
    // console.log(res.body);
    // console.log(res.body.items[0].webhooks);

    const wh = res.body.items[0].webhooks;
    wh[0].clientConfig.caBundle = 'test';

    // https://kubernetes.io/docs/tasks/manage-kubernetes-objects/update-api-object-kubectl-patch/
    k8sApi.patchValidatingWebhookConfiguration('demo-webhook', {
        webhooks: wh,
        metadata: {
            labels: {
                'monokle.io/updated': Date.now().toString(),
            },
        }
    },
    undefined, undefined, 'Monokle', undefined, undefined, {
        headers: {
            'Content-Type': 'application/merge-patch+json',
        },
    }).then((res) => {
        console.log(res.body);
        console.log(res.body.webhooks);
    });
});
