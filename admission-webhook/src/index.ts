import pino from 'pino';
import {AnnotationSuppressor, FingerprintSuppressor, MonokleValidator, RemotePluginLoader, SchemaLoader, DisabledFixer, ResourceParser} from '@monokle/validation';
import {getInformer} from './utils/get-informer.js';
import {MonoklePolicy, MonoklePolicyBinding, PolicyManager} from './utils/policy-manager.js';

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

  // POLICY MANAGER

  // // INFORMER
  // const onPolicy = async (policy: MonoklePolicy) => {
  //   logger.info({msg: 'Informer: Policy updated', policy});

  //   const policyNamespace = policy.metadata?.namespace;
  //   if (!policyNamespace) {
  //     logger.error({msg: 'Informer: Policy namespace is empty', metadata: policy.metadata});
  //     return;
  //   }

  //   policies.set(policyNamespace, policy.spec);

  //   if (!validators.has(policyNamespace)) {
  //     validators.set(
  //       policyNamespace,
  //       new MonokleValidator(
  //         {
  //           loader: new RemotePluginLoader(),
  //           parser: new ResourceParser(),
  //           schemaLoader: new SchemaLoader(),
  //           suppressors: [new AnnotationSuppressor(), new FingerprintSuppressor()],
  //           fixer: new DisabledFixer(),
  //         },
  //         {}
  //       )
  //     );
  //   }

  //   await validators.get(policyNamespace)!.preload(policy.spec);
  // }

  // const onPolicyRemoval = async (policy: MonoklePolicy) => {
  //   logger.info('Informer: Policy removed');

  //   const policyNamespace = policy.metadata?.namespace;
  //   if (!policyNamespace) {
  //     logger.error({msg: 'Informer: Policy namespace is empty', metadata: policy.metadata});
  //     return;
  //   }

  //   policies.delete(policyNamespace);
  //   validators.delete(policyNamespace);
  // }


  // // SERVER
  // const server = new ValidationServer(validators, logger);

  // await server.start();
})();
