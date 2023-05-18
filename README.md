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

After it runs, the result should be:

```bash

```

### Testing

You can try to create sample resource and see webhook response:

```bash
cd admission-controller-webhook-demo
kubectl -n webhook-demo create -f examples/pod-with-conflict.yaml
```

## Refs

* https://kubernetes.io/blog/2019/03/21/a-guide-to-kubernetes-admission-controllers/
* https://github.com/stackrox/admission-controller-webhook-demo/tree/master
* https://www.witodelnat.eu/blog/2021/local-kubernetes-development
* https://minikube.sigs.k8s.io/docs/tutorials/using_psp/