const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const { S3CacheAction } = require('./s3CacheAction');

const restoreCache = async (pipelineInput, s3Client) => {
    const { key, location, bucket } = pipelineInput;
    const cacheAction = new S3CacheAction({s3Client, bucket});
    const targetPath = path.resolve(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(),
                                    location);

    const hashedKey = await cacheAction.createCacheKey(key, targetPath);

    const cacheReport = await cacheAction.maybeGetCacheEntry(hashedKey, targetPath);

    const shouldRestore = cacheReport.message === 'cache miss' ? 'false' : 'true'

    const restore = {
        name: 'CacheRestored',
        value: shouldRestore
    };
    console.log(shouldRestore);
    tl.setVariable(restore.name, restore.value);
};

const uploadCache = async (pipelineInput, s3Client) => {
    const cacheRestored = tl.getVariable('CacheRestored');

    if (cacheRestored === 'false') {
        const { key, location, bucket } = pipelineInput;
        const cacheAction = new S3CacheAction({s3Client, bucket});
        const targetPath = path.resolve(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(),
                                        location);

        const hashedKey = await cacheAction.createCacheKey(key, targetPath);

        await cacheAction.maybeGetCacheEntry(hashedKey, targetPath);
    } else if (!cacheRestored) {
        tl.setResult(
            tl.TaskResult.Skipped,
            "No cache reported. Upload skipped."
        );
    } else {
        tl.setResult(
            tl.TaskResult.Skipped,
            "Cache exists. Upload skipped."
        );
    }
    
};

module.exports = { restoreCache, uploadCache };
