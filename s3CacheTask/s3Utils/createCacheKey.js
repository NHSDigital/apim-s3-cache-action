const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const hashPartIfPath = (part, workingDir) => {
    const isPath = [part, path.resolve(workingDir, part)].find(p => fs.existsSync(p));

    if (isPath) {
        let formatPart = part;
        if (fs.statSync(isPath).isFile()) {
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
    const hashedKey = crypto.createHash('sha256').update(joinedkeyParts).digest("hex");

    return hashedKey;
};

console.log(
    createCacheKey(`"test data" | s3CacheTask/s3Utils/tests/testData | test.json`,
    path.resolve(__dirname, 'tests/testData')));
