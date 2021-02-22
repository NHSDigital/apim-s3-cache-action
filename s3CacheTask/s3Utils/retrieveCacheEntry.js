const AWS = require('aws-sdk');
const tar = require('tar-fs');

const retrieveCacheEntry = async (keyName, bucketName, credentials) => {
    try {
        const useLocal = process.env.AWS_ENV === 'localstack';
        const endpoint = useLocal ? 'http://localhost:4566' : undefined;
        if (!credentials) console.log('No credentials provided. Using ambient credentials.')
        const s3client = new AWS.S3({
           credentials: credentials ? credentials : {},
           endpoint,
           s3ForcePathStyle: useLocal
        });
        
        const respObj = await s3client.getObject(
           {
              Bucket: bucketName,
              Key: keyName
           }
        ).promise()

        const body = respObj.Body;

        return body.toString('utf-8')
  
     } catch (err) {
        return err;
     };
};

module.exports = retrieveCacheEntry;
