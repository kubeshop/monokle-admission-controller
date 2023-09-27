import pino from 'pino';
import {AnnotationSuppressor, FingerprintSuppressor, MonokleValidator, RemotePluginLoader, SchemaLoader, DisabledFixer, ResourceParser} from '@monokle/validation';
import {Config} from '@monokle/validation';
import {MonoklePolicy, getInformer} from './utils/informer.js';
import {ValidationServer} from './utils/validation-server.js';

const logger = pino({
  name: 'Monokle',
  level: 'trace',
});

const policies: Map<string, Config> = new Map();
const validators: Map<string, MonokleValidator> = new Map();

(async() => {
  // INFORMER
  const onPolicy = async (policy: MonoklePolicy) => {
    logger.info({msg: 'Informer: Policy updated', policy});

    const policyNamespace = policy.metadata?.namespace;
    if (!policyNamespace) {
      logger.error({msg: 'Informer: Policy namespace is empty', metadata: policy.metadata});
      return;
    }

    policies.set(policyNamespace, policy.spec);

    if (!validators.has(policyNamespace)) {
      validators.set(
        policyNamespace,
        new MonokleValidator(
          {
            loader: new RemotePluginLoader(),
            parser: new ResourceParser(),
            schemaLoader: new SchemaLoader(),
            suppressors: [new AnnotationSuppressor(), new FingerprintSuppressor()],
            fixer: new DisabledFixer(),
          },
          {}
        )
      );
    }

    await validators.get(policyNamespace)!.preload(policy.spec);
  }

  const onPolicyRemoval = async (policy: MonoklePolicy) => {
    logger.info('Informer: Policy removed');

    const policyNamespace = policy.metadata?.namespace;
    if (!policyNamespace) {
      logger.error({msg: 'Informer: Policy namespace is empty', metadata: policy.metadata});
      return;
    }

    policies.delete(policyNamespace);
    validators.delete(policyNamespace);
  }

  const onError = (err: any) => {
    logger.error({msg: 'Informer: Error', err});
  }

  const informer = await getInformer(onPolicy, onPolicy, onPolicyRemoval, onError);

  // SERVER
  const server = new ValidationServer(validators, logger);

  await server.start();
})();
