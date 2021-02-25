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

const test_data_dir = '/testdata';
const extract_dir = '/extract_location';

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

    beforeEach(function() {
        let config = {};
        config[extract_dir] = {/** empty directory */};
        config[test_data_dir] = mockFs.load(path.resolve(__dirname, 'testData'), {recursive: true, lazy: false});
        mockFs(config);
    });
    afterEach(mockFs.restore);


    test('successfully extracts directory from tarball', async () => {

        const keyName = await createCacheKey(`"test" | testData | ${test_data_dir}`, __dirname);
        let result = await createCacheEntry(`${test_data_dir}`, credentials, "NOTREAL", keyName);

        let body = await retrieveCacheEntry(keyName, bucketName, credentials);
        await extractCacheEntry(extract_dir, keyName, body);

        expect(fs.existsSync(`${extract_dir}/test.json`)).toBe(true);
        expect(fs.existsSync(`${extract_dir}/testDataNested/test2.json`)).toBe(true);


    });

    test('successfully extracts file from tarball', async () => {

        const keyName = await createCacheKey(`"test" | testData | ${test_data_dir}/test.json`, __dirname);
        await createCacheEntry(`${test_data_dir}/test.json`, credentials, bucketName, keyName);

        let body = await retrieveCacheEntry(keyName, bucketName, credentials);
        await extractCacheEntry(extract_dir, keyName, body);

        expect(fs.existsSync(`${extract_dir}/test.json`)).toBe(true);


    });

});
