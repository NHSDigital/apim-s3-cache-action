const fs = require("fs")
const path = require("path");
require('dotenv').config();

const uploadCacheFile = require("../uploadCache");

const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
 };   
 const bucketName = process.env.AWS_BUCKET_NAME;

describe("uploadCacheFile", () => {
    test("successful cache upload", async () => {
        const filePath = path.resolve(__dirname, "testData/test.json");
        const fileStream = fs.createReadStream(filePath);
        const now = new Date();
        const fileName = `test-${now.toISOString()}.json`;

        const result = await uploadCacheFile(fileStream, credentials, bucketName, fileName);
        expect(result).toHaveProperty("Bucket");
    });
});
