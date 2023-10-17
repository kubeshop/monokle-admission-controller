import k8s from '@kubernetes/client-node';
import forge from 'node-forge';
import logger, {formatLog} from './logger.js';

export type SecretCertificate = {
  secret: k8s.V1Secret;
  certificate: forge.pki.Certificate;
}

export async function getSecretCertificate(namespace: string, name: string, config: k8s.KubeConfig): Promise<SecretCertificate | null> {
  const k8sApi = config.makeApiClient(k8s.CoreV1Api);

  let res;
  try {
    res = await k8sApi.readNamespacedSecret(name, namespace);

    const secret = res.body;

    // Should not happen, means secret data is invalid/corrupted.
    if (!secret.data?.['tls.crt']) {
      throw new Error(`Secret ${namespace}/${name} does not contain a tls.crt.`);
    }

    const certificate = forge.pki.certificateFromPem(Buffer.from(secret.data['tls.crt'], 'base64').toString('utf8'));

    return {
      secret,
      certificate
    }
  } catch (err: any) {
    if (err.body?.code === 404) {
      logger.info(formatLog(`No existing secret ${namespace}/${name}`, err, res));
    } else {
      logger.error(formatLog(`Failed to read secret ${namespace}/${name}`, err, res));
    }

    return null;
  }
}

export async function applySecretCertificate(namespace: string, name: string, pk: forge.pki.PrivateKey, certificate: forge.pki.Certificate, config: k8s.KubeConfig) {
  const k8sApi = config.makeApiClient(k8s.CoreV1Api);

  const pemPK = forge.pki.privateKeyToPem(pk);
  const pemCert = forge.pki.certificateToPem(certificate);

  try {
    await k8sApi.deleteNamespacedSecret(name, namespace);
  } catch (err: any) {
    logger.debug(formatLog(`Failed to delete secret ${namespace}/${name}`), err);
  }

  let res;
  try {
    res = await k8sApi.createNamespacedSecret(namespace, {
      apiVersion: 'v1',
      kind: 'Secret',
      type: 'kubernetes.io/tls',
      metadata: {
          name,
      },
      data: {
          'tls.crt': Buffer.from(pemCert).toString('base64'),
          'tls.key': Buffer.from(pemPK).toString('base64'),
      },
    });

    if (res.response.statusCode !== 201) {
      throw new Error(`Failed to apply secret ${namespace}/${name} (non 201 status code)`);
    }

    return true;
  } catch (err: any) {
    logger.error(formatLog(`Failed to apply secret ${namespace}/${name}`, err, res));
    return false;
  }
}

export async function getWebhookConfiguration(namespace: string, name: string, config: k8s.KubeConfig): Promise<k8s.V1ValidatingWebhookConfiguration | null> {
  const client = k8s.KubernetesObjectApi.makeApiClient(config);

  let res;
  try {
    res = await client.read<k8s.V1ValidatingWebhookConfiguration>({
      apiVersion: 'admissionregistration.k8s.io/v1',
      kind: 'ValidatingWebhookConfiguration',
      metadata: {
        name,
        namespace,
      },
    });

    if (res.response.statusCode !== 200) {
      throw new Error(`Failed to get webhook ${namespace}/${name} (non 200 status code)`);
    }

    return res.body;
  } catch (err: any) {
    logger.error(formatLog(`Failed to get webhook ${namespace}/${name}`, err, res));
    return null;
  }
}

export async function patchWebhookCertificate(namespace: string, name: string, webhook: k8s.V1ValidatingWebhookConfiguration, certificate: forge.pki.Certificate, config: k8s.KubeConfig) {
  const k8sApi = config.makeApiClient(k8s.AdmissionregistrationV1Api);

  let res;
  try {
    const webhookConfig = (webhook.webhooks || [])[0];
    if (!webhookConfig) {
      throw new Error(`Webhook ${namespace}/${name} does not exist`);
    }

    webhookConfig.clientConfig.caBundle = Buffer.from(forge.pki.certificateToPem(certificate)).toString('base64');

    const resPatch = res = await k8sApi.patchValidatingWebhookConfiguration(name, {
        webhooks: [webhookConfig],
        metadata: {
            labels: {
                'monokle.io/updated': Date.now().toString(),
            },
        }
    },
    undefined, undefined, 'Monokle', undefined, undefined, {
      headers: {
        'Content-Type': 'application/merge-patch+json',
      },
    });

    if (resPatch.response.statusCode !== 200) {
      throw new Error(`Failed to patch webhook ${namespace}/${name} (non 200 status code)`);
    }

    return true;
  } catch (err: any) {
    logger.error(formatLog(`Failed to patch webhook ${namespace}/${name}`, err, res));
    return false;
  }
}
