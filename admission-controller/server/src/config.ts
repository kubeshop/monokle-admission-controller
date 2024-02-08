import * as FS from 'node:fs/promises';

const Configuration = {
  logLevel: process.env.MONOKLE_LOG_LEVEL ?? 'warn',
  ignoredNamespaces: (process.env.MONOKLE_IGNORE_NAMESPACES ?? '')
    .split(',')
    .filter(Boolean),

  server: {
    host: '0.0.0.0',
    port: 8443,
    tls: {
      key: process.env.TLS_KEY ?? '/run/secrets/tls/tls.key',
      cert: process.env.TLS_CERT ?? '/run/secrets/tls/tls.crt',
    },
  },
};

Configuration.server.tls.key = await FS.readFile(
  Configuration.server.tls.key,
).then((buffer) => buffer.toString());

Configuration.server.tls.cert = await FS.readFile(
  Configuration.server.tls.cert,
).then((buffer) => buffer.toString());

export default Configuration;
