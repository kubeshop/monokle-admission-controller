#!/bin/bash
#
# Bumps the version of the admission controller webhook.
#
# This script requires 'yq' and 'replace_in_file' to be installed:
# - https://github.com/mikefarah/yq#install
# - https://www.npmjs.com/package/replace-in-file#installation

set -eo pipefail

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

rootdir=$(pwd)
current_version=$(yq -r ".version" "$rootdir/helm/Chart.yaml")

echo "Bumping from $current_version to $VERSION"

echo "Updating README file..."

replace-in-file \
"https://github.com/kubeshop/monokle-admission-controller/releases/download/v$current_version/helm.tgz --set automationToken" \
"https://github.com/kubeshop/monokle-admission-controller/releases/download/v$VERSION/helm.tgz --set automationToken" \
"$rootdir/README.md"
replace-in-file \
"https://github.com/kubeshop/monokle-admission-controller/releases/download/v$current_version/helm.tgz" \
"https://github.com/kubeshop/monokle-admission-controller/releases/download/v$VERSION/helm.tgz" \
"$rootdir/README.md"

replace-in-file \
"https://github.com/kubeshop/monokle-admission-controller/releases/download/v$current_version/install-cloud.yaml" \
"https://github.com/kubeshop/monokle-admission-controller/releases/download/v$VERSION/install-cloud.yaml" \
"$rootdir/README.md"
replace-in-file \
"https://github.com/kubeshop/monokle-admission-controller/releases/download/v$current_version/install-standalone.yaml" \
"https://github.com/kubeshop/monokle-admission-controller/releases/download/v$VERSION/install-standalone.yaml" \
"$rootdir/README.md"

echo "Updating Helm Chart version..."
yq -i ".version = \"$VERSION\"" "$rootdir/helm/Chart.yaml"
yq -i ".appVersion = \"$VERSION\"" "$rootdir/helm/Chart.yaml"

echo "Updating node packages version..."
cd "$rootdir/admission-controller/init" && npm version $VERSION --git-tag-version false
cd "$rootdir/admission-controller/server" && npm version $VERSION --git-tag-version false
cd "$rootdir/admission-controller/synchronizer" && npm version $VERSION --git-tag-version false

echo "Adding changes to git..."
cd "$rootdir"
git add .
git commit -m "chore: release $VERSION"
git tag "v$VERSION"
