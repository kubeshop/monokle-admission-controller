import pino from 'pino';
import {KubernetesObject} from '@kubernetes/client-node';
import {Config} from '@monokle/validation';
import {Informer} from './get-informer';

export type MonoklePolicy = KubernetesObject & {
  spec: Config
}

export type MonoklePolicyBinding = KubernetesObject & {
  spec: {
    policyName: string
    validationActions: 'Warn'
  }
}

export class PolicyManager {
  private _policies = new Map<string, MonoklePolicy>(); // Map<policyName, policy>
  private _bindings = new Map<string, MonoklePolicyBinding>(); // Map<bindingName, binding> // @TODO use policyName as key instead of bindingName?

  constructor(
    private readonly _policyInformer: Informer<MonoklePolicy>,
    private readonly _bindingInformer: Informer<MonoklePolicyBinding>,
    private readonly _logger: ReturnType<typeof pino>,
  ) {
    this._policyInformer.on('add', this.onPolicy);
    this._policyInformer.on('update', this.onPolicy);
    this._policyInformer.on('delete', this.onPolicyRemoval);

    this._bindingInformer.on('add', this.onBinding);
    this._bindingInformer.on('update', this.onBinding);
    this._bindingInformer.on('delete', this.onBindingRemoval);
  }

  async start() {
    await this._policyInformer.start();
    await this._bindingInformer.start();
  }

  getMatchingPolicies() { // @TODO pass resource data so it can be matched according to matchResources definition (when it's implemented)
    if (this._bindings.size === 0) {
      return [];
    }

    return Array.from(this._bindings.values()).map((binding) => {
      const policy = this._policies.get(binding.spec.policyName);

      if (!policy) {
        this._logger.error({msg: 'Binding is pointing to missing policy', binding});
      }

      return policy;
    }).filter((policy) => policy !== undefined);
  }

  private onPolicy(policy: MonoklePolicy) {
    this._logger.debug({msg: 'Policy updated', policy});

    this._policies.set(policy.metadata!.name!, policy);
  }

  private onPolicyRemoval(policy: MonoklePolicy) {
    this._logger.debug({msg: 'Policy updated', policy});

    this._policies.delete(policy.metadata!.name!);
  }

  private onBinding(binding: MonoklePolicyBinding) {
    this._logger.debug({msg: 'Binding updated', binding});

    this._bindings.set(binding.metadata!.name!, binding);
  }

  private onBindingRemoval(binding: MonoklePolicyBinding) {
    this._logger.debug({msg: 'Binding updated', binding});

    this._bindings.delete(binding.metadata!.name!);
  }
}