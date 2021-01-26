const AWS = require('aws-sdk');
require('dotenv').config();

const uploadCacheFile = async (data, credentials, bucketName, fileName) => {
   const endpoint = process.env.AWS_USE_LOCAL ? 'http://localhost:4566' : undefined;

   const s3client = new AWS.S3({
      credentials,
      endpoint,
      s3ForcePathStyle: true,
   });

   return await s3client.upload(
      {
         Bucket: bucketName,
         Key: fileName,
         Body: data,
      }
   ).promise();
};

module.exports = uploadCacheFile;
