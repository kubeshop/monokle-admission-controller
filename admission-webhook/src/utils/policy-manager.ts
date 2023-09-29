import pino from 'pino';
import {KubernetesObject} from '@kubernetes/client-node';
import {Config} from '@monokle/validation';
import {InformerWrapper} from './get-informer';

export type MonoklePolicy = KubernetesObject & {
  spec: Config
}

export type MonoklePolicyBindingConfiguration = {
  policyName: string
  validationActions: ['Warn']
}

export type MonoklePolicyBinding = KubernetesObject & {
  spec: MonoklePolicyBindingConfiguration
}

export type MonokleApplicablePolicy = {
  policy: Config,
  binding: MonoklePolicyBindingConfiguration
}

export class PolicyManager {
  private _policies = new Map<string, MonoklePolicy>(); // Map<policyName, policy>
  private _bindings = new Map<string, MonoklePolicyBinding>(); // Map<bindingName, binding> // @TODO use policyName as key instead of bindingName?

  constructor(
    private readonly _policyInformer: InformerWrapper<MonoklePolicy>,
    private readonly _bindingInformer: InformerWrapper<MonoklePolicyBinding>,
    private readonly _ignoreNamespaces: string[],
    private readonly _logger: ReturnType<typeof pino>,
  ) {
    this._policyInformer.informer.on('add', this.onPolicy.bind(this));
    this._policyInformer.informer.on('update', this.onPolicy.bind(this));
    this._policyInformer.informer.on('delete', this.onPolicyRemoval.bind(this));

    this._bindingInformer.informer.on('add', this.onBinding.bind(this));
    this._bindingInformer.informer.on('update', this.onBinding.bind(this));
    this._bindingInformer.informer.on('delete', this.onBindingRemoval.bind(this));
  }

  async start() {
    await this._policyInformer.start();
    await this._bindingInformer.start();
  }

  getMatchingPolicies(): MonokleApplicablePolicy[] { // @TODO pass resource data so it can be matched according to matchResources definition (when it's implemented)
    if (this._bindings.size === 0) {
      return [];
    }

    return Array.from(this._bindings.values())
      .map((binding) => {
        const policy = this._policies.get(binding.spec.policyName);

        if (!policy) {
          this._logger.error({msg: 'Binding is pointing to missing policy', binding});
          return null;
        }

        return {
          policy: policy.spec,
          binding: binding.spec
        }
      })
      .filter((policy) => policy !== null) as MonokleApplicablePolicy[];
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