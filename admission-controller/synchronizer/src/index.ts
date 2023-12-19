import pino from 'pino';
import path from 'path';
import _ from "lodash";
import k8s from '@kubernetes/client-node';
import {Fetcher, ApiHandler} from '@monokle/synchronizer';
import {getNamespaceInformer} from './utils/get-informer.js';
import {NamespaceListener} from './utils/namespace-listener.js';
import {readToken} from './utils/read-token.js';
import {getClusterQuery, ClusterQueryResponse, clusterDiscoveryMutation, ClusterDiscoveryMutationResponse} from './utils/queries.js';
import {PolicyUpdater} from './utils/policy-updater.js';

const LOG_LEVEL = (process.env.MONOKLE_LOG_LEVEL || 'warn').toLowerCase();
const IGNORED_NAMESPACES = (process.env.MONOKLE_IGNORE_NAMESPACES || '').split(',').filter(Boolean);
const CURRENT_VERSION = process.env.MONOKLE_CURRENT_VERSION ?? '0.0.0';
const CLOUD_API_URL = process.env.MONOKLE_CLOUD_API_URL ?? '';

const COMMUNICATION_INTERVAL_SEC = 15;

const logger = pino({
  name: 'Monokle:Synchronizer',
  level: LOG_LEVEL,
});

const tokenPath = path.join('/run/secrets/token', '.token');

(async() => {
  const kc = new k8s.KubeConfig();
  kc.loadFromCluster();

  const apiFetcher = new Fetcher(
    new ApiHandler({
      name: 'Monokle AdmissionController',
      version: CURRENT_VERSION,
    }, CLOUD_API_URL),
  );
  const policyUpdater = new PolicyUpdater(kc, logger);

  const namespaceInformer = await getNamespaceInformer(
    kc,
    (err: any) => {
      logger.error({msg: 'Informer: Namespaces: Error', err: err.message, body: err.body, code: err.code});
      logger.error(err);
    }
  );
  const namespaceListener = new NamespaceListener(namespaceInformer, logger);

  await policyUpdater.init();

  let hasPendingQuery = false;
  let shouldSyncNamespaces = true;
  setInterval(async () => {
    if (hasPendingQuery) {
      return;
    }

    const token = readToken(tokenPath, logger);

    if (!token) {
      logger.warn({msg: 'No secret with Automation token found'});
      return;
    }

    hasPendingQuery = true;

    apiFetcher.useAutomationToken(token);

    try {
      logger.debug({msg: 'Fetching policies'});

      const clusterData = await apiFetcher.query<ClusterQueryResponse>(getClusterQuery, { input: {} });

      if (!clusterData.success) {
        throw new Error(clusterData.error);
      }

      if (!clusterData.data?.getCluster) {
        throw new Error('No cluster data found in API response');
      }

      await policyUpdater.update(clusterData.data.getCluster.bindings, clusterData.data.getCluster.namespaces);

      shouldSyncNamespaces = clusterData.data.getCluster.namespaceSync;

      if (shouldSyncNamespaces && !namespaceListener.isRunning) {
        await namespaceListener.start();
      } else if (!shouldSyncNamespaces && namespaceListener.isRunning) {
        await namespaceListener.stop();
      }
    } catch (err: any) {
      logger.error({msg: 'Error: Policy updater', errMsg: err.message, body: err.body, code: err.code, err});
    }

    try {
      const requestData: { version: string, namespaces?: string[] } = {
        version: CURRENT_VERSION,
        namespaces: undefined
      };

      if (shouldSyncNamespaces) {
        const namespaces = namespaceListener.namespaces;
        const filteredNamespaces = namespaces.filter((namespace) => !IGNORED_NAMESPACES.includes(namespace));

        requestData.namespaces = filteredNamespaces;
      }

      logger.debug({msg: 'Sending heartbeat', requestData});

      const discoveryResponse = await apiFetcher.query<ClusterDiscoveryMutationResponse>(clusterDiscoveryMutation, requestData);

      if (!discoveryResponse.success) {
        throw new Error(discoveryResponse.error);
      }
    } catch (err: any) {
      logger.error({msg: 'Error: Namespace update', err: err.message, body: err.body, code: err.code});
    }

    hasPendingQuery = false;
  }, COMMUNICATION_INTERVAL_SEC * 1000);
})();
