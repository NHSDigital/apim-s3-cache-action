const mockFs = require('mock-fs');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const tl = require('azure-pipelines-task-lib/task');
const { v4: uuidv4 } =  require('uuid');
const { addPipelineIdToKey, restoreCache, uploadCache } = require('../taskUtils');
const S3CacheAction = require('../s3CacheAction');

const vars = {
    credentials: {
        accessKeyId: 'test-id',
        secretAccessKey: 'test-secret',
    },
    endpoint: 'http://localhost:4666',
    testDataDir: '/testdata',
    extractDir: '/extract_location',
    virtualEnv: `${__dirname}/../../../data/fakeVenv`, // Data extracted to reduce extension size
    extractVenv: `${__dirname}/../../../data/anotherVenv`, // Data extracted to reduce extension size
    emptyDir: '/emptyDir'
};

describe('taskUtils', () => {
    let pipelineCacheRestoredResult;
    let awsS3Client;
    let cacheAction;
    let randomBucket;

    beforeAll(async () => {
        awsS3Client = new AWS.S3({
            credentials: vars.credentials,
            endpoint: vars.endpoint,
            s3ForcePathStyle: true
        });
        pipelineCacheRestoredResult = tl.getVariable('CacheRestored')
    });

    beforeEach(async () => {
        global.console = {
            log: jest.fn()
        };
        const config = {};
        config[vars.extractDir] = {/** empty directory */};
        // Data extracted to reduce extension size
        config[vars.testDataDir] = mockFs.load(path.resolve(__dirname, '../../../data/testData'), {recursive: true, lazy: false});
        config[vars.virtualEnv] = mockFs.load(path.resolve(__dirname, '../../../data/fakeVenv'), {recursive: true, lazy: false});
        config[vars.extractVenv] = {/** empty directory */};
        config[vars.emptyDir] = {/** empty directory */};
        mockFs(config);
        randomBucket = uuidv4();
        await awsS3Client.createBucket({Bucket: randomBucket}).promise();
        cacheAction = new S3CacheAction({s3Client: awsS3Client, bucket: randomBucket})
    });

    afterEach(() => {
        mockFs.restore();
        tl.setVariable('CacheRestored', undefined);
    });

    afterAll(() => {
        tl.setVariable('CacheRestored', pipelineCacheRestoredResult);
    })

    describe('addPipelineIdToKey', () => {
        describe('happy path', () => {
            test('pipelineId is appended to key', async () => {
                const inputKey = '"Test" | data/testData/test.json | test.json';
                pretestGetVar = tl.getVariable;
                tl.getVariable = jest.fn(() => { return '1234'});

                const hashedKey = await cacheAction.createCacheKey(inputKey, __dirname);
                
                const outputKey = addPipelineIdToKey(hashedKey);
                expect(outputKey).toBe('1234/' + hashedKey);
                tl.getVariable = pretestGetVar;
            });
        });

        describe('error scenarios', () => {
            test('pipelineId is not appended to key', async () => {
                try {
                    const inputKey = '"Test" | data/testData/test.json | test.json';
                    const hashedKey = await cacheAction.createCacheKey(inputKey, __dirname);
                    addPipelineIdToKey(hashedKey);
                } catch (error) {
                    expect(error.message).toBe('Pipeline ID undefined, check var: $(System.DefinitionId)');
                }
            });
        });
    });

    describe('restoreCache', () => {
        describe('happy path', () => {
            test('file - cache entry restored to location', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData/test.json | test.json',
                    location: vars.extractDir,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };
    
                const pathToFile = `${vars.testDataDir}/test.json`;
                const keyName = await cacheAction.createCacheKey(pipelineInput.key, __dirname);
                await cacheAction.createCacheEntry(pathToFile, keyName);
    
                const readExtractDir = () => { return fs.readdirSync(path.resolve(__dirname, pipelineInput.location))};
    
                expect(readExtractDir().length).toBe(0);
    
                await restoreCache(pipelineInput, awsS3Client);
    
                expect(readExtractDir().length).toBe(1);
                expect(fs.existsSync(`${vars.extractDir}/test.json`)).toBe(true);
            });

            test('file - CacheRestored pipeline var set to true and logged', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData/test.json | test.json',
                    location: vars.extractDir,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };
                process.env.SHOULD_DEBUG = true;
    
                const pathToFile = `${vars.testDataDir}/test.json`;
                const keyName = await cacheAction.createCacheKey(pipelineInput.key, __dirname);
                await cacheAction.createCacheEntry(pathToFile, keyName);

                await restoreCache(pipelineInput, awsS3Client);

                expect(tl.getVariable('CacheRestored')).toBe('true');
                expect(global.console.log).toHaveBeenCalledWith(
                    'Cache restored: true'
                );
            });

            test('directory - cache entry restored to location', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData | testData',
                    location: vars.extractDir,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };
    
                const pathToDir = `${vars.testDataDir}`;
                const keyName = await cacheAction.createCacheKey(pipelineInput.key, __dirname);
                await cacheAction.createCacheEntry(pathToDir, keyName);
    
                const readExtractDir = () => { return fs.readdirSync(path.resolve(__dirname, pipelineInput.location))};
    
                expect(readExtractDir().length).toBe(0);
    
                await restoreCache(pipelineInput, awsS3Client);
    
                expect(fs.existsSync(`${vars.extractDir}/test.json`)).toBe(true);
                expect(fs.existsSync(`${vars.extractDir}/testDataNested/test2.json`)).toBe(true);
            });

            test('directory - CacheRestored pipeline var set to true and logged', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData | testData',
                    location: vars.extractDir,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };
                process.env.SHOULD_DEBUG = true;
    
                const pathToDir = `${vars.testDataDir}`;
                const keyName = await cacheAction.createCacheKey(pipelineInput.key, __dirname);
                await cacheAction.createCacheEntry(pathToDir, keyName);

                await restoreCache(pipelineInput, awsS3Client);

                expect(tl.getVariable('CacheRestored')).toBe('true');
                expect(global.console.log).toHaveBeenCalledWith(
                    'Cache restored: true'
                );
            });

            test('python virtual env - cache entry restored to location and shebang paths fixed', async () => {
                const pipelineInput = {
                    key: `"python venv" | fakeVenv | ${vars.virtualEnv}`,
                    location: vars.extractVenv,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };
    
                const pathToVenv = `${vars.virtualEnv}`;
                const keyName = await cacheAction.createCacheKey(pipelineInput.key, __dirname);
                await cacheAction.createCacheEntry(pathToVenv, keyName);
    
                const readExtractDir = () => { return fs.readdirSync(path.resolve(__dirname, pipelineInput.location))};
    
                expect(readExtractDir().length).toBe(0);
    
                await restoreCache(pipelineInput, awsS3Client);
    
                const originalData = fs.readFileSync(`${vars.virtualEnv}/bin/wait_for_dns`, {encoding: 'utf-8'});
                const originalFirstLine = originalData.split('\n')[0];
                const newData = fs.readFileSync(`${vars.extractVenv}/bin/wait_for_dns`, {encoding: 'utf-8'});
                const newFirstLine = newData.split('\n')[0];
                expect(originalFirstLine).not.toBe(newFirstLine);
            });

            test('cache miss - CacheRestored pipeline var set to false and logged', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData | testData',
                    location: vars.extractDir,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };
                process.env.SHOULD_DEBUG = true;

                await restoreCache(pipelineInput, awsS3Client);

                expect(tl.getVariable('CacheRestored')).toBe('false');
                expect(global.console.log).toHaveBeenCalledWith(
                    'Cache restored: false'
                );
            });
        });

        describe('error scenarios', () => {
            test('no bucket provided', async () => {
                try {
                    const pipelineInput = {
                        key: '"Test" | data/testData | testData',
                        location: vars.extractDir,
                        bucket: null,
                        pipelineIsolated: false
                    };

                    await restoreCache(pipelineInput, awsS3Client);
                } catch (error) {
                    expect(error.message).toBe('Missing required key \'Bucket\' in params');
                }
            });

            test('no key provided', async () => {
                try {
                    const pipelineInput = {
                        key: null,
                        location: vars.extractDir,
                        bucket: randomBucket,
                        pipelineIsolated: false
                    };

                    await restoreCache(pipelineInput, awsS3Client);
                } catch (error) {
                    expect(error.message).toBe('Missing required key \'Key\' in params');
                }
            });

            test('no location provided', async () => {
                try {
                    const pipelineInput = {
                        key: '"Test" | data/testData | testData',
                        location: null,
                        bucket: randomBucket,
                        pipelineIsolated: false
                    };

                    await restoreCache(pipelineInput, awsS3Client);
                } catch (error) {
                    expect(error.message).toBe('The \"path\" argument must be of type string. Received null');
                }
            });
        });
    });

    describe('uploadCache', () => {
        describe('happy path', () => {
            test('uploads file and reports success', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData | testData/test.json',
                    location: `${vars.testDataDir}/test.json`,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };

                await restoreCache(pipelineInput, awsS3Client);

                tl.setResult = jest.fn()

                await uploadCache(pipelineInput, awsS3Client);

                expect(tl.setResult).toHaveBeenCalledWith(
                    tl.TaskResult.Succeeded,
                    "Uploaded to cache."
                );
            });

            test('uploads directory and reports success', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData | testData',
                    location: vars.testDataDir,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };

                await restoreCache(pipelineInput, awsS3Client);

                tl.setResult = jest.fn()

                await uploadCache(pipelineInput, awsS3Client);

                expect(tl.setResult).toHaveBeenCalledWith(
                    tl.TaskResult.Succeeded,
                    "Uploaded to cache."
                );
            });

            test('upload skipped - no cache reported', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData | testData',
                    location: vars.extractDir,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };

                tl.setResult = jest.fn()

                await uploadCache(pipelineInput, awsS3Client);

                expect(tl.setResult).toHaveBeenCalledWith(
                    tl.TaskResult.Skipped,
                    "No cache reported. Upload skipped."
                );
            });

            test('upload skipped - cache exists', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData | testData',
                    location: vars.extractDir,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };
                const pathToDir = `${vars.testDataDir}`;
                const keyName = await cacheAction.createCacheKey(pipelineInput.key, __dirname);
                await cacheAction.createCacheEntry(pathToDir, keyName);
                await restoreCache(pipelineInput, awsS3Client);

                tl.setResult = jest.fn()

                await uploadCache(pipelineInput, awsS3Client);

                expect(tl.setResult).toHaveBeenCalledWith(
                    tl.TaskResult.Skipped,
                    "Cache exists. Upload skipped."
                );
            });
        });

        describe('error scenarios', () => {
            test('no file at file location', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData | testData/not-a-file.json',
                    location: `${vars.testDataDir}/not-a-file.json`,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };

                try {
                    tl.setVariable('CacheRestored', 'false');
    
                    await uploadCache(pipelineInput, awsS3Client);
                    
                } catch (error) {
                    expect(error.message).toBe(
                        'no such file or directory at target path'
                    );
                }
            });

            test('no directory at directory location', async () => {
                const pipelineInput = {
                    key: '"Test" | data/not-a-dir | not-a-dir',
                    location: 'not-a-dir',
                    bucket: randomBucket,
                    pipelineIsolated: false
                };

                try {
                    tl.setVariable('CacheRestored', 'false');
    
                    await uploadCache(pipelineInput, awsS3Client);
                    
                } catch (error) {
                    expect(error.message).toBe(
                        'no such file or directory at target path'
                    );
                }
            });

            test('empty folder at location', async () => {
                const pipelineInput = {
                    key: '"Test" | data/emptyDir | emptyDir',
                    location: vars.emptyDir,
                    bucket: randomBucket,
                    pipelineIsolated: false
                };

                try {
                    tl.setVariable('CacheRestored', 'false');
    
                    await uploadCache(pipelineInput, awsS3Client);
                    
                } catch (error) {
                    expect(error.message).toBe(
                        'nothing to cache: directory at target path is empty'
                    );
                }
            });

            test('no bucket provided', async () => {
                try {
                    const pipelineInput = {
                        key: '"Test" | data/testData | testData',
                        location: vars.testDataDir,
                        bucket: null,
                        pipelineIsolated: false
                    };

                    await uploadCache(pipelineInput, awsS3Client);
                } catch (error) {
                    expect(error.message).toBe('Missing required key \'Bucket\' in params');
                }
            });

            test('no key provided', async () => {
                try {
                    const pipelineInput = {
                        key: null,
                        location: vars.testDataDir,
                        bucket: randomBucket,
                        pipelineIsolated: false
                    };

                    await uploadCache(pipelineInput, awsS3Client);
                } catch (error) {
                    expect(error.message).toBe('Missing required key \'Key\' in params');
                }
            });

            test('no location provided', async () => {
                try {
                    const pipelineInput = {
                        key: '"Test" | data/testData | testData',
                        location: null,
                        bucket: randomBucket,
                        pipelineIsolated: false
                    };

                    await uploadCache(pipelineInput, awsS3Client);
                } catch (error) {
                    expect(error.message).toBe('The \"path\" argument must be of type string. Received null');
                }
            });
        });
    });
});
