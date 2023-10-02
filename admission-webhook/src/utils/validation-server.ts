import fastify from "fastify";
import pino from 'pino';
import path from "path";
import {readFileSync} from "fs";
import {Message, Resource, RuleLevel} from "@monokle/validation";
import {V1ObjectMeta} from "@kubernetes/client-node";
import {ValidatorManager} from "./validator-manager";

export type ValidationServerOptions = {
  port: number
  host: string
};

export type AdmissionRequestObject = {
  apiVersion: string
  kind: string
  metadata: V1ObjectMeta
  spec: any
  status: any
};

export type AdmissionRequest = {
  apiVersion: string
  kind: string
  request: {
    name: string
    namespace: string
    uid: string
    object: AdmissionRequestObject
  }
};

// See
// https://pkg.go.dev/k8s.io/api/admission/v1#AdmissionResponse
// https://kubernetes.io/docs/reference/config-api/apiserver-admission.v1/#admission-k8s-io-v1-AdmissionReview
export type AdmissionResponse = {
  kind: string
  apiVersion: string
  response: {
      uid: string
      allowed: boolean
      warnings?: string[]
      status: {
          message: string
      }
  }
};

export type Violation = {
  ruleId: string
  message: Message
  level?: RuleLevel
  actions: string[]
}

export class ValidationServer {
  private _server: ReturnType<typeof fastify>;
  private _shouldValidate: boolean

  constructor(
    private readonly _validators: ValidatorManager,
    private readonly _ignoredNamespaces: string[],
    private readonly _logger: ReturnType<typeof pino>,
    private readonly _options: ValidationServerOptions = {
      port: 8443,
      host: '0.0.0.0'
    }
  ) {
    this._shouldValidate = false;

    this._server = fastify({
      https: {
        key: readFileSync(path.join('/run/secrets/tls', 'tls.key')),
        cert: readFileSync(path.join('/run/secrets/tls', 'tls.crt'))
      }
    });

    this._initRouting();
  }

  get shouldValidate() {
    return this._shouldValidate;
  }

  set shouldValidate(value: boolean) {
    this._shouldValidate = value;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this._server.listen({port: this._options.port, host: this._options.host}, (err, address) => {
        if (err) {
          reject(err);
        }

        this._logger.info(`Server listening at ${address}`);

        this.shouldValidate = true;

        resolve(address);
      });

    });
  }

  async stop() {
    this.shouldValidate = false;

    if (this._server) {
      await this._server.close();
    }
  }

  private async _initRouting() {
    this._server.post("/validate", async (req, _res): Promise<AdmissionResponse> => {

      this._logger.trace({requestBody: req.body});

      const body = req.body as AdmissionRequest;
      const namespace = body.request?.namespace;

      const response = {
        kind: body?.kind || '',
        apiVersion: body?.apiVersion || '',
        response: {
          uid: body?.request?.uid || "",
          allowed: true,
          status: {
            message: "OK"
          }
        }
      }

      if (!namespace || this._ignoredNamespaces.includes(namespace)) {
        this._logger.error({msg: 'No namespace found or namespace ignored', namespace});
        return response;
      }

      const resource = body.request?.object;
      if (!resource) {
        this._logger.error({msg: 'No resource found', metadata: body.request});
        return response;
      }

      this._logger.debug({request: req});

      const validators = this._validators.getMatchingValidators(resource, namespace);

      this._logger.debug({msg: 'Matching validators', count: validators.length});

      if (validators.length === 0) {
        return response;
      }

      const resourceForValidation = this._createResourceForValidation(body);
      const validationResponses = await Promise.all(validators.map(async (validator) => {
        return {
          result: await validator.validator.validate({ resources: [resourceForValidation] }),
          policy: validator.policy
        };
        }
      ));

      const violations: Violation[] = [];
      for (const validationResponse of validationResponses) {
        const actions = validationResponse.policy.binding.validationActions;

        for (const result of validationResponse.result.runs) {
          for (const item of result.results) {
            violations.push({
              ruleId: item.ruleId,
              message: item.message,
              level: item.level,
              actions: actions
            });
          }
        }
      }

      const violationsByAction = violations.reduce((acc: Record<string, Violation[]>, violation: Violation) => {
        const actions = violation.actions;

        for (const action of actions) {
          if (!acc[action]) {
            acc[action] = [];
          }

          acc[action].push(violation);
        }

        return acc;
      }, {});

      const responseFull = this._handleViolationsByAction(violationsByAction, response);

      this._logger.debug({response});
      this._logger.trace({resourceForValidation, validationResponses});

      return responseFull;
    });
  }

  private _createResourceForValidation(admissionResource: AdmissionRequest): Resource {
    const resource = {
      id: admissionResource.request?.uid || '',
      fileId: '',
      filePath: '',
      fileOffset: 0,
      name: admissionResource.request?.name || '',
      apiVersion:  admissionResource.request?.object?.apiVersion || '',
      kind: admissionResource.request?.object?.kind || '',
      namespace: admissionResource.request?.namespace || '',
      content: admissionResource.request?.object || {},
      text: ''
    };

    return resource;
  }

  private _handleViolationsByAction(violationsByAction: Record<string, Violation[]>, response: AdmissionResponse) {
    for (const action of Object.keys(violationsByAction)) {
      // 'Warn' action shouldbe mapped to warnings, see:
      // - https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/#validation-actions
      // - https://kubernetes.io/blog/2020/09/03/warnings/
      if (action.toLowerCase() === 'warn') {
        response = this._handleViolationsAsWarn(violationsByAction[action], response);
      }
    }

    return response;
  }

  private _handleViolationsAsWarn(violations: Violation[], response: AdmissionResponse) {
    const warnings = violations.filter((v) => v.level === 'warning').map((e) => `${e.ruleId}: ${e.message.text}`);
    const errors = violations.filter((v) => v.level === 'error').map((e) => `${e.ruleId}: ${e.message.text}`);

    if (errors.length > 0 || warnings.length > 0) {
      response.response.warnings = [
        `Monokle Admission Controller found:`,
        `Errors: ${errors.length}`,
        ...errors,
        `Warnings: ${warnings.length}`,
        ...warnings,
        "You can use Monokle (https://monokle.io/) to validate and fix those errors easily!"
      ];
    }

    return response;
  }
}
