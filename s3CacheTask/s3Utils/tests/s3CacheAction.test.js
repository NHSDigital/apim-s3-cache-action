const mockFs = require('mock-fs');
const fs = require('fs');
const AWS = require('aws-sdk');
const path = require('path');
const { S3CacheAction } = require('../s3CacheAction');
const { v4: uuidv4 } =  require('uuid');

const vars = {
    credentials: {
        accessKeyId: 'test-id',
        secretAccessKey: 'test-secret',
    },
    endpoint: 'http://localhost:4566',
    testDataDir: '/testdata',
    extractDir: '/extract_location'
};

describe('S3CacheAction', () => {
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

    beforeEach(async() => {
        const config = {};
        config[vars.extractDir] = {/** empty directory */};
        config[vars.testDataDir] = mockFs.load(path.resolve(__dirname, 'testData'), {recursive: true, lazy: false});
        mockFs(config);
        randomBucket = uuidv4();
        await awsS3Client.createBucket({Bucket: randomBucket}).promise();
        cacheAction = new S3CacheAction({s3Client: awsS3Client, bucket: randomBucket})
    });

    afterEach(mockFs.restore);

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
    });

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
                        'The \"path\" argument must be of type string or an instance of Buffer or URL. Received undefined');
                    }
                });
    
                test('invalid targetPath path.', async () => {
                    try {
                        const targetPath = 'not-a-real-path';
                        const keyName = await cacheAction.createCacheKey('"test" | testData | testData/test.json', __dirname);
        
                        await cacheAction.createCacheEntry(targetPath, keyName);
                    } catch (error) {
                        expect(error.message).toStrictEqual(expect.stringContaining('no such file or directory'));
                    }
                });
            });
    
            describe('bucket', () => {
                test('bucket does not exist.', async () => {
                    try {

                        const targetPath = `${vars.testDataDir}/test.json`;
                        const keyName = await cacheAction.createCacheKey('"test" | testData | testData/test.json', __dirname);

                        cacheAction = new S3CacheAction({s3Client: awsS3Client, bucket: 'bucket-doesnt-exist'})
        
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
    });
});