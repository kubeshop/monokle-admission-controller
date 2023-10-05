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
# Sets up the environment for the admission controller webhook in the active cluster. Use only for develoment and testing.

set -euo pipefail

basedir="$(dirname "$0")"
resdir="${basedir}/../k8s/manifests"

echo "--- Creating test namespaces..."
kubectl create namespace nstest1
kubectl create namespace nstest2

echo "--- Deploying cert-manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.1/cert-manager.yaml
sleep 45 # Wait for cert-manager to be ready

echo "--- Deploying Monokle Admission Controller resources..."
kubectl apply -f "${resdir}/namespace.yaml"
kubectl apply -f "${resdir}/monokle-policy-crd.yaml"
kubectl apply -f "${resdir}/monokle-policy-binding-crd.yaml"
kubectl apply -f "${resdir}/certificate.yaml"
kubectl apply -f "${resdir}/service-account.yaml"

echo "--- Deploying Monokle Admission Controller..."
skaffold run -n monokle-admission-controller -f k8s/skaffold.yaml
sleep 5
kubectl apply -f "${resdir}/webhook.yaml"
