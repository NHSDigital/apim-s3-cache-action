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
    endpoint: 'http://localhost:4566',
    testDataDir: '/testdata',
    extractDir: '/extract_location',
    virtualEnv: `${__dirname}/../../../data/fakeVenv`, // Data extracted to reduce extension size
    extractVenv: `${__dirname}/../../../data/anotherVenv` // Data extracted to reduce extension size
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

    afterEach(mockFs.restore);

    describe('restoreCache', () => {
        // HAPPY PATH
        // Cache hit - file - CacheRestored variable set true and logged
        // Cache hit - folder - folder restored
        // Cache hit - folder - CacheRestored variable set true and logged
        // Cache hit - python venv - folder restored and fixed
        // Cache hit - python venv - CacheRestored variable set true and logged
        // Cache miss - CacheRestored variable set to false and logged
        describe('happy path', () => {
            test('file - cache entry restored to location', async () => {
                const pipelineInput = {
                    key: '"Test" | data/testData/test.json | test.json',
                    location: vars.extractDir,
                    bucket: randomBucket
                }
    
                const pathToFile = `${vars.testDataDir}/test.json`;
                const keyName = await cacheAction.createCacheKey(pipelineInput.key, __dirname);
                await cacheAction.createCacheEntry(pathToFile, keyName);
    
                const readExtractDir = () => { return fs.readdirSync(path.resolve(__dirname, pipelineInput.location))};
    
                expect(readExtractDir().length).toBe(0);
    
                await restoreCache(pipelineInput, awsS3Client);
    
                expect(readExtractDir().length).toBe(1);
                expect(fs.existsSync(`${vars.extractDir}/test.json`)).toBe(true);
            });
        });

        // ERROR SCENARIOS
        // No bucket provided
        // Invalid bucket
        // no key provided
        // invalid key
        // Invalid s3Client
        // No location provided
    });

    describe('uploadCache', () => {
        // HAPPY PATH
        // Uploads file ? does it need to report
        // Uploads folder ? does it need to report
        // No cacheRestored reported - sets result to no cache reported
        // cacheRestored reported - sets result to cache exists

        // ERROR SCENARIOS
        // No bucket provided
        // Invalid bucket
        // no key provided
        // invalid key
        // Invalid s3Client
        // No location provided
        // no file at path to file
        // empty dir at path to dir
    });
});
