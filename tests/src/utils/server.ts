import {Server} from 'http';
import express, {Request, Response, Application} from 'express';
import cors from 'cors';
import {mockServer} from '@graphql-tools/mock';

const schema = `
  scalar JSON

  scalar DateTime

  type ClusterBindingModel {
    clusterId: String!
    id: String!
    mode: String!
    policyId: String!

    namespaces: [ClusterNamespaceModel!]!
    policy: ClusterBindingPolicyModel!
  }

  type ClusterBindingPolicyModel {
    id: String!
    content: JSON!
    projectId: String!
  }

  type ClusterNamespaceModel {
    id: String!
    name: String!
  }

  type ClusterModel {
    apiKey: String!
    createdAt: DateTime!
    description: String
    id: String!
    name: String!
    namespaceSync: Boolean!
    organizationId: String!
    updatedAt: DateTime
    version: String

    namespaces: [ClusterNamespaceModel!]!
    bindings: [ClusterBindingModel!]!
  }

  type Cluster {
    cluster: ClusterModel!
  }

  type Query {
    getCluster: Cluster!
  }
`;

const DEFAULT_POLICY = {
  plugins: {
    'open-policy-agent': true
  }
};

export function startMockServer(host = '0.0.0.0', port = 5000): Promise<Server> {
  const HOST = process.env.MOCK_HOST ?? host;
  const PORT = process.env.MOCK_PORT ? parseInt(process.env.MOCK_PORT, 10) : port;

  const apiMock: Application = express();
  const graphqlMock = mockServer(schema, {
    JSON: () => (DEFAULT_POLICY),
    ClusterNamespaceModel: () => (
      {
        id: '1',
        name: 'default'
      }
    )
  }, false);

  apiMock.use(cors())
  apiMock.use(express.json());

  apiMock.get('/health', (_req: Request, res: Response) => {
    res.send('OK');
  });

  apiMock.post('/graphql', async (req: Request, res: Response) => {
    const token = req.get('Authorization');
    const body = req.body;

    console.log('API-MOCK', token, body);

    const response = await graphqlMock.query(body.query, body.variables);

    console.log('API-MOCK', JSON.stringify(response));

    res.send(response);
  });

  return new Promise((resolve) => {
    const server = apiMock.listen(PORT, HOST, () => {
      console.log(`API-MOCK: Test server running on ${HOST}:${PORT}.`);

      server.on('close', () => {
        console.log('API-MOCK: Test server closed.');
      });

      resolve(server);
    });
  });
}

startMockServer();
