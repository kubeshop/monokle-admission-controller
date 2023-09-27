import pino from 'pino';
import {AnnotationSuppressor, FingerprintSuppressor, MonokleValidator, RemotePluginLoader, SchemaLoader, DisabledFixer, ResourceParser} from '@monokle/validation';
import {MonoklePolicy, getInformer} from './utils/informer.js';
import {ValidationServer} from './utils/validation-server.js';
import {DEFAULT_NAMESPACE, getNamespace} from './utils/helpers.js';

(async() => {
  const logger = pino({
    name: 'Monokle',
    level: 'trace',
  });

  let currentNamespace: string;
  try {
    currentNamespace = getNamespace() || DEFAULT_NAMESPACE;
  } catch (err: any) {
    logger.error('Failed to get current namespace', err);
    process.exit(1);
  }

  logger.debug({namespace: currentNamespace});

  // VALIDATOR
  let awaitValidatorReadiness = Promise.resolve();

  const validator = new MonokleValidator(
    {
      loader: new RemotePluginLoader(),
      parser: new ResourceParser(),
      schemaLoader: new SchemaLoader(),
      suppressors: [new AnnotationSuppressor(), new FingerprintSuppressor()],
      fixer: new DisabledFixer(),
    },
    {}
  );

  // INFORMER
  let activePolicy: MonoklePolicy | null = null;

  const onPolicy = async (policy: MonoklePolicy) => {
    logger.info({msg: 'Informer: Policy updated', policy});
    activePolicy = policy;
    awaitValidatorReadiness = validator.preload(policy.spec);
    await awaitValidatorReadiness;
  }

  const onPolicyRemoval = async () => {
    logger.info('Informer: Policy removed');
    activePolicy = null;
    awaitValidatorReadiness = validator.preload({});
    await awaitValidatorReadiness;
  }

  const onError = (err: any) => {
    logger.error({msg: 'Informer: Error', err});
  }

  const informer = getInformer(onPolicy, onPolicy, onPolicyRemoval, onError, currentNamespace);

  // SERVER
  const server = new ValidationServer(validator, logger);

  await server.start();
})();
