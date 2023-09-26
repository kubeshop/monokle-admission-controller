import {AnnotationSuppressor, FingerprintSuppressor, MonokleValidator, RemotePluginLoader, SchemaLoader, DisabledFixer, ResourceParser} from "@monokle/validation";
import { MonoklePolicy, getInformer } from "./utils/informer.js";
import { ValidationServer } from "./utils/validation-server.js";
import { DEFAULT_NAMESPACE, getNamespace } from "./utils/helpers.js";

(async() => {
  const currentNamespace = getNamespace() || DEFAULT_NAMESPACE;

  console.log(`Admission Controller namespace ${currentNamespace}`);

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

  const informer = getInformer(onPolicy, onPolicy, onPolicyRemoval, currentNamespace, onError);

  // SERVER
  const server = new ValidationServer(validator);

  await server.start();
})();
