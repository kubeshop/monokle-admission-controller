import { join, resolve } from 'path';
import { afterAll, afterEach, assert, beforeAll, describe, it } from 'vitest'
import shell from 'shelljs';

const VERBOSE = process.env.VERBOSE === 'true';
const NAMESPACE = process.env.MONOKLE_NAMESPACE || 'monokle';

const currentDir = __dirname;
const mainDir = resolve(join(currentDir, '..', '..'));

// IMPORTANT: As a prerequisite to run this tests, you need to have a cluster running, configured with your kubectl
// and Monokle Admission Controller deployed there as described in the README.md file.

describe(`Standalone (dir: ${mainDir})`, () => {
  beforeAll(async () => {
    await waitForResult(`kubectl -n ${NAMESPACE} get pod`, (result) => {
      return result.includes('monokle-admission-controller-server') && result.includes('Running');
    }, 60 * 1000);

    await waitForResult(`kubectl -n ${NAMESPACE} logs -l app=monokle-admission-controller-server --tail 5000`, (result) => {
      return result.includes('Server listening at');
    }, 60 * 1000);

    await cleanup();

    await run('kubectl create namespace nstest1');
    await run('kubectl create namespace nstest2');
  }, 120 * 1000);

  afterEach(async () => {
    await cleanup();
  }, 60 * 1000);

  afterAll(async () => {
    await run('kubectl delete namespace nstest1');
    await run('kubectl delete namespace nstest2');
  }, 60 * 1000);

  it('creates resource (any) with no warnings when no policy defined for namespace', async () => {
    const output = await run(`cd "${mainDir}" && kubectl -n nstest2 apply -f examples/pod-valid.yaml`);

    assert.match(output, /pod\/pod-valid created/);
    assert.notMatch(output, /\(warning\)/gi);
    assert.notMatch(output, /\(error\)/gi);
  });

  it('creates resource (valid) with no warnings when policy defined for namespace (matchLabels)', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-2.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n default apply -f examples/pod-valid.yaml`);

    assert.match(output, /pod\/pod-valid created/);
    assert.notMatch(output, /\(warning\)/gi);
    assert.notMatch(output, /\(error\)/gi);
  });

  it('creates resource (misconfigured) with warnings when policy defined for namespace (matchLabels)', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-2.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-3.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n nstest1 apply -f examples/pod-warning.yaml`);

    assert.match(output, /pod\/pod-warning created/);
    assert.match(output, /warning/gi);

    const warningsCount = (output.match(/\(warning\)/gi) || []).length;

    assert.equal(warningsCount, 11);
  });

  it('creates resource (valid) with no warnings when policy defined for namespace (matchExpressions, In)', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-4.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n nstest1 apply -f examples/pod-valid.yaml`);

    assert.match(output, /pod\/pod-valid created/);
    assert.notMatch(output, /\(warning\)/gi);
    assert.notMatch(output, /\(error\)/gi);
  });

  it('creates resource (misconfigured) with no warnings when policy defined for different namespace (matchExpressions, In)', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-4.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n default apply -f examples/pod-warning.yaml`);

    assert.match(output, /pod\/pod-warning created/);
    assert.notMatch(output, /\(warning\)/gi);
    assert.notMatch(output, /\(error\)/gi);
  });

  it('creates resource (misconfigured) with warnings when policy defined for namespace (matchExpressions, In)', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-4.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n nstest1 apply -f examples/pod-warning.yaml`);

    assert.match(output, /pod\/pod-warning created/);
    assert.match(output, /warning/gi);

    const warningsCount = (output.match(/\(warning\)/gi) || []).length;

    assert.equal(warningsCount, 8);
  });

  it('creates resource (valid) with no warnings when policy defined for namespace (matchExpressions, NotIn)', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-5.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n nstest1 apply -f examples/pod-valid.yaml`);

    assert.match(output, /pod\/pod-valid created/);
    assert.notMatch(output, /\(warning\)/gi);
    assert.notMatch(output, /\(error\)/gi);
  });

  it('creates resource (misconfigured) with no warnings when policy defined for different namespace (matchExpressions, NotIn)', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-5.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n default apply -f examples/pod-warning.yaml`);

    assert.match(output, /pod\/pod-warning created/);
    assert.notMatch(output, /\(warning\)/gi);
    assert.notMatch(output, /\(error\)/gi);
  });

  it('creates resource (misconfigured) with warnings when policy defined for namespace (matchExpressions, NotIn)', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-5.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n nstest1 apply -f examples/pod-warning.yaml`);

    assert.match(output, /pod\/pod-warning created/);
    assert.match(output, /warning/gi);

    const warningsCount = (output.match(/\(warning\)/gi) || []).length;

    assert.equal(warningsCount, 8);
  });

  it('creates resource (valid) with no warnings when policy defined globally', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-1.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n default apply -f examples/pod-valid.yaml`);

    assert.match(output, /pod\/pod-valid created/);
    assert.notMatch(output, /\(warning\)/gi);
    assert.notMatch(output, /\(error\)/gi);
  });

  it('creates resource (misconfigured) with warnings when policy defined globally', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-1.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n nstest2 apply -f examples/pod-errors.yaml`);

    assert.match(output, /pod\/pod-errors created/);
    assert.match(output, /warning/gi);
    assert.match(output, /error/gi);

    const warningsCount = (output.match(/\(warning\)/gi) || []).length;
    const errorsCount = (output.match(/\(error\)/gi) || []).length;

    assert.equal(warningsCount, 8);
    assert.equal(errorsCount, 4);
  });

  it('creates resource (valid) when "Deny" policy defined', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-6.yaml`, 500);

    const output = await run(`cd "${mainDir}" && kubectl -n default apply -f examples/pod-valid.yaml`);

    assert.match(output, /pod\/pod-valid created/);
    assert.notMatch(output, /\(warning\)/gi);
    assert.notMatch(output, /\(error\)/gi);
  });

  it('blocks creating resource (misconfigured) with list of violations as output when "Deny" policy defined', async () => {
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-sample-1.yaml`);
    await run(`cd "${mainDir}" && kubectl apply -f examples/policy-binding-sample-6.yaml`, 500);

    try {
      const output = await run(`cd "${mainDir}" && kubectl -n default apply -f examples/pod-warning.yaml`);
      assert.fail(`Expected error but got success: ${output}`);
    } catch (err: any) {
      assert.notMatch(err, /pod\/pod-warning created/);
      assert.match(err, /\(warning\)/gi);

      const warningsCount = (err.match(/\(warning\)/gi) || []).length;
      const errorsCount = (err.match(/\(error\)/gi) || []).length;

      assert.equal(warningsCount, 8);
      assert.equal(errorsCount, 3);
    }
  });
});

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

const cleanup = async () => {
  return Promise.allSettled([
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-sample-1.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-sample-2.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-binding-sample-1.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-binding-sample-2.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-binding-sample-3.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-binding-sample-4.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-binding-sample-5.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/policy-binding-sample-6.yaml`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-valid.yaml -n default`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-valid.yaml -n nstest1`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-valid.yaml -n nstest2`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-warning.yaml -n default`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-warning.yaml -n nstest1`),
    run(`cd "${mainDir}" && kubectl delete -f examples/pod-errors.yaml -n nstest2 `),
  ]);
};

const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};
