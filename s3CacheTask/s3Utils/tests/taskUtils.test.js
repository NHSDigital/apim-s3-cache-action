
/* eslint-disable */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const S3CacheAction = require('../s3CacheAction');
const { addPipelineIdToKey, restoreCache, uploadCache } = require('../taskUtils');

// ────────────────────────────────────────────────────────────────
// Azure Pipelines Task Lib mock (in-memory)
// ────────────────────────────────────────────────────────────────
jest.mock('azure-pipelines-task-lib/task', () => {
  const pipelineVars = new Map();
  const taskVars = new Map();

  return {
    getVariable: (name) => pipelineVars.get(name),
    setVariable: (name, value /*, secret? */) => {
      pipelineVars.set(name, value);
    },

    getTaskVariable: (name) => taskVars.get(name),
    setTaskVariable: (name, value) => {
      taskVars.set(name, value);
    },

    setResult: jest.fn(), // will be spied in tests
    TaskResult: {
      Succeeded: 'Succeeded',
      Skipped: 'Skipped',
      Failed: 'Failed',
    },
  };
});

const tl = require('azure-pipelines-task-lib/task');

// ────────────────────────────────────────────────────────────────
/**
 * Deterministic in-memory S3 mock mirroring AWS SDK request semantics.
 */
// ────────────────────────────────────────────────────────────────
function makeFakeS3() {
  const store = new Map();   // key => Buffer
  const buckets = new Set(); // set of valid buckets
  const keyOf = (Bucket, Key) => `${Bucket}/${Key}`;

  const toBuffer = async (Body) => {
    if (!Body) return Buffer.alloc(0);
    if (Buffer.isBuffer(Body)) return Body;
    if (typeof Body === 'string') return Buffer.from(Body);
    if (Body && typeof Body.on === 'function') {
      // Readable stream
      return await new Promise((resolve, reject) => {
        const chunks = [];
        Body.on('data', (c) => chunks.push(Buffer.from(c)));
        Body.on('end', () => resolve(Buffer.concat(chunks)));
        Body.on('error', reject);
      });
    }
    return Buffer.from(JSON.stringify(Body));
  };

  const requestFromBuffer = (buf) => ({
    createReadStream() {
      const { Readable } = require('stream');
      const r = new Readable({
        read() {
          this.push(buf);
          this.push(null);
        }
      });
      return r;
    },
    promise() {
      return Promise.resolve({ Body: buf });
    }
  });

  return {
    createBucket: ({ Bucket }) => ({
      promise: () => {
        buckets.add(Bucket);
        return Promise.resolve();
      }
    }),

    upload: ({ Bucket, Key, Body }) => ({
      promise: async () => {
        if (!Bucket) {
          const err = new Error("Missing required key 'Bucket' in params");
          err.code = 'ParamValidationError';
          throw err;
        }
        if (!Key) {
          const err = new Error("Missing required key 'Key' in params");
          err.code = 'ParamValidationError';
          throw err;
        }
        if (!buckets.has(Bucket)) {
          const err = new Error('The specified bucket does not exist');
          err.code = 'NoSuchBucket';
          throw err;
        }
        const b = await toBuffer(Body);
        store.set(keyOf(Bucket, Key), b);
        return { Bucket, Key };
      }
    }),

    headObject: ({ Bucket, Key }) => ({
      promise: () => {
        const k = keyOf(Bucket, Key);
        if (store.has(k)) return Promise.resolve({});
        const err = new Error('NotFound');
        err.code = 'NotFound';
        return Promise.reject(err);
      }
    }),

    getObject: ({ Bucket, Key }) => {
      const k = keyOf(Bucket, Key);
      if (!store.has(k)) {
        const err = new Error('NoSuchKey');
        err.code = 'NoSuchKey';
        return { promise: () => Promise.reject(err) };
      }
      const buf = store.get(k);
      return requestFromBuffer(buf);
    }
  };
}

