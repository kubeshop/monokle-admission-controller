#!/bin/bash
#
# Sets up environment for admission controller webhook in the active cluster. Use for development/testing only.

set -euo pipefail

basedir="$(dirname "$0")"
namespace="$1"

# Generate install.yaml
helm template "${basedir}/../helm" \
--set image.init.overridePath=admission-webhook-init \
--set image.server.overridePath=admission-webhook \
--set logLevel=debug > "${basedir}/install.yaml" \
--namespace "$namespace"

# Create namespace
kubectl create ns "$namespace"

# Run development through skaffold with locally build images
skaffold dev -f "${basedir}/skaffold.yaml"
