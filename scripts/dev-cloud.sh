#!/bin/bash
#
# Sets up environment for admission controller webhook in the active cluster. Use for development/testing only.

set -euo pipefail

basedir="$(dirname "$0")"

# Generate install.yaml
# For local testing:
# cloudApiUrl=host.docker.internal:5000
# cloudApiUrl=host.minikube.internal:5000
helm template "${basedir}/../helm" \
--set image.init.overridePath=admission-webhook-init \
--set image.server.overridePath=admission-webhook \
--set image.synchronizer.overridePath=admission-synchronizer \
--set logLevel=debug \
--set cloudApiUrl=host.docker.internal:5000 \
--set automationToken=SAMPLE_TOKEN > "${basedir}/install.yaml"

# Run development through skaffold with locally build images
skaffold dev -f "${basedir}/skaffold.yaml"