// ────────────────────────────────────────────────────────────────
// Helpers for real filesystem temp fixture
// ────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content);
}

// ────────────────────────────────────────────────────────────────
// Test constants & lifecycle
// ────────────────────────────────────────────────────────────────
let awsS3Client;
let cacheAction;
let randomBucket;

let tempRoot; // temp working root for each test run
let vars;     // paths bound to tempRoot

beforeAll(() => {
  awsS3Client = makeFakeS3(); // fully offline
});

beforeEach(async () => {
  global.console = { log: jest.fn() };

  // Build a fresh real FS sandbox for each test
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'apim-s3-cache-action-'));
  vars = {
    testDataDir: path.join(tempRoot, 'testdata'),
    extractDir: path.join(tempRoot, 'extract_location'),
    virtualEnv: path.join(tempRoot, 'fakeVenv'),
    extractVenv: path.join(tempRoot, 'anotherVenv'),
    emptyDir: path.join(tempRoot, 'emptyDir'),
  };

  // Synthetic Python venv — include bin/python to avoid ENOENTs
  const originalShebang = '#!/home/ubuntu/some-project/.venv/bin/python';
  const activatePath = '/home/zaphod/apm/apim-s3-cache-action/.venv';

  ensureDir(path.join(vars.virtualEnv, 'bin'));
  ensureDir(path.join(vars.virtualEnv, 'lib'));
  ensureDir(path.join(vars.virtualEnv, 'include'));

  writeFile(path.join(vars.virtualEnv, 'bin', 'python'), '#!/usr/bin/env python\nprint("fake python")\n');
  writeFile(path.join(vars.virtualEnv, 'bin', 'wait_for_dns'), `${originalShebang}\n# other lines\n`);
  writeFile(path.join(vars.virtualEnv, 'bin', 'exec_python'), "echo 'start'\n'''exec' /agent/apath/.venv/bin/python \n");
  writeFile(path.join(vars.virtualEnv, 'bin', 'activate.csh'), `setenv VIRTUAL_ENV "${activatePath}"\n`);
  writeFile(path.join(vars.virtualEnv, 'bin', 'activate.fish'), `set -gx VIRTUAL_ENV "${activatePath}"\n`);
  writeFile(path.join(vars.virtualEnv, 'bin', 'activate'), `VIRTUAL_ENV="${activatePath}"\n`);
  writeFile(path.join(vars.virtualEnv, 'bin', 'exec_other'), "echo 'other'\n");
  writeFile(path.join(vars.virtualEnv, 'bin', 'Activate.ps1'), "Write-Host 'PowerShell activate'\n");
  writeFile(path.join(vars.virtualEnv, 'bin', 'another_python_script.py'), "print('no shebang here')\n");
  writeFile(path.join(vars.virtualEnv, 'bin', 'something_else'), "line1\nline2\n");

  // Test data (file + nested dir)
  ensureDir(vars.testDataDir);
  writeFile(path.join(vars.testDataDir, 'test.json'), '{"hello":"world"}');
  ensureDir(path.join(vars.testDataDir, 'testDataNested'));
  writeFile(path.join(vars.testDataDir, 'testDataNested', 'test2.json'), '{"foo":"bar"}');

  // Extraction targets and empty dir
  ensureDir(vars.extractDir);
  ensureDir(vars.extractVenv);
  ensureDir(vars.emptyDir);

  // Create bucket and cache action
  randomBucket = uuidv4();
  await awsS3Client.createBucket({ Bucket: randomBucket }).promise();
  cacheAction = new S3CacheAction({ s3Client: awsS3Client, bucket: randomBucket });

  // Ensure task lib default state
  tl.setVariable('System.DefinitionId', undefined);
  tl.setVariable('System.DefaultWorkingDirectory', undefined);
  tl.setTaskVariable('cacheRestored', undefined);
});

