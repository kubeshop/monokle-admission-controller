import { NestFactory } from '@nestjs/core';
import { ServerModule } from './server.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import Configuration from './config';
import { ConfigService } from './shared/config.service';
import { Logger, LogLevel } from '@nestjs/common';

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
] as LogLevel[];

const app = await NestFactory.create<NestFastifyApplication>(
  ServerModule,
  new FastifyAdapter({
    https: Configuration.server.tls,
  }),
);

const config = app.get(ConfigService);
const levels = LOG_LEVELS.slice(LOG_LEVELS.indexOf(config.get('logLevel')));
app.useLogger([config.get('logLevel')]);

await app.listen(config.get('server.port'), config.get('server.host'));
new Logger('Entrypoint').log(
  `Server listening on ${config.get('server.host')}:${config.get(
    'server.port',
  )}`,
);
