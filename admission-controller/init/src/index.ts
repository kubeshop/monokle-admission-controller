import k8s from '@kubernetes/client-node';
import logger from './utils/logger.js';
import { generateCertificates } from './utils/certificates.js';
import { getSecretCertificate, applySecretCertificate, updateWebhookCertificate } from './utils/kubernetes.js';

const NAMESPACE = 'monokle-admission-controller';
const SECRET_NAME = 'monokle-admission-controller-tls';
const WEBHOOK_NAME = 'demo-webhook'; // monokle-admission-controller-webhook

(async () => {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();

  const existingCert = await getSecretCertificate(NAMESPACE, SECRET_NAME, kc);

  if (existingCert) {
    // @TODO validate existing cert (expiration date)
    logger.info('Secret already exists. Skipping.');
    return;
  }

  const certs = generateCertificates();
  const certCreated = await applySecretCertificate(NAMESPACE, SECRET_NAME, certs.serverKey, certs.serverCert, kc);

  if (!certCreated) {
    logger.error('Failed to create secret');
    return;
  }

  logger.info('Secret created');

  const webhookUpdated = updateWebhookCertificate(NAMESPACE, WEBHOOK_NAME, certs.serverCert, kc);

  if (!webhookUpdated) {
    logger.error('Failed to update webhook');
    return;
  }

  logger.info('Webhook updated created');
})();
