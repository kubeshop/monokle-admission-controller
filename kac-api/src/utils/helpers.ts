import { readFileSync } from "fs";

export const DEFAULT_NAMESPACE = 'default';

export function getNamespace() {
  try {
    // Get current namespace from inside a pod - https://stackoverflow.com/a/46046153
    const namespace = readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'utf8');
    if (namespace.trim()) {
      return namespace.trim();
    }
  }
  catch (err: any) {
    console.error('Failed to read namespace from service account', err);
    return null
  }
}
