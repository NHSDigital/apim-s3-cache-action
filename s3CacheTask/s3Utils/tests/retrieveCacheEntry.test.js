const path = require('path');
const AWS = require('aws-sdk');
const retrieveCacheEntry = require('../retrieveCacheEntry');
const createCacheEntry = require('../createCacheEntry');
const { createCacheKey } = require('../createCacheKey');

process.env.AWS_ENV = 'localstack';

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

    test('successfully retrieves entry from s3 bucket', async () => {
        const targetPath = path.resolve(__dirname, 'testData/test.json');
        const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
        await createCacheEntry(targetPath, credentials, bucketName, keyName);

        const resp = await retrieveCacheEntry(keyName, bucketName, credentials);
        console.log(resp);
        expect(true).toBe(false);
    });
});
