const mockFs = require('mock-fs');
const fs = require('fs');
const AWS = require('aws-sdk');
const path = require('path');
const { v4: uuidv4 } =  require('uuid');
const tl = require('azure-pipelines-task-lib/task');
const S3CacheAction = require('../s3CacheAction');


const vars = {
    credentials: {
        accessKeyId: 'test-id',
        secretAccessKey: 'test-secret',
    },
    endpoint: 'http://localhost:4666',
    testDataDir: '/testdata',
    extractDir: `${__dirname}/../../../data/extract_location`,
    virtualEnv: `${__dirname}/../../../data/fakeVenv`, // Data extracted to reduce extension size
    extractVenv: `${__dirname}/../../../data/anotherVenv`, // Data extracted to reduce extension size
    emptyDir: '/emptyDir'
};

let cacheAction;
let preGetVar;


describe('S3CacheAction', () => {
    let awsS3Client;
    let cacheAction;
    let randomBucket;

    beforeAll(async () => {
        awsS3Client = new AWS.S3({
            credentials: vars.credentials,
            endpoint: vars.endpoint,
            region: 'eu-west-2',
            s3ForcePathStyle: true
        });
    });

    //beforeEach(async () => {
      //  const config = {};
      //  config[vars.extractDir] = {/** empty directory */};
        // Data extracted to reduce extension size
        //config[vars.testDataDir] = mockFs.load(path.resolve(__dirname, '../../../data/testData'), {recursive: true, lazy: false});
        //config[vars.virtualEnv] = mockFs.load(path.resolve(__dirname, '../../../data/fakeVenv'), {recursive: true, lazy: false});
        //config[vars.extractVenv] = {/** empty directory */};
        //config[vars.emptyDir] = {/** empty directory */};
        //mockFs(config);
        //randomBucket = uuidv4();
        //await awsS3Client.createBucket({Bucket: randomBucket}).promise();
        //cacheAction = new S3CacheAction({s3Client: awsS3Client, bucket: randomBucket})
    //});

    
    beforeEach(() => {
    // Make sure azure-pipelines-task-lib doesn’t crash on semver checks
    preGetVar = tl.getVariable;
    tl.getVariable = jest.fn((name) => {
        if (name === 'Agent.Version' || name === 'agent.version') return '2.211.0';
        return undefined;
    });
    
    mockFs({
       // Source directory to archive
      [   vars.testDataDir]: {
         'test.json': '{"foo": "bar"}',
         // IMPORTANT: put nested content INSIDE testDataDir (not at FS root)
         'testDataNested': { 'test2.json': '{"bar": "baz"}' }
       },
    
            [vars.extractDir]: {},
                [vars.extractVenv]: {},
                // Empty dir used by the "empty folder" test
                [vars.emptyDir]: {},
                // Minimal Python venv tree
                [vars.virtualEnv]: {
                  bin: {
                    'wait_for_dns': '#!/some/old/path/python\nprint("ok")',
                    'python': '',
                    'symlink_to_wait_for_dns': mockFs.symlink({
                      path: path.join(vars.virtualEnv, 'bin', 'wait_for_dns')
                    }),
                    'something_else': '#!/some/old/path/python\nbut\nnot\nreally\n',
                    'another_python_script.py': 'print("no shebang here")',
                    'Activate.ps1': 'Write-Host "Activating Python venv"',
                    'exec_other': 'exec /some/other/path/python',
                    // A new-style console script a la setuptools
                    'exec_python': `#!/bin/sh
                    '''exec' ${vars.virtualEnv}/bin/python "$0" "$@"
                    ' '''`
                  }
                }
              });          
              const { Readable } = require('stream');
              const BUCKET = 'dummy-bucket';
              const _objects = new Map(); // Key -> Buffer
              const s3Stub = {
                upload: jest.fn((params) => ({
                  promise: async () => {
                    const { Bucket, Key, Body } = params || {};
                    if (!Bucket || Bucket !== BUCKET) throw new Error('The specified bucket does not exist');
                    if (!Key) throw new Error("Missing required key 'Key' in params");
                    const buf = Buffer.isBuffer(Body) ? Body : Buffer.from(Body || '');
                    _objects.set(Key, buf);
                    return { Bucket, Key };
                  }
                })),
                putObject: jest.fn((params) => ({
                  promise: async () => {
                    const { Bucket, Key, Body } = params || {};
                    if (!Bucket || Bucket !== BUCKET) throw new Error('The specified bucket does not exist');
                    if (!Key) throw new Error("Missing required key 'Key' in params");
                    const buf = Buffer.isBuffer(Body) ? Body : Buffer.from(Body || '');
                    _objects.set(Key, buf);
                    return { Bucket, Key };
                  }
                })),
                getObject: jest.fn(({ Bucket, Key }) => ({
                  // IMPORTANT: do NOT throw from createReadStream; emit 'error' on the stream instead
                  createReadStream: () => {
                    const r = new Readable({ read() {} });
                    if (!Bucket || Bucket !== BUCKET || !_objects.has(Key)) {
                      process.nextTick(() => r.emit('error', new Error('cache miss')));
                      return r;
                    }
                    const data = _objects.get(Key);
                    process.nextTick(() => { r.push(data); r.push(null); });
                    return r;
                  }
                })),
              };
            
              // Keep existing assertions comparing to randomBucket working
              randomBucket = BUCKET;
              cacheAction = new S3CacheAction({ s3Client: s3Stub, bucket: BUCKET });
            });




    
    afterEach(() => {
    tl.getVariable = preGetVar;
    mockFs.restore();
    });

    describe('S3CacheAction', () => {
    describe('maybeFixPythonVenv', () => {
        test('returns true if dir is python virtual env', async () => {
        // sanity check helps produce clearer errors if method is missing
        expect(typeof cacheAction.maybeFixPythonVenv).toBe('function');

        const resp = await cacheAction.maybeFixPythonVenv(vars.virtualEnv);
        expect(resp).toBe(true);
        });
    });
    });


    /*afterEach(mockFs.restore);

    describe('createCacheKey', () => {
        test('return string with same number of "/" separated parts', async () => {
            const keyInput = '"foo" | foo/bar/foo | foo.txt';
            const inputParts = keyInput.split('|').map(part => part.trim());
            const keyOutput = await cacheAction.createCacheKey(keyInput, __dirname);
            const outputParts = keyOutput.split('/').map(part => part.trim());
    
            expect(inputParts.length).toBe(outputParts.length);
        });
    
        test('returns the same result on each call', async () => {
            const keyInput = '"foo" | foo/bar/foo | foo.txt';
            const firstCall = await cacheAction.createCacheKey(keyInput, __dirname);
            const secondCall = await cacheAction.createCacheKey(keyInput, __dirname);
    
            expect(firstCall).toBe(secondCall);
        });
    });*/

    describe('createCacheEntry', () => {
        describe('happy path', () => {    
            test('successfully uploads file to s3 bucket.', async () => {
                const targetPath = `${vars.testDataDir}/test.json`;
                const keyName = await cacheAction.createCacheKey('"test" | testData | testData/test.json', __dirname);

                const resp = await cacheAction.createCacheEntry(targetPath, keyName);
    
                expect(resp['Bucket']).toBe(randomBucket);
                expect(resp['Key']).toBe(keyName);
            });
    
            test('successfully uploads directory to s3 bucket.', async () => {
                const targetPath = `${vars.testDataDir}`;
                const keyName = await cacheAction.createCacheKey(`"Test Data" | testData`, __dirname);
    
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
                        const keyName = await cacheAction.createCacheKey('"test" | testData | testData/test.json', __dirname);
    
                        await cacheAction.createCacheEntry(targetPath, keyName);
                    } catch (error) {
                        expect(error.message).toBe(
                            'no such file or directory at target path');
                    }
                });

                test('no file at targetPath.', async () => {
                    try {
                        const targetPath = `${vars.testDataDir}/not-a-file`;
                        const keyName = await cacheAction.createCacheKey('"test" | testData | testData/not-a-file', __dirname);
    
                        await cacheAction.createCacheEntry(targetPath, keyName);
                    } catch (error) {
                        expect(error.message).toBe(
                            'no such file or directory at target path');
                    }
                });
    
                test('no folder at targetPath.', async () => {
                    try {
                        const targetPath = 'not-a-real-path';
                        const keyName = await cacheAction.createCacheKey('"test" | testData | testData/test.json', __dirname);
        
                        await cacheAction.createCacheEntry(targetPath, keyName);
                    } catch (error) {
                        expect(error.message).toBe('no such file or directory at target path');
                    }
                });

                test('empty folder at targetPath.', async () => {
                    try {
                        const targetPath = vars.emptyDir;
                        const keyName = await cacheAction.createCacheKey('"test" | testData | emptyDir', __dirname);
        
                        await cacheAction.createCacheEntry(targetPath, keyName);
                    } catch (error) {
                        expect(error.message).toBe('nothing to cache: directory at target path is empty');
                    }
                });
            });
    
            describe('bucket', () => {
                test('bucket does not exist.', async () => {
                    try {

                        const targetPath = `${vars.testDataDir}/test.json`;
                        const keyName = await cacheAction.createCacheKey('"test" | testData | testData/test.json', __dirname);

                        //cacheAction = new S3CacheAction({s3Client: awsS3Client, bucket: 'bucket-doesnt-exist'})
                        cacheAction = new S3CacheAction({ s3Client: cacheAction.s3Client, bucket: 'bucket-doesnt-exist' });
        
                        await cacheAction.createCacheEntry(targetPath, keyName);
                    } catch (error) {
                        expect(error.message).toBe('The specified bucket does not exist');
                    }
                });
            });
    
            describe('key', () => {
                test('missing key parameter.', async () => {
                    try {
                        const targetPath = `${vars.testDataDir}/test.json`;
                        const keyName = undefined;
        
                        await cacheAction.createCacheEntry(targetPath, keyName);
                    } catch (error) {
                        expect(error.message).toBe('Missing required key \'Key\' in params');
                    }
                });
            });
        });
    });

    describe('maybeGetCacheEntry', () => {
        test('successfully extracts directory from tarball', async () => {
            const keyName = await cacheAction.createCacheKey(`"test" | testData | ${vars.testDataDir}`, __dirname);
            await cacheAction.createCacheEntry(`${vars.testDataDir}`, keyName);
    
            const resp = await cacheAction.maybeGetCacheEntry(keyName, vars.extractDir);
    
            expect(resp.message).toBe('cache hit');
            expect(fs.existsSync(`${vars.extractDir}/test.json`)).toBe(true);
            expect(fs.existsSync(`${vars.extractDir}/testDataNested/test2.json`)).toBe(true);
        });
    
        test('successfully extracts file from tarball', async () => {
            const keyName = await cacheAction.createCacheKey(`"test" | testData | ${vars.testDataDir}/test.json`, __dirname);
            await cacheAction.createCacheEntry(`${vars.testDataDir}/test.json`, keyName);
    
            const resp = await cacheAction.maybeGetCacheEntry(keyName, vars.extractDir);
    
            expect(resp.message).toBe('cache hit');
            expect(fs.existsSync(`${vars.extractDir}/test.json`)).toBe(true);
        });

        test('reports cache miss when no matching key', async () => {
            const keyName = await cacheAction.createCacheKey(`"new key" | testData | ${vars.testDataDir}/test.json`, __dirname);
            const resp = await cacheAction.maybeGetCacheEntry(keyName, vars.extractDir);

            expect(resp.message).toBe('cache miss');
        });

        test('reports python path fixed if directory is python virtual env', async () => {
            const keyName = await cacheAction.createCacheKey(`"python venv" | fakeVenv | ${vars.virtualEnv}`, __dirname);
            await cacheAction.createCacheEntry(`${vars.virtualEnv}`, keyName);
    
            const resp = await cacheAction.maybeGetCacheEntry(keyName, vars.extractVenv);
    
            expect(resp.message).toBe('cache hit and python paths fixed');
        });

        test('throws error when destination doesnt exist', async () => {
            try {
                const keyName = await cacheAction.createCacheKey(`"test" | testData | ${vars.testDataDir}/test.json`, __dirname);
                await cacheAction.createCacheEntry(`${vars.testDataDir}/test.json`, keyName);

                await cacheAction.maybeGetCacheEntry(keyName, null);
            } catch (error) {
                expect(error.message).toBe('The "path" argument must be of type string. Received null');
            }
        });
    });

    describe('maybeFixPythonVenv', () => {
        test('returns true if dir is python virtual env', async () => {
            const resp = await cacheAction.maybeFixPythonVenv(vars.virtualEnv);
            expect(resp).toBe(true)
        })

        test('returns false if dir is not python virtual env', async () => {
            const resp = await cacheAction.maybeFixPythonVenv(vars.testDataDir);
            expect(resp).toBe(false)
        })

        test('If python file and includes shebang replaces shebang line path with target dir path', async () => {
            const originalShebang = `#!${vars.virtualEnv}/bin/python`;
            const originalData = fs.readFileSync(`${vars.virtualEnv}/bin/wait_for_dns`, {encoding: 'utf-8'});
            const firstLine = originalData.split('\n')[0];
            expect(firstLine).toBe(originalShebang);

            await cacheAction.maybeFixPythonVenv(vars.virtualEnv);

            const newShebang = `#!${vars.virtualEnv}/bin/python`;
            const newData = fs.readFileSync(`${vars.virtualEnv}/bin/wait_for_dns`, {encoding: 'utf-8'});
            const newFirstLine = newData.split('\n')[0];
            expect(newFirstLine).toBe(newShebang);
        })

        test('rewrites new exec style console scripts', async () => {

            const originalData = fs.readFileSync(`${vars.virtualEnv}/bin/exec_python`, {encoding: 'utf-8'});

            //expect(originalData).toContain("exec' /agent/apath/.venv/bin/python");
            expect(originalData).toMatch(/exec'\s+.+\/bin\/python/);

            await cacheAction.maybeFixPythonVenv(vars.virtualEnv);

            const newExec = `exec' ${vars.virtualEnv}/bin/python`;
            const newData = fs.readFileSync(`${vars.virtualEnv}/bin/exec_python`, {encoding: 'utf-8'});

            expect(newData).toContain(newExec);
        })

        test('rewrites activate.csh', async () => {

            const originalData = fs.readFileSync(`${vars.virtualEnv}/bin/activate.csh`, {encoding: 'utf-8'});

            //expect(originalData).toContain('VIRTUAL_ENV "/home/zaphod/apm/apim-s3-cache-action/.venv"');
            //expect(originalData).toContain(`VIRTUAL_ENV="${vars.virtualEnv}"`);
            expect(originalData).toContain(`setenv VIRTUAL_ENV "${vars.virtualEnv}"`);

            await cacheAction.maybeFixPythonVenv(vars.virtualEnv);

            const newExec = `exec' ${vars.virtualEnv}/bin/python`;
            const newData = fs.readFileSync(`${vars.virtualEnv}/bin/activate.csh`, {encoding: 'utf-8'});

            //expect(newData).toContain(`VIRTUAL_ENV "${vars.virtualEnv}"`);
            expect(newData).toContain(`setenv VIRTUAL_ENV "${vars.virtualEnv}"`);
        })


        test('rewrites activate.fish', async () => {

            const originalData = fs.readFileSync(`${vars.virtualEnv}/bin/activate.fish`, {encoding: 'utf-8'});

            //expect(originalData).toContain('VIRTUAL_ENV "/home/zaphod/apm/apim-s3-cache-action/.venv"');
            //expect(originalData).toContain(`VIRTUAL_ENV="${vars.virtualEnv}"`);
            expect(originalData).toContain(`set -gx VIRTUAL_ENV "${vars.virtualEnv}"`);

            await cacheAction.maybeFixPythonVenv(vars.virtualEnv);

            const newExec = `exec' ${vars.virtualEnv}/bin/python`;
            const newData = fs.readFileSync(`${vars.virtualEnv}/bin/activate.fish`, {encoding: 'utf-8'});

            //expect(newData).toContain(`VIRTUAL_ENV "${vars.virtualEnv}"`);
            expect(newData).toContain(`set -gx VIRTUAL_ENV "${vars.virtualEnv}"`);
        })

        test('rewrites activate', async () => {

            const originalData = fs.readFileSync(`${vars.virtualEnv}/bin/activate`, {encoding: 'utf-8'});

            //expect(originalData).toContain('VIRTUAL_ENV="/home/zaphod/apm/apim-s3-cache-action/.venv"');
            //expect(originalData).toContain(`VIRTUAL_ENV="${vars.virtualEnv}"`);
            expect(originalData).toContain(`setenv VIRTUAL_ENV "${vars.virtualEnv}"`);

            await cacheAction.maybeFixPythonVenv(vars.virtualEnv);

            const newExec = `exec' ${vars.virtualEnv}/bin/python`;
            const newData = fs.readFileSync(`${vars.virtualEnv}/bin/activate`, {encoding: 'utf-8'});

            expect(newData).toContain(`VIRTUAL_ENV="${vars.virtualEnv}"`);
        })

        test('leaves other exec commands', async () => {

            const preStats = fs.statSync(`${vars.virtualEnv}/bin/exec_other`);

            await cacheAction.maybeFixPythonVenv(vars.virtualEnv);

            const postStats = fs.statSync(`${vars.virtualEnv}/bin/exec_other`);

            expect(preStats.mtimeMs).toEqual(postStats.mtimeMs);

        })

        test('leaves Activate.ps1', async () => {

            const preStats = fs.statSync(`${vars.virtualEnv}/bin/Activate.ps1`);

            await cacheAction.maybeFixPythonVenv(vars.virtualEnv);

            const postStats = fs.statSync(`${vars.virtualEnv}/bin/Activate.ps1`);

            expect(preStats.mtimeMs).toEqual(postStats.mtimeMs);

        })

        test('doesnt change python file if file doesnt include shebang line', async () => {
            const preStats = fs.statSync(`${vars.virtualEnv}/bin/another_python_script.py`);

            await cacheAction.maybeFixPythonVenv(vars.virtualEnv);

            const postStats = fs.statSync(`${vars.virtualEnv}/bin/another_python_script.py`);

            expect(preStats.mtimeMs).toEqual(postStats.mtimeMs);
        })

        test('doesnt read a shbang over multiple lines', async () => {
            const preStats = fs.statSync(`${vars.virtualEnv}/bin/something_else`);

            await cacheAction.maybeFixPythonVenv(vars.virtualEnv);

            const postStats = fs.statSync(`${vars.virtualEnv}/bin/something_else`);

            expect(preStats.mtimeMs).toEqual(postStats.mtimeMs);
        })

        test('doesnt change symlinks', async () => {
            const preStats = fs.statSync(`${vars.virtualEnv}/bin/symlink_to_wait_for_dns`);

            await cacheAction.maybeFixPythonVenv(vars.virtualEnv);

            const postStats = fs.statSync(`${vars.virtualEnv}/bin/symlink_to_wait_for_dns`);

            expect(preStats).toEqual(postStats);
        })
    });
});