afterEach(() => {
  // Clean up the temp sandbox
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch (e) {
    // ignore cleanup errors
  }
  jest.clearAllMocks();
  delete process.env.SHOULD_DEBUG;
});

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('addPipelineIdToKey', () => {
  test('pipelineId is appended to key (happy path)', async () => {
    tl.getVariable = jest.fn((name) => {
      if (name === 'System.DefinitionId') return '1234';
      return undefined;
    });

    const keyInput = '"Test"\n data/testData/test.json \n test.json';
    const hashedKey = await cacheAction.createCacheKey(keyInput, __dirname);
    const outputKey = addPipelineIdToKey(hashedKey);
    expect(outputKey).toBe(`1234/${hashedKey}`);
  });

  test('throws when pipeline ID missing', async () => {
    tl.getVariable = jest.fn(() => undefined);
    const keyInput = '"Test"\n data/testData/test.json \n test.json';
    const hashedKey = await cacheAction.createCacheKey(keyInput, __dirname);
    expect(() => addPipelineIdToKey(hashedKey))
      .toThrow('Pipeline ID undefined, check var: $(System.DefinitionId)');
  });
});

describe('restoreCache', () => {
  test('file — cache entry restored to location & sets cacheRestored=true', async () => {
    const pipelineInput = {
      key: '"Test"\n data/testData/test.json \n test.json',
      location: vars.extractDir, // absolute
      bucket: randomBucket,
      pipelineIsolated: false,
    };

    const pathToFile = path.join(vars.testDataDir, 'test.json');
    const hashedKey = await cacheAction.createCacheKey(pipelineInput.key, __dirname);
    await cacheAction.createCacheEntry(pathToFile, 'global/' + hashedKey);

    const readExtractDir = () => fs.readdirSync(vars.extractDir);
    expect(readExtractDir().length).toBe(0);

    process.env.SHOULD_DEBUG = 'true'; // exercise logging path
    await restoreCache(pipelineInput, awsS3Client);

    expect(readExtractDir().length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(vars.extractDir, 'test.json'))).toBe(true);
    expect(tl.getTaskVariable('cacheRestored')).toBe('true');
    expect(global.console.log).toHaveBeenCalledWith('Cache restored: true');
  });

  test('directory — cache entry restored to location', async () => {
    const pipelineInput = {
      key: '"Test"\n data/testData \n testData',
      location: vars.extractDir,
      bucket: randomBucket,
      pipelineIsolated: false,
    };

    const pathToDir = vars.testDataDir;
    const hashedKey = await cacheAction.createCacheKey(pipelineInput.key, __dirname);
    await cacheAction.createCacheEntry(pathToDir, 'global/' + hashedKey);

    const readExtractDir = () => fs.readdirSync(vars.extractDir);
    expect(readExtractDir().length).toBe(0);

    await restoreCache(pipelineInput, awsS3Client);

    expect(fs.existsSync(path.join(vars.extractDir, 'test.json'))).toBe(true);
    expect(fs.existsSync(path.join(vars.extractDir, 'testDataNested', 'test2.json'))).toBe(true);
    expect(tl.getTaskVariable('cacheRestored')).toBe('true');
  });

  test('cache miss — sets cacheRestored=false and logs', async () => {
    const pipelineInput = {
      key: '"Test"\n data/testData \n testData',
      location: vars.extractDir,
      bucket: randomBucket,
      pipelineIsolated: false,
    };
    process.env.SHOULD_DEBUG = 'true';
    await restoreCache(pipelineInput, awsS3Client);
    expect(tl.getTaskVariable('cacheRestored')).toBe('false');
    expect(global.console.log).toHaveBeenCalledWith('Cache restored: false');
  });
});

