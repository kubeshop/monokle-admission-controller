import {readFileSync} from "fs";
import path from "path";
import fastify from "fastify";
import {V1ValidatingWebhookConfiguration, V1ObjectMeta} from "@kubernetes/client-node";
import {createDefaultMonokleValidator, Resource} from "@monokle/validation";
import { getInformer } from "./utils/informer";

// TODO - some mismatch with types, this is not exactly the type which should be used
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






const server = fastify({
  https: {
    key: readFileSync(path.join('/run/secrets/tls', 'tls.key')),
    cert: readFileSync(path.join('/run/secrets/tls', 'tls.crt'))
  }
});


// Validate endpoint logic should be as thin as possible to reduce impact on resource creation time.
// All the preloading related to validator should be done separately (before or in the meantime).
server.post("/validate", async (req, res): Promise<AdmissionResponse> => {
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

  // Dev workaround - always return true for webhok server to not block hot-reload
  if (body.request?.name?.startsWith('webhook-server-')) {
    console.log('Allowing webhook server to pass', response);

    return response;
  }

  await validator.preload({
    plugins: {
      "kubernetes-schema": true,
      "open-policy-agent": true,
    },
  });

  const resourceForValidation = createResourceForValidation(body);
  const validationResponse = await validator.validate({ resources: [resourceForValidation] });

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

server.listen({port: 8443, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});

function createResourceForValidation(admissionResource: AdmissionRequest): Resource {
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

async function init() {
  let awaitValidatorReadiness = Promise.resolve();
  let hasPolicy = false;

  // kube-client get current namespace where webhook is deployed
  // https://stackoverflow.com/a/46046153

  // init validator
  const validator = createDefaultMonokleValidator();

  // init informer
  const informer = await getInformer(
    // For now the assumption is there is one policy per namespace.
    async (obj) => {
      const policyConfig = obj.spec;

      hasPolicy = true;
      awaitValidatorReadiness = validator.preload(policyConfig);
      await awaitValidatorReadiness;
    },
    async (obj) => {
      const policyConfig = obj.spec;

      hasPolicy = true;
      awaitValidatorReadiness = validator.preload(policyConfig);
      await awaitValidatorReadiness;
    },
    (obj) => {
      // if policy was deleted, we fallback to default, disabled policy?
      // or just skip validation for new resources (because it doesn't make sense to validate against empty policy anyways)
      hasPolicy = false;
    }
  );

  // init server
}