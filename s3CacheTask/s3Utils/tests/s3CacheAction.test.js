const mockFs = require('mock-fs');
const fs = require('fs');
const AWS = require('aws-sdk');
const path = require('path');
const { S3CacheAction } = require('../s3CacheAction');

const vars = {
    credentials: {
        accessKeyId: 'test-id',
        secretAccessKey: 'test-secret',
    },
    endpoint: 'http://localhost:4566',
    buckets: {
        createBucket: 'test-create-bucket',
        maybeGetBucket: 'test-maybe-get-bucket'
    },
    testDataDir: '/testdata',
    extractDir: '/extract_location'
};

describe('S3CacheAction', () => {
    describe('createCacheKey', () => {
        const s3client = new S3CacheAction(new AWS.S3({
            credentials: vars.credentials,
            endpoint: vars.endpoint,
            s3ForcePathStyle: true
        }));

        test('return string with same number of "/" separated parts', async () => {
            const keyInput = '"foo" | foo/bar/foo | foo.txt';
            const inputParts = keyInput.split('|').map(part => part.trim());
            const keyOutput = await s3client.createCacheKey(keyInput, __dirname);
            const outputParts = keyOutput.split('/').map(part => part.trim());
    
            expect(inputParts.length).toBe(outputParts.length);
        });
    
        test('returns the same result on each call', async () => {
            const keyInput = '"foo" | foo/bar/foo | foo.txt';
            const firstCall = await s3client.createCacheKey(keyInput, __dirname);
            const secondCall = await s3client.createCacheKey(keyInput, __dirname);
    
            expect(firstCall).toBe(secondCall);
        });
    });

    describe('createCacheEntry', () => {
        const s3client = new S3CacheAction(new AWS.S3({
            credentials: vars.credentials,
            endpoint: vars.endpoint,
            s3ForcePathStyle: true
        }));

        beforeAll(async () => {
            await s3client.makeBucket(vars.buckets.createBucket);
        });

        describe('happy path', () => {    
            test('successfully uploads file to s3 bucket.', async () => {
                const targetPath = path.resolve(__dirname, 'testData/test.json');
                const keyName = await s3client.createCacheKey('"test" | testData | testData/test.json', __dirname);
    
                const resp = await s3client.createCacheEntry(targetPath, vars.buckets.createBucket, keyName);
    
                expect(resp['Bucket']).toBe(vars.buckets.createBucket);
                expect(resp['Key']).toBe(keyName);
            });
    
            test('successfully uploads directory to s3 bucket.', async () => {
                const targetPath = path.resolve(__dirname, 'testData');
                const keyName = await s3client.createCacheKey(`"Test Data" | testData`, __dirname);
    
                const resp = await s3client.createCacheEntry(targetPath, vars.buckets.createBucket, keyName);
    
                expect(resp['Bucket']).toBe(vars.buckets.createBucket);
                expect(resp['Key']).toBe(keyName);
            });
        });

        describe('error scenarios', () => {    
            describe('targetPath', () => {
                test('missing targetPath parameter.', async () => {
                    try {
                        const targetPath = undefined;
                        const keyName = await s3client.createCacheKey('"test" | testData | testData/test.json', __dirname);
    
                        await s3client.createCacheEntry(targetPath, vars.buckets.createBucket, keyName);
                    } catch (error) {
                        expect(error.message).toBe(
                        'The \"path\" argument must be of type string or an instance of Buffer or URL. Received undefined');
                    }
                });
    
                test('invalid targetPath path.', async () => {
                    try {
                        const targetPath = 'not-a-real-path';
                        const keyName = await s3client.createCacheKey('"test" | testData | testData/test.json', __dirname);
        
                        await s3client.createCacheEntry(targetPath, vars.buckets.createBucket, keyName);
                    } catch (error) {
                        expect(error.message).toStrictEqual(expect.stringContaining('no such file or directory'));
                    }
                });
            });
    
            describe('bucket', () => {
                test('bucket does not exist.', async () => {
                    try {
                        const bucketName = 'bucket-doesnt-exist';
                        const targetPath = path.resolve(__dirname, 'testData/test.json');
                        const keyName = await s3client.createCacheKey('"test" | testData | testData/test.json', __dirname);
        
                        await s3client.createCacheEntry(targetPath, bucketName, keyName);
                    } catch (error) {
                        expect(error.message).toBe('The specified bucket does not exist');
                    }
                });
    
                test('missing bucket parameter.', async () => {
                    try {
                        const bucketName = undefined;
                        const targetPath = path.resolve(__dirname, 'testData/test.json');
                        const keyName = await s3client.createCacheKey('"test" | testData | testData/test.json', __dirname);
        
                        await s3client.createCacheEntry(targetPath, bucketName, keyName);
                    } catch (error) {
                        expect(error.message).toBe('Missing required key \'Bucket\' in params');
                    }
                });
            });
    
            describe('key', () => {
                test('missing key parameter.', async () => {
                    try {
                        const targetPath = path.resolve(__dirname, 'testData/test.json');
                        const keyName = undefined;
        
                        await s3client.createCacheEntry(targetPath, vars.buckets.createBucket, keyName);
                    } catch (error) {
                        expect(error.message).toBe('Missing required key \'Key\' in params');
                    }
                });
            });
        });
    });

    describe('maybeGetCacheEntry', () => {   
        const s3client = new S3CacheAction(new AWS.S3({
            credentials: vars.credentials,
            endpoint: vars.endpoint,
            s3ForcePathStyle: true
        }));

        beforeAll(async () => {
            await s3client.makeBucket(vars.buckets.maybeGetBucket);
        });
    
        beforeEach(function() {
            const config = {};
            config[vars.extractDir] = {/** empty directory */};
            config[vars.testDataDir] = mockFs.load(path.resolve(__dirname, 'testData'), {recursive: true, lazy: false});
            mockFs(config);
        });

        afterEach(mockFs.restore);
    
        test('successfully extracts directory from tarball', async () => {
            const keyName = await s3client.createCacheKey(`"test" | testData | ${vars.testDataDir}`, __dirname);
            await s3client.createCacheEntry(`${vars.testDataDir}`, vars.buckets.maybeGetBucket, keyName);
    
            const resp = await s3client.maybeGetCacheEntry(keyName, vars.buckets.maybeGetBucket, vars.extractDir);
    
            expect(resp.message).toBe('cache hit');
            expect(fs.existsSync(`${vars.extractDir}/test.json`)).toBe(true);
            expect(fs.existsSync(`${vars.extractDir}/testDataNested/test2.json`)).toBe(true);
        });
    
        test('successfully extracts file from tarball', async () => {
            const keyName = await s3client.createCacheKey(`"test" | testData | ${vars.testDataDir}/test.json`, __dirname);
            await s3client.createCacheEntry(`${vars.testDataDir}/test.json`, vars.buckets.maybeGetBucket, keyName);
    
            const resp = await s3client.maybeGetCacheEntry(keyName, vars.buckets.maybeGetBucket, vars.extractDir);
    
            expect(resp.message).toBe('cache hit');
            expect(fs.existsSync(`${vars.extractDir}/test.json`)).toBe(true);
        });

        test('reports cache miss when no matching key', async () => {
            try {
                const keyName = await s3client.createCacheKey(`"new key" | testData | ${vars.testDataDir}/test.json`, __dirname);

                const resp = await s3client.maybeGetCacheEntry(keyName, vars.buckets.maybeGetBucket, vars.extractDir);

                expect(resp.message).toBe('cache miss');
            } catch (error) {
                console.log('test catch')
                throw error
            }
        });
    });
});