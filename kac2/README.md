# K8s Admission Controller Demo

## Prerequisites

* Minikube (or any other K8s cluster running)
* Skaffold
* nodejs

## Running

### Minikube

```
minikube start --uuid 00000000-0000-0000-0000-000000000001 --extra-config=apiserver.enable-admission-plugins=ValidatingAdmissionWebhook
minikube addons enable ingress
```

### AC service

The assumption is everything will be run in K8s cluster. For that run:

```
skaffold dev
```

Fastify server deployment should be deployed to K8s cluster and available on `localhost:3000`.

### Keys handling

This is already done and visible in files:

```
chmod 777 generate-key.sh
./generate-key.sh secrets
openssl base64 -A <"secrets/ca.crt"
```

This needs to be done for a cluster:

```
kubectl create secret tls webhook-server-tls --cert "secrets/webhook-server-tls.crt" --key "secrets/webhook-server-tls.key"
# list AC webhooks
kubectl get ValidatingWebhookConfiguration
```

### Adding AC

### Testing

## Refs

* https://kubernetes.io/blog/2019/03/21/a-guide-to-kubernetes-admission-controllers/
* https://github.com/stackrox/admission-controller-webhook-demo/tree/master
* https://www.witodelnat.eu/blog/2021/local-kubernetes-development
* https://minikube.sigs.k8s.io/docs/tutorials/using_psp/

---

_Fastify generated README_:

## Getting Started with [Fastify-CLI](https://www.npmjs.com/package/fastify-cli)

This project was bootstrapped with Fastify-CLI.

### Available Scripts

In the project directory, you can run:

#### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

#### `npm start`

For production mode

#### `npm run test`

Run the test cases.

### Learn More

To learn Fastify, check out the [Fastify documentation](https://www.fastify.io/docs/latest/).
