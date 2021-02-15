const fs = require('fs');
const path = require('path');
const md5File = require('md5-file');

const createCacheKey = (key, workingDir) => {
    const keyParts = key.split('|').map((part) => part.trim());

    const keyPartsHashed = keyParts.map((part) => {
        const path = [part, path.resolve(workingDir, part)].find(p => fs.existsSync(p));
        if (path) {
            const formatPart = fs.statSync(path).isFile() ? md5File.sync(path) : part;
            return formatPart;
        } else {
            return part;
        }
    })

    return keyPartsHashed.join('|');
};
