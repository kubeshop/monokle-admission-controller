import {EventEmitter} from "events";
import pino from 'pino';
import {KubernetesObject} from '@kubernetes/client-node';
import {Config} from '@monokle/validation';
import {InformerWrapper} from './get-informer';
import {AdmissionRequestObject} from "./validation-server";

export type MonoklePolicy = KubernetesObject & {
  spec: Config
}

export type MonoklePolicyBindingConfiguration = {
  policyName: string
  validationActions: ['Warn']
  matchResources?: {
    namespaceSelector?: {
      matchLabels?: Record<string, string>
    }
  }
}

export type MonoklePolicyBinding = KubernetesObject & {
  spec: MonoklePolicyBindingConfiguration
}

export type MonokleApplicablePolicy = {
  policy: Config,
  binding: MonoklePolicyBindingConfiguration
}

export class PolicyManager extends EventEmitter{
  private _policies = new Map<string, MonoklePolicy>(); // Map<policyName, policy>
  private _bindings = new Map<string, MonoklePolicyBinding>(); // Map<bindingName, binding>

  constructor(
    private readonly _policyInformer: InformerWrapper<MonoklePolicy>,
    private readonly _bindingInformer: InformerWrapper<MonoklePolicyBinding>,
    private readonly _ignoreNamespaces: string[],
    private readonly _logger: ReturnType<typeof pino>,
  ) {
    super();

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

  getMatchingPolicies(resource: AdmissionRequestObject, namespace: string): MonokleApplicablePolicy[] {
    this._logger.debug({policies: this._policies.size, bindings: this._bindings.size});

    if (this._bindings.size === 0) {
      return [];
    }

    if (this._ignoreNamespaces.includes(namespace)) {
      return [];
    }

    return Array.from(this._bindings.values())
      .map((binding) => {
        const policy = this._policies.get(binding.spec.policyName);

        if (!policy) {
          this._logger.error({msg: 'Binding is pointing to missing policy', binding});
          return null;
        }

        if (binding.spec.matchResources && !this.isResourceMatching(binding, resource)) {
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

    this.emit('policyUpdated', policy);
  }

  private onPolicyRemoval(policy: MonoklePolicy) {
    this._logger.debug({msg: 'Policy removed', policy});

    this._policies.delete(policy.metadata!.name!);

    this.emit('policyRemoved', policy);
  }

  private onBinding(binding: MonoklePolicyBinding) {
    this._logger.debug({msg: 'Binding updated', binding});

    this._bindings.set(binding.metadata!.name!, binding);

    this.emit('bindingUpdated', binding);
  }

  private onBindingRemoval(binding: MonoklePolicyBinding) {
    this._logger.debug({msg: 'Binding removed', binding});

    this._bindings.delete(binding.metadata!.name!);

    this.emit('bindingRemoved', binding);
  }

  private isResourceMatching(binding: MonoklePolicyBinding, resource: AdmissionRequestObject): boolean {
    const namespaceMatchLabels = binding.spec.matchResources?.namespaceSelector?.matchLabels;

    this._logger.trace({
      msg: 'Checking if resource matches binding',
      namespaceMatchLabels,
      resourceMetadata: resource.metadata.labels
    });

    if (!namespaceMatchLabels) {
      return true;
    }

    for (const key of Object.keys(namespaceMatchLabels)) {
      if (resource.metadata.labels?.[key] !== namespaceMatchLabels[key]) {
        if (!(key === 'namespace' && resource.metadata.namespace === namespaceMatchLabels[key])) {
          return false;
        }
      }
    }

    return true;
  }
}
