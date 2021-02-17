const fs = require('fs');
const path = require('path');
const crypto = require('crypto');


const isPathyChar = (char) => {
    const globChars = ['*', '?', '[', ']'];
    const pathChars = ['/', ':'];
    const invalidFileChars = ['"', '<', '>', '|'];

    if (globChars.includes(char)) return true;
    if (pathChars.includes(char)) return true;
    return !invalidFileChars.includes(char);
};


const isPathyPart = (part) => {
    if (part.startsWith('"') && part.endsWith('"')) return false;
    if (part.split('').some(c => !isPathyChar(c))) return false;
    if (part.includes('.') && part.includes('/') && part.includes('\\')) return false;
    if (part.endsWith('.')) return false;
    return true;
};


const hashPartIfPath = (part, workingDir) => {
    if (!isPathyPart(part)) return part;

    const pathPart = [part, path.resolve(workingDir, part)].find(p => fs.existsSync(p)) || part;
    const hash = crypto.createHash('sha256');

    hash.update(pathPart);

    return hash.digest('hex');
};


const createCacheKey = (key, workingDir) => {
    const keyParts = key.split('|').map(part => part.trim());
    const keyPartsHashed = keyParts.map(part => hashPartIfPath(part, workingDir));
    const joinedkeyParts = keyPartsHashed.join('|');

    const hashedKey = crypto.createHash('sha256').update(joinedkeyParts).digest("hex");

    return hashedKey;
};


module.exports = { isPathyChar, isPathyPart, hashPartIfPath, createCacheKey };
