import pino from 'pino';
import path from 'path';
import k8s from '@kubernetes/client-node';
import {createDefaultMonokleFetcher} from '@monokle/synchronizer';
import {getNamespaceInformer} from './utils/get-informer.js';
import {NamespaceListener} from './utils/namespace-listener.js';
import {readToken} from './utils/read-token.js';
import {getClusterQuery, ClusterQueryResponse} from './utils/queries.js';
import {PolicyUpdater} from './utils/policy-updater.js';

const LOG_LEVEL = (process.env.MONOKLE_LOG_LEVEL || 'warn').toLowerCase();
// const IGNORED_NAMESPACES = (process.env.MONOKLE_IGNORE_NAMESPACES || '').split(','); // @TODO is this needed?
const COMMUNICATION_INTERVAL_SEC = 15;

const logger = pino({
  name: 'Monokle:Synchronizer',
  level: LOG_LEVEL,
});

const tokenPath = path.join('/run/secrets/token', '.token');

(async() => {
  const kc = new k8s.KubeConfig();
  kc.loadFromCluster();

  const apiFetcher = createDefaultMonokleFetcher();
  const policyUpdater = new PolicyUpdater(kc);

  const namespaceInformer = await getNamespaceInformer(
    kc,
    (err: any) => {
      logger.error({msg: 'Informer: Namespaces: Error', err: err.message, body: err.body});
      logger.error(err);
    }
  );
  const namespaceListener = new NamespaceListener(namespaceInformer, logger);

  let hasPendingQuery = false;
  let shouldSyncNamespaces = false;
  setInterval(async () => {
    if (hasPendingQuery) {
      return;
    }

    const token = readToken(tokenPath, logger);

    if (!token) {
      logger.warn({msg: 'Informer: No secret with Automation token found'});
      return;
    }

    hasPendingQuery = true;

    apiFetcher.useAutomationToken(token);

    try {
      logger.debug({msg: 'Fetching policies'});

      const clusterData = await apiFetcher.query<ClusterQueryResponse>(getClusterQuery);

      if (!clusterData.success) {
        throw new Error(clusterData.error);
      }

      if (!clusterData.data?.getCluster) {
        throw new Error('No cluster data found in API response');
      }

      shouldSyncNamespaces = clusterData.data.getCluster.cluster.namespaceSync;

      if (shouldSyncNamespaces && !namespaceListener.isRunning) {
        await namespaceListener.start();
      } else if (!shouldSyncNamespaces && namespaceListener.isRunning) {
        await namespaceListener.stop();
      }

      // @TODO recreate policy CRDs if needed
      // policyUpdater.update(clusterData.data.getCluster.cluster.bindings);
    } catch (err: any) {
      logger.error({msg: 'Informer: Error', err: err.message, body: err.body});
    }

    try {
      if (shouldSyncNamespaces) {
        const namespaces = namespaceListener.namespaces;

        logger.debug({msg: 'Sending namespaces', namespaces});

        // @TODO send namespaces to cloud
      }
    } catch (err: any) {
      logger.error({msg: 'Informer: Error', err: err.message, body: err.body});
    }

    hasPendingQuery = false;
  }, COMMUNICATION_INTERVAL_SEC * 1000);
})();
