
const AWS = require('aws-sdk');
const fs = require('fs');
const tar = require('tar-fs');
const tarStream = require('tar-stream');
const stream = require('stream');
const path = require('path');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);
const exec = promisify(require('child_process').exec);
const { hashFileOrString, readableBytes } = require('./s3CacheActionUtils');
const { debug } = require('./debug');

function ensureDir(p) {
  if (!p) throw new Error('The "path" argument must be of type string. Received null');
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) {
    fs.mkdirSync(abs, { recursive: true });
  }
  return abs;
}

class S3CacheAction {
  constructor(options) {
    options = options || {};
    this.s3Client = options.s3Client || new AWS.S3();
    this.bucket = options.bucket || null;
  }

  async createCacheKey(key, workingDir) {
    if (!key) return null;
    debug(`input key: ${key}`);
    const keyParts = key.split('\n').map(part => part.trim());
    const keyPartsHashed = await Promise.all(
      keyParts.map(part => hashFileOrString(part, workingDir))
    );
    const hashedKey = keyPartsHashed.join('/');
    debug(`hashed key: ${hashedKey}`);
    return hashedKey;
  }

  async createCacheEntry(targetPath, keyName) {
    // 🔒 validate params first (fail fast, no FS work)
    if (!keyName) {
      const err = new Error("Missing required key 'Key' in params");
      throw err;
    }
    if (!this.bucket) {
      const err = new Error("Missing required key 'Bucket' in params");
      throw err;
    }

    // FS checks
    if (!fs.existsSync(targetPath)) throw new Error('no such file or directory at target path');

    const pathIsDir = fs.statSync(targetPath).isDirectory();
    let bodyStream;

    if (pathIsDir) {
      if (fs.readdirSync(targetPath).length === 0) {
        throw new Error('nothing to cache: directory at target path is empty');
      }
      bodyStream = tar.pack(targetPath);
    } else {
      const fileName = path.basename(targetPath);
      const pack = tarStream.pack();
      pack.entry({ name: fileName }, fs.readFileSync(targetPath));
      pack.finalize();
      bodyStream = pack;
    }

    return await this.s3Client.upload({
      Bucket: this.bucket,
      Key: keyName,
      Body: bodyStream,
    }).promise();
  }

  async findCacheEntry(keyName) {
    const req = this.s3Client.getObject({ Bucket: this.bucket, Key: keyName });

    // Real AWS SDK style
    if (req && typeof req.createReadStream === 'function') {
      return req.createReadStream();
    }

    // Promise-based fallback returning { Body }
    if (req && typeof req.promise === 'function') {
      const { Body } = await req.promise();
      const readable = new stream.Readable({
        read() {
          this.push(Body);
          this.push(null);
        }
      });
      return readable;
    }

    // Fallback: object-like with Body directly
    if (req && req.Body) {
      const readable = new stream.Readable({
        read() {
          this.push(req.Body);
          this.push(null);
        }
      });
      return readable;
    }

    throw new Error('Unsupported S3 client: getObject() must provide createReadStream() or promise()');
  }

  async maybeFixPythonVenv(targetPath) {
    const isPythonVenv = fs.existsSync(path.resolve(targetPath, 'bin/python'));
    if (!isPythonVenv) return false;

    const bashCmd = `find "${targetPath}/bin" -type f -print0 \
| xargs -0 file \
| grep -E 'Python script|ASCII text' \
| cut -d: -f1`;

    const { err, stdout, stderr } = await exec(bashCmd);
    if (err) throw err;
    if (stderr) throw new Error(stderr);

    const filePaths = stdout.trim().split('\n').filter(Boolean);
    filePaths.forEach(filePath => {
      let contents = fs.readFileSync(filePath, { encoding: 'utf-8' });
      let updated = false;

      const shBangRegex = new RegExp('^\\#\\!.\\*python');
      if (shBangRegex.test(contents)) {
        contents = contents.replace(shBangRegex, `#!${targetPath}/bin/python`);
        updated = true;
      }

      const execRegex = new RegExp("'''exec' /[^\\n ]*/bin/python ", 'g');
      if (execRegex.test(contents)) {
        contents = contents.replace(execRegex, `'''exec' ${targetPath}/bin/python `);
        updated = true;
      }

      const venvRegex1 = new RegExp('VIRTUAL_ENV "[^"].*"');
      if (venvRegex1.test(contents)) {
        contents = contents.replace(venvRegex1, `VIRTUAL_ENV "${targetPath}"`);
        updated = true;
      }

      const venvRegex2 = new RegExp('VIRTUAL_ENV="[^"].*"');
      if (venvRegex2.test(contents)) {
        contents = contents.replace(venvRegex2, `VIRTUAL_ENV="${targetPath}"`);
        updated = true;
      }

      if (updated) {
        fs.writeFileSync(filePath, contents);
      }
    });
    return true;
  }

  async maybeGetCacheEntry(keyName, destination) {
    try {
      const dest = ensureDir(destination);
      const cacheDataStream = await this.findCacheEntry(keyName);

      let downloadedBytes = 0;
      cacheDataStream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
      });

      await pipeline(cacheDataStream, tar.extract(dest));
      const fixedPythonVenv = await this.maybeFixPythonVenv(dest);

      const bashCmd = `du -h -d 0 "${dest}"`;
      const { err, stdout, stderr } = await exec(bashCmd);
      if (err) throw err;
      if (stderr) throw new Error(stderr);

      const tarSize = readableBytes(downloadedBytes);
      const extractedSize = stdout.split('/')[0].trim() + 'B';

      return {
        message: fixedPythonVenv ? 'cache hit and python paths fixed' : 'cache hit',
        tarSize,
        extractedSize
      };
    } catch (error) {
      if (
        error.message === 'The specified key does not exist.' ||
        error.code === 'NoSuchKey' ||
        error.code === 'NotFound'
      ) {
        return { message: 'cache miss' };
      }
      throw error;
    }
  }
}

module.exports = S3CacheAction;
