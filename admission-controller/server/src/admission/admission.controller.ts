import { Body, Controller, Logger, Post } from '@nestjs/common';
import {
  AdmissionRequest,
  AdmissionResponse,
  Violation,
} from './admission.models';
import { Resource, ValidationResult } from '@monokle/validation';
import { ConfigService } from '../shared/config.service';
import { PoliciesService } from '../policies/policies.service';
import { ResourceService } from '../kubernetes/resource.service';

@Controller('validate')
export class AdmissionController {
  private readonly log = new Logger(AdmissionController.name);
  private readonly ignoredNamespaces: string[];

  constructor(
    private readonly $config: ConfigService,
    private readonly $policies: PoliciesService,
    private readonly $kubernetes: ResourceService,
  ) {
    this.ignoredNamespaces = this.$config.get('ignoredNamespaces') ?? [];
  }

  private static createResourceForValidation(
    admissionResource: AdmissionRequest,
  ): Resource {
    const resource = {
      id: admissionResource.request?.uid || '',
      fileId: '',
      filePath: '',
      fileOffset: 0,
      name: admissionResource.request?.name || '',
      apiVersion: admissionResource.request?.object?.apiVersion || '',
      kind: admissionResource.request?.object?.kind || '',
      namespace: admissionResource.request?.namespace || '',
      content: admissionResource.request?.object || {},
      text: '',
    };

    return resource;
  }

  private static handleViolationsByAction(
    violationsByAction: Record<string, Violation[]>,
    resource: Resource,
    response: AdmissionResponse,
  ) {
    for (const action of Object.keys(violationsByAction)) {
      // 'Warn' action should be mapped to warnings, see:
      // - https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/#validation-actions
      // - https://kubernetes.io/blog/2020/09/03/warnings/
      if (action.toLowerCase() === 'warn') {
        response = this.handleViolationsAsWarn(
          violationsByAction[action],
          resource,
          response,
        );
      } else if (action.toLowerCase() === 'deny') {
        const violationMessages = this.getViolationsMessages(
          violationsByAction[action],
          resource,
        );

        response.response.allowed = false;
        response.response.status.message = violationMessages.join('\n');
      }
    }

    return response;
  }

  private static handleViolationsAsWarn(
    violations: Violation[],
    resource: Resource,
    response: AdmissionResponse,
  ) {
    const violationMessages = AdmissionController.getViolationsMessages(
      violations,
      resource,
    );
    if (violationMessages.length > 0) {
      response.response.warnings = violationMessages;
    }

    return response;
  }

  private static getViolationsMessages(
    violations: Violation[],
    resource: Resource,
  ): string[] {
    const errors = violations
      .filter((v) => v.level === 'error')
      .map((e) => AdmissionController.formatViolationMessage(e, resource));

    const warnings = violations
      .filter((v) => v.level === 'warning')
      .map((e) => AdmissionController.formatViolationMessage(e, resource));

    if (errors.length > 0 || warnings.length > 0) {
      return [
        `Monokle Admission Controller found ${errors.length} errors and ${warnings.length} warnings:`,
        ...errors,
        ...warnings,
        'You can use Monokle Cloud (https://monokle.io/) to fix those errors easily.',
      ];
    }

    return [];
  }

  private static getFullyQualifiedName(result: ValidationResult) {
    const locations = result.locations;
    const locationWithName = locations.find(
      (l) =>
        l.logicalLocations?.length &&
        l.logicalLocations.length > 0 &&
        l.logicalLocations[0].fullyQualifiedName,
    );

    return locationWithName
      ? (locationWithName.logicalLocations || [])[0].fullyQualifiedName
          ?.replace(/\./g, '/')
          .replace('@', '')
          .trim()
      : null;
  }

  private static formatViolationMessage(
    violation: Violation,
    resource: Resource,
  ) {
    return `${violation.ruleId} (${
      violation.level
    }): ${violation.message.text.replace(/\.$/, '')}, in kind "${
      resource.kind
    }" with name "${violation.name}".`;
  }

  @Post()
  async validate(@Body() body: AdmissionRequest): Promise<AdmissionResponse> {
    this.log.verbose({ body });
    const namespace =
      body.request?.namespace || body.request?.object?.metadata?.namespace;

    const response = {
      kind: body?.kind || '',
      apiVersion: body?.apiVersion || '',
      response: {
        uid: body?.request?.uid || '',
        allowed: true,
        status: {
          message: 'OK',
        },
      },
    };

    if (namespace && this.ignoredNamespaces.includes(namespace)) {
      this.log.error({ msg: 'Namespace ignored', namespace });
      return response;
    }

    const resource = body.request?.object;
    if (!resource) {
      this.log.error({ msg: 'No resource found', metadata: body.request });
      return response;
    }

    const namespaceObject = namespace
      ? await this.$kubernetes.getNamespace(namespace)
      : undefined;
    this.log.debug({ namespaceObject });

    const validators = this.$policies.getMatchingValidators(
      resource,
      namespaceObject,
    );

    this.log.debug({ msg: 'Matching validators', count: validators.length });

    if (validators.length === 0) {
      return response;
    }

    const resourceForValidation =
      AdmissionController.createResourceForValidation(body);
    const validationResponses = await Promise.all(
      validators.map(async (validator) => {
        return {
          result: await validator.validator.validate({
            resources: [resourceForValidation],
          }),
          policy: validator.policy,
        };
      }),
    );

    const violations: Violation[] = [];
    for (const validationResponse of validationResponses) {
      const actions = validationResponse.policy.binding.validationActions;

      for (const result of validationResponse.result.runs) {
        for (const item of result.results) {
          violations.push({
            ruleId: item.ruleId,
            message: item.message,
            level: item.level,
            actions: actions,
            name:
              AdmissionController.getFullyQualifiedName(item) ??
              resourceForValidation.name,
          });
        }
      }
    }

    this.log.verbose({ resourceForValidation, validationResponses });

    if (violations.length === 0) {
      this.log.debug({ msg: 'No violations', response });
      return response;
    }

    const violationsByAction = violations.reduce(
      (acc: Record<string, Violation[]>, violation: Violation) => {
        const actions = violation.actions;

        for (const action of actions) {
          if (!acc[action]) {
            acc[action] = [];
          }

          acc[action].push(violation);
        }

        return acc;
      },
      {},
    );

    const responseFull = AdmissionController.handleViolationsByAction(
      violationsByAction,
      resourceForValidation,
      response,
    );

    this.log.debug({ response });
    return responseFull;
  }
}
