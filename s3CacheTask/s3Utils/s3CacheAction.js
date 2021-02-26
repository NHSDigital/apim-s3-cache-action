const AWS = require('aws-sdk');
const fs = require('fs');
const tar = require('tar-fs');
const tarStream = require('tar-stream');
const stream = require("stream");
const { promisify } = require('util')
const pipeline = promisify(stream.pipeline);
const { hashFileOrString } = require('./cacheKeyUtils');

class S3CacheAction {
    constructor(s3Client) {
        this.s3Client = s3Client || new AWS.S3();
    }

    async makeBucket(bucketName) {
        await this.s3Client.createBucket({Bucket: bucketName}).promise();
    }

    async createCacheKey (key, workingDir) {
        const keyParts = key.split('|').map(part => part.trim());
        const keyPartsHashed = await Promise.all(keyParts.map((part) => hashFileOrString(part, workingDir)));
        
        return keyPartsHashed.join('/');
    }

    async createCacheEntry (targetPath, bucketName, keyName) {    
        const pathIsDir = fs.statSync(targetPath).isDirectory();
        let stream;
    
        if (pathIsDir) {
            stream = tar.pack(targetPath);
        } else {
            const pathArr = targetPath.split('/');
            const fileName = pathArr[pathArr.length -1];
            const tarStrPacked = await tarStream.pack();
            await tarStrPacked.entry({name: fileName}, fs.readFileSync(targetPath));
            tarStrPacked.finalize();
            stream = tarStrPacked;
        };
        
        return await this.s3Client.upload(
            {
                Bucket: bucketName,
                Key: keyName,
                Body: stream,
            }
        ).promise();
     }

     async findCacheEntry (keyName, bucketName) {
        return await this.s3Client.getObject(
            {
                Bucket: bucketName,
                Key: keyName
            }
        );
    }

    async maybeGetCacheEntry (keyName, bucketName, destination) {
        const cacheData = await this.findCacheEntry(keyName, bucketName);

        if (!cacheData) {
            return { message: 'cache miss' };
        } else {
            await pipeline(cacheData.createReadStream(), tar.extract(destination));
        }
    }
};

module.exports = { S3CacheAction };
