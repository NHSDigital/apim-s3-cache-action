const fs = require('fs');
const path = require('path');
const tar = require('tar-fs');
const stream = require("stream");
const { promisify } = require('util')
const pipeline = promisify(stream.pipeline);

const extractCacheEntry = async (destination, keyName, cacheData) => {

    await pipeline(cacheData.createReadStream(), tar.extract(destination));
};

module.exports = extractCacheEntry
