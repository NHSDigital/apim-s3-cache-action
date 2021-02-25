const mockFs = require('mock-fs');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const { extractCacheEntry, findCacheEntry } = require('../findCacheEntry');
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

describe('extractCacheEntry', () => {
    const bucketName = 'test-extract-bucket';

    const test_data_dir = '/testdata';
    const extract_dir = '/extract_location';

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
        let result = await createCacheEntry(`${test_data_dir}`, credentials, bucketName, keyName);

        let body = await findCacheEntry(keyName, bucketName, credentials);
        await extractCacheEntry(extract_dir, body);

        expect(fs.existsSync(`${extract_dir}/test.json`)).toBe(true);
        expect(fs.existsSync(`${extract_dir}/testDataNested/test2.json`)).toBe(true);
    });

    test('successfully extracts file from tarball', async () => {
        const keyName = await createCacheKey(`"test" | testData | ${test_data_dir}/test.json`, __dirname);
        await createCacheEntry(`${test_data_dir}/test.json`, credentials, bucketName, keyName);

        let body = await findCacheEntry(keyName, bucketName, credentials);
        await extractCacheEntry(extract_dir, body);

        expect(fs.existsSync(`${extract_dir}/test.json`)).toBe(true);
    });
});

// describe('findCacheEntry', () => {
//     const bucketName = 'test-retrieve-bucket';

//     beforeAll(async () => {
//         const endpoint = 'http://localhost:4566';
//         const s3client = new AWS.S3({
//             credentials,
//             endpoint,
//             s3ForcePathStyle: true
//          });

//          await s3client.createBucket({Bucket: bucketName}).promise();
//     });

//     describe('happy path', () => {
//         test('successfully retrieves buffer of file from s3 bucket', async () => {
//             const targetPath = path.resolve(__dirname, 'testData/test.json');
//             const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
//             await createCacheEntry(targetPath, credentials, bucketName, keyName);
    
//             const resp = await findCacheEntry(keyName, bucketName, credentials)
//             const { Body } = resp.promise();
            
//             expect(Buffer.isBuffer(Body)).toBe(true);
//         });

//         test('successfully retrieves buffer of directory from s3 bucket', async () => {
//             const targetPath = path.resolve(__dirname, 'testData');
//             const keyName = await createCacheKey('"test" | testData | testData', __dirname);
//             await createCacheEntry(targetPath, credentials, bucketName, keyName);
    
//             const resp = await findCacheEntry(keyName, bucketName, credentials)
//             const { Body } = resp.promise();
            
//             expect(Buffer.isBuffer(Body)).toBe(true);
//         });

//         test('returned buffer contains file and file contents', async () => {
//             const targetPath = path.resolve(__dirname, 'testData/test.json');
//             const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
//             await createCacheEntry(targetPath, credentials, bucketName, keyName);
    
//             const resp = await findCacheEntry(keyName, bucketName, credentials)
//             const { Body } = resp.promise();
            
//             expect(Body.includes('test.json')).toBe(true);
//             expect(Body.includes('{"test": "Test Data"}')).toBe(true);
//         });
//     });

//     describe('error scenarios', () => {
//         test('logs warning for ambient credentials when none provided', async () => {
//             const targetPath = path.resolve(__dirname, 'testData/test.json');
//             const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
//             await createCacheEntry(targetPath, credentials, bucketName, keyName);

//             const noCredentials = undefined;
//             await findCacheEntry(keyName, bucketName, noCredentials);
        
//             expect(global.console.log).toHaveBeenCalledWith(
//                 'No credentials provided. Using ambient credentials.'
//             );
//         });

//         describe('key', () => {
//             test('missing key parameter.', async () => {
//                 const targetPath = path.resolve(__dirname, 'testData/test.json');
//                 const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
//                 await createCacheEntry(targetPath, credentials, bucketName, keyName);

//                 const noKey = undefined;
//                 const resp = await findCacheEntry(noKey, bucketName, credentials);
//                 const error = resp.promise();

//                 expect(error.message).toBe('Missing required key \'Key\' in params');
//             });
//         });

//         describe('bucket', () => {
//             test('bucket does not exist.', async () => {
//                 const targetPath = path.resolve(__dirname, 'testData/test.json');
//                 const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
//                 await createCacheEntry(targetPath, credentials, bucketName, keyName);

//                 const notBucketName = 'bucket-doesnt-exist';
//                 const resp = await findCacheEntry(keyName, notBucketName, credentials);
//                 const error = resp.promise();

//                 expect(error.message).toBe('The specified bucket does not exist');
//             });

//             test('missing bucket parameter.', async () => {
//                 const targetPath = path.resolve(__dirname, 'testData/test.json');
//                 const keyName = await createCacheKey('"test" | testData | testData/test.json', __dirname);
//                 await createCacheEntry(targetPath, credentials, bucketName, keyName);

//                 const noBucket = undefined;
//                 const resp = await findCacheEntry(keyName, noBucket, credentials);
//                 const error = resp.promise();

//                 expect(error.message).toBe('Missing required key \'Bucket\' in params');
//             });
//         });
//     });
// });
