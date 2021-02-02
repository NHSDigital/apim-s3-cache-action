const path = require("path");
const AWS = require("aws-sdk");

const uploadCacheFile = require("../uploadCache");

const credentials = {
    accessKeyId: "test-id",
    secretAccessKey: "test-secret",
};
const bucketName = "test-bucket";

process.env.AWS_ENV = "localstack"

describe("uploadCacheFile", () => {

    beforeAll(async () => {
        const endpoint = "http://localhost:4566";
        const s3client = new AWS.S3({
            credentials,
            endpoint,
            s3ForcePathStyle: true,
         });

        await s3client.createBucket({Bucket: bucketName}, (err, data) => {
            if (err) console.log(err.message);
        }).promise();
    });

    describe("happy path", () => {

        test("successfully uploads cache to s3 bucket.", async () => {
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
                const pathToFile = undefined;
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(pathToFile, credentials, bucketName, keyName);

                expect(error.message).toBe("Missing pathToFile. A pathToFile must be provided.");
            });

            test("invalid pathToFile path.", async () => {
                const pathToFile = "not-a-real-path";
                const keyName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(pathToFile, credentials, bucketName, keyName);

                expect(error.message).toBe("ENOENT: no such file or directory, open 'not-a-real-path'");
            });

        });

        describe("credentials", () => {

            test("missing credentials.", async () => {

                const pathToFile = path.resolve(__dirname, "testData/test.json");
                const keyName = `test-${new Date().toISOString()}.json`;
                const invalidCredentials = undefined;
    
                const error = await uploadCacheFile(pathToFile, invalidCredentials, bucketName, keyName);
    
                expect(error.message).toBe("Missing credentials. Credentials must be provided.");
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
                const pathToFile = path.resolve(__dirname, "testData/test.json");
                const keyName = undefined;

                const error = await uploadCacheFile(pathToFile, credentials, bucketName, keyName);

                expect(error.message).toBe("Missing required key 'Key' in params");
            });

        });

    });

});
