<p align="center">
  <img src="docs/images/large-icon-256.png" alt="Monokle Logo" width="128" height="128"/>
</p>

<p align="center">
  <a href="https://monokle.io">Website</a> |
  <a href="https://discord.com/invite/6zupCZFQbe">Discord</a> |
  <a href="https://monokle.io/blog">Blog</a>
</p>

<p align="center">🧐 <strong>Monokle Admission Controller</strong> is an in-cluster policy enforcement tool with various build-in policy plugins (for <strong>PSS</strong>, <strong>NSA</strong> and <strong>CIS</strong> security frameworks) and integrated with Monokle ecosystem enabling <strong>centralized policy management and enforcement</strong>.</p>

<p align="center">
  <a href="https://github.com/kubeshop/monokle-admission-controller/releases/latest">
    <img src="https://img.shields.io/github/v/release/kubeshop/monokle-admission-controller" alt="Latest Release" />
  </a>
  <a href="https://github.com/kubeshop/monokle-admission-controller/actions/workflows/test.yaml">
    <img src="https://img.shields.io/github/actions/workflow/status/kubeshop/monokle-admission-controller/test.yaml" />
  </a>
  <a href="https://github.com/kubeshop/monokle-admission-controller">
    <img src="https://img.shields.io/badge/License-MIT-green.svg" />
  </a>
</p>

