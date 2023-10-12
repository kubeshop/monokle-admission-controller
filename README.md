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

Namespaced resources (webhook server) will be deployed to dedicated `monokle-admission-controller` namespace, to watch it you can run:

```bash
watch kubectl -n monokle-admission-controller get all,CustomResourceDefinition,ValidatingWebhookConfiguration,secrets
```

After it runs, the result should be something like:

```bash
NAME                                  READY   STATUS   RESTARTS      AGE
pod/webhook-server-7cd54c9fcf-wdkdn   0/1     Error    1 (13s ago)   25s

NAME                     TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
service/webhook-server   ClusterIP   10.97.66.194   <none>        443/TCP   25s

NAME                             READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/webhook-server   0/1     1            0           25s

NAME                                        DESIRED   CURRENT   READY   AGE
replicaset.apps/webhook-server-7cd54c9fcf   1         1         0       25s

NAME                                                                       CREATED AT
customresourcedefinition.apiextensions.k8s.io/policies.monokle.com         2023-10-02T12:17:02Z
customresourcedefinition.apiextensions.k8s.io/policybindings.monokle.com   2023-10-02T12:17:02Z

NAME                                                                       WEBHOOKS   AGE
validatingwebhookconfiguration.admissionregistration.k8s.io/demo-webhook   1          17s
```

For getting info about CRDs:

```bash
kubectl get crd
kubectl describe crd policies.monokle.com
kubectl describe crd policybindings.monokle.com
```

#### Testing

First you need to create policy resource, for example:

```bash
kubectl apply -f examples/policy-sample-1.yaml
kubectl apply -f examples/policy-sample-2.yaml
```

Then it needs to be bind to be used for validation. Either without scope (globally to all, but ignored namespaces) or with `matchResource` field:

```bash
kubectl apply -f examples/policy-binding-sample-1.yaml
kubectl apply -f examples/policy-binding-sample-2.yaml
kubectl apply -f examples/policy-binding-sample-3.yaml
```

You can inspect deployed policies with:

```bash
kubectl get policy
kubectl describe policy

kubectl get policybinding
kubectl describe policybinding
```

Then you can try to create sample resource and see webhook response:

```bash
kubectl apply -f examples/pod-valid.yaml
kubectl apply -f examples/pod-warning.yaml
kubectl apply -f examples/pod-errors.yaml
```

#### Iterating

After everything is running you can allow hot-reload by running:

```bash
skaffold dev -f k8s/skaffold.yaml
```

**Important**: Skaffold will recreate deployment on every change so make sure that webhook pod doesn't get rejected by it's previous version (via Validation Admission Controller).

You can also do manual clean-up and re-run `./deploy.sh` script again:

```bash
kubectl delete all -n monokle-admission-controller --all && \
kubectl delete validatingwebhookconfiguration.admissionregistration.k8s.io/demo-webhook -n monokle-admission-controller && \
kubectl delete namespace monokle-admission-controller && \
kubectl delete namespace nstest1 && \
kubectl delete namespace nstest2 && \
kubectl delete crd policies.monokle.com && \
kubectl delete crd policybindings.monokle.com
```

### Refs

* https://kubernetes.io/blog/2019/03/21/a-guide-to-kubernetes-admission-controllers/
* https://github.com/stackrox/admission-controller-webhook-demo/tree/master
* https://www.witodelnat.eu/blog/2021/local-kubernetes-development
* https://minikube.sigs.k8s.io/docs/tutorials/using_psp/
* https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/
* https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/
