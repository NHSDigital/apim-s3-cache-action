const restoreCache = async ({ key, location, bucket }) => {
    console.log(key, location, bucket);
};

const uploadCache = async ({ key, location, bucket }) => {
    console.log(key, location, bucket);
};

module.exports = { restoreCache, uploadCache };
