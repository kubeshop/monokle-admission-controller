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
  'cluster-1-binding-1-deny': {
    apiVersion: 'monokle.io/v1alpha1',
    kind: 'MonoklePolicyBinding',
    metadata: {
      name: 'cluster-1-binding-1-deny'
    },
    spec: {
      policyName: 'cluster-1-binding-1-policy',
      validationActions: ['Deny'],
      matchResources: {
        namespaceSelector: {
          matchExpressions: [{
            key: 'name',
            operator: 'In',
            values: ['my-namespace-0'],
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
        'pod-security-standards': true,
        'yaml-syntax': false,
        'resource-links': false,
      }
    }
  }
}