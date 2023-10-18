<p align="center">
  <img src="docs/images/large-icon-256.png" alt="Monokle Logo" width="128" height="128"/>
</p>

<p align="center">
  <a href="https://monokle.io">Website</a> |
  <a href="https://discord.com/invite/6zupCZFQbe">Discord</a> |
  <a href="https://monokle.io/blog">Blog</a>
</p>

<p align="center">🧐 Monokle Admission Controller is an in-cluster policy enforcement tool with various build-in policy plugins (for `PSS`, `NSA` and `CIS` security frameworks) and integrated with Monokle ecosystem.</p>

<p align="center">
  <a href="https://github.com/kubeshop/monokle-admission-controller/releases/latest">
    <img src="https://img.shields.io/github/v/release/kubeshop/monokle-admission-controller" alt="Latest Release" />
  </a>
  <a href="https://github.com/kubeshop/monokle-admission-controller/actions/workflows/check.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/kubeshop/monokle-admission-controller/test.yml" />
  </a>
  <a href="https://github.com/kubeshop/monokle-admission-controller">
    <img src="https://img.shields.io/badge/License-MIT-green.svg" />
  </a>
</p>

# Welcome to Monokle Admission Controller

Monokle Admission Controller is an admission controller for validating resources in the cluster.

## Installation

### Helm

From DockerHub:

```bash
helm install <release_name> oci://registry-1.docker.io/kubeshop/monokle-admission-controller --version 0.0.2
```

You can read more about DockerHub OCI registry [here](https://docs.docker.com/docker-hub/oci-artifacts/).

Or directly from GitHub release:

```bash
helm install <release_name> https://github.com/kubeshop/monokle-admission-controller/releases/download/v0.0.2/helm.tgz
```

### Kubectl

You can install Monokle Admission Controller using hosted install file:

```bash
kubectl apply -f https://github.com/kubeshop/monokle-admission-controller/releases/download/{RELEASE}/install.yaml
```

## Contributing and development

See [CONTRIBUTING.md](CONTRIBUTING.md).
