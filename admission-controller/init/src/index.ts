import k8s from '@kubernetes/client-node';
import retry from 'async-retry';
import logger, { formatLog } from './utils/logger.js';
import { generateCertificates, isCertValid } from './utils/certificates.js';
import { getSecretCertificate, applySecretCertificate, getWebhookConfiguration, patchWebhookCertificate } from './utils/kubernetes.js';

const NAMESPACE = 'monokle-admission-controller';
const SECRET_NAME = 'monokle-admission-controller-tls';
const WEBHOOK_NAME = 'monokle-admission-controller-webhook';

(async () => {
  await retry(run, {
    retries: 5,
    factor: 3,
    onRetry: (err, attempt) => {
      logger.error(formatLog(`Cert init attempt ${attempt} failed. Retrying...`, err));
    }
  });
})();

// The flow is as follows:
//
// 1. Fetch webhook resource.
//   - If there is none, it doesn't make sense to continue. Throw an error and retry.
// 2. Fetch secret data (containing our cert).
// 3. Check cert validity.
//   - If valid, exit.
//   - If empty or invalid, generate new secret
// 4. Write cert to webhook.
// 5. Write cert to secret.
//
// Such order of actions prevents from cases where secret (with) cert is updated but webhook is not.
// At the same time, entire process is treated as atomic one, if something goes wrong, retry from the beginning.
async function run(_bail: (e: Error) => void, _attempt: number) {
  const kc = new k8s.KubeConfig();
  kc.loadFromCluster();

  const webhookConfig = await getWebhookConfiguration(NAMESPACE, WEBHOOK_NAME, kc);
  if (!webhookConfig) {
    throw new Error(`Webhook ${NAMESPACE}/${WEBHOOK_NAME} does not exist.`);
  }

  const existingCert = await getSecretCertificate(NAMESPACE, SECRET_NAME, kc);
  if (existingCert && isCertValid(existingCert.certificate)) {
    logger.info('Valid cert already exists.');
    return;
  }

  const certs = generateCertificates();

  const webhookPatched = patchWebhookCertificate(NAMESPACE, WEBHOOK_NAME, webhookConfig, certs.caCert, kc);
  if (!webhookPatched) {
    throw new Error('Failed to update webhook.');
  }

  logger.info('Webhook patched successfully.');

  const certCreated = await applySecretCertificate(NAMESPACE, SECRET_NAME, certs.serverKey, certs.serverCert, kc);
  if (!certCreated) {
    throw new Error('Failed to create secret.');
  }

  logger.info('Secret created successfully.');
}
