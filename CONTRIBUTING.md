# Contributing and development

## Prerequisites

* Minikube (or any other K8s cluster running)
* kubectl
* helm
* Skaffold
* nodejs

## Running

Start Minikube (or any other cluster of your choice):

```bash
minikube start --extra-config=apiserver.enable-admission-plugins=ValidatingAdmissionWebhook
```

### Deploying (via Skaffold)

```bash
./scripts/deploy.sh
```

After changes in `./admission-controller` can be reloaded with:

```bash
skaffold dev -f scripts/skaffold.yaml
```

You can also do manual clean-up and re-run `deploy.sh` script again:

```bash
kubectl delete all -n monokle-admission-controller --all && \
kubectl delete validatingwebhookconfiguration.admissionregistration.k8s.io/monokle-admission-controller-webhook && \
kubectl delete namespace monokle-admission-controller && \
kubectl delete namespace nstest1 && \
kubectl delete namespace nstest2 && \
kubectl delete crd policies.monokle.io && \
kubectl delete crd policybindings.monokle.io
```

### Deploying (via Helm + Minikube registry)

Deploying with helm requires having local docker registry (for locally build images). THis can be done with Minikube:

```bash
eval $(minikube -p minikube docker-env)
```

And then building images:

```bash
cd admission-controller/init
minikube image build -t admission-webhook-init -f ./Dockerfile .

cd admission-controller/server
minikube image build -t admission-webhook -f ./Dockerfile .

docker images
```

```bash
helm install monokle-ac ./helm \
--set image.init.pullPolicy=Never \
--set image.init.overridePath=admission-webhook-init \
--set image.server.pullPolicy=Never \
--set image.server.overridePath=admission-webhook
```

To uninstall:

```bash
helm uninstall monokle-ac
```

### Checking deployment state

Namespaced resources (webhook server) will be deployed to dedicated `monokle-admission-controller` namespace, to watch it you can run:

```bash
watch kubectl -n monokle-admission-controller get all,CustomResourceDefinition,ValidatingWebhookConfiguration,secrets
```

After it runs, the result should be something like:

```bash
NAME                                                       READY   STATUS    RESTARTS   AGE
pod/monokle-admission-controller-server-6958c9bbf8-jvkvk   1/1     Running   0          5m11s

NAME                                          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
service/monokle-admission-controller-server   ClusterIP   10.99.122.106   <none>        443/TCP   5m11s

NAME                                                  READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/monokle-admission-controller-server   1/1     1            1           5m11s

NAME                                                             DESIRED   CURRENT   READY   AGE
replicaset.apps/monokle-admission-controller-server-6958c9bbf8   1         1         1       5m11s

NAME                                                                      CREATED AT
customresourcedefinition.apiextensions.k8s.io/policies.monokle.io         2023-10-12T12:16:04Z
customresourcedefinition.apiextensions.k8s.io/policybindings.monokle.io   2023-10-12T12:16:04Z

NAME                                                                                               WEBHOOKS   AGE
validatingwebhookconfiguration.admissionregistration.k8s.io/monokle-admission-controller-webhook   1          5m11s

NAME                                      TYPE                                  DATA   AGE
secret/default-token-w56nz                kubernetes.io/service-account-token   3      5m39s
secret/monokle-admission-controller-tls   kubernetes.io/tls                     2      5m1s
secret/monokle-policies-sa-token-fcpld    kubernetes.io/service-account-token   3      5m49s
```

For getting info about CRDs:

```bash
kubectl get crd
kubectl describe crd policies.monokle.io
kubectl describe crd policybindings.monokle.io
```

#### Init container logs

The `monokle-admission-controller-server` has one init container which is responsible for certificate creation/renewal and propagation into cluster. Logs from it can be viewed with:

```bash
kubectl -n monokle-admission-controller logs pod/monokle-admission-controller-server-... -c init
```

## Testing

Create test namespaces first:

```bash
kubectl create namespace nstest1
kubectl create namespace nstest2
```

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

## Refs

* https://kubernetes.io/blog/2019/03/21/a-guide-to-kubernetes-admission-controllers/
* https://github.com/stackrox/admission-controller-webhook-demo/tree/master
* https://www.witodelnat.eu/blog/2021/local-kubernetes-development
* https://minikube.sigs.k8s.io/docs/tutorials/using_psp/
* https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/
* https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/
* https://kubernetes.io/docs/concepts/workloads/pods/init-containers/
* https://kubernetes-client.github.io/javascript/index.html
* https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/
