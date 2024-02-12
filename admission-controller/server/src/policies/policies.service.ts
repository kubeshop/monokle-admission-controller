import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { V1Namespace } from '@kubernetes/client-node';
import {
  AnnotationSuppressor,
  Config,
  DisabledFixer,
  FingerprintSuppressor,
  MonokleValidator,
  RemotePluginLoader,
  ResourceParser,
  SchemaLoader,
} from '@monokle/validation';
import {
  MonokleApplicablePolicy,
  MonokleApplicableValidator,
  MonoklePolicy,
  MonoklePolicyBinding,
} from './policies.models';
import { AdmissionRequestObject } from '../admission/admission.models';
import { OnEvent } from '@nestjs/event-emitter';
import { WatcherService } from '../kubernetes/watcher.service';

@Injectable()
export class PoliciesService implements OnModuleInit {
  private static readonly PLUGIN_BLOCKLIST = ['resource-links'];

  private readonly log = new Logger(PoliciesService.name);

  private readonly policyStore = new Map<string, MonoklePolicy>(); // Map<policyName, policy>
  private readonly bindingStore = new Map<string, MonoklePolicyBinding>(); // Map<bindingName, binding>
  private readonly validatorStore = new Map<string, MonokleValidator>(); // Map<policyName, validator>

  constructor(private readonly $watcher: WatcherService) {}

  private static postprocess(policy: MonoklePolicy) {
    const newPolicy = { ...policy };
    newPolicy.spec = PoliciesService.blockPlugins(newPolicy.spec);
    return newPolicy;
  }

  private static blockPlugins(policySpec: Config): Config {
    if (policySpec.plugins === undefined) {
      return policySpec;
    }

    const newPlugins = { ...policySpec.plugins };
    for (const blockedPlugin of PoliciesService.PLUGIN_BLOCKLIST) {
      if (newPlugins[blockedPlugin] === true) {
        newPlugins[blockedPlugin] = false;
      }
    }

    return {
      ...policySpec,
      plugins: newPlugins,
    };
  }

  async onModuleInit() {
    await this.$watcher
      .watch('monokle.io', 'v1alpha1', 'policies')
      .then((watch) =>
        watch.list().map((policy) => this.onPolicy(policy as any)),
      );
    await this.$watcher
      .watch('monokle.io', 'v1alpha1', 'policybindings')
      .then((watch) =>
        watch.list().map((binding) => this.onBinding(binding as any)),
      );
  }

  getMatchingValidators(
    resource: AdmissionRequestObject,
    resourceNamespace?: V1Namespace,
  ): MonokleApplicableValidator[] {
    const matchingPolicies = this.getMatchingPolicies(
      resource,
      resourceNamespace,
    );

    if (matchingPolicies.length === 0) {
      return [];
    }

    return matchingPolicies
      .map((policy) => {
        if (!this.validatorStore.has(policy.binding.policyName)) {
          // This should not happen and means there is a bug in other place in the code. Raise warning and skip.
          // Do not create validator instance here to keep this function sync and to keep processing time low.
          this.log.warn(
            `Validator not found for policy: ${policy.binding.policyName}`,
          );
          return null;
        }

        return {
          validator: this.validatorStore.get(policy.binding.policyName)!,
          policy,
        };
      })
      .filter(
        (validator) => validator !== null,
      ) as MonokleApplicableValidator[];
  }

  private getMatchingPolicies(
    resource: AdmissionRequestObject,
    resourceNamespace?: V1Namespace,
  ): MonokleApplicablePolicy[] {
    this.log.debug(
      `policies: ${this.policyStore.size}, bindings: ${this.bindingStore.size}`,
    );
    if (this.bindingStore.size === 0) {
      return [];
    }

    return Array.from(this.bindingStore.values())
      .map((binding) => {
        const policy = this.policyStore.get(binding.spec.policyName);

        if (!policy) {
          this.log.error('Binding is pointing to missing policy', binding);
          return null;
        }

        if (
          binding.spec.matchResources &&
          !this.isResourceMatching(binding, resource, resourceNamespace)
        ) {
          return null;
        }

        return {
          policy: policy.spec,
          binding: binding.spec,
        };
      })
      .filter((policy) => policy !== null) as MonokleApplicablePolicy[];
  }

  @OnEvent(
    WatcherService.getEventsKey('monokle.io', 'v1alpha1', 'policies') + ':add',
  )
  @OnEvent(
    WatcherService.getEventsKey('monokle.io', 'v1alpha1', 'policies') +
      ':update',
  )
  private async onPolicy(rawPolicy: MonoklePolicy) {
    const policy = PoliciesService.postprocess(rawPolicy);

    this.log.log(`Policy change received: ${rawPolicy.metadata!.name}`);
    this.log.verbose({ rawPolicy, policy });

    this.policyStore.set(rawPolicy.metadata!.name!, policy);

    if (this.validatorStore.has(policy.metadata!.name!)) {
      return await this.validatorStore
        .get(policy.metadata!.name!)!
        .preload(policy.spec);
    }

    const validator = new MonokleValidator({
      loader: new RemotePluginLoader(),
      parser: new ResourceParser(),
      schemaLoader: new SchemaLoader(),
      suppressors: [new AnnotationSuppressor(), new FingerprintSuppressor()],
      fixer: new DisabledFixer(),
    });

    // Run separately (instead of passing config to constructor) to make sure that validator
    // is ready when 'setupValidator' function call fulfills.
    await validator.preload(policy.spec);
    this.log.log(`Policy reconciled: ${rawPolicy.metadata!.name}`);

    this.validatorStore.set(policy.metadata!.name!, validator);
  }

