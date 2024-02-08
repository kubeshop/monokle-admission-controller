import {Injectable, Logger} from "@nestjs/common";
import {InformerWrapper} from "../utils/kube-client";
import {EventEmitter} from "events";
import {AdmissionRequestObject} from "../utils/validation-server";
import {V1Namespace} from "@kubernetes/client-node";
import {Config} from "@monokle/validation";
import {MonokleApplicablePolicy, MonoklePolicy, MonoklePolicyBinding} from "./policies.models";

@Injectable()
export class PoliciesManagerService extends EventEmitter {
    private static readonly PLUGIN_BLOCKLIST = [
        'resource-links',
    ];

    private readonly _logger = new Logger(PoliciesManagerService.name);

    private readonly _policies = new Map<string, MonoklePolicy>(); // Map<policyName, policy>
    private readonly _bindings = new Map<string, MonoklePolicyBinding>(); // Map<bindingName, binding>

    constructor(
        private readonly _policyInformer: InformerWrapper<MonoklePolicy>,
        private readonly _bindingInformer: InformerWrapper<MonoklePolicyBinding>,
    ) {
        super();

        this._policyInformer.informer.on('add', this.onPolicy.bind(this));
        this._policyInformer.informer.on('update', this.onPolicy.bind(this));
        this._policyInformer.informer.on('delete', this.onPolicyRemoval.bind(this));

        this._bindingInformer.informer.on('add', this.onBinding.bind(this));
        this._bindingInformer.informer.on('update', this.onBinding.bind(this));
        this._bindingInformer.informer.on('delete', this.onBindingRemoval.bind(this));
    }

    private static postprocess(policy: MonoklePolicy) {
        const newPolicy = { ...policy };
        newPolicy.spec = PoliciesManagerService.blockPlugins(newPolicy.spec);
        return newPolicy;
    }

    private static blockPlugins(policySpec: Config): Config {
        if (policySpec.plugins === undefined) {
            return policySpec;
        }

        const newPlugins = { ...policySpec.plugins };
        for (const blockedPlugin of PoliciesManagerService.PLUGIN_BLOCKLIST) {
            if (newPlugins[blockedPlugin] === true) {
                newPlugins[blockedPlugin] = false;
            }
        }

        return {
            ...policySpec,
            plugins: newPlugins,
        };
    }


    getMatchingPolicies(resource: AdmissionRequestObject, resourceNamespace?: V1Namespace): MonokleApplicablePolicy[] {
        this._logger.debug({policies: this._policies.size, bindings: this._bindings.size});

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

                if (binding.spec.matchResources && !this.isResourceMatching(binding, resource, resourceNamespace)) {
                    return null;
                }

                return {
                    policy: policy.spec,
                    binding: binding.spec
                }
            })
            .filter((policy) => policy !== null) as MonokleApplicablePolicy[];
    }

    private onPolicy(rawPolicy: MonoklePolicy) {
        const policy = PoliciesManagerService.postprocess(rawPolicy);

        this._logger.debug({msg: 'Policy updated', rawPolicy, policy});

        this._policies.set(rawPolicy.metadata!.name!, policy);

        this.emit('policyUpdated', policy);
    }

    private onPolicyRemoval(rawPolicy: MonoklePolicy) {
        const policy = PoliciesManagerService.postprocess(rawPolicy);

        this._logger.debug({msg: 'Policy removed', rawPolicy, policy});

        this._policies.delete(rawPolicy.metadata!.name!);

        this.emit('policyRemoved', policy);
    }

    private onBinding(rawBinding: MonoklePolicyBinding) {
        this._logger.debug({msg: 'Binding updated', rawBinding});

        this._bindings.set(rawBinding.metadata!.name!, rawBinding);

        this.emit('bindingUpdated', rawBinding);
    }

    private onBindingRemoval(rawBinding: MonoklePolicyBinding) {
        this._logger.debug({msg: 'Binding removed', rawBinding});

        this._bindings.delete(rawBinding.metadata!.name!);

        this.emit('bindingRemoved', rawBinding);
    }

    // Based on K8s docs here - https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#matchresources-v1beta1-admissionregistration-k8s-io:
    private isResourceMatching(binding: MonoklePolicyBinding, resource: AdmissionRequestObject, resourceNamespace?: V1Namespace): boolean {
        const namespaceMatchLabels = binding.spec.matchResources?.namespaceSelector?.matchLabels;
        const namespaceMatchExpressions = binding.spec.matchResources?.namespaceSelector?.matchExpressions ?? [];
        const kind = resource.kind.toLowerCase();
        const isClusterWide = ((resource as any).namespace || resource.metadata.namespace) === undefined;

        this._logger.verbose({
            msg: 'Checking if resource matches binding',
            namespaceMatchLabels,
            namespaceMatchExpressions,
            kind,
            resourceMetadata: resource.metadata.labels
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
            Object.entries(namespaceMatchLabels).forEach(entry => {
                namespaceMatchExpressions.push({
                    key: entry[0],
                    operator: 'In',
                    values: [entry[1]]
                });
            });
        }

        let isMatching = true;
        if (namespaceMatchExpressions.length) {
            for (const expression of namespaceMatchExpressions) {
                let labelValue = namespaceObjectLabels[expression.key];

                // Try default K8s labels for specific keys if there is no value.
                if (!labelValue && expression.key === 'name') {
                    labelValue = namespaceObjectLabels[`kubernetes.io/metadata.${expression.key}`]
                }

                if (expression.operator === 'In' && !expression.values.includes(labelValue)) {
                    isMatching = false;
                    break;
                }

                // If label is not there it fits into 'NotIn' scenario.
                if (expression.operator === 'NotIn' && expression.values.includes(labelValue) ) {
                    isMatching = false;
                    break;
                }
            }
        }

        return isMatching;
    }
}
