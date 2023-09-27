# Monokle Admission Controller

Monokle Admission Controller is an admission controller for validating resources in the cluster.

## Development

### Prerequisites

* Minikube (or any other K8s cluster running)
* kubectl
* Skaffold
* nodejs

### Running

#### Minikube

Start Minikube:

```bash
minikube start --uuid 00000000-0000-0000-0000-000000000001 --extra-config=apiserver.enable-admission-plugins=ValidatingAdmissionWebhook
```

#### Deploying

```bash
./scripts/deploy.sh
```

Every resource will be deployed to `webhook-demo` namespace, to watch it you can run:

```bash
watch kubectl -n webhook-demo get all,CustomResourceDefinition,ValidatingWebhookConfiguration,MutatingWebhookConfiguration
```

After it runs, the result should be something like:

```bash
NAME                                  READY   STATUS    RESTARTS   AGE
pod/webhook-server-677556956c-f7hcq   1/1     Running   0          3m54s

NAME                     TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
service/webhook-server   ClusterIP   10.105.249.5   <none>        443/TCP   3m54s

NAME                             READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/webhook-server   1/1     1            1           3m54s

NAME                                        DESIRED   CURRENT   READY   AGE
replicaset.apps/webhook-server-677556956c   1         1         1       3m54s

NAME                                                                        CREATED AT
customresourcedefinition.apiextensions.k8s.io/policies.monokle.com   2023-09-27T08:45:13Z

NAME                                                                       WEBHOOKS   AGE
validatingwebhookconfiguration.admissionregistration.k8s.io/demo-webhook   1          3m46s
```

For getting info about CRDs:

```bash
kubectl get crd
kubectl describe crd policies.monokle.com

kubectl get monoklepolicy -n webhook-demo
kubectl describe monoklepolicy policy-sample -n webhook-demo
```

#### Testing

First you need to create policy resource, for example:

```bash
kubectl -n webhook-demo apply -f examples/policy-sample.yaml
```

> Admission controller will still work without policy resource but then it will be like running validation with all plugins disabled.

Then you can try to create sample resource and see webhook response:

```bash
kubectl -n webhook-demo create -f examples/pod-warning.yaml
```

#### Iterating

After everything is running you can allow hot-reload by running:

```bash
skaffold dev -f k8s/skaffold.yaml
```

**Important**: Skaffold will recreate deployment on every change so make sure that webhook pod doesn't get rejected by it's previous version (via Validation Admission Controller).

You can also do manual clean-up and re-run `./deploy.sh` script again:

```bash
kubectl delete all -n webhook-demo --all && \
kubectl delete validatingwebhookconfiguration.admissionregistration.k8s.io/demo-webhook -n webhook-demo && \
kubectl delete namespace webhook-demo && \
kubectl delete crd policies.monokle.com
```

### Refs

* https://kubernetes.io/blog/2019/03/21/a-guide-to-kubernetes-admission-controllers/
* https://github.com/stackrox/admission-controller-webhook-demo/tree/master
* https://www.witodelnat.eu/blog/2021/local-kubernetes-development
* https://minikube.sigs.k8s.io/docs/tutorials/using_psp/
* https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/
* https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/
