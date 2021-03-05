describe('taskUtils', () => {
    describe('restoreCache', () => {
        // HAPPY PATH
        // Cache hit - file - file restored
        // Cache hit - file - CacheRestored variable set true and logged
        // Cache hit - folder - folder restored
        // Cache hit - folder - CacheRestored variable set true and logged
        // Cache hit - python venv - folder restored and fixed
        // Cache hit - python venv - CacheRestored variable set true and logged
        // Cache miss - CacheRestored variable set to false and logged

        // ERROR SCENARIOS
        // No bucket provided
        // Invalid bucket
        // no key provided
        // invalid key
        // Invalid s3Client
        // No location provided
    });

    describe('uploadCache', () => {
        // HAPPY PATH
        // Uploads file ? does it need to report
        // Uploads folder ? does it need to report
        // No cacheRestored reported - sets result to no cache reported
        // cacheRestored reported - sets result to cache exists

        // ERROR SCENARIOS
        // No bucket provided
        // Invalid bucket
        // no key provided
        // invalid key
        // Invalid s3Client
        // No location provided
        // no file at path to file
        // empty dir at path to dir
    });
});
