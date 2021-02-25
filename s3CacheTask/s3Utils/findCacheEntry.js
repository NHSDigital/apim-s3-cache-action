const AWS = require('aws-sdk');
const tar = require('tar-fs');
const stream = require("stream");
const { promisify } = require('util')
const pipeline = promisify(stream.pipeline);

const extractCacheEntry = async (destination, cacheData) => {
   await pipeline(cacheData.createReadStream(), tar.extract(destination));
};

const findCacheEntry = async (keyName, bucketName, credentials) => {
    try {
        const useLocal = process.env.AWS_ENV === 'localstack';
        const endpoint = useLocal ? 'http://localhost:4566' : undefined;
        if (!credentials) console.log('No credentials provided. Using ambient credentials.');
        const s3client = new AWS.S3({
           credentials: credentials ? credentials : {},
           endpoint,
           s3ForcePathStyle: useLocal
        });
        
        return await s3client.getObject(
           {
              Bucket: bucketName,
              Key: keyName
           }
        );
        
     } catch (err) {
        return err;
     }
};

module.exports = { extractCacheEntry, findCacheEntry };
