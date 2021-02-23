const tar = require('tar-stream');
const fs = require('fs');
const path = require('path');

const extractCacheEntry = (destination, keyName, cacheData) => {
    // Reconfigure to use temp dir
    fs.writeFileSync(path.resolve(destination, `${keyName}.tar`), cacheData);
};

module.exports = extractCacheEntry
