import {AnnotationSuppressor, FingerprintSuppressor, MonokleValidator, RemotePluginLoader, SchemaLoader, DisabledFixer, ResourceParser} from "@monokle/validation";
import { MonoklePolicy, getInformer } from "./utils/informer.js";
import { ValidationServer } from "./utils/validation-server.js";

// Refs:
//
// kube-client get current namespace where webhook is deployed
// https://stackoverflow.com/a/46046153

// const INITIAL_NAMESPACE = 'default';
const INITIAL_NAMESPACE = 'webhook-demo';

(async() => {
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
    console.log('POLICY:UPDATE', policy);
    activePolicy = policy;
    awaitValidatorReadiness = validator.preload(policy.spec);
    await awaitValidatorReadiness;
  }

  const onPolicyRemoval = async () => {
    console.log('POLICY:REMOVAL');
    activePolicy = null;
    awaitValidatorReadiness = validator.preload({});
    await awaitValidatorReadiness;
  }

  const onError = (err: any) => {
    console.log('ERROR:INFORMER', err);
  }

  const informer = getInformer(onPolicy, onPolicy, onPolicyRemoval, INITIAL_NAMESPACE, onError);

  // SERVER
  const server = new ValidationServer(validator);

  await server.start();
})();
