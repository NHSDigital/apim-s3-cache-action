const fs = require('fs');
const path = require('path');
const tar = require('tar-fs');

const extractCacheEntry = (destination, keyName, cacheData) => {
    const tarPath = path.resolve(destination, `${keyName}.tar`)
    fs.writeFileSync(path.resolve(destination, `${keyName}.tar`), cacheData);

    fs.createReadStream(tarPath).pipe(tar.extract(destination));
};

module.exports = extractCacheEntry
