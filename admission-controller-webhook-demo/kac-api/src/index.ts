import {readFileSync} from "fs";
import path from "path";
import fastify from "fastify";

const server = fastify({
    https: {
      key: readFileSync(path.join('/run/secrets/tls', 'tls.key')),
      cert: readFileSync(path.join('/run/secrets/tls', 'tls.crt'))
    }
  });

type AdmissionResponse = {
    response: {
        allowed: boolean,
        status: {
            message: string
        }
    }
}

server.post("/validate", async (req, res): Promise<AdmissionResponse> => {
  console.log(req.headers, req.body)

  return {
    response: {
      allowed: true,
      status: {
        message: "You are allowed!"
      }
    }
  }
});

const PORT = 8443;

server.listen({port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});