  @OnEvent(
    WatcherService.getEventsKey('monokle.io', 'v1alpha1', 'policies') +
      ':delete',
  )
  private onPolicyRemoval(rawPolicy: MonoklePolicy) {
    const policy = PoliciesService.postprocess(rawPolicy);

    this.log.log(`Policy removed: ${rawPolicy.metadata!.name}`);
    this.log.verbose({ rawPolicy, policy });

    this.policyStore.delete(rawPolicy.metadata!.name!);
    this.validatorStore.delete(policy.metadata!.name!);
  }

  @OnEvent(
    WatcherService.getEventsKey('monokle.io', 'v1alpha1', 'policybindings') +
      ':add',
  )
  @OnEvent(
    WatcherService.getEventsKey('monokle.io', 'v1alpha1', 'policybindings') +
      ':update',
  )
  private onBinding(rawBinding: MonoklePolicyBinding) {
    this.log.log(`Binding updated: ${rawBinding.metadata!.name}`);
    this.log.verbose({ rawBinding });

    this.bindingStore.set(rawBinding.metadata!.name!, rawBinding);
  }

  @OnEvent(
    WatcherService.getEventsKey('monokle.io', 'v1alpha1', 'policybindings') +
      ':delete',
  )
  private onBindingRemoval(rawBinding: MonoklePolicyBinding) {
    this.log.log(`Binding removed: ${rawBinding.metadata!.name}`);
    this.log.verbose({ rawBinding });

    this.bindingStore.delete(rawBinding.metadata!.name!);
  }

  // Based on K8s docs here - https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#matchresources-v1beta1-admissionregistration-k8s-io:
  private isResourceMatching(
    binding: MonoklePolicyBinding,
    resource: AdmissionRequestObject,
    resourceNamespace?: V1Namespace,
  ): boolean {
    const namespaceMatchLabels =
      binding.spec.matchResources?.namespaceSelector?.matchLabels;
    const namespaceMatchExpressions =
      binding.spec.matchResources?.namespaceSelector?.matchExpressions ?? [];
    const kind = resource.kind.toLowerCase();
    const isClusterWide =
      ((resource as any).namespace || resource.metadata.namespace) ===
      undefined;

    this.log.verbose('Checking if resource matches binding', {
      namespaceMatchLabels,
      namespaceMatchExpressions,
      kind,
      resourceMetadata: resource.metadata.labels,
    });

    // If non of the matchers are specified, then the resource matches, both cluster wide and namespaced ones.
    // So this is global policy. As in docs:
    // > Default to the empty LabelSelector, which matches everything.
    if (!namespaceMatchLabels && !namespaceMatchExpressions?.length) {
      return true;
    }

    // Skip cluster-wide resources if namespaceSelector defined.
    // This is different from the K8s docs which says:
    // > If the object itself is a namespace (...) If the object is another cluster scoped resource, it never skips the policy.
    if (isClusterWide && kind !== 'namespace') {
      return false;
    }

    // If resource is Namespace use it, if not get resource owning namespace.
    // > If the object itself is a namespace, the matching is performed on object.metadata.labels
    const namespaceObject = kind !== 'namespace' ? resourceNamespace : resource;
    if (!namespaceObject) {
      return false;
    }

    const namespaceObjectLabels = namespaceObject?.metadata?.labels || {};

    // Convert matchLabels to matchExpressions to have single matching logic. As in docs:
    // > matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels
    // > map is equivalent to an element of matchExpressions, whose key field is "key", the operator
    // > is "In", and the values array contains only "value". The requirements are ANDed.
    if (namespaceMatchLabels) {
      Object.entries(namespaceMatchLabels).forEach((entry) => {
        namespaceMatchExpressions.push({
          key: entry[0],
          operator: 'In',
          values: [entry[1]],
        });
      });
    }

    let isMatching = true;
    if (namespaceMatchExpressions.length) {
      for (const expression of namespaceMatchExpressions) {
        let labelValue = namespaceObjectLabels[expression.key];

        // Try default K8s labels for specific keys if there is no value.
        if (!labelValue && expression.key === 'name') {
          labelValue =
            namespaceObjectLabels[`kubernetes.io/metadata.${expression.key}`];
        }

        if (
          expression.operator === 'In' &&
          !expression.values.includes(labelValue)
        ) {
          isMatching = false;
          break;
        }

        // If label is not there it fits into 'NotIn' scenario.
        if (
          expression.operator === 'NotIn' &&
          expression.values.includes(labelValue)
        ) {
          isMatching = false;
          break;
        }
      }
    }

    return isMatching;
  }
}
