const mockFs = require('mock-fs');
const path = require('path');
const AWS = require('aws-sdk');
const fs = require('fs');
const extractCacheEntry = require('../extractCacheEntry');
const retrieveCacheEntry = require('../retrieveCacheEntry');
const createCacheEntry = require('../createCacheEntry');
const { createCacheKey } = require('../createCacheKey');

process.env.AWS_ENV = 'localstack';

const credentials = {
    accessKeyId: 'test-id',
    secretAccessKey: 'test-secret',
};
const bucketName = 'test-extract-bucket';

describe('extractCacheEntry', () => {
    beforeAll(async () => {
        const endpoint = 'http://localhost:4566';
        const s3client = new AWS.S3({
            credentials,
            endpoint,
            s3ForcePathStyle: true
         });

        await s3client.createBucket({Bucket: bucketName}).promise();
    });

    test('successfully writes tarball to destination from cache buffer', async () => {
        const targetPath = path.resolve(__dirname, 'testData/test.json');
        const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
        await createCacheEntry(targetPath, credentials, bucketName, keyName);
        const { Body } = await retrieveCacheEntry(keyName, bucketName, credentials);

        mockFs({
            '/s3Utils/tests/cacheFiles': {/** empty directory */},
            'node_modules': mockFs.load(path.resolve(__dirname, '../../node_modules')),
            '/tmp/jest_rs': mockFs.load('/tmp/jest_rs')
        });

        extractCacheEntry(path.resolve(__dirname, '/s3Utils/tests/cacheFiles'), keyName, Body);

        expect(fs.existsSync(path.resolve(__dirname, '/s3Utils/tests/cacheFiles', `${keyName}.tar`))).toBe(true);

        mockFs.restore();
    });

    // test('successfully extracts file from tarball', async () => {
    //     const targetPath = path.resolve(__dirname, 'testData/test.json');
    //     const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
    //     await createCacheEntry(targetPath, credentials, bucketName, keyName);
    //     const { Body } = await retrieveCacheEntry(keyName, bucketName, credentials);

    //     // mockFs({
    //     //     'cacheFiles': {/** empty directory */},
    //     //     'node_modules': mockFs.load(path.resolve(__dirname, '../../node_modules')),
    //     //     '/tmp/jest_rs': mockFs.load('/tmp/jest_rs')
    //     // });

    //     extractCacheEntry(path.resolve(__dirname, 'cacheFiles'), keyName, Body);

    //     console.log(path.resolve(__dirname, 'cacheFiles', 'test.json'))

    //     expect(fs.existsSync(path.resolve(__dirname, 'cacheFiles', 'test.json'))).toBe(true);

    //     // mockFs.restore();
    // });

    // Test successfully extracts directory from tarball
});
