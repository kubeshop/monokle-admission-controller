import { assert, describe, it } from 'vitest'
import { PolicyUpdater } from '../../admission-controller/synchronizer/src/utils/policy-updater.js';
import { ClusterQueryResponse, ClusterQueryResponseBinding, ClusterQueryResponseBindingPolicy } from '../../admission-controller/synchronizer/src/utils/queries.js';

describe(`Unit: synchronizer`, () => {
  it('creates policies and bindings', async () => {
    const policyUpdater = getStubbedPolicyUpdater();

    await policyUpdater.update(getSampleClusterData1().getCluster.cluster.bindings);

    assert.deepEqual(policyUpdater._spy.policiesCreated, ['cluster1-binding1-policy', 'cluster1-binding2-policy']);
    assert.deepEqual(policyUpdater._spy.policiesUpdated.length, 0);
    assert.deepEqual(policyUpdater._spy.bindingsCreated, ['cluster1-binding1', 'cluster1-binding2']);
    assert.deepEqual(policyUpdater._spy.bindingsUpdated.length, 0);
  });

  it('skips recurrent updates of the same policies and bindings', async () => {
    const policyUpdater = getStubbedPolicyUpdater();

    await policyUpdater.update(getSampleClusterData1().getCluster.cluster.bindings);

    assert.deepEqual(policyUpdater._spy.policiesCreated, ['cluster1-binding1-policy', 'cluster1-binding2-policy']);
    assert.deepEqual(policyUpdater._spy.policiesUpdated.length, 0);
    assert.deepEqual(policyUpdater._spy.bindingsCreated, ['cluster1-binding1', 'cluster1-binding2']);
    assert.deepEqual(policyUpdater._spy.bindingsUpdated.length, 0);

    policyUpdater._spy.clear();

    await policyUpdater.update(getSampleClusterData1().getCluster.cluster.bindings);

    assert.deepEqual(policyUpdater._spy.policiesCreated.length, 0);
    assert.deepEqual(policyUpdater._spy.policiesUpdated.length, 0);
    assert.deepEqual(policyUpdater._spy.bindingsCreated.length, 0);
    assert.deepEqual(policyUpdater._spy.bindingsUpdated.length, 0);
  });

  it('updates polices when their content changes', async () => {
    const policyUpdater = getStubbedPolicyUpdater();

    await policyUpdater.update(getSampleClusterData1().getCluster.cluster.bindings);

    assert.deepEqual(policyUpdater._spy.policiesCreated, ['cluster1-binding1-policy', 'cluster1-binding2-policy']);
    assert.deepEqual(policyUpdater._spy.policiesUpdated.length, 0);

    policyUpdater._spy.clear();

    await policyUpdater.update(getSampleClusterData1({
      policy2Content: {
        plugins: {
          metadata: true
        }
      }
    }).getCluster.cluster.bindings);

    assert.deepEqual(policyUpdater._spy.policiesCreated.length, 0);
    assert.deepEqual(policyUpdater._spy.policiesUpdated, ['cluster1-binding2-policy']);
  });

  it('updates bindings when their content changes', async () => {
    const policyUpdater = getStubbedPolicyUpdater();

    await policyUpdater.update(getSampleClusterData1().getCluster.cluster.bindings);

    assert.deepEqual(policyUpdater._spy.bindingsCreated, ['cluster1-binding1', 'cluster1-binding2']);
    assert.deepEqual(policyUpdater._spy.bindingsUpdated.length, 0);

    policyUpdater._spy.clear();

    await policyUpdater.update(getSampleClusterData1({
      bindings1namespaces: ['nstest1', 'nstest2']
    }).getCluster.cluster.bindings);

    assert.deepEqual(policyUpdater._spy.bindingsCreated.length, 0);
    assert.deepEqual(policyUpdater._spy.bindingsUpdated, ['cluster1-binding1']);
  });
});

function getStubbedPolicyUpdater() {
  const policyUpdater: any = new PolicyUpdater({
      makeApiClient: () => {},
  } as any);

  policyUpdater._spy = {};
  policyUpdater._spy.clear = () => {
    policyUpdater._spy.policiesCreated = [];
    policyUpdater._spy.policiesUpdated = [];
    policyUpdater._spy.bindingsCreated = [];
    policyUpdater._spy.bindingsUpdated = [];
  }

  policyUpdater._spy.clear();

  policyUpdater.createPolicy = (policy: ClusterQueryResponseBindingPolicy) => {
    policyUpdater._spy.policiesCreated.push(policy.id);
  };

  policyUpdater.updatePolicy = (policy: ClusterQueryResponseBindingPolicy) => {
    policyUpdater._spy.policiesUpdated.push(policy.id);
  }

  policyUpdater.createBinding = (binding: ClusterQueryResponseBinding) => {
    policyUpdater._spy.bindingsCreated.push(binding.id);
  }

  policyUpdater.updateBinding = (binding: ClusterQueryResponseBinding) => {
    policyUpdater._spy.bindingsUpdated.push(binding.id);
  }

  return policyUpdater as PolicyUpdater & {
    _spy: {
      policiesCreated: string[],
      policiesUpdated: string[],
      bindingsCreated: string[],
      bindingsUpdated: string[],
      clear: () => void,
    }
  };
}

function getSampleClusterData1(
  replacements?: {
    policy1Content?: any,
    policy2Content?: any,
    bindings1namespaces?: string[],
  }
): ClusterQueryResponse {
  return {
    getCluster: {
      cluster: {
        id: 'cluster1',
        name: 'Cluster 1',
        namespaceSync: true,

        namespaces: [
          {
            id: 'cluster1-namespace1',
            name: 'nstest1'
          },
          {
            id: 'cluster1-namespace2',
            name: 'nstest2'
          }
        ],

        bindings: [
          {
            id: 'cluster1-binding1',
            mode: 'ALLOW_LIST',
            namespaces: replacements?.bindings1namespaces ?? ['nstest1'],

            policy: {
              id: 'cluster1-binding1-policy',
              projectId: 'cluster1-project1',
              content: replacements?.policy1Content ?? {
                plugins: {
                'open-policy-agent': true,
                'pod-security-standards': true
                }
              }
            }
          },
          {
            id: 'cluster1-binding2',
            mode: 'BLOCK_LIST',
            namespaces: ['nstest2', 'non-existent-ns'],

            policy: {
              id: 'cluster1-binding2-policy',
              projectId: 'cluster1-project2',
              content: replacements?.policy2Content ?? {
                plugins: {
                  'open-policy-agent': true,
                  'pod-security-standards': false
                }
              }
            }
          }
        ]
      }
    }
  };
}
