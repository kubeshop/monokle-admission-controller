import { KubernetesObject } from '@kubernetes/client-node';
import { Config, MonokleValidator } from '@monokle/validation';

export type MonoklePolicy = KubernetesObject & {
  spec: Config;
};

export type MonoklePolicyBindingConfiguration = {
  policyName: string;
  validationActions: ['Warn'];
  matchResources?: {
    namespaceSelector?: {
      matchLabels?: Record<string, string>;
      matchExpressions?: {
        key: string;
        operator: 'In' | 'NotIn';
        values: string[];
      }[];
    };
  };
};

export type MonoklePolicyBinding = KubernetesObject & {
  spec: MonoklePolicyBindingConfiguration;
};

export type MonokleApplicablePolicy = {
  policy: Config;
  binding: MonoklePolicyBindingConfiguration;
};

export type MonokleApplicableValidator = {
  validator: MonokleValidator;
  policy: MonokleApplicablePolicy;
};
