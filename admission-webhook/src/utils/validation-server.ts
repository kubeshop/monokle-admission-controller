import fastify from "fastify";
import pino from 'pino';
import path from "path";
import {readFileSync} from "fs";
import {Resource} from "@monokle/validation";
import {V1ObjectMeta} from "@kubernetes/client-node";
import {ValidatorManager} from "./validator-manager";

export type ValidationServerOptions = {
  port: number;
  host: string;
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

export type AdmissionResponse = {
  kind: string,
  apiVersion: string,
  response: {
      uid: string,
      allowed: boolean,
      status: {
          message: string
      }
  }
};

export class ValidationServer {
  private _server: ReturnType<typeof fastify>;
  private _shouldValidate: boolean

  constructor(
    private readonly _validators: ValidatorManager,
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

      this._logger.debug({request: req})
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

      if (!namespace) {
        this._logger.error({msg: 'No namespace found', metadata: body.request});
        return response;
      }

      const resource = body.request?.object;
      if (!resource) {
        this._logger.error({msg: 'No resource found', metadata: body.request});
        return response;
      }

      const validators = this._validators.getMatchingValidators(resource, namespace);

      this._logger.debug({msg: 'Matching validators', count: validators.length});

      if (validators.length === 0) {
        return response;
      }

      // @TODO should not be a part of production code
      // Dev workaround - always return true for webhook server to not block hot-reload
      if (body.request?.name?.startsWith('webhook-server-')) {
        this._logger.debug({msg: 'Allowing webhook server to pass', response});

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

      // @TODO each result may have different `validationActions` (defined in bindings) so it should be handled
      // it can by be grouping results by action and then  performing action for each group

      const warnings = [];
      const errors = [];
      for (const validationResponse of validationResponses) {
        for (const result of validationResponse.result.runs) {
          for (const item of result.results) {
            if (item.level === "warning") {
              warnings.push(item);
            } else if (item.level === "error") {
              errors.push(item);
            }
          }
        }
      }

      if (errors.length > 0 || warnings.length > 0) {
        const warningsList = warnings.map((e) => `${e.ruleId}: ${e.message.text}`).join("\n");
        const errorsList = errors.map((e) => `${e.ruleId}: ${e.message.text}`).join("\n");
        const message = [];

        if (errors.length > 0) {
          message.push(`\n${errors.length} errors found:\n${errorsList}\n`);
        }

        if (warnings.length > 0) {
          message.push(`\n${warnings.length} warnings found:\n${warningsList}\n`);
        }

        message.push("\nYou can use Monokle (https://monokle.io/) to validate and fix those errors easily!");

        response.response.allowed = false;
        response.response.status.message = message.join("");
      }

      this._logger.debug({response});
      this._logger.trace({resourceForValidation, validationResponses});

      return response;
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
}
