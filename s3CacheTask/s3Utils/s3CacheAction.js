const AWS = require('aws-sdk');

class S3CacheAction {
    constructor(s3Client) {
        this.s3Client = s3Client || new AWS.S3();
    }
};

module.exports = { S3CacheAction };
