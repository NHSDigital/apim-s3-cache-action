const AWS = require('aws-sdk');
const fs = require('fs');
const tar = require('tar-fs');
const tarStream = require('tar-stream');
const stream = require('stream');
const { promisify } = require('util')
const pipeline = promisify(stream.pipeline);
const exec = promisify(require('child_process').exec);
const { hashFileOrString } = require('./cacheKeyUtils');

class S3CacheAction {

    constructor(options) {
        options = options || {};
        this.s3Client = options.s3Client || new AWS.S3();
        this.bucket = options.bucket || null;
    }

    async createCacheKey (key, workingDir) {
        const keyParts = key.split('|').map(part => part.trim());
        const keyPartsHashed = await Promise.all(keyParts.map((part) => hashFileOrString(part, workingDir)));
        
        return keyPartsHashed.join('/');
    }

    async createCacheEntry (targetPath, keyName) {
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
                Bucket: this.bucket,
                Key: keyName,
                Body: stream,
            }
        ).promise();
     }

     async findCacheEntry (keyName) {
        return this.s3Client.getObject(
            {
                Bucket: this.bucket,
                Key: keyName
            }
        ).createReadStream();
    }

    async maybeGetCacheEntry (keyName, destination) {
        try {
            const cacheData = await this.findCacheEntry(keyName);
            await pipeline(cacheData, tar.extract(destination));

            return { message: 'cache hit' };
        } catch (error) {
            if (error.message === 'The specified key does not exist.') {
                return { message: 'cache miss' };
            }
            throw error;
        }
    }

    async cleanDirIfPythonVenv (targetPath) {
        // Errors if file doesn't exist. Check first or catch error
        // const isPythonVenv = fs.statSync(path.resolve(targetPath, 'bin/python')).isFile();

        const bashCmd = `find "${targetPath}/bin" -type f -print0 | xargs -0 file | grep 'Python script' |  cut -d: -f1`

        const { err, stdout, stderr } = await exec(bashCmd);
        if (err) throw err;
        if (stderr) {
            throw new Error(stderr);
        }

        console.log(stdout)

        const filePaths = stdout.trim().split('\n');
        filePaths.forEach(filePath => {
            const data = fs.readFileSync(filePath, {encoding: 'utf-8'});
            console.log(data)

            const altData = data.replace(new RegExp('^#!.*python'), `#!${targetPath}/bin/python`)
            console.log(altData)
            // fs.writeFileSync(filePath, altData);
        });
    }
}

module.exports = { S3CacheAction };
