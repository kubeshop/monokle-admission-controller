<p align="center">
  <img src="docs/images/large-icon-256.png" alt="Monokle Logo" width="128" height="128"/>
</p>

<p align="center">
  <a href="https://monokle.io">Website</a> |
  <a href="https://discord.com/invite/6zupCZFQbe">Discord</a> |
  <a href="https://monokle.io/blog">Blog</a>
</p>

<p align="center">🧐 <strong>Monokle Admission Controller</strong> is an in-cluster policy enforcement tool with various build-in policy plugins (for <strong>PSS</strong>, <strong>NSA</strong> and <strong>CIS</strong> security frameworks) and integrated with Monokle ecosystem.</p>

<p align="center">
  <a href="https://github.com/kubeshop/monokle-admission-controller/releases/latest">
    <img src="https://img.shields.io/github/v/release/kubeshop/monokle-admission-controller" alt="Latest Release" />
  </a>
  <a href="https://github.com/kubeshop/monokle-admission-controller/actions/workflows/test.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/kubeshop/monokle-admission-controller/test.yml" />
  </a>
  <a href="https://github.com/kubeshop/monokle-admission-controller">
    <img src="https://img.shields.io/badge/License-MIT-green.svg" />
  </a>
</p>

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
  - [MonoklePolicy](#monoklepolicy)
  - [MonoklePolicyBinding](#monoklepolicybinding)
  - [Usage examples](#usage-examples)
    - [Global policy](#global-policy)
    - [Namespaced policy](#namespaced-policy)
  - [Customizing Helm deployment](#customizing-helm-deployment)
- [Architecture](architecture)
- [Contributing](#contributing-and-development)

## Overview

Monokle Admission Controller allows to validate in-cluster resources during their lifecycle events (`create` and `update`). It is based on native Kuberentes [Admission Controlers](https://kubernetes.io/blog/2019/03/21/a-guide-to-kubernetes-admission-controllers/) mechanism and allows defining policies through dedicated CRDs. During resource creation or update it will show warnings related to all policy violations.

It comes with validation engine supporting number of plugins to provide you with comprehensive validation possibilities for K8s resources out of the box:

- **Pod Security Standards** - validation for secure deployments.
- **Kubernetes Schema** - validation to ensure your resource are compliant with their schemas and a target K8s version.
- **Metadata** - validation for standard and custom labels/annotations.
- **Common practices** - validation for basic configuration sanity.
- **Security policies** - based on OPA (Open Policy Agent) to reduce your attack surface.
- **YAML Syntax** - validates that your manifests have correct YAML syntax.

Learn more about each Core Plugin in the [Core Plugins Documentation](docs/core-plugins.md).

## Installation

Installing Monokle Admission Controller creates dedicated `monokle-admission-controller` namespace where all the namespaced resources are then deployed.

You can see all deployed resources with e.g. `kubectl`:

```bash
kubectl -n monokle-admission-controller get all,CustomResourceDefinition,ValidatingWebhookConfiguration,secrets
```

### Helm

Latest Monokle Admission controller can be installed directly from DockerHub OCI registry:

```bash
helm install my-release oci://registry-1.docker.io/kubeshop/monokle-admission-controller
```

_You can read more about DockerHub OCI registry [here](https://docs.docker.com/docker-hub/oci-artifacts/)_.

Or rom GitHub release:

```bash
helm install my-release https://github.com/kubeshop/monokle-admission-controller/releases/download/v0.1.0/helm.tgz
```

> See [customization section](#customizing-helm-deployment) below on what can be customized with Helm variables.

### Kubectl

You can install Monokle Admission Controller using `kubectl` and dedicated install manifest:

```bash
kubectl apply -f https://github.com/kubeshop/monokle-admission-controller/releases/download/v0.1.0/install.yaml
```

## Usage

As a first step, Monokle Admission Controller needs to be deployed to your cluster (see [Installation](#installation) section above).

Monokle Admission Controller introduces 2 dedicated kinds - `MonoklePolicy` and `MonoklePolicyBinding`.

### MonoklePolicy

The `MonoklePolicy` kind is a policy definition. It contains only the definition with list of plugins and rules enabled and additional settings. If you are familiar with Monokle Ecosystem, this is the exact same policy format as Monokle [Desktop](https://github.com/kubeshop/monokle), [Cloud](https://app.monokle.com/), [CLI](https://github.com/kubeshop/monokle-cli) and other tools use.

The basic `.yaml` policy definition looks like:

```yaml
plugins:
  yaml-syntax: true
  open-policy-agent: true
  kubernetes-schema: true
  annotations: true
```

While `MonoklePolicy` manifest would be:

```yaml
apiVersion: monokle.io/v1alpha1
kind: MonoklePolicy
metadata:
  name: my-policy
spec:
  plugins:
    yaml-syntax: true
    open-policy-agent: true
    kubernetes-schema: true
    annotations: true
```

### MonoklePolicyBinding

The `MonoklePolicyBinding` defines to what namespaces, given `MonoklePolicy` should be applied. It can be bound globally (no namespace), meaning all namespaced and cluster-wide resources will be validated. Or to just a single namespace.

```yaml
apiVersion: monokle.io/v1alpha1
kind: MonoklePolicyBinding
metadata:
  name: my-policy-binding
spec:
  policyName: my-policy
  validationActions: [Warn]
  matchResources:
    namespaceSelector:
      matchLabels:
        namespace: default
```

The `policyName` field refers to `MonoklePolicy` resource name, while `matchResources` is optional and can be used to narrow binding scope to specific namespace.

The `validationActions` support only `Warn` at this stage, which means "send a warning for every policy violation detected". In the upcoming versions it will be expanded to more actions like - `Ignore`, `Report` and `Deny` (see [#10](https://github.com/kubeshop/monokle-admission-controller/issues/10)).

### Usage examples

There is a [examples](./examples/) folder provided in this repository where you can see example policies and bindings resources which can be used to test Monokle Admission Controller.

#### Global policy

Global policy means the one not bound to any namespace. It will be applied to resources in all namespaces and those cluster-wide.

Start with policy definition, `my-policy.yaml`:

```yaml
apiVersion: monokle.io/v1alpha1
kind: MonoklePolicy
metadata:
  name: my-policy
spec:
  plugins:
    yaml-syntax: true
    open-policy-agent: true
    kubernetes-schema: true
    annotations: true
```

Can be deployed with e.g. `kubectl`:

```bash
kubectl apply -f my-policy.yaml
```

And then bound it globally with `my-policy-binding.yaml`:

```yaml
apiVersion: monokle.io/v1alpha1
kind: MonoklePolicyBinding
metadata:
  name: my-policy-binding
spec:
  policyName: my-policy
  validationActions: [Warn]
```

```bash
kubectl apply -f my-policy-binding.yaml
```

At this stage `my-policy` is bound and Monokle Admission Controller knows that any resource (while being created or updated) should be validated with it.

For example, deploying sample resource like:

```bash
kubectl apply -f examples/pod-warning.yaml -n sample-namespace
```

Should result in similar output as below:

```bash
Warning: Monokle Admission Controller found 3 errors and 8 warnings:
Warning: KSV011 (error): Require the CPU to be limited on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV016 (error): Require the memory to be requested on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV018 (error): Require the memory to be limited on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV001 (warning): Disallow the process from elevating its privileges on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV003 (warning): Require default capabilities to be dropped on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV012 (warning): Requires the container to runs as non root user on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV013 (warning): Disallow images with the latest tag on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV014 (warning): Require a read-only root file system on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV015 (warning): Require the CPU to be requested on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV020 (warning): Disallow running with a low user ID on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV021 (warning): Disallow running with a low group ID on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: You can use Monokle Cloud (https://monokle.io/) to fix those errors easily.
pod/pod-warning created
```

#### Namespaced policy

Namespaced policy is bound to specific namespace. This means only resources created or updated in this namespace will be validated with it.

Start with policy definition, `my-policy.yaml`:

```yaml
apiVersion: monokle.io/v1alpha1
kind: MonoklePolicy
metadata:
  name: my-policy
spec:
  plugins:
    yaml-syntax: true
    open-policy-agent: true
    kubernetes-schema: true
    annotations: true
```

Can be deployed with e.g. `kubectl`:

```bash
kubectl apply -f my-policy.yaml
```

And then bound it namespace of your choice with `my-policy-binding.yaml`:

```yaml
apiVersion: monokle.io/v1alpha1
kind: MonoklePolicyBinding
metadata:
  name: my-policy-binding
spec:
  policyName: my-policy
  validationActions: [Warn]
  matchResources:
    namespaceSelector:
      matchLabels:
        namespace: my-namespace
```

```bash
kubectl apply -f my-policy-binding.yaml
```

At this stage `my-policy` is bound and Monokle Admission Controller knows that any resource in `my-namespace` namespace (while being created or updated) should be validated with it.

For example, deploying sample resource like:

```bash
kubectl apply -f examples/pod-warning.yaml -n my-namespace
```

Should result in similar output as below:

```bash
Warning: Monokle Admission Controller found 3 errors and 8 warnings:
Warning: KSV011 (error): Require the CPU to be limited on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV016 (error): Require the memory to be requested on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV018 (error): Require the memory to be limited on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV001 (warning): Disallow the process from elevating its privileges on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV003 (warning): Require default capabilities to be dropped on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV012 (warning): Requires the container to runs as non root user on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV013 (warning): Disallow images with the latest tag on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV014 (warning): Require a read-only root file system on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV015 (warning): Require the CPU to be requested on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV020 (warning): Disallow running with a low user ID on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV021 (warning): Disallow running with a low group ID on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: You can use Monokle Cloud (https://monokle.io/) to fix those errors easily.
pod/pod-warning created
```

While deploying to a different one:

```bash
kubectl apply -f examples/pod-warning.yaml -n other-namespace
```

Will be ignored by Monokle Admission Controller:

```bash
pod/pod-warning created
```

### Customizing Helm deployment

You can refer to [`helm/values.yaml`](./helm/values.yaml) file to see what can be change for Helm deployment. The most important values:

* `namespace` - namespace to which Monokle Admission Controller will be deployed (defaults to `monokle-admission-controller`). We advise to always deploy it to dedicated namespace.
* `ignoreNamespaces` - list of namespaces which should be ignored by admission controller (this option has priority over policy bindings). By default. Kubernetes system namespaces and Monokle Admission Controller namespace are ignored.
* `replicas` - number of admission controller pod server replicas.
* `image` - admission controller container images related configuration. Allows to use of specific image or tag. However, since image versions are tightly bound with Helm chart version, we do not advise changing this one.

## Contributing and development

This is an open source project and we would love to hear yur feedback and suggestions!

Feel free to drop us any questions on [Monokle Discord server](https://discord.com/invite/6zupCZFQbe). If you found a bug or would like to request a new feature, report it as [GitHub issue](https://github.com/kubeshop/monokle-admission-controller/issues/new/choose).

We are happy to help and assist you in case of any doubts or questions.

For contributing code and development workflow see [CONTRIBUTING.md](CONTRIBUTING.md).