> **IMPORTANT**: This is alpha version and may include breaking changes in the future which will require updating.

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
  - [With Cloud Sync](#with-cloud-sync)
  - [Standalone](#standalone)
- [Usage](#usage)
  - [Monokle Cloud](#monokle-cloud)
    - [Getting Automation Token](#getting-automation-token)
    - [Managing Policies synchronization](#managing-policies-synchronization)
  - [Standalone Configuration](#standalone-configuration)
    - [Defining Global policy](#defining-global-policy)
    - [Defining Namespaced policy](#defining-namespaced-policy)
- [Policies](#policies)
  - [MonoklePolicy](#monoklepolicy)
  - [MonoklePolicyBinding](#monoklepolicybinding)
- [Customizing Helm deployment](#customizing-helm-deployment)
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

Learn more about each Core Plugin in the [Core Plugins Documentation](https://github.com/kubeshop/monokle-core/blob/main/packages/validation/docs/core-plugins.md).

## Installation

Installing Monokle Admission Controller bunch of resources so it is recommended to install it to separate namespace. This can be done with `-n namespace` flag for Helm. For `install-*.yaml` scripts, it will be installed to **monokle** namespace which needs to be created before running install script.

You can see all deployed resources with e.g. `kubectl`:

```bash
kubectl -n monokle get all,CustomResourceDefinition,ValidatingWebhookConfiguration,secrets
```

### With Cloud Sync

Monokle Admission Controller can be installed with Monokle Cloud synchronization enabled. Such setup allows to manage policies in the cluster from the cloud. With integration with the rest of Monokle ecosystem - Monokle [Desktop](https://github.com/kubeshop/monokle), [VSCode extension](https://github.com/kubeshop/vscode-monokle) and [CLI](https://github.com/kubeshop/monokle-cli), it allows for **centralized policy enforcement** for your project. This is recommended use which brings full potential of Monokle Ecosystem into your project lifecycle.

The only required configuration is an Automation Token which can be generated in Monokle Cloud (see how to generate it in Monokle Cloud in [Monokle Cloud section](#getting-automation-token) below).

#### Helm

Latest Monokle Admission controller can be installed directly from DockerHub OCI registry:

```bash
helm install my-release oci://registry-1.docker.io/kubeshop/monokle-admission-controller --set automationToken=YOUR_AUTOMATION_TOKEN -n monokle
```

_You can read more about DockerHub OCI registry [here](https://docs.docker.com/docker-hub/oci-artifacts/)_.

Or from GitHub release:

```bash
helm install my-release https://github.com/kubeshop/monokle-admission-controller/releases/download/v0.2.7/helm.tgz --set automationToken=YOUR_AUTOMATION_TOKEN -n monokle
```

> **Tip**: To create namespace automatically as part of `helm install`, use `--create-namespace` flag.

> See [customization section](#customizing-helm-deployment) below on what can be customized with Helm variables.

#### Kubectl

You can install Monokle Admission Controller using `kubectl` and dedicated cloud install manifest:

```bash
kubectl create ns monokle && \
kubectl apply -f https://github.com/kubeshop/monokle-admission-controller/releases/download/v0.2.7/install-cloud.yaml
```

Since Monokle Cloud automation token needs to be provided, there is a dedicated secret created which needs to be updated:

```bash
kubectl patch secret monokle-synchronizer-token -p "{ \"data\": { \".token\": \"${YOUR_AUTOMATION_TOKEN_BASE64}\" } }" -n monokle-admission-controller
```

### Standalone

#### Helm

Latest Monokle Admission controller can be installed directly from DockerHub OCI registry:

```bash
helm install my-release oci://registry-1.docker.io/kubeshop/monokle-admission-controller -n monokle
```

_You can read more about DockerHub OCI registry [here](https://docs.docker.com/docker-hub/oci-artifacts/)_.

Or from GitHub release:

```bash
helm install my-release https://github.com/kubeshop/monokle-admission-controller/releases/download/v0.2.7/helm.tgz -n monokle
```

> **Tip**: To create namespace automatically as part of `helm install`, use `--create-namespace` flag.

> See [customization section](#customizing-helm-deployment) below on what can be customized with Helm variables.

#### Kubectl

You can install Monokle Admission Controller using `kubectl` and dedicated standalone install manifest:

```bash
kubectl create ns monokle && \
kubectl apply -f https://github.com/kubeshop/monokle-admission-controller/releases/download/v0.2.7/install-standalone.yaml
```

## Usage

As a first step, Monokle Admission Controller needs to be deployed to your cluster (see [Installation](#installation) section above).

### Monokle Cloud

You can manage policies and bindings directly from Monokle Cloud. It allows you to define multiple policies and bind them to specific namespaces. The list of available namespaces (apart from ignored ones) will be synced to cloud for ease of use.

#### Getting Automation Token

Monokle Admission Controller requires Automation Token to sync with Monokle Cloud. In order to obtain one:

1. Login or sign-up to [Monokle Cloud](https://app.monokle.com).
2. Go to [Workspaces](https://app.monokle.com/dashboard/workspaces) and select a Workspace to assign cluster to.
3. You will find `Clusters` tab in the Workspace menu, after navigating there use `Add Cluster` button.
4. Fill-in name and optional description and press `Create`.
5. After creation you will get Automation Token and full command to deploy Monokle Admission Controller to your cluster (refer to [Installation](#installation) section in case of any doubts).

Soon after Monokle Admission Controller is deployed, you should see Cluster status as `Connected` in Workspace `Clusters` list.

#### Managing Policies synchronization

Policies can be added to specific cluster namespaces from withing Cluster view:

1. Navigate to your Workspace and then `Clusters` tab.
2. Click on a Cluster which you want to work with.
3. After navigating to a Cluster Overview, you can see list of all namespaces.
4. On this list, policies can be assigned to any namespaces using `+` button next to them.

Policies are defined on project level - each project can define single policy. If you don't have any projects yet, navigate to [Projects](https://app.monokle.com/dashboard/projects) to create one and then define policy via `Policy` tab.

Policies should be synchronized to the cluster within couple of minutes. You can verify by checking if policy resources are already in the cluster:

```bash
kubectl get policies,policybindings
```

And then when any resource is created or updated and violates specific policy, it can be seen in command output, for example:

```bash
kubectl apply -f examples/pod-warning.yaml -n sample-namespace
```

```bash
Warning: Monokle Admission Controller found 3 errors and 3 warnings:
Warning: KSV011 (error): Require the CPU to be limited on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV016 (error): Require the memory to be requested on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV018 (error): Require the memory to be limited on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV001 (warning): Disallow the process from elevating its privileges on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV003 (warning): Require default capabilities to be dropped on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: KSV012 (warning): Requires the container to runs as non root user on container "busybox", in kind "Pod" with name "pod-warning/default/pod".
Warning: You can use Monokle Cloud (https://monokle.io/) to fix those errors easily.
pod/pod-warning created
```

### Standalone Configuration

Standalone deployment requires policies to be defined and deployed manually. You can read more about Policy format in [Policies section](#policies) below.

There is a [examples](./examples/) folder provided in this repository where you can see example policies and bindings resources which can be used to test Monokle Admission Controller.

#### Defining Global policy

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

#### Defining Namespaced policy

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

## Policies

Monokle Admission Controller introduces 2 dedicated kinds through CRDs - `MonoklePolicy` and `MonoklePolicyBinding`.

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

The `MonoklePolicyBinding` defines to what namespaces, given `MonoklePolicy` should be applied.

It can be bound globally (no namespace), meaning all namespaced and cluster-wide resources will be validated:

```yaml
apiVersion: monokle.io/v1alpha1
kind: MonoklePolicyBinding
metadata:
  name: my-policy-binding
spec:
  policyName: my-policy
  validationActions: [Warn]
```

To a single namespace:

```yaml
apiVersion: monokle.io/v1alpha1
kind: MonoklePolicyBinding
metadata:
  name: my-policy-binding
spec:
  policyName: my-policy
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        name: default
```

To a list of namespaces:

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
      matchExpressions:
        - key: name
          operator: In
          values: [ns-dev, ns-stage]
```

Or as exclusion, meaning "apply to all other namespaces than the ones listed":

```yaml
apiVersion: monokle.io/v1alpha1
kind: MonoklePolicyBinding
metadata:
  name: my-policy-binding
spec:
  policyName: my-policy
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchExpressions:
        - key: name
          operator: NotIn
          values: [ns-prod]
```

The `policyName` field refers to `MonoklePolicy` resource name, while `matchResources` is optional and can be used to narrow binding scope to specific namespace. If follows the same convention as in other Kubernetes kinds, supporting `namespaceSelector` with `matchLabels` and `matchExpressions`.

The `validationActions` supports `Warn` and `Deny` actions at this stage. `Warn` means "send a warning for every policy violation detected" and `Deny` will block resource creation/update when there are any violations. In the upcoming versions it will be expanded to more actions like - `Ignore` and `Report` (see [#10](https://github.com/kubeshop/monokle-admission-controller/issues/10)).

## Customizing Helm deployment

You can refer to [`helm/values.yaml`](./helm/values.yaml) file to see what can be change for Helm deployment. The most important values:

* `ignoreNamespaces` - list of namespaces which should be ignored by admission controller (this option has priority over policy bindings and Cloud sync). By default Kubernetes system namespaces and Monokle Admission Controller namespace are ignored.
* `replicas` - number of admission controller pod server replicas.
* `automationToken` - Monokle Cloud automation token to enable syncing with the cloud.
* `image` - admission controller container images related configuration. Allows the use of specific image or tag. However, since image versions are tightly bound with Helm chart version, we do not advise changing this one for production deployments.
* `logLevel` - internal logging level. Supported values: `error`, `warn`, `info`, `debug`, `trace` or `silent`. Useful for debugging.

## Contributing and development

This is an open source project and we would love to hear your feedback and suggestions!

Feel free to drop us any questions on [Monokle Discord server](https://discord.com/invite/6zupCZFQbe). If you found a bug or would like to request a new feature, report it as [GitHub issue](https://github.com/kubeshop/monokle-admission-controller/issues/new/choose).

We are happy to help and assist you in case of any doubts or questions.

For contributing code and development workflow see [CONTRIBUTING.md](CONTRIBUTING.md).
