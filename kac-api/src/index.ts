import {readFileSync} from "fs";
import path from "path";
import fastify from "fastify";
import {V1ValidatingWebhookConfiguration, V1ObjectMeta} from "@kubernetes/client-node";

// For some reason the type definitions for the request body has 'metadata' filed instead of 'request'.
type AdmissionRequest = V1ValidatingWebhookConfiguration & {
    request?: V1ObjectMeta
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

server.post("/validate", async (req, res): Promise<AdmissionResponse> => {
  console.log('request', req.headers, req.body)

  const body = req.body as AdmissionRequest;

  const response = {
    kind: body?.kind || '',
    apiVersion: body?.apiVersion || '',
    response: {
      uid: body?.request?.uid || "",
      // allowed: false,
      allowed: true,
      status: {
        // message: "You shall not pass!"
        message: "You shall pass!"
      }
    }
  }

  console.log('response', response);

  return response;
});

const PORT = 8443;

server.listen({port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});