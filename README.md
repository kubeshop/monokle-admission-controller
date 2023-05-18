# K8s Admission Controller Demo

This got a lot of inspiration from https://github.com/stackrox/admission-controller-webhook-demo.

## Prerequisites

* Minikube (or any other K8s cluster running)
* Skaffold
* nodejs

## Running

### Minikube

Start Minikube:

```bash
minikube start --uuid 00000000-0000-0000-0000-000000000001 --extra-config=apiserver.enable-admission-plugins=ValidatingAdmissionWebhook
```

Every resource will be deployed to `webhook-demo` namespace, to watch it you can run:

```bash
watch kubectl -n webhook-demo get all,ValidatingWebhookConfiguration,MutatingWebhookConfiguration
```

### Deploying

```bash
cd admission-controller-webhook-demo
./deploy.sh
```

After it runs, the result should be something like:

```bash
NAME                                  READY   STATUS    RESTARTS   AGE
pod/webhook-server-55dd5d6f44-lwwnw   1/1     Running   0          11s

NAME                     TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
service/webhook-server   ClusterIP   10.96.18.123   <none>        443/TCP   11s

NAME                             READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/webhook-server   1/1     1            1           11s

NAME                                        DESIRED   CURRENT   READY   AGE
replicaset.apps/webhook-server-55dd5d6f44   1         1         1       11s

NAME                                                                       WEBHOOKS   AGE
validatingwebhookconfiguration.admissionregistration.k8s.io/demo-webhook   1          6s
```

### Testing

You can try to create sample resource and see webhook response:

```bash
cd admission-controller-webhook-demo
kubectl -n webhook-demo create -f examples/pod-with-conflict.yaml
```

### Iterating

After everything is running you can allow hot-reload by running:

```bash
skaffold dev --namespace webhook-demo
```

**Important**: Skaffold will recreate deployment on every change so make sure that webhook pod doesn't get rejected by it's previous version (via Validation Admission Controller).

## Refs

* https://kubernetes.io/blog/2019/03/21/a-guide-to-kubernetes-admission-controllers/
* https://github.com/stackrox/admission-controller-webhook-demo/tree/master
* https://www.witodelnat.eu/blog/2021/local-kubernetes-development
* https://minikube.sigs.k8s.io/docs/tutorials/using_psp/