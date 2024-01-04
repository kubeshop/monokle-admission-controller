import k8s from '@kubernetes/client-node';
import _ from "lodash";
import pino from 'pino';
import {parse} from 'yaml'
import {ClusterQueryResponseBinding, ClusterQueryResponseBindingPolicy, ClusterQueryResponseNamespace} from "./queries";

export class PolicyUpdater {
  protected _bindingsCache = new Map<string, ClusterQueryResponseBinding>();
  protected _policiesCache = new Map<string, ClusterQueryResponseBindingPolicy>();
  protected _k8sClient: k8s.CustomObjectsApi;

  constructor(
    protected _k8sConfig: k8s.KubeConfig,
    protected _logger: ReturnType<typeof pino>,
  ) {
    this._k8sClient = this._k8sConfig.makeApiClient(k8s.CustomObjectsApi)
  }

  async init() {
    const existingPolicies = await this.listPolicies();
    const existingBindings = await this.listBindings();

    for (const policy of existingPolicies) {
      this._policiesCache.set(policy.metadata.name!, policy);
    }

    for (const binding of existingBindings) {
      this._bindingsCache.set(binding.metadata.name!, binding);
    }
  }

  async update(bindings: ClusterQueryResponseBinding[], namespaces: ClusterQueryResponseNamespace[]) {
    const policies = bindings.map((binding) => binding.policy);

    const existingPolicyIds = Array.from(this._policiesCache.keys());
    const existingBindingIds = Array.from(this._bindingsCache.keys());
    const newPolicyIds = policies.map((policy) => policy.id);
    const newBindingIds = bindings.map((binding) => binding.id);
    const removedPolicyIds = _.difference(existingPolicyIds, newPolicyIds);
    const removedBindingIds = _.difference(existingBindingIds, newBindingIds);

    try {
      for (const removedBindingId of removedBindingIds) {
        this.deleteBinding(removedBindingId);
        this._bindingsCache.delete(removedBindingId);
      }

      for (const removedPolicyId of removedPolicyIds) {
        this.deletePolicy(removedPolicyId);
        this._policiesCache.delete(removedPolicyId);
      }
    } catch (err: any) {
      // Failing on deletion shouldn't stop entire update process.
      this._logger.warn({ msg: 'Failed to delete policy or binding', errMsg: err.message, err });
    }

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
        await this.createBinding(binding, namespaces);
        this._bindingsCache.set(binding.id, binding);
      } else if (!this.isEqualBinding(this._bindingsCache.get(binding.id)!, binding)) {
        await this.updateBinding(binding, namespaces);
        this._bindingsCache.set(binding.id, binding);
      }
    }
  }

  protected async listPolicies() {
    try {
      const response = await this._k8sClient.listClusterCustomObject(
        'monokle.io',
        'v1alpha1',
        'policies'
      );

      return (response.body as any).items;
    } catch (err: any) {
      this._logger.error({ msg: 'Failed to list policies', errMsg: err.message, err });
      return [];
    }
  }

  protected async deletePolicy(policyId: string) {
    await this._k8sClient.deleteClusterCustomObject(
      'monokle.io',
      'v1alpha1',
      'policies',
      policyId
    )
  }

  protected async createPolicy(policy: ClusterQueryResponseBindingPolicy) {
    try {
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
          spec: parse(policy.content)
        }
      )
    } catch (err: any) {
      // PolicyUpdater cache gets wiped out on pod restart. Policies may be there so we treat 'AlreadyExists' as success.
      if (err.body?.reason !== 'AlreadyExists') {
        throw err;
      }
    }
  }

  protected async updatePolicy(policy: ClusterQueryResponseBindingPolicy) {
    await this._k8sClient.patchClusterCustomObject(
      'monokle.io',
      'v1alpha1',
      'policies',
      policy.id,
      {
        spec: parse(policy.content)
      },
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': k8s.PatchUtils.PATCH_FORMAT_JSON_MERGE_PATCH } }
    )
  }

  protected async listBindings() {
    try {
      const response = await this._k8sClient.listClusterCustomObject(
        'monokle.io',
        'v1alpha1',
        'policybindings'
      );

      return (response.body as any).items;
    } catch (err: any) {
      this._logger.error({ msg: 'Failed to list bindings', errMsg: err.message, err });
      return [];
    }
  }

  protected async deleteBinding(bindingId: string) {
    await this._k8sClient.deleteClusterCustomObject(
      'monokle.io',
      'v1alpha1',
      'policybindings',
      bindingId
    )
  }

  protected async createBinding(binding: ClusterQueryResponseBinding, namespaces: ClusterQueryResponseNamespace[]) {
    try {
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
          spec: this.createBindingSpec(binding, namespaces)
        }
      )
    } catch (err: any) {
      // PolicyUpdater cache gets wiped out on pod restart. Bindings may be there so we treat 'AlreadyExists' as success.
      if (err.body?.reason !== 'AlreadyExists') {
        throw err;
      }
    }
  }

  protected async updateBinding(binding: ClusterQueryResponseBinding, namespaces: ClusterQueryResponseNamespace[]) {
    await this._k8sClient.patchClusterCustomObject(
      'monokle.io',
      'v1alpha1',
      'policybindings',
      binding.id,
      {
        spec: this.createBindingSpec(binding, namespaces)
      },
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': k8s.PatchUtils.PATCH_FORMAT_JSON_MERGE_PATCH } }
    )
  }

  protected createBindingSpec(binding: ClusterQueryResponseBinding, namespaces: ClusterQueryResponseNamespace[]) {
    const namespacesNames = binding.namespaces.reduce<string[]>((acc, namespaceId) => {
      const namespace = namespaces.find((namespace) => namespace.id === namespaceId);

      if (namespace) {
        acc.push(namespace.name);
      } else {
        this._logger.warn({ msg: 'Namespace not found for binding', namespaceId, namespaces });
      }

      return acc;
    }, []);

    return {
      policyName: binding.policy.id,
      validationActions: [this.mapValidationAction(binding.action)],
      matchResources: {
        namespaceSelector: {
          matchExpressions: [{
            key: 'name',
            operator: binding.mode === 'ALLOW_LIST' ? 'In' : 'NotIn',
            values: namespacesNames
          }]
        }
      }
    };
  }

  protected isEqualBinding(binding1: ClusterQueryResponseBinding, binding2: ClusterQueryResponseBinding): boolean {
    // Do not compare policy content since it does not affect MonoklePolicyBinding.
    const binding1Copy = { ...binding1 };
    (binding1Copy as any).policy = { id: binding1.policy?.id };

    const binding2Copy = { ...binding2 };
    (binding2Copy as any).policy = { id: binding2.policy?.id };

    return _.isEqual(binding1Copy, binding2Copy);
  }

  protected mapValidationAction(action: string) {
    const actionNormalized = (action || '').toLowerCase().trim();

    switch (actionNormalized) {
      case 'warn':
        return 'Warn';
      case 'deny':
        return 'Deny';
      default:
        this._logger.error({ msg: 'Unknown validation action.', action });
        return action;
    }
  }
}
