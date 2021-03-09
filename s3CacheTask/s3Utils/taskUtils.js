const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const { S3CacheAction } = require('./s3CacheAction');

const addPipelineIdToKey = (key) => {
    const pipelineId = tl.getVariable('System.DefinitionId');
    if (!pipelineId) throw new Error('Pipeline ID undefined, check var: $(System.DefinitionId)')
    console.log(`Isolated caching for pipeline: ${pipelineId}`);
    return pipelineId + ' | ' + key;
};

const restoreCache = async (pipelineInput, s3Client) => {
    const { key, location, bucket, pipelineIsolated } = pipelineInput;
    const cacheAction = new S3CacheAction({s3Client, bucket});
    const targetPath = path.resolve(tl.getVariable('System.DefaultWorkingDirectory') || process.cwd(),
                                    location);

    const keyToHash = pipelineIsolated ? addPipelineIdToKey(key) : key;
    const hashedKey = await cacheAction.createCacheKey(keyToHash, targetPath);

    const cacheReport = await cacheAction.maybeGetCacheEntry(hashedKey, targetPath);

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
    const cacheRestored = tl.getVariable('CacheRestored');

    if (cacheRestored === 'false') {
        const { key, location, bucket, pipelineIsolated } = pipelineInput;
        const cacheAction = new S3CacheAction({s3Client, bucket});
        const targetPath = path.resolve(tl.getVariable('System.DefaultWorkingDirectory') || process.cwd(),
                                        location);
                                        
        const keyToHash = pipelineIsolated ? addPipelineIdToKey(key) : key;
        const hashedKey = await cacheAction.createCacheKey(keyToHash, targetPath);

        await cacheAction.createCacheEntry(targetPath, hashedKey);
        tl.setResult(
            tl.TaskResult.Succeeded,
            'Uploaded to cache.'
        );
        return;
    } else if (!cacheRestored) {
        tl.setResult(
            tl.TaskResult.Skipped,
            'No cache reported. Upload skipped.'
        );
        return;
    } else {
        tl.setResult(
            tl.TaskResult.Skipped,
            'Cache exists. Upload skipped.'
        );
        return;
    }
    
};

module.exports = { restoreCache, uploadCache, addPipelineIdToKey };
