import {MonokleValidator} from "@monokle/validation";
import {PolicyManager} from "./policy-manager";

export class ValidatorManager {
  private _validators = new Map<string, MonokleValidator>(); // Map<policyName, validator>

  constructor(
    private readonly _policyManager: PolicyManager,
  ) {
    // @TODO implement this._policyManager.on(policyUpdated, this._reloadValidator)
    // We should preload configuration here instead of in getMatchingValidators since
    // it would affect performance of the admission webhook response time
  }

  getMatchingValidators(): MonokleValidator[] {
    const matchingPolicies = this._policyManager.getMatchingPolicies();

    if (matchingPolicies.length === 0) {
      return [];
    }

    // @TODO
    return [];
  }
}