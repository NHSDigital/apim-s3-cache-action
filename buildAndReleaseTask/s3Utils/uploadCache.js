const AWS = require("aws-sdk");
const fs = require("fs");

const uploadCacheFile = async (pathToFile, credentials, bucketName, keyName) => {
   try {
      const endpoint = process.env.AWS_ENV === "localstack" ? "http://localhost:4566" : undefined;
      if (!credentials) throw SyntaxError("Missing credentials. Credentials must be provided.");
      if (!pathToFile) throw SyntaxError("Missing pathToFile. A pathToFile must be provided.");
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
