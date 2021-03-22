const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { debug } = require('./debug');

const isPathyChar = (char) => {
    const globChars = ['*', '?', '[', ']'];
    const pathChars = ['/', ':'];
    const invalidFileChars = ['"', '<', '>', '|'];

    if (!char) return false;
    if (globChars.includes(char)) return true;
    if (pathChars.includes(char)) return true;
    return !invalidFileChars.includes(char);
};

const isPathyPart = (part) => {
    if (!part) return false;
    if (part.startsWith('"') && part.endsWith('"')) return false;
    if (part.split('').some(c => !isPathyChar(c))) return false;
    if (part.includes('.') && part.includes('/') && part.includes('\\')) return false;
    if (part.endsWith('.')) return false;
    return true;
};

const createHashFromFile = filePath => new Promise(resolve => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
        .on('data', data => hash.update(data))
        .on('end', () => resolve(hash.digest('hex')));
});

const createHashFromString = inputString => {
    return crypto.createHash('sha256').update(inputString).digest("hex");
};

const hashFileOrString = async (part, workingDir) => {
    if (!isPathyPart(part)) return createHashFromString(part);

    const truePath = [part, path.resolve(workingDir, part)].find(p => fs.existsSync(p));

    if (truePath && fs.statSync(truePath).isFile()) {
        debug(`File exists: hashing file ${truePath}`)
        return await createHashFromFile(truePath);
    } else {
        return createHashFromString(part);
    };
};

const readableBytes = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
    if (i === 0) return `${bytes} ${sizes[i]}`;
    return `${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`;
};

module.exports = { isPathyChar, isPathyPart, createHashFromString, hashFileOrString, readableBytes };