describe('uploadCache', () => {
  test('uploads file and reports success', async () => {
    const pipelineInput = {
      key: '"Test"\n data/testData \n testData/test.json',
      location: path.join(vars.testDataDir, 'test.json'),
      bucket: randomBucket,
      pipelineIsolated: false,
      version: '1.0.0',
    };

    tl.setTaskVariable('cacheRestored', 'false');
    tl.setResult = jest.fn();

    await uploadCache(pipelineInput, awsS3Client);

    expect(tl.setResult).toHaveBeenCalledWith(
      tl.TaskResult.Succeeded,
      'Uploaded to cache.'
    );
  });

  test('uploads directory and reports success', async () => {
    const pipelineInput = {
      key: '"Test"\n data/testData \n testData',
      location: vars.testDataDir,
      bucket: randomBucket,
      pipelineIsolated: false,
      version: '1.0.0',
    };

    tl.setTaskVariable('cacheRestored', 'false');
    tl.setResult = jest.fn();

    await uploadCache(pipelineInput, awsS3Client);

    expect(tl.setResult).toHaveBeenCalledWith(
      tl.TaskResult.Succeeded,
      'Uploaded to cache.'
    );
  });

  test('upload skipped — no cache reported (cacheRestored undefined)', async () => {
    const pipelineInput = {
      key: '"Test"\n data/testData \n testData',
      location: vars.extractDir,
      bucket: randomBucket,
      pipelineIsolated: false,
      version: '1.0.0',
    };

    tl.setResult = jest.fn();

    await uploadCache(pipelineInput, awsS3Client);

    expect(tl.setResult).toHaveBeenCalledWith(
      tl.TaskResult.Skipped,
      'No cache reported. Upload skipped.'
    );
  });

  test('upload skipped — cache exists (cacheRestored true)', async () => {
    const pipelineInput = {
      key: '"Test"\n data/testData \n testData',
      location: vars.extractDir,
      bucket: randomBucket,
      pipelineIsolated: false,
      version: '1.0.0',
    };

    // Create a cache and mark restored, then attempt upload
    const pathToDir = vars.testDataDir;
    const hashedKey = await cacheAction.createCacheKey(pipelineInput.key, __dirname);
    await cacheAction.createCacheEntry(pathToDir, 'global/' + hashedKey);
    await restoreCache(pipelineInput, awsS3Client); // sets cacheRestored=true

    tl.setResult = jest.fn();
    await uploadCache(pipelineInput, awsS3Client);

    expect(tl.setResult).toHaveBeenCalledWith(
      tl.TaskResult.Skipped,
      'Cache exists. Upload skipped.'
    );
  });

  // ── Error scenarios ───────────────────────────────────────────
  test('no bucket provided', async () => {
    const pipelineInput = {
      key: '"Test"\n data/testData \n testData',
      location: vars.testDataDir,
      bucket: null, // invalid
      pipelineIsolated: false,
      version: '1.0.0',
    };
    try {
      tl.setTaskVariable('cacheRestored', 'false');
      await uploadCache(pipelineInput, awsS3Client);
      throw new Error('expected throw');
    } catch (error) {
      expect(error.message).toBe("Missing required key 'Bucket' in params");
    }
  });

  

test('no key provided', async () => {
  const pipelineInput = {
    key: null, // invalid
    location: vars.testDataDir,
    bucket: randomBucket,
    pipelineIsolated: false,
    version: '1.0.0',
  };
  tl.setTaskVariable('cacheRestored', 'false');
  await expect(uploadCache(pipelineInput, awsS3Client))
    .rejects
    .toThrow("Missing required key 'Key' in params");
});


  test('no location provided', async () => {
    const pipelineInput = {
      key: '"Test"\n data/testData \n testData',
      location: null, // invalid
      bucket: randomBucket,
      pipelineIsolated: false,
      version: '1.0.0',
    };
    try {
      tl.setTaskVariable('cacheRestored', 'false');
      await uploadCache(pipelineInput, awsS3Client);
      throw new Error('expected throw');
    } catch (error) {
      // Accept either Node error string (depends on number of args passed to path.resolve)
      expect(error.message).toMatch(/Received null/);
    }
  });
});
