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
            const fileName = `test-${new Date().toISOString()}.json`;

            const resp = await uploadCacheFile(fileStream, credentials, bucketName, fileName);

            expect(resp["Bucket"]).toBe(bucketName);
            expect(resp["Key"]).toBe(fileName);
        });

    });

    describe("error scenarios", () => {
        describe("bucket", () => {

            test("bucket does not exist.", async () => {
                const bucketName = "bucket-doesnt-exist";
                const fileStream = fs.createReadStream(path.resolve(__dirname, "testData/test.json"));
                const fileName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(fileStream, credentials, bucketName, fileName);

                expect(error["code"]).toBe("NoSuchBucket");
            });

            test("missing bucket parameter.", async () => {
                const bucketName = undefined;
                const fileStream = fs.createReadStream(path.resolve(__dirname, "testData/test.json"));
                const fileName = `test-${new Date().toISOString()}.json`;

                const error = await uploadCacheFile(fileStream, credentials, bucketName, fileName);

                expect(error["code"]).toBe("MissingRequiredParameter");
            });

        });
    });

});
