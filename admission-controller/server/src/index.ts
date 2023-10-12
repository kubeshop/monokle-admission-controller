import pino from 'pino';
import {getInformer} from './utils/get-informer.js';
import {MonoklePolicy, MonoklePolicyBinding, PolicyManager} from './utils/policy-manager.js';
import {ValidatorManager} from './utils/validator-manager.js';
import {ValidationServer} from './utils/validation-server.js';

const LOG_LEVEL = (process.env.MONOKLE_LOG_LEVEL || 'warn').toLowerCase();
const IGNORED_NAMESPACES = (process.env.MONOKLE_IGNORE_NAMESPACES || '').split(',');

const logger = pino({
  name: 'Monokle',
  level: LOG_LEVEL,
});

(async() => {
  const policyInformer = await getInformer<MonoklePolicy>(
    'monokle.io',
    'v1alpha1',
    'policies',
    (err: any) => {
      logger.error({msg: 'Informer: Policies: Error', err: err.message, body: err.body});
    }
  );

  const bindingsInformer = await getInformer<MonoklePolicyBinding>(
    'monokle.io',
    'v1alpha1',
    'policybindings',
    (err: any) => {
      logger.error({msg: 'Informer: Bindings: Error', err: err.message, body: err.body});
    }
  );

  const policyManager = new PolicyManager(policyInformer, bindingsInformer, logger);
  const validatorManager = new ValidatorManager(policyManager, logger);

  await policyManager.start();

  const server = new ValidationServer(validatorManager, IGNORED_NAMESPACES, logger);

  await server.start();
})();
