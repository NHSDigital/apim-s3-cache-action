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
            const pathToFile = path.resolve(__dirname, "testData/test.json");
            const keyName = `test-${new Date().toISOString()}.json`;

            const resp = await uploadCacheFile(pathToFile, credentials, bucketName, keyName);

            expect(resp["Bucket"]).toBe(bucketName);
            expect(resp["Key"]).toBe(keyName);
        });

    });

    describe("error scenarios", () => {
        

        describe("pathToFile", () => {
            
            test("missing pathToFile parameter.", async () => {
                const bucketName = process.env.AWS_BUCKET_NAME;
                const pathToFile = undefined;
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(pathToFile, credentials, bucketName, keyName);

                expect(error.message).toBe("The \"path\" argument must be one of type string, Buffer, or URL. Received type undefined");
            });

            test("invalid pathToFile path.", async () => {
                const bucketName = process.env.AWS_BUCKET_NAME;
                const pathToFile = "not-a-real-path";
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(pathToFile, credentials, bucketName, keyName);

                expect(error.message).toBe("ENOENT: no such file or directory, open 'not-a-real-path'");
            });

        });

        describe("credentials", () => {

            beforeAll(() => { process.env.AWS_ENV = "not-localstack" });
            afterAll(() => { process.env.AWS_ENV = "localstack" });

            test("missing credentials.", async () => {
                const bucketName = process.env.AWS_BUCKET_NAME;
                const pathToFile = path.resolve(__dirname, "testData/test.json");
                const keyName = `test-${new Date().toISOString()}.json`;
                const invalidCredentials = undefined;
    
                const error = await uploadCacheFile(pathToFile, invalidCredentials, bucketName, keyName);
    
                expect(error.message).toBe("Access Denied");
            });

        });

        describe("bucket", () => {

            test("bucket does not exist.", async () => {
                const bucketName = "bucket-doesnt-exist";
                const pathToFile = path.resolve(__dirname, "testData/test.json");
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(pathToFile, credentials, bucketName, keyName);

                expect(error.message).toBe("The specified bucket does not exist");
            });

            test("missing bucket parameter.", async () => {
                const bucketName = undefined;
                const pathToFile = path.resolve(__dirname, "testData/test.json");
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(pathToFile, credentials, bucketName, keyName);

                expect(error.message).toBe("Missing required key 'Bucket' in params");
            });

        });

        describe("key", () => {

            test("missing key parameter.", async () => {
                const bucketName = process.env.AWS_BUCKET_NAME;
                const pathToFile = path.resolve(__dirname, "testData/test.json");
                const keyName = undefined;

                const error = await uploadCacheFile(pathToFile, credentials, bucketName, keyName);

                expect(error.message).toBe("Missing required key 'Key' in params");
            });

        });

    });

});
