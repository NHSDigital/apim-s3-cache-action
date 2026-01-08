
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { debug } = require('./debug');

/**
 * A single character is considered "pathy" if:
 *  - it is not a control character (charCode < 32)
 *  - it is not in the explicit invalid set: ", <, >, \n
 *  - OR it belongs to glob/path whitelists
 */
const globChars = ['*', '?', '[', ']'];
const pathChars = ['/', '\\', ':']; // include backslash for Windows paths
const invalidFileChars = ['"', '<', '>', '\n'];

const isControl = (char) =>
  typeof char === 'string' &&
  char.length === 1 &&
  char.charCodeAt(0) < 32;

const isPathyChar = (char) => {
  if (typeof char !== 'string' || char.length !== 1) return false;

  // Hard-block control characters & known invalids
  if (isControl(char)) return false;
  if (invalidFileChars.includes(char)) return false;

  // Whitelist glob/path characters
  if (globChars.includes(char)) return true;
  if (pathChars.includes(char)) return true;

  // All other visible characters are okay
  return true;
};

const isPathyPart = (part) => {
  if (!part || typeof part !== 'string') return false;
  // reject quoted string literals
  if (part.startsWith('"') && part.endsWith('"')) return false;

  // Every character must be "pathy"
  if (part.split('').some((c) => !isPathyChar(c))) return false;

  // Disallow parts that mix ., / and \ simultaneously (ambiguous)
  if (part.includes('.') && part.includes('/') && part.includes('\\')) return false;

  // Disallow trailing dot
  if (part.endsWith('.')) return false;

  return true;
};

const createHashFromFile = (filePath) =>
  new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', (data) => hash.update(data))
      .on('end', () => resolve(hash.digest('hex')));
  });

const createHashFromString = (inputString) => {
  return crypto.createHash('sha256').update(inputString).digest('hex');
};

const hashFileOrString = async (part, workingDir) => {
  if (!isPathyPart(part)) return createHashFromString(part);
  const candidates = [part, path.resolve(workingDir, part)];
  const truePath = candidates.find((p) => fs.existsSync(p));
  if (truePath && fs.statSync(truePath).isFile()) {
    debug(`File exists: hashing file ${truePath}`);
    return await createHashFromFile(truePath);
  } else {
    return createHashFromString(part);
  }
};

const readableBytes = (bytes) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
  if (i === 0) return `${bytes} ${sizes[i]}`;
  return `${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`;
};

module.exports = { isPathyChar, isPathyPart, createHashFromString, hashFileOrString, readableBytes };
