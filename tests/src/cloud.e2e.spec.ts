import { join, resolve } from 'path';
import { afterEach, assert, beforeAll, describe, it } from 'vitest'
import shell from 'shelljs';
import { parse } from 'yaml';
import { startMockServer } from './utils/server';
import { EXPECTED_CRDS } from './utils/expected-crds';

const VERBOSE = process.env.VERBOSE === 'true';
const NAMESPACE = process.env.MONOKLE_NAMESPACE || 'monokle';

const currentDir = __dirname;
const mainDir = resolve(join(currentDir, '..', '..'));

// IMPORTANT: As a prerequisite to run this tests, you need to have a cluster running, configured with your kubectl
// and Monokle Admission Controller deployed there as described in the README.md file.

describe(`Cloud (dir: ${mainDir})`, () => {
  let mockServer: Awaited<ReturnType<typeof startMockServer>>;

  beforeAll(async () => {
    await waitForResult(`kubectl -n ${NAMESPACE} get pod`, (result) => {
      return result.includes('monokle-admission-controller-server') && result.includes('Running');
    }, 60 * 1000);

    await waitForResult(`kubectl -n ${NAMESPACE} get pod`, (result) => {
      return result.includes('monokle-admission-controller-synchronizer') && result.includes('Running');
    }, 60 * 1000);

    await waitForResult(`kubectl -n ${NAMESPACE} logs -l app=monokle-admission-controller-server --tail 5000`, (result) => {
      return result.includes('Server listening at');
    }, 60 * 1000);

    await cleanup();
  }, 180 * 1000);

  afterEach(async () => {
    if (mockServer) {
      mockServer.server.closeAllConnections();
      await (new Promise((resolve) => mockServer.server.close(resolve)));
    }

    await cleanup();
  });

  it('sends getCluster API query', async () => {
    mockServer = await startMockServer('empty');

    const requestsData = await waitForRequests(mockServer, 2);
    const requestData = requestsData.find(requestData => requestData.body.query.includes('getCluster'));

    assert.match(requestData.token, /ApiKey SAMPLE_TOKEN/);
    assert.match(requestData.body.query, /query getCluster/);
  }, 25 * 1000);

  it('sends heartbeat mutation', async () => {
    mockServer = await startMockServer('empty');

    const requestsData = await waitForRequests(mockServer, 2);
    const requestData = requestsData.find(requestData => requestData.body.query.includes('discoverCluster'));

    assert.match(requestData.token, /ApiKey SAMPLE_TOKEN/);
    assert.match(requestData.body.query, /mutation discoverCluster/);
  }, 25 * 1000);

  it('propagates fetched cluster data as CRDs', async () => {
    mockServer = await startMockServer('dataAllow');

    // Wait for getCluster query to run.
    await waitForRequests(mockServer, 2);
    // Wait for CRDs propagation.
    await sleep(500);

    const policy1 = await run('kubectl get monoklepolicy.monokle.io/cluster-1-binding-1-policy -o yaml');
    const policy2 = await run('kubectl get monoklepolicy.monokle.io/cluster-1-binding-2-policy -o yaml');
    const binding1 = await run('kubectl get monoklepolicybinding.monokle.io/cluster-1-binding-1 -o yaml');
    const binding2 = await run('kubectl get monoklepolicybinding.monokle.io/cluster-1-binding-2 -o yaml');

    assertResource(binding1, 'cluster-1-binding-1');
    assertResource(binding2, 'cluster-1-binding-2');
    assertResource(policy1, 'cluster-1-binding-1-policy');
    assertResource(policy2, 'cluster-1-binding-2-policy');
  }, 45 * 1000);

  it('correctly maps deny action', async () => {
    mockServer = await startMockServer('actionDeny');

    // Wait for getCluster query to run.
    await waitForRequests(mockServer, 2);
    // Wait for CRDs propagation.
    await sleep(500);

    const policy1 = await run('kubectl get monoklepolicy.monokle.io/cluster-1-binding-1-policy -o yaml');
    const binding1 = await run('kubectl get monoklepolicybinding.monokle.io/cluster-1-binding-1-deny -o yaml');

    assertResource(binding1, 'cluster-1-binding-1-deny');
    assertResource(policy1, 'cluster-1-binding-1-policy');
  }, 45 * 1000);

  // @TODO updates policy CRDs with new data
  // @TODO deletes policy CRDs
  // @TODO updates binding CRDs with new data
  // @TODO deletes binding CRDs
  // @TODO sends namespaces back
});

const assertResource = (resource: any, expectedResourceName: string) => {
  const expectedResource = EXPECTED_CRDS[expectedResourceName];

  if (!expectedResource) {
    assert.fail(`Expected resource ${expectedResourceName} not found in EXPECTED_CRDS`);
  }

  const actualResource = parse(resource);

  assert.equal(actualResource.apiVersion, expectedResource.apiVersion);
  assert.equal(actualResource.kind, expectedResource.kind);
  assert.equal(actualResource.metadata.name, expectedResource.metadata.name);
  assert.deepEqual(actualResource.spec, expectedResource.spec);
};

const run = async (command: string, timeoutMs?: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    shell.exec(command, {async: true, silent: true}, async (code, stdout, stderr) => {

      VERBOSE && console.log('stdout', stdout);
      VERBOSE && console.log('stderr', stderr);

      if (timeoutMs) {
        await sleep(timeoutMs);
      }

      if (code !== 0) {
        reject(stderr);
      } else {
        resolve(`${stdout}\n${stderr}`); // Warnings are send to stderr so we pass it from successful run as well.
      }
    });
  });
};

const waitForResult = async (command: string, isExpected: (result: string) => boolean, timeoutMs = 5000) => {
  let isValid = false;

  const startTime = Date.now();
  while (!isValid) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for result of command: ${command}`);
    }

    try {
      const result = await run(command);
      isValid = isExpected(result);
    } catch (err) {
      VERBOSE && console.log('waitForResult error', err);
    }

    if (!isValid) {
      sleep(250);
    }
  }
};

const waitForRequests = async (mockServer: Awaited<ReturnType<typeof startMockServer>>, requestCount = 1): Promise<any[]> => {
  let requests = 0;

  const requestsData: any[] = [];
  return new Promise(res => {
    mockServer.server.on('requestReceived', requestData => {
      requests++;
      requestsData.push(requestData);

      if (requests >= requestCount) {
        res(requestsData);
      }
    });
  });
};

const cleanup = async () => {
  return Promise.allSettled([
    run(`kubectl delete monoklepolicy.monokle.io/cluster-1-binding-1-policy`),
    run(`kubectl delete monoklepolicy.monokle.io/cluster-1-binding-2-policy`),
    run(`kubectl delete monoklepolicybinding.monokle.io/cluster-1-binding-1`),
    run(`kubectl delete monoklepolicybinding.monokle.io/cluster-1-binding-2`),
  ]);
};

const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};
