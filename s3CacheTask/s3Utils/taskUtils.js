const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const S3CacheAction = require('./s3CacheAction');
const { debug } = require('./debug');

const addPipelineIdToKey = (key) => {
    const pipelineId = tl.getVariable('System.DefinitionId');
    if (!pipelineId) throw new Error('Pipeline ID undefined, check var: $(System.DefinitionId)');
    debug(`Isolated caching for pipeline: ${pipelineId}`);
    return pipelineId + '/' + key;
};

const parseHrtimeToSeconds = (hrtime) => {
    const seconds = (hrtime[0] + (hrtime[1] / 1e9)).toFixed(3);
    return seconds;
}

const restoreCache = async (pipelineInput, s3Client) => {
    const { key, location, bucket, pipelineIsolated } = pipelineInput;
    const cacheAction = new S3CacheAction({ s3Client: s3Client, bucket: bucket });
    const workingDir = tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();
    const targetPath = path.resolve(workingDir, location);

    debug(`Extracting from: ${targetPath}`);

    const hashedKey = await cacheAction.createCacheKey(key, workingDir);
    const formattedKey = pipelineIsolated === 'true' ? addPipelineIdToKey(hashedKey) : hashedKey;

    debug(`Using S3 cache key: ${formattedKey}`);
    debug(`Evaluating S3 cache for path: s3://${bucket}/${formattedKey}`);

    const startTime = process.hrtime();
    const cacheReport = await cacheAction.maybeGetCacheEntry(formattedKey, targetPath);
    const elapsedSeconds = parseHrtimeToSeconds(process.hrtime(startTime));

    debug(`Cache report from S3: ${cacheReport.message}`);

    let cacheRestored;
    if (cacheReport.message === 'cache miss') {
        cacheRestored = 'false';
    } else {
        cacheRestored = 'true';
        debug(`Downloaded ${cacheReport.tarSize} bytes and extracted ${cacheReport.extractedSize} in ${elapsedSeconds} seconds.`);
    }

    const restore = {
        name: 'CacheRestored',
        value: cacheRestored
    };
    tl.setVariable(restore.name, restore.value);
    debug(`Cache restored: ${cacheRestored}`);
    return;
};

const uploadCache = async (pipelineInput, s3Client) => {
    const cacheRestored = tl.getVariable('CacheRestored');

    if (cacheRestored === 'false') {
        const { key, location, bucket, pipelineIsolated } = pipelineInput;
        const cacheAction = new S3CacheAction({ s3Client: s3Client, bucket: bucket });
        const workingDir = tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();
        const targetPath = path.resolve(workingDir, location);
        
        debug(`Extracting from: ${targetPath}`)

        const hashedKey = await cacheAction.createCacheKey(key, workingDir);
        const formattedKey = pipelineIsolated === 'true' ? addPipelineIdToKey(hashedKey) : hashedKey;

        debug(`Using S3 cache key: ${formattedKey}`);
        debug(`Evaluating S3 cache for path: s3://${bucket}/${formattedKey}`);

        await cacheAction.createCacheEntry(targetPath, formattedKey);
        tl.setResult(
            tl.TaskResult.Succeeded,
            'Uploaded to cache.'
        );
        debug('Uploaded to cache.');
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

module.exports = { addPipelineIdToKey, restoreCache, uploadCache };
