import { Injectable, Logger } from '@nestjs/common';
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
import { PoliciesManagerService } from './policies.manager.service';
import { V1Namespace } from '@kubernetes/client-node';
import { MonokleApplicableValidator } from './policies.models';
import { AdmissionRequestObject } from '../admission/admission.models';

@Injectable()
export class ValidationService {
  private _validators = new Map<string, MonokleValidator>(); // Map<policyName, validator>
  private readonly _logger = new Logger(ValidationService.name);

  constructor(private readonly $manager: PoliciesManagerService) {
    this.$manager.on('policyUpdated', async (policy) => {
      await this.setupValidator(policy.metadata!.name!, policy.spec);
    });

    this.$manager.on('policyRemoved', async (policy) => {
      await this._validators.delete(policy.metadata!.name!);
    });
  }

  getMatchingValidators(
    resource: AdmissionRequestObject,
    resourceNamespace?: V1Namespace,
  ): MonokleApplicableValidator[] {
    const matchingPolicies = this.$manager.getMatchingPolicies(
      resource,
      resourceNamespace,
    );

    if (matchingPolicies.length === 0) {
      return [];
    }

    return matchingPolicies
      .map((policy) => {
        if (!this._validators.has(policy.binding.policyName)) {
          // This should not happen and means there is a bug in other place in the code. Raise warning and skip.
          // Do not create validator instance here to keep this function sync and to keep processing time low.
          this._logger.warn({
            msg: 'ValidatorManager: Validator not found',
            policyName: policy.binding.policyName,
          });
          return null;
        }

        return {
          validator: this._validators.get(policy.binding.policyName)!,
          policy,
        };
      })
      .filter(
        (validator) => validator !== null,
      ) as MonokleApplicableValidator[];
  }

  private async setupValidator(policyName: string, policy: Config) {
    if (this._validators.has(policyName)) {
      await this._validators.get(policyName)!.preload(policy);
    } else {
      const validator = new MonokleValidator({
        loader: new RemotePluginLoader(),
        parser: new ResourceParser(),
        schemaLoader: new SchemaLoader(),
        suppressors: [new AnnotationSuppressor(), new FingerprintSuppressor()],
        fixer: new DisabledFixer(),
      });

      // Run separately (instead of passing config to constructor) to make sure that validator
      // is ready when 'setupValidator' function call fulfills.
      await validator.preload(policy);

      this._validators.set(policyName, validator);
    }
  }
}
