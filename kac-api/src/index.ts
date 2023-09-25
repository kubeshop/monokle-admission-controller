import {AnnotationSuppressor, FingerprintSuppressor, MonokleValidator, RemotePluginLoader, SchemaLoader, DisabledFixer, ResourceParser} from "@monokle/validation";
import { MonoklePolicy, getInformer } from "./utils/informer";
import { ValidationServer } from "./utils/validation-server";

// Refs:
//
// kube-client get current namespace where webhook is deployed
// https://stackoverflow.com/a/46046153

const INITIAL_NAMESPACE = 'default';

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
    activePolicy = policy;
    awaitValidatorReadiness = validator.preload(policy.spec);
    await awaitValidatorReadiness;
  }

  const onPolicyRemoval = async () => {
    activePolicy = null;
    awaitValidatorReadiness = validator.preload({});
    await awaitValidatorReadiness;
  }

  const onError = (err: any) => {
    console.log('ERROR:INFROMER', err);
  }

  const informer = getInformer(onPolicy, onPolicy, onPolicyRemoval, INITIAL_NAMESPACE, onError);

  // SERVER
  const server = new ValidationServer(validator);

  await server.start();
})();
