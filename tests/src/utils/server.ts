import {IncomingMessage, Server, ServerResponse} from 'http';
import express, {Request, Response, Application} from 'express';
import cors from 'cors';
import _ from 'lodash';
import {RESPONSE_MOCK} from './response-mocks.js';

type ResponseMockName = 'empty' | 'emptySync' | 'dataAllow' | 'actionDeny';

type MockServer = {
  server: Server;
  switchResponseMock: (responseMock: ResponseMockName) => void;
};

export function startMockServer(
  responseMock: ResponseMockName = 'dataAllow',
  host = '0.0.0.0',
  port = 5000
): Promise<MockServer> {
  const HOST = process.env.MOCK_HOST ?? host;
  const PORT = process.env.MOCK_PORT ? parseInt(process.env.MOCK_PORT, 10) : port;
  const apiMock: Application = express();

  let serverInstance: Server<typeof IncomingMessage, typeof ServerResponse>;
  let responseDataMock = RESPONSE_MOCK[responseMock];

  apiMock.use(cors())
  apiMock.use(express.json());

  apiMock.get('/health', (_req: Request, res: Response) => {
    res.send('OK');
  });

  apiMock.post('/graphql', async (req: Request, res: Response) => {
    const token = req.get('Authorization');
    const body = req.body;

    console.log('API-MOCK:Request', token, body, JSON.stringify(responseDataMock));

    if (serverInstance) {
      serverInstance.emit('requestReceived', {
        token,
        body,
        response: responseDataMock
      });
    }

    res.send(responseDataMock);
  });

  return new Promise((resolve) => {
    const server = apiMock.listen(PORT, HOST, () => {
      console.log(`API-MOCK: Test server running on ${HOST}:${PORT}.`);

      serverInstance = server;

      server.on('close', () => {
        console.log('API-MOCK: Test server closed.');
      });

      resolve({
        server,
        switchResponseMock: (responseMock: ResponseMockName) => {
          responseDataMock = RESPONSE_MOCK[responseMock];
        }
      });
    });
  });
}
