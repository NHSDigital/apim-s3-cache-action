const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Perhaps a little explicit. Could just use invalidFileChars
const isPathyChar = (char) => {
    const globChars = ['*', '?', '[', ']'];
    const pathChars = ['/', ':'];
    const invalidFileChars = ['"', '<', '>', '|'];

    if (globChars.includes(char)) return true;
    if (pathChars.includes(char)) return true;
    return !invalidFileChars.includes(char);
};


const isPathyPart = (part) => {
    return
};


const hashPartIfPath = (part, workingDir) => {
    const isPath = [part, path.resolve(workingDir, part)].find(p => fs.existsSync(p));

    if (isPath) {
        let formatPart = part;
        if (fs.statSync(isPath).isFile()) { // May not need if check here
            const hash = crypto.createHash('sha256');
            hash.update(isPath);
            formatPart = hash.digest('hex');
        }
        return formatPart;
    } else {
        return part;
    };
};


const createCacheKey = (key, workingDir) => {
    const keyParts = key.split('|').map(part => part.trim());

    const keyPartsHashed = keyParts.map(part => hashPartIfPath(part, workingDir));

    const joinedkeyParts = keyPartsHashed.join('|');
    console.log(joinedkeyParts)
    const hashedKey = crypto.createHash('sha256').update(joinedkeyParts).digest("hex");

    return hashedKey;
};

// console.log(
//     createCacheKey(`"test data" | tests | testData`,
//     path.resolve(__dirname, 'tests')));

module.exports = { isPathyChar, isPathyPart, hashPartIfPath, createCacheKey };
