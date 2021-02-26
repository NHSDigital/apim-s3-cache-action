const AWS = require('aws-sdk');
const fs = require('fs');
const tar = require('tar-fs');
const tarStream = require('tar-stream');

class S3CacheAction {
    constructor(s3Client) {
        this.s3Client = s3Client || new AWS.S3();
    }

    async makeBucket(bucketName) {
        await this.s3Client.createBucket({Bucket: bucketName}).promise();
    }

    async createCacheEntry (targetPath, bucketName, keyName) {
        if (!targetPath) throw SyntaxError('Missing targetPath. A targetPath must be provided.');
    
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
     };
};

module.exports = { S3CacheAction };
