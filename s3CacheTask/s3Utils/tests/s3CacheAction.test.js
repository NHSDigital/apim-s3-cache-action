const AWS = require('aws-sdk');
const path = require('path');
const { S3CacheAction } = require('../s3CacheAction');
const { createCacheKey } = require('../createCacheKey');

const vars = {
    credentials: {
        accessKeyId: 'test-id',
        secretAccessKey: 'test-secret',
    },
    endpoint: 'http://localhost:4566',
    buckets: {
        createBucket: 'test-create-bucket'
    }
};

describe('S3CacheAction', () => {
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
                const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
    
                const resp = await s3client.createCacheEntry(targetPath, vars.buckets.createBucket, keyName);
    
                expect(resp['Bucket']).toBe(vars.buckets.createBucket);
                expect(resp['Key']).toBe(keyName);
            });
    
            test('successfully uploads directory to s3 bucket.', async () => {
                const targetPath = path.resolve(__dirname, 'testData');
                const keyName = await createCacheKey(`"Test Data" | testData`, __dirname);
    
                const resp = await s3client.createCacheEntry(targetPath, vars.buckets.createBucket, keyName);
    
                expect(resp['Bucket']).toBe(vars.buckets.createBucket);
                expect(resp['Key']).toBe(keyName);
            });
        });
    });
});