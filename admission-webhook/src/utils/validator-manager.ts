import {AnnotationSuppressor, Config, DisabledFixer, FingerprintSuppressor, MonokleValidator, RemotePluginLoader, ResourceParser, SchemaLoader} from "@monokle/validation";
import {MonokleApplicablePolicy, PolicyManager} from "./policy-manager";

export type MonokleApplicableValidator = {
  validator: MonokleValidator,
  policy: MonokleApplicablePolicy
}

export class ValidatorManager {
  private _validators = new Map<string, MonokleValidator>(); // Map<policyName, validator>

  constructor(
    private readonly _policyManager: PolicyManager,
  ) {
    // @TODO implement this._policyManager.on(policyUpdated, this._reloadValidator)
    // We should preload configuration here instead of in getMatchingValidators since
    // it would affect performance of the admission webhook response time
  }

  getMatchingValidators(): MonokleApplicableValidator[] {
    const matchingPolicies = this._policyManager.getMatchingPolicies();

    if (matchingPolicies.length === 0) {
      return [];
    }

    return matchingPolicies.map((policy) => {
      if (!this._validators.has(policy.binding.policyName)) {
        this.setupValidator(policy.binding.policyName, policy.policy);
      }

      return {
        validator: this._validators.get(policy.binding.policyName)!,
        policy
      }
    });
  }

  private async setupValidator(policyName: string, policy: Config) {
    if (this._validators.has(policyName)) {
      this._validators.get(policyName)!.preload(policy);
    } else {
      const validator = new MonokleValidator(
        {
          loader: new RemotePluginLoader(),
          parser: new ResourceParser(),
          schemaLoader: new SchemaLoader(),
          suppressors: [new AnnotationSuppressor(), new FingerprintSuppressor()],
          fixer: new DisabledFixer(),
        },
        policy
      );

      this._validators.set(policyName, validator);
    }
  }
}