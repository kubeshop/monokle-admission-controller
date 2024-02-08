import KubeClient from './utils/kube-client.js';
import { NestFactory } from '@nestjs/core';
import { ServerModule } from './server.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from './config.service';
import Configuration from './config';

const app = await NestFactory.create<NestFastifyApplication>(
  ServerModule,
  new FastifyAdapter({
    https: Configuration.server.tls,
  }),
);

const config = app.get(ConfigService);
app.useLogger(config.get('logLevel') as any);

KubeClient.buildKubeConfig();

const policyInformer = await KubeClient.getInformer<MonoklePolicy>(
  'monokle.io',
  'v1alpha1',
  'policies',
  (err: any) => {
    logger.error({
      msg: 'Informer: Policies: Error',
      err: err.message,
      body: err.body,
    });
  },
);

const bindingsInformer = await KubeClient.getInformer<MonoklePolicyBinding>(
  'monokle.io',
  'v1alpha1',
  'policybindings',
  (err: any) => {
    logger.error({
      msg: 'Informer: Bindings: Error',
      err: err.message,
      body: err.body,
    });
  },
);

await app.listen(config.get('server.port'), config.get('server.host'));
