const AWS = require('aws-sdk');
require('dotenv').config();

const uploadCacheFile = (data, credentials, bucketName, fileName) => {
   const endpoint = process.env.AWS_USE_LOCAL ? 'http://localhost:4566' : undefined;

   const s3client = new AWS.S3({
      credentials,
      endpoint,
      s3ForcePathStyle: true,
   });

   return new Promise((resolve, reject) => {
      s3client.upload(
         {
            Bucket: bucketName,
            Key: fileName,
            Body: data,
         },
         (err, resp) => {
            if (err) reject(err);
            resolve(resp);
         }
      );
   }).catch((err) => {
      console.log(err)
   });
};

module.exports = uploadCacheFile;
