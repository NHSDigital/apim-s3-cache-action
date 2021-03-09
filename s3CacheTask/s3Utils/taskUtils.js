const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const { S3CacheAction } = require('./s3CacheAction');

const restoreCache = async (pipelineInput, s3Client) => {
    const { key, location, bucket } = pipelineInput;
    console.log('Initialise S3CacheAction')
    const cacheAction = new S3CacheAction({s3Client, bucket});
    console.log('resolve path')
    const targetPath = path.resolve(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(),
                                    location);

    console.log('create cache key')
    const hashedKey = await cacheAction.createCacheKey(key, targetPath);

    console.log('maybe get cache entry')
    const cacheReport = await cacheAction.maybeGetCacheEntry(hashedKey, targetPath);

    console.log('report cache')
    const shouldRestore = cacheReport.message === 'cache miss' ? 'false' : 'true'

    const restore = {
        name: 'CacheRestored',
        value: shouldRestore
    };
    tl.setVariable(restore.name, restore.value);
    console.log(`Cache restored: ${shouldRestore}`);
    return;
};

const uploadCache = async (pipelineInput, s3Client) => {
    console.log('get cache restored var')
    const cacheRestored = tl.getVariable('CacheRestored');

    if (cacheRestored === 'false') {
        const { key, location, bucket } = pipelineInput;
        console.log('Initialise S3CacheAction')
        const cacheAction = new S3CacheAction({s3Client, bucket});
        console.log('resolve path')
        const targetPath = path.resolve(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(),
                                        location);

        console.log('create cache key')
        const hashedKey = await cacheAction.createCacheKey(key, targetPath);

        console.log('uploading to cache')
        await cacheAction.createCacheEntry(targetPath, hashedKey);
        tl.setResult(
            tl.TaskResult.Succeeded,
            "Uploaded to cache."
        );
        return;
    } else if (!cacheRestored) {
        console.log('no cache restored var logged')
        tl.setResult(
            tl.TaskResult.Skipped,
            "No cache reported. Upload skipped."
        );
        return;
    } else {
        console.log('cache exists')
        tl.setResult(
            tl.TaskResult.Skipped,
            "Cache exists. Upload skipped."
        );
        return;
    }
    
};

module.exports = { restoreCache, uploadCache };
