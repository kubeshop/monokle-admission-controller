import fastify from "fastify";
import path from "path";
import { readFileSync } from "fs";
import { MonokleValidator, Resource } from "@monokle/validation";
import {V1ValidatingWebhookConfiguration, V1ObjectMeta} from "@kubernetes/client-node";

export type ValidationServerOptions = {
  port: number;
  host: string;
};

type AdmissionRequest = V1ValidatingWebhookConfiguration & {
  request?: V1ObjectMeta & {
    object?: Resource
  }
}

type AdmissionResponse = {
  kind: string,
  apiVersion: string,
  response: {
      uid: string,
      allowed: boolean,
      status: {
          message: string
      }
  }
}

export class ValidationServer {
  private _server: ReturnType<typeof fastify>;
  private _shouldValidate: boolean

  constructor(
    private readonly _validator: MonokleValidator,
    private readonly _options: ValidationServerOptions = {
      port: 8443,
      host: '0.0.0.0'
    }
  ) {
    this._shouldValidate = false;

    this._server = fastify({
      // @TODO do not require certs when running locally (for testing outside K8s cluster)
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

        console.log(`Server listening at ${address}`);

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
    this._server.post("/validate", async (req, res): Promise<AdmissionResponse> => {
      console.log('request', req.headers, req.body)

      const body = req.body as AdmissionRequest;

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

      // Dev workaround - always return true for webhook server to not block hot-reload
      if (body.request?.name?.startsWith('webhook-server-')) {
        console.log('Allowing webhook server to pass', response);

        return response;
      }

      const resourceForValidation = this._createResourceForValidation(body);
      const validationResponse = await this._validator.validate({ resources: [resourceForValidation] });

      const warnings = [];
      const errors = [];
      for (const result of validationResponse.runs) {
        for (const item of result.results) {
          if (item.level === "warning") {
            warnings.push(item);
          } else if (item.level === "error") {
            errors.push(item);
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

      console.log('response', resourceForValidation, validationResponse, response);

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
