const path = require('path');
const AWS = require('aws-sdk');
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
const bucketName = 'test-bucket';

describe('createCacheEntry', () => {
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
        test('successfully uploads file to s3 bucket.', async () => {
            const targetPath = path.resolve(__dirname, 'testData/test.json');
            const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);

            const resp = await createCacheEntry(targetPath, credentials, bucketName, keyName);

            expect(resp['Bucket']).toBe(bucketName);
            expect(resp['Key']).toBe(keyName);
        });

        test('successfully uploads directory to s3 bucket.', async () => {
            const targetPath = path.resolve(__dirname, 'testData');
            const keyName = await createCacheKey(`"Test Data" | testData`, __dirname);

            const resp = await createCacheEntry(targetPath, credentials, bucketName, keyName);

            expect(resp['Bucket']).toBe(bucketName);
            expect(resp['Key']).toBe(keyName);
        });
    });

    describe('error scenarios', () => {
        test('logs warning for ambient credentials when none provided', async () => {
            const targetPath = path.resolve(__dirname, 'testData/test.json');
            const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
            const noCredentials = undefined

            await createCacheEntry(targetPath, noCredentials, bucketName, keyName);
        
            expect(global.console.log).toHaveBeenCalledWith(
                'No credentials provided. Using ambient credentials.'
            );
        });

        describe('targetPath', () => {
            test('missing targetPath parameter.', async () => {
                const targetPath = undefined;
                const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);

                const error = await createCacheEntry(targetPath, credentials, bucketName, keyName);

                expect(error.message).toBe('Missing targetPath. A targetPath must be provided.');
            });

            test('invalid targetPath path.', async () => {
                const targetPath = 'not-a-real-path';
                const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);

                const error = await createCacheEntry(targetPath, credentials, bucketName, keyName);

                expect(error.message).toStrictEqual(expect.stringContaining('no such file or directory'));
            });
        });

        describe('bucket', () => {
            test('bucket does not exist.', async () => {
                const bucketName = 'bucket-doesnt-exist';
                const targetPath = path.resolve(__dirname, 'testData/test.json');
                const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);

                const error = await createCacheEntry(targetPath, credentials, bucketName, keyName);

                expect(error.message).toBe('The specified bucket does not exist');
            });

            test('missing bucket parameter.', async () => {
                const bucketName = undefined;
                const targetPath = path.resolve(__dirname, 'testData/test.json');
                const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);

                const error = await createCacheEntry(targetPath, credentials, bucketName, keyName);

                expect(error.message).toBe('Missing required key \'Bucket\' in params');
            });
        });

        describe('key', () => {
            test('missing key parameter.', async () => {
                const targetPath = path.resolve(__dirname, 'testData/test.json');
                const keyName = undefined;

                const error = await createCacheEntry(targetPath, credentials, bucketName, keyName);

                expect(error.message).toBe('Missing required key \'Key\' in params');
            });
        });
    });
});
