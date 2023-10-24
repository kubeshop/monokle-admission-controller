import pino from 'pino';
import path from 'path';
import {getNamespaceInformer} from './utils/get-informer.js';
import {NamespaceListener} from './utils/namespace-listener.js';
import {readToken} from './utils/token-reader.js';

const LOG_LEVEL = (process.env.MONOKLE_LOG_LEVEL || 'warn').toLowerCase();
// const IGNORED_NAMESPACES = (process.env.MONOKLE_IGNORE_NAMESPACES || '').split(','); // @TODO is this needed?
const COMMUNICATION_INTERVAL_SEC = 15;
// False by default and then sync from the cluster
const SYNC_NAMESPACES = false;

const logger = pino({
  name: 'Monokle:Synchronizer',
  level: LOG_LEVEL,
});

const tokenPath = path.join('/run/secrets/token', '.token');

(async() => {
  const namespaceInformer = await getNamespaceInformer(
    (err: any) => {
      logger.error({msg: 'Informer: Namespaces: Error', err: err.message, body: err.body});
      logger.error(err);
    }
  );
  const namespaceListener = new NamespaceListener(namespaceInformer, logger);

  await namespaceListener.start();

  setInterval(async () => {
    const token = readToken(tokenPath, logger);

    if (!token) {
      logger.warn({msg: 'Informer: No secret with Automation token found'});
      return;
    }

    try {
      logger.debug({msg: 'Fetching policies'});
      // @TODO refetch policies and bindings from cloud and propagate as CRDs
    } catch (err: any) {
      logger.error({msg: 'Informer: Error', err: err.message, body: err.body});
    }

    try {
      const namespaces = namespaceListener.namespaces;

      logger.debug({msg: 'Sending namespaces', namespaces});

      // @TODO send namespaces to cloud
    } catch (err: any) {
      logger.error({msg: 'Informer: Error', err: err.message, body: err.body});
    }
  }, COMMUNICATION_INTERVAL_SEC * 1000);
})();
