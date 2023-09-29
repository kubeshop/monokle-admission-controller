#!/usr/bin/env bash

# Copyright (c) 2019 StackRox Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# deploy.sh
#
# Sets up the environment for the admission controller webhook demo in the active cluster.

set -euo pipefail

basedir="$(dirname "$0")"
keydir="$(mktemp -d)"
templdir="${basedir}/../k8s/templates"
resdir="${basedir}/../k8s/manifests"

# Generate keys into a temporary directory.
echo "Generating TLS keys ..."
"${basedir}/generate-keys.sh" "$keydir"

# Create the `webhook-demo` namespace. This cannot be part of the YAML file as we first need to create the TLS secret,
# which would fail otherwise.
echo "Creating Kubernetes objects ..."
kubectl create namespace webhook-demo

# Create the TLS secret for the generated keys.
kubectl -n webhook-demo create secret tls webhook-server-tls \
   --cert "${keydir}/webhook-server-tls.crt" \
   --key "${keydir}/webhook-server-tls.key"

rm -f "${resdir}/webhook.yaml" "${resdir}/deployment.yaml"

# Read the PEM-encoded CA certificate, base64 encode it, and replace the `${CA_PEM_B64}` placeholder in the YAML
# template with it. Then, create the Kubernetes resources.
ca_pem_b64="$(openssl base64 -A <"${keydir}/ca.crt")"
sed -e 's@${CA_PEM_B64}@'"$ca_pem_b64"'@g' <"${templdir}/webhook.yaml.template" > "${resdir}/webhook.yaml"
cp "${templdir}/deployment.yaml.template" "${resdir}/deployment.yaml"

# Cluster-wide
kubectl apply -f "${resdir}/monokle-policy-crd.yaml"
kubectl apply -f "${resdir}/monokle-policy-binding-crd.yaml"

# Namespaced
kubectl apply -f "${resdir}/service-account.yaml" -n webhook-demo

skaffold run -n webhook-demo -f k8s/skaffold.yaml
# kubectl apply -f deployment.yaml
sleep 2
# kubectl apply -f "${resdir}/monokle-policy-crd.yaml"
# kubectl apply -f "${resdir}/monokle-policy-binding-crd.yaml"
# kubectl apply -f "${resdir}/service-account.yaml"
kubectl apply -f "${resdir}/webhook.yaml"

# Delete the key directory to prevent abuse (DO NOT USE THESE KEYS ANYWHERE ELSE).
rm -rf "$keydir"

echo "The webhook server has been deployed and configured!"
