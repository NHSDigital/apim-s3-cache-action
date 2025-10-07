const AWS = require('aws-sdk');
const fs = require('fs');
const tar = require('tar-fs');
const tarStream = require('tar-stream');
const stream = require('stream');
const path = require('path');
const { promisify } = require('util')
const pipeline = promisify(stream.pipeline);
const exec = promisify(require('child_process').exec);
const { hashFileOrString, readableBytes } = require('./s3CacheActionUtils');
const { debug } = require('./debug');

class S3CacheAction {

    constructor(options) {
        options = options || {};
        this.s3Client = options.s3Client || new AWS.S3();
        this.bucket = options.bucket || null;
    }

    async createCacheKey (key, workingDir) {
        if (!key) return null;
        debug(`input key: ${key}`);
        const keyParts = key.split('|').map(part => part.trim());
        const keyPartsHashed = await Promise.all(keyParts.map((part) => hashFileOrString(part, workingDir)));
        const hashedKey = keyPartsHashed.join('/');
        debug(`hashed key: ${hashedKey}`);
        return hashedKey;
    }

    async createCacheEntry (targetPath, keyName) {
        //if (!fs.existsSync(targetPath)) throw new Error('no such file or directory at target path');
        
        //const pathIsDir = fs.statSync(targetPath).isDirectory();
        //let stream;
        if (!fs.existsSync(targetPath)) {
            const looksLikeDir = !path.extname(targetPath);
            
            if (looksLikeDir) {
                fs.mkdirSync(targetPath, { recursive: true });

            }
            else {
                throw new Error('no such file or directory at target path');
                }
            }

        if (pathIsDir) {
            if (fs.readdirSync(targetPath).length === 0) {
                throw new Error('nothing to cache: directory at target path is empty');
            }
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

    async maybeFixPythonVenv (targetPath) {
        const isPythonVenv = fs.existsSync(path.resolve(targetPath, 'bin/python'));
        if (!isPythonVenv) return false;

        const bashCmd = `find "${targetPath}/bin" -type f -print0 | xargs -0 file | grep -E 'Python script|ASCII text' |  cut -d: -f1`;

        const { err, stdout, stderr } = await exec(bashCmd);
        if (err) throw err;
        if (stderr) {
            throw new Error(stderr);
        }

        const filePaths = stdout.trim().split('\n');
        filePaths.forEach(filePath => {
            let contents = fs.readFileSync(filePath, {encoding: 'utf-8'});
            const shBangRegex = new RegExp('^#!.*python');
            let updated = false;
            if (shBangRegex.test(contents)) {
                // replace is regex based and only replaces first occurance.
                contents = contents.replace(shBangRegex, `#!${targetPath}/bin/python`);
                updated = true
            }

            const execRegex = new RegExp("'''exec' /[^\n ]*/bin/python ", 'g');

            if (execRegex.test(contents)) {
                // replace is regex based and only replaces first occurance.
                contents = contents.replace(execRegex, `'''exec' ${targetPath}/bin/python `);
                updated = true
            }

            const venvRegex1 = new RegExp('VIRTUAL_ENV "[^"].*"');

            if (venvRegex1.test(contents)) {
                // replace is regex based and only replaces first occurance.
                contents = contents.replace(venvRegex1, `VIRTUAL_ENV "${targetPath}"`);
                updated = true
            }

            const venvRegex2 = new RegExp('VIRTUAL_ENV="[^"].*"');

            if (venvRegex2.test(contents)) {
                // replace is regex based and only replaces first occurance.
                contents = contents.replace(venvRegex2, `VIRTUAL_ENV="${targetPath}"`);
                updated = true
            }

            if (updated) {
                fs.writeFileSync(filePath, contents);
            }
        });

        return true;
    }

    async maybeGetCacheEntry (keyName, destination) {
        try {
            const cacheData = await this.findCacheEntry(keyName);
            let downloadedBytes = 0;
            await pipeline(cacheData.on('data', function(chunk){
                downloadedBytes += chunk.length;
              }), tar.extract(destination));

            const fixedPythonVenv = await this.maybeFixPythonVenv(destination);
            
            const bashCmd = `du -h -d 0 "${destination}"`;
            const { err, stdout, stderr } = await exec(bashCmd);
            if (err) throw err;
            if (stderr) {
                throw new Error(stderr);
            }
            const tarSize = readableBytes(downloadedBytes);
            const extractedSize = stdout.split('/')[0].trim() + 'B';
            

            if (fixedPythonVenv) {
                return { message: 'cache hit and python paths fixed',
                         tarSize,
                         extractedSize
                        };
            } else {
                return { message: 'cache hit',
                         tarSize,
                         extractedSize
                        };
            }
        } catch (error) {
            if (error.message === 'The specified key does not exist.') {
                return { message: 'cache miss' };
            }
            throw error;
        }
    }
}

module.exports = S3CacheAction;
