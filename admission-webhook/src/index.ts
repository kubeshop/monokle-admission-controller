import pino from 'pino';
import {getInformer} from './utils/get-informer.js';
import {MonoklePolicy, MonoklePolicyBinding, PolicyManager} from './utils/policy-manager.js';
import {ValidatorManager} from './utils/validator-manager.js';
import {ValidationServer} from './utils/validation-server.js';

const logger = pino({
  name: 'Monokle',
  level: 'trace',
});

(async() => {
  const policyInformer = await getInformer<MonoklePolicy>(
    'monokle.io',
    'v1',
    'policies',
    (err: any) => {
      logger.error({msg: 'Informer: Policies: Error', err});
    }
  );

  const bindingsInformer = await getInformer<MonoklePolicyBinding>(
    'monokle.io',
    'v1',
    'policybindings',
    (err: any) => {
      logger.error({msg: 'Informer: Bindings: Error', err});
    }
  );

  const policyManager = new PolicyManager(policyInformer, bindingsInformer, logger);
  const validatorManager = new ValidatorManager(policyManager);

  await policyManager.start();

  const server = new ValidationServer(validatorManager, logger);

  await server.start();
})();
