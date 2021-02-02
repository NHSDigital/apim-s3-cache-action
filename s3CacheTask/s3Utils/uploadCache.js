const AWS = require("aws-sdk");
const fs = require("fs");

const uploadCacheFile = async (targetPath, credentials, bucketName, keyName) => {
   try {
      const endpoint = process.env.AWS_ENV === "localstack" ? "http://localhost:4566" : undefined;
      if (!credentials) throw SyntaxError("Missing credentials. Credentials must be provided.");
      if (!targetPath) throw SyntaxError("Missing targetPath. A targetPath must be provided.");
      const s3client = new AWS.S3({
         credentials,
         endpoint,
         s3ForcePathStyle: true,
      });

      const fileStream = fs.createReadStream(targetPath);
      
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
