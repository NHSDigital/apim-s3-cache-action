const fs = require("fs");
const path = require("path");
require('dotenv').config();

const uploadCacheFile = require("../uploadCache");

const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
 };   

describe("uploadCacheFile", () => {

    describe("happy path", () => {

        test("successfully uploads cache to s3 bucket.", async () => {
            const bucketName = process.env.AWS_BUCKET_NAME;
            const fileStream = fs.createReadStream(path.resolve(__dirname, "testData/test.json"));
            const keyName = `test-${new Date().toISOString()}.json`;

            const resp = await uploadCacheFile(fileStream, credentials, bucketName, keyName);

            expect(resp["Bucket"]).toBe(bucketName);
            expect(resp["Key"]).toBe(keyName);
        });

    });

    describe("error scenarios", () => {
        describe("bucket", () => {

            test("bucket does not exist.", async () => {
                const bucketName = "bucket-doesnt-exist";
                const fileStream = fs.createReadStream(path.resolve(__dirname, "testData/test.json"));
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(fileStream, credentials, bucketName, keyName);

                expect(error.message).toBe("The specified bucket does not exist");
            });

            test("missing bucket parameter.", async () => {
                const bucketName = undefined;
                const fileStream = fs.createReadStream(path.resolve(__dirname, "testData/test.json"));
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(fileStream, credentials, bucketName, keyName);

                expect(error.message).toBe("Missing required key 'Bucket' in params");
            });

        });

        describe("key", () => {

            test("missing key parameter.", async () => {
                const bucketName = process.env.AWS_BUCKET_NAME;
                const fileStream = fs.createReadStream(path.resolve(__dirname, "testData/test.json"));
                const keyName = undefined;

                const error = await uploadCacheFile(fileStream, credentials, bucketName, keyName);

                expect(error.message).toBe("Missing required key 'Key' in params");
            });

        });

        describe("fileStream", () => {
            
            test("missing fileStream parameter.", async () => {
                const bucketName = process.env.AWS_BUCKET_NAME;
                const fileStream = undefined;
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(fileStream, credentials, bucketName, keyName);

                expect(error.message).toBe("params.Body is required");
            });

            test("invalid fileStream path.", async () => {
                const bucketName = process.env.AWS_BUCKET_NAME;
                const fileStream = fs.createReadStream("not-a-real-path");
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(fileStream, credentials, bucketName, keyName);

                expect(error.message).toBe("ENOENT: no such file or directory, open 'not-a-real-path'");
            });

            test("invalid payload.", async () => {
                const bucketName = process.env.AWS_BUCKET_NAME;
                const fileStream = {testData: "test data"};
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(fileStream, credentials, bucketName, keyName);

                expect(error.message).toBe("Unsupported body payload object");
            });

        })
    });

});
