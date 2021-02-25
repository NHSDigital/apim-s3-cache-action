const path = require('path');
const AWS = require('aws-sdk');
const retrieveCacheEntry = require('../retrieveCacheEntry');
const createCacheEntry = require('../createCacheEntry');
const { createCacheKey } = require('../createCacheKey');

process.env.AWS_ENV = 'localstack';
global.console = {
    log: jest.fn()
};

const credentials = {
    accessKeyId: 'test-id',
    secretAccessKey: 'test-secret',
};
const bucketName = 'test-retrieve-bucket';

describe('retrieveCacheEntry', () => {
    beforeAll(async () => {
        const endpoint = 'http://localhost:4566';
        const s3client = new AWS.S3({
            credentials,
            endpoint,
            s3ForcePathStyle: true
         });

         await s3client.createBucket({Bucket: bucketName}).promise();
    });

    describe('happy path', () => {
        test('successfully retrieves buffer of file from s3 bucket', async () => {
            const targetPath = path.resolve(__dirname, 'testData/test.json');
            const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
            await createCacheEntry(targetPath, credentials, bucketName, keyName);
    
            const { Body } = await retrieveCacheEntry(keyName, bucketName, credentials);
            
            expect(Buffer.isBuffer(Body)).toBe(true);
        });

        test('successfully retrieves buffer of directory from s3 bucket', async () => {
            const targetPath = path.resolve(__dirname, 'testData');
            const keyName = await createCacheKey('"test" | testData | testData', __dirname);
            await createCacheEntry(targetPath, credentials, bucketName, keyName);
    
            const { Body } = await retrieveCacheEntry(keyName, bucketName, credentials);
            
            expect(Buffer.isBuffer(Body)).toBe(true);
        });

        test('returned buffer contains file and file contents', async () => {
            const targetPath = path.resolve(__dirname, 'testData/test.json');
            const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
            await createCacheEntry(targetPath, credentials, bucketName, keyName);
    
            const { Body } = await retrieveCacheEntry(keyName, bucketName, credentials);
            
            expect(Body.includes('test.json')).toBe(true);
            expect(Body.includes('{"test": "Test Data"}')).toBe(true);
        });
    });

    describe('error scenarios', () => {
        test('logs warning for ambient credentials when none provided', async () => {
            const targetPath = path.resolve(__dirname, 'testData/test.json');
            const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
            await createCacheEntry(targetPath, credentials, bucketName, keyName);

            const noCredentials = undefined;
            await retrieveCacheEntry(keyName, bucketName, noCredentials);
        
            expect(global.console.log).toHaveBeenCalledWith(
                'No credentials provided. Using ambient credentials.'
            );
        });

        describe('key', () => {
            test('missing key parameter.', async () => {
                const targetPath = path.resolve(__dirname, 'testData/test.json');
                const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
                await createCacheEntry(targetPath, credentials, bucketName, keyName);

                const noKey = undefined;
                const error = await retrieveCacheEntry(noKey, bucketName, credentials);

                expect(error.message).toBe('Missing required key \'Key\' in params');
            });
        });

        describe('bucket', () => {
            test('bucket does not exist.', async () => {
                const targetPath = path.resolve(__dirname, 'testData/test.json');
                const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
                await createCacheEntry(targetPath, credentials, bucketName, keyName);

                const notBucketName = 'bucket-doesnt-exist';
                const error = await retrieveCacheEntry(keyName, notBucketName, credentials);

                expect(error.message).toBe('The specified bucket does not exist');
            });

            test('missing bucket parameter.', async () => {
                const targetPath = path.resolve(__dirname, 'testData/test.json');
                const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
                await createCacheEntry(targetPath, credentials, bucketName, keyName);

                const noBucket = undefined;
                const error = await retrieveCacheEntry(keyName, noBucket, credentials);

                expect(error.message).toBe('Missing required key \'Bucket\' in params');
            });
        });
    });
});
