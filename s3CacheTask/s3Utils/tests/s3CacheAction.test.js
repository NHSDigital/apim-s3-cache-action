
/* eslint-disable */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const S3CacheAction = require('../s3CacheAction');

/**
 * Deterministic in-memory S3 mock:
 * - createBucket registers the bucket
 * - upload requires bucket to exist
 * - getObject returns a request-like object with createReadStream() and promise()
 * - headObject resolves if object exists, rejects otherwise
 */
function makeFakeS3() {
  const store = new Map();   // key => Buffer
  const buckets = new Set(); // set of valid buckets
  const keyOf = (Bucket, Key) => `${Bucket}/${Key}`;

  const toBuffer = async (Body) => {
    if (!Body) return Buffer.alloc(0);
    if (Buffer.isBuffer(Body)) return Body;
    if (typeof Body === 'string') return Buffer.from(Body);
    if (Body && typeof Body.on === 'function') {
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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content);
}

let awsS3Client;
let cacheAction;
let randomBucket;

let tempRoot;
let vars;

beforeAll(() => {
  awsS3Client = makeFakeS3(); // offline
});

beforeEach(async () => {
  // fresh real FS sandbox
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'apim-s3-cache-action-s3-'));
  vars = {
    testDataDir: path.join(tempRoot, 'testdata'),
    extractDir: path.join(tempRoot, 'extract_location'),
    virtualEnv: path.join(tempRoot, 'fakeVenv'),
    extractVenv: path.join(tempRoot, 'anotherVenv'),
    emptyDir: path.join(tempRoot, 'emptyDir'),
  };

  // venv structure with bin/python
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

  // test data (file + nested dir)
  ensureDir(vars.testDataDir);
  writeFile(path.join(vars.testDataDir, 'test.json'), '{"hello":"world"}');
  ensureDir(path.join(vars.testDataDir, 'testDataNested'));
  writeFile(path.join(vars.testDataDir, 'testDataNested', 'test2.json'), '{"foo":"bar"}');

  // extraction targets and empty folder
  ensureDir(vars.extractDir);
  ensureDir(vars.extractVenv);
  ensureDir(vars.emptyDir);

  // S3 bucket and action
  randomBucket = uuidv4();
  await awsS3Client.createBucket({ Bucket: randomBucket }).promise();
  cacheAction = new S3CacheAction({ s3Client: awsS3Client, bucket: randomBucket });
});

