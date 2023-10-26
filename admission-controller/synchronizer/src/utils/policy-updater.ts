import k8s from '@kubernetes/client-node';
import _ from "lodash";
import {ClusterQueryResponseBinding, ClusterQueryResponseBindingPolicy} from "./queries";

export class PolicyUpdater {
  protected _bindingsCache = new Map<string, ClusterQueryResponseBinding>();
  protected _policiesCache = new Map<string, ClusterQueryResponseBindingPolicy>();
  protected _k8sClient: k8s.CustomObjectsApi;

  constructor(
    protected _k8sConfig: k8s.KubeConfig,
  ) {
    this._k8sClient = this._k8sConfig.makeApiClient(k8s.CustomObjectsApi)
  }

  async update(bindings: ClusterQueryResponseBinding[]) {
    const policies = bindings.map((binding) => binding.policy);
    for (const policy of policies) {
      if (!this._policiesCache.has(policy.id)) {
        await this.createPolicy(policy);
        this._policiesCache.set(policy.id, policy);
      } else if (!_.isEqual(this._policiesCache.get(policy.id), policy)) {
        await this.updatePolicy(policy);
        this._policiesCache.set(policy.id, policy);
      }
    }

    for (const binding of bindings) {
      if (!this._bindingsCache.has(binding.id)) {
        await this.createBinding(binding);
        this._bindingsCache.set(binding.id, binding);
      } else if (!this.isEqualBinding(this._bindingsCache.get(binding.id)!, binding)) {
        await this.updateBinding(binding);
        this._bindingsCache.set(binding.id, binding);
      }
    }
  }

  protected async createPolicy(policy: ClusterQueryResponseBindingPolicy) {
    await this._k8sClient.createClusterCustomObject(
      'monokle.io',
      'v1alpha1',
      'policies',
      {
        apiVersion: 'monokle.io/v1alpha1',
        kind: 'MonoklePolicy',
        metadata: {
          name: policy.id,
        },
        spec: policy.content
      }
    )
  }

  protected async updatePolicy(policy: ClusterQueryResponseBindingPolicy) {
    await this._k8sClient.replaceClusterCustomObject(
      'monokle.io',
      'v1alpha1',
      'policies',
      policy.id,
      {
        apiVersion: 'monokle.io/v1alpha1',
        kind: 'MonoklePolicy',
        metadata: {
          name: policy.id,
        },
        spec: policy.content
      }
    )
  }

  protected async createBinding(binding: ClusterQueryResponseBinding) {
    await this._k8sClient.createClusterCustomObject(
      'monokle.io',
      'v1alpha1',
      'policybindings',
      {
        apiVersion: 'monokle.io/v1alpha1',
        kind: 'MonoklePolicyBinding',
        metadata: {
          name: binding.id,
        },
        spec: {
          policyName: binding.policy.id,
          validationActions: ['Warn']
          // @TODO logic for mapping binding.mode to matchResources
        }
      }
    )
  }

  protected async updateBinding(binding: ClusterQueryResponseBinding) {
    await this._k8sClient.replaceClusterCustomObject(
      'monokle.io',
      'v1alpha1',
      'policybindings',
      binding.id,
      {
        apiVersion: 'monokle.io/v1alpha1',
        kind: 'MonoklePolicyBinding',
        metadata: {
          name: binding.id,
        },
        spec: {
          policyName: binding.policy.id,
          validationActions: ['Warn']
          // @TODO logic for mapping binding.mode to matchResources
        }
      }
    )
  }

  protected isEqualBinding(binding1: ClusterQueryResponseBinding, binding2: ClusterQueryResponseBinding): boolean {
    // Do not compare policy content since it does not affect MonoklePolicyBinding.
    const binding1Copy = { ...binding1 };
    (binding1Copy as any).policy = { id: binding1.policy.id };

    const binding2Copy = { ...binding2 };
    (binding2Copy as any).policy = { id: binding2.policy.id };

    return _.isEqual(binding1Copy, binding2Copy);
  }
}
