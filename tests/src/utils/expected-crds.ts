export const EXPECTED_CRDS: Record<string, any> = {
  'cluster-1-binding-1': {
    apiVersion: 'monokle.io/v1alpha1',
    kind: 'MonoklePolicyBinding',
    metadata: {
      name: 'cluster-1-binding-1'
    },
    spec: {
      policyName: 'cluster-1-binding-1-policy',
      validationActions: ['Warn'],
      matchResources: {
        namespaceSelector: {
          matchExpressions: [{
            key: 'name',
            operator: 'In',
            values: ['my-namespace-0', 'my-namespace-1'],
          }]
        }
      }
    }
  },
  'cluster-1-binding-2': {
    apiVersion: 'monokle.io/v1alpha1',
    kind: 'MonoklePolicyBinding',
    metadata: {
      name: 'cluster-1-binding-2'
    },
    spec: {
      policyName: 'cluster-1-binding-2-policy',
      validationActions: ['Warn'],
      matchResources: {
        namespaceSelector: {
          matchExpressions: [{
            key: 'name',
            operator: 'In',
            values: ['my-namespace-2', 'my-namespace-1'],
          }]
        }
      }
    }
  },
  'cluster-1-binding-1-policy': {
    apiVersion: 'monokle.io/v1alpha1',
    kind: 'MonoklePolicy',
    metadata: {
      name: 'cluster-1-binding-1-policy'
    },
    spec: {
      plugins: {
        'open-policy-agent': true,
        'pod-security-standards': true
      }
    }
  },
  'cluster-1-binding-2-policy': {
    apiVersion: 'monokle.io/v1alpha1',
    kind: 'MonoklePolicy',
    metadata: {
      name: 'cluster-1-binding-2-policy'
    },
    spec: {
      plugins: {
        'yaml-syntax': true,
        'open-policy-agent': true,
        'resource-links': true,
      },
      rules: {
        'yaml-syntax/no-bad-alias': "warn",
        'yaml-syntax/no-bad-directive': false,
        'open-policy-agent/no-last-image': "err",
        'open-policy-agent/cpu-limit': "err",
        'open-policy-agent/memory-limit': "err",
        'open-policy-agent/memory-request': "err",
      }
    }
  }
}