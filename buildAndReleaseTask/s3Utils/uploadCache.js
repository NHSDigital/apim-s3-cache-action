const AWS = require("aws-sdk");
const fs = require("fs");
require("dotenv").config();

const uploadCacheFile = async (pathToFile, credentials, bucketName, keyName) => {
   try {
      const endpoint = process.env.AWS_USE_LOCAL ? "http://localhost:4566" : undefined;
      const s3client = new AWS.S3({
         credentials,
         endpoint,
         s3ForcePathStyle: true,
      });

      const fileStream = fs.createReadStream(pathToFile);

      return await s3client.upload(
         {
            Bucket: bucketName,
            Key: keyName,
            Body: fileStream,
         }
      ).promise();

   } catch (err) {
      return err;
   };
};

module.exports = uploadCacheFile;
