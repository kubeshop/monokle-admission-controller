import {readFileSync} from "fs";
import path from "path";
import fastify from "fastify";

const server = fastify({
    https: {
      key: readFileSync(path.join(__dirname, '..', 'secrets', 'webhook-server-tls.key')),
      cert: readFileSync(path.join(__dirname, '..', 'secrets', 'webhook-server-tls.crt'))
    }
  });

type Response = {
    status: "ok" | "error",
}

server.get("/validate", async (req, res): Promise<Response> => {
    console.log(req.headers, req.body)

  return {
    status: "ok",
  }
});

server.listen(3000, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});