const path = require('path');
const AWS = require('aws-sdk');
const fs = require('fs');
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
});
