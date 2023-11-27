#!/bin/bash
#
# Sets up environment for admission controller webhook in the active cluster. Use for development/testing only.

set -euo pipefail

basedir="$(dirname "$0")"
cloudApiUrl="$1"
automationToken="$2"
namespace="$3"

# Generate install.yaml
#
# For local testing:
# cloudApiUrl=host.docker.internal:5000 // When running minikube via Docker Desktop (e.g. WSL).
# cloudApiUrl=host.minikube.internal:5000 // All other usages.
helm template "${basedir}/../helm" \
--set image.init.overridePath=admission-webhook-init \
--set image.server.overridePath=admission-webhook \
--set image.synchronizer.overridePath=admission-synchronizer \
--set logLevel=debug \
--set cloudApiUrl=$cloudApiUrl \
--set automationToken=$automationToken > "${basedir}/install.yaml" \
--namespace "$namespace"

# Create namespace
kubectl create ns "$namespace"

# Run development through skaffold with locally build images
skaffold dev -f "${basedir}/skaffold.yaml"
