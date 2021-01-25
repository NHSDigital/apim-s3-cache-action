const AWS = require('aws-sdk');

const uploadCacheFile = (data, credentials, bucketName, fileName) => {
   const s3client = new AWS.S3({
      credentials,
      endpoint: 'http://localhost:4566',
      s3ForcePathStyle: true,
   });

   return new Promise((resolve) => {
      s3client.upload(
         {
            Bucket: bucketName,
            Key: fileName,
            Body: data,
         },
         (err, resp) => {
            if (err) throw err;
            resolve(resp);
         },
      );
   }).then((result) => {
      return result
   });
};

module.exports = uploadCacheFile;
