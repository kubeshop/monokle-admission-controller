#!/bin/bash
#
# Bumps the version of the admission controller webhook.

set -eo pipefail

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

rootdir=$(pwd)

echo "Bumping to $VERSION"

echo "Updating node packages version..."
cd "$rootdir/admission-controller/init" && npm version $VERSION --git-tag-version false
cd "$rootdir/admission-controller/server" && npm version $VERSION --git-tag-version false

echo "Updating Helm Chart version..."
yq -i ".version = \"$VERSION\"" "$rootdir/helm/Chart.yaml"
yq -i ".appVersion = \"$VERSION\"" "$rootdir/helm/Chart.yaml"

echo "Adding changes to git..."
cd "$rootdir"
git add .
git commit -m "chore: release $VERSION"
git tag "v$VERSION"
