import {readFileSync} from "fs";

export const DEFAULT_NAMESPACE = 'default';

export function getNamespace() {
  // Get current namespace from inside a pod - https://stackoverflow.com/a/46046153
  return readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'utf8').trim();
}