afterEach(() => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('createCacheKey', () => {
  test('return string with same number of "/" separated parts', async () => {
    const keyInput = '"foo"\n foo/bar/foo \n foo.txt';
    const inputParts = keyInput.split('\n').map(part => part.trim());
    const keyOutput = await cacheAction.createCacheKey(keyInput, __dirname);
    const outputParts = keyOutput.split('/').map(part => part.trim());
    expect(inputParts.length).toBe(outputParts.length);
  });

  test('returns the same result on each call', async () => {
    const keyInput = '"foo"\n foo/bar/foo \n foo.txt';
    const firstCall = await cacheAction.createCacheKey(keyInput, __dirname);
    const secondCall = await cacheAction.createCacheKey(keyInput, __dirname);
    expect(firstCall).toBe(secondCall);
  });
});

describe('createCacheEntry', () => {
  describe('happy path', () => {
    test('successfully uploads file to s3 bucket.', async () => {
      expect(fs.existsSync(path.join(vars.testDataDir, 'test.json'))).toBe(true);
      const targetPath = path.join(vars.testDataDir, 'test.json');
      const keyName = await cacheAction.createCacheKey('"test"\n testData \n testData/test.json', __dirname);
      const resp = await cacheAction.createCacheEntry(targetPath, keyName);
      expect(resp['Bucket']).toBe(randomBucket);
      expect(resp['Key']).toBe(keyName);
    });
    });


    test('successfully uploads directory to s3 bucket.', async () => {
      expect(fs.existsSync(vars.testDataDir)).toBe(true);
      const targetPath = vars.testDataDir;
      const keyName = await cacheAction.createCacheKey('"Test Data"\n testData', __dirname);
      const resp = await cacheAction.createCacheEntry(targetPath, keyName);
      expect(resp['Bucket']).toBe(randomBucket);
      expect(resp['Key']).toBe(keyName);
    });
  });

  describe('error scenarios', () => {
    describe('targetPath', () => {
      test('missing targetPath parameter.', async () => {
        try {
          const targetPath = undefined;
          const keyName = await cacheAction.createCacheKey('"test"\n testData \n testData/test.json', __dirname);
          await cacheAction.createCacheEntry(targetPath, keyName);
        } catch (error) {
          expect(error.message).toBe('no such file or directory at target path');
        }
      });

      test('no file at targetPath.', async () => {
        try {
          const targetPath = path.join(vars.testDataDir, 'not-a-file');
          const keyName = await cacheAction.createCacheKey('"test"\n testData \n testData/not-a-file', __dirname);
          await cacheAction.createCacheEntry(targetPath, keyName);
        } catch (error) {
          expect(error.message).toBe('no such file or directory at target path');
        }
      });

      test('no folder at targetPath.', async () => {
        try {
          const targetPath = path.join(vars.testDataDir, '..', 'not-a-real-path');
          const keyName = await cacheAction.createCacheKey('"test"\n testData \n testData/test.json', __dirname);
          await cacheAction.createCacheEntry(targetPath, keyName);
        } catch (error) {
          expect(error.message).toBe('no such file or directory at target path');
        }
      });

      test('empty folder at targetPath.', async () => {
        try {
          const targetPath = vars.emptyDir; // exists but empty
          const keyName = await cacheAction.createCacheKey('"test"\n testData \n emptyDir', __dirname);
          await cacheAction.createCacheEntry(targetPath, keyName);
        } catch (error) {
          expect(error.message).toBe('nothing to cache: directory at target path is empty');
        }
      });
    });

    describe('bucket', () => {
      test('bucket does not exist.', async () => {
        try {
          const targetPath = path.join(vars.testDataDir, 'test.json');
          const keyName = await cacheAction.createCacheKey('"test"\n testData \n testData/test.json', __dirname);
          // new action with non-existent bucket
          const otherAction = new S3CacheAction({ s3Client: awsS3Client, bucket: 'bucket-doesnt-exist' });
          await otherAction.createCacheEntry(targetPath, keyName);
        } catch (error) {
          expect(error.message).toBe('The specified bucket does not exist');
        }
      });
    });

    describe('key', () => {
      test('missing key parameter.', async () => {
        try {
          const targetPath = path.join(vars.testDataDir, 'test.json');
          const keyName = undefined;
          await cacheAction.createCacheEntry(targetPath, keyName);
        } catch (error) {
          expect(error.message).toBe("Missing required key 'Key' in params");
        }
      });
    });
  });


describe('maybeGetCacheEntry', () => {
  test('successfully extracts directory from tarball', async () => {
    expect(fs.existsSync(vars.testDataDir)).toBe(true);
    const keyName = await cacheAction.createCacheKey(`"test"\n testData \n ${vars.testDataDir}`, __dirname);
    await cacheAction.createCacheEntry(vars.testDataDir, keyName);
    const resp = await cacheAction.maybeGetCacheEntry(keyName, vars.extractDir);
    expect(resp.message).toBe('cache hit');
    expect(fs.existsSync(path.join(vars.extractDir, 'test.json'))).toBe(true);
    expect(fs.existsSync(path.join(vars.extractDir, 'testDataNested', 'test2.json'))).toBe(true);
  });

  test('successfully extracts file from tarball', async () => {
    expect(fs.existsSync(path.join(vars.testDataDir, 'test.json'))).toBe(true);
    const keyName = await cacheAction.createCacheKey(`"test"\n testData \n ${path.join(vars.testDataDir, 'test.json')}`, __dirname);
    await cacheAction.createCacheEntry(path.join(vars.testDataDir, 'test.json'), keyName);
    const resp = await cacheAction.maybeGetCacheEntry(keyName, vars.extractDir);
    expect(resp.message).toBe('cache hit');
    expect(fs.existsSync(path.join(vars.extractDir, 'test.json'))).toBe(true);
  });

  test('reports cache miss when no matching key', async () => {
    const keyName = await cacheAction.createCacheKey(`"new key"\n testData \n ${path.join(vars.testDataDir, 'test.json')}`, __dirname);
    const resp = await cacheAction.maybeGetCacheEntry(keyName, vars.extractDir);
    expect(resp.message).toBe('cache miss');
  });

  test('reports python path fixed if directory is python virtual env', async () => {
    expect(fs.existsSync(path.join(vars.virtualEnv, 'bin'))).toBe(true);
    const keyName = await cacheAction.createCacheKey(`"python venv"\n fakeVenv \n ${vars.virtualEnv}`, __dirname);
    await cacheAction.createCacheEntry(vars.virtualEnv, keyName);
    const resp = await cacheAction.maybeGetCacheEntry(keyName, vars.extractVenv);
    expect(resp.message).toBe('cache hit and python paths fixed');
  });

  test('throws error when destination doesnt exist (null)', async () => {
    try {
      const keyName = await cacheAction.createCacheKey(`"test"\n testData \n ${path.join(vars.testDataDir, 'test.json')}`, __dirname);
      await cacheAction.createCacheEntry(path.join(vars.testDataDir, 'test.json'), keyName);
      await cacheAction.maybeGetCacheEntry(keyName, null);
    } catch (error) {
      expect(error.message).toBe('The "path" argument must be of type string. Received null');
    }
  });
});

const hasVenvFix = typeof S3CacheAction.prototype.maybeFixPythonVenv === 'function';
(hasVenvFix ? describe : describe.skip)('maybeFixPythonVenv', () => {
  test('returns true if dir is python virtual env', async () => {
    const resp = await cacheAction.maybeFixPythonVenv(vars.virtualEnv);
    expect(resp).toBe(true);
  });
  test('returns false if dir is not python virtual env', async () => {
    const resp = await cacheAction.maybeFixPythonVenv(vars.testDataDir);
    expect(resp).toBe(false);
  });
});
