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
            const filePath = path.resolve(__dirname, "testData/test.json");
            const fileStream = fs.createReadStream(filePath);
            const now = new Date();
            const fileName = `test-${now.toISOString()}.json`;

            const resp = await uploadCacheFile(fileStream, credentials, bucketName, fileName);

            expect(resp["Bucket"]).toBe(bucketName);
            expect(resp["Key"]).toBe(fileName);
        });

    });

    describe("error scenarios", () => {
        test("bucket does not exist.", async () => {
            const bucketName = "bucket-doesnt-exist";
            const filePath = path.resolve(__dirname, "testData/test.json");
            const fileStream = fs.createReadStream(filePath);
            const now = new Date();
            const fileName = `test-${now.toISOString()}.json`;

            const error = await uploadCacheFile(fileStream, credentials, bucketName, fileName);

            expect(error["statusCode"]).toBe(404);
            expect(error["code"]).toBe("NoSuchBucket");
        })
    })

});
