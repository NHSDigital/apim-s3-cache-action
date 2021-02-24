const fs = require('fs');
const path = require('path');

const extractCacheEntry = (destination, keyName, cacheData) => {
    fs.writeFileSync(path.resolve(destination, `${keyName}.tar`), cacheData);
};

module.exports = extractCacheEntry
