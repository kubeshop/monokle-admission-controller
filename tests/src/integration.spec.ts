import { join, resolve } from 'path';
import { afterEach, assert, beforeAll, describe, it } from 'vitest'
import shell from 'shelljs';

const VERBOSE = process.env.VERBOSE === 'true';
const NAMESPACE = process.env.MONOKLE_NAMESPACE || 'monokle-admission-controller';

const currentDir = __dirname;
const mainDir = resolve(join(currentDir, '..', '..'));

// IMPORTANT: As a prerequisite to run this tests, you need to have a cluster running, configured with your kubectl
// and Monokle Admission Controller deployed there as described in the README.md file.

describe(`All (dir: ${mainDir})`, () => {
  beforeAll(async () => {
    await waitForResult(`kubectl -n ${NAMESPACE} get pod`, (result) => {
      return result.includes('monokle-admission-controller-server') && result.includes('Running');
    }, 60 * 1000);

    await waitForResult(`kubectl -n ${NAMESPACE} logs -l app=monokle-admission-controller-server --tail 100`, (result) => {
      return result.includes('Server listening at');
    }, 60 * 1000);

    await cleanup();
  }, 120 * 1000);

  afterEach(async () => {
    await cleanup();
  });

  it('creates resource (any) with no warnings when no policy defined for namespace', async () => {
    const output = await run(`cd "${mainDir}" && kubectl -n nstest2 apply -f examples/pod-valid.yaml`);

    assert.match(output, /pod\/pod-valid created/);
    assert.notMatch(output, /warning/gi);
    assert.notMatch(output, /error/gi);
  });

  it('creates resource (valid) with no warnings when policy defined for namespace', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-2.yaml`);

    const output = await run(`cd "${mainDir}" && kubectl -n default apply -f examples/pod-valid.yaml`);

    assert.match(output, /pod\/pod-valid created/);
    assert.notMatch(output, /warning/gi);
    assert.notMatch(output, /error/gi);
  });

  it('creates resource (misconfigured) with warnings when policy defined for namespace', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-2.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-3.yaml`);

    const output = await run(`cd "${mainDir}" && kubectl -n nstest1 apply -f examples/pod-warning.yaml`);

    assert.match(output, /pod\/pod-warning created/);
    assert.match(output, /warning/gi);

    const warningsCount = (output.match(/\(warning\)/gi) || []).length;

    assert.equal(warningsCount, 11);
  });

  it('creates resource (valid) with no warnings when policy defined globally', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-1.yaml`);

    const output = await run(`cd "${mainDir}" && kubectl -n default apply -f examples/pod-valid.yaml`);

    assert.match(output, /pod\/pod-valid created/);
    assert.notMatch(output, /warning/gi);
    assert.notMatch(output, /error/gi);
  });

  it('creates resource (misconfigured) with warnings when policy defined globally', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-1.yaml`);

    const output = await run(`cd "${mainDir}" && kubectl -n nstest2 apply -f examples/pod-errors.yaml`);

    assert.match(output, /pod\/pod-errors created/);
    assert.match(output, /warning/gi);
    assert.match(output, /error/gi);

    const warningsCount = (output.match(/\(warning\)/gi) || []).length;
    const errorsCount = (output.match(/\(error\)/gi) || []).length;

    assert.equal(warningsCount, 8);
    assert.equal(errorsCount, 4);
  });
});

const run = async (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    shell.exec(command, {async: true, silent: true}, (code, stdout, stderr) => {

      VERBOSE && console.log('stdout', stdout);
      VERBOSE && console.log('stderr', stderr);

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

    const result = await run(command);
    isValid = isExpected(result);

    if (!isValid) {
      sleep(250);
    }
  }
};

const cleanup = async () => {
  // @TODO not very efficient, should be improved
  return Promise.allSettled([
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-sample-1.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-sample-2.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-binding-sample-1.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-binding-sample-2.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-binding-sample-3.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-valid.yaml -n nstest2`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-valid.yaml -n default`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-warning.yaml -n nstest1`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-valid.yaml -n default`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-errors.yaml -n nstest2 `),
  ]);
};

const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};
