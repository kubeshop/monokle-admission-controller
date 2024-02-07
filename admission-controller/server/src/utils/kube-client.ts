import k8s, {V1Namespace} from "@kubernetes/client-node";

class KubeClient {
    private static readonly ERROR_RESTART_INTERVAL = 500;

    private readonly kc: k8s.KubeConfig;

    constructor() {
        this.kc = new k8s.KubeConfig();
    }

    buildKubeConfig() {
        try {
            if (process.env.KUBE_CONTEXT) {
                this.kc.loadFromDefault();
                this.kc.setCurrentContext(process.env.KUBE_CONTEXT);
            }
            else {
                this.kc.loadFromCluster();
            }
        } catch (e) {
            console.warn("Failed to load kubeconfig from file");
        }
    }

    async getNamespace(name: string): Promise<V1Namespace | undefined> {
        return this.kc.makeApiClient(k8s.CoreV1Api).readNamespace(name)
            .then(res => res.body)
            .catch(err => {
                // todo: replace with logger
                console.error({msg: 'NamespaceGetter: Failed to get namespace', name, err});
                return undefined;
            })
    }

    private createInformer<TValue extends k8s.KubernetesObject>(group: string, version: string, plural: string, onError?: k8s.ErrorCallback) {
        const listFn = () => this.kc.makeApiClient(k8s.CustomObjectsApi).listClusterCustomObject(group, version, plural);
        const cr = `${group}/${version}/${plural}`;
        const informer = k8s.makeInformer<TValue>(this.kc, `/apis/${cr}`, listFn as any);

        informer.on('error', (err) => {
            if (onError) {
                onError(err);
            }

            setTimeout(async () => {
                await informer.start();
            }, KubeClient.ERROR_RESTART_INTERVAL);
        });

        return informer;
    }

    private startInformer(informer: Informer<any>, onError?: k8s.ErrorCallback) {
        return async () => {
            let tries = 0;
            let started = false;

            while (!started) {
                try {
                    tries++;
                    await informer.start();
                    started = true;
                } catch (err: any) {
                    if (err.statusCode === 404) {
                        console.error(`Not found, CRD might not be installed`);
                    }
                    if (onError) {
                        onError(err);
                    }

                    await new Promise((resolve) => setTimeout(resolve, KubeClient.ERROR_RESTART_INTERVAL));
                }
            }
        }
    }


    async getInformer<TValue extends k8s.KubernetesObject>(
        group: string, version: string, plural: string, onError?: k8s.ErrorCallback
    ): Promise<InformerWrapper<TValue>> {
        const informer = await this.createInformer<TValue>(group, version, plural, onError);
        const start = this.startInformer(informer, onError);

        return {informer, start}
    }
}

export type Informer<TValue extends k8s.KubernetesObject> = k8s.Informer<TValue> & k8s.ObjectCache<TValue>;

export type InformerWrapper<TValue extends k8s.KubernetesObject> = {
    informer: Informer<TValue>,
    start: () => Promise<void>
}

export default new KubeClient();
