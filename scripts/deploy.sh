#!/bin/bash
#
# Sets up environment for admission controller webhook in the active cluster. Use for development/testing only.

set -euo pipefail

basedir="$(dirname "$0")"
resdir="${basedir}/../k8s/manifests"

# Create test namespaces
kubectl create namespace nstest1
kubectl create namespace nstest2

# Apply monokle-admission-controller releated resources
kubectl apply -f "${resdir}/namespace.yaml"
kubectl apply -f "${resdir}/monokle-policy-crd.yaml"
kubectl apply -f "${resdir}/monokle-policy-binding-crd.yaml"
kubectl apply -f "${resdir}/service-account.yaml"

# Run deployment through skaffold with locally build images
skaffold run -n monokle-admission-controller -f k8s/skaffold.yaml

echo "The webhook server has been deployed and configured!"
