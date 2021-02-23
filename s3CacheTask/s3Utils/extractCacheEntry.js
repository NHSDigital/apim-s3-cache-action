const tar = require('tar-stream');
const fs = require('fs');
const path = require('path');

const extractCacheEntry = (targetPath, keyName, cacheData) => {
    // Reconfigure to use temp dir
    fs.writeFileSync(path.resolve(targetPath, `${keyName}.tar`), cacheData);
};

module.exports = extractCacheEntry
