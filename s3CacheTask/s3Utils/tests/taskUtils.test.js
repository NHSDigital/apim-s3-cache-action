const mockFs = require('mock-fs');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const tl = require('azure-pipelines-task-lib/task');
const { v4: uuidv4 } =  require('uuid');
const { S3CacheAction } = require('../s3CacheAction');
const { restoreCache, uploadCache } = require('../taskUtils');

const vars = {
    credentials: {
        accessKeyId: 'test-id',
        secretAccessKey: 'test-secret',
    },
    endpoint: 'http://localhost:4666',
    testDataDir: '/testdata',
    extractDir: '/extract_location',
    virtualEnv: `${__dirname}/../../../data/fakeVenv`, // Data extracted to reduce extension size
    extractVenv: `${__dirname}/../../../data/anotherVenv` // Data extracted to reduce extension size
};

global.console = {
    log: jest.fn()
};

describe('taskUtils', () => {
    let awsS3Client;
    let cacheAction;
    let randomBucket;

    beforeAll(async () => {
        awsS3Client = new AWS.S3({
            credentials: vars.credentials,
            endpoint: vars.endpoint,
            s3ForcePathStyle: true
        });
    });

    beforeEach(async () => {
        const config = {};
        config[vars.extractDir] = {/** empty directory */};
        // Data extracted to reduce extension size
        config[vars.testDataDir] = mockFs.load(path.resolve(__dirname, '../../../data/testData'), {recursive: true, lazy: false});
        config[vars.virtualEnv] = mockFs.load(path.resolve(__dirname, '../../../data/fakeVenv'), {recursive: true, lazy: false});
        config[vars.extractVenv] = {/** empty directory */};
        mockFs(config);
        randomBucket = uuidv4();
        await awsS3Client.createBucket({Bucket: randomBucket}).promise();
        cacheAction = new S3CacheAction({s3Client: awsS3Client, bucket: randomBucket})
    });

    afterEach(async () => {
        mockFs.restore();
        tl.setVariable('CacheRestored', undefined);
    });

    describe('restoreCache', () => {
        describe('happy path', () => {
            test('file - cache entry restored to location', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData/test.json | test.json',
                    location: vars.extractDir,
                    bucket: randomBucket
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
                    bucket: randomBucket
                };
    
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
                    bucket: randomBucket
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
                    bucket: randomBucket
                };
    
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
                    bucket: randomBucket
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
                    bucket: randomBucket
                };

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
                        bucket: null
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
                        bucket: randomBucket
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
                        bucket: randomBucket
                    };

                    await restoreCache(pipelineInput, awsS3Client);
                } catch (error) {
                    expect(error.message).toBe('The \"path\" argument must be of type string. Received null');
                }
            });
        });
    });

    describe('uploadCache', () => {
        // HAPPY PATH
        // Uploads file ? does it need to report
        // Uploads folder ? does it need to report
        // No cacheRestored reported - sets result to no cache reported
        // cacheRestored reported - sets result to cache exists
        describe('happy path', () => {
            test('upload skipped - no cache reported', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData | testData',
                    location: vars.extractDir,
                    bucket: randomBucket
                };

                tl.setResult = jest.fn()

                await uploadCache(pipelineInput, awsS3Client);

                expect(tl.setResult).toHaveBeenCalledWith(
                    tl.TaskResult.Skipped,
                    "No cache reported. Upload skipped."
                );
            });
        });

        // ERROR SCENARIOS
        // no file at path to file
        // empty dir at path to dir
        describe('error scenarios', () => {
            test('no bucket provided', async () => {
                try {
                    const pipelineInput = {
                        key: '"Test" | data/testData | testData',
                        location: vars.extractDir,
                        bucket: null
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
                        location: vars.extractDir,
                        bucket: randomBucket
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
                        bucket: randomBucket
                    };

                    await uploadCache(pipelineInput, awsS3Client);
                } catch (error) {
                    expect(error.message).toBe('The \"path\" argument must be of type string. Received null');
                }
            });
        });
    });
});
