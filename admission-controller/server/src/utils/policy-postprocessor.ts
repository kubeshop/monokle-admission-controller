import {Config} from '@monokle/validation';
import {MonoklePolicy} from './policy-manager.js';

const PLUGIN_BLOCKLIST = [
  'resource-links',
];

export function postprocess(policy: MonoklePolicy) {
  const newPolicy = { ...policy };
  newPolicy.spec = blockPlugins(newPolicy.spec);
  return newPolicy;
}

function blockPlugins(policySpec: Config): Config {
  if (policySpec.plugins === undefined) {
    return policySpec;
  }

  const newPlugins = { ...policySpec.plugins };
  for (const blockedPlugin of PLUGIN_BLOCKLIST) {
    if (newPlugins[blockedPlugin] === true) {
      newPlugins[blockedPlugin] = false;
    }
  }

  return {
    ...policySpec,
    plugins: newPlugins,
  };
}
