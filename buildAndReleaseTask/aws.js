const AWS = require('aws-sdk');
require('dotenv').config();

const credentials = {
   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
   secretAccessKey: process.env.AWS_SECRET_KEY,
};

const bucketName = process.env.AWS_BUCKET_NAME;

const s3client = new AWS.S3({
   credentials,
   endpoint: 'http://localhost:4566',
   s3ForcePathStyle: true,
});


const saveCacheFile = async (data, fileName) =>
   new Promise((resolve) => {
      s3client.upload(
         {
            Bucket: bucketName,
            Key: fileName,
            Body: data,
         },
         (err, resp) => {
            if (err) throw err
            resolve(resp)
         },
      );
   });

module.exports = saveCacheFile;
